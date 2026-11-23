import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../src/server/env";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

const permissions = [
  ["dashboard:read", "View the administrative dashboard"],
  ["content:read", "Read CMS content"],
  ["content:write", "Create and edit CMS content"],
  ["content:review", "Review submitted CMS content"],
  ["content:approve", "Approve CMS content for publication"],
  ["content:publish", "Publish and archive CMS content"],
  ["content:restore", "Restore previous content revisions"],
  ["services:manage", "Manage services"],
  ["projects:manage", "Manage projects"],
  ["case-studies:manage", "Manage case studies"],
  ["industries:manage", "Manage industries"],
  ["blog:manage", "Manage blog posts, categories, and tags"],
  ["testimonials:manage", "Manage testimonials"],
  ["team:manage", "Manage team profiles"],
  ["team:view", "View team profiles in administration"],
  ["team:create", "Create team profiles"],
  ["team:update", "Edit team profiles"],
  ["team:publish", "Publish and unpublish team profiles"],
  ["team:delete", "Delete team profiles"],
  ["team:manage_media", "Upload and manage team profile photographs"],
  ["enquiries:read", "Read project enquiries"],
  ["enquiries:update", "Assign and update project enquiries"],
  ["proposals:manage", "Create and manage sales proposals"],
  ["media:manage", "Upload and manage media"],
  ["users:manage", "Manage administrator accounts"],
  ["roles:manage", "Assign approved administrator roles"],
  ["audit:read", "Read administrative audit history"],
  ["settings:manage", "Manage site settings"],
] as const;

const rolePermissions: Record<string, readonly string[]> = {
  SUPER_ADMIN: permissions.map(([key]) => key),
  ADMIN: [
    "dashboard:read",
    "content:read",
    "content:write",
    "content:review",
    "content:approve",
    "content:publish",
    "content:restore",
    "services:manage",
    "projects:manage",
    "case-studies:manage",
    "industries:manage",
    "blog:manage",
    "testimonials:manage",
    "team:manage",
    "team:view",
    "team:create",
    "team:update",
    "team:publish",
    "team:delete",
    "team:manage_media",
    "enquiries:read",
    "enquiries:update",
    "proposals:manage",
    "media:manage",
  ],
  EDITOR: [
    "dashboard:read",
    "content:read",
    "content:write",
    "blog:manage",
    "media:manage",
    "team:view",
    "team:create",
    "team:update",
  ],
  SALES: ["dashboard:read", "enquiries:read", "enquiries:update", "proposals:manage"],
};

async function main() {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.actor', 'system', true)`;
    await seedRoles(transaction);
  }, { timeout: 30_000 });
  console.log("Development roles and permissions are ready.");
}

async function seedRoles(prisma: Prisma.TransactionClient) {
  const roleDefinitions = [
    ["SUPER_ADMIN", "Super Admin"],
    ["ADMIN", "Administrator"],
    ["EDITOR", "Content editor"],
    ["SALES", "Enquiry manager"],
  ] as const;

  for (const [key, name] of roleDefinitions) {
    await prisma.role.upsert({
      where: { key },
      create: { key, name },
      update: { name },
    });
  }

  for (const [key, description] of permissions) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description },
      update: { description },
    });
  }

  for (const [roleKey, permissionKeys] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: roleKey },
    });

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permission: { key: { notIn: [...permissionKeys] } },
      },
    });

    for (const permissionKey of permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key: permissionKey },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }

}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
