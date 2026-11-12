import { z } from "zod";

const secureUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Use an HTTPS URL.");

export const otherSocialLinkSchema = z.object({
  label: z.string().trim().min(2).max(40),
  url: secureUrlSchema,
}).strict();

export const teamMemberCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(120),
  department: z.string().trim().max(120).nullable(),
  biography: z.string().trim().max(1600).nullable(),
  linkedinUrl: secureUrlSchema.nullable(),
  githubUrl: secureUrlSchema.nullable(),
  portfolioUrl: secureUrlSchema.nullable(),
  otherSocialLinks: z.array(otherSocialLinkSchema).max(8),
  sortOrder: z.number().int().min(0).max(100_000),
  isActive: z.boolean(),
}).strict();

export const teamMemberUpdateSchema = teamMemberCreateSchema.partial()
  .extend({
    status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export const teamPhotoUploadSchema = z.object({
  altText: z.string().trim().max(250).optional(),
}).strict();

export type OtherSocialLink = z.infer<typeof otherSocialLinkSchema>;
