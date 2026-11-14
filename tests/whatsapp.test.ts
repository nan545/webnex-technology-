import assert from "node:assert/strict";
import test from "node:test";
import { createBusinessWhatsAppLink } from "../src/lib/whatsapp";

test("business WhatsApp link requires a valid international phone number", () => {
  assert.equal(createBusinessWhatsAppLink(undefined, "Hello"), null);
  assert.equal(createBusinessWhatsAppLink("020 123 4567", "Hello"), null);
  assert.equal(createBusinessWhatsAppLink("+abc", "Hello"), null);
});

test("business WhatsApp link encodes the message for the configured number", () => {
  assert.equal(
    createBusinessWhatsAppLink(
      "+233 20 123 4567",
      "Hello WEBNEX Technologies",
    ),
    "https://wa.me/233201234567?text=Hello%20WEBNEX%20Technologies",
  );
});
