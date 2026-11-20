import "server-only";
import { z } from "zod";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { DeliveryError } from "@/server/integrations/delivery-error";

const twilioConfigurationSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string().regex(/^AC[0-9a-fA-F]{32}$/),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_SMS_FROM: z.string().regex(/^\+[1-9]\d{7,14}$/),
  TWILIO_WHATSAPP_FROM: z.string().regex(/^whatsapp:\+[1-9]\d{7,14}$/),
  TWILIO_WHATSAPP_CONTENT_SID: z.string().regex(/^HX[0-9a-fA-F]{32}$/),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

export async function createTwilioAssignmentSender() {
  const parsed = twilioConfigurationSchema.safeParse(process.env);
  if (!parsed.success) throw new Error("Twilio SMS and WhatsApp assignment alert settings are missing or invalid.");
  const settings = parsed.data;
  const siteUrl = new URL(settings.NEXT_PUBLIC_SITE_URL);
  if (process.env.NODE_ENV === "production" && siteUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
  }
  const url = new URL("/admin/work-projects", siteUrl).toString();
  const credentials = `Basic ${Buffer.from(`${settings.TWILIO_ACCOUNT_SID}:${settings.TWILIO_AUTH_TOKEN}`).toString("base64")}`;

  return {
    sendSms: (phone: string, title: string) => sendSms({
      accountSid: settings.TWILIO_ACCOUNT_SID,
      authorization: credentials,
      from: settings.TWILIO_SMS_FROM,
      to: phone,
      body: `WEBNEX: You have been assigned to "${title}". View your work projects: ${url}`,
    }),
    sendWhatsApp: (phone: string, title: string) => sendWhatsApp({
      accountSid: settings.TWILIO_ACCOUNT_SID,
      authorization: credentials,
      from: settings.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${phone}`,
      contentSid: settings.TWILIO_WHATSAPP_CONTENT_SID,
      contentVariables: JSON.stringify({ 1: title, 2: url }),
    }),
  };
}

export function normalizeAssignmentPhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  const localGhanaNumber = /^0\d{9}$/.test(digits);
  if (!trimmed.startsWith("+") && !localGhanaNumber) return null;
  const normalized = normalizeWhatsAppNumber(value);
  return normalized ? `+${normalized}` : null;
}

async function sendSms(input: {
  accountSid: string;
  authorization: string;
  from: string;
  to: string;
  body: string;
}) {
  const response = await createTwilioMessage(input.accountSid, input.authorization, {
    From: input.from,
    To: input.to,
    Body: input.body,
  });
  return response.sid;
}

async function sendWhatsApp(input: {
  accountSid: string;
  authorization: string;
  from: string;
  to: string;
  contentSid: string;
  contentVariables: string;
}) {
  const response = await createTwilioMessage(input.accountSid, input.authorization, {
    From: input.from,
    To: input.to,
    ContentSid: input.contentSid,
    ContentVariables: input.contentVariables,
  });
  return response.sid;
}

async function createTwilioMessage(
  accountSid: string,
  authorization: string,
  fields: Record<string, string>,
) {
  let response: Response;
  try {
    response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(fields),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new DeliveryError("Twilio message request failed due to a network error.", true);
  }

  if (!response.ok) {
    throw new DeliveryError(
      `Twilio returned HTTP ${response.status}.`,
      response.status === 429 || response.status >= 500,
    );
  }
  const result = await response.json() as { sid?: unknown };
  if (typeof result.sid !== "string" || !/^SM[0-9a-fA-F]{32}$/.test(result.sid)) {
    throw new DeliveryError("Twilio returned an invalid message response.", true);
  }
  return { sid: result.sid };
}
