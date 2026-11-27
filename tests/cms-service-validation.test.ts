import assert from "node:assert/strict";
import test from "node:test";
import {
  cmsServiceCreateSchema,
  cmsServiceUpdateSchema,
} from "../src/lib/validation/cms-service";
import { Prisma } from "../src/generated/prisma/client";
import { readPublishedServiceForPage, readPublishedServicesForPage } from "../src/server/content/services";
import { readPublishedTeamMembers } from "../src/server/content/team";
import { prisma } from "../src/server/db";

test("service creation normalizes slugs and applies structured content defaults", () => {
  const parsed = cmsServiceCreateSchema.parse({
    title: "Website Engineering",
    slug: "Website-Engineering",
    summary: "A short, verified description.",
    content: {},
  });

  assert.equal(parsed.slug, "website-engineering");
  assert.deepEqual(parsed.content.problems, []);
  assert.equal(parsed.content.icon, "code");
});

test("service content rejects unapproved icons, unknown fields, and oversized arrays", () => {
  const invalidIcon = cmsServiceCreateSchema.safeParse({
    title: "Valid title",
    slug: "valid-title",
    summary: null,
    content: { icon: "script" },
  });
  const unknownField = cmsServiceCreateSchema.safeParse({
    title: "Valid title",
    slug: "valid-title",
    summary: null,
    content: { html: "<script>alert(1)</script>" },
  });
  const tooManyProblems = cmsServiceCreateSchema.safeParse({
    title: "Valid title",
    slug: "valid-title",
    summary: null,
    content: { problems: Array.from({ length: 13 }, (_, index) => `Problem ${index}`) },
  });

  assert.equal(invalidIcon.success, false);
  assert.equal(unknownField.success, false);
  assert.equal(tooManyProblems.success, false);
});

test("service updates accept workflow states but reject malformed slugs", () => {
  assert.equal(cmsServiceUpdateSchema.safeParse({ status: "IN_REVIEW" }).success, true);
  assert.equal(cmsServiceUpdateSchema.safeParse({ slug: "../bad" }).success, false);
  assert.equal(cmsServiceUpdateSchema.safeParse({ status: "SCHEDULED" }).success, false);
});

test("service pages use local content during outages and return to database content", async (t) => {
  const service = prisma.service;
  const redirects = prisma.serviceRedirect;
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  let calls = 0;
  t.after(() => {
    Reflect.deleteProperty(service, "findFirst");
    Reflect.deleteProperty(service, "findMany");
    Reflect.deleteProperty(redirects, "findUnique");
  });
  Object.defineProperty(service, "findFirst", { configurable: true, value: async () => {
    calls += 1;
    throw new Prisma.PrismaClientKnownRequestError("connection closed", {
      code: "P1017",
      clientVersion: "test",
    });
  } });
  const fallback = await readPublishedServiceForPage("custom-software-development");
  assert.equal(fallback.unavailable, true);
  assert.equal(fallback.service?.title, "Custom business software");
  assert.equal((await readPublishedServiceForPage("not-in-fallback")).service, null);
  assert.ok((await readPublishedServicesForPage()).items.length > 0);
  assert.equal(calls, 1);

  now += 10_001;
  let hasPublishedServices = false;
  Object.defineProperty(service, "findFirst", { configurable: true, value: async (args: { where?: { slug?: string } }) => {
    if (args.where?.slug) return null;
    return hasPublishedServices ? { id: "published-service" } : null;
  } });
  Object.defineProperty(redirects, "findUnique", { configurable: true, value: async () => null });
  const emptyDatabaseService = await readPublishedServiceForPage("custom-software-development");
  assert.equal(emptyDatabaseService.unavailable, false);
  assert.equal(emptyDatabaseService.service?.title, "Custom business software");
  assert.deepEqual(await readPublishedServiceForPage("missing"), {
    service: null,
    redirectSlug: null,
    unavailable: false,
  });
  hasPublishedServices = true;
  assert.equal(
    (await readPublishedServiceForPage("custom-software-development")).service,
    null,
  );
  hasPublishedServices = false;

  Object.defineProperty(redirects, "findUnique", { configurable: true, value: async () => ({
    service: { slug: "new-slug", status: "PUBLISHED", publishedAt: new Date(0) },
  }) });
  assert.equal((await readPublishedServiceForPage("old-slug")).redirectSlug, "new-slug");

  Object.defineProperty(service, "findFirst", { configurable: true, value: async () => ({
    id: "test-id",
    slug: "example",
    title: "Example service",
    summary: null,
    content: {},
    seoTitle: null,
    seoDescription: null,
  }) });
  const result = await readPublishedServiceForPage("example");
  assert.equal(result.unavailable, false);
  assert.equal(result.service, null);

  Object.defineProperty(service, "findMany", { configurable: true, value: async () => [] });
  const emptyDatabaseList = await readPublishedServicesForPage();
  assert.equal(emptyDatabaseList.unavailable, false);
  assert.ok(emptyDatabaseList.items.length > 0);
  assert.ok(emptyDatabaseList.items.some((item) => item.slug === "custom-software-development"));
  Object.defineProperty(service, "findMany", { configurable: true, value: async () => {
    throw new Error("unexpected failure");
  } });
  await assert.rejects(readPublishedServicesForPage(), /unexpected failure/);
});

test("team outage shows no invented profiles and recovers when the database returns", async (t) => {
  const team = prisma.teamMember;
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  t.after(() => Reflect.deleteProperty(team, "findMany"));
  Object.defineProperty(team, "findMany", { configurable: true, value: async () => {
    throw new Prisma.PrismaClientKnownRequestError("connection closed", {
      code: "P1017",
      clientVersion: "test",
    });
  } });

  assert.deepEqual(await readPublishedTeamMembers(), { items: [], unavailable: true });

  now += 10_001;
  Object.defineProperty(team, "findMany", { configurable: true, value: async () => [{
    slug: "approved-profile",
    name: "Approved Profile",
    title: "Engineer",
    department: null,
    biography: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    otherSocialLinks: null,
    profileImage: null,
  }] });
  const recovered = await readPublishedTeamMembers();
  assert.equal(recovered.unavailable, false);
  assert.equal(recovered.items[0]?.slug, "approved-profile");
});

test("non-connectivity database errors are not disguised as outages", async (t) => {
  const service = prisma.service;
  t.after(() => Reflect.deleteProperty(service, "findMany"));
  Object.defineProperty(service, "findMany", { configurable: true, value: async () => {
    throw new Prisma.PrismaClientKnownRequestError("query failed", {
      code: "P2010",
      clientVersion: "test",
      meta: { code: "42601" },
    });
  } });
  await assert.rejects(readPublishedServicesForPage(), (error) =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2010",
  );
});
