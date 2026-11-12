import Link from "next/link";
import { ServiceManagement, type AdminService } from "@/components/admin/service-management";
import { cmsServiceContentSchema } from "@/lib/validation/cms-service";
import { Prisma } from "@/generated/prisma/client";
import { requireAdminPage } from "@/server/auth/admin-page";
import { prisma } from "@/server/db";

export const metadata = { title: "Services | WEBNEX Admin" };

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const admin = await requireAdminPage("content:read");
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? "";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 2_000)
    : 1;
  const pageSize = 25;
  const where: Prisma.ServiceWhereInput = query
    ? {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
          { summary: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};
  const [records, totalItems] = await prisma.$transaction([
    prisma.service.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        revisions: {
          orderBy: { revision: "desc" },
          take: 20,
          include: { author: { select: { name: true } } },
        },
      },
    }),
    prisma.service.count({ where }),
  ]);
  const totalPages = Math.ceil(totalItems / pageSize);
  const services: AdminService[] = records.map((service) => {
    const parsedContent = cmsServiceContentSchema.safeParse(service.content);
    return {
      id: service.id,
      title: service.title,
      slug: service.slug,
      summary: service.summary,
      content: parsedContent.success
        ? parsedContent.data
        : cmsServiceContentSchema.parse({}),
      status: service.status,
      updatedAt: service.updatedAt.toISOString(),
      revisionCount: service.revisions.length,
      revisions: service.revisions.map((revision) => ({
        id: revision.id,
        revision: revision.revision,
        status: revision.status,
        createdAt: revision.createdAt.toISOString(),
        authorName: revision.author?.name ?? null,
      })),
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-700">Content management</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">Services</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Create drafts, submit them for review, approve and publish. Only published services appear on public service routes.
        </p>
      </header>
      <form className="flex flex-col gap-3 border border-border bg-white p-4 sm:flex-row" method="get">
        <label className="sr-only" htmlFor="service-search">Search services</label>
        <input className="field-control flex-1" defaultValue={query} id="service-search" maxLength={100} name="q" placeholder="Search title, slug, or summary" type="search" />
        <button className="button-primary" type="submit">Search</button>
      </form>
      <p className="text-sm text-muted">{totalItems.toLocaleString("en")} services</p>
      <ServiceManagement
        canApprove={admin.permissions.has("content:approve")}
        canDelete={admin.permissions.has("services:manage")}
        canPublish={admin.permissions.has("content:publish")}
        canRestore={admin.permissions.has("content:restore")}
        services={services}
      />
      {totalPages > 1 ? (
        <nav aria-label="Service pages" className="flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link className="min-h-10 border border-border px-3 py-2" href={pageHref(page - 1, query)}>Previous</Link> : null}
            {page < totalPages ? <Link className="min-h-10 border border-border px-3 py-2" href={pageHref(page + 1, query)}>Next</Link> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function pageHref(page: number, query: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  return `/admin/services?${params}`;
}

