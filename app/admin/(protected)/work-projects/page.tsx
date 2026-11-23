import { WorkProjectManagement } from "@/components/admin/work-project-management";
import { requireAdminPage } from "@/server/auth/admin-page";
import { listWorkProjects } from "@/server/content/work-projects";
import { prisma } from "@/server/db";

export const metadata = { title: "Work projects" };

export default async function WorkProjectsPage() {
  const admin = await requireAdminPage("dashboard:read");
  const canManage = admin.permissions.has("projects:manage");
  const [projects, users] = await Promise.all([
    listWorkProjects(admin),
    canManage
      ? prisma.user.findMany({
        where: {
          isActive: true,
          roles: { some: { role: { permissions: { some: { permission: { key: "dashboard:read" } } } } } },
        },
        select: { id: true, name: true, email: true },
        orderBy: { email: "asc" },
      })
      : Promise.resolve([]),
  ]);
  return <WorkProjectManagement projects={projects} users={users} canManage={canManage} />;
}
