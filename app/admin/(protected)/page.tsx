import Link from "next/link";
import { EnquiryStatus, ContentStatus } from "@/generated/prisma/client";
import { getAdminContext } from "@/server/auth/authorization";
import { prisma } from "@/server/db";

export const metadata = { title: "Dashboard" };

const metricDefinitions = [
  { key: "totalEnquiries", label: "Total enquiries" },
  { key: "newEnquiries", label: "New enquiries" },
  { key: "contactedEnquiries", label: "Contacted" },
  { key: "qualifiedEnquiries", label: "Qualified" },
  { key: "publishedProjects", label: "Published projects" },
  { key: "publishedServices", label: "Published services" },
  { key: "publishedArticles", label: "Published articles" },
  { key: "activeAdministrators", label: "Active administrators" },
] as const;

export default async function AdminDashboardPage() {
  const result = await loadDashboard();

  if (result.kind === "error") {
    return (
      <section className="border border-red-200 bg-white p-6" role="alert">
        <p className="text-sm font-semibold text-red-800">Dashboard data is unavailable.</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          The dashboard could not read the configured PostgreSQL database. Confirm the
          database credentials and migrations, then refresh this page.
        </p>
      </section>
    );
  }
  if (result.kind === "unauthenticated") {
    return (
      <p className="border border-red-200 bg-white p-6 text-sm text-red-800" role="alert">
        Your administrator session is no longer valid. Sign in again.
      </p>
    );
  }

  const {
    canReadEnquiries,
    canReadAudit,
    metrics,
    recentEnquiries,
    recentActivity,
  } = result;

  return (
    <div className="space-y-9">
      <div>
        <p className="text-sm font-semibold text-blue-700">Overview</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">Dashboard</h1>
        <p className="mt-2 text-sm text-muted">
          Current operational records from the WEBNEX database.
        </p>
      </div>

      <section aria-label="Operational metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricDefinitions.map(({ key, label }) => (
          <article className="border border-border bg-white p-5" key={key}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-navy-950">
              {typeof metrics[key] === "number" ? metrics[key].toLocaleString("en") : "—"}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <div className="border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold text-navy-950">Recent enquiries</h2>
            {canReadEnquiries ? (
              <Link className="text-sm font-medium text-blue-700 hover:text-navy-950" href="/admin/enquiries">
                View all
              </Link>
            ) : null}
          </div>
          {!canReadEnquiries ? (
            <p className="px-5 py-10 text-sm text-muted">Enquiry totals are restricted for your role.</p>
          ) : recentEnquiries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Reference</th>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Service</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentEnquiries.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-3">
                        <Link className="font-medium text-blue-700" href={`/admin/enquiries/${item.id}`}>
                          {item.reference}
                        </Link>
                      </td>
                      <td className="px-5 py-3">{item.name}</td>
                      <td className="px-5 py-3">{item.service}</td>
                      <td className="px-5 py-3">{item.status.replaceAll("_", " ")}</td>
                      <td className="px-5 py-3 text-muted">
                        {item.createdAt.toLocaleDateString("en-GH")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-sm text-muted">No enquiries have been received yet.</p>
          )}
        </div>

        <div className="border border-border bg-white">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold text-navy-950">Recent administrative activity</h2>
          </div>
          {!canReadAudit ? (
            <p className="px-5 py-10 text-sm text-muted">Administrative activity is restricted for your role.</p>
          ) : recentActivity.length ? (
            <ol className="divide-y divide-border">
              {recentActivity.map((item) => (
                <li className="px-5 py-4" key={item.id}>
                  <p className="text-sm font-medium text-navy-900">
                    {item.action.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {item.actor?.name ?? item.actor?.email ?? "System"} · {item.entityType} ·{" "}
                    {item.createdAt.toLocaleString("en-GH")}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-10 text-sm text-muted">No administrative activity recorded.</p>
          )}
        </div>
      </section>
    </div>
  );
}

async function loadDashboard() {
  try {
    const admin = await getAdminContext();
    if (!admin) return { kind: "unauthenticated" as const };

    const now = new Date();
    const canReadEnquiries = admin.permissions.has("enquiries:read");
    const canManageUsers = admin.permissions.has("users:manage");
    const canReadAudit = admin.permissions.has("audit:read");
    const [
      totalEnquiries,
      newEnquiries,
      contactedEnquiries,
      qualifiedEnquiries,
      publishedProjects,
      publishedServices,
      publishedArticles,
      activeAdministrators,
      recentEnquiries,
      recentActivity,
    ] = await Promise.all([
      canReadEnquiries ? prisma.enquiry.count() : Promise.resolve(null),
      canReadEnquiries ? prisma.enquiry.count({ where: { status: EnquiryStatus.NEW } }) : Promise.resolve(null),
      canReadEnquiries ? prisma.enquiry.count({ where: { status: EnquiryStatus.CONTACTED } }) : Promise.resolve(null),
      canReadEnquiries ? prisma.enquiry.count({ where: { status: EnquiryStatus.QUALIFIED } }) : Promise.resolve(null),
      prisma.project.count({
        where: { status: ContentStatus.PUBLISHED, publishedAt: { lte: now } },
      }),
      prisma.service.count({
        where: { status: ContentStatus.PUBLISHED, publishedAt: { lte: now } },
      }),
      prisma.blogPost.count({
        where: { status: ContentStatus.PUBLISHED, publishedAt: { lte: now } },
      }),
      canManageUsers
        ? prisma.user.count({
            where: {
              isActive: true,
              roles: { some: { role: { key: { in: ["SUPER_ADMIN", "ADMIN", "EDITOR"] } } } },
            },
          })
        : Promise.resolve(null),
      canReadEnquiries
        ? prisma.enquiry.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
              id: true,
              reference: true,
              name: true,
              service: true,
              status: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      canReadAudit
        ? prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
              id: true,
              action: true,
              entityType: true,
              createdAt: true,
              actor: { select: { name: true, email: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    return {
      kind: "ok" as const,
      canReadEnquiries,
      canReadAudit,
      metrics: {
        totalEnquiries,
        newEnquiries,
        contactedEnquiries,
        qualifiedEnquiries,
        publishedProjects,
        publishedServices,
        publishedArticles,
        activeAdministrators,
      },
      recentEnquiries,
      recentActivity,
    };
  } catch {
    console.error("Administrative dashboard query failed.");
    return { kind: "error" as const };
  }
}
