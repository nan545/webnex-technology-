-- Extend public content and enquiry handling without replacing the Phase 1 baseline.

CREATE TYPE "ContactPreference" AS ENUM ('EMAIL', 'PHONE', 'EITHER');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TYPE "EnquiryStatus_new" AS ENUM (
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'PROPOSAL_SENT',
    'WON',
    'LOST'
);

ALTER TABLE "Enquiry" ADD COLUMN "legacyStatus" VARCHAR(32);
UPDATE "Enquiry"
SET "legacyStatus" = "status"::TEXT
WHERE "status"::TEXT IN ('IN_PROGRESS', 'CLOSED', 'SPAM');

ALTER TABLE "Enquiry" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Enquiry"
    ALTER COLUMN "status" TYPE "EnquiryStatus_new"
    USING (
        CASE "status"::TEXT
            WHEN 'IN_PROGRESS' THEN 'CONTACTED'
            WHEN 'CLOSED' THEN 'LOST'
            WHEN 'SPAM' THEN 'LOST'
            ELSE "status"::TEXT
        END
    )::"EnquiryStatus_new";
DROP TYPE "EnquiryStatus";
ALTER TYPE "EnquiryStatus_new" RENAME TO "EnquiryStatus";
ALTER TABLE "Enquiry" ALTER COLUMN "status" SET DEFAULT 'NEW';

CREATE TABLE "Industry" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" JSONB,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" VARCHAR(320),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Project"
    ADD COLUMN "content" JSONB,
    ADD COLUMN "industryId" UUID;

ALTER TABLE "Enquiry"
    ADD COLUMN "reference" VARCHAR(32),
    ADD COLUMN "service" VARCHAR(120),
    ADD COLUMN "budget" VARCHAR(120),
    ADD COLUMN "preferredContact" "ContactPreference",
    ADD COLUMN "idempotencyKey" UUID;

ALTER TABLE "Enquiry" RENAME COLUMN "subject" TO "legacySubject";

UPDATE "Enquiry"
SET
    "reference" = 'WNX-' || TO_CHAR("createdAt", 'YYYYMMDD') || '-' ||
        UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 12)),
    "service" = 'other',
    "preferredContact" = 'EITHER';

ALTER TABLE "Enquiry"
    ALTER COLUMN "reference" SET NOT NULL,
    ALTER COLUMN "service" SET NOT NULL,
    ALTER COLUMN "preferredContact" SET NOT NULL;

ALTER TABLE "Enquiry"
    ADD CONSTRAINT "Enquiry_reference_format_check"
        CHECK ("reference" ~ '^WNX-[0-9]{8}-[A-F0-9]{12}$'),
    ADD CONSTRAINT "Enquiry_name_length_check"
        CHECK (CHAR_LENGTH(BTRIM("name")) BETWEEN 2 AND 120) NOT VALID,
    ADD CONSTRAINT "Enquiry_email_length_check"
        CHECK (CHAR_LENGTH(BTRIM("email")) BETWEEN 3 AND 254) NOT VALID,
    ADD CONSTRAINT "Enquiry_organization_length_check"
        CHECK ("organization" IS NULL OR CHAR_LENGTH("organization") <= 160) NOT VALID,
    ADD CONSTRAINT "Enquiry_phone_length_check"
        CHECK ("phone" IS NULL OR CHAR_LENGTH("phone") <= 40) NOT VALID,
    ADD CONSTRAINT "Enquiry_budget_length_check"
        CHECK ("budget" IS NULL OR CHAR_LENGTH("budget") <= 120) NOT VALID,
    ADD CONSTRAINT "Enquiry_message_length_check"
        CHECK (CHAR_LENGTH(BTRIM("message")) BETWEEN 20 AND 5000) NOT VALID;

ALTER TABLE "SiteSetting"
    ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "NotificationOutbox" (
    "id" UUID NOT NULL,
    "enquiryId" UUID NOT NULL,
    "event" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" VARCHAR(500),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NotificationOutbox"
    ADD CONSTRAINT "NotificationOutbox_attemptCount_nonnegative_check"
    CHECK ("attemptCount" >= 0);

CREATE TABLE "RateLimitBucket" (
    "id" UUID NOT NULL,
    "identifier" VARCHAR(64) NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RateLimitBucket"
    ADD CONSTRAINT "RateLimitBucket_requestCount_positive_check"
    CHECK ("requestCount" > 0);

CREATE UNIQUE INDEX "Industry_slug_key" ON "Industry"("slug");
CREATE INDEX "Industry_status_sortOrder_idx" ON "Industry"("status", "sortOrder");
CREATE INDEX "Industry_publishedAt_idx" ON "Industry"("publishedAt");
CREATE INDEX "Project_industryId_status_publishedAt_idx"
    ON "Project"("industryId", "status", "publishedAt");
CREATE UNIQUE INDEX "Enquiry_reference_key" ON "Enquiry"("reference");
CREATE UNIQUE INDEX "Enquiry_idempotencyKey_key" ON "Enquiry"("idempotencyKey");
CREATE UNIQUE INDEX "NotificationOutbox_enquiryId_event_key"
    ON "NotificationOutbox"("enquiryId", "event");
CREATE INDEX "NotificationOutbox_status_nextAttemptAt_idx"
    ON "NotificationOutbox"("status", "nextAttemptAt");
CREATE UNIQUE INDEX "RateLimitBucket_identifier_bucketStart_key"
    ON "RateLimitBucket"("identifier", "bucketStart");
CREATE INDEX "RateLimitBucket_bucketStart_idx" ON "RateLimitBucket"("bucketStart");

ALTER TABLE "Project"
    ADD CONSTRAINT "Project_industryId_fkey"
    FOREIGN KEY ("industryId") REFERENCES "Industry"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationOutbox"
    ADD CONSTRAINT "NotificationOutbox_enquiryId_fkey"
    FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
