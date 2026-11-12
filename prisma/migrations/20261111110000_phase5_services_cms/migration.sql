ALTER TYPE "ContentStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "ContentStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "ContentStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

ALTER TABLE "Service"
    ADD COLUMN "updatedById" UUID,
    ADD COLUMN "scheduledAt" TIMESTAMP(3);

CREATE INDEX "Service_scheduledAt_idx" ON "Service"("scheduledAt");

ALTER TABLE "Service"
    ADD CONSTRAINT "Service_updatedById_fkey"
        FOREIGN KEY ("updatedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ServiceRevision" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "authorId" UUID,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "content" JSONB,
    "status" "ContentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceRevision_revision_positive_check" CHECK ("revision" > 0),
    CONSTRAINT "ServiceRevision_serviceId_fkey"
        FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceRevision_authorId_fkey"
        FOREIGN KEY ("authorId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ServiceRevision_serviceId_revision_key"
    ON "ServiceRevision"("serviceId", "revision");
CREATE INDEX "ServiceRevision_authorId_createdAt_idx"
    ON "ServiceRevision"("authorId", "createdAt");

CREATE TABLE "ServiceRedirect" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "sourceSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRedirect_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceRedirect_serviceId_fkey"
        FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ServiceRedirect_sourceSlug_key" ON "ServiceRedirect"("sourceSlug");
CREATE INDEX "ServiceRedirect_serviceId_idx" ON "ServiceRedirect"("serviceId");
