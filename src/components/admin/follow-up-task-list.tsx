"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type FollowUpTaskItem = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string;
  completedAt: string | null;
  assignedTo: { id: string; name: string | null; email: string } | null;
  enquiry: { id: string; reference: string; name: string; status: string };
};

export function FollowUpTaskList({
  tasks,
  canUpdate,
}: {
  tasks: FollowUpTaskItem[];
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function complete(task: FollowUpTaskItem) {
    setBusyId(task.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/v1/follow-ups/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completedAt }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Could not update follow-up.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update follow-up.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section>
      {error ? <p aria-live="assertive" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {tasks.length ? (
        <ul className="divide-y divide-border border border-border bg-white">
          {tasks.map((task) => {
            const overdue = !task.completedAt && new Date(task.dueAt) < new Date();
            return (
              <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5" key={task.id}>
                <div>
                  <p className="font-semibold text-navy-950">{task.title}</p>
                  {task.description ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{task.description}</p> : null}
                  <p className={`mt-2 text-xs ${overdue ? "font-semibold text-red-700" : "text-muted"}`}>
                    {overdue ? "Overdue · " : task.completedAt ? "Completed · " : "Due · "}
                    {new Date(task.completedAt ?? task.dueAt).toLocaleString("en-GH")}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Assigned to {task.assignedTo?.name ?? task.assignedTo?.email ?? "Unassigned"} ·{" "}
                    <Link className="font-medium text-blue-700 hover:text-navy-950" href={`/admin/enquiries/${task.enquiry.id}`}>
                      {task.enquiry.reference} · {task.enquiry.name}
                    </Link>
                  </p>
                </div>
                {canUpdate ? (
                  <button className="button-secondary shrink-0" disabled={busyId === task.id} onClick={() => void complete(task)} type="button">
                    {busyId === task.id ? "Saving…" : task.completedAt ? "Reopen" : "Mark complete"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="border border-dashed border-border bg-white px-6 py-12 text-center text-sm text-muted">
          No follow-up tasks match this view.
        </p>
      )}
    </section>
  );
}
