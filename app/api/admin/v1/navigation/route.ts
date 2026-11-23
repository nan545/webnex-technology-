import { navigationConfigurationSchema } from "@/lib/validation/site-configuration";
import { readBoundedJson } from "@/server/api/bounded-json";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { navigationSettingKey } from "@/server/content/site-configuration";
import { prisma, runInTransaction } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

export async function PUT(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("content:publish");
  if (authorization.response) return authorization.response;

  const body = await readBoundedJson(request);
  if (body.error) return body.error;
  const parsed = navigationConfigurationSchema.safeParse(body.value);
  if (!parsed.success) return apiError(422, "VALIDATION_FAILED", "Review the navigation links and use unique, valid internal paths.");

  try {
    await runInTransaction(async (transaction) => {
      await transaction.siteSetting.upsert({
        where: { key: navigationSettingKey },
        create: { key: navigationSettingKey, value: parsed.data, isPublic: true, updatedById: authorization.admin!.id },
        update: { value: parsed.data, isPublic: true, updatedById: authorization.admin!.id },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "NAVIGATION_UPDATED",
          entityType: "SiteSetting",
          details: { headerLinks: parsed.data.header.length, footerLinks: parsed.data.footer.length },
        },
      });
    });
    return apiSuccess({ saved: true });
  } catch (error) {
    return handleApiFailure(error);
  }
}
