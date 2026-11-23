import { z } from "zod";

export const workProjectSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(10_000),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED"]),
  assigneeIds: z.array(z.string().uuid()).max(100).refine(
    (ids) => new Set(ids).size === ids.length,
    "Each team member can only be assigned once.",
  ),
}).strict();

export type WorkProjectInput = z.infer<typeof workProjectSchema>;
