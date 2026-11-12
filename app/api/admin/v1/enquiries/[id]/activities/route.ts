import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

const uuidSchema = z.string().uuid();
const activitySchema = z.object({
  type: z.enum(["PHONE_CONTACT", "EMAIL_CONTACT", "WHATSAPP_LINK_OPENED", "MEETING"]),
  description: z.string().trim().min(2).max(1000).optional(),
}).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("enquiries:update");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Enquiry was not found.");

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = activitySchema.safeParse(rawBody);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "The activity details are invalid.");

  try {
    const activity = await prisma.$transaction(async (transaction) => {
      const enquiry = await transaction.enquiry.findUnique({
        where: { id },
        select: { id: true, phone: true, whatsappConsentAt: true },
      });
      if (!enquiry) return null;
      if (input.data.type === "WHATSAPP_LINK_OPENED") {
        if (!enquiry.whatsappConsentAt) throw new WhatsAppConsentRequiredError();
        if (!enquiry.phone || !normalizeWhatsAppNumber(enquiry.phone)) {
          throw new InvalidWhatsAppNumberError();
        }
      }

      const created = await transaction.enquiryActivity.create({
        data: {
          enquiryId: id,
          actorId: authorization.admin!.id,
          type: input.data.type,
          description:
            input.data.type === "WHATSAPP_LINK_OPENED"
              ? "WhatsApp conversation link opened by an administrator; message delivery is not confirmed."
              : input.data.description ?? input.data.type.replaceAll("_", " ").toLowerCase(),
          metadata:
            input.data.type === "WHATSAPP_LINK_OPENED"
              ? { outcome: "conversation_link_opened", deliveryConfirmed: false }
              : undefined,
        },
        select: { id: true, type: true, description: true, createdAt: true },
      });

      if (["PHONE_CONTACT", "EMAIL_CONTACT", "MEETING"].includes(input.data.type)) {
        await transaction.enquiry.update({
          where: { id },
          data: { lastContactAt: new Date() },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: input.data.type,
          entityType: "Enquiry",
          entityId: id,
        },
      });
      return created;
    });

    return activity
      ? apiSuccess(activity, { status: 201 })
      : apiError(404, "NOT_FOUND", "Enquiry was not found.");
  } catch (error) {
    if (error instanceof WhatsAppConsentRequiredError) {
      return apiError(409, "WHATSAPP_CONSENT_REQUIRED", "The customer has not opted in to WhatsApp contact.");
    }
    if (error instanceof InvalidWhatsAppNumberError) {
      return apiError(422, "INVALID_PHONE", "The customer's phone number cannot be used as an international WhatsApp number.");
    }
    return handleApiFailure(error);
  }
}

class WhatsAppConsentRequiredError extends Error {}
class InvalidWhatsAppNumberError extends Error {}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
