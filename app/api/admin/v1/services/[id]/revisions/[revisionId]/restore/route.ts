import { ContentStatus, Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const uuidSchema = z.string().uuid();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("content:restore");
  if (authorization.response) return authorization.response;
  const { id, revisionId } = await params;
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(revisionId).success) {
    return apiError(404, "NOT_FOUND", "Service revision was not found.");
  }

  try {
    const restored = await prisma.$transaction(async (transaction) => {
      const [service, revision] = await Promise.all([
        transaction.service.findUnique({ where: { id } }),
        transaction.serviceRevision.findFirst({ where: { id: revisionId, serviceId: id } }),
      ]);
      if (!service || !revision) return null;
      const redirectCollision = await transaction.serviceRedirect.findUnique({
        where: { sourceSlug: revision.slug },
        select: { serviceId: true },
      });
      if (redirectCollision && redirectCollision.serviceId !== id) {
        throw new SlugRedirectCollisionError();
      }
      if (redirectCollision?.serviceId === id) {
        await transaction.serviceRedirect.delete({ where: { sourceSlug: revision.slug } });
      }

      const updated = await transaction.service.update({
        where: { id },
        data: {
          title: revision.title,
          slug: revision.slug,
          summary: revision.summary,
          content: revision.content ?? Prisma.JsonNull,
          status: ContentStatus.DRAFT,
          publishedAt: null,
          updatedById: authorization.admin!.id,
        },
      });
      const lastRevision = await transaction.serviceRevision.findFirst({
        where: { serviceId: id },
        orderBy: { revision: "desc" },
        select: { revision: true },
      });
      await transaction.serviceRevision.create({
        data: {
          serviceId: id,
          authorId: authorization.admin!.id,
          revision: (lastRevision?.revision ?? 0) + 1,
          title: updated.title,
          slug: updated.slug,
          summary: updated.summary,
          content: updated.content ?? Prisma.JsonNull,
          status: updated.status,
        },
      });
      if (service.slug !== updated.slug) {
        await transaction.serviceRedirect.upsert({
          where: { sourceSlug: service.slug },
          create: { sourceSlug: service.slug, serviceId: id },
          update: { serviceId: id },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "SERVICE_REVISION_RESTORED",
          entityType: "Service",
          entityId: id,
          details: { restoredRevision: revision.revision, newStatus: ContentStatus.DRAFT },
        },
      });
      return { id: updated.id, title: updated.title, revision: (lastRevision?.revision ?? 0) + 1 };
    });

    return restored
      ? apiSuccess(restored)
      : apiError(404, "NOT_FOUND", "Service or revision was not found.");
  } catch (error) {
    if (error instanceof SlugRedirectCollisionError) {
      return apiError(409, "SLUG_EXISTS", "A different service redirect already uses the revision slug.");
    }
    if (isUniqueConstraintError(error)) {
      return apiError(409, "SLUG_EXISTS", "The previous slug is now used by another service or redirect.");
    }
    return handleApiFailure(error);
  }
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

class SlugRedirectCollisionError extends Error {}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
