import { apiError } from "@/server/api/response";

export async function readBoundedJson(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
    return { error: apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Submit the request as JSON.") };
  }
  const maximumBytes = 16_384;
  const reader = request.body?.getReader();
  if (!reader) return { error: apiError(400, "INVALID_JSON", "The request body is required.") };
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        return { error: apiError(413, "PAYLOAD_TOO_LARGE", "The request is too large.") };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return { value };
  } catch {
    return { error: apiError(400, "INVALID_JSON", "The request body must be valid JSON.") };
  }
}
