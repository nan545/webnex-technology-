import "server-only";
import { env } from "@/server/env";

export type OutgoingEmail = {
  outboxId: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

export class SendGridDeliveryError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
  }
}

export function getSendGridConfiguration() {
  if (!env.SENDGRID_API_KEY || !env.SENDGRID_FROM_EMAIL || !env.NOTIFICATION_TO_EMAIL) {
    return null;
  }
  const siteUrlValue = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrlValue) return null;
  let siteUrl: URL;
  try {
    siteUrl = new URL(siteUrlValue);
  } catch {
    return null;
  }
  if (process.env.NODE_ENV === "production" && siteUrl.protocol !== "https:") return null;
  return {
    apiKey: env.SENDGRID_API_KEY,
    fromEmail: env.SENDGRID_FROM_EMAIL,
    notificationToEmail: env.NOTIFICATION_TO_EMAIL,
    customerAcknowledgementsEnabled: env.SENDGRID_CUSTOMER_ACKNOWLEDGEMENTS,
    siteUrl,
  };
}

export async function sendWithSendGrid(
  email: OutgoingEmail,
  configuration: NonNullable<ReturnType<typeof getSendGridConfiguration>>,
) {
  let response: Response;
  try {
    response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: email.to }],
          custom_args: { outbox_id: email.outboxId },
        }],
        from: { email: configuration.fromEmail, name: "WEBNEX Technologies" },
        subject: email.subject,
        content: [
          { type: "text/plain", value: email.text },
          { type: "text/html", value: email.html },
        ],
        mail_settings: { sandbox_mode: { enable: false } },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new SendGridDeliveryError(
      error instanceof Error ? error.name : "network_error",
      true,
    );
  }

  if (!response.ok) {
    throw new SendGridDeliveryError(
      `SendGrid returned HTTP ${response.status}.`,
      response.status === 429 || response.status >= 500,
    );
  }
  return response.headers.get("x-message-id");
}

export function escapeEmailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
