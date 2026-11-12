"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export type ProposalItem = {
  id: string;
  enquiryId: string;
  enquiryReference: string;
  enquiryName: string;
  title: string;
  scope: string;
  estimatedPrice: string;
  currency: "GHS" | "USD";
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  issueDate: string;
  expiryDate: string | null;
  internalNotes: string | null;
  createdAt: string;
};

const nextStatuses: Record<ProposalItem["status"], ProposalItem["status"][]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED"],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

export function ProposalManagement({
  enquiryId,
  proposals,
  canManage,
}: {
  enquiryId?: string;
  proposals: ProposalItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [currency, setCurrency] = useState<"GHS" | "USD">("GHS");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enquiryId) return;
    setBusy("create");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/v1/enquiries/${enquiryId}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          scope,
          estimatedPrice,
          currency,
          issueDate,
          expiryDate: expiryDate || null,
          internalNotes: internalNotes || null,
        }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Could not create proposal.");
      setTitle("");
      setScope("");
      setEstimatedPrice("");
      setExpiryDate("");
      setInternalNotes("");
      setMessage("Proposal saved as a draft.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create proposal.");
    } finally {
      setBusy("");
    }
  }

  async function changeStatus(proposal: ProposalItem, status: ProposalItem["status"]) {
    setBusy(proposal.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/v1/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Could not change proposal status.");
      setMessage(`Proposal marked ${status.toLowerCase()}.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change proposal status.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      {message ? <p aria-live="polite" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p> : null}
      {error ? <p aria-live="assertive" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {canManage && enquiryId ? (
        <form className="space-y-4 border border-border bg-slate-50 p-4" onSubmit={create}>
          <h3 className="font-semibold">New proposal draft</h3>
          <label className="block text-sm">
            <span className="field-label">Proposal title</span>
            <input className="field-control" maxLength={200} onChange={(event) => setTitle(event.target.value)} required value={title} />
          </label>
          <label className="block text-sm">
            <span className="field-label">Project scope</span>
            <textarea className="field-control min-h-28" maxLength={20_000} minLength={10} onChange={(event) => setScope(event.target.value)} required value={scope} />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="field-label">Estimated price</span>
              <input className="field-control" inputMode="decimal" onChange={(event) => setEstimatedPrice(event.target.value)} pattern="(?:0|[1-9][0-9]{0,15})(?:[.][0-9]{1,2})?" placeholder="0.00" required value={estimatedPrice} />
            </label>
            <label className="block text-sm">
              <span className="field-label">Currency</span>
              <select className="field-control" onChange={(event) => setCurrency(event.target.value as "GHS" | "USD")} value={currency}>
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="field-label">Issue date</span>
              <input className="field-control" onChange={(event) => setIssueDate(event.target.value)} required type="date" value={issueDate} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="field-label">Expiry date (optional)</span>
            <input className="field-control" onChange={(event) => setExpiryDate(event.target.value)} type="date" value={expiryDate} />
          </label>
          <label className="block text-sm">
            <span className="field-label">Internal notes (not sent to customer)</span>
            <textarea className="field-control min-h-20" maxLength={10_000} onChange={(event) => setInternalNotes(event.target.value)} value={internalNotes} />
          </label>
          <button className="button-primary" disabled={busy !== ""} type="submit">{busy === "create" ? "Saving…" : "Save proposal draft"}</button>
        </form>
      ) : null}
      {proposals.length ? (
        <ul className="divide-y divide-border border border-border bg-white">
          {proposals.map((proposal) => (
            <li className="p-4 sm:p-5" key={proposal.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-navy-950">{proposal.title}</p>
                  {!enquiryId ? (
                    <p className="mt-1 text-sm">
                      <Link className="text-blue-700 hover:text-navy-950" href={`/admin/enquiries/${proposal.enquiryId}`}>
                        {proposal.enquiryReference} · {proposal.enquiryName}
                      </Link>
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-muted">
                    {proposal.currency} {proposal.estimatedPrice} · {proposal.status.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Issued {new Date(proposal.issueDate).toLocaleDateString("en-GH")}
                    {proposal.expiryDate ? ` · Expires ${new Date(proposal.expiryDate).toLocaleDateString("en-GH")}` : ""}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-navy-800">{proposal.scope}</p>
                  {proposal.internalNotes ? <p className="mt-3 text-xs text-muted">Internal: {proposal.internalNotes}</p> : null}
                </div>
                {canManage && nextStatuses[proposal.status].length ? (
                  <label className="text-sm">
                    <span className="sr-only">Update proposal status</span>
                    <select
                      className="field-control min-w-40"
                      disabled={busy === proposal.id}
                      onChange={(event) => void changeStatus(proposal, event.target.value as ProposalItem["status"])}
                      value={proposal.status}
                    >
                      <option value={proposal.status}>{proposal.status.replaceAll("_", " ")}</option>
                      {nextStatuses[proposal.status].map((status) => <option key={status} value={status}>{status === "SENT" ? "Record as sent" : status.replaceAll("_", " ")}</option>)}
                    </select>
                  </label>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border border-dashed border-border px-5 py-8 text-center text-sm text-muted">No proposals have been recorded.</p>
      )}
    </div>
  );
}
