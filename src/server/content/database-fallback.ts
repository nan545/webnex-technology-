import "server-only";
import { Prisma } from "@/generated/prisma/client";

const retryDelayMs = 10_000;
let retryAfter = 0;

function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return ["P1000", "P1001", "P1002", "P1008", "P1017"].includes(error.errorCode ?? "");
  }
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (["P1000", "P1001", "P1002", "P1008", "P1017"].includes(error.code)) return true;
  return error.code === "P2010" && error.meta?.code === "28P01";
}

export async function readWithDatabaseFallback<T>(
  read: () => Promise<T>,
  fallback: () => T,
  context: string,
): Promise<{ value: T; unavailable: boolean }> {
  if (Date.now() < retryAfter) return { value: fallback(), unavailable: true };
  try {
    const value = await read();
    retryAfter = 0;
    return { value, unavailable: false };
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    retryAfter = Date.now() + retryDelayMs;
    console.error(`${context} could not be loaded from PostgreSQL; using local content.`);
    return { value: fallback(), unavailable: true };
  }
}
