import { UserManagement } from "@/components/admin/user-management";
import { prisma } from "@/server/db";
import { requireAdminPage } from "@/server/auth/admin-page";
import { Prisma } from "@/generated/prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Users and roles" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const admin = await requireAdminPage("users:manage");
  if (!admin.roles.includes("SUPER_ADMIN")) redirect("/admin/unauthorized");
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? "";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 2_000)
    : 1;
  const pageSize = 50;
  const where: Prisma.UserWhereInput = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};
  const [users, totalItems, roles] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        smsAlertsEnabled: true,
        whatsappAlertsEnabled: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { select: { role: { select: { key: true } } } },
      },
    }),
    prisma.user.count({ where }),
    prisma.role.findMany({
      select: { key: true, name: true },
    }),
  ]);
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-semibold text-blue-700">Access control</p>
        <h1 className="mt-1 text-2xl font-semibold">Users and roles</h1>
        <p className="mt-2 text-sm text-muted">
          Changes are audited and sessions are invalidated when an account or role changes.
        </p>
      </div>
      <form className="flex flex-col gap-3 border border-border bg-white p-4 sm:flex-row" method="get">
        <label className="sr-only" htmlFor="admin-user-search">Search administrators</label>
        <input className="field-control flex-1" defaultValue={query} id="admin-user-search" maxLength={100} name="q" placeholder="Search name or email" type="search" />
        <button className="button-primary" type="submit">Search</button>
      </form>
      <p className="text-sm text-muted">{totalItems.toLocaleString("en")} matching accounts</p>
      <UserManagement
        currentUserId={admin.id}
        roles={roles.map(({ key, name }) => ({ key, name }))}
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          smsAlertsEnabled: user.smsAlertsEnabled,
          whatsappAlertsEnabled: user.whatsappAlertsEnabled,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
          roleKey: user.roles[0]?.role.key ?? "",
        }))}
      />
      {totalPages > 1 ? (
        <nav aria-label="Administrator pages" className="flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link className="min-h-10 border border-border px-3 py-2" href={pageHref(page - 1, query)}>Previous</Link> : null}
            {page < totalPages ? <Link className="min-h-10 border border-border px-3 py-2" href={pageHref(page + 1, query)}>Next</Link> : null}
          </div>
        </nav>
      ) : null}
      <p className="text-xs leading-5 text-muted">
        Super Admins can reset another active administrator&apos;s password. Passwords must be shared
        securely outside this application; self-service password reset is not available.
      </p>
    </div>
  );
}

function pageHref(page: number, query: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  return `/admin/users?${params}`;
}
