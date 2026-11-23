import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { POST } from "../app/api/admin/v1/work-projects/route";
import { workProjectSchema } from "../src/lib/validation/work-project";
import { listWorkProjects, saveWorkProject } from "../src/server/content/work-projects";
import { prisma } from "../src/server/db";
import { env } from "../src/server/env";
import { dispatchWorkAssignmentEmails } from "../src/server/integrations/work-assignment-email";

test("work project validation rejects duplicate accounts and invalid statuses", () => {
  const member = randomUUID();
  const input = { title: "Website", description: "Private project", status: "NOT_STARTED", assigneeIds: [member] };
  assert.equal(workProjectSchema.safeParse(input).success, true);
  assert.equal(workProjectSchema.safeParse({ ...input, assigneeIds: [member, member] }).success, false);
  assert.equal(workProjectSchema.safeParse({ ...input, status: "PUBLISHED" }).success, false);
  assert.equal(workProjectSchema.safeParse({ ...input, description: " " }).success, false);
});

test("work project mutations reject cross-origin requests", async () => {
  const response = await POST(new Request("http://localhost/api/admin/v1/work-projects", {
    method: "POST",
    headers: { Origin: "https://untrusted.invalid", "Content-Type": "application/json" },
    body: "{}",
  }));
  assert.equal(response.status, 403);
});

test("non-manager project listing is limited to the signed-in assignee", async (t) => {
  const projects = prisma.workProject;
  const originalFindMany = projects.findMany;
  t.after(() => Object.defineProperty(projects, "findMany", { configurable: true, value: originalFindMany }));
  const userId = randomUUID();
  Object.defineProperty(projects, "findMany", {
    configurable: true,
    value: async (args: { where?: unknown; select: Record<string, unknown> }) => {
      assert.deepEqual(args.where, { assignments: { some: { userId } } });
      assert.equal("assignments" in args.select, true);
      assert.deepEqual(args.select.assignments, {
        where: { userId },
        select: { acceptedAt: true, declinedAt: true, createdAt: true },
      });
      return [];
    },
  });
  await listWorkProjects({ id: userId, email: "member@example.invalid", name: null, roles: [], permissions: new Set(["dashboard:read"]) });
});

test("assignment dispatcher sends to the assigned account and records provider acceptance", async (t) => {
  const notifications = prisma.workAssignmentNotification;
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const oldSettings = {
    apiKey: env.SENDGRID_API_KEY,
    from: env.SENDGRID_FROM_EMAIL,
    to: env.NOTIFICATION_TO_EMAIL,
  };
  const originalMethods = {
    findMany: notifications.findMany,
    findUnique: notifications.findUnique,
    updateMany: notifications.updateMany,
  };
  t.after(() => {
    for (const [method, value] of Object.entries(originalMethods)) {
      Object.defineProperty(notifications, method, { configurable: true, value });
    }
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = oldUrl;
    env.SENDGRID_API_KEY = oldSettings.apiKey;
    env.SENDGRID_FROM_EMAIL = oldSettings.from;
    env.NOTIFICATION_TO_EMAIL = oldSettings.to;
  });
  env.SENDGRID_API_KEY = "test-key";
  env.SENDGRID_FROM_EMAIL = "sender@example.invalid";
  env.NOTIFICATION_TO_EMAIL = "notifications@example.invalid";
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.invalid";
  const updates: Array<{ data: { status?: string; providerMessageId?: string | null } }> = [];
  Object.defineProperty(notifications, "updateMany", { configurable: true, value: async (args: (typeof updates)[number]) => { updates.push(args); return { count: 1 }; } });
  Object.defineProperty(notifications, "findMany", { configurable: true, value: async () => [{ id: "notification-id" }] });
  Object.defineProperty(notifications, "findUnique", { configurable: true, value: async () => ({
    id: "notification-id",
    attemptCount: 1,
    assignment: { user: { email: "member@example.invalid", isActive: true }, project: { title: "Work <Project>" } },
  }) });
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {
      personalizations: Array<{ to: Array<{ email: string }> }>;
      content: Array<{ value: string }>;
    };
    assert.equal(body.personalizations[0]?.to[0]?.email, "member@example.invalid");
    assert.ok(body.content.some(({ value }) => value.includes("Work &lt;Project&gt;")));
    return new Response(null, { status: 202, headers: { "x-message-id": "provider-id" } });
  };
  const counts = await dispatchWorkAssignmentEmails();
  assert.equal(counts.accepted, 1);
  assert.equal(updates.at(-1)?.data.status, "SENT");
  assert.equal(updates.at(-1)?.data.providerMessageId, "provider-id");

  globalThis.fetch = async () => new Response(null, { status: 503 });
  const retryCounts = await dispatchWorkAssignmentEmails();
  assert.equal(retryCounts.retried, 1);
  assert.equal(updates.at(-1)?.data.status, "PENDING");
});

test("work assignments, isolation and notifications persist in isolated PostgreSQL", {
  skip: process.env.RUN_WORK_PROJECT_DB_TESTS !== "1",
}, async () => {
  const database = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(database.hostname, "127.0.0.1");
  assert.equal(database.port, "55435");
  assert.equal(database.pathname, "/webnex_work_project_test");
  const suffix = randomUUID();
  const permission = await prisma.permission.upsert({
    where: { key: "dashboard:read" },
    create: { key: "dashboard:read", description: "Dashboard" },
    update: {},
  });
  const role = await prisma.role.create({
    data: {
      key: `WORK_TEST_${suffix}`,
      name: `Work test ${suffix}`,
      permissions: { create: { permissionId: permission.id } },
    },
  });
  const manager = await prisma.user.create({ data: { email: `manager-${suffix}@example.invalid` } });
  const member = await prisma.user.create({ data: { email: `member-${suffix}@example.invalid`, roles: { create: { roleId: role.id } } } });
  const other = await prisma.user.create({ data: { email: `other-${suffix}@example.invalid`, roles: { create: { roleId: role.id } } } });
  let projectId: string | null = null;
  try {
    const input = { title: "Private work", description: "Details", status: "NOT_STARTED" as const, assigneeIds: [member.id] };
    const created = await saveWorkProject(null, input, manager.id);
    assert.ok("id" in created && created.id);
    const savedId = created.id;
    projectId = savedId;
    assert.equal(created.queued, 1);
    assert.equal(await prisma.workAssignmentNotification.count({ where: { assignment: { projectId: savedId } } }), 1);
    const unchanged = await saveWorkProject(savedId, input, manager.id);
    assert.ok("id" in unchanged);
    assert.equal(unchanged.queued, 0);
    assert.equal(await prisma.workAssignmentNotification.count({ where: { assignment: { projectId: savedId } } }), 1);
    const context = (id: string) => ({ id, email: "test@example.invalid", name: null, roles: [], permissions: new Set(["dashboard:read"]) });
    assert.equal((await listWorkProjects(context(member.id))).some((project) => project.id === projectId), true);
    assert.equal((await listWorkProjects(context(other.id))).some((project) => project.id === projectId), false);
    const updated = await saveWorkProject(projectId, { ...input, assigneeIds: [other.id] }, manager.id);
    assert.ok("id" in updated);
    assert.equal(updated.queued, 1);
    assert.equal((await listWorkProjects(context(member.id))).some((project) => project.id === projectId), false);
    assert.equal((await listWorkProjects(context(other.id))).some((project) => project.id === projectId), true);
    assert.equal(await prisma.workAssignmentNotification.count({ where: { assignment: { projectId: savedId } } }), 1);
    assert.deepEqual(await saveWorkProject(projectId, { ...input, assigneeIds: [randomUUID()] }, manager.id), { error: "INVALID_ASSIGNEES" });
    assert.equal(await prisma.auditLog.count({ where: { entityType: "WorkProject", entityId: projectId } }), 3);
  } finally {
    if (projectId) {
      await prisma.auditLog.deleteMany({ where: { entityType: "WorkProject", entityId: projectId } });
      await prisma.workProject.delete({ where: { id: projectId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [manager.id, member.id, other.id] } } });
    await prisma.role.delete({ where: { id: role.id } });
  }
});
