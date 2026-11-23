import { contactPhoneSchema } from "@/lib/validation/site-configuration";
import { readBoundedJson } from "@/server/api/bounded-json";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { phoneSettingKey } from "@/server/content/site-configuration";
import { prisma, runInTransaction } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

export async function PUT(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("settings:manage");
  if (authorization.response) return authorization.response;

  const body = await readBoundedJson(request);
  if (body.error) return body.error;
  const parsed = contactPhoneSchema.safeParse(body.value);
  if (!parsed.success) return apiError(422, "VALIDATION_FAILED", "Enter a valid contact phone number or leave it empty.");

  try {
    await runInTransaction(async (transaction) => {
      await transaction.siteSetting.upsert({
        where: { key: phoneSettingKey },
        create: { key: phoneSettingKey, value: parsed.data.phone, isPublic: true, updatedById: authorization.admin!.id },
        update: { value: parsed.data.phone, isPublic: true, updatedById: authorization.admin!.id },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "CONTACT_PHONE_UPDATED",
          entityType: "SiteSetting",
          details: { configured: parsed.data.phone !== "" },
        },
      });
    });
    return apiSuccess({ saved: true });
  } catch (error) {
    return handleApiFailure(error);
  }
}
