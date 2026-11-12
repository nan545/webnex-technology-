import { ProposalStatus } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { isExpiryOnOrAfterIssue, proposalDraftSchema } from "@/lib/validation/proposal";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const uuidSchema = z.string().uuid();
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeAdmin("enquiries:read");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Enquiry was not found.");
  try {
    const proposals = await prisma.proposal.findMany({
      where: { enquiryId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        scope: true,
        estimatedPrice: true,
        currency: true,
        status: true,
        issueDate: true,
        expiryDate: true,
        internalNotes: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { name: true, email: true } },
      },
    });
    return apiSuccess(proposals);
  } catch (error) {
    return handleApiFailure(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("proposals:manage");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", "Enquiry was not found.");

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = proposalDraftSchema.safeParse(rawBody);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Review proposal details and amount format.");
  if (!isExpiryOnOrAfterIssue(input.data.issueDate, input.data.expiryDate)) {
    return apiError(422, "INVALID_DATES", "Expiry date cannot be before the issue date.");
  }

  try {
    const proposal = await prisma.$transaction(async (transaction) => {
      const enquiry = await transaction.enquiry.findUnique({
        where: { id },
        select: { id: true, reference: true },
      });
      if (!enquiry) return null;
      const created = await transaction.proposal.create({
        data: {
          enquiryId: id,
          createdById: authorization.admin!.id,
          title: input.data.title,
          scope: input.data.scope,
          estimatedPrice: new Prisma.Decimal(input.data.estimatedPrice),
          currency: input.data.currency,
          issueDate: new Date(`${input.data.issueDate}T00:00:00.000Z`),
          expiryDate: input.data.expiryDate
            ? new Date(`${input.data.expiryDate}T00:00:00.000Z`)
            : null,
          internalNotes: input.data.internalNotes ?? null,
          status: ProposalStatus.DRAFT,
        },
        select: { id: true, title: true, estimatedPrice: true, currency: true, status: true },
      });
      await transaction.enquiryActivity.create({
        data: {
          enquiryId: id,
          actorId: authorization.admin!.id,
          type: "PROPOSAL_CREATED",
          description: `Proposal created: ${created.title}`,
          metadata: { proposalId: created.id, currency: created.currency, status: created.status },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "PROPOSAL_CREATED",
          entityType: "Proposal",
          entityId: created.id,
          details: { enquiryReference: enquiry.reference, currency: created.currency },
        },
      });
      return created;
    });
    return proposal
      ? apiSuccess({ ...proposal, estimatedPrice: proposal.estimatedPrice.toFixed(2) }, { status: 201 })
      : apiError(404, "NOT_FOUND", "Enquiry was not found.");
  } catch (error) {
    return handleApiFailure(error);
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
