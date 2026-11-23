import Link from "next/link";
import { ContentStatus, Prisma } from "@/generated/prisma/client";
import { TeamManagement, type AdminTeamMember } from "@/components/admin/team-management";
import { otherSocialLinkSchema } from "@/lib/validation/team-member";
import { requireAdminPage } from "@/server/auth/admin-page";
import { prisma } from "@/server/db";

export const metadata = { title: "Team Members | WEBNEX Admin" };

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const admin = await requireAdminPage("team:view");
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? "";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 2_000)
    : 1;
  const status = Object.values(ContentStatus).includes(params.status as ContentStatus)
    ? params.status as ContentStatus
    : undefined;
  const pageSize = 25;
  const where: Prisma.TeamMemberWhereInput = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { department: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
  };
  const [records, totalItems] = await Promise.all([
    prisma.teamMember.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        name: true,
        title: true,
        department: true,
        biography: true,
        linkedinUrl: true,
        githubUrl: true,
        portfolioUrl: true,
        otherSocialLinks: true,
        status: true,
        isActive: true,
        sortOrder: true,
        publishedAt: true,
        createdAt: true,
        profileImage: { select: { id: true, altText: true } },
      },
    }),
    prisma.teamMember.count({ where }),
  ]);
  const members: AdminTeamMember[] = records.map((member) => {
    const links = otherSocialLinkSchema.array().safeParse(member.otherSocialLinks);
    if (!links.success && member.otherSocialLinks !== null) {
      console.error("Team member has invalid social links in PostgreSQL", {
        teamMemberId: member.id,
      });
      throw new Error("A team member has invalid social link data. Review the server log before editing profiles.");
    }
    return {
      ...member,
      otherSocialLinks: links.data ?? [],
      createdAt: member.createdAt.toISOString(),
      publishedAt: member.publishedAt?.toISOString() ?? null,
    };
  });
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-700">Content management</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">Team Members</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Create profiles from company-approved information. Only active, published profiles appear publicly.
        </p>
      </header>
      <form className="flex flex-col gap-3 border border-border bg-white p-4 sm:flex-row" method="get">
        <label className="sr-only" htmlFor="team-search">Search team members</label>
        <input className="field-control flex-1" defaultValue={query} id="team-search" maxLength={100} name="q" placeholder="Search name, title, or department" type="search" />
        <label className="sr-only" htmlFor="team-status">Filter by publication status</label>
        <select className="field-control sm:w-48" defaultValue={status ?? ""} id="team-status" name="status">
          <option value="">All statuses</option>
          {Object.values(ContentStatus).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
        </select>
        <button className="button-primary" type="submit">Filter</button>
      </form>
      <p className="text-sm text-muted">{totalItems.toLocaleString("en")} team profiles</p>
      <TeamManagement
        canApprove={admin.permissions.has("content:approve")}
        canCreate={admin.permissions.has("team:create")}
        canDelete={admin.permissions.has("team:delete")}
        canManageMedia={admin.permissions.has("team:manage_media")}
        canPublish={admin.permissions.has("team:publish")}
        canUpdate={admin.permissions.has("team:update")}
        members={members}
      />
      {totalPages > 1 ? (
        <nav aria-label="Team member pages" className="flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link className="min-h-10 border border-border px-3 py-2" href={pageHref(page - 1, query, status)}>Previous</Link> : null}
            {page < totalPages ? <Link className="min-h-10 border border-border px-3 py-2" href={pageHref(page + 1, query, status)}>Next</Link> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function pageHref(page: number, query: string, status?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  return `/admin/team?${params}`;
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export const dynamic = "force-dynamic";
