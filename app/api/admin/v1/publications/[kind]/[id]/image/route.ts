import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { publicationKindSchema } from "@/lib/validation/publication";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { publicationPermission } from "@/server/content/publications";
import { prisma, runInTransaction } from "@/server/db";
import { getObjectStorageConfiguration, putPrivateObject, removePrivateObject } from "@/server/integrations/object-storage";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const maximumFileBytes = 5 * 1024 * 1024;
const allowedFormats = new Map([["image/jpeg", "jpeg"], ["image/png", "png"], ["image/webp", "webp"]]);

export async function POST(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const { kind: rawKind, id } = await params;
  const parsed = publicationKindSchema.safeParse(rawKind);
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return apiError(404, "NOT_FOUND", "Content was not found.");
  const kind = parsed.data;
  const authorization = await authorizeAdmin(publicationPermission(kind));
  if (authorization.response) return authorization.response;
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) return apiError(415, "INVALID_TYPE", "Choose an image to upload.");
  const reader = request.body?.getReader();
  if (!reader) return apiError(400, "INVALID_BODY", "The upload is empty.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > maximumFileBytes + 65536) {
        await reader.cancel();
        return apiError(413, "FILE_TOO_LARGE", "The image must be no larger than 5 MB.");
      }
      chunks.push(value);
    }
  } catch {
    return apiError(400, "INVALID_BODY", "The upload could not be read.");
  }
  let data: FormData;
  try {
    data = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
  } catch {
    return apiError(400, "INVALID_BODY", "The upload is malformed.");
  }
  const file = data.get("image");
  const altText = data.get("altText");
  if (!(file instanceof File) || file.size < 1 || file.size > maximumFileBytes || !allowedFormats.has(file.type)) {
    return apiError(422, "INVALID_IMAGE", "Choose a JPG, PNG or WebP image up to 5 MB.");
  }
  if (typeof altText !== "string" || !altText.trim() || altText.trim().length > 250) {
    return apiError(422, "INVALID_ALT", "Enter an image description of up to 250 characters.");
  }
  let optimized: { data: Buffer; info: { width: number; height: number } };
  try {
    const pipeline = sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error", limitInputPixels: 25_000_000 });
    const metadata = await pipeline.metadata();
    if (metadata.format !== allowedFormats.get(file.type) || !metadata.width || !metadata.height) throw new Error("Invalid image.");
    optimized = await pipeline.rotate().resize(1600, 900, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  } catch (error) {
    console.warn("Publication image could not be decoded", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return apiError(422, "INVALID_IMAGE", "The file is not a valid supported image.");
  }
  const storageKey = `publications/${kind}/${id}/${randomUUID()}.webp`;
  try {
    if (!getObjectStorageConfiguration()) return apiError(503, "STORAGE_NOT_CONFIGURED", "Image storage is not configured.");
    await putPrivateObject(storageKey, optimized.data);
  } catch (error) {
    console.error("Publication image storage failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return apiError(503, "STORAGE_FAILED", "The image could not be saved.");
  }
  let committed = false;
  try {
    const result = await runInTransaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(72340172838076674)`;
      const current = kind === "projects"
        ? await transaction.project.findUnique({ where: { id }, select: { status: true, coverImageId: true } })
        : await transaction.blogPost.findUnique({ where: { id }, select: { status: true, coverImageId: true } });
      if (!current) return { error: "NOT_FOUND" } as const;
      if (current.status === "PUBLISHED" && !authorization.admin.permissions.has("content:publish")) return { error: "FORBIDDEN" } as const;
      const media = await transaction.mediaAsset.create({
        data: { storageKey, originalName: "publication-cover", mimeType: "image/webp", sizeBytes: BigInt(optimized.data.length), width: optimized.info.width, height: optimized.info.height, altText: altText.trim(), uploadedById: authorization.admin.id },
        select: { id: true },
      });
      if (kind === "projects") await transaction.project.update({ where: { id }, data: { coverImageId: media.id } });
      else await transaction.blogPost.update({ where: { id }, data: { coverImageId: media.id } });
      await transaction.auditLog.create({ data: { actorId: authorization.admin.id, action: "PUBLICATION_IMAGE_UPDATED", entityType: kind === "projects" ? "Project" : "BlogPost", entityId: id, details: { mediaId: media.id } } });
      return { oldId: current.coverImageId } as const;
    });
    if ("error" in result) {
      await removePrivateObject(storageKey);
      return result.error === "NOT_FOUND" ? apiError(404, "NOT_FOUND", "Content was not found.") : apiError(403, "FORBIDDEN", "Updating a published image requires publication permission.");
    }
    committed = true;
    if (result.oldId) {
      const old = await prisma.mediaAsset.findUnique({ where: { id: result.oldId }, select: { storageKey: true, _count: { select: { teamMembers: true, projectCovers: true, blogPostCovers: true } } } });
      if (old && old._count.teamMembers + old._count.projectCovers + old._count.blogPostCovers === 0) {
        try {
          await removePrivateObject(old.storageKey);
          await prisma.mediaAsset.delete({ where: { id: result.oldId } });
        } catch (error) {
          console.error("Previous publication image cleanup failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
          return apiSuccess({ saved: true, cleanupPending: true });
        }
      }
    }
    return apiSuccess({ saved: true, cleanupPending: false });
  } catch (error) {
    if (!committed) {
      try { await removePrivateObject(storageKey); }
      catch (cleanupError) { console.error("Uncommitted publication image cleanup failed", { errorType: cleanupError instanceof Error ? cleanupError.name : "UnknownError" }); }
    }
    return handleApiFailure(error);
  }
}
