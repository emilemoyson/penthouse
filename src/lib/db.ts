import postgres from "postgres";
import { seedDatabase } from "./seed";

type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as { __sql?: Sql; __schemaReady?: Promise<void>; __schemaKey?: number };

function connectionString() {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (!url) throw new Error("DATABASE_URL is not set. Add a Postgres database (Neon) in Vercel → Storage.");
  return url;
}

export function getSql(): Sql {
  if (!globalForDb.__sql) {
    const url = connectionString();
    const local = /localhost|127\.0\.0\.1/.test(url);
    globalForDb.__sql = postgres(url, {
      ssl: local ? false : "require",
      max: 3,
      idle_timeout: 20,
      prepare: false,
      onnotice: () => {},
    });
  }
  return globalForDb.__sql;
}

const SCHEMA = `
create table if not exists workouts (
  id serial primary key,
  date text not null,
  kind text not null default 'other',
  notes text not null default '',
  date_estimated boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists workouts_date_idx on workouts(date);

create table if not exists sets (
  id serial primary key,
  workout_id integer not null references workouts(id) on delete cascade,
  exercise text not null,
  ex_order integer not null default 0,
  set_no integer not null default 1,
  weight double precision not null default 0,
  unit text not null default 'lb',
  reps integer not null default 0,
  reps_alt integer
);
create index if not exists sets_workout_idx on sets(workout_id);
create index if not exists sets_exercise_idx on sets(exercise);

create table if not exists exercises (
  name text primary key,
  muscle text not null default 'Other',
  kind text not null default 'compound'
);

create table if not exists runs (
  id serial primary key,
  date text not null,
  distance_km double precision not null,
  duration_sec integer not null,
  kind text not null default 'easy',
  avg_hr integer,
  notes text not null default '',
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create index if not exists runs_date_idx on runs(date);

create table if not exists habit_logs (
  date text primary key,
  read_min integer,
  zetamac integer,
  gym boolean not null default false,
  run boolean not null default false,
  note text not null default ''
);

create table if not exists events (
  id serial primary key,
  date text not null,
  title text not null,
  note text not null default '',
  kind text not null default 'personal'
);

create table if not exists books (
  id serial primary key,
  title text not null,
  author text not null default '',
  status text not null default 'reading',
  created_at timestamptz not null default now()
);

alter table workouts add column if not exists duration_min integer;

-- ---------- live pipelines (filled by /api/ingest/* or the UI) ----------
create table if not exists sleep_logs (
  date text primary key,          -- the morning you woke up
  total_min integer not null,
  deep_min integer,
  rem_min integer,
  light_min integer,
  awake_min integer,
  recovery integer,               -- 0-100 (Garmin Body Battery / WHOOP recovery / Oura readiness)
  hrv integer,
  rhr integer,
  bedtime text,
  waketime text,
  source text not null default 'manual',
  updated_at timestamptz not null default now()
);

create table if not exists meals (
  id serial primary key,
  date text not null,
  time text not null default '',
  name text not null,
  kcal integer not null default 0,
  protein double precision not null default 0,
  carbs double precision not null default 0,
  fat double precision not null default 0,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create index if not exists meals_date_idx on meals(date);

create table if not exists email_summaries (
  id text primary key,            -- provider message id, so re-ingesting is idempotent
  received_at timestamptz not null,
  sender text not null,
  subject text not null default '',
  summary text not null default '',
  bullets jsonb not null default '[]',
  tag text not null default 'Other',
  created_at timestamptz not null default now()
);

create table if not exists kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
`;

/** Creates tables on first use and imports starter data once. Safe to call on every request. */
export async function db(): Promise<Sql> {
  const sql = getSql();
  // re-run the (idempotent) schema when it changes, e.g. after a hot reload in dev
  if (globalForDb.__schemaKey !== SCHEMA.length) {
    globalForDb.__schemaKey = SCHEMA.length;
    globalForDb.__schemaReady = undefined;
  }
  if (!globalForDb.__schemaReady) {
    globalForDb.__schemaReady = (async () => {
      await sql.unsafe(SCHEMA);
      const seeded = await sql`select 1 from kv where key = 'seeded'`;
      if (seeded.length === 0) {
        await seedDatabase(sql);
        await sql`insert into kv (key, value) values ('seeded', ${sql.json({ at: new Date().toISOString() })}) on conflict do nothing`;
      }
    })().catch((e) => {
      globalForDb.__schemaReady = undefined;
      throw e;
    });
  }
  await globalForDb.__schemaReady;
  return sql;
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
            on conflict (key) do update set value = excluded.value, updated_at = now()`;
}
