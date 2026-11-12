ALTER TABLE "User"
    ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "lockedUntil" TIMESTAMP(3),
    ADD COLUMN "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "User"
    ADD CONSTRAINT "User_sessionVersion_nonnegative_check"
        CHECK ("sessionVersion" >= 0),
    ADD CONSTRAINT "User_failedLoginAttempts_nonnegative_check"
        CHECK ("failedLoginAttempts" >= 0);

CREATE INDEX "User_isActive_lockedUntil_idx" ON "User"("isActive", "lockedUntil");

ALTER TABLE "Enquiry"
    ADD COLUMN "followUpAt" TIMESTAMP(3);

CREATE INDEX "Enquiry_followUpAt_idx" ON "Enquiry"("followUpAt");
