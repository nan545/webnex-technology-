import { InvoiceManagement, type InvoiceItem } from "@/components/admin/invoice-management";
import { requireAdminPage } from "@/server/auth/admin-page";
import { prisma } from "@/server/db";

export const metadata = { title: "Invoices | WEBNEX Admin" };

export default async function InvoicesPage() {
  await requireAdminPage("proposals:manage");
  const records = await prisma.invoice.findMany({
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
  const invoices: InvoiceItem[] = records.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientPhone: invoice.clientPhone,
    billingAddress: invoice.billingAddress,
    currency: invoice.currency,
    status: invoice.status,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate?.toISOString() ?? null,
    taxRate: invoice.taxRate.toFixed(2),
    subtotal: invoice.subtotal.toFixed(2),
    taxAmount: invoice.taxAmount.toFixed(2),
    total: invoice.total.toFixed(2),
    notes: invoice.notes,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toFixed(2),
      amount: item.amount.toFixed(2),
    })),
  }));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-700">Finance</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">Invoices</h1>
        <p className="mt-2 text-sm text-muted">
          Create, track, and print customer invoices. The latest 100 invoices are shown.
        </p>
      </header>
      <InvoiceManagement invoices={invoices} />
    </div>
  );
}
