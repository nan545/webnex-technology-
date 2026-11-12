import assert from "node:assert/strict";
import test from "node:test";
import {
  cmsServiceCreateSchema,
  cmsServiceUpdateSchema,
} from "../src/lib/validation/cms-service";

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
