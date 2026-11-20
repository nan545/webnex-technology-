import assert from "node:assert/strict";
import test from "node:test";
import { POST as createInvoice } from "../app/api/admin/v1/invoices/route";
import {
  calculateInvoiceAmounts,
  InvoiceAmountOutOfRangeError,
  invoiceDraftSchema,
  isInvoiceDueDateValid,
} from "../src/lib/validation/invoices";
import { allocateInvoiceNumber } from "../src/server/content/invoices";
import { prisma } from "../src/server/db";

const validInvoice = {
  clientName: "Ada Example Ltd",
  clientEmail: " ADA@EXAMPLE.COM ",
  clientPhone: "",
  billingAddress: "",
  currency: "GHS",
  issueDate: "2026-11-20",
  dueDate: "2026-11-30",
  taxRate: "15",
  notes: "",
  items: [
    { description: "Design work", quantity: "1.5", unitPrice: "10.25" },
    { description: "Materials", quantity: "2", unitPrice: "0.03" },
  ],
};

test("invoice validation normalizes optional client fields and calculates rounded totals", () => {
  const parsed = invoiceDraftSchema.safeParse(validInvoice);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.clientEmail, "ada@example.com");
  assert.equal(parsed.data.clientPhone, null);
  assert.equal(parsed.data.billingAddress, null);

  const totals = calculateInvoiceAmounts(parsed.data);
  assert.deepEqual(totals.items.map((item) => item.amount.toFixed(2)), ["15.38", "0.06"]);
  assert.equal(totals.subtotal.toFixed(2), "15.44");
  assert.equal(totals.taxAmount.toFixed(2), "2.32");
  assert.equal(totals.total.toFixed(2), "17.76");
});

test("invoice validation rejects bad dates, tax rates, quantities, and excessive totals", () => {
  assert.equal(isInvoiceDueDateValid("2026-11-20", "2026-11-19"), false);
  assert.equal(isInvoiceDueDateValid("2026-11-20", "2026-11-20"), true);
  assert.equal(invoiceDraftSchema.safeParse({ ...validInvoice, taxRate: "100.01" }).success, false);
  assert.equal(invoiceDraftSchema.safeParse({
    ...validInvoice,
    items: [{ description: "Work", quantity: "0", unitPrice: "1.00" }],
  }).success, false);

  const parsed = invoiceDraftSchema.parse({
    ...validInvoice,
    items: [{ description: "Work", quantity: "999999999", unitPrice: "9999999999999999" }],
  });
  assert.throws(() => calculateInvoiceAmounts(parsed), InvoiceAmountOutOfRangeError);
});

test("invoice creation rejects cross-origin mutations", async () => {
  const response = await createInvoice(new Request("http://localhost/api/admin/v1/invoices", {
    method: "POST",
    headers: { Origin: "https://untrusted.invalid", "Content-Type": "application/json" },
    body: "{}",
  }));
  assert.equal(response.status, 403);
});

test("invoice numbers increment atomically in separate issue-year counters", async (t) => {
  const counter = prisma.invoiceNumberCounter;
  const originalUpsert = counter.upsert;
  const numbers = new Map<number, number>();
  Object.defineProperty(counter, "upsert", {
    configurable: true,
    value: async (args: {
      where: { year: number };
      create: { year: number; lastNumber: number };
      update: { lastNumber: { increment: number } };
    }) => {
      const current = numbers.get(args.where.year) ??
        args.create.lastNumber - args.update.lastNumber.increment;
      const next = current + args.update.lastNumber.increment;
      numbers.set(args.where.year, next);
      return { lastNumber: next };
    },
  });
  t.after(() => Object.defineProperty(counter, "upsert", { configurable: true, value: originalUpsert }));

  assert.equal(await allocateInvoiceNumber(prisma, 2026), "INV-2026-000001");
  assert.equal(await allocateInvoiceNumber(prisma, 2026), "INV-2026-000002");
  assert.equal(await allocateInvoiceNumber(prisma, 2027), "INV-2027-000001");
});
