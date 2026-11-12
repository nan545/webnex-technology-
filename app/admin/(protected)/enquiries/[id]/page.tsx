import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EnquiryActions } from "@/components/admin/enquiry-actions";
import { ContactActivityForm } from "@/components/admin/contact-activity-form";
import { FollowUpTaskForm } from "@/components/admin/follow-up-task-form";
import { ProposalManagement, type ProposalItem } from "@/components/admin/proposal-management";
import { WhatsAppContactLink } from "@/components/admin/whatsapp-contact-link";
import { prisma } from "@/server/db";
import { requireAdminPage } from "@/server/auth/admin-page";

export default async function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdminPage("enquiries:read");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [enquiry, assignees] = await Promise.all([
    prisma.enquiry.findUnique({
      where: { id },
      select: {
        id: true,
        reference: true,
        name: true,
        email: true,
        phone: true,
        organization: true,
        service: true,
        budget: true,
        preferredContact: true,
        message: true,
        status: true,
        followUpAt: true,
        lastContactAt: true,
        whatsappConsentAt: true,
        sourcePath: true,
        createdAt: true,
        updatedAt: true,
        assignedToId: true,
        notes: {
          where: { isInternal: true },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { name: true, email: true } },
          },
        },
        followUps: {
          orderBy: { dueAt: "asc" },
          take: 20,
          select: {
            id: true,
            title: true,
            dueAt: true,
            completedAt: true,
            assignedTo: { select: { name: true, email: true } },
          },
        },
      },
    }),
    admin.permissions.has("enquiries:update")
      ? prisma.user.findMany({
          where: {
            isActive: true,
            roles: {
              some: {
                role: {
                  permissions: {
                    some: { permission: { key: "enquiries:update" } },
                  },
                },
              },
            },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);
  if (!enquiry) notFound();

  const history = await prisma.auditLog.findMany({
    where: { entityType: "Enquiry", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      details: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });
  const activities = await prisma.enquiryActivity.findMany({
    where: { enquiryId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      description: true,
      type: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });
  const proposalRecords = admin.permissions.has("proposals:manage")
    ? await prisma.proposal.findMany({
        where: { enquiryId: id },
        orderBy: { createdAt: "desc" },
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
        },
      })
    : [];
  const proposals: ProposalItem[] = proposalRecords.map((proposal) => ({
    ...proposal,
    enquiryReference: enquiry.reference,
    enquiryName: enquiry.name,
    estimatedPrice: proposal.estimatedPrice.toFixed(2),
    issueDate: proposal.issueDate.toISOString(),
    expiryDate: proposal.expiryDate?.toISOString() ?? null,
    createdAt: proposal.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-7">
      <div>
        <Link className="text-sm font-medium text-blue-700 hover:text-navy-950" href="/admin/enquiries">
          ← All enquiries
        </Link>
        <p className="mt-5 text-sm font-semibold text-blue-700">Enquiry details</p>
        <h1 className="mt-1 text-2xl font-semibold">{enquiry.reference}</h1>
        <p className="mt-2 text-sm text-muted">
          Received {enquiry.createdAt.toLocaleString("en-GH")}
        </p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <div className="space-y-7">
          <section className="grid gap-5 border border-border bg-white p-5 sm:grid-cols-2 sm:p-7">
            <Detail label="Full name" value={enquiry.name} />
            <Detail label="Email" value={enquiry.email} />
            <Detail label="Phone" value={enquiry.phone ?? "Not provided"} />
            <Detail label="Company" value={enquiry.organization ?? "Not provided"} />
            <Detail label="Requested service" value={enquiry.service} />
            <Detail label="Estimated budget" value={enquiry.budget ?? "Not provided"} />
            <Detail label="Preferred contact" value={enquiry.preferredContact} />
            <Detail label="Last contact" value={enquiry.lastContactAt?.toLocaleString("en-GH") ?? "Not recorded"} />
            <Detail label="WhatsApp consent" value={enquiry.whatsappConsentAt?.toLocaleString("en-GH") ?? "Not provided"} />
            <Detail label="Source" value={enquiry.sourcePath ?? "Not recorded"} />
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Project description</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-navy-900">{enquiry.message}</p>
            </div>
          </section>
          {admin.permissions.has("proposals:manage") ? (
            <section className="border border-border bg-white p-5 sm:p-7">
              <h2 className="mb-5 font-semibold">Proposals</h2>
              <p className="mb-4 text-xs leading-5 text-muted">
                Proposal amounts are estimates. Status changes record the actual externally sent or accepted state; no proposal email or PDF is generated here.
              </p>
              <ProposalManagement canManage enquiryId={enquiry.id} proposals={proposals} />
            </section>
          ) : null}

          <section className="border border-border bg-white p-5 sm:p-7">
            <h2 className="font-semibold">Internal notes</h2>
            {enquiry.notes.length ? (
              <ol className="mt-5 divide-y divide-border">
                {enquiry.notes.map((note) => (
                  <li className="py-4 first:pt-0 last:pb-0" key={note.id}>
                    <p className="whitespace-pre-wrap text-sm leading-6">{note.body}</p>
                    <p className="mt-2 text-xs text-muted">
                      {note.author?.name ?? note.author?.email ?? "Administrator"} · {note.createdAt.toLocaleString("en-GH")}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-muted">No internal notes yet.</p>
            )}
            {admin.permissions.has("enquiries:update") ? (
              <EnquiryActions
                assignees={assignees}
                assignedToId={enquiry.assignedToId}
                enquiryId={enquiry.id}
                followUpAt={enquiry.followUpAt?.toISOString() ?? null}
                status={enquiry.status}
              />
            ) : null}
            {enquiry.followUps.length ? (
              <div className="mt-7 border-t border-border pt-5">
                <h3 className="font-semibold">Follow-up history</h3>
                <ul className="mt-3 space-y-3">
                  {enquiry.followUps.map((task) => (
                    <li className="text-sm" key={task.id}>
                      <p className="font-medium">{task.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {task.completedAt ? "Completed" : task.dueAt < new Date() ? "Overdue" : "Due"} ·{" "}
                        {new Date(task.completedAt ?? task.dueAt).toLocaleString("en-GH")} ·{" "}
                        {task.assignedTo?.name ?? task.assignedTo?.email ?? "Unassigned"}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {admin.permissions.has("enquiries:update") ? (
              <FollowUpTaskForm assignees={assignees} enquiryId={enquiry.id} />
            ) : null}
          </section>
        </div>

        <aside className="space-y-7">
          <section className="border border-border bg-white p-5 sm:p-7">
            <h2 className="font-semibold">Enquiry activity</h2>
            {admin.permissions.has("enquiries:update") ? (
              <div className="mt-4">
                <WhatsAppContactLink
                  consented={Boolean(enquiry.whatsappConsentAt)}
                  enquiryId={enquiry.id}
                  name={enquiry.name}
                  phone={enquiry.phone}
                />
              </div>
            ) : null}
            {admin.permissions.has("enquiries:update") ? (
              <ContactActivityForm enquiryId={enquiry.id} />
            ) : null}
            {activities.length ? (
              <ol className="mt-5 space-y-5">
                {activities.map((item) => (
                  <li className="border-l-2 border-blue-200 pl-3" key={item.id}>
                    <p className="text-sm font-medium">{item.description}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {item.actor?.name ?? item.actor?.email ?? "System"} · {item.createdAt.toLocaleString("en-GH")}
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}
            {history.length ? (
              <ol className="mt-5 space-y-5">
                {history.map((item) => (
                  <li className="border-l-2 border-blue-200 pl-3" key={item.id}>
                    <p className="text-sm font-medium">{item.action.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {item.actor?.name ?? item.actor?.email ?? "System"} · {item.createdAt.toLocaleString("en-GH")}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-muted">No audit activity recorded.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 break-words text-sm text-navy-900">{value}</p>
    </div>
  );
}
