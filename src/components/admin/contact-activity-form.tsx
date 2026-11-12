"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function ContactActivityForm({ enquiryId }: { enquiryId: string }) {
  const router = useRouter();
  const [type, setType] = useState<"PHONE_CONTACT" | "EMAIL_CONTACT" | "MEETING">("PHONE_CONTACT");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/v1/enquiries/${enquiryId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Could not record activity.");
      setDescription("");
      setMessage("Activity recorded.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record activity.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-5 space-y-3 border-t border-border pt-5" onSubmit={submit}>
      <h3 className="font-semibold">Record a contact</h3>
      <label className="block text-sm">
        <span className="field-label">Activity type</span>
        <select className="field-control" onChange={(event) => setType(event.target.value as typeof type)} value={type}>
          <option value="PHONE_CONTACT">Phone contact</option>
          <option value="EMAIL_CONTACT">Email contact</option>
          <option value="MEETING">Meeting</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="field-label">Internal description</span>
        <textarea className="field-control min-h-20" maxLength={1000} onChange={(event) => setDescription(event.target.value)} required value={description} />
      </label>
      <button className="button-secondary" disabled={busy} type="submit">{busy ? "Saving…" : "Record activity"}</button>
      {message ? <p aria-live="polite" className="text-sm text-green-800">{message}</p> : null}
      {error ? <p aria-live="assertive" className="text-sm text-red-800">{error}</p> : null}
    </form>
  );
}
