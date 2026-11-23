import { EnquiryStatus, Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure, parsePagination } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";

const statusSchema = z.nativeEnum(EnquiryStatus);

export async function GET(request: Request) {
  const authorization = await authorizeAdmin("enquiries:read");
  if (authorization.response) return authorization.response;

  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  if (!pagination) return apiError(400, "INVALID_PAGINATION", "Pagination parameters are invalid.");

  const query = url.searchParams.get("q")?.trim();
  const statusValue = url.searchParams.get("status");
  const service = url.searchParams.get("service");
  const assignedTo = url.searchParams.get("assignedTo");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (query && query.length > 100) return apiError(400, "INVALID_QUERY", "Search query is too long.");
  if (service && service.length > 120) return apiError(400, "INVALID_SERVICE", "Service filter is too long.");
  if (assignedTo && !z.string().uuid().safeParse(assignedTo).success) {
    return apiError(400, "INVALID_ASSIGNEE", "Administrator filter is invalid.");
  }
  const status = statusValue ? statusSchema.safeParse(statusValue) : null;
  if (status && !status.success) return apiError(400, "INVALID_STATUS", "Enquiry status is invalid.");
  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;
  if (
    (fromDate && !Number.isFinite(fromDate.getTime())) ||
    (toDate && !Number.isFinite(toDate.getTime())) ||
    (fromDate && toDate && fromDate > toDate)
  ) {
    return apiError(400, "INVALID_DATE_RANGE", "The date range is invalid.");
  }

  const where: Prisma.EnquiryWhereInput = {
    ...(status?.success ? { status: status.data } : {}),
    ...(service ? { service } : {}),
    ...(assignedTo ? { assignedToId: assignedTo } : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { organization: { contains: query, mode: "insensitive" } },
            { reference: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const [items, totalItems] = await Promise.all([
      prisma.enquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.pageSize,
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
          followUpAt: true,
          createdAt: true,
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.enquiry.count({ where }),
    ]);

    return apiSuccess({
      items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pagination.pageSize),
      },
    });
  } catch (error) {
    return handleApiFailure(error);
  }
}
