import { ContentStatus, Prisma } from "@/generated/prisma/client";
import { teamMemberUpdateSchema } from "@/lib/validation/team-member";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { removeUnreferencedTeamPhoto } from "@/server/content/team-photo-cleanup";
import { prisma, runInTransaction } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";
import { z } from "zod";

const uuidSchema = z.string().uuid();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Team member was not found.");
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = teamMemberUpdateSchema.safeParse(rawBody);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Review the team member changes.");

  const requiredPermission = input.data.status === "PUBLISHED" || input.data.status === "ARCHIVED" || input.data.status === "DRAFT"
    ? "team:publish"
    : input.data.status === "APPROVED"
      ? "content:approve"
      : "team:update";
  const authorization = await authorizeAdmin(requiredPermission);
  if (authorization.response) return authorization.response;
  const includesFieldUpdates = Object.keys(input.data).some((key) => key !== "status");
  if (includesFieldUpdates && !authorization.admin!.permissions.has("team:update")) {
    return apiError(403, "FORBIDDEN", "You do not have permission to edit team profile details.");
  }

  try {
    const updated = await runInTransaction(async (transaction) => {
      const current = await transaction.teamMember.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          status: true,
          isActive: true,
          publishedAt: true,
        },
      });
      if (!current) return null;

      const requestedStatus = input.data.status
        ? ContentStatus[input.data.status]
        : undefined;
      if (
        requestedStatus === ContentStatus.IN_REVIEW &&
        current.status !== ContentStatus.DRAFT &&
        current.status !== ContentStatus.IN_REVIEW
      ) {
        throw new InvalidTeamWorkflowError();
      }
      if (
        requestedStatus === ContentStatus.APPROVED &&
        current.status !== ContentStatus.IN_REVIEW &&
        current.status !== ContentStatus.APPROVED
      ) {
        throw new InvalidTeamWorkflowError();
      }
      if (
        requestedStatus === ContentStatus.PUBLISHED &&
        current.status !== ContentStatus.APPROVED &&
        current.status !== ContentStatus.PUBLISHED
      ) {
        throw new InvalidTeamWorkflowError();
      }
      if (
        current.status === ContentStatus.PUBLISHED &&
        includesFieldUpdates &&
        !authorization.admin!.permissions.has("team:publish")
      ) {
        throw new PublishPermissionRequiredError();
      }

      const data: Prisma.TeamMemberUpdateInput = {
        ...(input.data.name !== undefined ? { name: input.data.name } : {}),
        ...(input.data.title !== undefined ? { title: input.data.title } : {}),
        ...(input.data.department !== undefined ? { department: input.data.department } : {}),
        ...(input.data.biography !== undefined ? { biography: input.data.biography } : {}),
        ...(input.data.linkedinUrl !== undefined ? { linkedinUrl: input.data.linkedinUrl } : {}),
        ...(input.data.githubUrl !== undefined ? { githubUrl: input.data.githubUrl } : {}),
        ...(input.data.portfolioUrl !== undefined ? { portfolioUrl: input.data.portfolioUrl } : {}),
        ...(input.data.otherSocialLinks !== undefined
          ? { otherSocialLinks: input.data.otherSocialLinks as Prisma.InputJsonValue }
          : {}),
        ...(input.data.sortOrder !== undefined ? { sortOrder: input.data.sortOrder } : {}),
        ...(input.data.isActive !== undefined ? { isActive: input.data.isActive } : {}),
        ...(requestedStatus !== undefined ? { status: requestedStatus } : {}),
        ...(requestedStatus === ContentStatus.PUBLISHED
          ? { publishedAt: current.publishedAt ?? new Date() }
          : requestedStatus !== undefined
            ? { publishedAt: null }
            : {}),
      };
      const member = await transaction.teamMember.update({
        where: { id },
        data,
        select: { id: true, slug: true, name: true, status: true, isActive: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: requestedStatus ? `TEAM_MEMBER_${requestedStatus}` : "TEAM_MEMBER_UPDATED",
          entityType: "TeamMember",
          entityId: id,
          details: {
            status: member.status,
            isActive: member.isActive,
            fields: Object.keys(input.data).filter((key) => key !== "status"),
          },
        },
      });
      return member;
    });
    return updated
      ? apiSuccess(updated)
      : apiError(404, "NOT_FOUND", "Team member was not found.");
  } catch (error) {
    if (error instanceof InvalidTeamWorkflowError) {
      return apiError(409, "INVALID_WORKFLOW", "Follow the review and approval steps before publishing this profile.");
    }
    if (error instanceof PublishPermissionRequiredError) {
      return apiError(403, "PUBLISH_PERMISSION_REQUIRED", "Changing an active published profile requires publication permission.");
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
  const authorization = await authorizeAdmin("team:delete");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Team member was not found.");

  try {
    const member = await runInTransaction(async (transaction) => {
      const current = await transaction.teamMember.findUnique({
        where: { id },
        select: { id: true, name: true, status: true, profileImageId: true },
      });
      if (!current) return null;
      if (
        current.status === ContentStatus.PUBLISHED &&
        !authorization.admin!.permissions.has("team:publish")
      ) {
        throw new PublishPermissionRequiredError();
      }
      await transaction.teamMember.delete({ where: { id } });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "TEAM_MEMBER_DELETED",
          entityType: "TeamMember",
          entityId: id,
          details: { profileImageId: current.profileImageId },
        },
      });
      return current;
    });
    if (!member) return apiError(404, "NOT_FOUND", "Team member was not found.");
    const storageCleanupPending = member.profileImageId
      ? !(await removeUnreferencedTeamPhoto(member.profileImageId))
      : false;
    return apiSuccess({ deleted: true, storageCleanupPending });
  } catch (error) {
    if (error instanceof PublishPermissionRequiredError) {
      return apiError(403, "PUBLISH_PERMISSION_REQUIRED", "Deleting a published profile requires publication permission.");
    }
    return handleApiFailure(error);
  }
}

class InvalidTeamWorkflowError extends Error {}
class PublishPermissionRequiredError extends Error {}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
