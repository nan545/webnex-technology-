import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const invoiceAmountSchema = z.string()
  .regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/, "Enter an amount with at most two decimal places.");

const invoiceQuantitySchema = z.string()
  .regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/, "Enter a quantity with at most three decimal places.")
  .refine((value) => Number(value) > 0, "Quantity must be greater than zero.");

const invoiceTaxRateSchema = z.string()
  .regex(/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/, "Enter a tax rate with at most two decimal places.")
  .refine((value) => Number(value) <= 100, "Tax rate cannot exceed 100%.");

const invoiceLineSchema = z.object({
  description: z.string().trim().min(2).max(500),
  quantity: invoiceQuantitySchema,
  unitPrice: invoiceAmountSchema,
}).strict();

export const invoiceDraftSchema = z.object({
  clientName: z.string().trim().min(2).max(200),
  clientEmail: z.string().trim().max(320).email().or(z.literal("")).nullable().optional()
    .transform((value) => value?.toLowerCase() || null),
  clientPhone: z.string().trim().max(40).nullable().optional()
    .transform((value) => value || null),
  billingAddress: z.string().trim().max(3_000).nullable().optional()
    .transform((value) => value || null),
  currency: z.enum(["GHS", "USD"]),
  issueDate: z.string().date(),
  dueDate: z.string().date().nullable().optional()
    .transform((value) => value ?? null),
  taxRate: invoiceTaxRateSchema,
  notes: z.string().trim().max(5_000).nullable().optional()
    .transform((value) => value || null),
  items: z.array(invoiceLineSchema).min(1).max(40),
}).strict();

export type InvoiceDraftInput = z.infer<typeof invoiceDraftSchema>;

const maximumInvoiceAmount = new Prisma.Decimal("9999999999999999.99");

export class InvoiceAmountOutOfRangeError extends Error {}

export function isInvoiceDueDateValid(issueDate: string, dueDate: string | null | undefined) {
  return dueDate === undefined || dueDate === null || dueDate >= issueDate;
}

export function calculateInvoiceAmounts(input: InvoiceDraftInput) {
  const items = input.items.map((item, position) => {
    const amount = new Prisma.Decimal(item.quantity)
      .mul(item.unitPrice)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return {
      ...item,
      position,
      amount,
    };
  });
  const subtotal = items.reduce(
    (sum, item) => sum.plus(item.amount),
    new Prisma.Decimal(0),
  );
  const taxAmount = subtotal
    .mul(input.taxRate)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const total = subtotal.plus(taxAmount);

  if (subtotal.gt(maximumInvoiceAmount) || total.gt(maximumInvoiceAmount)) {
    throw new InvoiceAmountOutOfRangeError("Invoice total exceeds the supported amount.");
  }

  return { items, subtotal, taxAmount, total };
}
