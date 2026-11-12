import Link from "next/link";
import { EnquiryStatus } from "@/generated/prisma/client";
import { requireAdminPage } from "@/server/auth/admin-page";
import { prisma } from "@/server/db";

type SearchParams = Record<string, string | string[] | undefined>;

const pageSize = 20;

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage("enquiries:read");
  const params = await searchParams;
  const query = single(params.q)?.trim().slice(0, 100) ?? "";
  const statusValue = single(params.status);
  const service = single(params.service)?.slice(0, 120);
  const assignedToValue = single(params.assignedTo);
  const fromValue = single(params.from);
  const toValue = single(params.to);
  const status = Object.values(EnquiryStatus).includes(statusValue as EnquiryStatus)
    ? (statusValue as EnquiryStatus)
    : undefined;
  const fromDate = fromValue ? new Date(fromValue) : undefined;
  const toDate = toValue && /^\d{4}-\d{2}-\d{2}$/.test(toValue)
    ? new Date(`${toValue}T23:59:59.999Z`)
    : toValue
      ? new Date(Number.NaN)
      : undefined;
  const validAssignee = assignedToValue && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assignedToValue)
    ? assignedToValue
    : undefined;
  const dateRangeValid =
    (!fromDate || Number.isFinite(fromDate.getTime())) &&
    (!toDate || Number.isFinite(toDate.getTime())) &&
    (!fromDate || !toDate || fromDate <= toDate);
  const pageNumber = Number(single(params.page) ?? "1");
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 ? Math.min(pageNumber, 5_000) : 1;
  const where = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
            { organization: { contains: query, mode: "insensitive" as const } },
            { reference: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(service ? { service } : {}),
    ...(assignedToValue === "unassigned"
      ? { assignedToId: null }
      : validAssignee
        ? { assignedToId: validAssignee }
        : {}),
    ...(dateRangeValid && (fromDate || toDate)
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  const [enquiries, totalItems, services, assignees] = await prisma.$transaction([
    prisma.enquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        reference: true,
        name: true,
        email: true,
        phone: true,
        organization: true,
        service: true,
        budget: true,
        status: true,
        createdAt: true,
        assignedTo: { select: { name: true, email: true } },
      },
    }),
    prisma.enquiry.count({ where }),
    prisma.enquiry.findMany({
      distinct: ["service"],
      orderBy: { service: "asc" },
      select: { service: true },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        roles: {
          some: {
            role: {
              permissions: {
                some: { permission: { key: "enquiries:update" } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-semibold text-blue-700">Business inquiries</p>
        <h1 className="mt-1 text-2xl font-semibold">Enquiries</h1>
        <p className="mt-2 text-sm text-muted">{totalItems.toLocaleString("en")} records</p>
      </div>

      <form className="grid gap-3 border border-border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4" method="get">
        <label className="sr-only" htmlFor="enquiry-search">Search enquiries</label>
        <input
          className="field-control"
          defaultValue={query}
          id="enquiry-search"
          maxLength={100}
          name="q"
          placeholder="Name, email, company, reference"
          type="search"
        />
        <label className="sr-only" htmlFor="enquiry-status">Filter by status</label>
        <select className="field-control" defaultValue={status ?? ""} id="enquiry-status" name="status">
          <option value="">All statuses</option>
          {Object.values(EnquiryStatus).map((value) => (
            <option key={value} value={value}>{formatStatus(value)}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="enquiry-service">Filter by service</label>
        <select className="field-control" defaultValue={service ?? ""} id="enquiry-service" name="service">
          <option value="">All services</option>
          {services.map(({ service: value }) => <option key={value} value={value}>{value}</option>)}
        </select>
        <label className="sr-only" htmlFor="enquiry-assignee">Filter by assignee</label>
        <select className="field-control" defaultValue={validAssignee ?? ""} id="enquiry-assignee" name="assignedTo">
          <option value="">All administrators</option>
          <option value="unassigned">Unassigned</option>
          {assignees.map((user) => <option key={user.id} value={user.id}>{user.name ?? user.email}</option>)}
        </select>
        <div>
          <label className="field-label" htmlFor="enquiry-date-from">From</label>
          <input className="field-control" defaultValue={fromValue ?? ""} id="enquiry-date-from" name="from" type="date" />
        </div>
        <div>
          <label className="field-label" htmlFor="enquiry-date-to">To</label>
          <input className="field-control" defaultValue={toValue ?? ""} id="enquiry-date-to" name="to" type="date" />
        </div>
        <div className="flex items-end gap-3">
          <button className="button-primary" type="submit">Apply filters</button>
          <Link className="min-h-11 content-center px-2 text-sm text-muted hover:text-navy-950" href="/admin/enquiries">Clear</Link>
        </div>
      </form>

      {!dateRangeValid ? (
        <p className="text-sm text-red-800" role="alert">The date range is invalid. No date filter was applied.</p>
      ) : null}

      <section className="overflow-hidden border border-border bg-white">
        {enquiries.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Assigned</th>
                  <th className="px-4 py-3 font-medium">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enquiries.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <Link className="font-semibold text-blue-700 hover:text-navy-950" href={`/admin/enquiries/${item.id}`}>
                        {item.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 text-xs text-muted">{item.email}</p>
                      {item.phone ? <p className="mt-1 text-xs text-muted">{item.phone}</p> : null}
                    </td>
                    <td className="px-4 py-3">{item.organization ?? "—"}</td>
                    <td className="px-4 py-3">{item.service}</td>
                    <td className="px-4 py-3">{formatStatus(item.status)}</td>
                    <td className="px-4 py-3">{item.assignedTo?.name ?? item.assignedTo?.email ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-muted">{item.createdAt.toLocaleDateString("en-GH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-muted">
            {query || status || service || assignedToValue || fromValue || toValue ? "No enquiries match these filters." : "No enquiries have been received."}
          </p>
        )}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Link className="min-h-10 border border-border px-3 py-2" href={pageHref(page - 1, query, status, service, assignedToValue, fromValue, toValue)}>Previous</Link> : null}
              {page < totalPages ? <Link className="min-h-10 border border-border px-3 py-2" href={pageHref(page + 1, query, status, service, assignedToValue, fromValue, toValue)}>Next</Link> : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatStatus(status: EnquiryStatus) {
  return status.replaceAll("_", " ");
}

function pageHref(
  page: number,
  query: string,
  status?: EnquiryStatus,
  service?: string,
  assignedTo?: string,
  from?: string,
  to?: string,
) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  if (service) params.set("service", service);
  if (assignedTo) params.set("assignedTo", assignedTo);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return `/admin/enquiries?${params}`;
}
