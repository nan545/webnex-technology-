CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

CREATE TABLE "InvoiceNumberCounter" (
  "year" INTEGER NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "InvoiceNumberCounter_pkey" PRIMARY KEY ("year")
);

CREATE TABLE "Invoice" (
  "id" UUID NOT NULL,
  "invoiceNumber" VARCHAR(32) NOT NULL,
  "createdById" UUID,
  "clientName" VARCHAR(200) NOT NULL,
  "clientEmail" VARCHAR(320),
  "clientPhone" VARCHAR(40),
  "billingAddress" TEXT,
  "currency" "ProposalCurrency" NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "issueDate" DATE NOT NULL,
  "dueDate" DATE,
  "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(18,2) NOT NULL,
  "taxAmount" DECIMAL(18,2) NOT NULL,
  "total" DECIMAL(18,2) NOT NULL,
  "notes" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceLineItem" (
  "id" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "position" INTEGER NOT NULL,

  CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");
CREATE INDEX "Invoice_clientName_createdAt_idx" ON "Invoice"("clientName", "createdAt");
CREATE UNIQUE INDEX "InvoiceLineItem_invoiceId_position_key" ON "InvoiceLineItem"("invoiceId", "position");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceLineItem"
  ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
