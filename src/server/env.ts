import "server-only";
import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) =>
        value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "must use the PostgreSQL protocol",
    ),
  SENDGRID_API_KEY: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
  SENDGRID_FROM_EMAIL: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().email().optional(),
  ),
  NOTIFICATION_TO_EMAIL: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().email().optional(),
  ),
  SENDGRID_CUSTOMER_ACKNOWLEDGEMENTS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  OBJECT_STORAGE_ENDPOINT: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().url().optional(),
  ),
  OBJECT_STORAGE_REGION: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
  OBJECT_STORAGE_BUCKET: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const issues = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid server environment configuration: ${issues}`);
}

export const env = result.data;
