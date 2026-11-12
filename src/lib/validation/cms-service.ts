import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .transform((value) => value.toLowerCase())
  .refine((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
    message: "Use lowercase letters, numbers, and hyphens.",
  });

export const cmsServiceContentSchema = z.object({
  introduction: z.string().trim().max(4000).default(""),
  problems: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
  capabilities: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  delivery: z.string().trim().max(4000).default(""),
  faqs: z
    .array(z.object({
      question: z.string().trim().min(1).max(300),
      answer: z.string().trim().min(1).max(2000),
    }).strict())
    .max(20)
    .default([]),
  icon: z.enum(["code", "layers", "smartphone", "bot", "cloud", "workflow", "lightbulb"]).default("code"),
}).strict();

export const cmsServiceCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: slugSchema,
  summary: z.string().trim().max(500).nullable(),
  content: cmsServiceContentSchema,
}).strict();

export const cmsServiceUpdateSchema = cmsServiceCreateSchema.partial().extend({
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export type CmsServiceContent = z.infer<typeof cmsServiceContentSchema>;
