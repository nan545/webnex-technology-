ALTER TYPE "EnquiryStatus" ADD VALUE IF NOT EXISTS 'NEGOTIATION';

CREATE TYPE "EnquiryActivityType" AS ENUM (
    'ENQUIRY_RECEIVED',
    'NOTE_ADDED',
    'STATUS_CHANGED',
    'ASSIGNED',
    'FOLLOW_UP_SET',
    'FOLLOW_UP_COMPLETED',
    'PHONE_CONTACT',
    'EMAIL_CONTACT',
    'WHATSAPP_LINK_OPENED',
    'MEETING',
    'PROPOSAL_CREATED',
    'PROPOSAL_STATUS_CHANGED'
);

CREATE TYPE "ProposalStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED'
);

CREATE TYPE "ProposalCurrency" AS ENUM ('GHS', 'USD');

ALTER TABLE "Enquiry"
    ADD COLUMN "lastContactAt" TIMESTAMP(3),
    ADD COLUMN "whatsappConsentAt" TIMESTAMP(3);

ALTER TABLE "NotificationOutbox"
    ADD COLUMN "providerMessageId" VARCHAR(200);

CREATE TABLE "EnquiryActivity" (
    "id" UUID NOT NULL,
    "enquiryId" UUID NOT NULL,
    "actorId" UUID,
    "type" "EnquiryActivityType" NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnquiryActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FollowUpTask" (
    "id" UUID NOT NULL,
    "enquiryId" UUID NOT NULL,
    "assignedToId" UUID,
    "createdById" UUID,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FollowUpTask_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FollowUpTask_title_check" CHECK (CHAR_LENGTH(BTRIM("title")) BETWEEN 2 AND 160)
);

CREATE TABLE "Proposal" (
    "id" UUID NOT NULL,
    "enquiryId" UUID NOT NULL,
    "createdById" UUID,
    "title" VARCHAR(200) NOT NULL,
    "scope" TEXT NOT NULL,
    "estimatedPrice" DECIMAL(18,2) NOT NULL,
    "currency" "ProposalCurrency" NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" DATE NOT NULL,
    "expiryDate" DATE,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Proposal_estimatedPrice_nonnegative_check" CHECK ("estimatedPrice" >= 0),
    CONSTRAINT "Proposal_expiry_after_issue_check" CHECK ("expiryDate" IS NULL OR "expiryDate" >= "issueDate"),
    CONSTRAINT "Proposal_title_check" CHECK (CHAR_LENGTH(BTRIM("title")) BETWEEN 2 AND 200)
);

CREATE INDEX "EnquiryActivity_enquiryId_createdAt_idx" ON "EnquiryActivity"("enquiryId", "createdAt");
CREATE INDEX "EnquiryActivity_actorId_createdAt_idx" ON "EnquiryActivity"("actorId", "createdAt");
CREATE INDEX "EnquiryActivity_type_createdAt_idx" ON "EnquiryActivity"("type", "createdAt");
CREATE INDEX "FollowUpTask_assignedToId_completedAt_dueAt_idx" ON "FollowUpTask"("assignedToId", "completedAt", "dueAt");
CREATE INDEX "FollowUpTask_enquiryId_dueAt_idx" ON "FollowUpTask"("enquiryId", "dueAt");
CREATE INDEX "Proposal_enquiryId_createdAt_idx" ON "Proposal"("enquiryId", "createdAt");
CREATE INDEX "Proposal_status_expiryDate_idx" ON "Proposal"("status", "expiryDate");

ALTER TABLE "EnquiryActivity"
    ADD CONSTRAINT "EnquiryActivity_enquiryId_fkey"
        FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "EnquiryActivity_actorId_fkey"
        FOREIGN KEY ("actorId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FollowUpTask"
    ADD CONSTRAINT "FollowUpTask_enquiryId_fkey"
        FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "FollowUpTask_assignedToId_fkey"
        FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "FollowUpTask_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Proposal"
    ADD CONSTRAINT "Proposal_enquiryId_fkey"
        FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "Proposal_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
