"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { enquiryStatuses, type EnquiryStatusValue } from "@/lib/validation/enquiry-admin";

export type PipelineEnquiry = {
  id: string;
  reference: string;
  name: string;
  organization: string | null;
  service: string;
  status: EnquiryStatusValue;
  createdAt: string;
  assignedTo: { name: string | null; email: string } | null;
};

const labels: Record<EnquiryStatusValue, string> = {
  NEW: "New enquiry",
  CONTACTED: "Initial contact",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export function PipelineBoard({
  columns,
  canUpdate,
}: {
  columns: Array<{ status: EnquiryStatusValue; total: number; enquiries: PipelineEnquiry[] }>;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function move(enquiryId: string, status: EnquiryStatusValue) {
    setBusyId(enquiryId);
    setError("");
    try {
      const response = await fetch(`/api/admin/v1/enquiries/${enquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: { message?: string } };
        throw new Error(result.error?.message ?? "The stage could not be changed.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The stage could not be changed.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      {error ? <p aria-live="assertive" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <div className="grid gap-4 overflow-x-auto pb-3 xl:grid-cols-4 2xl:grid-cols-7">
        {columns.map(({ status, total, enquiries }) => (
          <section aria-label={`${labels[status]}: ${total}`} className="min-w-[245px] border border-border bg-slate-50" key={status}>
            <header className="flex items-center justify-between border-b border-border bg-white px-3 py-3">
              <h2 className="text-sm font-semibold text-navy-950">{labels[status]}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-muted">{total}</span>
            </header>
            <ol className="space-y-3 p-3">
              {enquiries.map((item) => (
                <li className="border border-border bg-white p-3" key={item.id}>
                  <Link className="text-xs font-semibold text-blue-700 hover:text-navy-950" href={`/admin/enquiries/${item.id}`}>
                    {item.reference}
                  </Link>
                  <p className="mt-1 text-sm font-medium text-navy-950">{item.name}</p>
                  <p className="mt-1 truncate text-xs text-muted">{item.organization ?? item.service}</p>
                  <p className="mt-2 text-xs text-muted">{item.assignedTo?.name ?? item.assignedTo?.email ?? "Unassigned"}</p>
                  <p className="mt-1 text-xs text-muted">{new Date(item.createdAt).toLocaleDateString()}</p>
                  {canUpdate ? (
                    <label className="mt-3 block text-xs text-muted">
                      Move to
                      <select
                        aria-label={`Move ${item.reference} to stage`}
                        className="field-control mt-1 min-h-9 py-1 text-xs"
                        disabled={busyId === item.id}
                        onChange={(event) => void move(item.id, event.target.value as EnquiryStatusValue)}
                        value={item.status}
                      >
                        {enquiryStatuses.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
                      </select>
                    </label>
                  ) : null}
                </li>
              ))}
              {enquiries.length === 0 ? <li className="px-2 py-8 text-center text-xs text-muted">No leads in this stage.</li> : null}
              {total > enquiries.length ? (
                <li className="text-center text-xs text-muted">Showing the latest {enquiries.length} of {total}</li>
              ) : null}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
