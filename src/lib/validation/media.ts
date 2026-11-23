import { z } from "zod";

export const mediaMetadataSchema = z.object({
  altText: z.string().trim().max(250).default(""),
  caption: z.string().trim().max(500).nullable().optional(),
});

export const mediaSearchSchema = z.object({
  search: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(24),
});
