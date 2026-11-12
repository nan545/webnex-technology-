import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  teamMemberCreateSchema,
  teamMemberUpdateSchema,
  teamPhotoUploadSchema,
} from "../src/lib/validation/team-member";
import {
  InvalidTeamPhotoError,
  isAllowedTeamPhotoMimeType,
  optimizeTeamPhoto,
} from "../src/server/media/team-photo";

const validMember = {
  name: "Approved Example",
  title: "Software Engineer",
  department: null,
  biography: "A company-approved biography.",
  linkedinUrl: "https://www.linkedin.com/in/approved-example",
  githubUrl: null,
  portfolioUrl: null,
  otherSocialLinks: [{ label: "Company profile", url: "https://example.com/team/approved-example" }],
  sortOrder: 0,
  isActive: true,
};

test("team member validation accepts approved HTTPS profile data", () => {
  const parsed = teamMemberCreateSchema.parse(validMember);

  assert.equal(parsed.name, "Approved Example");
  assert.equal(parsed.otherSocialLinks.length, 1);
});

test("team member validation rejects insecure links and malformed updates", () => {
  assert.equal(teamMemberCreateSchema.safeParse({
    ...validMember,
    githubUrl: "http://example.com/profile",
  }).success, false);
  assert.equal(teamMemberCreateSchema.safeParse({
    ...validMember,
    otherSocialLinks: [{ label: "Profile", url: "javascript:alert(1)" }],
  }).success, false);
  assert.equal(teamMemberUpdateSchema.safeParse({}).success, false);
  assert.equal(teamMemberUpdateSchema.safeParse({ status: "APPROVED" }).success, true);
});

test("photo metadata validation and MIME allow-list accept only supported types", () => {
  assert.equal(teamPhotoUploadSchema.safeParse({ altText: "Portrait, company-approved." }).success, true);
  assert.equal(teamPhotoUploadSchema.safeParse({ altText: "x".repeat(251) }).success, false);
  assert.equal(isAllowedTeamPhotoMimeType("image/jpeg"), true);
  assert.equal(isAllowedTeamPhotoMimeType("image/svg+xml"), false);
});

test("photo optimizer emits a normalized WebP image at the profile dimensions", async () => {
  const source = await sharp({
    create: {
      width: 320,
      height: 400,
      channels: 3,
      background: { r: 32, g: 64, b: 96 },
    },
  }).png().toBuffer();

  const optimized = await optimizeTeamPhoto(source, "image/png");
  const metadata = await sharp(optimized.data).metadata();

  assert.equal(optimized.width, 800);
  assert.equal(optimized.height, 1000);
  assert.equal(metadata.format, "webp");
});

test("photo optimizer rejects MIME mismatches and invalid image bytes", async () => {
  const png = await sharp({
    create: {
      width: 12,
      height: 12,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  }).png().toBuffer();

  await assert.rejects(
    optimizeTeamPhoto(png, "image/webp"),
    InvalidTeamPhotoError,
  );
  await assert.rejects(optimizeTeamPhoto(Buffer.from("not an image"), "image/png"));
});
