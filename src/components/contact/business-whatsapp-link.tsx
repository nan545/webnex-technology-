import "server-only";
import { MessageCircle } from "lucide-react";
import { createBusinessWhatsAppLink } from "@/lib/whatsapp";

export function BusinessWhatsAppLink() {
  const phone = process.env.WHATSAPP_BUSINESS_NUMBER?.trim();
  if (!phone) return null;

  const href = createBusinessWhatsAppLink(
    phone,
    "Hello WEBNEX Technologies, I would like to discuss a project.",
  );
  if (!href) {
    console.error(
      "WHATSAPP_BUSINESS_NUMBER must be a valid international number; the public WhatsApp link is disabled.",
    );
    return null;
  }

  return (
    <div className="mt-8">
      <a
        className="button-secondary inline-flex items-center gap-2"
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        <MessageCircle aria-hidden="true" size={18} />
        Chat with us on WhatsApp
      </a>
      <p className="mt-2 text-xs leading-5 text-muted">
        WhatsApp opens with a message draft. Review it and choose whether to send.
      </p>
    </div>
  );
}
