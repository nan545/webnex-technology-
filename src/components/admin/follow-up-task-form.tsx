"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Assignee = { id: string; name: string | null; email: string };

export function FollowUpTaskForm({
  enquiryId,
  assignees,
}: {
  enquiryId: string;
  assignees: Assignee[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/v1/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enquiryId,
          title,
          description: description || null,
          dueAt: new Date(dueAt).toISOString(),
          assignedToId: assignedToId || null,
        }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Could not create follow-up.");
      setTitle("");
      setDescription("");
      setDueAt("");
      setMessage("Follow-up task created.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create follow-up.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-6 space-y-3 border-t border-border pt-5" onSubmit={submit}>
      <h3 className="font-semibold">Create follow-up task</h3>
      <label className="block text-sm">
        <span className="field-label">Task</span>
        <input className="field-control" maxLength={160} onChange={(event) => setTitle(event.target.value)} required value={title} />
      </label>
      <label className="block text-sm">
        <span className="field-label">Description (optional)</span>
        <textarea className="field-control min-h-20" maxLength={4000} onChange={(event) => setDescription(event.target.value)} value={description} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="field-label">Due date and time</span>
          <input className="field-control" min={new Date().toISOString().slice(0, 16)} onChange={(event) => setDueAt(event.target.value)} required type="datetime-local" value={dueAt} />
        </label>
        <label className="block text-sm">
          <span className="field-label">Assign to</span>
          <select className="field-control" onChange={(event) => setAssignedToId(event.target.value)} value={assignedToId}>
            <option value="">Me</option>
            {assignees.map((user) => <option key={user.id} value={user.id}>{user.name ?? user.email}</option>)}
          </select>
        </label>
      </div>
      <button className="button-secondary" disabled={busy} type="submit">{busy ? "Creating…" : "Create task"}</button>
      {message ? <p aria-live="polite" className="text-sm text-green-800">{message}</p> : null}
      {error ? <p aria-live="assertive" className="text-sm text-red-800">{error}</p> : null}
    </form>
  );
}
