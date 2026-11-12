import assert from "node:assert/strict";
import test from "node:test";
import { enquirySchema } from "../src/lib/validation/enquiries";
import { parsePagination } from "../src/server/api/response";

const validEnquiry = {
  fullName: "Ada Example",
  email: " ADA@EXAMPLE.COM ",
  phone: "+233 20 123 4567",
  company: "Example Company",
  service: "web-development",
  budget: "",
  description: "We need a responsive website for our business.",
  preferredContact: "Email",
  website: "",
};

test("valid enquiry values are normalized before persistence", () => {
  const parsed = enquirySchema.safeParse(validEnquiry);

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.email, "ada@example.com");
  assert.equal(parsed.data.fullName, "Ada Example");
});

test("invalid email, service, contact preference and short descriptions are rejected", () => {
  const parsed = enquirySchema.safeParse({
    ...validEnquiry,
    email: "not-an-email",
    service: "unapproved-service",
    preferredContact: "Post",
    description: "Too short.",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;
  assert.deepEqual(
    parsed.error.issues.map((issue) => issue.path[0]).sort(),
    ["description", "email", "preferredContact", "service"],
  );
});

test("bounded fields reject oversized values", () => {
  const parsed = enquirySchema.safeParse({
    ...validEnquiry,
    fullName: "a".repeat(121),
    description: "x".repeat(5001),
  });

  assert.equal(parsed.success, false);
});

test("pagination is bounded and rejects malformed or excessively large offsets", () => {
  assert.deepEqual(parsePagination(new URLSearchParams()), {
    page: 1,
    pageSize: 12,
    skip: 0,
  });
  assert.equal(parsePagination(new URLSearchParams("page=0")), null);
  assert.equal(parsePagination(new URLSearchParams("pageSize=51")), null);
  assert.equal(parsePagination(new URLSearchParams("page=1000001")), null);
});
