import { AsyncLocalStorage } from "node:async_hooks";

// The database actor describes who is running a query. PostgreSQL row-level
// security policies read it from transaction-local settings (see db.ts), so a
// query without an actor is treated as anonymous website traffic.
export type DatabaseActor =
  | { kind: "anonymous" }
  | { kind: "auth" }
  | { kind: "system" }
  | { kind: "intake"; idempotencyKey?: string }
  | { kind: "admin"; userId: string; permissions: ReadonlySet<string> };

type ActorScope = { actor: DatabaseActor };

const storage = new AsyncLocalStorage<ActorScope>();
const anonymous: DatabaseActor = { kind: "anonymous" };

export function currentDatabaseActor(): DatabaseActor {
  return storage.getStore()?.actor ?? anonymous;
}

export function runAsDatabaseActor<T>(actor: DatabaseActor, work: () => T): T {
  return storage.run({ actor }, work);
}

// Must be called synchronously, before the first await of the calling
// function, so the scope is shared with the request code that continues after
// the caller returns. The actor starts anonymous and is upgraded once the
// administrator session has been verified.
export function openRequestActorScope() {
  const scope: ActorScope = { actor: anonymous };
  storage.enterWith(scope);
  return {
    promoteToAdmin(userId: string, permissions: ReadonlySet<string>) {
      scope.actor = { kind: "admin", userId, permissions };
    },
  };
}

export function actorSettings(actor: DatabaseActor) {
  return {
    actor: actor.kind,
    userId: actor.kind === "admin" ? actor.userId : "",
    permissions: actor.kind === "admin" ? [...actor.permissions].join(",") : "",
    idempotencyKey: actor.kind === "intake" ? (actor.idempotencyKey ?? "") : "",
  };
}
