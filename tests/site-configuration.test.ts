import assert from "node:assert/strict";
import test from "node:test";
import { defaultNavigation } from "../src/config/navigation";
import {
  contactPhoneSchema,
  navigationConfigurationSchema,
} from "../src/lib/validation/site-configuration";
import { readBoundedJson } from "../src/server/api/bounded-json";
import {
  getContactPhone,
  getNavigationConfiguration,
  readContactPhone,
  readNavigationConfiguration,
} from "../src/server/content/site-configuration";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/server/db";

test("navigation accepts existing pages but rejects invalid, duplicate, or administrative links", () => {
  assert.equal(navigationConfigurationSchema.safeParse(defaultNavigation).success, true);
  for (const href of ["https://example.com", "//example.com", "/admin", "/missing", "javascript:alert(1)"]) {
    assert.equal(navigationConfigurationSchema.safeParse({
      ...defaultNavigation,
      header: [{ label: "Link", href }],
    }).success, false);
  }
  assert.equal(navigationConfigurationSchema.safeParse({
    ...defaultNavigation,
    header: [{ label: "Home", href: "/" }, { label: "Again", href: "/" }],
  }).success, false);
  assert.equal(navigationConfigurationSchema.safeParse({
    ...defaultNavigation,
    header: [{ label: "Services", href: "/services" }],
  }).success, false);
});

test("contact phone accepts an empty or valid number and rejects unsafe values", () => {
  assert.equal(contactPhoneSchema.safeParse({ phone: "" }).success, true);
  assert.equal(contactPhoneSchema.safeParse({ phone: "+233 20 123 4567" }).success, true);
  assert.equal(contactPhoneSchema.safeParse({ phone: "020 123 4567" }).success, true);
  assert.equal(contactPhoneSchema.safeParse({ phone: "javascript:1234567" }).success, false);
  assert.equal(contactPhoneSchema.safeParse({ phone: "+123" }).success, false);
});

test("public settings use defaults, return saved data, and reject malformed stored data", async (t) => {
  const settings = prisma.siteSetting;
  t.after(() => Reflect.deleteProperty(settings, "findUnique"));
  Object.defineProperty(settings, "findUnique", { configurable: true, value: async () => null });
  assert.deepEqual(await getNavigationConfiguration(), defaultNavigation);
  assert.equal(await getContactPhone(), "");

  Object.defineProperty(settings, "findUnique", { configurable: true, value: async ({ where }: { where: { key: string; isPublic: boolean } }) => {
    assert.equal(where.isPublic, true);
    return { value: where.key === "public_navigation_v1" ? defaultNavigation : "+233 20 123 4567" };
  } });
  assert.deepEqual(await getNavigationConfiguration(), defaultNavigation);
  assert.equal(await getContactPhone(), "+233 20 123 4567");

  Object.defineProperty(settings, "findUnique", { configurable: true, value: async () => ({ value: { malformed: true } }) });
  await assert.rejects(getNavigationConfiguration(), /invalid/);
  await assert.rejects(getContactPhone(), /invalid/);
});

test("configuration requests reject malformed, oversized, and non-JSON bodies", async () => {
  const request = (body: string, contentType = "application/json") => new Request("http://localhost", {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  assert.equal((await readBoundedJson(request("{}", "text/plain"))).error?.status, 415);
  assert.equal((await readBoundedJson(request("{"))).error?.status, 400);
  assert.equal((await readBoundedJson(request("x".repeat(16_385)))).error?.status, 413);
  assert.deepEqual((await readBoundedJson(request('{"phone":""}'))).value, { phone: "" });
});

test("public settings fall back when PostgreSQL is unavailable", async (t) => {
  const settings = prisma.siteSetting;
  t.after(() => Reflect.deleteProperty(settings, "findUnique"));
  Object.defineProperty(settings, "findUnique", {
    configurable: true,
    value: async () => {
      throw new Prisma.PrismaClientInitializationError("Database unavailable", "test", "P1001");
    },
  });
  assert.deepEqual(await readNavigationConfiguration(), defaultNavigation);
  assert.equal(await readContactPhone(), "");
});
