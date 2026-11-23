type InvoiceCounterClient = {
  invoiceNumberCounter: {
    upsert(args: {
      where: { year: number };
      create: { year: number; lastNumber: number };
      update: { lastNumber: { increment: number } };
      select: { lastNumber: true };
    }): Promise<{ lastNumber: number }>;
  };
};

export async function allocateInvoiceNumber(
  transaction: InvoiceCounterClient,
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
