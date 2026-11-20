import "server-only";
import type { WorkProjectInput } from "@/lib/validation/work-project";
import type { AdminContext } from "@/server/auth/authorization";
import { prisma } from "@/server/db";

export async function listWorkProjects(admin: AdminContext) {
  const canManage = admin.permissions.has("projects:manage");
  const select = { id: true, title: true, description: true, status: true } as const;
  if (!canManage) {
    return prisma.workProject.findMany({
      where: { assignments: { some: { userId: admin.id } } },
      orderBy: { updatedAt: "desc" },
      select,
    });
  }
  const projects = await prisma.workProject.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      ...select,
      assignments: {
        select: {
          userId: true,
          user: {
            select: {
              name: true,
              email: true,
              isActive: true,
              phone: true,
              smsAlertsEnabled: true,
              whatsappAlertsEnabled: true,
            },
          },
          notification: {
            select: {
              status: true,
              smsStatus: true,
              smsLastError: true,
              whatsappStatus: true,
              whatsappLastError: true,
            },
          },
        },
      },
    },
  });
  return projects.map(({ assignments, ...project }) => ({
    ...project,
    assignments: assignments.map(({ user, ...assignment }) => ({
      ...assignment,
      user: {
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        hasPhone: Boolean(user.phone),
        smsAlertsEnabled: user.smsAlertsEnabled,
        whatsappAlertsEnabled: user.whatsappAlertsEnabled,
      },
    })),
  }));
}

export async function saveWorkProject(id: string | null, input: WorkProjectInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    if (id) {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "WorkProject" WHERE id = ${id}::uuid FOR UPDATE`;
      if (!locked.length) return { error: "NOT_FOUND" } as const;
    }

    const activeUsers = await tx.user.findMany({
      where: {
        id: { in: input.assigneeIds },
        isActive: true,
        roles: { some: { role: { permissions: { some: { permission: { key: "dashboard:read" } } } } } },
      },
      select: { id: true },
    });
    if (activeUsers.length !== input.assigneeIds.length) return { error: "INVALID_ASSIGNEES" } as const;

    const project = id
      ? await tx.workProject.update({ where: { id }, data: { title: input.title, description: input.description, status: input.status } })
      : await tx.workProject.create({ data: { title: input.title, description: input.description, status: input.status, createdById: actorId } });
    const existing = await tx.workProjectAssignment.findMany({
      where: { projectId: project.id },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((assignment) => assignment.userId));
    await tx.workProjectAssignment.deleteMany({
      where: { projectId: project.id, userId: { notIn: input.assigneeIds } },
    });
    for (const userId of input.assigneeIds) {
      if (!existingIds.has(userId)) {
        await tx.workProjectAssignment.create({
          data: { projectId: project.id, userId, notification: { create: {} } },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        actorId,
        action: id ? "WORK_PROJECT_UPDATED" : "WORK_PROJECT_CREATED",
        entityType: "WorkProject",
        entityId: project.id,
        details: { status: input.status, assigneeCount: input.assigneeIds.length },
      },
    });
    return { id: project.id, queued: input.assigneeIds.filter((userId) => !existingIds.has(userId)).length } as const;
  });
}
