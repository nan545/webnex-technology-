import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const uuidSchema = z.string().uuid();
const updateSchema = z.object({
  completed: z.boolean().optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("enquiries:update");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Follow-up was not found.");

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = updateSchema.safeParse(rawBody);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Follow-up changes are invalid.");
  if (input.data.dueAt && new Date(input.data.dueAt) <= new Date()) {
    return apiError(422, "INVALID_DUE_DATE", "A rescheduled follow-up must be in the future.");
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const task = await transaction.followUpTask.findUnique({
        where: { id },
        select: { id: true, title: true, enquiryId: true, completedAt: true },
      });
      if (!task) return null;
      const completedAt =
        input.data.completed === undefined
          ? undefined
          : input.data.completed
            ? new Date()
            : null;
      const updated = await transaction.followUpTask.update({
        where: { id },
        data: {
          ...(completedAt !== undefined ? { completedAt } : {}),
          ...(input.data.dueAt ? { dueAt: new Date(input.data.dueAt) } : {}),
        },
        select: { id: true, title: true, dueAt: true, completedAt: true, enquiryId: true },
      });
      if (input.data.dueAt) {
        await transaction.enquiry.update({
          where: { id: task.enquiryId },
          data: { followUpAt: new Date(input.data.dueAt) },
        });
      }
      if (input.data.completed !== undefined && Boolean(task.completedAt) !== input.data.completed) {
        await transaction.enquiryActivity.create({
          data: {
            enquiryId: task.enquiryId,
            actorId: authorization.admin!.id,
            type: input.data.completed ? "FOLLOW_UP_COMPLETED" : "FOLLOW_UP_SET",
            description: input.data.completed
              ? `Follow-up completed: ${task.title}`
              : `Follow-up reopened: ${task.title}`,
            metadata: { taskId: task.id },
          },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: input.data.completed ? "FOLLOW_UP_TASK_COMPLETED" : "FOLLOW_UP_TASK_UPDATED",
          entityType: "FollowUpTask",
          entityId: id,
        },
      });
      return updated;
    });
    return result
      ? apiSuccess(result)
      : apiError(404, "NOT_FOUND", "Follow-up was not found.");
  } catch (error) {
    return handleApiFailure(error);
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
