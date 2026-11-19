import "server-only";
import { NotificationStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import {
  escapeEmailHtml,
  getSendGridConfiguration,
  sendWithSendGrid,
  SendGridDeliveryError,
} from "@/server/integrations/sendgrid";

export async function dispatchWorkAssignmentEmails(batchSize = 20) {
  const configuration = getSendGridConfiguration();
  if (!configuration) throw new Error("SendGrid is not configured for assignment notifications.");

  await prisma.workAssignmentNotification.updateMany({
    where: { status: NotificationStatus.PROCESSING, updatedAt: { lt: new Date(Date.now() - 2 * 60_000) } },
    data: { status: NotificationStatus.PENDING },
  });
  const pending = await prisma.workAssignmentNotification.findMany({
    where: { status: NotificationStatus.PENDING, nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: { id: true },
  });
  const counts = { accepted: 0, retried: 0, failed: 0, skipped: 0 };
  for (const candidate of pending) {
    const claimed = await prisma.workAssignmentNotification.updateMany({
      where: { id: candidate.id, status: NotificationStatus.PENDING, nextAttemptAt: { lte: new Date() } },
      data: { status: NotificationStatus.PROCESSING, attemptCount: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      counts.skipped += 1;
      continue;
    }
    const notification = await prisma.workAssignmentNotification.findUnique({
      where: { id: candidate.id },
      select: {
        id: true,
        attemptCount: true,
        assignment: {
          select: {
            user: { select: { email: true, isActive: true } },
            project: { select: { title: true } },
          },
        },
      },
    });
    if (!notification) {
      counts.skipped += 1;
      continue;
    }
    if (!notification.assignment.user.isActive) {
      await prisma.workAssignmentNotification.updateMany({
        where: { id: notification.id, status: NotificationStatus.PROCESSING },
        data: { status: NotificationStatus.FAILED, lastError: "The assigned account is inactive." },
      });
      counts.failed += 1;
      continue;
    }
    const title = notification.assignment.project.title;
    const url = new URL("/admin/work-projects", configuration.siteUrl).toString();
    try {
      const providerMessageId = await sendWithSendGrid({
        outboxId: notification.id,
        to: notification.assignment.user.email,
        subject: "You have been assigned a work project",
        text: `You have been assigned to ${title}.\n\nSign in to view your projects: ${url}`,
        html: `<p>You have been assigned to <strong>${escapeEmailHtml(title)}</strong>.</p><p><a href="${escapeEmailHtml(url)}">Sign in to view your projects</a></p>`,
      }, configuration);
      await prisma.workAssignmentNotification.updateMany({
        where: { id: notification.id, status: NotificationStatus.PROCESSING },
        data: { status: NotificationStatus.SENT, sentAt: new Date(), providerMessageId, lastError: null },
      });
      counts.accepted += 1;
    } catch (error) {
      const retry = error instanceof SendGridDeliveryError && error.transient && notification.attemptCount < 5;
      const delay = Math.min(60 * 60_000, 30_000 * 2 ** (notification.attemptCount - 1));
      await prisma.workAssignmentNotification.updateMany({
        where: { id: notification.id, status: NotificationStatus.PROCESSING },
        data: {
          status: retry ? NotificationStatus.PENDING : NotificationStatus.FAILED,
          nextAttemptAt: retry ? new Date(Date.now() + delay) : undefined,
          lastError: error instanceof SendGridDeliveryError ? error.message.slice(0, 500) : "Unexpected email dispatcher error.",
        },
      });
      if (retry) counts.retried += 1;
      else counts.failed += 1;
    }
  }
  return counts;
}
