import "server-only";
import { z } from "zod";
import { SignJWT, importPKCS8 } from "jose";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { DeliveryError } from "@/server/integrations/delivery-error";

const vonageConfigurationSchema = z.object({
  VONAGE_API_KEY: z.string().regex(/^[A-Za-z0-9]+$/),
  VONAGE_API_SECRET: z.string().min(1),
  VONAGE_SMS_FROM: z.string().min(1).max(16),
  VONAGE_APPLICATION_ID: z.string().min(1),
  VONAGE_PRIVATE_KEY: z.string().min(1),
  VONAGE_WHATSAPP_FROM: z.string().regex(/^\+[1-9]\d{7,14}$/),
  VONAGE_WHATSAPP_TEMPLATE_NAME: z.string().min(1).optional(),
  VONAGE_WHATSAPP_TEMPLATE_LOCALE: z.string().regex(/^[a-z]{2}(?:_[A-Z]{2})?$/).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

export async function createVonageAssignmentSender() {
  const parsed = vonageConfigurationSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Vonage SMS and WhatsApp assignment alert settings are missing or invalid.");
  }
  const settings = parsed.data;
  const siteUrl = new URL(settings.NEXT_PUBLIC_SITE_URL);
  if (process.env.NODE_ENV === "production" && siteUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
  }
  const url = new URL("/admin/work-projects", siteUrl).toString();

  return {
    sendSms: (phone: string, title: string) => sendSms({
      apiKey: settings.VONAGE_API_KEY,
      apiSecret: settings.VONAGE_API_SECRET,
      from: settings.VONAGE_SMS_FROM,
      to: phone,
      text: `WEBNEX: You have been assigned to "${title}". View your work projects: ${url}`,
    }),
    sendWhatsApp: (phone: string, title: string) => sendWhatsApp({
      applicationId: settings.VONAGE_APPLICATION_ID,
      privateKey: settings.VONAGE_PRIVATE_KEY,
      from: settings.VONAGE_WHATSAPP_FROM,
      to: phone,
      title,
      url,
      templateName: settings.VONAGE_WHATSAPP_TEMPLATE_NAME,
      templateLocale: settings.VONAGE_WHATSAPP_TEMPLATE_LOCALE,
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
  apiKey: string;
  apiSecret: string;
  from: string;
  to: string;
  text: string;
}) {
  let response: Response;
  try {
    response = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: input.apiKey,
        api_secret: input.apiSecret,
        from: input.from,
        to: input.to,
        text: input.text,
        type: "text",
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new DeliveryError("Vonage SMS request failed due to a network error.", true);
  }
  const result = await response.json().catch(() => null) as {
    messages?: Array<{ status?: unknown; "message-id"?: unknown; "error-text"?: unknown }>;
  } | null;
  if (!response.ok) {
    throw new DeliveryError(`Vonage returned HTTP ${response.status}.`, response.status === 429 || response.status >= 500);
  }
  const message = result?.messages?.[0];
  if (!message || message.status !== "0" || typeof message["message-id"] !== "string") {
    const detail = typeof message?.["error-text"] === "string"
      ? message["error-text"]
      : "Vonage rejected the SMS request.";
    throw new DeliveryError(detail, false);
  }
  return message["message-id"];
}

async function sendWhatsApp(input: {
  applicationId: string;
  privateKey: string;
  from: string;
  to: string;
  title: string;
  url: string;
  templateName?: string;
  templateLocale?: string;
}) {
  let privateKey: CryptoKey;
  try {
    privateKey = await importPKCS8(
      input.privateKey.replace(/\\n/g, "\n"),
      "RS256",
    );
  } catch {
    throw new DeliveryError("The Vonage private key is invalid.", false);
  }
  const jwt = await new SignJWT({ application_id: input.applicationId, jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(privateKey);

  const body = input.templateName
    ? {
        channel: "whatsapp",
        from: input.from,
        to: input.to,
        message_type: "template",
        template: {
          name: input.templateName,
          ...(input.templateLocale ? { locale: input.templateLocale } : {}),
          parameters: [{ default: input.title }, { default: input.url }],
        },
      }
    : {
        channel: "whatsapp",
        from: input.from,
        to: input.to,
        message_type: "text",
        text: { body: `WEBNEX: You have been assigned to "${input.title}". View your work projects: ${input.url}` },
      };

  let response: Response;
  try {
    response = await fetch("https://api.nexmo.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new DeliveryError("Vonage WhatsApp request failed due to a network error.", true);
  }
  const result = await response.json().catch(() => null) as { message_uuid?: unknown; title?: unknown; detail?: unknown } | null;
  if (!response.ok) {
    const detail = typeof result?.detail === "string"
      ? result.detail
      : typeof result?.title === "string"
        ? result.title
        : `Vonage returned HTTP ${response.status}.`;
    throw new DeliveryError(detail, response.status === 429 || response.status >= 500);
  }
  if (typeof result?.message_uuid !== "string") {
    throw new DeliveryError("Vonage returned an invalid WhatsApp response.", true);
  }
  return result.message_uuid;
}
