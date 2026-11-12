"use client";

import { useState } from "react";
import { createWhatsAppLink } from "@/lib/whatsapp";

export function WhatsAppContactLink({
  enquiryId,
  name,
  phone,
  consented,
}: {
  enquiryId: string;
  name: string;
  phone: string | null;
  consented: boolean;
}) {
  const [message, setMessage] = useState("");
  const link = phone
    ? createWhatsAppLink(
        phone,
        `Hello ${name}, thank you for contacting WEBNEX Technologies. We have received your project enquiry and would like to learn more about your requirements.`,
      )
    : null;

  if (!consented || !link) {
    return (
      <p className="text-xs leading-5 text-muted">
        {!consented
          ? "WhatsApp contact is unavailable because the customer has not opted in."
          : "WhatsApp contact is unavailable because the phone number is not in a supported international format."}
      </p>
    );
  }

  return (
    <div>
      <a
        className="button-secondary inline-flex"
        href={link}
        onClick={() => {
          setMessage("WhatsApp conversation link opened; no message delivery is confirmed.");
          void fetch(`/api/admin/v1/enquiries/${enquiryId}/activities`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "WHATSAPP_LINK_OPENED" }),
          }).then((response) => {
            if (!response.ok) setMessage("Link opened, but the activity could not be recorded.");
          }).catch(() => {
            setMessage("Link opened, but the activity could not be recorded.");
          });
        }}
        rel="noopener noreferrer"
        target="_blank"
      >
        Open WhatsApp
      </a>
      <p aria-live="polite" className="mt-2 text-xs text-muted">
        {message || "A prefilled message is ready for human review and sending."}
      </p>
    </div>
  );
}
