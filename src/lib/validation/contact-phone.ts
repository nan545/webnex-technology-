import { z } from "zod";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

export const contactPhoneSchema = z.string().trim().max(40).transform((value, context) => {
  if (!value) return null;
  const normalized = normalizeWhatsAppNumber(value);
  if (!normalized) {
    context.addIssue({ code: "custom", message: "Enter a valid phone number with country code." });
    return z.NEVER;
  }
  return `+${normalized}`;
});
