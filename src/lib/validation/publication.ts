import { z } from "zod";

export const publicationKindSchema = z.enum(["projects", "insights"]);
export type PublicationKind = z.infer<typeof publicationKindSchema>;

export const publicationContentSchema = z.object({
  body: z.string().trim().min(1).max(20000),
  category: z.string().trim().min(1).max(100),
  technologies: z.string().trim().max(500),
}).strict();

export const publicationSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  summary: z.string().trim().min(1).max(500),
  content: publicationContentSchema,
  status: z.enum(["DRAFT", "PUBLISHED"]),
}).strict();

export type PublicationInput = z.infer<typeof publicationSchema>;
