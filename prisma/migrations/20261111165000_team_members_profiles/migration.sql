ALTER TABLE "TeamMember"
    ADD COLUMN "slug" TEXT,
    ADD COLUMN "department" VARCHAR(120),
    ADD COLUMN "linkedinUrl" VARCHAR(2048),
    ADD COLUMN "githubUrl" VARCHAR(2048),
    ADD COLUMN "portfolioUrl" VARCHAR(2048),
    ADD COLUMN "otherSocialLinks" JSONB,
    ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "profileImageId" UUID,
    ADD COLUMN "publishedAt" TIMESTAMP(3);

UPDATE "TeamMember"
SET "slug" =
    COALESCE(
        NULLIF(
            TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(BTRIM("name")), '[^a-z0-9]+', '-', 'g')),
            ''
        ),
        'team-member'
    ) || '-' || REPLACE("id"::TEXT, '-', '');

UPDATE "TeamMember"
SET "publishedAt" = "updatedAt"
WHERE "status" = 'PUBLISHED';

ALTER TABLE "TeamMember"
    ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "TeamMember_slug_key" ON "TeamMember"("slug");
CREATE INDEX "TeamMember_status_isActive_sortOrder_idx"
    ON "TeamMember"("status", "isActive", "sortOrder");
CREATE INDEX "TeamMember_profileImageId_idx" ON "TeamMember"("profileImageId");

ALTER TABLE "TeamMember"
    ADD CONSTRAINT "TeamMember_profileImageId_fkey"
        FOREIGN KEY ("profileImageId") REFERENCES "MediaAsset"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeamMember"
    ADD CONSTRAINT "TeamMember_name_check"
        CHECK (CHAR_LENGTH(BTRIM("name")) BETWEEN 2 AND 120) NOT VALID,
    ADD CONSTRAINT "TeamMember_title_check"
        CHECK (CHAR_LENGTH(BTRIM("title")) BETWEEN 2 AND 120) NOT VALID,
    ADD CONSTRAINT "TeamMember_sortOrder_check"
        CHECK ("sortOrder" BETWEEN 0 AND 100000) NOT VALID;
