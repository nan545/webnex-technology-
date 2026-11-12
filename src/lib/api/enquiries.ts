import { z } from "zod";
import type { EnquiryInput } from "@/lib/validation/enquiries";

const enquiryResponseSchema = z.object({
  data: z.object({
    reference: z.string().min(1),
    submittedAt: z.string().or(z.date()),
    notificationStatus: z.literal("pending"),
  }),
});

export async function submitEnquiry(
  payload: EnquiryInput,
  idempotencyKey: string,
) {
  const response = await fetch("/api/v1/enquiries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => undefined);
    const message =
      typeof errorBody === "object" &&
      errorBody !== null &&
      "error" in errorBody &&
      typeof errorBody.error === "object" &&
      errorBody.error !== null &&
      "message" in errorBody.error &&
      typeof errorBody.error.message === "string"
        ? errorBody.error.message
        : "The enquiry service is unavailable.";
    throw new Error(message);
  }

  const responseBody: unknown = await response.json();
  const result = enquiryResponseSchema.safeParse(responseBody);

  if (!result.success) {
    throw new Error("The enquiry service did not confirm the submission.");
  }
  return result.data.data;
}
