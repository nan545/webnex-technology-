"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/api/error-message";
import type { PublicationInput, PublicationKind } from "@/lib/validation/publication";

export type AdminPublication = PublicationInput & {
  id: string;
  coverImageId: string | null;
  updatedAt: string;
};

const empty: PublicationInput = {
  title: "", slug: "", summary: "",
  content: { body: "", category: "", technologies: "" },
  status: "DRAFT",
};

export function PublicationManagement({ kind, records, canPublish }: {
  kind: PublicationKind;
  records: AdminPublication[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState<PublicationInput>(empty);
  const [image, setImage] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const label = kind === "projects" ? "project" : "insight";

  function edit(record: AdminPublication) {
    setId(record.id);
    setForm({ title: record.title, slug: record.slug, summary: record.summary, content: record.content, status: record.status });
    setImage(null);
    setAltText("");
    setMessage("");
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/v1/publications/${kind}${id ? `/${id}` : ""}`, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result: { data: { id: string } } = await response.json();
      setId(result.data.id);
      setMessage(`${label === "project" ? "Project" : "Insight"} saved. You can now upload its image.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The content could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !image) return;
    const uploadForm = event.currentTarget;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = new FormData();
      data.set("image", image);
      data.set("altText", altText);
      const response = await fetch(`/api/admin/v1/publications/${kind}/${id}/image`, { method: "POST", body: data });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result: { data: { cleanupPending: boolean } } = await response.json();
      setImage(null);
      setAltText("");
      uploadForm.reset();
      setMessage(result.data.cleanupPending ? "Image uploaded, but the previous image could not be removed from storage." : "Image uploaded.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="border border-border bg-white p-5">
        <h2 className="font-semibold">Existing {kind}</h2>
        {records.length ? <ul className="mt-4 divide-y divide-border">
          {records.map((record) => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={record.id}>
            <span>{record.title} <span className="text-sm text-muted">· {record.status}</span></span>
            <button className="button-secondary" disabled={busy} onClick={() => edit(record)} type="button">Edit {record.title}</button>
          </li>)}
        </ul> : <p className="mt-3 text-sm text-muted">No {kind} yet.</p>}
      </section>
      <form className="space-y-4 border border-border bg-white p-5 sm:p-7" onSubmit={save}>
        <h2 className="font-semibold">{id ? `Edit ${label}` : `Create ${label}`}</h2>
        <label className="block"><span className="field-label">Title</span><input className="field-control" maxLength={120} minLength={2} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></label>
        <label className="block"><span className="field-label">URL slug</span><input className="field-control" maxLength={120} minLength={2} onChange={(event) => setForm({ ...form, slug: event.target.value })} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required value={form.slug} /><span className="text-xs text-muted">Lowercase letters, numbers and hyphens only.</span></label>
        <label className="block"><span className="field-label">Summary</span><textarea className="field-control" maxLength={500} onChange={(event) => setForm({ ...form, summary: event.target.value })} required value={form.summary} /></label>
        <label className="block"><span className="field-label">{kind === "projects" ? "Industry" : "Category"}</span><input className="field-control" maxLength={100} onChange={(event) => setForm({ ...form, content: { ...form.content, category: event.target.value } })} required value={form.content.category} /></label>
        {kind === "projects" ? <label className="block"><span className="field-label">Technologies (comma separated)</span><input className="field-control" maxLength={500} onChange={(event) => setForm({ ...form, content: { ...form.content, technologies: event.target.value } })} value={form.content.technologies} /></label> : null}
        <label className="block"><span className="field-label">Content</span><textarea className="field-control min-h-48" maxLength={20000} onChange={(event) => setForm({ ...form, content: { ...form.content, body: event.target.value } })} required value={form.content.body} /><span className="text-xs text-muted">Separate paragraphs with a blank line.</span></label>
        <label className="block"><span className="field-label">Status</span><select className="field-control" onChange={(event) => setForm({ ...form, status: event.target.value === "PUBLISHED" ? "PUBLISHED" : "DRAFT" })} value={form.status}><option value="DRAFT">Draft</option>{canPublish ? <option value="PUBLISHED">Published</option> : null}</select></label>
        <p className="text-xs text-muted">Published changes appear on the website after saving. Only publish approved material.</p>
        <div className="flex gap-3"><button className="button-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save"}</button><button className="button-secondary" disabled={busy} onClick={() => { setId(null); setForm(empty); setError(""); setMessage(""); }} type="button">New {label}</button></div>
      </form>
      {id ? <form className="space-y-4 border border-border bg-white p-5" onSubmit={upload}>
        <h2 className="font-semibold">Cover image</h2>
        <p className="text-sm text-muted">JPG, PNG or WebP, up to 5 MB. Saving an image replaces the previous cover.</p>
        <label className="block"><span className="field-label">Image</span><input accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)} required type="file" /></label>
        <label className="block"><span className="field-label">Image description</span><input className="field-control" maxLength={250} onChange={(event) => setAltText(event.target.value)} required value={altText} /></label>
        <button className="button-secondary" disabled={busy} type="submit">Upload image</button>
      </form> : null}
      <div aria-live="polite">{error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}{message ? <p className="text-sm text-green-800" role="status">{message}</p> : null}</div>
    </div>
  );
}
