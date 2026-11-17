export const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export function adminIdleDeadline(lastActivity: unknown, now: number): number | null {
  if (
    typeof lastActivity !== "number" ||
    !Number.isFinite(lastActivity) ||
    lastActivity > now ||
    now - lastActivity >= ADMIN_IDLE_TIMEOUT_MS
  ) {
    return null;
  }
  return lastActivity + ADMIN_IDLE_TIMEOUT_MS;
}
