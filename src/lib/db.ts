import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

/**
 * The Office is multi-user. Every table has a user_id and row-level security (supabase/migrations).
 * `db()` returns a client whose every query runs in a short transaction as the signed-in user
 * (role `office_app`, auth.uid() = their id; the public Data API roles have no access), so Postgres itself filters reads and fills in
 * user_id on inserts. `rootSql()` bypasses that and is only for server-side lookups that happen
 * before we know the user (ingest tokens, connector secrets, the hourly sync).
 */

const globalForDb = globalThis as unknown as { __sql?: Sql };

function connectionString() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set (the Supabase transaction pooler string).");
  return url;
}

export function rootSql(): Sql {
  if (!globalForDb.__sql) {
    const url = connectionString();
    const local = /localhost|127\.0\.0\.1/.test(url);
    globalForDb.__sql = postgres(url, {
      ssl: local ? false : "require",
      max: 5,
      idle_timeout: 20,
      prepare: false, // required by the transaction pooler
      onnotice: () => {},
    });
  }
  return globalForDb.__sql;
}

export class Unauthorized extends Error {
  constructor() {
    super("Not signed in");
  }
}

const als = new AsyncLocalStorage<string>();

/** Run `fn` as a given user, for code paths with no browser session (ingest tokens, sync jobs). */
export function runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return als.run(userId, fn);
}

export async function currentUserId(): Promise<string> {
  const fromJob = als.getStore();
  if (fromJob) return fromJob;
  const { getUserId } = await import("./session");
  const id = await getUserId();
  if (!id) throw new Unauthorized();
  return id;
}

function scoped(root: Sql, userId: string): Sql {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asUser = (tx: any) =>
    tx`select set_config('request.jwt.claims', ${claims}, true), set_config('role', 'office_app', true)`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const begin = (...args: any[]) => {
    const cb = args[args.length - 1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapped = async (tx: any) => {
      await asUser(tx);
      return cb(tx);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return args.length > 1 ? (root.begin as any)(args[0], wrapped) : root.begin(wrapped);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const call = (first: any, ...rest: any[]) => {
    // a tagged template is a query: run it as the user; anything else is a helper like sql(ids)
    if (Array.isArray(first) && "raw" in first) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return root.begin(async (tx: any) => {
        await asUser(tx);
        return tx(first, ...rest);
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (root as any)(first, ...rest);
  };
  return new Proxy(call, {
    get(_t, prop) {
      if (prop === "begin") return begin;
      if (prop === "unsafe") throw new Error("sql.unsafe is not allowed on the user client");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (root as any)[prop];
      return typeof v === "function" ? v.bind(root) : v;
    },
  }) as unknown as Sql;
}

/** A database client scoped to the signed-in user. Throws Unauthorized when nobody is signed in. */
export async function db(): Promise<Sql> {
  return scoped(rootSql(), await currentUserId());
}

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const sql = await db();
  const rows = await sql<{ value: T }[]>`select value from kv where key = ${key}`;
  return rows.length ? rows[0].value : fallback;
}

export async function setKV(key: string, value: unknown) {
  const sql = await db();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = sql.json(value as any);
  await sql`insert into kv (key, value, updated_at) values (${key}, ${v}, now())
            on conflict (user_id, key) do update set value = excluded.value, updated_at = now()`;
}
