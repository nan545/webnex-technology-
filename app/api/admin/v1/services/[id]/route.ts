import { ContentStatus, Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { cmsServiceUpdateSchema } from "@/lib/validation/cms-service";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const uuidSchema = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeAdmin("content:read");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Service was not found.");

  try {
    const service = await prisma.service.findUnique({
      where: { id },
      include: { revisions: { orderBy: { revision: "desc" }, take: 25 } },
    });
    return service
      ? apiSuccess(service)
      : apiError(404, "NOT_FOUND", "Service was not found.");
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = cmsServiceUpdateSchema.safeParse(rawBody);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Review the service changes.");
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Service was not found.");

  const requestedStatus = input.data.status;
  const requiredPermission =
    requestedStatus === "PUBLISHED" || requestedStatus === "ARCHIVED"
      ? "content:publish"
      : requestedStatus === "APPROVED"
        ? "content:approve"
        : "content:write";
  const authorization = await authorizeAdmin(requiredPermission);
  if (authorization.response) return authorization.response;
  if (!requestedStatus && !authorization.admin!.permissions.has("content:write")) {
    return apiError(403, "FORBIDDEN", "You do not have permission to edit services.");
  }

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const current = await transaction.service.findUnique({ where: { id } });
      if (!current) return null;

      const permissions = authorization.admin!.permissions;
      if (
        current.status === ContentStatus.PUBLISHED &&
        requestedStatus !== undefined &&
        requestedStatus !== ContentStatus.PUBLISHED &&
        !permissions.has("content:publish")
      ) {
        throw new PublishPermissionRequiredError();
      }
      if (
        current.status === ContentStatus.PUBLISHED &&
        (input.data.title !== undefined ||
          input.data.slug !== undefined ||
          input.data.summary !== undefined ||
          input.data.content !== undefined) &&
        !permissions.has("content:publish")
      ) {
        throw new PublishPermissionRequiredError();
      }
      if (
        requestedStatus === "PUBLISHED" &&
        current.status !== ContentStatus.APPROVED &&
        current.status !== ContentStatus.PUBLISHED
      ) {
        throw new InvalidWorkflowTransitionError();
      }
      if (
        requestedStatus === "APPROVED" &&
        current.status !== ContentStatus.IN_REVIEW &&
        current.status !== ContentStatus.APPROVED
      ) {
        throw new InvalidWorkflowTransitionError();
      }
      if (
        requestedStatus === "IN_REVIEW" &&
        current.status !== ContentStatus.DRAFT &&
        current.status !== ContentStatus.IN_REVIEW
      ) {
        throw new InvalidWorkflowTransitionError();
      }

      const nextStatus = requestedStatus ?? current.status;
      if (input.data.slug !== undefined && input.data.slug !== current.slug) {
        const redirectCollision = await transaction.serviceRedirect.findUnique({
          where: { sourceSlug: input.data.slug },
          select: { serviceId: true },
        });
        if (redirectCollision && redirectCollision.serviceId !== id) {
          throw new SlugRedirectCollisionError();
        }
        if (redirectCollision?.serviceId === id) {
          await transaction.serviceRedirect.delete({ where: { sourceSlug: input.data.slug } });
        }
      }
      const data: Prisma.ServiceUpdateInput = {
        ...(input.data.title !== undefined ? { title: input.data.title } : {}),
        ...(input.data.slug !== undefined ? { slug: input.data.slug } : {}),
        ...(input.data.summary !== undefined ? { summary: input.data.summary } : {}),
        ...(input.data.content !== undefined ? { content: input.data.content } : {}),
        ...(requestedStatus !== undefined ? { status: nextStatus } : {}),
        updatedBy: { connect: { id: authorization.admin!.id } },
        ...(nextStatus === ContentStatus.PUBLISHED
          ? { publishedAt: current.publishedAt ?? new Date() }
          : requestedStatus !== undefined
            ? { publishedAt: null }
            : {}),
      };

      const service = await transaction.service.update({ where: { id }, data });
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
          title: service.title,
          slug: service.slug,
          summary: service.summary,
          content: service.content ?? Prisma.JsonNull,
          status: service.status,
        },
      });
      if (current.slug !== service.slug) {
        await transaction.serviceRedirect.upsert({
          where: { sourceSlug: current.slug },
          create: { sourceSlug: current.slug, serviceId: id },
          update: { serviceId: id },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: requestedStatus ? `SERVICE_${requestedStatus}` : "SERVICE_UPDATED",
          entityType: "Service",
          entityId: id,
          details: {
            revision: (lastRevision?.revision ?? 0) + 1,
            slugChanged: current.slug !== service.slug,
            status: service.status,
          },
        },
      });
      return service;
    });

    return updated
      ? apiSuccess({ id: updated.id, title: updated.title, slug: updated.slug, status: updated.status })
      : apiError(404, "NOT_FOUND", "Service was not found.");
  } catch (error) {
    if (error instanceof InvalidWorkflowTransitionError) {
      return apiError(409, "INVALID_WORKFLOW", "Approve the service before publishing it.");
    }
    if (error instanceof PublishPermissionRequiredError) {
      return apiError(403, "PUBLISH_PERMISSION_REQUIRED", "Unpublishing or changing a published service requires publication permission.");
    }
    if (error instanceof SlugRedirectCollisionError) {
      return apiError(409, "SLUG_EXISTS", "A different service redirect already uses this slug.");
    }
    if (isUniqueConstraintError(error)) {
      return apiError(409, "SLUG_EXISTS", "A service or redirect already uses this slug.");
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
  const authorization = await authorizeAdmin("services:manage");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Service was not found.");

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const service = await transaction.service.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!service) return false;
      const linkedProjects = await transaction.projectService.count({ where: { serviceId: id } });
      if (linkedProjects > 0) throw new LinkedContentError();
      await transaction.service.delete({ where: { id } });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "SERVICE_DELETED",
          entityType: "Service",
          entityId: id,
        },
      });
      return true;
    });
    return result
      ? apiSuccess({ deleted: true })
      : apiError(404, "NOT_FOUND", "Service was not found.");
  } catch (error) {
    if (error instanceof LinkedContentError) {
      return apiError(409, "SERVICE_IN_USE", "Remove this service from linked projects before deleting it.");
    }
    return handleApiFailure(error);
  }
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

class InvalidWorkflowTransitionError extends Error {}
class PublishPermissionRequiredError extends Error {}
class SlugRedirectCollisionError extends Error {}
class LinkedContentError extends Error {}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
