import { randomUUID } from "node:crypto";
import { apiError, apiSuccess, handleApiFailure, parsePagination } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";
import { getObjectStorageConfiguration, putPrivateObject } from "@/server/integrations/object-storage";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";
import { mediaMetadataSchema } from "@/lib/validation/media";
import {
  isAllowedMediaMimeType,
  optimizeMediaImage,
  safeMediaOriginalName,
} from "@/server/media/media-library";

const maximumFileBytes = 5 * 1024 * 1024;

export async function GET(request: Request) {
  const authorization = await authorizeAdmin("media:manage");
  if (authorization.response) return authorization.response;

  const { searchParams } = new URL(request.url);
  const pagination = parsePagination(searchParams);
  if (!pagination) return apiError(422, "INVALID_PAGINATION", "The page parameters are invalid.");
  const search = (searchParams.get("search") ?? "").trim().slice(0, 100);

  try {
    const where = search
      ? {
          OR: [
            { originalName: { contains: search, mode: "insensitive" as const } },
            { altText: { contains: search, mode: "insensitive" as const } },
            { caption: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};
    const [assets, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
          id: true,
          storageKey: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          width: true,
          height: true,
          altText: true,
          caption: true,
          createdAt: true,
          _count: {
            select: { teamMembers: true, projectCovers: true, blogPostCovers: true },
          },
        },
      }),
      prisma.mediaAsset.count({ where }),
    ]);
    return apiSuccess({
      assets: assets.map((asset) => ({
        ...asset,
        sizeBytes: asset.sizeBytes.toString(),
        createdAt: asset.createdAt.toISOString(),
        usageCount:
          asset._count.teamMembers +
          asset._count.projectCovers +
          asset._count.blogPostCovers,
      })),
      page: pagination.skip / pagination.pageSize + 1,
      pageSize: pagination.pageSize,
      total,
    });
  } catch (error) {
    return handleApiFailure(error);
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("media:manage");
  if (authorization.response) return authorization.response;

  try {
    if (!getObjectStorageConfiguration()) {
      return apiError(503, "STORAGE_NOT_CONFIGURED", "Configure private persistent object storage before uploading media.");
    }
  } catch {
    return apiError(503, "STORAGE_NOT_CONFIGURED", "Configure private persistent object storage before uploading media.");
  }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) {
    return apiError(415, "INVALID_TYPE", "Submit an image as multipart form data.");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError(400, "INVALID_BODY", "The upload request is malformed.");
  }
  const file = formData.get("image");
  if (!(file instanceof File)) return apiError(422, "IMAGE_REQUIRED", "Choose an image to upload.");
  if (file.size < 1 || file.size > maximumFileBytes) {
    return apiError(413, "FILE_TOO_LARGE", "The image must be between 1 byte and 5 MB.");
  }
  if (!isAllowedMediaMimeType(file.type)) {
    return apiError(415, "UNSUPPORTED_IMAGE_TYPE", "Only JPG, PNG, and WebP images are accepted.");
  }
  const metadata = mediaMetadataSchema.safeParse({
    altText: formData.get("altText") ?? "",
    caption: formData.has("caption") ? formData.get("caption") : null,
  });
  if (!metadata.success) {
    return apiError(422, "INVALID_METADATA", "Review the alternative text and caption.");
  }

  let image: { data: Buffer; width: number; height: number };
  try {
    image = await optimizeMediaImage(Buffer.from(await file.arrayBuffer()), file.type);
  } catch {
    return apiError(422, "INVALID_IMAGE_CONTENT", "The selected file is not a valid supported image.");
  }

  const storageKey = `media/${randomUUID()}.webp`;
  try {
    await putPrivateObject(storageKey, image.data);
  } catch (error) {
    console.error("Media upload storage failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return apiError(503, "STORAGE_FAILED", "The image could not be saved.");
  }

  try {
    const asset = await prisma.mediaAsset.create({
      data: {
        storageKey,
        originalName: safeMediaOriginalName(file.name),
        mimeType: "image/webp",
        sizeBytes: BigInt(image.data.length),
        width: image.width,
        height: image.height,
        altText: metadata.data.altText,
        caption: metadata.data.caption,
        uploadedById: authorization.admin.id,
      },
      select: { id: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: authorization.admin.id,
        action: "MEDIA_UPLOADED",
        entityType: "MediaAsset",
        entityId: asset.id,
        details: { originalName: safeMediaOriginalName(file.name), sizeBytes: image.data.length },
      },
    });
    return apiSuccess({ id: asset.id }, { status: 201 });
  } catch (error) {
    try {
      const { removePrivateObject } = await import("@/server/integrations/object-storage");
      await removePrivateObject(storageKey);
    } catch (cleanupError) {
      console.error("Uncommitted media cleanup failed", { errorType: cleanupError instanceof Error ? cleanupError.name : "UnknownError" });
    }
    return handleApiFailure(error);
  }
}
