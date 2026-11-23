import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure, parsePagination } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma, runInTransaction } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const createTaskSchema = z.object({
  enquiryId: z.string().uuid(),
  assignedToId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).nullable().optional(),
  dueAt: z.string().datetime({ offset: true }),
}).strict();

export async function GET(request: Request) {
  const authorization = await authorizeAdmin("enquiries:read");
  if (authorization.response) return authorization.response;
  const params = new URL(request.url).searchParams;
  const pagination = parsePagination(params);
  if (!pagination) return apiError(400, "INVALID_PAGINATION", "Pagination parameters are invalid.");
  const state = params.get("state") ?? "open";
  if (!["open", "completed", "overdue"].includes(state)) {
    return apiError(400, "INVALID_STATE", "Follow-up state is invalid.");
  }
  const now = new Date();
  const where = state === "completed"
    ? { completedAt: { not: null } }
    : state === "overdue"
      ? { completedAt: null, dueAt: { lt: now } }
      : { completedAt: null };

  try {
    const [items, totalItems] = await Promise.all([
      prisma.followUpTask.findMany({
        where,
        orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          dueAt: true,
          completedAt: true,
          createdAt: true,
          assignedTo: { select: { id: true, name: true, email: true } },
          enquiry: { select: { id: true, reference: true, name: true, status: true } },
        },
      }),
      prisma.followUpTask.count({ where }),
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

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("enquiries:update");
  if (authorization.response) return authorization.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = createTaskSchema.safeParse(rawBody);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Review the follow-up details.");
  if (new Date(input.data.dueAt) <= new Date()) {
    return apiError(422, "INVALID_DUE_DATE", "A follow-up due date must be in the future.");
  }

  try {
    const task = await runInTransaction(async (transaction) => {
      const enquiry = await transaction.enquiry.findUnique({
        where: { id: input.data.enquiryId },
        select: { id: true, reference: true },
      });
      if (!enquiry) return null;
      if (input.data.assignedToId) {
        const user = await transaction.user.findFirst({
          where: {
            id: input.data.assignedToId,
            isActive: true,
            roles: { some: { role: { permissions: { some: { permission: { key: "enquiries:update" } } } } } },
          },
          select: { id: true },
        });
        if (!user) throw new InvalidAssigneeError();
      }

      const created = await transaction.followUpTask.create({
        data: {
          enquiryId: enquiry.id,
          assignedToId: input.data.assignedToId ?? authorization.admin!.id,
          createdById: authorization.admin!.id,
          title: input.data.title,
          description: input.data.description ?? null,
          dueAt: new Date(input.data.dueAt),
        },
        select: { id: true, title: true, dueAt: true, assignedToId: true },
      });
      await transaction.enquiry.update({
        where: { id: enquiry.id },
        data: { followUpAt: created.dueAt },
      });
      await transaction.enquiryActivity.create({
        data: {
          enquiryId: enquiry.id,
          actorId: authorization.admin!.id,
          type: "FOLLOW_UP_SET",
          description: `Follow-up task created: ${created.title}`,
          metadata: { taskId: created.id, dueAt: created.dueAt.toISOString() },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "FOLLOW_UP_TASK_CREATED",
          entityType: "FollowUpTask",
          entityId: created.id,
          details: { enquiryReference: enquiry.reference },
        },
      });
      return created;
    });
    return task
      ? apiSuccess(task, { status: 201 })
      : apiError(404, "NOT_FOUND", "Enquiry was not found.");
  } catch (error) {
    if (error instanceof InvalidAssigneeError) {
      return apiError(422, "INVALID_ASSIGNEE", "Choose an active administrator allowed to manage enquiries.");
    }
    return handleApiFailure(error);
  }
}

class InvalidAssigneeError extends Error {}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
