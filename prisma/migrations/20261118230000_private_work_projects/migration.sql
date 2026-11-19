CREATE TABLE "WorkProject" (
  "id" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED',
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkProject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkProject_status_check" CHECK ("status" IN ('NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED')),
  CONSTRAINT "WorkProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "WorkProjectAssignment" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkProjectAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WorkProject"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkProjectAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WorkAssignmentNotification" (
  "id" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" VARCHAR(500),
  "sentAt" TIMESTAMP(3),
  "providerMessageId" VARCHAR(200),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkAssignmentNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkAssignmentNotification_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WorkProjectAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WorkProject_updatedAt_idx" ON "WorkProject"("updatedAt");
CREATE UNIQUE INDEX "WorkProjectAssignment_projectId_userId_key" ON "WorkProjectAssignment"("projectId", "userId");
CREATE INDEX "WorkProjectAssignment_userId_projectId_idx" ON "WorkProjectAssignment"("userId", "projectId");
CREATE UNIQUE INDEX "WorkAssignmentNotification_assignmentId_key" ON "WorkAssignmentNotification"("assignmentId");
CREATE INDEX "WorkAssignmentNotification_status_nextAttemptAt_idx" ON "WorkAssignmentNotification"("status", "nextAttemptAt");
