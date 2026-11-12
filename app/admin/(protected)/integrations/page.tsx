import { NotificationStatus } from "@/generated/prisma/client";
import { getSendGridConfiguration } from "@/server/integrations/sendgrid";
import { requireAdminPage } from "@/server/auth/admin-page";
import { prisma } from "@/server/db";
import { EmailOutboxManagement } from "@/components/admin/email-outbox-management";

export const metadata = { title: "Integrations | WEBNEX Admin" };

export default async function IntegrationsPage() {
  await requireAdminPage("settings:manage");
  const configuration = getSendGridConfiguration();
  const [grouped, recent] = await prisma.$transaction([
    prisma.notificationOutbox.groupBy({
      by: ["status"],
      orderBy: { status: "asc" },
      _count: true,
    }),
    prisma.notificationOutbox.findMany({
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        event: true,
        status: true,
        attemptCount: true,
        lastError: true,
        sentAt: true,
        updatedAt: true,
        providerMessageId: true,
        enquiry: { select: { reference: true } },
      },
    }),
  ]);
  const counts = Object.fromEntries(
    Object.values(NotificationStatus).map((status) => [
      status,
      grouped.find((item) => item.status === status)?._count ?? 0,
    ]),
  ) as Record<NotificationStatus, number>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-700">System operations</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">Integrations</h1>
      </header>
      <section className="border border-border bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-navy-950">SendGrid email</h2>
            <p className="mt-2 text-sm text-muted">
              {configuration
                ? "Provider credentials and sender configuration are present."
                : "Not configured. Set provider credentials and sender/recipient details in the server environment."}
            </p>
            <p className="mt-2 text-xs text-muted">
              Customer acknowledgements: {configuration?.customerAcknowledgementsEnabled ? "enabled" : "disabled"}.
              Credentials are never displayed here.
            </p>
          </div>
          <span className={`w-fit border px-3 py-1 text-xs font-semibold ${configuration ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {configuration ? "Configured" : "Action required"}
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Metric label="Pending" value={counts.PENDING} />
          <Metric label="Processing" value={counts.PROCESSING} />
          <Metric label="Provider accepted" value={counts.SENT} />
          <Metric label="Failed" value={counts.FAILED} />
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">
          The `email:dispatch` worker is not automatically scheduled by this application. Configure an approved scheduler to run it. “Provider accepted” means SendGrid returned success; delivery and recipient inbox status are not verified because delivery webhooks are not configured.
        </p>
      </section>
      <section>
        <h2 className="mb-3 font-semibold text-navy-950">Recent email notifications</h2>
        <EmailOutboxManagement canRetry recent={recent.map((item) => ({
          ...item,
          updatedAt: item.updatedAt.toISOString(),
          sentAt: item.sentAt?.toISOString() ?? null,
        }))} />
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="border border-border p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}
