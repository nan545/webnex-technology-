import { apiError } from "@/server/api/response";

export function rejectCrossOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return apiError(403, "ORIGIN_REQUIRED", "A same-origin request is required.");
  }

  try {
    const requestOrigin = new URL(request.url).origin;
    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
      : requestOrigin;
    return new URL(origin).origin === requestOrigin ||
      new URL(origin).origin === configuredOrigin
      ? null
      : apiError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
  } catch {
    return apiError(400, "INVALID_ORIGIN", "The request origin is invalid.");
  }
}
