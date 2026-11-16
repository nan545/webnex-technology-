import assert from "node:assert/strict";
import test from "node:test";
import { compare } from "bcryptjs";
import { POST as dashboardReset } from "../app/api/admin/v1/users/[id]/password/route";
import { resetAdminPassword, resetOtherAdminPassword } from "../src/server/auth/admin-password-reset";
import { prisma } from "../src/server/db";

test("offline administrator reset validates, invalidates sessions and audits the change", async (t) => {
  const user = prisma.user;
  const audit = prisma.auditLog;
  const transactionDescriptor = Object.getOwnPropertyDescriptor(prisma, "$transaction");
  t.after(() => {
    Reflect.deleteProperty(user, "findMany");
    Reflect.deleteProperty(user, "update");
    Reflect.deleteProperty(audit, "create");
    if (transactionDescriptor) Object.defineProperty(prisma, "$transaction", transactionDescriptor);
    else Reflect.deleteProperty(prisma, "$transaction");
  });
  let matches = [{ id: "test-admin" }];
  const updates: Array<{ where: { id: string }; data: { passwordHash: string; sessionVersion: { increment: number }; failedLoginAttempts: number; lockedUntil: null } }> = [];
  const auditEntries: Array<{ data: { action: string; entityId: string; details: { method: string } } }> = [];
  Object.defineProperty(prisma, "$transaction", { configurable: true, value: async (
    run: (tx: typeof prisma) => Promise<void>,
    options: { maxWait: number; timeout: number },
  ) => {
    assert.ok(options.maxWait >= 10_000);
    assert.ok(options.timeout >= 10_000);
    return run(prisma);
  } });
  Object.defineProperty(user, "findMany", { configurable: true, value: async (args: { where: { email: { equals: string }; isActive: boolean } }) => {
    assert.equal(args.where.email.equals, "admin@example.com");
    assert.equal(args.where.isActive, true);
    return matches;
  } });
  Object.defineProperty(user, "update", { configurable: true, value: async (args: (typeof updates)[number]) => { updates.push(args); } });
  Object.defineProperty(audit, "create", { configurable: true, value: async (args: (typeof auditEntries)[number]) => { auditEntries.push(args); } });

  await assert.rejects(resetAdminPassword({ email: "admin@example.com", password: "short" }), /12-72/);
  assert.equal(updates.length, 0);
  await resetAdminPassword({ email: " Admin@Example.com ", password: "A-long-test-password" });
  const update = updates[0];
  assert.ok(update);
  assert.equal(update.where.id, "test-admin");
  assert.equal(await compare("A-long-test-password", update.data.passwordHash), true);
  assert.equal(update.data.sessionVersion.increment, 1);
  assert.equal(update.data.failedLoginAttempts, 0);
  assert.equal(update.data.lockedUntil, null);
  assert.equal(auditEntries[0]?.data.action, "ADMIN_PASSWORD_RESET");
  assert.equal(auditEntries[0]?.data.entityId, "test-admin");

  matches = [];
  await assert.rejects(resetAdminPassword({ email: "admin@example.com", password: "A-long-test-password" }), /not found/);
  assert.equal(updates.length, 1);
  matches = [{ id: "one" }, { id: "two" }];
  await assert.rejects(resetAdminPassword({ email: "admin@example.com", password: "A-long-test-password" }), /unique/);
  assert.equal(updates.length, 1);
});

test("dashboard password reset updates only active administrators and records the actor", async (t) => {
  const transactionDescriptor = Object.getOwnPropertyDescriptor(prisma, "$transaction");
  t.after(() => {
    Reflect.deleteProperty(prisma.user, "updateMany");
    Reflect.deleteProperty(prisma.auditLog, "create");
    if (transactionDescriptor) Object.defineProperty(prisma, "$transaction", transactionDescriptor);
    else Reflect.deleteProperty(prisma, "$transaction");
  });
  let count = 1;
  const updates: Array<{ where: { id: string; isActive: boolean }; data: { passwordHash: string; sessionVersion: { increment: number }; failedLoginAttempts: number; lockedUntil: null } }> = [];
  const audits: Array<{ data: { actorId: string; entityId: string; action: string; details: { method: string } } }> = [];
  Object.defineProperty(prisma, "$transaction", { configurable: true, value: async (run: (tx: typeof prisma) => Promise<boolean>) => run(prisma) });
  Object.defineProperty(prisma.user, "updateMany", { configurable: true, value: async (args: (typeof updates)[number]) => { updates.push(args); return { count }; } });
  Object.defineProperty(prisma.auditLog, "create", { configurable: true, value: async (args: (typeof audits)[number]) => { audits.push(args); } });

  await assert.rejects(resetOtherAdminPassword("actor", "actor", "A-long-test-password"), /Invalid/);
  await assert.rejects(resetOtherAdminPassword("actor", "target", "short"), /Invalid/);
  assert.equal(updates.length, 0);
  assert.equal(await resetOtherAdminPassword("actor", "target", "A-long-test-password"), true);
  const update = updates[0];
  const audit = audits[0];
  assert.ok(update);
  assert.ok(audit);
  assert.equal(update.where.id, "target");
  assert.equal(update.where.isActive, true);
  assert.equal(await compare("A-long-test-password", update.data.passwordHash), true);
  assert.equal(update.data.sessionVersion.increment, 1);
  assert.equal(update.data.failedLoginAttempts, 0);
  assert.equal(update.data.lockedUntil, null);
  assert.deepEqual(audit.data, {
    actorId: "actor", entityId: "target", action: "ADMIN_PASSWORD_RESET",
    entityType: "User", details: { method: "dashboard" },
  });
  count = 0;
  assert.equal(await resetOtherAdminPassword("actor", "missing", "A-long-test-password"), false);
  assert.equal(audits.length, 1);
});

test("dashboard password reset rejects cross-origin requests", async () => {
  const response = await dashboardReset(new Request("http://localhost/api/admin/v1/users/00000000-0000-4000-8000-000000000000/password", {
    method: "POST",
    headers: { Origin: "https://untrusted.invalid", "Content-Type": "application/json" },
    body: "{}",
  }), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }) });
  assert.equal(response.status, 403);
});

