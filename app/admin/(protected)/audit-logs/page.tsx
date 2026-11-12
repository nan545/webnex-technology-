import { Prisma } from "@/generated/prisma/client";
import { requireAdminPage } from "@/server/auth/admin-page";
import { prisma } from "@/server/db";

const pageSize = 50;

export const metadata = { title: "Audit logs" };

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireAdminPage("audit:read");
  const params = await searchParams;
  const requested = Number(params.page ?? "1");
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, 100_000) : 1;
  const query = params.q?.trim().slice(0, 100);
  const where: Prisma.AuditLogWhereInput = query
    ? {
        OR: [
          { action: { contains: query, mode: "insensitive" } },
          { entityType: { contains: query, mode: "insensitive" } },
          { entityId: { contains: query, mode: "insensitive" } },
          { actor: { is: { email: { contains: query, mode: "insensitive" } } } },
        ],
      }
    : {};

  const [items, totalItems] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        details: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-semibold text-blue-700">Security and accountability</p>
        <h1 className="mt-1 text-2xl font-semibold">Audit logs</h1>
        <p className="mt-2 text-sm text-muted">{totalItems.toLocaleString("en")} records</p>
      </div>
      <form className="flex flex-col gap-3 border border-border bg-white p-4 sm:flex-row" method="get">
        <label className="sr-only" htmlFor="audit-search">Search audit log</label>
        <input className="field-control flex-1" defaultValue={query} id="audit-search" maxLength={100} name="q" placeholder="Action, administrator, record type or ID" type="search" />
        <button className="button-primary" type="submit">Search</button>
      </form>
      <section className="overflow-hidden border border-border bg-white">
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Record</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4 font-medium">{item.action.replaceAll("_", " ")}</td>
                    <td className="px-4 py-4">{item.actor?.name ?? item.actor?.email ?? "System"}</td>
                    <td className="px-4 py-4">{item.entityType}{item.entityId ? <span className="mt-1 block max-w-48 truncate text-xs text-muted">{item.entityId}</span> : null}</td>
                    <td className="max-w-72 px-4 py-4 text-xs text-muted">{item.details ? JSON.stringify(item.details) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted">{item.createdAt.toLocaleString("en-GH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-muted">No audit records match this query.</p>
        )}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? <a className="min-h-10 border border-border px-3 py-2" href={pageHref(page - 1, query)}>Previous</a> : null}
              {page < totalPages ? <a className="min-h-10 border border-border px-3 py-2" href={pageHref(page + 1, query)}>Next</a> : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function pageHref(page: number, query?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  return `/admin/audit-logs?${params}`;
}
