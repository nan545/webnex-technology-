"use client";

import { useState, type FormEvent } from "react";
import { contactPhoneSchema } from "@/lib/validation/site-configuration";

export function ContactPhoneEditor({ initial }: { initial: string }) {
  const [phone, setPhone] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const parsed = contactPhoneSchema.safeParse({ phone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the phone number.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/v1/settings/contact-phone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Contact phone could not be saved.");
      setPhone(parsed.data.phone);
      setMessage("Contact phone saved. Refresh the Contact page to see the change.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Contact phone could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4 border border-border bg-white p-5 sm:p-7" onSubmit={save}>
      <h2 className="font-semibold text-navy-950">Public contact phone</h2>
      <p className="text-sm leading-6 text-muted">
        This number is displayed on the Contact page. Leave it empty to hide it.
      </p>
      <label className="block text-sm font-medium" htmlFor="contact-phone">Contact phone number</label>
      <input className="field-control max-w-md" disabled={busy} id="contact-phone" maxLength={40} onChange={(event) => { setPhone(event.target.value); setMessage(""); setError(""); }} type="tel" value={phone} />
      {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-800" role="status">{message}</p> : null}
      <div><button className="button-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save contact phone"}</button></div>
    </form>
  );
}
