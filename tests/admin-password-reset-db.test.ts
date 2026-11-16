import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { compare } from "bcryptjs";
import { resetOtherAdminPassword } from "../src/server/auth/admin-password-reset";
import { prisma } from "../src/server/db";

test("dashboard reset persists and unlocks an administrator in isolated PostgreSQL", {
  skip: process.env.RUN_RESET_DB_TESTS !== "1",
}, async () => {
  const database = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(database.hostname, "127.0.0.1");
  assert.equal(database.port, "55433");
  assert.equal(database.pathname, "/webnex_reset_test");
  const suffix = randomUUID();
  const role = await prisma.role.findUniqueOrThrow({ where: { key: "EDITOR" }, select: { id: true } });
  const actor = await prisma.user.create({ data: { email: `actor-${suffix}@example.invalid` }, select: { id: true } });
  const target = await prisma.user.create({
    data: {
      email: `target-${suffix}@example.invalid`,
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 60_000),
      roles: { create: { roleId: role.id } },
    },
    select: { id: true, sessionVersion: true },
  });
  assert.equal(await resetOtherAdminPassword(actor.id, target.id, "A-long-test-password"), true);
  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: target.id },
    select: { passwordHash: true, sessionVersion: true, failedLoginAttempts: true, lockedUntil: true },
  });
  assert.ok(updated.passwordHash);
  assert.equal(await compare("A-long-test-password", updated.passwordHash), true);
  assert.equal(updated.sessionVersion, target.sessionVersion + 1);
  assert.equal(updated.failedLoginAttempts, 0);
  assert.equal(updated.lockedUntil, null);
  assert.equal(await prisma.auditLog.count({ where: { actorId: actor.id, entityId: target.id, action: "ADMIN_PASSWORD_RESET" } }), 1);
  await prisma.user.update({ where: { id: target.id }, data: { isActive: false } });
  assert.equal(await resetOtherAdminPassword(actor.id, target.id, "Another-test-password"), false);
});
