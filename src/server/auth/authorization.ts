import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/options";
import { prisma } from "@/server/db";
import { openRequestActorScope, runAsDatabaseActor } from "@/server/db-context";

export type AdminContext = {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  permissions: Set<string>;
};

// Verifying the session is the only place an administrator identity is
// established, so it also binds that identity to the request's database
// queries. The scope must be opened before the first await.
export async function getAdminContext(): Promise<AdminContext | null> {
  const scope = openRequestActorScope();
  const admin = await runAsDatabaseActor({ kind: "auth" }, loadAdminContext);
  if (admin) scope.promoteToAdmin(admin.id, admin.permissions);
  return admin;
}

async function loadAdminContext(): Promise<AdminContext | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      roles: {
        select: {
          role: {
            select: {
              key: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles.map(({ role }) => role.key),
    permissions: new Set(
      user.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.key),
      ),
    ),
  };
}

export async function writeAuditLog(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, string | number | boolean | null>;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details,
    },
  });
}
