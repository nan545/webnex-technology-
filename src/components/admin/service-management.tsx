"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  cmsServiceCreateSchema,
  cmsServiceUpdateSchema,
  type CmsServiceContent,
} from "@/lib/validation/cms-service";

export type AdminService = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: CmsServiceContent;
  status: string;
  updatedAt: string;
  revisionCount: number;
  revisions: Array<{ id: string; revision: number; status: string; createdAt: string; authorName: string | null }>;
};

const blankContent: CmsServiceContent = {
  introduction: "",
  problems: [],
  capabilities: [],
  delivery: "",
  faqs: [],
  icon: "code",
};

const statusNames: Record<string, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export function ServiceManagement({
  services,
  canApprove,
  canPublish,
  canRestore,
  canDelete,
}: {
  services: AdminService[];
  canApprove: boolean;
  canPublish: boolean;
  canRestore: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = services.find((service) => service.id === selectedId) ?? null;
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState<CmsServiceContent>(blankContent);
  const [faqsValue, setFaqsValue] = useState(JSON.stringify(blankContent.faqs, null, 2));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function chooseService(service: AdminService | null) {
    setSelectedId(service?.id ?? null);
    setTitle(service?.title ?? "");
    setSlug(service?.slug ?? "");
    setSummary(service?.summary ?? "");
    setContent(service?.content ?? blankContent);
    setFaqsValue(JSON.stringify(service?.content.faqs ?? [], null, 2));
    setNotice("");
    setError("");
  }

  async function save(status?: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED") {
    setBusy(true);
    setNotice("");
    setError("");
    let faqs: unknown;
    try {
      faqs = JSON.parse(faqsValue);
    } catch {
      setError("FAQs must be valid JSON before saving.");
      setBusy(false);
      return;
    }
    const body = {
      title: title.trim(),
      slug: slug.trim(),
      summary: summary.trim() || null,
      content: { ...content, faqs },
      ...(status ? { status } : {}),
    };
    const parsedBody = selected
      ? cmsServiceUpdateSchema.safeParse(body)
      : cmsServiceCreateSchema.safeParse(body);
    if (!parsedBody.success) {
      setError(parsedBody.error.issues[0]?.message ?? "Review the service details.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch(
        selected ? `/api/admin/v1/services/${selected.id}` : "/api/admin/v1/services",
        {
          method: selected ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = await response.json() as { data?: { id?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "The service could not be saved.");
      const id = selected?.id ?? result.data?.id;
      setNotice(status === "IN_REVIEW" ? "Submitted for review." : status === "PUBLISHED" ? "Service published." : "Service saved.");
      if (id) setSelectedId(id);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The service could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "DRAFT" | "ARCHIVED") {
    if (!selected) return;
    await save(status);
  }

  async function deleteService() {
    if (!selected || !window.confirm(`Permanently delete "${selected.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/v1/services/${selected.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "The service could not be deleted.");
      chooseService(null);
      setNotice("Service deleted.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The service could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  async function restoreRevision(revisionId: string, revisionNumber: number) {
    if (!selected || !window.confirm(`Restore revision ${revisionNumber} as a new draft?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/v1/services/${selected.id}/revisions/${revisionId}/restore`,
        { method: "POST" },
      );
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "The revision could not be restored.");
      setNotice(`Revision ${revisionNumber} restored as a draft.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The revision could not be restored.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
      <section aria-label="Services" className="border border-border bg-white">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-semibold text-navy-950">Services</h2>
            <p className="mt-1 text-xs text-muted">{services.length} shown</p>
          </div>
          <button className="button-secondary" disabled={busy} onClick={() => chooseService(null)} type="button">
            New service
          </button>
        </div>
        {services.length ? (
          <ul className="divide-y divide-border">
            {services.map((service) => (
              <li key={service.id}>
                <button
                  aria-current={service.id === selectedId ? "true" : undefined}
                  className="w-full p-4 text-left hover:bg-slate-50 aria-current:bg-blue-50"
                  onClick={() => chooseService(service)}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-medium text-navy-950">{service.title}</span>
                    <span className="text-xs text-muted">{statusNames[service.status] ?? service.status}</span>
                  </span>
                  <span className="mt-1 block truncate text-sm text-muted">/{service.slug}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-sm text-muted">No services in the database yet.</p>
        )}
      </section>

      <section aria-labelledby="service-editor-title" className="space-y-5 border border-border bg-white p-5 sm:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            {selected ? statusNames[selected.status] ?? selected.status : "New draft"}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-navy-950" id="service-editor-title">
            {selected ? "Edit service" : "Create service"}
          </h2>
        </div>
        {notice ? <p aria-live="polite" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p> : null}
        {error ? <p aria-live="assertive" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <Field label="Service name">
            <input className="field-control" maxLength={120} onChange={(event) => setTitle(event.target.value)} required value={title} />
          </Field>
          <Field label="URL slug">
            <input className="field-control" maxLength={120} onChange={(event) => setSlug(event.target.value)} required value={slug} />
          </Field>
          <Field label="Short description">
            <textarea className="field-control min-h-20" maxLength={500} onChange={(event) => setSummary(event.target.value)} value={summary} />
          </Field>
          <Field label="Introduction">
            <textarea className="field-control min-h-28" maxLength={4000} onChange={(event) => setContent({ ...content, introduction: event.target.value })} value={content.introduction} />
          </Field>
          <Field label="Problems addressed (one per line)">
            <textarea className="field-control min-h-24" onChange={(event) => setContent({ ...content, problems: lines(event.target.value) })} value={content.problems.join("\n")} />
          </Field>
          <Field label="Capabilities (one per line)">
            <textarea className="field-control min-h-24" onChange={(event) => setContent({ ...content, capabilities: lines(event.target.value) })} value={content.capabilities.join("\n")} />
          </Field>
          <Field label="Delivery approach">
            <textarea className="field-control min-h-24" maxLength={4000} onChange={(event) => setContent({ ...content, delivery: event.target.value })} value={content.delivery} />
          </Field>
          <Field label="FAQs (JSON array of question and answer objects)">
            <textarea
              aria-describedby="service-faq-help"
              className="field-control min-h-28 font-mono text-xs"
              onChange={(event) => setFaqsValue(event.target.value)}
              value={faqsValue}
            />
            <span className="mt-1 block text-xs text-muted" id="service-faq-help">
              Example: [{"{"}&quot;question&quot;:&quot;Question&quot;,&quot;answer&quot;:&quot;Answer&quot;{"}"}]
            </span>
          </Field>
          <Field label="Approved visual icon">
            <select className="field-control" onChange={(event) => setContent({ ...content, icon: event.target.value as CmsServiceContent["icon"] })} value={content.icon}>
              {["code", "layers", "smartphone", "bot", "cloud", "workflow", "lightbulb"].map((icon) => <option key={icon} value={icon}>{icon}</option>)}
            </select>
          </Field>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button className="button-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save changes"}</button>
            {selected && selected.status === "DRAFT" ? (
              <button className="button-secondary" disabled={busy} onClick={() => void changeStatus("IN_REVIEW")} type="button">Submit for review</button>
            ) : null}
            {selected && selected.status === "IN_REVIEW" && canApprove ? (
              <button className="button-secondary" disabled={busy} onClick={() => void changeStatus("APPROVED")} type="button">Approve</button>
            ) : null}
            {selected && selected.status === "APPROVED" && canPublish ? (
              <button className="button-primary" disabled={busy} onClick={() => void changeStatus("PUBLISHED")} type="button">Publish</button>
            ) : null}
            {selected && selected.status === "PUBLISHED" && canPublish ? (
              <button className="button-secondary" disabled={busy} onClick={() => void changeStatus("DRAFT")} type="button">Unpublish</button>
            ) : null}
            {selected && canDelete ? (
              <button className="button-secondary border-red-200 text-red-700" disabled={busy} onClick={() => void deleteService()} type="button">Delete</button>
            ) : null}
          </div>
        </form>

        {selected?.revisions.length ? (
          <section aria-labelledby="service-revisions-title" className="border-t border-border pt-5">
            <h3 className="font-semibold text-navy-950" id="service-revisions-title">Revision history</h3>
            <ul className="mt-3 divide-y divide-border">
              {selected.revisions.map((revision) => (
                <li className="flex items-center justify-between gap-3 py-3 text-sm" key={revision.id}>
                  <span>
                    Revision {revision.revision} · {statusNames[revision.status] ?? revision.status}
                    <span className="block text-xs text-muted">{new Date(revision.createdAt).toLocaleString()} · {revision.authorName ?? "Former user"}</span>
                  </span>
                  {canRestore ? (
                    <button className="text-sm font-semibold text-blue-700 hover:text-navy-950" disabled={busy} onClick={() => void restoreRevision(revision.id, revision.revision)} type="button">Restore</button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-navy-950">
      {label}
      {children}
    </label>
  );
}

function lines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
