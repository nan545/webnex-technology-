import { EnquiryStatus, Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma, runInTransaction } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const idSchema = z.string().uuid();
const updateSchema = z
  .object({
    status: z.nativeEnum(EnquiryStatus).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
    followUpAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeAdmin("enquiries:read");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Enquiry was not found.");

  try {
    const [enquiry, history] = await Promise.all([
      prisma.enquiry.findUnique({
        where: { id },
        select: {
          id: true,
          reference: true,
          name: true,
          email: true,
          phone: true,
          organization: true,
          service: true,
          budget: true,
          preferredContact: true,
          message: true,
          status: true,
          followUpAt: true,
          sourcePath: true,
          createdAt: true,
          updatedAt: true,
          assignedTo: { select: { id: true, name: true, email: true } },
          notes: {
            where: { isInternal: true },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              body: true,
              createdAt: true,
              author: { select: { name: true, email: true } },
            },
          },
        },
      }),
      prisma.auditLog.findMany({
        where: { entityType: "Enquiry", entityId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          action: true,
          details: true,
          createdAt: true,
          actor: { select: { name: true, email: true } },
        },
      }),
    ]);

    return enquiry
      ? apiSuccess({ ...enquiry, history })
      : apiError(404, "NOT_FOUND", "Enquiry was not found.");
  } catch (error) {
    return handleApiFailure(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("enquiries:update");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Enquiry was not found.");

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = updateSchema.safeParse(rawBody);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Enquiry changes are invalid.");

  try {
    const current = await prisma.enquiry.findUnique({
      where: { id },
      select: { id: true, status: true, assignedToId: true, followUpAt: true, lastContactAt: true },
    });
    if (!current) return apiError(404, "NOT_FOUND", "Enquiry was not found.");
    const requestedFollowUpAt =
      input.data.followUpAt === undefined
        ? undefined
        : input.data.followUpAt
          ? new Date(input.data.followUpAt)
          : null;
    const followUpChanged =
      requestedFollowUpAt !== undefined &&
      (requestedFollowUpAt?.toISOString() ?? null) !== (current.followUpAt?.toISOString() ?? null);

    if (input.data.assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: input.data.assignedToId,
          isActive: true,
          roles: { some: { role: { permissions: { some: { permission: { key: "enquiries:update" } } } } } },
        },
        select: { id: true },
      });
      if (!assignee) {
        return apiError(422, "INVALID_ASSIGNEE", "Choose an active administrator allowed to manage enquiries.");
      }
    }

    const data: Prisma.EnquiryUpdateInput = {
      ...(input.data.status ? { status: input.data.status } : {}),
      ...(input.data.status === EnquiryStatus.CONTACTED && current.status !== EnquiryStatus.CONTACTED
        ? { lastContactAt: new Date() }
        : {}),
      ...(input.data.assignedToId !== undefined
        ? {
            assignedTo: input.data.assignedToId
              ? { connect: { id: input.data.assignedToId } }
              : { disconnect: true },
          }
        : {}),
      ...(followUpChanged
        ? { followUpAt: requestedFollowUpAt }
        : {}),
    };

    const details: Prisma.InputJsonObject = {
      ...(input.data.status && input.data.status !== current.status
        ? { previousStatus: current.status, newStatus: input.data.status }
        : {}),
      ...(input.data.assignedToId !== undefined && input.data.assignedToId !== current.assignedToId
        ? {
            previousAssigneeId: current.assignedToId,
            newAssigneeId: input.data.assignedToId,
          }
        : {}),
      ...(followUpChanged
        ? { followUpAt: input.data.followUpAt ?? null }
        : {}),
    };

    const actions = [
      ...(input.data.status && input.data.status !== current.status ? ["ENQUIRY_STATUS_CHANGED"] : []),
      ...(input.data.assignedToId !== undefined && input.data.assignedToId !== current.assignedToId
        ? ["ENQUIRY_ASSIGNED"]
        : []),
      ...(followUpChanged ? ["ENQUIRY_FOLLOW_UP_CHANGED"] : []),
    ];

    const updated = await runInTransaction(async (transaction) => {
      const result = await transaction.enquiry.update({
        where: { id },
        data,
        select: {
          id: true,
          reference: true,
          status: true,
          followUpAt: true,
          assignedTo: { select: { id: true, name: true, email: true } },
          updatedAt: true,
        },
      });
      if (actions.length) {
        await transaction.auditLog.createMany({
          data: actions.map((action) => ({
            actorId: authorization.admin!.id,
            action,
            entityType: "Enquiry",
            entityId: id,
            details,
          })),
        });
      }
      if (input.data.status && input.data.status !== current.status) {
        await transaction.enquiryActivity.create({
          data: {
            enquiryId: id,
            actorId: authorization.admin!.id,
            type: "STATUS_CHANGED",
            description: `Status changed from ${current.status.replaceAll("_", " ")} to ${input.data.status.replaceAll("_", " ")}.`,
            metadata: { previousStatus: current.status, status: input.data.status },
          },
        });
      }
      if (input.data.assignedToId !== undefined && input.data.assignedToId !== current.assignedToId) {
        await transaction.enquiryActivity.create({
          data: {
            enquiryId: id,
            actorId: authorization.admin!.id,
            type: "ASSIGNED",
            description: input.data.assignedToId ? "Enquiry assigned to an administrator." : "Enquiry assignment removed.",
            metadata: { assignedToId: input.data.assignedToId },
          },
        });
      }
      if (followUpChanged) {
        await transaction.enquiryActivity.create({
          data: {
            enquiryId: id,
            actorId: authorization.admin!.id,
            type: "FOLLOW_UP_SET",
            description: input.data.followUpAt ? "Enquiry follow-up date updated." : "Enquiry follow-up date cleared.",
            metadata: { followUpAt: input.data.followUpAt },
          },
        });
      }
      return result;
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiFailure(error);
  }
}
