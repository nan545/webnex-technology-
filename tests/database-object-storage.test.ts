import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "../src/server/db";
import {
  putPrivateObject,
  readPrivateObject,
  removePrivateObject,
} from "../src/server/integrations/object-storage";

test("database media persists, rejects overwrites, and removes only the requested object", {
  skip: process.env.RUN_MEDIA_DB_TESTS !== "1",
}, async (t) => {
  const database = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(database.hostname, "127.0.0.1");
  assert.equal(database.port, "5433");
  assert.match(database.pathname, /^\/media_test_[a-f0-9]+$/);
  assert.equal(process.env.OBJECT_STORAGE_DRIVER, "database");
  const key = `team/test/${randomUUID()}.webp`;
  const otherKey = `team/test/${randomUUID()}.webp`;
  t.after(async () => {
    await prisma.storedMediaObject.deleteMany({ where: { storageKey: { in: [key, otherKey] } } });
    await prisma.$disconnect();
  });
  const bytes = Buffer.from("synthetic image");
  await putPrivateObject(key, bytes);
  await putPrivateObject(otherKey, bytes);
  const stream = await readPrivateObject(key);
  assert.deepEqual(Buffer.from(await new Response(stream).arrayBuffer()), bytes);
  await assert.rejects(putPrivateObject(key, Buffer.from("replacement")));
  await assert.rejects(putPrivateObject(`team/test/${randomUUID()}.webp`, Buffer.alloc(5 * 1024 * 1024 + 1)));
  await removePrivateObject(key);
  await removePrivateObject(key);
  await assert.rejects(readPrivateObject(key));
  assert.deepEqual(Buffer.from(await new Response(await readPrivateObject(otherKey)).arrayBuffer()), bytes);
});
