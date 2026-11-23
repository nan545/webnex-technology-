import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { POST } from "../app/api/admin/v1/work-projects/route";
import { contactPhoneSchema } from "../src/lib/validation/contact-phone";
import { workProjectSchema } from "../src/lib/validation/work-project";
import { listWorkProjects, saveWorkProject } from "../src/server/content/work-projects";
import { prisma } from "../src/server/db";
import { dispatchWorkAssignmentNotifications } from "../src/server/integrations/work-assignment-notifications";
import { DeliveryError } from "../src/server/integrations/delivery-error";
import { createTwilioAssignmentSender, normalizeAssignmentPhone } from "../src/server/integrations/twilio-assignment-alerts";
import { verifyNotificationWorkflowToken } from "../src/server/integrations/github-notification-trigger";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { POST as dispatchPOST } from "../app/api/internal/work-assignment-notifications/route";

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
      return [];
    },
  });
  await listWorkProjects({ id: userId, email: "member@example.invalid", name: null, roles: [], permissions: new Set(["dashboard:read"]) });
});

test("assignment phone numbers normalize to E.164 for SMS and WhatsApp", () => {
  assert.equal(normalizeAssignmentPhone("024 123 4567"), "+233241234567");
  assert.equal(normalizeAssignmentPhone("+1 (415) 555-2671"), "+14155552671");
  assert.equal(normalizeAssignmentPhone("14155552671"), null);
  assert.equal(normalizeAssignmentPhone("not a phone"), null);
  assert.deepEqual(contactPhoneSchema.safeParse("024 123 4567"), {
    success: true,
    data: "+233241234567",
  });
  assert.equal(contactPhoneSchema.safeParse("not a phone").success, false);
  assert.deepEqual(contactPhoneSchema.safeParse(""), { success: true, data: null });
});

test("assignment dispatcher sends both channels and retries only a failed channel", async (t) => {
  const notifications = prisma.workAssignmentNotification;
  const oldFetch = globalThis.fetch;
  const oldError = console.error;
  const envKeys = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_SMS_FROM",
    "TWILIO_WHATSAPP_FROM",
    "TWILIO_WHATSAPP_CONTENT_SID",
    "NEXT_PUBLIC_SITE_URL",
  ] as const;
  const oldEnv = envKeys.map((key) => process.env[key]);
  const originalMethods = {
    findMany: notifications.findMany,
    findUnique: notifications.findUnique,
    updateMany: notifications.updateMany,
  };
  const states = { sms: "PENDING", whatsapp: "PENDING" };
  const attempts = { sms: 0, whatsapp: 0 };
  const nextAt = { sms: new Date(0), whatsapp: new Date(0) };
  const requests: Array<{ url: string; fields: URLSearchParams; authorization: string | null }> = [];
  let fetchCount = 0;
  t.after(() => {
    for (const [method, value] of Object.entries(originalMethods)) {
      Object.defineProperty(notifications, method, { configurable: true, value });
    }
    globalThis.fetch = oldFetch;
    console.error = oldError;
    envKeys.forEach((key, index) => {
      if (oldEnv[index] === undefined) delete process.env[key];
      else process.env[key] = oldEnv[index];
    });
  });
  process.env.TWILIO_ACCOUNT_SID = `AC${"a".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "private-test-token";
  process.env.TWILIO_SMS_FROM = "+14155552671";
  process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155552671";
  process.env.TWILIO_WHATSAPP_CONTENT_SID = `HX${"b".repeat(32)}`;
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.invalid";
  console.error = () => undefined;
  Object.defineProperty(notifications, "findMany", {
    configurable: true,
    value: async () => (states.sms === "PENDING" || states.whatsapp === "PENDING")
      ? [{ id: "notification-id", smsAttemptCount: attempts.sms, whatsappAttemptCount: attempts.whatsapp }]
      : [],
  });
  Object.defineProperty(notifications, "findUnique", {
    configurable: true,
    value: async (args: { select: Record<string, unknown> }) => {
      if ("assignment" in args.select) {
        return {
          id: "notification-id",
          smsStatus: states.sms,
          smsNextAttemptAt: nextAt.sms,
          whatsappStatus: states.whatsapp,
          whatsappNextAttemptAt: nextAt.whatsapp,
          assignment: {
            user: {
              phone: "024 123 4567",
              isActive: true,
              smsAlertsEnabled: true,
              whatsappAlertsEnabled: true,
            },
            project: { title: "Work <Project>" },
          },
        };
      }
      return {
        smsStatus: states.sms,
        smsLastError: states.sms === "FAILED" ? "sms failed" : null,
        whatsappStatus: states.whatsapp,
        whatsappLastError: states.whatsapp === "FAILED" ? "whatsapp failed" : null,
      };
    },
  });
  Object.defineProperty(notifications, "updateMany", {
    configurable: true,
    value: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const { where, data } = args;
      if (where.smsStatus === "PENDING" && states.sms !== "PENDING") return { count: 0 };
      if (where.whatsappStatus === "PENDING" && states.whatsapp !== "PENDING") return { count: 0 };
      if (where.smsStatus === "PROCESSING" && states.sms !== "PROCESSING") return { count: 0 };
      if (where.whatsappStatus === "PROCESSING" && states.whatsapp !== "PROCESSING") return { count: 0 };
      if (typeof data.smsStatus === "string") states.sms = data.smsStatus;
      if (typeof data.whatsappStatus === "string") states.whatsapp = data.whatsappStatus;
      if ("smsAttemptCount" in data) attempts.sms += 1;
      if ("whatsappAttemptCount" in data) attempts.whatsapp += 1;
      if (data.smsNextAttemptAt instanceof Date) nextAt.sms = data.smsNextAttemptAt;
      if (data.whatsappNextAttemptAt instanceof Date) nextAt.whatsapp = data.whatsappNextAttemptAt;
      return { count: 1 };
    },
  });
  globalThis.fetch = async (url, init) => {
    const fields = new URLSearchParams(String(init?.body));
    requests.push({
      url: String(url),
      fields,
      authorization: new Headers(init?.headers).get("authorization"),
    });
    fetchCount += 1;
    if (fetchCount === 1) return Response.json({ sid: `SM${"c".repeat(32)}` }, { status: 201 });
    if (fetchCount === 2) return Response.json({ code: 30001 }, { status: 503 });
    return Response.json({ sid: `SM${"d".repeat(32)}` }, { status: 201 });
  };
  const counts = await dispatchWorkAssignmentNotifications();
  assert.deepEqual(counts, { accepted: 1, retried: 1, failed: 0, skipped: 0 });
  assert.equal(states.sms, "SENT");
  assert.equal(states.whatsapp, "PENDING");
  assert.equal(requests[0]?.fields.get("To"), "+233241234567");
  assert.match(requests[0]?.fields.get("Body") ?? "", /Work <Project>/);
  assert.equal(requests[1]?.fields.get("To"), "whatsapp:+233241234567");
  assert.equal(requests[1]?.fields.get("ContentSid"), process.env.TWILIO_WHATSAPP_CONTENT_SID);
  assert.equal(requests[1]?.fields.get("ContentVariables"), JSON.stringify({
    1: "Work <Project>",
    2: "https://example.invalid/admin/work-projects",
  }));
  assert.match(requests[0]?.authorization ?? "", /^Basic /);

  nextAt.whatsapp = new Date(0);
  const retryCounts = await dispatchWorkAssignmentNotifications();
  assert.deepEqual(retryCounts, { accepted: 1, retried: 0, failed: 0, skipped: 0 });
  assert.equal(states.sms, "SENT");
  assert.equal(states.whatsapp, "SENT");
  assert.equal(requests.length, 3);
});

test("Twilio rejects permanent errors without marking acceptance", async (t) => {
  const oldFetch = globalThis.fetch;
  const keys = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM", "TWILIO_WHATSAPP_FROM", "TWILIO_WHATSAPP_CONTENT_SID", "NEXT_PUBLIC_SITE_URL"] as const;
  const oldEnv = keys.map((key) => process.env[key]);
  t.after(() => {
    globalThis.fetch = oldFetch;
    keys.forEach((key, index) => {
      if (oldEnv[index] === undefined) delete process.env[key];
      else process.env[key] = oldEnv[index];
    });
  });
  process.env.TWILIO_ACCOUNT_SID = `AC${"a".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "private-test-token";
  process.env.TWILIO_SMS_FROM = "+14155552671";
  process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155552671";
  process.env.TWILIO_WHATSAPP_CONTENT_SID = `HX${"b".repeat(32)}`;
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.invalid";
  globalThis.fetch = async () => Response.json({ code: 20003 }, { status: 401 });
  const sender = await createTwilioAssignmentSender();
  await assert.rejects(
    () => sender.sendSms("+14155552671", "Project"),
    (error: unknown) => error instanceof DeliveryError && !error.transient,
  );
});

test("notification trigger accepts only the configured signed GitHub workflow", async (t) => {
  const oldId = process.env.NOTIFICATION_DISPATCH_GITHUB_REPOSITORY_ID;
  const oldRef = process.env.NOTIFICATION_DISPATCH_GITHUB_WORKFLOW_REF;
  t.after(() => {
    if (oldId === undefined) delete process.env.NOTIFICATION_DISPATCH_GITHUB_REPOSITORY_ID;
    else process.env.NOTIFICATION_DISPATCH_GITHUB_REPOSITORY_ID = oldId;
    if (oldRef === undefined) delete process.env.NOTIFICATION_DISPATCH_GITHUB_WORKFLOW_REF;
    else process.env.NOTIFICATION_DISPATCH_GITHUB_WORKFLOW_REF = oldRef;
  });
  process.env.NOTIFICATION_DISPATCH_GITHUB_REPOSITORY_ID = "123";
  process.env.NOTIFICATION_DISPATCH_GITHUB_WORKFLOW_REF = "owner/repo/.github/workflows/assignment-notifications.yml@refs/heads/main";
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256" };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const makeToken = (claims: Record<string, string>) => new SignJWT({
    repository_id: "123",
    workflow_ref: process.env.NOTIFICATION_DISPATCH_GITHUB_WORKFLOW_REF,
    ref: "refs/heads/main",
    event_name: "schedule",
    ...claims,
  }).setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://token.actions.githubusercontent.com")
    .setAudience("webnex-work-assignment-notifications")
    .setSubject("test")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  assert.equal(await verifyNotificationWorkflowToken(await makeToken({}), keys), true);
  assert.equal(await verifyNotificationWorkflowToken(await makeToken({ repository_id: "456" }), keys), false);
  assert.equal(await verifyNotificationWorkflowToken(await makeToken({ workflow_ref: "owner/repo/.github/workflows/other.yml@refs/heads/main" }), keys), false);
  assert.equal(await verifyNotificationWorkflowToken(await makeToken({ ref: "refs/heads/other" }), keys), false);
  assert.equal(await verifyNotificationWorkflowToken(await makeToken({ event_name: "pull_request" }), keys), false);
  await assert.rejects(() => verifyNotificationWorkflowToken("invalid-token", keys));
});

test("disabled or unauthenticated notification triggers do not dispatch", async (t) => {
  const keys = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_SMS_FROM",
    "TWILIO_WHATSAPP_FROM",
    "TWILIO_WHATSAPP_CONTENT_SID",
    "NOTIFICATION_DISPATCH_GITHUB_REPOSITORY_ID",
    "NOTIFICATION_DISPATCH_GITHUB_WORKFLOW_REF",
  ] as const;
  const old = keys.map((key) => process.env[key]);
  t.after(() => keys.forEach((key, index) => {
    if (old[index] === undefined) delete process.env[key];
    else process.env[key] = old[index];
  }));
  keys.forEach((key) => delete process.env[key]);
  assert.equal((await dispatchPOST(new Request("https://example.com", { method: "POST" }))).status, 503);
  process.env.TWILIO_ACCOUNT_SID = `AC${"a".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "test-token";
  process.env.TWILIO_SMS_FROM = "+14155552671";
  process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155552671";
  process.env.TWILIO_WHATSAPP_CONTENT_SID = `HX${"b".repeat(32)}`;
  process.env.NOTIFICATION_DISPATCH_GITHUB_REPOSITORY_ID = "123";
  process.env.NOTIFICATION_DISPATCH_GITHUB_WORKFLOW_REF = "workflow";
  assert.equal((await dispatchPOST(new Request("https://example.com", { method: "POST" }))).status, 401);
  assert.equal((await dispatchPOST(new Request("https://example.com", {
    method: "POST", headers: { authorization: "Bearer invalid" },
  }))).status, 401);
});

test("missing Twilio settings fail before reading the notification queue", async (t) => {
  const old = process.env.TWILIO_ACCOUNT_SID;
  const notifications = prisma.workAssignmentNotification;
  const originalFindMany = notifications.findMany;
  let queried = false;
  t.after(() => {
    if (old === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = old;
    Object.defineProperty(notifications, "findMany", { configurable: true, value: originalFindMany });
  });
  delete process.env.TWILIO_ACCOUNT_SID;
  Object.defineProperty(notifications, "findMany", {
    configurable: true,
    value: async () => { queried = true; return []; },
  });
  await assert.rejects(() => dispatchWorkAssignmentNotifications(), /Twilio SMS and WhatsApp assignment alert settings/);
  assert.equal(queried, false);
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
    const queuedNotification = await prisma.workAssignmentNotification.findFirst({
      where: { assignment: { projectId: savedId } },
      select: { smsStatus: true, whatsappStatus: true },
    });
    assert.deepEqual(queuedNotification, { smsStatus: "PENDING", whatsappStatus: "PENDING" });
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
