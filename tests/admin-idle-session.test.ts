import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_IDLE_TIMEOUT_MS, adminIdleDeadline } from "../src/lib/admin-session";
import { authOptions } from "../src/server/auth/options";
import { prisma } from "../src/server/db";

test("idle deadline rejects missing, future, and expired activity", () => {
  const now = 2_000_000;
  assert.equal(adminIdleDeadline(now - ADMIN_IDLE_TIMEOUT_MS + 1, now), now + 1);
  assert.equal(adminIdleDeadline(now - ADMIN_IDLE_TIMEOUT_MS, now), null);
  assert.equal(adminIdleDeadline(undefined, now), null);
  assert.equal(adminIdleDeadline(now + 1, now), null);
});

test("session checks do not renew inactivity but activity updates do", async (t) => {
  const now = 2_000_000;
  t.mock.method(Date, "now", () => now);
  const user = prisma.user;
  const descriptor = Object.getOwnPropertyDescriptor(user, "findUnique");
  Object.defineProperty(user, "findUnique", {
    configurable: true,
    value: async () => ({ isActive: true, sessionVersion: 1 }),
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(user, "findUnique", descriptor);
    else Reflect.deleteProperty(user, "findUnique");
  });
  const callback = authOptions.callbacks?.jwt;
  assert.ok(callback);
  const signedIn = await Reflect.apply(callback, undefined, [{
    token: { sub: "user" }, user: { id: "user", sessionVersion: 1 }, trigger: "signIn",
  }]);
  assert.equal(signedIn.lastActivity, now);
  const original = { sub: "user", sessionVersion: 1, lastActivity: now - 60_000 };
  const check = await Reflect.apply(callback, undefined, [{ token: { ...original } }]);
  assert.equal(check.lastActivity, original.lastActivity);
  const updated = await Reflect.apply(callback, undefined, [{ token: { ...original }, trigger: "update", session: { lastActivity: 0 } }]);
  assert.equal(updated.lastActivity, now);
  const expired = await Reflect.apply(callback, undefined, [{
    token: { ...original, lastActivity: now - ADMIN_IDLE_TIMEOUT_MS },
    trigger: "update",
  }]);
  assert.deepEqual(expired, {});
  const legacy = await Reflect.apply(callback, undefined, [{ token: { sub: "user", sessionVersion: 1 } }]);
  assert.deepEqual(legacy, {});
  Object.defineProperty(user, "findUnique", {
    configurable: true,
    value: async () => ({ isActive: false, sessionVersion: 1 }),
  });
  const inactive = await Reflect.apply(callback, undefined, [{ token: { ...original }, trigger: "update" }]);
  assert.deepEqual(inactive, {});
});
