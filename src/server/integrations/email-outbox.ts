import "server-only";
import { NotificationStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { runAsDatabaseActor } from "@/server/db-context";
import {
  escapeEmailHtml,
  getSendGridConfiguration,
  sendWithSendGrid,
  SendGridDeliveryError,
  type OutgoingEmail,
} from "@/server/integrations/sendgrid";

const maximumAttempts = 5;

export function dispatchEmailOutbox(batchSize = 20) {
  return runAsDatabaseActor({ kind: "system" }, () => dispatchPending(batchSize));
}

async function dispatchPending(batchSize: number) {
  const configuration = getSendGridConfiguration();
  if (!configuration) {
    throw new Error(
      "SendGrid is not configured. Set SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, NOTIFICATION_TO_EMAIL, and a valid NEXT_PUBLIC_SITE_URL.",
    );
  }

  await prisma.notificationOutbox.updateMany({
    where: {
      status: NotificationStatus.PROCESSING,
      updatedAt: { lt: new Date(Date.now() - 2 * 60_000) },
    },
    data: { status: NotificationStatus.PENDING },
  });

  const pending = await prisma.notificationOutbox.findMany({
    where: {
      status: NotificationStatus.PENDING,
      nextAttemptAt: { lte: new Date() },
      ...(!configuration.customerAcknowledgementsEnabled
        ? { event: { not: "ENQUIRY_ACKNOWLEDGEMENT" } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: { id: true },
  });

  const counts = { accepted: 0, retried: 0, failed: 0, skipped: 0 };
  for (const candidate of pending) {
    const claimed = await prisma.notificationOutbox.updateMany({
      where: {
        id: candidate.id,
        status: NotificationStatus.PENDING,
        nextAttemptAt: { lte: new Date() },
      },
      data: {
        status: NotificationStatus.PROCESSING,
        attemptCount: { increment: 1 },
      },
    });
    if (claimed.count !== 1) {
      counts.skipped += 1;
      continue;
    }

    const outbox = await prisma.notificationOutbox.findUnique({
      where: { id: candidate.id },
      select: {
        id: true,
        event: true,
        attemptCount: true,
        enquiry: {
          select: {
            id: true,
            reference: true,
            name: true,
            email: true,
            phone: true,
            organization: true,
            service: true,
            budget: true,
            message: true,
          },
        },
      },
    });
    if (!outbox) {
      counts.skipped += 1;
      continue;
    }
    try {
      const email = buildEmail(outbox, configuration);
      if (!email) {
        await prisma.notificationOutbox.update({
          where: { id: outbox.id },
          data: {
            status: NotificationStatus.FAILED,
            lastError: "Unsupported outbox event.",
          },
        });
        counts.failed += 1;
        continue;
      }
      const providerMessageId = await sendWithSendGrid(email, configuration);
      await prisma.notificationOutbox.update({
        where: { id: outbox.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          providerMessageId,
          lastError: null,
        },
      });
      counts.accepted += 1;
    } catch (error) {
      const transient = error instanceof SendGridDeliveryError && error.transient;
      const shouldRetry = transient && outbox.attemptCount < maximumAttempts;
      const retryDelayMs = Math.min(60 * 60_000, 30_000 * 2 ** (outbox.attemptCount - 1));
      const safeError = error instanceof SendGridDeliveryError
        ? error.message
        : "Unexpected email dispatcher error.";
      await prisma.notificationOutbox.update({
        where: { id: outbox.id },
        data: {
          status: shouldRetry ? NotificationStatus.PENDING : NotificationStatus.FAILED,
          nextAttemptAt: shouldRetry ? new Date(Date.now() + retryDelayMs) : undefined,
          lastError: safeError.slice(0, 500),
        },
      });
      if (shouldRetry) counts.retried += 1;
      else counts.failed += 1;
    }
  }
  return counts;
}

function buildEmail(
  outbox: {
    id: string;
    event: string;
    enquiry: {
      id: string;
      reference: string;
      name: string;
      email: string;
      phone: string | null;
      organization: string | null;
      service: string;
      budget: string | null;
      message: string;
    };
  },
  configuration: NonNullable<ReturnType<typeof getSendGridConfiguration>>,
): OutgoingEmail | null {
  const enquiry = outbox.enquiry;
  if (outbox.event === "ENQUIRY_RECEIVED") {
    const adminUrl = new URL(`/admin/enquiries/${enquiry.id}`, configuration.siteUrl).toString();
    const fields = [
      ["Reference", enquiry.reference],
      ["Name", enquiry.name],
      ["Email", enquiry.email],
      ["Phone", enquiry.phone ?? "Not provided"],
      ["Company", enquiry.organization ?? "Not provided"],
      ["Service", enquiry.service],
      ["Budget", enquiry.budget ?? "Not provided"],
      ["Project description", enquiry.message],
    ] as const;
    const text = [
      "A new project enquiry was received.",
      ...fields.map(([label, value]) => `${label}: ${value}`),
      `Admin record: ${adminUrl}`,
    ].join("\n\n");
    const html = [
      "<h1>New project enquiry</h1>",
      ...fields.map(([label, value]) =>
        `<p><strong>${escapeEmailHtml(label)}:</strong><br>${escapeEmailHtml(value).replaceAll("\n", "<br>")}</p>`,
      ),
      `<p><a href="${escapeEmailHtml(adminUrl)}">Open enquiry in the admin system</a></p>`,
    ].join("");
    return {
      outboxId: outbox.id,
      to: configuration.notificationToEmail,
      subject: `New enquiry ${enquiry.reference}`,
      text,
      html,
    };
  }
  if (outbox.event === "ENQUIRY_ACKNOWLEDGEMENT") {
    const safeName = escapeEmailHtml(enquiry.name);
    const text = [
      `Hello ${enquiry.name},`,
      "",
      "Thank you for contacting WEBNEX Technologies. We have received your project enquiry.",
      `Your reference is ${enquiry.reference}.`,
      "",
      "This message confirms receipt only and does not promise a response time.",
    ].join("\n");
    return {
      outboxId: outbox.id,
      to: enquiry.email,
      subject: `We received your enquiry ${enquiry.reference}`,
      text,
      html: `<p>Hello ${safeName},</p><p>Thank you for contacting WEBNEX Technologies. We have received your project enquiry.</p><p>Your reference is <strong>${escapeEmailHtml(enquiry.reference)}</strong>.</p><p>This message confirms receipt only and does not promise a response time.</p>`,
    };
  }
  return null;
}
