import { z } from "zod";

export const publicNavigationPaths = [
  "/", "/about", "/team", "/services", "/projects", "/industries",
  "/insights", "/contact", "/privacy", "/terms",
] as const;

const navigationLinkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  href: z.enum(publicNavigationPaths),
}).strict();

const navigationListSchema = z.array(navigationLinkSchema).min(1).max(12)
  .refine((items) => new Set(items.map((item) => item.href)).size === items.length, {
    message: "Each navigation link must have a unique path.",
  });

export const navigationConfigurationSchema = z.object({
  header: navigationListSchema.refine(
    (items) => items.every((item) => item.href !== "/services"),
    { message: "Services is already included as a main navigation dropdown." },
  ),
  footer: navigationListSchema,
}).strict();

export const contactPhoneSchema = z.object({
  phone: z.string().trim().max(40).refine(
    (value) => value === "" || (
      /^\+?[\d\s().-]+$/.test(value) &&
      /^[1-9]\d{6,14}$/.test(value.replace(/\D/g, "").replace(/^0/, ""))
    ),
    "Enter a valid telephone number, preferably with its country code.",
  ),
}).strict();

export type NavigationConfiguration = z.infer<typeof navigationConfigurationSchema>;
