import "server-only";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { EmailDeliveryError } from "@/server/integrations/email-delivery-error";

const gmailSettings = z.object({
  GMAIL_CLIENT_ID: z.string().min(1),
  GMAIL_CLIENT_SECRET: z.string().min(1),
  GMAIL_REFRESH_TOKEN: z.string().min(1),
  GMAIL_FROM_EMAIL: z.string().email(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

export async function createGmailSender() {
  const parsed = gmailSettings.safeParse(process.env);
  if (!parsed.success) throw new Error("Gmail assignment email settings are missing or invalid.");
  const settings = parsed.data;
  const siteUrl = new URL(settings.NEXT_PUBLIC_SITE_URL);
  if (process.env.NODE_ENV === "production" && siteUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
  }
  const client = new OAuth2Client(settings.GMAIL_CLIENT_ID, settings.GMAIL_CLIENT_SECRET);
  client.setCredentials({ refresh_token: settings.GMAIL_REFRESH_TOKEN });
  let token: string | null | undefined;
  try {
    token = (await client.getAccessToken()).token;
  } catch {
    throw new Error("Gmail authorization failed. Check the OAuth configuration and refresh token.");
  }
  if (!token) throw new Error("Gmail authorization did not return an access token.");

  return {
    siteUrl,
    send: (to: string, title: string) => sendGmailAssignment({
      token,
      from: settings.GMAIL_FROM_EMAIL,
      to,
      title,
      siteUrl,
    }),
  };
}

export async function sendGmailAssignment(input: {
  token: string;
  from: string;
  to: string;
  title: string;
  siteUrl: URL;
}) {
  if (!z.string().email().safeParse(input.from).success || !z.string().email().safeParse(input.to).success) {
    throw new EmailDeliveryError("Invalid email address.", false);
  }
  const url = new URL("/admin/work-projects", input.siteUrl).toString();
  const text = `You have been assigned to ${input.title}.\r\n\r\nSign in to view your projects: ${url}`;
  const encodedText = Buffer.from(text, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
  const message = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    "Subject: You have been assigned a work project",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedText,
  ].join("\r\n");
  let response: Response;
  try {
    response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(message).toString("base64url") }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new EmailDeliveryError("Gmail API network error.", true);
  }
  if (!response.ok) {
    throw new EmailDeliveryError(
      `Gmail API returned HTTP ${response.status}.`,
      response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500,
    );
  }
  const result = await response.json() as { id?: unknown };
  if (typeof result.id !== "string" || !result.id) {
    throw new EmailDeliveryError("Gmail API returned an invalid response.", true);
  }
  return result.id;
}
