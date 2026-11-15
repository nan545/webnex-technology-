export async function errorMessage(response: Response) {
  const payload: unknown = await response.json().catch(() => undefined);
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return "The request could not be completed.";
}
