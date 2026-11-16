import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { POST as createPublication } from "../app/api/admin/v1/publications/[kind]/route";
import { POST as uploadImage } from "../app/api/admin/v1/publications/[kind]/[id]/image/route";
import { GET as readImage } from "../app/api/v1/publication-images/[mediaId]/route";
import { publicationSchema } from "../src/lib/validation/publication";
import { listAdminPublications, savePublication } from "../src/server/content/publications";
import { readWebsiteInsights, readWebsiteProjects } from "../src/server/content/website-publications";
import { prisma } from "../src/server/db";

const sample = {
  title: "Test content", slug: "test-content", summary: "A test summary",
  content: { body: "First paragraph.\n\nSecond paragraph.", category: "Technology", technologies: "TypeScript, PostgreSQL" },
  status: "DRAFT" as const,
};

test("publication validation rejects unsafe slugs and missing content", () => {
  assert.equal(publicationSchema.safeParse(sample).success, true);
  assert.equal(publicationSchema.safeParse({ ...sample, slug: "../private" }).success, false);
  assert.equal(publicationSchema.safeParse({ ...sample, content: { ...sample.content, body: "" } }).success, false);
  assert.equal(publicationSchema.safeParse({ ...sample, status: "SCHEDULED" }).success, false);
});

test("publication and image mutations reject cross-origin requests", async () => {
  const request = () => new Request("http://localhost/api/admin", {
    method: "POST", headers: { Origin: "https://untrusted.invalid", "Content-Type": "application/json" }, body: "{}",
  });
  assert.equal((await createPublication(request(), { params: Promise.resolve({ kind: "projects" }) })).status, 403);
  assert.equal((await uploadImage(request(), { params: Promise.resolve({ kind: "projects", id: randomUUID() }) })).status, 403);
});

test("drafts, permissions and publishing persist in isolated PostgreSQL", {
  skip: process.env.RUN_PUBLICATION_DB_TESTS !== "1",
}, async () => {
  const database = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(database.hostname, "127.0.0.1");
  assert.equal(database.port, "55434");
  assert.equal(database.pathname, "/webnex_publication_test");
  const actor = await prisma.user.create({ data: { email: `${randomUUID()}@example.invalid` }, select: { id: true } });
  for (const kind of ["projects", "insights"] as const) {
    const data = { ...sample, slug: `${kind}-${randomUUID()}` };
    const draft = await savePublication(kind, null, data, actor.id, false);
    assert.ok("id" in draft && draft.id);
    const id = draft.id;
    const getItems = kind === "projects" ? readWebsiteProjects : readWebsiteInsights;
    assert.equal((await getItems()).items.some((item) => item.slug === data.slug), false);
    assert.deepEqual(await savePublication(kind, id, { ...data, status: "PUBLISHED" }, actor.id, false), { error: "PUBLISH_PERMISSION_REQUIRED" });
    const published = await savePublication(kind, id, { ...data, status: "PUBLISHED" }, actor.id, true);
    assert.ok("id" in published);
    assert.equal((await getItems()).items.some((item) => item.slug === data.slug), true);
    assert.deepEqual(await savePublication(kind, id, { ...data, slug: "changed", status: "PUBLISHED" }, actor.id, true), { error: "SLUG_LOCKED" });
    assert.deepEqual(await savePublication(kind, id, data, actor.id, false), { error: "PUBLISH_PERMISSION_REQUIRED" });
    await savePublication(kind, id, data, actor.id, true);
    assert.equal((await getItems()).items.some((item) => item.slug === data.slug), false);
    const media = await prisma.mediaAsset.create({ data: {
      storageKey: `test/${randomUUID()}`, originalName: "test", mimeType: "image/webp", sizeBytes: BigInt(1), uploadedById: actor.id,
    } });
    if (kind === "projects") await prisma.project.update({ where: { id }, data: { coverImageId: media.id } });
    else await prisma.blogPost.update({ where: { id }, data: { coverImageId: media.id } });
    assert.equal((await readImage(new Request("http://localhost"), { params: Promise.resolve({ mediaId: media.id }) })).status, 404);
    assert.equal(await prisma.auditLog.count({ where: { actorId: actor.id, entityId: id } }), 3);
    const legacy = kind === "projects"
      ? await prisma.project.create({ data: { title: "Legacy project", slug: `legacy-${randomUUID()}`, content: { legacy: true }, status: "PUBLISHED", publishedAt: new Date() } })
      : await prisma.blogPost.create({ data: { title: "Legacy insight", slug: `legacy-${randomUUID()}`, content: { legacy: true }, status: "PUBLISHED", publishedAt: new Date() } });
    const admin = await listAdminPublications(kind);
    assert.ok(admin.unsupported.some((item) => item.id === legacy.id));
    assert.ok(admin.editable.some((item) => item.id === id));
    assert.equal((await getItems()).items.some((item) => item.slug === legacy.slug), false);
    const archived = kind === "projects"
      ? await prisma.project.create({ data: { title: "Archived project", slug: `archived-${randomUUID()}`, content: sample.content, status: "ARCHIVED" } })
      : await prisma.blogPost.create({ data: { title: "Archived insight", slug: `archived-${randomUUID()}`, content: sample.content, status: "ARCHIVED" } });
    assert.ok((await listAdminPublications(kind)).unsupported.some((item) => item.id === archived.id));
  }
});
