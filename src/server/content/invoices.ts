import type { Prisma } from "@/generated/prisma/client";

export async function allocateInvoiceNumber(
  transaction: Pick<Prisma.TransactionClient, "invoiceNumberCounter">,
  year: number,
) {
  const counter = await transaction.invoiceNumberCounter.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });
  return `INV-${year}-${counter.lastNumber.toString().padStart(6, "0")}`;
}
