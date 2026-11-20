ALTER TABLE "User"
  ADD COLUMN "phone" VARCHAR(40),
  ADD COLUMN "smsAlertsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappAlertsEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WorkAssignmentNotification"
  ADD COLUMN "smsStatus" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "smsAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "smsNextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "smsLastError" VARCHAR(500),
  ADD COLUMN "smsSentAt" TIMESTAMP(3),
  ADD COLUMN "smsMessageId" VARCHAR(200),
  ADD COLUMN "whatsappStatus" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "whatsappAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "whatsappNextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "whatsappLastError" VARCHAR(500),
  ADD COLUMN "whatsappSentAt" TIMESTAMP(3),
  ADD COLUMN "whatsappMessageId" VARCHAR(200);

CREATE INDEX "WorkAssignmentNotification_smsStatus_smsNextAttemptAt_idx"
  ON "WorkAssignmentNotification"("smsStatus", "smsNextAttemptAt");
CREATE INDEX "WorkAssignmentNotification_whatsappStatus_whatsappNextAttemptAt_idx"
  ON "WorkAssignmentNotification"("whatsappStatus", "whatsappNextAttemptAt");
