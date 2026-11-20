import { InvoiceStatus, Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
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

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("proposals:manage");
  if (authorization.response) return authorization.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = invoiceDraftSchema.safeParse(rawBody);
  if (!input.success) {
    return apiError(422, "VALIDATION_FAILED", "Review the client, dates, tax rate, and line items.");
  }
  if (!isInvoiceDueDateValid(input.data.issueDate, input.data.dueDate)) {
    return apiError(422, "INVALID_DATES", "Due date cannot be before the issue date.");
  }

  try {
    const amounts = calculateInvoiceAmounts(input.data);
    const invoice = await prisma.$transaction(async (transaction) => {
      const invoiceNumber = await allocateInvoiceNumber(
        transaction,
        Number(input.data.issueDate.slice(0, 4)),
      );
      const created = await transaction.invoice.create({
        data: {
          invoiceNumber,
          createdById: authorization.admin!.id,
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
          status: InvoiceStatus.DRAFT,
          items: {
            create: amounts.items.map((item) => ({
              id: randomUUID(),
              description: item.description,
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: new Prisma.Decimal(item.unitPrice),
              amount: item.amount,
              position: item.position,
            })),
          },
        },
        select: { id: true, invoiceNumber: true, currency: true, total: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "INVOICE_CREATED",
          entityType: "Invoice",
          entityId: created.id,
          details: {
            invoiceNumber: created.invoiceNumber,
            currency: created.currency,
            total: created.total.toFixed(2),
          },
        },
      });
      return created;
    });

    return apiSuccess(
      { id: invoice.id, invoiceNumber: invoice.invoiceNumber, status: InvoiceStatus.DRAFT },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof InvoiceAmountOutOfRangeError) {
      return apiError(422, "AMOUNT_OUT_OF_RANGE", error.message);
    }
    return handleApiFailure(error);
  }
}

export async function GET() {
  const authorization = await authorizeAdmin("proposals:manage");
  if (authorization.response) return authorization.response;
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: [{ createdAt: "desc" }, { invoiceNumber: "desc" }],
      take: 100,
      select: {
        id: true,
        invoiceNumber: true,
        clientName: true,
        clientEmail: true,
        clientPhone: true,
        billingAddress: true,
        currency: true,
        status: true,
        issueDate: true,
        dueDate: true,
        taxRate: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        notes: true,
        paidAt: true,
        createdAt: true,
        items: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            amount: true,
            position: true,
          },
        },
      },
    });
    return apiSuccess(invoices.map((invoice) => ({
      ...invoice,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate?.toISOString() ?? null,
      taxRate: invoice.taxRate.toFixed(2),
      subtotal: invoice.subtotal.toFixed(2),
      taxAmount: invoice.taxAmount.toFixed(2),
      total: invoice.total.toFixed(2),
      paidAt: invoice.paidAt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
      items: invoice.items.map((item) => ({
        ...item,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toFixed(2),
        amount: item.amount.toFixed(2),
      })),
    })));
  } catch (error) {
    return handleApiFailure(error);
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
