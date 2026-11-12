import { z } from "zod";

export const proposalDraftSchema = z.object({
  title: z.string().trim().min(2).max(200),
  scope: z.string().trim().min(10).max(20_000),
  estimatedPrice: z.string().regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/, "Enter an amount with at most two decimal places."),
  currency: z.enum(["GHS", "USD"]),
  issueDate: z.string().date(),
  expiryDate: z.string().date().nullable().optional(),
  internalNotes: z.string().trim().max(10_000).nullable().optional(),
}).strict();

export function isExpiryOnOrAfterIssue(issueDate: string, expiryDate: string | null | undefined) {
  return expiryDate === undefined || expiryDate === null || expiryDate >= issueDate;
}

export function isProposalExpired(expiryDate: Date | null | undefined, now = new Date()) {
  return expiryDate !== null &&
    expiryDate !== undefined &&
    expiryDate.toISOString().slice(0, 10) < now.toISOString().slice(0, 10);
}
