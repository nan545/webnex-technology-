import "server-only";
import { NotificationStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { DeliveryError } from "@/server/integrations/delivery-error";
import {
  createTwilioAssignmentSender,
  normalizeAssignmentPhone,
} from "@/server/integrations/twilio-assignment-alerts";

type Channel = "sms" | "whatsapp";

export async function dispatchWorkAssignmentNotifications(batchSize = 10) {
  const sender = await createTwilioAssignmentSender();
  const staleBefore = new Date(Date.now() - 2 * 60_000);
  await Promise.all([
    prisma.workAssignmentNotification.updateMany({
      where: { smsStatus: NotificationStatus.PROCESSING, updatedAt: { lt: staleBefore } },
      data: { smsStatus: NotificationStatus.PENDING },
    }),
    prisma.workAssignmentNotification.updateMany({
      where: { whatsappStatus: NotificationStatus.PROCESSING, updatedAt: { lt: staleBefore } },
      data: { whatsappStatus: NotificationStatus.PENDING },
    }),
  ]);
  const pending = await prisma.workAssignmentNotification.findMany({
    where: {
      OR: [
        { smsStatus: NotificationStatus.PENDING, smsNextAttemptAt: { lte: new Date() } },
        { whatsappStatus: NotificationStatus.PENDING, whatsappNextAttemptAt: { lte: new Date() } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: { id: true, smsAttemptCount: true, whatsappAttemptCount: true },
  });
  const counts = { accepted: 0, retried: 0, failed: 0, skipped: 0 };

  for (const candidate of pending) {
    const notification = await prisma.workAssignmentNotification.findUnique({
      where: { id: candidate.id },
      select: {
        id: true,
        smsStatus: true,
        smsNextAttemptAt: true,
        whatsappStatus: true,
        whatsappNextAttemptAt: true,
        assignment: {
          select: {
            user: {
              select: {
                phone: true,
                isActive: true,
                smsAlertsEnabled: true,
                whatsappAlertsEnabled: true,
              },
            },
            project: { select: { title: true } },
          },
        },
      },
    });
    if (!notification) {
      counts.skipped += 1;
      continue;
    }

    for (const channel of ["sms", "whatsapp"] as const) {
      const state = channel === "sms" ? notification.smsStatus : notification.whatsappStatus;
      const nextAttemptAt = channel === "sms" ? notification.smsNextAttemptAt : notification.whatsappNextAttemptAt;
      if (state !== NotificationStatus.PENDING || nextAttemptAt > new Date()) continue;
      const outcome = await deliverChannel({
        id: notification.id,
        channel,
        attemptCount: (channel === "sms" ? candidate.smsAttemptCount : candidate.whatsappAttemptCount) + 1,
        phone: notification.assignment.user.phone,
        isActive: notification.assignment.user.isActive,
        optedIn: channel === "sms"
          ? notification.assignment.user.smsAlertsEnabled
          : notification.assignment.user.whatsappAlertsEnabled,
        title: notification.assignment.project.title,
        sender,
      });
      counts[outcome] += 1;
    }
    await refreshAggregateStatus(notification.id);
  }
  return counts;
}

async function deliverChannel(input: {
  id: string;
  channel: Channel;
  attemptCount: number;
  phone: string | null;
  isActive: boolean;
  optedIn: boolean;
  title: string;
  sender: Awaited<ReturnType<typeof createTwilioAssignmentSender>>;
}): Promise<keyof Awaited<ReturnType<typeof dispatchWorkAssignmentNotifications>>> {
  const statusField = input.channel === "sms" ? "smsStatus" : "whatsappStatus";
  const nextAttemptField = input.channel === "sms" ? "smsNextAttemptAt" : "whatsappNextAttemptAt";
  const attemptField = input.channel === "sms" ? "smsAttemptCount" : "whatsappAttemptCount";
  const errorField = input.channel === "sms" ? "smsLastError" : "whatsappLastError";
  const sentAtField = input.channel === "sms" ? "smsSentAt" : "whatsappSentAt";
  const messageIdField = input.channel === "sms" ? "smsMessageId" : "whatsappMessageId";
  const now = new Date();
  const claim = await prisma.workAssignmentNotification.updateMany({
    where: { id: input.id, [statusField]: NotificationStatus.PENDING, [nextAttemptField]: { lte: now } },
    data: { [statusField]: NotificationStatus.PROCESSING, [attemptField]: { increment: 1 } },
  });
  if (claim.count !== 1) return "skipped";

  const phone = input.phone ? normalizeAssignmentPhone(input.phone) : null;
  if (!input.isActive || !phone || !input.optedIn) {
    const reason = !input.isActive
      ? "The assigned account is inactive."
      : !phone
        ? "A valid phone number is not configured for this account."
        : `The account holder has not opted in to ${input.channel.toUpperCase()} alerts.`;
    await prisma.workAssignmentNotification.updateMany({
      where: { id: input.id, [statusField]: NotificationStatus.PROCESSING },
      data: { [statusField]: NotificationStatus.FAILED, [errorField]: reason },
    });
    return "failed";
  }

  try {
    const messageId = input.channel === "sms"
      ? await input.sender.sendSms(phone, input.title)
      : await input.sender.sendWhatsApp(phone, input.title);
    await prisma.workAssignmentNotification.updateMany({
      where: { id: input.id, [statusField]: NotificationStatus.PROCESSING },
      data: {
        [statusField]: NotificationStatus.SENT,
        [sentAtField]: new Date(),
        [messageIdField]: messageId,
        [errorField]: null,
      },
    });
    return "accepted";
  } catch (error) {
    const retry = error instanceof DeliveryError && error.transient && input.attemptCount < 5;
    const delay = Math.min(60 * 60_000, 30_000 * 2 ** (input.attemptCount - 1));
    const detail = error instanceof DeliveryError ? error.message : "Unexpected Twilio delivery error.";
    console.error(`Assignment ${input.channel} delivery failed:`, detail);
    await prisma.workAssignmentNotification.updateMany({
      where: { id: input.id, [statusField]: NotificationStatus.PROCESSING },
      data: {
        [statusField]: retry ? NotificationStatus.PENDING : NotificationStatus.FAILED,
        ...(retry ? { [nextAttemptField]: new Date(Date.now() + delay) } : {}),
        [errorField]: detail.slice(0, 500),
      },
    });
    return retry ? "retried" : "failed";
  }
}

async function refreshAggregateStatus(id: string) {
  const notification = await prisma.workAssignmentNotification.findUnique({
    where: { id },
    select: {
      smsStatus: true,
      smsLastError: true,
      whatsappStatus: true,
      whatsappLastError: true,
    },
  });
  if (!notification) return;
  const statuses = [notification.smsStatus, notification.whatsappStatus];
  const status = statuses.includes(NotificationStatus.PROCESSING)
    ? NotificationStatus.PROCESSING
    : statuses.includes(NotificationStatus.PENDING)
      ? NotificationStatus.PENDING
      : statuses.includes(NotificationStatus.FAILED)
        ? NotificationStatus.FAILED
        : NotificationStatus.SENT;
  await prisma.workAssignmentNotification.updateMany({
    where: { id },
    data: {
      status,
      lastError: notification.smsLastError ?? notification.whatsappLastError,
      ...(status === NotificationStatus.SENT ? { sentAt: new Date() } : {}),
    },
  });
}
