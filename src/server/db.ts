import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  actorSettings,
  currentDatabaseActor,
  type DatabaseActor,
} from "@/server/db-context";
import { env } from "@/server/env";

function createBaseClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({ adapter });
}

type BaseClient = ReturnType<typeof createBaseClient>;

// Transaction-local settings are discarded on commit, so a pooled connection
// never carries one request's identity into another request.
function applyActor(client: Prisma.TransactionClient | BaseClient, actor: DatabaseActor) {
  const settings = actorSettings(actor);
  return client.$executeRaw`SELECT
    set_config('app.actor', ${settings.actor}, true),
    set_config('app.user_id', ${settings.userId}, true),
    set_config('app.permissions', ${settings.permissions}, true),
    set_config('app.idempotency_key', ${settings.idempotencyKey}, true)`;
}

function createClients() {
  const base = createBaseClient();
  const scoped = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const actor = currentDatabaseActor();
          // Without any setting, row-level security treats the query as anonymous.
          if (actor.kind === "anonymous") return query(args);
          const [, result] = await base.$transaction([applyActor(base, actor), query(args)]);
          return result;
        },
      },
    },
  });
  return { base, scoped };
}

const globalForPrisma = globalThis as typeof globalThis & {
  prismaClients?: ReturnType<typeof createClients>;
};

const clients = globalForPrisma.prismaClients ?? createClients();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClients = clients;
}

// Every query made through this client runs as the current database actor.
export const prisma = clients.scoped;

// Interactive transactions run on the unscoped transaction client, with the
// current actor applied once at the start so every statement is covered.
export function runInTransaction<T>(
  work: (transaction: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
): Promise<T> {
  const actor = currentDatabaseActor();
  return clients.base.$transaction(async (transaction) => {
    if (actor.kind !== "anonymous") await applyActor(transaction, actor);
    return work(transaction);
  }, options);
}
