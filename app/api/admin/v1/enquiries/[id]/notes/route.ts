import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma, runInTransaction } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const noteSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("enquiries:update");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return apiError(404, "NOT_FOUND", "Enquiry was not found.");

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = noteSchema.safeParse(rawBody);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Enter an internal note of 1–4,000 characters.");

  try {
    const note = await runInTransaction(async (transaction) => {
      const enquiry = await transaction.enquiry.findUnique({
        where: { id },
        select: { id: true, reference: true },
      });
      if (!enquiry) return null;

      const created = await transaction.enquiryNote.create({
        data: {
          enquiryId: id,
          authorId: authorization.admin!.id,
          body: input.data.body,
          isInternal: true,
        },
        select: { id: true, body: true, createdAt: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "ENQUIRY_NOTE_ADDED",
          entityType: "Enquiry",
          entityId: id,
          details: { reference: enquiry.reference, noteId: created.id },
        },
      });
      await transaction.enquiryActivity.create({
        data: {
          enquiryId: id,
          actorId: authorization.admin!.id,
          type: "NOTE_ADDED",
          description: "An internal note was added.",
          metadata: { noteId: created.id },
        },
      });
      return created;
    });

    return note
      ? apiSuccess(note, { status: 201 })
      : apiError(404, "NOT_FOUND", "Enquiry was not found.");
  } catch (error) {
    return handleApiFailure(error);
  }
}
