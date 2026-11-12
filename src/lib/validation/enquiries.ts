import { z } from "zod";

export const enquirySchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254)
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine(
      (value) => value.length === 0 || /^[+()\d\s.-]{7,40}$/.test(value),
      "Enter a valid phone number.",
    ),
  company: z.string().trim().max(160),
  service: z.enum([
    "web-development",
    "custom-software-development",
    "mobile-application-development",
    "ai-and-business-automation",
    "cloud-and-infrastructure-solutions",
    "ui-ux-design",
    "technology-consulting",
    "other",
  ]),
  budget: z.string().trim().max(120),
  description: z
    .string()
    .trim()
    .min(20, "Tell us a little more about the project (at least 20 characters).")
    .max(5000, "Keep the project description under 5,000 characters."),
  preferredContact: z.enum(["Email", "Phone", "Either"]),
  whatsappConsent: z.boolean().default(false),
  website: z.string().max(200).optional(),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;
