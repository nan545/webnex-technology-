import { EnquiryStatus } from "@/generated/prisma/client";
import { PipelineBoard, type PipelineEnquiry } from "@/components/admin/pipeline-board";
import { enquiryStatuses, type EnquiryStatusValue } from "@/lib/validation/enquiry-admin";
import { requireAdminPage } from "@/server/auth/admin-page";
import { prisma } from "@/server/db";

export const metadata = { title: "Sales pipeline | WEBNEX Admin" };

export default async function PipelinePage() {
  const admin = await requireAdminPage("enquiries:read");
  const stages = enquiryStatuses.map((status) => EnquiryStatus[status]);
  const counts = await Promise.all(stages.map((status) => prisma.enquiry.count({ where: { status } })));
  const records = await Promise.all(stages.map((status) =>
    prisma.enquiry.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        reference: true,
        name: true,
        organization: true,
        service: true,
        status: true,
        createdAt: true,
        assignedTo: { select: { name: true, email: true } },
      },
    }),
  ));
  const total = counts.reduce((sum, count) => sum + count, 0);
  const countByStatus = new Map(stages.map((status, index) => [status, counts[index] ?? 0]));
  const qualified = (countByStatus.get(EnquiryStatus.QUALIFIED) ?? 0) +
    (countByStatus.get(EnquiryStatus.PROPOSAL_SENT) ?? 0) +
    (countByStatus.get(EnquiryStatus.NEGOTIATION) ?? 0) +
    (countByStatus.get(EnquiryStatus.WON) ?? 0);
  const won = countByStatus.get(EnquiryStatus.WON) ?? 0;
  const columns = stages.map((status, index) => ({
    status: status as EnquiryStatusValue,
    total: counts[index] ?? 0,
    enquiries: (records[index] ?? []).map((item): PipelineEnquiry => ({
      ...item,
      status: item.status as EnquiryStatusValue,
      createdAt: item.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-700">Business development</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">Sales pipeline</h1>
        <p className="mt-2 text-sm text-muted">Current enquiry counts by stage. No estimated revenue is shown.</p>
      </header>
      <section aria-label="Pipeline summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="All enquiries" value={total} />
        <Metric label="Qualified or later" value={qualified} />
        <Metric label="Won" value={won} />
        <Metric label="Won / all enquiries" value={total ? `${((won / total) * 100).toFixed(1)}%` : "—"} />
      </section>
      <PipelineBoard canUpdate={admin.permissions.has("enquiries:update")} columns={columns} />
      <p className="text-xs text-muted">
        Conversion figures reflect current lead statuses, not a time-cohort attribution. Each stage displays up to 10 latest records.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-navy-950">{value}</p>
    </div>
  );
}
