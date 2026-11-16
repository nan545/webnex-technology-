import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { POST as createRole } from "../app/api/admin/v1/roles/route";
import { PATCH as editRole } from "../app/api/admin/v1/roles/[id]/route";
import { customRoleSchema } from "../src/lib/validation/roles";
import { resetAdminPassword } from "../src/server/auth/admin-password-reset";
import { RoleManagementError, saveCustomRole } from "../src/server/auth/role-management";
import { prisma } from "../src/server/db";

test("custom roles require dashboard access and cannot grant user or role administration", () => {
  const valid = { name: "Content manager", permissions: ["dashboard:read", "content:read"] };
  assert.equal(customRoleSchema.safeParse(valid).success, true);
  assert.equal(customRoleSchema.safeParse({ ...valid, permissions: ["content:read"] }).success, false);
  for (const key of ["users:manage", "roles:manage"]) {
    assert.equal(customRoleSchema.safeParse({ ...valid, permissions: [...valid.permissions, key] }).success, false);
  }
  assert.equal(customRoleSchema.safeParse({ ...valid, permissions: ["dashboard:read", "dashboard:read"] }).success, false);
});

test("role mutation endpoints reject cross-origin requests", async () => {
  const request = (url: string, method: string) => new Request(url, {
    method,
    headers: { Origin: "https://untrusted.invalid", "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal((await createRole(request("http://localhost/api/admin/v1/roles", "POST"))).status, 403);
  assert.equal((await editRole(request("http://localhost/api/admin/v1/roles/00000000-0000-4000-8000-000000000000", "PATCH"), {
    params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }),
  })).status, 403);
});

test("roles persist, enforce protections, and invalidate sessions in isolated PostgreSQL", {
  skip: process.env.RUN_ROLE_DB_TESTS !== "1",
}, async () => {
  const database = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(database.hostname, "127.0.0.1");
  assert.equal(database.port, "55432");
  assert.equal(database.pathname, "/webnex_roles_test");

  const suffix = randomUUID();
  const actor = await prisma.user.create({
    data: { email: `super-${suffix}@example.invalid`, name: "Test Super Admin" },
    select: { id: true },
  });
  const input = { name: `Test role ${suffix}`, permissions: ["dashboard:read", "content:read"] };
  const created = await saveCustomRole(actor.id, null, input);
  const role = await prisma.role.findUniqueOrThrow({
    where: { id: created.id },
    include: { permissions: { include: { permission: true } } },
  });
  assert.ok(role.key.startsWith("CUSTOM_"));
  assert.deepEqual(role.permissions.map(({ permission }) => permission.key).sort(), input.permissions.slice().sort());

  const user = await prisma.user.create({
    data: {
      email: `member-${suffix}@example.invalid`,
      roles: { create: { roleId: role.id } },
    },
    select: { id: true, email: true, sessionVersion: true },
  });
  await saveCustomRole(actor.id, role.id, {
    name: `Edited role ${suffix}`,
    permissions: ["dashboard:read", "team:view"],
  });
  const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { sessionVersion: true } });
  assert.equal(updated.sessionVersion, user.sessionVersion + 1);
  const updatedRole = await prisma.role.findUniqueOrThrow({
    where: { id: role.id },
    include: { permissions: { include: { permission: true } } },
  });
  assert.deepEqual(updatedRole.permissions.map(({ permission }) => permission.key).sort(), ["dashboard:read", "team:view"]);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "Role", entityId: role.id } }), 2);

  await assert.rejects(saveCustomRole(actor.id, null, {
    name: updatedRole.name.toUpperCase(), permissions: ["dashboard:read"],
  }), (error: unknown) => error instanceof RoleManagementError && error.code === "ROLE_NAME_EXISTS");
  await assert.rejects(saveCustomRole(actor.id, role.id, {
    name: updatedRole.name, permissions: ["dashboard:read", "not:a:permission"],
  }), (error: unknown) => error instanceof RoleManagementError && error.code === "INVALID_ROLE");
  await assert.rejects(saveCustomRole(actor.id, role.id, {
    name: updatedRole.name, permissions: ["dashboard:read", "users:manage"],
  }), (error: unknown) => error instanceof RoleManagementError && error.code === "INVALID_ROLE");
  const builtIn = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" }, select: { id: true } });
  await assert.rejects(saveCustomRole(actor.id, builtIn.id, input),
    (error: unknown) => error instanceof RoleManagementError && error.code === "PROTECTED_ROLE");

  await resetAdminPassword({ email: user.email, password: "A-long-test-password" });
  const reset = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { sessionVersion: true, passwordHash: true } });
  assert.equal(reset.sessionVersion, updated.sessionVersion + 1);
  assert.ok(reset.passwordHash);
});
