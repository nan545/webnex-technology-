import Link from "next/link";
import { FollowUpTaskList, type FollowUpTaskItem } from "@/components/admin/follow-up-task-list";
import { requireAdminPage } from "@/server/auth/admin-page";
import { prisma } from "@/server/db";

export const metadata = { title: "Follow-ups | WEBNEX Admin" };

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; page?: string }>;
}) {
  const admin = await requireAdminPage("enquiries:read");
  const params = await searchParams;
  const state = ["open", "completed", "overdue"].includes(params.state ?? "")
    ? params.state!
    : "open";
  const parsedPage = Number(params.page ?? "1");
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 2_000) : 1;
  const pageSize = 30;
  const now = new Date();
  const where = state === "completed"
    ? { completedAt: { not: null } }
    : state === "overdue"
      ? { completedAt: null, dueAt: { lt: now } }
      : { completedAt: null };
  const [records, totalItems] = await prisma.$transaction([
    prisma.followUpTask.findMany({
      where,
      orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        completedAt: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        enquiry: { select: { id: true, reference: true, name: true, status: true } },
      },
    }),
    prisma.followUpTask.count({ where }),
  ]);
  const tasks: FollowUpTaskItem[] = records.map((task) => ({
    ...task,
    dueAt: task.dueAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
  }));
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-700">Business development</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">Follow-up tasks</h1>
        <p className="mt-2 text-sm text-muted">{totalItems.toLocaleString("en")} {state} tasks</p>
      </header>
      <nav aria-label="Follow-up status" className="flex flex-wrap gap-2">
        {(["open", "overdue", "completed"] as const).map((value) => (
          <Link
            aria-current={value === state ? "page" : undefined}
            className="min-h-10 border border-border bg-white px-4 py-2 text-sm font-medium hover:border-blue-700 aria-[current=page]:border-blue-700 aria-[current=page]:text-blue-700"
            href={`/admin/follow-ups?state=${value}`}
            key={value}
          >
            {value[0]!.toUpperCase()}{value.slice(1)}
          </Link>
        ))}
      </nav>
      <FollowUpTaskList canUpdate={admin.permissions.has("enquiries:update")} tasks={tasks} />
      {totalPages > 1 ? (
        <nav aria-label="Follow-up pages" className="flex justify-between text-sm">
          <span className="text-muted">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link className="border border-border px-3 py-2" href={pageHref(page - 1, state)}>Previous</Link> : null}
            {page < totalPages ? <Link className="border border-border px-3 py-2" href={pageHref(page + 1, state)}>Next</Link> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function pageHref(page: number, state: string) {
  return `/admin/follow-ups?${new URLSearchParams({ page: String(page), state })}`;
}
