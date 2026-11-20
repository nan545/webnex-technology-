import { InvoiceStatus, Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  calculateInvoiceAmounts,
  InvoiceAmountOutOfRangeError,
  invoiceDraftSchema,
  isInvoiceDueDateValid,
} from "@/lib/validation/invoices";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { allocateInvoiceNumber } from "@/server/content/invoices";
import { prisma } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("updateDraft"), ...invoiceDraftSchema.shape }).strict(),
  z.object({
    action: z.literal("changeStatus"),
    status: z.enum([InvoiceStatus.ISSUED, InvoiceStatus.PAID, InvoiceStatus.VOID]),
  }).strict(),
]);
const invoiceIdSchema = z.string().uuid();
const allowedTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: [InvoiceStatus.ISSUED, InvoiceStatus.VOID],
  ISSUED: [InvoiceStatus.PAID, InvoiceStatus.VOID],
  PAID: [],
  VOID: [],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("proposals:manage");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!invoiceIdSchema.safeParse(id).success) {
    return apiError(404, "NOT_FOUND", "Invoice was not found.");
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = updateSchema.safeParse(rawBody);
  if (!input.success) {
    return apiError(422, "VALIDATION_FAILED", "Review the invoice update details.");
  }

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const current = await transaction.invoice.findUnique({
        where: { id },
        select: { id: true, invoiceNumber: true, status: true },
      });
      if (!current) return { kind: "not_found" as const };

      if (input.data.action === "updateDraft") {
        if (current.status !== InvoiceStatus.DRAFT) return { kind: "conflict" as const };
        if (!isInvoiceDueDateValid(input.data.issueDate, input.data.dueDate)) {
          return { kind: "invalid_dates" as const };
        }
        const amounts = calculateInvoiceAmounts(input.data);
        const updateResult = await transaction.invoice.updateMany({
          where: { id, status: InvoiceStatus.DRAFT },
          data: {
            clientName: input.data.clientName,
            clientEmail: input.data.clientEmail,
            clientPhone: input.data.clientPhone,
            billingAddress: input.data.billingAddress,
            currency: input.data.currency,
            issueDate: new Date(`${input.data.issueDate}T00:00:00.000Z`),
            dueDate: input.data.dueDate
              ? new Date(`${input.data.dueDate}T00:00:00.000Z`)
              : null,
            taxRate: new Prisma.Decimal(input.data.taxRate),
            subtotal: amounts.subtotal,
            taxAmount: amounts.taxAmount,
            total: amounts.total,
            notes: input.data.notes,
          },
        });
        if (updateResult.count !== 1) return { kind: "conflict" as const };
        const issueYear = Number(input.data.issueDate.slice(0, 4));
        const invoiceNumber = current.invoiceNumber.startsWith(`INV-${issueYear}-`)
          ? current.invoiceNumber
          : await allocateInvoiceNumber(transaction, issueYear);
        if (invoiceNumber !== current.invoiceNumber) {
          await transaction.invoice.update({ where: { id }, data: { invoiceNumber } });
        }
        await transaction.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
        await transaction.invoiceLineItem.createMany({
          data: amounts.items.map((item) => ({
            id: randomUUID(),
            invoiceId: id,
            description: item.description,
            quantity: new Prisma.Decimal(item.quantity),
            unitPrice: new Prisma.Decimal(item.unitPrice),
            amount: item.amount,
            position: item.position,
          })),
        });
        await transaction.auditLog.create({
          data: {
            actorId: authorization.admin!.id,
            action: "INVOICE_DRAFT_UPDATED",
            entityType: "Invoice",
            entityId: id,
            details: { invoiceNumber: current.invoiceNumber, updatedInvoiceNumber: invoiceNumber },
          },
        });
        return { kind: "updated" as const, status: InvoiceStatus.DRAFT };
      }

      if (!allowedTransitions[current.status].includes(input.data.status)) {
        return { kind: "conflict" as const };
      }
      const updateResult = await transaction.invoice.updateMany({
        where: { id, status: current.status },
        data: {
          status: input.data.status,
          paidAt: input.data.status === InvoiceStatus.PAID ? new Date() : null,
        },
      });
      if (updateResult.count !== 1) return { kind: "conflict" as const };
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "INVOICE_STATUS_CHANGED",
          entityType: "Invoice",
          entityId: id,
          details: {
            invoiceNumber: current.invoiceNumber,
            previousStatus: current.status,
            status: input.data.status,
          },
        },
      });
      return { kind: "updated" as const, status: input.data.status };
    });

    if (updated.kind === "not_found") return apiError(404, "NOT_FOUND", "Invoice was not found.");
    if (updated.kind === "invalid_dates") {
      return apiError(422, "INVALID_DATES", "Due date cannot be before the issue date.");
    }
    if (updated.kind === "conflict") {
      return apiError(409, "INVALID_TRANSITION", "This invoice can no longer be changed in that way.");
    }
    return apiSuccess({ id, status: updated.status });
  } catch (error) {
    if (error instanceof InvoiceAmountOutOfRangeError) {
      return apiError(422, "AMOUNT_OUT_OF_RANGE", error.message);
    }
    return handleApiFailure(error);
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
