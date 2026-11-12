"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { enquiryStatuses, type EnquiryStatusValue } from "@/lib/validation/enquiry-admin";

type Assignee = { id: string; name: string | null; email: string };

export function EnquiryActions({
  enquiryId,
  status,
  assignedToId,
  followUpAt,
  assignees,
}: {
  enquiryId: string;
  status: EnquiryStatusValue;
  assignedToId: string | null;
  followUpAt: string | null;
  assignees: Assignee[];
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState<EnquiryStatusValue>(status);
  const [nextAssignee, setNextAssignee] = useState(assignedToId ?? "");
  const [nextFollowUp, setNextFollowUp] = useState(
    followUpAt ? new Date(followUpAt).toISOString().slice(0, 16) : "",
  );
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/v1/enquiries/${enquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          assignedToId: nextAssignee || null,
          followUpAt: nextFollowUp ? new Date(nextFollowUp).toISOString() : null,
        }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setMessage("Enquiry changes saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/v1/enquiries/${enquiryId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: note }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setNote("");
      setMessage("Internal note added.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-7 border-t border-border pt-6">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveChanges}>
        <div>
          <label className="field-label" htmlFor="enquiry-status-edit">Status</label>
          <select className="field-control" id="enquiry-status-edit" onChange={(event) => setNextStatus(event.target.value as EnquiryStatusValue)} value={nextStatus}>
            {enquiryStatuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="enquiry-assignee-edit">Assigned administrator</label>
          <select className="field-control" id="enquiry-assignee-edit" onChange={(event) => setNextAssignee(event.target.value)} value={nextAssignee}>
            <option value="">Unassigned</option>
            {assignees.map((item) => <option key={item.id} value={item.id}>{item.name ?? item.email}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="enquiry-follow-up">Follow-up date</label>
          <input className="field-control" id="enquiry-follow-up" onChange={(event) => setNextFollowUp(event.target.value)} type="datetime-local" value={nextFollowUp} />
        </div>
        <div className="sm:col-span-2">
          <button className="button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save enquiry changes"}</button>
        </div>
      </form>
      <form className="mt-7 space-y-3" onSubmit={addNote}>
        <label className="field-label" htmlFor="enquiry-internal-note">Add internal note</label>
        <textarea className="field-control min-h-28 resize-y" id="enquiry-internal-note" maxLength={4000} onChange={(event) => setNote(event.target.value)} required value={note} />
        <button className="min-h-11 border border-border px-4 text-sm font-semibold hover:border-blue-700 hover:text-blue-700" disabled={saving} type="submit">
          {saving ? "Saving…" : "Add note"}
        </button>
      </form>
      <div aria-live="polite" className="mt-4 min-h-6">
        {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
        {message ? <p className="text-sm text-green-800" role="status">{message}</p> : null}
      </div>
    </div>
  );
}

async function errorMessage(response: Response) {
  const payload: unknown = await response.json().catch(() => undefined);
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return "The request could not be completed.";
}
