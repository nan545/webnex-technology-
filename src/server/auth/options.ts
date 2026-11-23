import type { NextAuthOptions, User } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { adminIdleDeadline, ADMIN_IDLE_TIMEOUT_MS } from "@/lib/admin-session";
import { prisma, runInTransaction } from "@/server/db";
import { runAsDatabaseActor } from "@/server/db-context";
import { consumeLoginRateLimit } from "@/server/security/auth-rate-limit";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

const dummyPasswordHash =
  "$2b$12$ChV6hUBl96QGdkqoQF.KluZpRIjLh/SsyGvkuG4Th6wsYOzgaVtHa";
const maxFailedAttempts = 5;
const lockoutMilliseconds = 15 * 60 * 1000;

function requestAddress(headers: Record<string, string | string[] | undefined>) {
  const realIp = headers["x-real-ip"];
  return (Array.isArray(realIp) ? realIp[0] : realIp)?.trim() || "unknown";
}

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 15 * 60 },
  pages: { signIn: "/admin/login", error: "/admin/login" },
  providers: [
    CredentialsProvider({
      name: "Administrator credentials",
      credentials: {
        email: { label: "Email address", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (rawCredentials, request) =>
        runAsDatabaseActor({ kind: "auth" }, () => authorizeCredentials(rawCredentials, request)),
    }),
  ],
  callbacks: {
    jwt: ({ token, user, trigger }) =>
      runAsDatabaseActor({ kind: "auth" }, () => refreshToken(token, user, trigger)),
    async session({ session, token }) {
      if (session.user && token.sub && typeof token.lastActivity === "number") {
        session.user.id = token.sub;
        session.idleExpires = token.lastActivity + ADMIN_IDLE_TIMEOUT_MS;
      }
      return session;
    },
  },
  events: {
    signOut: ({ token }) =>
      runAsDatabaseActor({ kind: "auth" }, () => recordSignOut(token)),
  },
  useSecureCookies: process.env.NODE_ENV === "production",
};

async function authorizeCredentials(
  rawCredentials: Record<string, string> | undefined,
  request: { headers?: Record<string, string | string[] | undefined> },
) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const rateLimit = await consumeLoginRateLimit(
          email,
          requestAddress(request.headers ?? {}),
        );
        if (!rateLimit.allowed) return null;

        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            isActive: true,
            sessionVersion: true,
            failedLoginAttempts: true,
            lockedUntil: true,
          },
        });

        const passwordMatches = await compare(
          password,
          user?.passwordHash ?? dummyPasswordHash,
        );
        const now = new Date();
        const accountAvailable =
          user?.isActive === true &&
          (!user.lockedUntil || user.lockedUntil <= now);

        if (!user || !accountAvailable || !passwordMatches) {
          if (user) {
            await runInTransaction(async (transaction) => {
              if (user.isActive && (!user.lockedUntil || user.lockedUntil <= now)) {
                if (user.lockedUntil && user.lockedUntil <= now) {
                  await transaction.user.update({
                    where: { id: user.id },
                    data: { failedLoginAttempts: 0, lockedUntil: null },
                  });
                }
                const updated = await transaction.user.update({
                  where: { id: user.id },
                  data: { failedLoginAttempts: { increment: 1 } },
                  select: { failedLoginAttempts: true },
                });
                if (updated.failedLoginAttempts >= maxFailedAttempts) {
                  await transaction.user.updateMany({
                    where: {
                      id: user.id,
                      failedLoginAttempts: { gte: maxFailedAttempts },
                      lockedUntil: null,
                    },
                    data: {
                      lockedUntil: new Date(now.getTime() + lockoutMilliseconds),
                    },
                  });
                }
              }
              await transaction.auditLog.create({
                data: {
                  actorId: user.id,
                  action: "AUTH_LOGIN_FAILED",
                  entityType: "User",
                  entityId: user.id,
                  details: { reason: "invalid_credentials" },
                },
              });
            });
          } else {
            await prisma.auditLog.create({
              data: {
                action: "AUTH_LOGIN_FAILED",
                entityType: "Authentication",
                details: { reason: "invalid_credentials" },
              },
            });
          }
          return null;
        }

        const updated = await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: now,
          },
          select: { sessionVersion: true },
        });
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: "AUTH_LOGIN_SUCCEEDED",
            entityType: "User",
            entityId: user.id,
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          sessionVersion: updated.sessionVersion,
        };
}

async function refreshToken(token: JWT, user: User | AdapterUser | undefined, trigger: "signIn" | "signUp" | "update" | undefined) {
  const now = Date.now();
  if (user) {
    token.sessionVersion = user.sessionVersion;
    token.lastActivity = now;
  }

  if (
    !token.sub ||
    typeof token.sessionVersion !== "number" ||
    adminIdleDeadline(token.lastActivity, now) === null
  ) {
    return {};
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: token.sub },
    select: { isActive: true, sessionVersion: true },
  });

  if (
    !currentUser?.isActive ||
    currentUser.sessionVersion !== token.sessionVersion
  ) {
    return {};
  }

  if (trigger === "update") token.lastActivity = now;
  return token;
}

async function recordSignOut(token: JWT | undefined) {
  if (!token?.sub) return;
  await prisma.auditLog.create({
    data: {
      actorId: token.sub,
      action: "AUTH_LOGOUT",
      entityType: "User",
      entityId: token.sub,
    },
  });
}
