import { NotificationStatus } from "@/generated/prisma/client";
import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma, runInTransaction } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("settings:manage");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return apiError(404, "NOT_FOUND", "Email notification was not found.");

  try {
    const updated = await runInTransaction(async (transaction) => {
      const result = await transaction.notificationOutbox.updateMany({
        where: { id, status: NotificationStatus.FAILED },
        data: {
          status: NotificationStatus.PENDING,
          attemptCount: 0,
          nextAttemptAt: new Date(),
          lastError: null,
        },
      });
      if (!result.count) return false;
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "EMAIL_OUTBOX_RETRY_REQUESTED",
          entityType: "NotificationOutbox",
          entityId: id,
        },
      });
      return true;
    });
    return updated
      ? apiSuccess({ queued: true })
      : apiError(409, "NOT_RETRYABLE", "Only failed email notifications can be retried.");
  } catch (error) {
    return handleApiFailure(error);
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
