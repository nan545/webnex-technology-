import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const decisionSchema = z.object({
  decision: z.enum(["ACCEPTED", "DECLINED"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("dashboard:read");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return apiError(404, "NOT_FOUND", "Work project was not found.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_BODY", "The assignment response is malformed.");
  }
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "INVALID_DECISION", "Choose accept or decline.");
  }

  try {
    const assignment = await prisma.workProjectAssignment.findUnique({
      where: { projectId_userId: { projectId: id, userId: authorization.admin.id } },
      select: { id: true },
    });
    if (!assignment) {
      return apiError(404, "NOT_FOUND", "This work project is not assigned to your account.");
    }

    await prisma.workProjectAssignment.update({
      where: { id: assignment.id },
      data: parsed.data.decision === "ACCEPTED"
        ? { acceptedAt: new Date(), declinedAt: null }
        : { acceptedAt: null, declinedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        actorId: authorization.admin.id,
        action: `WORK_PROJECT_ASSIGNMENT_${parsed.data.decision}`,
        entityType: "WorkProject",
        entityId: id,
      },
    });
    return apiSuccess({ decision: parsed.data.decision });
  } catch (error) {
    return handleApiFailure(error);
  }
}
