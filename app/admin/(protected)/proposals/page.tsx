import { ProposalManagement, type ProposalItem } from "@/components/admin/proposal-management";
import { requireAdminPage } from "@/server/auth/admin-page";
import { prisma } from "@/server/db";

export const metadata = { title: "Proposals | WEBNEX Admin" };

export default async function ProposalsPage() {
  await requireAdminPage("proposals:manage");
  const records = await prisma.proposal.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      enquiryId: true,
      title: true,
      scope: true,
      estimatedPrice: true,
      currency: true,
      status: true,
      issueDate: true,
      expiryDate: true,
      internalNotes: true,
      createdAt: true,
      enquiry: { select: { reference: true, name: true } },
    },
  });
  const proposals: ProposalItem[] = records.map((proposal) => ({
    id: proposal.id,
    enquiryId: proposal.enquiryId,
    enquiryReference: proposal.enquiry.reference,
    enquiryName: proposal.enquiry.name,
    title: proposal.title,
    scope: proposal.scope,
    estimatedPrice: proposal.estimatedPrice.toFixed(2),
    currency: proposal.currency,
    status: proposal.status,
    issueDate: proposal.issueDate.toISOString(),
    expiryDate: proposal.expiryDate?.toISOString() ?? null,
    internalNotes: proposal.internalNotes,
    createdAt: proposal.createdAt.toISOString(),
  }));
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-700">Business development</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">Proposals</h1>
        <p className="mt-2 text-sm text-muted">
          {proposals.length} latest proposal records. Amounts are decimal estimates, not recognized revenue.
        </p>
      </header>
      <ProposalManagement canManage proposals={proposals} />
    </div>
  );
}
