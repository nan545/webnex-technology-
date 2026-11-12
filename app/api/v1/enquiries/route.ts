import { z } from "zod";
import { enquirySchema } from "@/lib/validation/enquiries";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { createEnquiry } from "@/server/enquiries/create-enquiry";
import {
  consumeEnquiryRateLimit,
  RateLimitConfigurationError,
} from "@/server/security/rate-limit";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const idempotencyKeySchema = z.string().uuid();

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (contentType !== "application/json") {
    return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Submit the enquiry as JSON.");
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 16_384) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "The enquiry request is too large.");
  }

  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const idempotencyKey = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!idempotencyKey.success) {
    return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid idempotency key is required.");
  }

  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return apiError(400, "INVALID_JSON", "The request body is required.");
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > 16_384) {
        await reader.cancel();
        return apiError(413, "PAYLOAD_TOO_LARGE", "The enquiry request is too large.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }

  const input = enquirySchema.safeParse(body);
  if (!input.success) {
    return apiError(
      422,
      "VALIDATION_FAILED",
      "Review the highlighted enquiry fields and try again.",
      input.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  if (input.data.website?.trim()) {
    return apiError(422, "VALIDATION_FAILED", "The enquiry could not be accepted.");
  }

  try {
    const limit = await consumeEnquiryRateLimit(request);
    if (!limit.allowed) {
      return apiError(
        429,
        "RATE_LIMITED",
        "Too many enquiries. Please try again later.",
        undefined,
        { "Retry-After": String(limit.retryAfterSeconds) },
      );
    }

    const saved = await createEnquiry(input.data, idempotencyKey.data);
    return apiSuccess(
      {
        reference: saved.reference,
        submittedAt: saved.createdAt,
        notificationStatus: "pending",
        duplicate: saved.duplicate,
      },
      {
        status: saved.duplicate ? 200 : 201,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof RateLimitConfigurationError) {
      console.error("Enquiry endpoint requires RATE_LIMIT_SECRET configuration.");
      return apiError(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable.");
    }
    return handleApiFailure(error);
  }
}
