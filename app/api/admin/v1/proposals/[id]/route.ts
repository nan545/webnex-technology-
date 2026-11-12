import { EnquiryStatus, ProposalStatus } from "@/generated/prisma/client";
import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";
import { isProposalExpired } from "@/lib/validation/proposal";

const proposalStatuses = {
  DRAFT: [ProposalStatus.SENT],
  SENT: [ProposalStatus.ACCEPTED, ProposalStatus.REJECTED, ProposalStatus.EXPIRED],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
} satisfies Record<ProposalStatus, ProposalStatus[]>;

const updateSchema = z.object({ status: z.nativeEnum(ProposalStatus) }).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("proposals:manage");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return apiError(404, "NOT_FOUND", "Proposal was not found.");
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = updateSchema.safeParse(rawBody);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Proposal status is invalid.");

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const proposal = await transaction.proposal.findUnique({
        where: { id },
        select: { id: true, title: true, status: true, enquiryId: true, expiryDate: true },
      });
      if (!proposal) return null;
      const allowedNextStatuses: ProposalStatus[] = proposalStatuses[proposal.status];
      if (!allowedNextStatuses.includes(input.data.status)) {
        throw new InvalidProposalTransitionError();
      }
      if (input.data.status === ProposalStatus.SENT && isProposalExpired(proposal.expiryDate)) {
        throw new ExpiredProposalError();
      }
      const updatedProposal = await transaction.proposal.update({
        where: { id },
        data: { status: input.data.status },
        select: { id: true, title: true, status: true, estimatedPrice: true, currency: true },
      });
      await transaction.enquiryActivity.create({
        data: {
          enquiryId: proposal.enquiryId,
          actorId: authorization.admin!.id,
          type: "PROPOSAL_STATUS_CHANGED",
          description: `Proposal "${proposal.title}" changed from ${proposal.status} to ${input.data.status}.`,
          metadata: { proposalId: id, previousStatus: proposal.status, status: input.data.status },
        },
      });
      if (input.data.status === ProposalStatus.SENT || input.data.status === ProposalStatus.ACCEPTED) {
        const status = input.data.status === ProposalStatus.ACCEPTED
          ? EnquiryStatus.WON
          : EnquiryStatus.PROPOSAL_SENT;
        const enquiry = await transaction.enquiry.findUnique({
          where: { id: proposal.enquiryId },
          select: { status: true },
        });
        if (enquiry && enquiry.status !== EnquiryStatus.WON && enquiry.status !== EnquiryStatus.LOST) {
          await transaction.enquiry.update({ where: { id: proposal.enquiryId }, data: { status } });
          await transaction.enquiryActivity.create({
            data: {
              enquiryId: proposal.enquiryId,
              actorId: authorization.admin!.id,
              type: "STATUS_CHANGED",
              description: `Lead moved to ${status.replaceAll("_", " ")} after proposal status changed.`,
              metadata: { status, proposalId: id },
            },
          });
        }
      }
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "PROPOSAL_STATUS_CHANGED",
          entityType: "Proposal",
          entityId: id,
          details: { previousStatus: proposal.status, status: input.data.status },
        },
      });
      return updatedProposal;
    });
    return updated
      ? apiSuccess({ ...updated, estimatedPrice: updated.estimatedPrice.toFixed(2) })
      : apiError(404, "NOT_FOUND", "Proposal was not found.");
  } catch (error) {
    if (error instanceof InvalidProposalTransitionError) {
      return apiError(409, "INVALID_TRANSITION", "This proposal status transition is not allowed.");
    }
    if (error instanceof ExpiredProposalError) {
      return apiError(409, "PROPOSAL_EXPIRED", "An expired proposal cannot be marked as sent.");
    }
    return handleApiFailure(error);
  }
}

class InvalidProposalTransitionError extends Error {}
class ExpiredProposalError extends Error {}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
