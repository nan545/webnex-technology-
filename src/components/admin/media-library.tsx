"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/api/error-message";

type MediaAsset = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  width: number | null;
  height: number | null;
  altText: string;
  caption: string | null;
  createdAt: string;
  usageCount: number;
};

type MediaResponse = {
  assets: MediaAsset[];
  page: number;
  pageSize: number;
  total: number;
};

export function MediaLibrary() {
  const router = useRouter();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selected = assets.find((asset) => asset.id === selectedId) ?? null;

  useEffect(() => {
    void load();
  }, [page]);

  async function load(nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "24" });
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      const response = await fetch(`/api/admin/v1/media?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { data: MediaResponse };
      setAssets(result.data.assets);
      setTotal(result.data.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The media library could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function searchMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    if (page === 1) await load(search);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose an image to upload.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("image", file);
      form.set("altText", altText);
      form.set("caption", caption);
      const response = await fetch("/api/admin/v1/media", { method: "POST", body: form });
      if (!response.ok) throw new Error(await errorMessage(response));
      setFile(null);
      setAltText("");
      setCaption("");
      event.currentTarget.reset();
      setMessage("Image uploaded.");
      setPage(1);
      await load(search);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMetadata() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/v1/media/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText: selected.altText, caption: selected.caption }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setMessage("Media metadata saved.");
      await load(search);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The metadata could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(asset: MediaAsset) {
    if (asset.usageCount > 0) {
      setError("This asset is in use and cannot be deleted.");
      return;
    }
    if (!window.confirm(`Delete ${asset.originalName}?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/v1/media/${asset.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await errorMessage(response));
      setSelectedId(null);
      setMessage("Media asset deleted.");
      await load(search);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The media asset could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl(asset: MediaAsset) {
    const url = `${window.location.origin}/api/admin/v1/media/${asset.id}`;
    await navigator.clipboard.writeText(url);
    setMessage("Preview URL copied.");
  }

  function updateSelected(updates: Partial<MediaAsset>) {
    setAssets((current) =>
      current.map((asset) => asset.id === selectedId ? { ...asset, ...updates } : asset),
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-6">
        <form className="space-y-4 border border-border bg-white p-5" onSubmit={upload}>
          <h2 className="font-semibold">Upload image</h2>
          <p className="text-sm text-muted">JPG, PNG or WebP, up to 5 MB.</p>
          <label className="block">
            <span className="field-label">Image</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
              type="file"
            />
          </label>
          <label className="block">
            <span className="field-label">Alternative text</span>
            <input className="field-control" maxLength={250} onChange={(event) => setAltText(event.target.value)} value={altText} />
          </label>
          <label className="block">
            <span className="field-label">Caption</span>
            <textarea className="field-control" maxLength={500} onChange={(event) => setCaption(event.target.value)} value={caption} />
          </label>
          <button className="button-primary" disabled={busy} type="submit">{busy ? "Uploading…" : "Upload"}</button>
        </form>
      </aside>

      <section className="min-w-0 space-y-4">
        <form className="flex gap-3" onSubmit={searchMedia}>
          <label className="sr-only" htmlFor="media-search">Search media</label>
          <input id="media-search" className="field-control" onChange={(event) => setSearch(event.target.value)} placeholder="Search file name, text or caption" value={search} />
          <button className="button-secondary" type="submit">Search</button>
        </form>

        {loading ? <p className="text-sm text-muted">Loading media…</p> : null}
        {!loading && assets.length === 0 ? <div className="border border-border bg-white p-8 text-center text-sm text-muted">No media assets found.</div> : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <article className={`border bg-white ${selectedId === asset.id ? "border-blue-700" : "border-border"}`} key={asset.id}>
              <button
                aria-label={`View ${asset.originalName}`}
                className="block h-44 w-full overflow-hidden border-b border-border bg-slate-100"
                onClick={() => setSelectedId(asset.id)}
                type="button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={asset.altText} className="h-full w-full object-contain" src={`/api/admin/v1/media/${asset.id}`} />
              </button>
              <div className="space-y-2 p-4">
                <p className="truncate text-sm font-semibold" title={asset.originalName}>{asset.originalName}</p>
                <p className="text-xs text-muted">{asset.width} × {asset.height} · {formatBytes(asset.sizeBytes)} · {asset.usageCount ? `${asset.usageCount} reference${asset.usageCount === 1 ? "" : "s"}` : "Unused"}</p>
                <div className="flex flex-wrap gap-2">
                  <button className="button-secondary" onClick={() => copyUrl(asset)} type="button">Copy URL</button>
                  <button className="button-secondary" disabled={busy || asset.usageCount > 0} onClick={() => void remove(asset)} type="button">Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {selected ? (
          <section className="space-y-4 border border-border bg-white p-5">
            <h2 className="font-semibold">Edit metadata</h2>
            <label className="block">
              <span className="field-label">Alternative text</span>
              <input className="field-control" maxLength={250} onChange={(event) => updateSelected({ altText: event.target.value })} value={selected.altText} />
            </label>
            <label className="block">
              <span className="field-label">Caption</span>
              <textarea className="field-control" maxLength={500} onChange={(event) => updateSelected({ caption: event.target.value })} value={selected.caption ?? ""} />
            </label>
            <div className="flex gap-3">
              <button className="button-primary" disabled={busy} onClick={() => void saveMetadata()} type="button">{busy ? "Saving…" : "Save metadata"}</button>
              <button className="button-secondary" onClick={() => setSelectedId(null)} type="button">Close</button>
            </div>
          </section>
        ) : null}

        {total > 24 ? (
          <div className="flex items-center justify-between">
            <button className="button-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
            <span className="text-sm text-muted">Page {page}</span>
            <button className="button-secondary" disabled={page * 24 >= total} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
          </div>
        ) : null}

        <div aria-live="polite">
          {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
          {message ? <p className="text-sm text-green-800" role="status">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}
