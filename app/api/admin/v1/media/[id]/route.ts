import { z } from "zod";
import { mediaMetadataSchema } from "@/lib/validation/media";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma, runInTransaction } from "@/server/db";
import { getObjectStorageConfiguration, readPrivateObject, removePrivateObject } from "@/server/integrations/object-storage";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const uuidSchema = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeAdmin("media:manage");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Media asset was not found.");

  try {
    const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: { storageKey: true } });
    if (!asset) return apiError(404, "NOT_FOUND", "Media asset was not found.");
    return new Response(await readPrivateObject(asset.storageKey), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Administrator media preview failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return apiError(503, "SERVICE_UNAVAILABLE", "The media preview could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("media:manage");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Media asset was not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_BODY", "The metadata request is malformed.");
  }
  const parsed = mediaMetadataSchema.safeParse(body);
  if (!parsed.success) return apiError(422, "INVALID_METADATA", "Review the alternative text and caption.");

  try {
    const updated = await runInTransaction(async (transaction) => {
      const asset = await transaction.mediaAsset.findUnique({ where: { id }, select: { id: true } });
      if (!asset) return null;
      await transaction.mediaAsset.update({
        where: { id },
        data: { altText: parsed.data.altText, caption: parsed.data.caption ?? null },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin.id,
          action: "MEDIA_METADATA_UPDATED",
          entityType: "MediaAsset",
          entityId: id,
        },
      });
      return true;
    });
    if (!updated) return apiError(404, "NOT_FOUND", "Media asset was not found.");
    return apiSuccess({ updated: true });
  } catch (error) {
    return handleApiFailure(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("media:manage");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Media asset was not found.");

  try {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      select: {
        storageKey: true,
        _count: { select: { teamMembers: true, projectCovers: true, blogPostCovers: true } },
      },
    });
    if (!asset) return apiError(404, "NOT_FOUND", "Media asset was not found.");
    if (asset._count.teamMembers + asset._count.projectCovers + asset._count.blogPostCovers > 0) {
      return apiError(409, "MEDIA_IN_USE", "This asset is in use and cannot be deleted.");
    }
  } catch (error) {
    return handleApiFailure(error);
  }

  try {
    const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: { storageKey: true } });
    if (!asset) return apiError(404, "NOT_FOUND", "Media asset was not found.");
    if (getObjectStorageConfiguration()) {
      await removePrivateObject(asset.storageKey);
    }
    await runInTransaction(async (transaction) => {
      await transaction.mediaAsset.delete({ where: { id } });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin.id,
          action: "MEDIA_DELETED",
          entityType: "MediaAsset",
          entityId: id,
        },
      });
    });
    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Media asset deletion failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return handleApiFailure(error);
  }
}
