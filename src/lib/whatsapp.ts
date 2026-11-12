export function normalizeWhatsAppNumber(value: string) {
  const trimmed = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  const normalized = trimmed.startsWith("+")
    ? digits
    : /^0\d{9}$/.test(digits)
      ? `233${digits.slice(1)}`
      : digits;
  return /^[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

export function createWhatsAppLink(phone: string, message: string) {
  const number = normalizeWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
