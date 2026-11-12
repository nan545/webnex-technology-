"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type OutboxItem = {
  id: string;
  event: string;
  status: string;
  attemptCount: number;
  lastError: string | null;
  sentAt: string | null;
  updatedAt: string;
  providerMessageId: string | null;
  enquiry: { reference: string };
};

export function EmailOutboxManagement({
  recent,
  canRetry,
}: {
  recent: OutboxItem[];
  canRetry: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function retry(id: string) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/v1/integrations/email/outbox/${id}/retry`, { method: "POST" });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Could not queue notification retry.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not queue notification retry.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      {error ? <p aria-live="assertive" className="mb-3 text-sm text-red-800">{error}</p> : null}
      {recent.length ? (
        <div className="overflow-x-auto border border-border bg-white">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted">
              <tr><th className="p-3">Enquiry</th><th className="p-3">Event</th><th className="p-3">Status</th><th className="p-3">Attempts</th><th className="p-3">Updated</th><th className="p-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent.map((item) => (
                <tr key={item.id}>
                  <td className="p-3">{item.enquiry.reference}</td>
                  <td className="p-3">{item.event.replaceAll("_", " ")}</td>
                  <td className="p-3" title={item.lastError ?? undefined}>
                    {item.status === "SENT" ? "Provider accepted" : item.status}
                    {item.lastError ? <span className="block max-w-64 truncate text-xs text-red-700">{item.lastError}</span> : null}
                  </td>
                  <td className="p-3">{item.attemptCount}</td>
                  <td className="p-3">{new Date(item.updatedAt).toLocaleString("en-GH")}</td>
                  <td className="p-3">
                    {canRetry && item.status === "FAILED" ? (
                      <button className="text-sm font-semibold text-blue-700" disabled={busy === item.id} onClick={() => void retry(item.id)} type="button">
                        {busy === item.id ? "Queueing…" : "Retry"}
                      </button>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border border-dashed border-border bg-white p-8 text-center text-sm text-muted">No notification attempts are recorded.</p>
      )}
    </div>
  );
}
