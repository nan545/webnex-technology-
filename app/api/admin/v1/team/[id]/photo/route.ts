import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { removeUnreferencedTeamPhoto } from "@/server/content/team-photo-cleanup";
import { prisma } from "@/server/db";
import {
  getObjectStorageConfiguration,
  putPrivateObject,
  removePrivateObject,
} from "@/server/integrations/object-storage";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";
import { teamPhotoUploadSchema } from "@/lib/validation/team-member";
import { optimizeTeamPhoto, isAllowedTeamPhotoMimeType } from "@/server/media/team-photo";

const uuidSchema = z.string().uuid();
const maxFileSize = 5 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("team:manage_media");
  if (authorization.response) return authorization.response;
  const { id: memberId } = await params;
  if (!uuidSchema.safeParse(memberId).success) return apiError(404, "NOT_FOUND", "Team member was not found.");

  try {
    if (!getObjectStorageConfiguration()) {
      return apiError(503, "STORAGE_NOT_CONFIGURED", "Configure private persistent object storage before uploading team photographs.");
    }
  } catch {
    return apiError(503, "STORAGE_NOT_CONFIGURED", "Configure private persistent object storage before uploading team photographs.");
  }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) {
    return apiError(415, "UNSUPPORTED_CONTENT_TYPE", "Submit the photograph as multipart form data.");
  }
  const contentLengthHeader = request.headers.get("content-length");
  if (!contentLengthHeader || !/^\d+$/.test(contentLengthHeader)) {
    return apiError(411, "CONTENT_LENGTH_REQUIRED", "The upload request must include a content length.");
  }
  const contentLength = Number(contentLengthHeader);
  if (contentLength > maxFileSize + 64 * 1024) {
    return apiError(413, "FILE_TOO_LARGE", "The photograph must be no larger than 5 MB.");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError(400, "INVALID_MULTIPART", "The upload request is malformed.");
  }
  const file = formData.get("photo");
  if (!(file instanceof File)) return apiError(422, "PHOTO_REQUIRED", "Choose a JPG, PNG, or WebP photograph.");
  if (file.size < 1 || file.size > maxFileSize) {
    return apiError(413, "FILE_TOO_LARGE", "The photograph must be between 1 byte and 5 MB.");
  }
  if (!isAllowedTeamPhotoMimeType(file.type)) {
    return apiError(415, "UNSUPPORTED_IMAGE_TYPE", "Only JPG, PNG, and WebP photographs are accepted.");
  }
  const altTextInput = teamPhotoUploadSchema.safeParse({
    ...(formData.has("altText") ? { altText: formData.get("altText") } : {}),
  });
  if (!altTextInput.success) return apiError(422, "INVALID_ALT_TEXT", "Image alternative text must be a text value of at most 250 characters.");

  let member: { id: string; name: string; profileImageId: string | null } | null;
  try {
    member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, profileImageId: true },
    });
  } catch (error) {
    return handleApiFailure(error);
  }
  if (!member) return apiError(404, "NOT_FOUND", "Team member was not found.");

  let image: { data: Buffer; width: number; height: number };
  try {
    const source = Buffer.from(await file.arrayBuffer());
    image = await optimizeTeamPhoto(source, file.type);
  } catch (error) {
    console.warn("Team photograph could not be decoded", {
      memberId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return apiError(422, "INVALID_IMAGE_CONTENT", "The selected file is not a valid supported photograph.");
  }

  const storageKey = `team/${memberId}/${randomUUID()}.webp`;
  try {
    await putPrivateObject(storageKey, image.data);
  } catch (error) {
    console.error("Team photograph could not be stored", {
      memberId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return apiError(503, "PHOTO_STORAGE_FAILED", "The photograph could not be saved to persistent storage.");
  }

  let createdMediaId: string | null = null;
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.teamMember.findUnique({
        where: { id: memberId },
        select: { profileImageId: true, status: true },
      });
      if (!current) return null;
      if (
        current.status === "PUBLISHED" &&
        !authorization.admin!.permissions.has("team:publish")
      ) {
        throw new PublishPermissionRequiredError();
      }
      const media = await transaction.mediaAsset.create({
        data: {
          storageKey,
          originalName: safeOriginalName(file.name),
          mimeType: "image/webp",
          sizeBytes: BigInt(image.data.byteLength),
          width: image.width,
          height: image.height,
          altText: altTextInput.data.altText || `Portrait of ${member.name}`,
          uploadedById: authorization.admin!.id,
        },
        select: { id: true, altText: true },
      });
      createdMediaId = media.id;
      await transaction.teamMember.update({
        where: { id: memberId },
        data: { profileImage: { connect: { id: media.id } } },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: current.profileImageId ? "TEAM_PHOTO_REPLACED" : "TEAM_PHOTO_ADDED",
          entityType: "TeamMember",
          entityId: memberId,
          details: { mediaId: media.id, width: image.width, height: image.height },
        },
      });
      return { media, previousMediaId: current.profileImageId };
    });
    if (!result) {
      await removeStoredObject(storageKey);
      return apiError(404, "NOT_FOUND", "Team member was not found.");
    }
    const oldPhotoRemoved = result.previousMediaId
      ? await removeUnreferencedTeamPhoto(result.previousMediaId)
      : true;
    return apiSuccess({
      id: result.media.id,
      altText: result.media.altText,
      imageUrl: `/api/admin/v1/team/media/${result.media.id}`,
      oldPhotoCleanupPending: !oldPhotoRemoved,
    });
  } catch (error) {
    await removeStoredObject(storageKey);
    if (createdMediaId) {
      await prisma.mediaAsset.deleteMany({ where: { id: createdMediaId } });
    }
    if (error instanceof PublishPermissionRequiredError) {
      return apiError(403, "PUBLISH_PERMISSION_REQUIRED", "Replacing a published profile photograph requires publication permission.");
    }
    return handleApiFailure(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("team:manage_media");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Team member was not found.");

  try {
    const removed = await prisma.$transaction(async (transaction) => {
      const member = await transaction.teamMember.findUnique({
        where: { id },
        select: { profileImageId: true, status: true },
      });
      if (!member) return null;
      if (
        member.status === "PUBLISHED" &&
        !authorization.admin!.permissions.has("team:publish")
      ) {
        throw new PublishPermissionRequiredError();
      }
      await transaction.teamMember.update({
        where: { id },
        data: { profileImage: { disconnect: true } },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "TEAM_PHOTO_REMOVED",
          entityType: "TeamMember",
          entityId: id,
          details: { mediaId: member.profileImageId },
        },
      });
      return { mediaId: member.profileImageId };
    });
    if (!removed) {
      return apiError(404, "NOT_FOUND", "Team member was not found.");
    }
    const removedFromStorage = removed.mediaId
      ? await removeUnreferencedTeamPhoto(removed.mediaId)
      : true;
    return apiSuccess({ removed: true, storageCleanupPending: !removedFromStorage });
  } catch (error) {
    if (error instanceof PublishPermissionRequiredError) {
      return apiError(403, "PUBLISH_PERMISSION_REQUIRED", "Removing a published profile photograph requires publication permission.");
    }
    return handleApiFailure(error);
  }
}

function safeOriginalName(name: string) {
  const normalized = name
    .normalize("NFKC")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 180);
  return normalized || "team-photo";
}

async function removeStoredObject(storageKey: string) {
  try {
    await removePrivateObject(storageKey);
  } catch (error) {
    console.error("Uncommitted team photo could not be removed from storage", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

class PublishPermissionRequiredError extends Error {}
