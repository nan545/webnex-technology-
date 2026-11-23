import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/server/db";
import { runAsDatabaseActor } from "@/server/db-context";

const windowMilliseconds = 15 * 60 * 1000;
const requestLimit = 5;

export class RateLimitConfigurationError extends Error {
  constructor() {
    super("RATE_LIMIT_SECRET is not configured.");
    this.name = "RateLimitConfigurationError";
  }
}

export function consumeEnquiryRateLimit(request: Request) {
  return runAsDatabaseActor({ kind: "intake" }, () => countEnquiryRequest(request));
}

async function countEnquiryRequest(request: Request) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) {
    throw new RateLimitConfigurationError();
  }

  const address = request.headers.get("x-real-ip")?.trim() || "unknown";
  const identifier = createHmac("sha256", secret).update(address).digest("hex");
  const now = new Date();
  const bucketStart = new Date(
    Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds,
  );
  const expiresBefore = new Date(now.getTime() - windowMilliseconds);

  await prisma.rateLimitBucket.deleteMany({
    where: { identifier, bucketStart: { lt: expiresBefore } },
  });

  const bucket = await prisma.rateLimitBucket.upsert({
    where: {
      identifier_bucketStart: { identifier, bucketStart },
    },
    create: { identifier, bucketStart, requestCount: 1 },
    update: { requestCount: { increment: 1 } },
    select: { requestCount: true },
  });

  return {
    allowed: bucket.requestCount <= requestLimit,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((bucketStart.getTime() + windowMilliseconds - now.getTime()) / 1000),
    ),
  };
}
