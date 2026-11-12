"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  teamMemberCreateSchema,
  teamMemberUpdateSchema,
  type OtherSocialLink,
} from "@/lib/validation/team-member";
import { TeamProfileCard, type PublicTeamMember } from "@/components/team/team-profile-card";

export type AdminTeamMember = {
  id: string;
  slug: string;
  name: string;
  title: string;
  department: string | null;
  biography: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  otherSocialLinks: OtherSocialLink[];
  status: string;
  isActive: boolean;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  profileImage: { id: string; altText: string } | null;
};

const emptyLinks: OtherSocialLink[] = [];

export function TeamManagement({
  members,
  canCreate,
  canUpdate,
  canApprove,
  canPublish,
  canDelete,
  canManageMedia,
}: {
  members: AdminTeamMember[];
  canCreate: boolean;
  canUpdate: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canDelete: boolean;
  canManageMedia: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = members.find((member) => member.id === selectedId) ?? null;
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [biography, setBiography] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [otherLinksText, setOtherLinksText] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [status, setStatus] = useState("DRAFT");
  const [photoAltText, setPhotoAltText] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  function chooseMember(member: AdminTeamMember | null) {
    setSelectedId(member?.id ?? null);
    setName(member?.name ?? "");
    setTitle(member?.title ?? "");
    setDepartment(member?.department ?? "");
    setBiography(member?.biography ?? "");
    setLinkedinUrl(member?.linkedinUrl ?? "");
    setGithubUrl(member?.githubUrl ?? "");
    setPortfolioUrl(member?.portfolioUrl ?? "");
    setOtherLinksText((member?.otherSocialLinks ?? emptyLinks).map((link) => `${link.label} | ${link.url}`).join("\n"));
    setSortOrder(String(member?.sortOrder ?? 0));
    setIsActive(member?.isActive ?? true);
    setStatus(member?.status ?? "DRAFT");
    setPhotoAltText(member?.profileImage?.altText ?? "");
    setPhotoFile(null);
    setPhotoPreview(null);
    setNotice("");
    setError("");
  }

  const previewMember = useMemo<PublicTeamMember>(() => ({
    slug: selected?.slug ?? (name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team-preview"),
    name: name.trim() || "Team member name",
    title: title.trim() || "Professional title",
    department: department.trim() || null,
    biography: biography.trim() || null,
    profileImageUrl: photoPreview ?? (selected?.profileImage ? `/api/admin/v1/team/media/${selected.profileImage.id}` : null),
    profileImageAlt: photoAltText.trim() || selected?.profileImage?.altText || "",
    linkedinUrl: safePreviewUrl(linkedinUrl),
    githubUrl: safePreviewUrl(githubUrl),
    portfolioUrl: safePreviewUrl(portfolioUrl),
    otherSocialLinks: parseSocialLines(otherLinksText).filter((link) => safePreviewUrl(link.url) !== null),
  }), [selected, name, title, department, biography, photoPreview, photoAltText, linkedinUrl, githubUrl, portfolioUrl, otherLinksText]);

  async function save(nextStatus?: "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "DRAFT" | "ARCHIVED") {
    setBusy(true);
    setNotice("");
    setError("");
    const socialParse = parseSocialLinesWithError(otherLinksText);
    if (!socialParse.success) {
      setError(socialParse.message);
      setBusy(false);
      return;
    }
    const editableBody = {
      name: name.trim(),
      title: title.trim(),
      department: department.trim() || null,
      biography: biography.trim() || null,
      linkedinUrl: linkedinUrl.trim() || null,
      githubUrl: githubUrl.trim() || null,
      portfolioUrl: portfolioUrl.trim() || null,
      otherSocialLinks: socialParse.links,
      sortOrder: sortOrder.trim() === "" ? Number.NaN : Number(sortOrder),
      isActive,
    };
    const body = selectedId && nextStatus && !canUpdate
      ? { status: nextStatus }
      : { ...editableBody, ...(nextStatus ? { status: nextStatus } : {}) };
    const parsed = selectedId
      ? teamMemberUpdateSchema.safeParse(body)
      : teamMemberCreateSchema.safeParse(editableBody);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the team member details.");
      setBusy(false);
      return;
    }

    let id = selectedId;
    try {
      const response = await fetch(
        selectedId ? `/api/admin/v1/team/${selectedId}` : "/api/admin/v1/team",
        {
          method: selectedId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = await response.json() as { data?: { id?: string; status?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "The team member could not be saved.");
      id = selectedId ?? result.data?.id ?? null;
      if (!id) throw new Error("The member was saved but the server did not return its identifier.");
      setSelectedId(id);
      if (nextStatus) setStatus(nextStatus);
      const cleanupPending = photoFile ? await uploadPhoto(id) : false;
      setNotice(cleanupPending
        ? "Profile saved, but the previous photograph still needs storage cleanup."
        : nextStatus
          ? `Team member ${statusLabel(nextStatus).toLowerCase()}.`
          : "Team member details saved.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The team member could not be saved.");
      if (id) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(memberId: string) {
    if (!photoFile) return;
    const formData = new FormData();
    formData.set("photo", photoFile);
    formData.set("altText", photoAltText);
    const response = await fetch(`/api/admin/v1/team/${memberId}/photo`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json() as {
      data?: { oldPhotoCleanupPending?: boolean };
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(`Member details were saved, but the photograph was not: ${result.error?.message ?? "upload failed"}`);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
    return result.data?.oldPhotoCleanupPending ?? false;
  }

  async function removePhoto() {
    if (!selectedId || !selected?.profileImage) return;
    if (!window.confirm(`Remove the profile photograph for ${selected.name}?`)) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/admin/v1/team/${selectedId}/photo`, { method: "DELETE" });
      const result = await response.json() as {
        data?: { storageCleanupPending?: boolean };
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(result.error?.message ?? "The photograph could not be removed.");
      setNotice(result.data?.storageCleanupPending
        ? "Profile photograph removed, but the stored file still needs cleanup."
        : "Profile photograph removed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The photograph could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMember() {
    if (!selectedId || !selected) return;
    if (!window.confirm(`Permanently delete the profile for ${selected.name}?`)) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/admin/v1/team/${selectedId}`, { method: "DELETE" });
      const result = await response.json() as {
        data?: { storageCleanupPending?: boolean };
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(result.error?.message ?? "The team member could not be deleted.");
      chooseMember(null);
      setNotice(result.data?.storageCleanupPending
        ? "Team member deleted, but the stored photograph still needs cleanup."
        : "Team member deleted.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The team member could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setPhotoFile(null);
    setPhotoPreview(null);
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP photograph.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Photographs must be no larger than 5 MB.");
      event.target.value = "";
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  const published = status === "PUBLISHED";
  const canEdit = selectedId
    ? canUpdate && (!published || canPublish)
    : canCreate;

  return (
    <div className="space-y-6">
      <section aria-label="Team member profiles" className="overflow-x-auto border border-border bg-white">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-semibold text-navy-950">Team members</h2>
            <p className="mt-1 text-xs text-muted">{members.length} shown on this page</p>
          </div>
          {canCreate ? (
            <button className="button-secondary" disabled={busy} onClick={() => chooseMember(null)} type="button">
              Add team member
            </button>
          ) : null}
        </div>
        {members.length ? (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-slate-50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => (
                <tr className="align-middle" key={member.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {member.profileImage ? (
                        <Image
                          alt=""
                          className="size-12 object-cover"
                          height={60}
                          src={`/api/admin/v1/team/media/${member.profileImage.id}`}
                          unoptimized
                          width={48}
                        />
                      ) : (
                        <div aria-label="No profile photograph" className="grid size-12 place-items-center border border-border bg-slate-50 text-xs text-muted">—</div>
                      )}
                      <div>
                        <p className="font-medium text-navy-950">{member.name}</p>
                        <p className="mt-1 text-xs text-muted">{member.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{statusLabel(member.status)}</span>
                    {!member.isActive ? <span className="ml-2 text-xs text-amber-800">Inactive</span> : null}
                  </td>
                  <td className="px-4 py-3">{member.sortOrder}</td>
                  <td className="px-4 py-3 text-muted">{new Date(member.createdAt).toLocaleDateString("en-GH")}</td>
                  <td className="px-4 py-3 text-right">
                    {canUpdate || canApprove || canPublish || canDelete || canManageMedia ? (
                      <button className="min-h-10 border border-border px-3 font-medium hover:bg-slate-50" onClick={() => chooseMember(member)} type="button">
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-5 text-sm text-muted">No team members match this view. Add only company-approved profiles.</p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.8fr)]">
        <section aria-labelledby="team-editor-heading" className="space-y-5 border border-border bg-white p-5 sm:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              {selected ? statusLabel(status) : "New draft"}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-navy-950" id="team-editor-heading">
              {selected ? `Edit ${selected.name}` : "Team member details"}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <input autoComplete="name" className="field-control" disabled={!canEdit || busy} maxLength={120} onChange={(event) => setName(event.target.value)} required value={name} />
            </Field>
            <Field label="Job title" required>
              <input className="field-control" disabled={!canEdit || busy} maxLength={120} onChange={(event) => setTitle(event.target.value)} required value={title} />
            </Field>
            <Field label="Department or specialization">
              <input className="field-control" disabled={!canEdit || busy} maxLength={120} onChange={(event) => setDepartment(event.target.value)} value={department} />
            </Field>
            <Field label="Display order">
              <input className="field-control" disabled={!canEdit || busy} max={100000} min={0} onChange={(event) => setSortOrder(event.target.value)} type="number" value={sortOrder} />
            </Field>
            <Field label="LinkedIn URL">
              <input autoComplete="url" className="field-control" disabled={!canEdit || busy} maxLength={2048} onChange={(event) => setLinkedinUrl(event.target.value)} placeholder="https://www.linkedin.com/in/..." type="url" value={linkedinUrl} />
            </Field>
            <Field label="GitHub URL">
              <input className="field-control" disabled={!canEdit || busy} maxLength={2048} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/..." type="url" value={githubUrl} />
            </Field>
            <Field label="Portfolio URL">
              <input className="field-control" disabled={!canEdit || busy} maxLength={2048} onChange={(event) => setPortfolioUrl(event.target.value)} placeholder="https://..." type="url" value={portfolioUrl} />
            </Field>
            <Field label="Other professional links" hint="One per line: label | https://example.com">
              <textarea className="field-control min-h-24" disabled={!canEdit || busy} maxLength={5000} onChange={(event) => setOtherLinksText(event.target.value)} value={otherLinksText} />
            </Field>
          </div>
          <Field label="Professional biography" hint="Maximum 1,600 characters; use company-approved information.">
            <textarea className="field-control min-h-32" disabled={!canEdit || busy} maxLength={1600} onChange={(event) => setBiography(event.target.value)} value={biography} />
          </Field>
          <label className="flex min-h-11 items-center gap-3 text-sm text-navy-950">
            <input checked={isActive} disabled={!canEdit || busy} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />
            Active profile
          </label>

          <div className="border-t border-border pt-5">
            <h3 className="font-semibold text-navy-950">Profile photograph</h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              JPG, PNG or WebP up to 5 MB. Images are validated and converted to optimized 4:5 WebP. Persistent private object storage must be configured.
            </p>
            {canManageMedia ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-[128px_minmax(0,1fr)]">
                <div className="relative aspect-[4/5] w-32 overflow-hidden border border-border bg-slate-100">
                  {photoPreview ? (
                    <Image alt={photoAltText || "Selected profile photograph preview"} className="object-cover" fill src={photoPreview} unoptimized />
                  ) : selected?.profileImage ? (
                    <Image alt={selected.profileImage.altText || `Portrait of ${selected.name}`} className="object-cover" fill src={`/api/admin/v1/team/media/${selected.profileImage.id}`} unoptimized />
                  ) : (
                    <div className="grid size-full place-items-center px-2 text-center text-xs text-muted">No photograph</div>
                  )}
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-navy-950">
                    Choose or replace photograph
                    <input accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="mt-2 block w-full text-sm text-muted file:mr-3 file:min-h-10 file:border-0 file:bg-blue-50 file:px-3 file:font-semibold file:text-blue-900" disabled={!selectedId || busy || (selected?.status === "PUBLISHED" && !canPublish)} onChange={onPhotoChange} type="file" />
                  </label>
                  {!selectedId ? <p className="text-xs text-muted">Save the member profile before uploading a photo.</p> : null}
                  <Field label="Photograph alternative text">
                    <input className="field-control" disabled={!canEdit || busy} maxLength={250} onChange={(event) => setPhotoAltText(event.target.value)} placeholder={name ? `Portrait of ${name}` : "Describe this photograph"} value={photoAltText} />
                  </Field>
                  {selected?.profileImage && !photoFile ? (
                    <button className="min-h-10 border border-red-200 px-3 text-sm font-medium text-red-800 hover:bg-red-50" disabled={busy || (selected.status === "PUBLISHED" && !canPublish)} onClick={removePhoto} type="button">
                      Remove photograph
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-4 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                You do not have permission to manage profile photographs.
              </p>
            )}
          </div>

          {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
          {notice ? <p className="text-sm text-emerald-800" role="status">{notice}</p> : null}
          {photoFile && !canManageMedia ? <p className="text-sm text-red-800">Photograph permission is required to upload this file.</p> : null}
          <div className="flex flex-wrap gap-2 border-t border-border pt-5">
            {canEdit ? (
              <button className="button-primary" disabled={busy} onClick={() => void save()} type="button">
                {busy ? "Saving…" : "Save changes"}
              </button>
            ) : null}
            {selectedId && status === "DRAFT" && canUpdate ? (
              <button className="button-secondary" disabled={busy} onClick={() => void save("IN_REVIEW")} type="button">Submit for review</button>
            ) : null}
            {selectedId && status === "IN_REVIEW" && canApprove ? (
              <button className="button-secondary" disabled={busy} onClick={() => void save("APPROVED")} type="button">Approve profile</button>
            ) : null}
            {selectedId && status === "APPROVED" && canPublish ? (
              <button className="button-secondary" disabled={busy} onClick={() => void save("PUBLISHED")} type="button">Publish profile</button>
            ) : null}
            {selectedId && published && canPublish ? (
              <button className="button-secondary" disabled={busy} onClick={() => void save("DRAFT")} type="button">Unpublish profile</button>
            ) : null}
            {selectedId && canPublish && status !== "ARCHIVED" ? (
              <button className="min-h-11 border border-border px-4 text-sm font-medium text-muted hover:bg-slate-50" disabled={busy} onClick={() => void save("ARCHIVED")} type="button">Archive</button>
            ) : null}
            {selectedId && canDelete ? (
              <button className="min-h-11 border border-red-200 px-4 text-sm font-medium text-red-800 hover:bg-red-50" disabled={busy} onClick={deleteMember} type="button">Delete</button>
            ) : null}
          </div>
        </section>

        <aside aria-label="Profile preview">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Card preview</h2>
          <TeamProfileCard member={previewMember} />
          <p className="mt-3 text-xs leading-5 text-muted">
            Preview uses your current form values. Public visibility still requires approval, publication, and an active profile.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-navy-950">
      <span>{label}{required ? <span aria-hidden="true"> *</span> : null}</span>
      {children}
      {hint ? <span className="block text-xs font-normal leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}

function parseSocialLines(value: string) {
  return value.split(/\r?\n/).map((line) => {
    const separator = line.indexOf("|");
    if (separator < 0) return null;
    const label = line.slice(0, separator).trim();
    const url = line.slice(separator + 1).trim();
    return label && url ? { label, url } : null;
  }).filter((link): link is OtherSocialLink => link !== null);
}

function parseSocialLinesWithError(value: string) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const links: OtherSocialLink[] = [];
  for (const line of lines) {
    const separator = line.indexOf("|");
    if (separator < 1 || !line.slice(separator + 1).trim()) {
      return { success: false as const, links, message: "Other social links must use one “label | URL” entry per line." };
    }
    links.push({
      label: line.slice(0, separator).trim(),
      url: line.slice(separator + 1).trim(),
    });
  }
  return { success: true as const, links };
}

function safePreviewUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}
