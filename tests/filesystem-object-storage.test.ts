import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  putFileObject,
  readFileObject,
  removeFileObject,
} from "../src/server/integrations/filesystem-object-storage";

test("filesystem storage persists private objects and supports idempotent removal", async (t) => {
  const storagePath = await mkdtemp(join(tmpdir(), "webnex-media-"));
  t.after(() => rm(storagePath, { recursive: true, force: true }));

  const key = "team/member-id/photo.webp";
  const body = Buffer.from("optimized image bytes");
  await putFileObject(storagePath, key, body);

  const stream = await readFileObject(storagePath, key);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  assert.deepEqual(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))), body);
  assert.deepEqual(await readFile(join(storagePath, key)), body);

  if (process.platform !== "win32") {
    assert.equal((await stat(join(storagePath, key))).mode & 0o777, 0o600);
  }

  await removeFileObject(storagePath, key);
  await removeFileObject(storagePath, key);
  await assert.rejects(readFileObject(storagePath, key), { code: "ENOENT" });
});

test("filesystem storage rejects traversal keys and does not overwrite objects", async (t) => {
  const storagePath = await mkdtemp(join(tmpdir(), "webnex-media-"));
  t.after(() => rm(storagePath, { recursive: true, force: true }));

  await assert.rejects(putFileObject(storagePath, "../outside.webp", Buffer.from("x")));
  await assert.rejects(putFileObject(storagePath, "team\\outside.webp", Buffer.from("x")));
  await putFileObject(storagePath, "team/photo.webp", Buffer.from("original"));
  await assert.rejects(putFileObject(storagePath, "team/photo.webp", Buffer.from("replacement")));
  assert.deepEqual(await readFile(join(storagePath, "team/photo.webp")), Buffer.from("original"));
});
