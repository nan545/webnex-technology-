"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/api/error-message";
import type { WorkProjectInput } from "@/lib/validation/work-project";

type Project = {
  id: string;
  title: string;
  description: string;
  status: string;
  assignments?: {
    userId?: string;
    user?: { name: string | null; email: string; isActive: boolean };
    notification?: { status: string; lastError: string | null } | null;
    acceptedAt?: string | Date | null;
    declinedAt?: string | Date | null;
  }[];
};
type User = { id: string; name: string | null; email: string };
const empty: WorkProjectInput = { title: "", description: "", status: "NOT_STARTED", assigneeIds: [] };
const statuses = [
  ["NOT_STARTED", "Not started"],
  ["IN_PROGRESS", "In progress"],
  ["ON_HOLD", "On hold"],
  ["COMPLETED", "Completed"],
] as const;

export function WorkProjectManagement({ projects, users, canManage }: {
  projects: Project[];
  users: User[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkProjectInput>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function edit(project: Project) {
    const status = statuses.find(([value]) => value === project.status)?.[0];
    if (!status) {
      setError("This project has an unsupported status and cannot be edited.");
      return;
    }
    setId(project.id);
    setForm({
      title: project.title,
      description: project.description,
      status,
      assigneeIds: project.assignments
        ?.map((item) => item.userId)
        .filter((userId): userId is string => Boolean(userId)) ?? [],
    });
    setError("");
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/v1/work-projects${id ? `/${id}` : ""}`, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result: { data: { id: string; queued: number } } = await response.json();
      setId(result.data.id);
      setMessage(result.data.queued
        ? `Project saved. ${result.data.queued} assignment email(s) queued; delivery requires the configured email dispatcher.`
        : "Project saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The work project could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge(projectId: string, decision: "ACCEPTED" | "DECLINED") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/v1/work-projects/${projectId}/assignment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setMessage(decision === "ACCEPTED"
        ? "Assignment accepted."
        : "Assignment declined.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The assignment could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-6">
    <header>
      <p className="text-sm font-semibold text-blue-700">Private workspace</p>
      <h1 className="mt-1 text-2xl font-semibold">Work projects</h1>
      <p className="mt-2 text-sm text-muted">{canManage ? "Manage internal projects and assign active login accounts. These projects are not public portfolio entries." : "Only projects assigned to your account are shown. Contact a manager for changes."}</p>
    </header>
    <section className="space-y-4" aria-label="Work projects">
      {projects.length ? projects.map((project) => <article className="border border-border bg-white p-5" key={project.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-semibold">{project.title}</h2><p className="mt-1 text-sm text-muted">{statuses.find(([value]) => value === project.status)?.[1] ?? project.status}</p></div>
          {canManage ? <button className="button-secondary" disabled={busy} onClick={() => edit(project)} type="button">Edit {project.title}</button> : null}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm">{project.description}</p>
        {!canManage ? <div className="mt-4 border-t border-border pt-4">
          {project.assignments?.[0]?.acceptedAt ? (
            <p className="text-sm text-green-800">Assignment accepted.</p>
          ) : project.assignments?.[0]?.declinedAt ? (
            <p className="text-sm text-amber-800">Assignment declined. Contact the project manager if this is incorrect.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">Do you accept responsibility for this work project?</p>
              <div className="flex flex-wrap gap-3">
                <button className="button-primary" disabled={busy} onClick={() => void acknowledge(project.id, "ACCEPTED")} type="button">Accept assignment</button>
                <button className="button-secondary" disabled={busy} onClick={() => void acknowledge(project.id, "DECLINED")} type="button">Decline assignment</button>
              </div>
            </div>
          )}
        </div> : null}
        {canManage ? <div className="mt-4 text-sm">
          <p className="font-medium">Assigned accounts</p>
          {project.assignments?.length ? <ul className="mt-2 space-y-1">
            {project.assignments.map((assignment) => <li key={assignment.userId ?? assignment.user?.email ?? "unknown"}>
              {assignment.user?.name || assignment.user?.email || "Unknown account"}
              {assignment.user?.email ? ` (${assignment.user.email})` : ""}
              {assignment.user && !assignment.user.isActive ? " — inactive" : ""}
              {" "}· Assignment: {assignment.acceptedAt ? "accepted" : assignment.declinedAt ? "declined" : "pending"}
              {" "}· Email: {assignment.notification?.status === "SENT" ? "accepted by provider" : assignment.notification?.status.toLowerCase() ?? "not queued"}
              {assignment.notification?.lastError ? ` — ${assignment.notification.lastError}` : ""}
            </li>)}
          </ul> : <p className="mt-1 text-muted">No one assigned.</p>}
        </div> : null}
      </article>) : <p className="border border-border bg-white p-5 text-sm text-muted">No work projects {canManage ? "have been created" : "are assigned to you"}.</p>}
    </section>
    {canManage ? <form className="space-y-4 border border-border bg-white p-5 sm:p-7" onSubmit={save}>
      <h2 className="font-semibold">{id ? "Edit work project" : "Create work project"}</h2>
      <label className="block"><span className="field-label">Project title</span><input className="field-control" required minLength={2} maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label className="block"><span className="field-label">Work description</span><textarea className="field-control min-h-32" required maxLength={10000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <label className="block"><span className="field-label">Status</span><select className="field-control" value={form.status} onChange={(event) => {
        const status = statuses.find(([value]) => value === event.target.value)?.[0];
        if (status) setForm({ ...form, status });
      }}>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <fieldset><legend className="field-label">Assign team accounts</legend>
        <p className="mb-2 text-xs text-muted">Team members must have an active administrator login. Profile entries alone cannot sign in.</p>
        {users.length ? <div className="max-h-64 space-y-2 overflow-auto">{users.map((user) => <label className="flex items-center gap-2 text-sm" key={user.id}>
          <input type="checkbox" checked={form.assigneeIds.includes(user.id)} onChange={(event) => setForm({ ...form, assigneeIds: event.target.checked ? [...form.assigneeIds, user.id] : form.assigneeIds.filter((value) => value !== user.id) })} />
          {user.name || user.email} ({user.email})
        </label>)}</div> : <p className="text-sm text-muted">No eligible active accounts.</p>}
        {form.assigneeIds.filter((userId) => !users.some((user) => user.id === userId)).map((userId) => <label className="mt-2 flex items-center gap-2 text-sm" key={userId}>
          <input type="checkbox" checked onChange={() => setForm({ ...form, assigneeIds: form.assigneeIds.filter((value) => value !== userId) })} />
          Inactive or ineligible account — uncheck before saving.
        </label>)}
      </fieldset>
      <div className="flex flex-wrap gap-3"><button className="button-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save project"}</button><button className="button-secondary" disabled={busy} type="button" onClick={() => { setId(null); setForm(empty); setError(""); setMessage(""); }}>New project</button></div>
    </form> : null}
    <div aria-live="polite">{error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}{message ? <p className="text-sm text-green-800" role="status">{message}</p> : null}</div>
  </div>;
}
