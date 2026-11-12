import assert from "node:assert/strict";
import test from "node:test";
import {
  isExpiryOnOrAfterIssue,
  isProposalExpired,
  proposalDraftSchema,
} from "../src/lib/validation/proposal";
import { createWhatsAppLink, normalizeWhatsAppNumber } from "../src/lib/whatsapp";

test("WhatsApp numbers normalize Ghana local format and E.164 values", () => {
  assert.equal(normalizeWhatsAppNumber("024 123 4567"), "233241234567");
  assert.equal(normalizeWhatsAppNumber("+1 (202) 555-0100"), "12025550100");
  assert.equal(normalizeWhatsAppNumber("invalid"), null);
  assert.equal(normalizeWhatsAppNumber("abc 0241234567"), null);
});

test("WhatsApp message links encode content and do not imply delivery", () => {
  const link = createWhatsAppLink("0241234567", "Hello A & B?");
  assert.equal(
    link,
    "https://wa.me/233241234567?text=Hello%20A%20%26%20B%3F",
  );
  assert.equal(createWhatsAppLink("not a number", "hello"), null);
});

test("proposal draft accepts fixed decimal strings without float coercion", () => {
  const input = {
    title: "Website delivery proposal",
    scope: "Deliver an approved website scope.",
    estimatedPrice: "1234567890123456.78",
    currency: "GHS",
    issueDate: "2026-11-11",
    expiryDate: "2026-12-11",
  };
  assert.equal(proposalDraftSchema.safeParse(input).success, true);
  assert.equal(proposalDraftSchema.safeParse({ ...input, estimatedPrice: "1.999" }).success, false);
  assert.equal(proposalDraftSchema.safeParse({ ...input, estimatedPrice: "1e6" }).success, false);
  assert.equal(isExpiryOnOrAfterIssue(input.issueDate, input.expiryDate), true);
  assert.equal(isExpiryOnOrAfterIssue(input.issueDate, "2026-11-10"), false);
  assert.equal(isProposalExpired(new Date("2026-11-11T00:00:00.000Z"), new Date("2026-11-11T23:59:00.000Z")), false);
  assert.equal(isProposalExpired(new Date("2026-11-10T00:00:00.000Z"), new Date("2026-11-11T00:00:00.000Z")), true);
});
