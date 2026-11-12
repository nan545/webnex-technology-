import { apiError, apiSuccess } from "@/server/api/response";
import { prisma } from "@/server/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return apiSuccess({ status: "ok", database: "connected", checkedAt: new Date().toISOString() });
  } catch {
    console.error("Health check could not reach PostgreSQL.");
    return apiError(503, "DATABASE_UNAVAILABLE", "The service is temporarily unavailable.");
  }
}
