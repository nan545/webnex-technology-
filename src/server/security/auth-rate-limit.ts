import "server-only";
import { createHmac } from "node:crypto";
import { prisma, runInTransaction } from "@/server/db";

const windowMilliseconds = 15 * 60 * 1000;

export async function consumeLoginRateLimit(email: string, address: string) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("RATE_LIMIT_SECRET is not configured.");
  }

  const accountIdentifier = createHmac("sha256", secret)
    .update(`login:${email.toLowerCase()}:${address}`)
    .digest("hex");
  const addressIdentifier = createHmac("sha256", secret)
    .update(`login-address:${address}`)
    .digest("hex");
  const now = new Date();
  const bucketStart = new Date(
    Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds,
  );
  const [accountBucket, addressBucket] = await runInTransaction(async (transaction) => {
    await transaction.rateLimitBucket.deleteMany({
      where: {
        identifier: { in: [accountIdentifier, addressIdentifier] },
        bucketStart: { lt: new Date(now.getTime() - windowMilliseconds) },
      },
    });
    return Promise.all([
      transaction.rateLimitBucket.upsert({
        where: {
          identifier_bucketStart: {
            identifier: accountIdentifier,
            bucketStart,
          },
        },
        create: { identifier: accountIdentifier, bucketStart, requestCount: 1 },
        update: { requestCount: { increment: 1 } },
        select: { requestCount: true },
      }),
      transaction.rateLimitBucket.upsert({
        where: {
          identifier_bucketStart: {
            identifier: addressIdentifier,
            bucketStart,
          },
        },
        create: { identifier: addressIdentifier, bucketStart, requestCount: 1 },
        update: { requestCount: { increment: 1 } },
        select: { requestCount: true },
      }),
    ]);
  });

  return {
    allowed: accountBucket.requestCount <= 10 && addressBucket.requestCount <= 30,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((bucketStart.getTime() + windowMilliseconds - now.getTime()) / 1000),
    ),
  };
}
