import assert from "node:assert/strict";
import test from "node:test";
import { mediaMetadataSchema, mediaSearchSchema } from "../src/lib/validation/media";
import { safeMediaOriginalName } from "../src/server/media/media-library";

test("media metadata rejects overlong fields and normalizes valid fields", () => {
  assert.equal(
    mediaMetadataSchema.safeParse({ altText: "  Office team  ", caption: "  Main entrance  " }).success,
    true,
  );
  const result = mediaMetadataSchema.parse({ altText: "  Office team  ", caption: null });
  assert.equal(result.altText, "Office team");
  assert.equal(result.caption, null);
  assert.equal(mediaMetadataSchema.safeParse({ altText: "x".repeat(251) }).success, false);
  assert.equal(mediaMetadataSchema.safeParse({ altText: "", caption: "x".repeat(501) }).success, false);
});

test("media search pagination and original names are safely bounded", () => {
  assert.deepEqual(mediaSearchSchema.parse({ search: "  lobby  ", page: "2", pageSize: "12" }), {
    search: "lobby",
    page: 2,
    pageSize: 12,
  });
  assert.equal(mediaSearchSchema.safeParse({ page: 0 }).success, false);
  assert.equal(mediaSearchSchema.safeParse({ pageSize: 51 }).success, false);
  assert.equal(safeMediaOriginalName("  photo\u0000.webp  "), "photo.webp");
  assert.equal(safeMediaOriginalName("x".repeat(300)).length, 255);
});
