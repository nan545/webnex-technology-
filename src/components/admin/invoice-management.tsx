"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "VOID";
type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
};

export type InvoiceItem = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  billingAddress: string | null;
  currency: "GHS" | "USD";
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  taxRate: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  items: InvoiceLineItem[];
};

type FormLineItem = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

type InvoiceForm = {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  billingAddress: string;
  currency: "GHS" | "USD";
  issueDate: string;
  dueDate: string;
  taxRate: string;
  notes: string;
  items: FormLineItem[];
};

type InvoiceStatusFilter = "ALL" | InvoiceStatus | "OVERDUE";

function createEmptyForm(): InvoiceForm {
  return {
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    billingAddress: "",
    currency: "GHS",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    taxRate: "0",
    notes: "",
    items: [{ key: "line-0", description: "", quantity: "1", unitPrice: "" }],
  };
}

function formatCurrency(currency: InvoiceItem["currency"], value: string) {
  const [whole = "0", fraction = ""] = value.split(".");
  const groupedWhole = BigInt(whole).toLocaleString("en-GH");
  return `${currency} ${groupedWhole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

function statusFor(invoice: InvoiceItem, today: string): InvoiceStatus | "OVERDUE" {
  if (invoice.status === "ISSUED" && invoice.dueDate && invoice.dueDate.slice(0, 10) < today) {
    return "OVERDUE";
  }
  return invoice.status;
}

function decimalToScaled(value: string, precision: number): number | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > precision) return null;
  const scaled = Number(whole) * (10 ** precision) +
    Number(fraction.padEnd(precision, "0") || "0");
  return Number.isSafeInteger(scaled) ? scaled : null;
}

function roundPositiveDivision(value: number, divisor: number) {
  return Math.floor((value + divisor / 2) / divisor);
}

function formatCents(currency: InvoiceForm["currency"], cents: number) {
  return `${currency} ${Math.floor(cents / 100).toLocaleString("en-GH")}.${(cents % 100).toString().padStart(2, "0")}`;
}

function getPreviewTotals(form: InvoiceForm) {
  const rate = decimalToScaled(form.taxRate, 2);
  if (rate === null || rate > 10_000) return null;
  let subtotalCents = 0;

  for (const item of form.items) {
    const quantityMilli = decimalToScaled(item.quantity, 3);
    const unitPriceCents = decimalToScaled(item.unitPrice, 2);
    if (quantityMilli === null || unitPriceCents === null || quantityMilli <= 0) return null;
    const lineProduct = quantityMilli * unitPriceCents;
    if (!Number.isSafeInteger(lineProduct)) return null;
    subtotalCents += roundPositiveDivision(lineProduct, 1_000);
    if (!Number.isSafeInteger(subtotalCents)) return null;
  }

  const taxProduct = subtotalCents * rate;
  if (!Number.isSafeInteger(taxProduct)) return null;
  const taxCents = roundPositiveDivision(taxProduct, 10_000);
  const totalCents = subtotalCents + taxCents;
  if (!Number.isSafeInteger(totalCents)) return null;
  return { subtotalCents, taxCents, totalCents };
}

function formFromInvoice(invoice: InvoiceItem): InvoiceForm {
  return {
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail ?? "",
    clientPhone: invoice.clientPhone ?? "",
    billingAddress: invoice.billingAddress ?? "",
    currency: invoice.currency,
    issueDate: invoice.issueDate.slice(0, 10),
    dueDate: invoice.dueDate?.slice(0, 10) ?? "",
    taxRate: invoice.taxRate,
    notes: invoice.notes ?? "",
    items: invoice.items.map((item, index) => ({
      key: item.id || `line-${index}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}

export function InvoiceManagement({ invoices }: { invoices: InvoiceItem[] }) {
  const router = useRouter();
  const [form, setForm] = useState<InvoiceForm>(createEmptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<InvoiceItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("ALL");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const currentStatus = statusFor(invoice, today);
      const matchesStatus = statusFilter === "ALL" || currentStatus === statusFilter;
      const matchesSearch = !query ||
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.clientName.toLowerCase().includes(query) ||
        invoice.clientEmail?.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [invoices, search, statusFilter, today]);

  function startCreate() {
    setEditingId(null);
    setForm(createEmptyForm());
    setFormOpen(true);
    setViewing(null);
    setError("");
    setMessage("");
  }

  function startEdit(invoice: InvoiceItem) {
    setEditingId(invoice.id);
    setForm(formFromInvoice(invoice));
    setFormOpen(true);
    setViewing(null);
    setError("");
    setMessage("");
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingId(null);
    setError("");
  }

  async function saveInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save");
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        dueDate: form.dueDate || null,
        clientEmail: form.clientEmail || null,
        clientPhone: form.clientPhone || null,
        billingAddress: form.billingAddress || null,
        notes: form.notes || null,
        items: form.items.map(({ description, quantity, unitPrice }) => ({
          description,
          quantity,
          unitPrice,
        })),
      };
      const response = await fetch(
        editingId ? `/api/admin/v1/invoices/${editingId}` : "/api/admin/v1/invoices",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingId ? { action: "updateDraft", ...payload } : payload),
        },
      );
      const result = await response.json() as { error?: { message?: string }; data?: { invoiceNumber?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Could not save invoice.");
      setFormOpen(false);
      setEditingId(null);
      setMessage(editingId
        ? "Draft invoice updated."
        : `Draft ${result.data?.invoiceNumber ?? "invoice"} created.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save invoice.");
    } finally {
      setBusy("");
    }
  }

  async function changeStatus(invoice: InvoiceItem, status: "ISSUED" | "PAID" | "VOID") {
    if (status === "VOID" && !window.confirm(`Void invoice ${invoice.invoiceNumber}? This cannot be undone.`)) {
      return;
    }
    setBusy(invoice.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/v1/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "changeStatus", status }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Could not update invoice status.");
      setViewing(null);
      setMessage(`${invoice.invoiceNumber} marked ${status.toLowerCase()}.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update invoice status.");
    } finally {
      setBusy("");
    }
  }

  function updateLine(index: number, field: "description" | "quantity" | "unitPrice", value: string) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  const previewTotals = formOpen ? getPreviewTotals(form) : null;
  const drafts = invoices.filter((invoice) => invoice.status === "DRAFT").length;
  const outstanding = invoices.filter((invoice) => invoice.status === "ISSUED").length;
  const overdue = invoices.filter((invoice) => statusFor(invoice, today) === "OVERDUE").length;

  return (
    <div className="space-y-5">
      {message ? <p aria-live="polite" className="no-print border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p> : null}
      {error ? <p aria-live="assertive" className="no-print border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}

      <section aria-label="Invoice summary" className="no-print grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Invoices", invoices.length],
          ["Drafts", drafts],
          ["Outstanding", outstanding],
          ["Overdue", overdue],
        ].map(([label, count]) => (
          <article className="border border-border bg-white p-5" key={label}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-950">{count}</p>
          </article>
        ))}
      </section>

      {viewing ? (
        <section aria-labelledby="invoice-preview-heading" className="border border-border bg-white">
          <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="font-semibold text-navy-950" id="invoice-preview-heading">
              Invoice preview
            </h2>
            <div className="flex flex-wrap gap-2">
              <button className="button-primary" onClick={() => window.print()} type="button">Print / Save PDF</button>
              <button className="min-h-11 border border-border px-4 text-sm font-medium" onClick={() => setViewing(null)} type="button">Close</button>
            </div>
          </div>
          <article className="invoice-print-view mx-auto max-w-3xl p-6 sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
              <div>
                <p className="text-xl font-bold tracking-tight text-navy-950">WEBNEX Technologies</p>
                <p className="mt-1 text-sm text-muted">Engineering Digital Possibilities.</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-semibold text-navy-950">INVOICE</h2>
                <p className="mt-1 font-semibold">{viewing.invoiceNumber}</p>
                <p className="mt-1 text-sm text-muted">{viewing.status.replaceAll("_", " ")}</p>
              </div>
            </div>
            <div className="grid gap-6 py-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bill to</p>
                <p className="mt-2 font-semibold">{viewing.clientName}</p>
                {viewing.clientEmail ? <p className="mt-1 text-sm">{viewing.clientEmail}</p> : null}
                {viewing.clientPhone ? <p className="mt-1 text-sm">{viewing.clientPhone}</p> : null}
                {viewing.billingAddress ? <p className="mt-1 whitespace-pre-line text-sm">{viewing.billingAddress}</p> : null}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:justify-self-end">
                <dt className="text-muted">Issue date</dt>
                <dd className="text-right">{formatDate(viewing.issueDate)}</dd>
                <dt className="text-muted">Due date</dt>
                <dd className="text-right">{formatDate(viewing.dueDate)}</dd>
                {viewing.paidAt ? (
                  <>
                    <dt className="text-muted">Paid date</dt>
                    <dd className="text-right">{formatDate(viewing.paidAt)}</dd>
                  </>
                ) : null}
              </dl>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-y border-border text-xs uppercase tracking-wide text-muted">
                    <th className="py-3 pr-3 font-medium">Description</th>
                    <th className="px-3 py-3 text-right font-medium">Qty</th>
                    <th className="px-3 py-3 text-right font-medium">Unit price</th>
                    <th className="py-3 pl-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {viewing.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-3">{item.description}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(viewing.currency, item.unitPrice)}</td>
                      <td className="py-3 pl-3 text-right tabular-nums">{formatCurrency(viewing.currency, item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto mt-5 grid max-w-sm grid-cols-2 gap-x-5 gap-y-2 text-sm">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-right tabular-nums">{formatCurrency(viewing.currency, viewing.subtotal)}</dd>
              <dt className="text-muted">Tax ({viewing.taxRate}%)</dt>
              <dd className="text-right tabular-nums">{formatCurrency(viewing.currency, viewing.taxAmount)}</dd>
              <dt className="border-t border-border pt-3 font-semibold">Total due</dt>
              <dd className="border-t border-border pt-3 text-right font-semibold tabular-nums">{formatCurrency(viewing.currency, viewing.total)}</dd>
            </dl>
            {viewing.notes ? (
              <div className="mt-8 border-t border-border pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Notes</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6">{viewing.notes}</p>
              </div>
            ) : null}
          </article>
        </section>
      ) : null}

      <section className="no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy-950">Invoice records</h2>
          <button className="button-primary" onClick={startCreate} type="button">Create invoice</button>
        </div>

        {formOpen ? (
          <form className="space-y-5 border border-border bg-white p-4 sm:p-6" onSubmit={saveInvoice}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-navy-950">
                  {editingId ? "Edit draft invoice" : "New invoice draft"}
                </h3>
                <p className="mt-1 text-sm text-muted">Invoice numbers are assigned when you save the draft.</p>
              </div>
              {editingId ? <span className="text-sm font-semibold text-muted">{invoices.find((invoice) => invoice.id === editingId)?.invoiceNumber}</span> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="field-label">Client name</span>
                <input autoComplete="organization" className="field-control" maxLength={200} onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))} required value={form.clientName} />
              </label>
              <label className="block text-sm">
                <span className="field-label">Billing email (optional)</span>
                <input autoComplete="email" className="field-control" maxLength={320} onChange={(event) => setForm((current) => ({ ...current, clientEmail: event.target.value }))} type="email" value={form.clientEmail} />
              </label>
              <label className="block text-sm">
                <span className="field-label">Billing phone (optional)</span>
                <input autoComplete="tel" className="field-control" maxLength={40} onChange={(event) => setForm((current) => ({ ...current, clientPhone: event.target.value }))} type="tel" value={form.clientPhone} />
              </label>
              <label className="block text-sm">
                <span className="field-label">Currency</span>
                <select className="field-control" onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value as InvoiceForm["currency"] }))} value={form.currency}>
                  <option value="GHS">GHS</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="field-label">Billing address (optional)</span>
                <textarea autoComplete="street-address" className="field-control min-h-20" maxLength={3_000} onChange={(event) => setForm((current) => ({ ...current, billingAddress: event.target.value }))} value={form.billingAddress} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="field-label">Issue date</span>
                <input className="field-control" onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value }))} required type="date" value={form.issueDate} />
              </label>
              <label className="block text-sm">
                <span className="field-label">Due date (optional)</span>
                <input className="field-control" min={form.issueDate || undefined} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} type="date" value={form.dueDate} />
              </label>
              <label className="block text-sm">
                <span className="field-label">Tax rate (%)</span>
                <input className="field-control" inputMode="decimal" max="100" onChange={(event) => setForm((current) => ({ ...current, taxRate: event.target.value }))} placeholder="0" required value={form.taxRate} />
              </label>
            </div>

            <fieldset className="space-y-3">
              <legend className="font-semibold text-navy-950">Line items</legend>
              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div className="grid gap-3 border border-border bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_110px_150px_auto]" key={item.key}>
                    <label className="block text-sm">
                      <span className="field-label">Description</span>
                      <input className="field-control" maxLength={500} onChange={(event) => updateLine(index, "description", event.target.value)} required value={item.description} />
                    </label>
                    <label className="block text-sm">
                      <span className="field-label">Quantity</span>
                      <input className="field-control" inputMode="decimal" onChange={(event) => updateLine(index, "quantity", event.target.value)} required value={item.quantity} />
                    </label>
                    <label className="block text-sm">
                      <span className="field-label">Unit price</span>
                      <input className="field-control" inputMode="decimal" onChange={(event) => updateLine(index, "unitPrice", event.target.value)} required value={item.unitPrice} />
                    </label>
                    <button
                      aria-label={`Remove line item ${index + 1}`}
                      className="min-h-11 self-end border border-border bg-white px-3 text-sm text-navy-800 hover:bg-slate-100 disabled:opacity-50"
                      disabled={form.items.length === 1}
                      onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  className="min-h-11 border border-border px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                  disabled={form.items.length >= 40}
                  onClick={() => setForm((current) => ({
                    ...current,
                    items: [...current.items, { key: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "" }],
                  }))}
                  type="button"
                >
                  Add line item
                </button>
                <dl className="grid min-w-64 grid-cols-2 gap-x-4 gap-y-1 text-right text-sm">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="tabular-nums">{previewTotals ? formatCents(form.currency, previewTotals.subtotalCents) : "—"}</dd>
                  <dt className="text-muted">Tax</dt>
                  <dd className="tabular-nums">{previewTotals ? formatCents(form.currency, previewTotals.taxCents) : "—"}</dd>
                  <dt className="font-semibold">Total</dt>
                  <dd className="font-semibold tabular-nums">{previewTotals ? formatCents(form.currency, previewTotals.totalCents) : "—"}</dd>
                </dl>
              </div>
            </fieldset>

            <label className="block text-sm">
              <span className="field-label">Invoice notes (optional)</span>
              <textarea className="field-control min-h-20" maxLength={5_000} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} value={form.notes} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="button-primary" disabled={busy !== ""} type="submit">
                {busy === "save" ? "Saving…" : editingId ? "Save draft changes" : "Save draft"}
              </button>
              <button className="min-h-11 border border-border px-4 text-sm font-medium" disabled={busy !== ""} onClick={cancelForm} type="button">Cancel</button>
            </div>
          </form>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <label className="block text-sm">
            <span className="sr-only">Search invoices</span>
            <input className="field-control" onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice number, client, or email" type="search" value={search} />
          </label>
          <label className="block text-sm">
            <span className="sr-only">Filter invoices by status</span>
            <select className="field-control" onChange={(event) => setStatusFilter(event.target.value as InvoiceStatusFilter)} value={statusFilter}>
              <option value="ALL">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ISSUED">Issued</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Void</option>
            </select>
          </label>
        </div>

        {filteredInvoices.length ? (
          <div className="overflow-x-auto border border-border bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Issue / due</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvoices.map((invoice) => {
                  const currentStatus = statusFor(invoice, today);
                  return (
                    <tr key={invoice.id}>
                      <td className="px-4 py-4 font-semibold text-navy-950">{invoice.invoiceNumber}</td>
                      <td className="px-4 py-4">
                        <p>{invoice.clientName}</p>
                        {invoice.clientEmail ? <p className="mt-1 text-xs text-muted">{invoice.clientEmail}</p> : null}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted">
                        <p>Issued {formatDate(invoice.issueDate)}</p>
                        {invoice.dueDate ? <p className="mt-1">Due {formatDate(invoice.dueDate)}</p> : null}
                      </td>
                      <td className="px-4 py-4 text-right font-medium tabular-nums">{formatCurrency(invoice.currency, invoice.total)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex border px-2 py-1 text-xs font-medium ${currentStatus === "PAID" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : currentStatus === "OVERDUE" ? "border-red-200 bg-red-50 text-red-800" : "border-border bg-slate-50 text-navy-800"}`}>
                          {currentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button className="min-h-9 border border-border px-3 text-xs font-medium hover:bg-slate-50" onClick={() => { setViewing(invoice); setFormOpen(false); }} type="button">View / print</button>
                          {invoice.status === "DRAFT" ? (
                            <>
                              <button className="min-h-9 border border-border px-3 text-xs font-medium hover:bg-slate-50" disabled={busy !== ""} onClick={() => startEdit(invoice)} type="button">Edit draft</button>
                              <button className="min-h-9 border border-blue-200 px-3 text-xs font-medium text-blue-800 hover:bg-blue-50" disabled={busy !== ""} onClick={() => void changeStatus(invoice, "ISSUED")} type="button">Mark issued</button>
                              <button className="min-h-9 border border-border px-3 text-xs font-medium hover:bg-slate-50" disabled={busy !== ""} onClick={() => void changeStatus(invoice, "VOID")} type="button">Void</button>
                            </>
                          ) : null}
                          {invoice.status === "ISSUED" ? (
                            <>
                              <button className="min-h-9 border border-emerald-200 px-3 text-xs font-medium text-emerald-800 hover:bg-emerald-50" disabled={busy !== ""} onClick={() => void changeStatus(invoice, "PAID")} type="button">Mark paid</button>
                              <button className="min-h-9 border border-border px-3 text-xs font-medium hover:bg-slate-50" disabled={busy !== ""} onClick={() => void changeStatus(invoice, "VOID")} type="button">Void</button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="border border-dashed border-border bg-white px-5 py-10 text-center text-sm text-muted">
            {invoices.length ? "No invoices match these filters." : "No invoices have been created yet."}
          </p>
        )}
      </section>
    </div>
  );
}
