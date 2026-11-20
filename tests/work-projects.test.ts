import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { POST } from "../app/api/admin/v1/work-projects/route";
import { workProjectSchema } from "../src/lib/validation/work-project";
import { listWorkProjects, saveWorkProject } from "../src/server/content/work-projects";
import { prisma } from "../src/server/db";
import { env } from "../src/server/env";
import { dispatchWorkAssignmentEmails } from "../src/server/integrations/work-assignment-email";
import { sendGmailAssignment } from "../src/server/integrations/gmail";
import { EmailDeliveryError } from "../src/server/integrations/email-delivery-error";
import { verifyEmailWorkflowToken } from "../src/server/integrations/github-email-trigger";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { POST as dispatchPOST } from "../app/api/internal/work-assignment-email/route";

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
      assert.equal("assignments" in args.select, false);
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

test("Gmail assignment messages address the member and encode project text safely", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    const body = JSON.parse(String(init?.body)) as { raw: string };
    const message = Buffer.from(body.raw, "base64url").toString("utf8");
    assert.match(message, /To: member@example\.com\r\n/);
    const content = message.split("\r\n\r\n")[1];
    assert.ok(content);
    const text = Buffer.from(content.replaceAll("\r\n", ""), "base64").toString("utf8");
    assert.match(text, /Café project/);
    assert.match(text, /https:\/\/example\.com\/admin\/work-projects/);
    return Response.json({ id: "gmail-message-id" });
  };
  assert.equal(await sendGmailAssignment({
    token: "test-token", from: "sender@example.com", to: "member@example.com",
    title: "Café project", siteUrl: new URL("https://example.com"),
  }), "gmail-message-id");
  await assert.rejects(() => sendGmailAssignment({
    token: "test-token", from: "sender@example.com", to: "bad@example.com\r\nBcc: other@example.com",
    title: "Project", siteUrl: new URL("https://example.com"),
  }), EmailDeliveryError);
  globalThis.fetch = async () => new Response(null, { status: 429 });
  await assert.rejects(() => sendGmailAssignment({
    token: "test-token", from: "sender@example.com", to: "member@example.com",
    title: "Project", siteUrl: new URL("https://example.com"),
  }), (error: unknown) => error instanceof EmailDeliveryError && error.transient);
});

test("email trigger accepts only the configured signed GitHub workflow", async (t) => {
  const oldId = process.env.EMAIL_DISPATCH_GITHUB_REPOSITORY_ID;
  const oldRef = process.env.EMAIL_DISPATCH_GITHUB_WORKFLOW_REF;
  t.after(() => {
    if (oldId === undefined) delete process.env.EMAIL_DISPATCH_GITHUB_REPOSITORY_ID;
    else process.env.EMAIL_DISPATCH_GITHUB_REPOSITORY_ID = oldId;
    if (oldRef === undefined) delete process.env.EMAIL_DISPATCH_GITHUB_WORKFLOW_REF;
    else process.env.EMAIL_DISPATCH_GITHUB_WORKFLOW_REF = oldRef;
  });
  process.env.EMAIL_DISPATCH_GITHUB_REPOSITORY_ID = "123";
  process.env.EMAIL_DISPATCH_GITHUB_WORKFLOW_REF = "owner/repo/.github/workflows/assignment-email.yml@refs/heads/main";
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256" };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const makeToken = (claims: Record<string, string>) => new SignJWT({
    repository_id: "123",
    workflow_ref: process.env.EMAIL_DISPATCH_GITHUB_WORKFLOW_REF,
    ref: "refs/heads/main",
    event_name: "schedule",
    ...claims,
  }).setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://token.actions.githubusercontent.com")
    .setAudience("webnex-work-assignment-email")
    .setSubject("test")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  assert.equal(await verifyEmailWorkflowToken(await makeToken({}), keys), true);
  assert.equal(await verifyEmailWorkflowToken(await makeToken({ repository_id: "456" }), keys), false);
  assert.equal(await verifyEmailWorkflowToken(await makeToken({ workflow_ref: "owner/repo/.github/workflows/other.yml@refs/heads/main" }), keys), false);
  assert.equal(await verifyEmailWorkflowToken(await makeToken({ ref: "refs/heads/other" }), keys), false);
  assert.equal(await verifyEmailWorkflowToken(await makeToken({ event_name: "pull_request" }), keys), false);
  await assert.rejects(() => verifyEmailWorkflowToken("invalid-token", keys));
});

test("disabled or unauthenticated email triggers do not dispatch", async (t) => {
  const keys = ["WORK_ASSIGNMENT_EMAIL_PROVIDER", "EMAIL_DISPATCH_GITHUB_REPOSITORY_ID", "EMAIL_DISPATCH_GITHUB_WORKFLOW_REF"] as const;
  const old = keys.map((key) => process.env[key]);
  t.after(() => keys.forEach((key, index) => {
    if (old[index] === undefined) delete process.env[key];
    else process.env[key] = old[index];
  }));
  delete process.env.WORK_ASSIGNMENT_EMAIL_PROVIDER;
  assert.equal((await dispatchPOST(new Request("https://example.com", { method: "POST" }))).status, 503);
  process.env.WORK_ASSIGNMENT_EMAIL_PROVIDER = "gmail";
  process.env.EMAIL_DISPATCH_GITHUB_REPOSITORY_ID = "123";
  process.env.EMAIL_DISPATCH_GITHUB_WORKFLOW_REF = "workflow";
  assert.equal((await dispatchPOST(new Request("https://example.com", { method: "POST" }))).status, 401);
  assert.equal((await dispatchPOST(new Request("https://example.com", {
    method: "POST", headers: { authorization: "Bearer invalid" },
  }))).status, 401);
});

test("missing Gmail configuration leaves the assignment queue untouched", async (t) => {
  const provider = process.env.WORK_ASSIGNMENT_EMAIL_PROVIDER;
  const clientId = process.env.GMAIL_CLIENT_ID;
  t.after(() => {
    if (provider === undefined) delete process.env.WORK_ASSIGNMENT_EMAIL_PROVIDER;
    else process.env.WORK_ASSIGNMENT_EMAIL_PROVIDER = provider;
    if (clientId === undefined) delete process.env.GMAIL_CLIENT_ID;
    else process.env.GMAIL_CLIENT_ID = clientId;
  });
  process.env.WORK_ASSIGNMENT_EMAIL_PROVIDER = "gmail";
  delete process.env.GMAIL_CLIENT_ID;
  await assert.rejects(() => dispatchWorkAssignmentEmails(), /Gmail assignment email settings/);
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
