import { NextResponse } from "next/server";
import type { TransactionSql } from "postgres";
import { z } from "zod";
import { db, runAsUser } from "@/lib/db";
import { userForToken } from "@/lib/ingest-tokens";
import { ingestHealth } from "@/lib/health-export";
import { importWorkoutText } from "@/lib/workout-import";
import { ingestPhoneSleep } from "@/lib/phone-sleep";
import { markConnected } from "@/lib/connectors/store";
import { parseISO, todayISO } from "@/lib/dates";
import { matchExercise, parseWorkoutNote, type ParsedExercise } from "@/lib/parse-workout";
import { SESSION_KINDS } from "@/lib/exercises";
import { GroceryItemIn, saveGroceryRun } from "@/lib/groceries";
import { readReceipt } from "@/lib/receipt";

export const dynamic = "force-dynamic";

/**
 * POST /api/ingest/:kind   (Authorization: Bearer <personal key from /connectors>)
 *
 * The door for real data. Anything that can make an HTTP request can feed the penthouse:
 * a nightly garth/Garmin script, an Apple Shortcut, a GitHub Action, a Claude scheduled task.
 * Every kind accepts one object or an array of them, and re-sending the same record is safe (upserts).
 *
 *   sleep   { date, totalMin, deepMin?, remMin?, lightMin?, awakeMin?, recovery?, hrv?, rhr?, bedtime?, waketime?, source? }
 *   meals   { date, time?, name, kcal, protein?, carbs?, fat?, source? }
 *   emails  { id, receivedAt, sender, subject?, summary?, bullets?: string[], tag?, threadId?, url? }   (threadId → "Open in Gmail" link)
 *   todos   { id, title, detail?, due?, sender?, emailId?, threadId?, url? }
 *   phone         { note?, sleep? }   the "Office" iPhone Shortcut: a workout note and Apple Health sleep lines (start | end | stage).
 *   workout-text  { text, date? }   a gym note in the docs/gym-template.md format (the iPhone "Log workout" Shortcut).
 *                 Every dated session in it is imported; re-sending replaces what that note sent before for the same day and type.   (re-sending never un-ticks a done item)
 *   gym-note      { date?, splits: [{ kind, sessions: [{ n, notes, exercises: [{ name, sets: [{ weight, unit, reps, alt }] }] }] }], ideas?, skipped? }
 *                 The Apple Notes gym note parsed by the gym-data-parser agent (scripts/gym_sync.py). Sessions are numbered per split, not dated.
 *   groceries     { date?, store?, total?, extId?, items?: [{ name, qty, unit, price, place?, kcal_per?, ..., barcode? }], text?, image?, mediaType? }
 *                 One shop into the pantry. Send items (missing macros are looked up by barcode, then estimated),
 *                 or a receipt photo (base64 image) or typed text for Claude to read. Re-sending the same extId is skipped.
 */

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const int = z.number().int().nonnegative();

const Sleep = z.object({
  date,
  totalMin: int,
  deepMin: int.optional(),
  remMin: int.optional(),
  lightMin: int.optional(),
  awakeMin: int.optional(),
  recovery: z.number().int().min(0).max(100).optional(),
  hrv: int.optional(),
  rhr: int.optional(),
  bedtime: z.string().max(10).optional(),
  waketime: z.string().max(10).optional(),
  source: z.string().max(40).default("api"),
});
const Meal = z.object({
  date,
  time: z.string().max(5).default(""),
  name: z.string().min(1).max(200),
  kcal: int,
  protein: z.number().nonnegative().default(0),
  carbs: z.number().nonnegative().default(0),
  fat: z.number().nonnegative().default(0),
  source: z.string().max(40).default("api"),
});
const Email = z.object({
  id: z.string().min(1).max(200),
  receivedAt: z.string().min(1),
  sender: z.string().min(1).max(200),
  subject: z.string().max(400).default(""),
  summary: z.string().max(2000).default(""),
  bullets: z.array(z.string().max(400)).max(8).default([]),
  tag: z.string().max(30).default("Other"),
  threadId: z.string().max(200).optional(),
  url: z.string().url().max(500).optional(),
});
const Groceries = z.object({
  date: date.optional(),
  store: z.string().max(100).optional(),
  total: z.number().nonnegative().optional(),
  extId: z.string().max(200).optional(),
  source: z.string().max(40).optional(),
  items: z.array(GroceryItemIn).max(200).optional(),
  text: z.string().max(10_000).optional(),
  image: z.string().max(12_000_000).optional(),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).default("image/jpeg"),
});
const WorkoutText = z.object({ text: z.string().min(1).max(50_000), date: date.optional() });
const NoteSet = z.object({ weight: z.number().nonnegative(), unit: z.enum(["lb", "kg"]), reps: int, alt: int.nullable() });
const GymNote = z.object({
  date: date.optional(),
  splits: z
    .array(
      z.object({
        kind: z.enum(SESSION_KINDS.map((k) => k.id) as [string, ...string[]]),
        sessionCount: int.optional(),
        sessions: z
          .array(
            z.object({
              n: z.number().int().min(1).max(1000),
              notes: z.string().max(1000).default(""),
              exercises: z.array(z.object({ name: z.string().min(1).max(100), sets: z.array(NoteSet).max(30) })).max(30),
            }),
          )
          .max(500),
      }),
    )
    .max(10),
  ideas: z.array(z.string().max(100)).max(30).default([]),
  skipped: z.array(z.string().max(300)).max(100).default([]),
});
const Todo = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  detail: z.string().max(1000).default(""),
  due: date.optional(),
  sender: z.string().max(200).default(""),
  emailId: z.string().max(200).optional(),
  threadId: z.string().max(200).optional(),
  url: z.string().url().max(500).optional(),
});

/** Link to the email in Gmail: an explicit url wins, otherwise built from the thread id. */
const gmailUrl = (r: { url?: string; threadId?: string }) =>
  r.url ?? (r.threadId ? `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(r.threadId)}` : null);

export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const userId = await userForToken(got).catch(() => null);
  if (!userId) {
    await new Promise((r) => setTimeout(r, 300));
    return NextResponse.json({ error: "unauthorized: use the personal key from the Connectors page" }, { status: 401 });
  }
  const { kind } = await params;
  return runAsUser(userId, () => handle(req, kind, userId));
}

async function handle(req: Request, kind: string, userId: string) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (kind === "workout-text") return ingestWorkoutText(body);
  if (kind === "gym-note") return ingestGymNote(body);
  if (kind === "groceries") return ingestGroceries(body);
  if (kind === "health") return NextResponse.json(await ingestHealth(body));
  if (kind === "phone") {
    // the one "Office" iPhone Shortcut: { note?: string, sleep?: string }, either part may be empty
    const b = (body ?? {}) as { note?: unknown; sleep?: unknown };
    const join = (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("\n") : typeof v === "string" ? v : "");
    const note = join(b.note), sleepText = join(b.sleep);
    const [wr, nr] = await Promise.allSettled([
      note.trim() ? importWorkoutText(note, "note", { hint: "an iPhone Notes workout log" }) : Promise.resolve(null),
      sleepText.trim() ? ingestPhoneSleep(sleepText) : Promise.resolve(0),
    ]);
    const w = wr.status === "fulfilled" ? wr.value : null;
    const nights = nr.status === "fulfilled" ? nr.value : 0;
    const parts = [
      wr.status === "rejected" ? "Couldn't read the workout note just now." : w?.message ?? "",
      nr.status === "rejected" ? "Couldn't read sleep just now." : nights ? `Saved ${nights} night${nights > 1 ? "s" : ""} of sleep.` : "",
    ].filter(Boolean);
    if (w?.sessions) await markConnected(userId, "apple-notes", { via: "shortcut" }).catch(() => {});
    if (nights) await markConnected(userId, "apple-health", { via: "shortcut" }).catch(() => {});
    return NextResponse.json({ ok: !!(w?.sessions || nights), message: parts.join(" ") || "Nothing new." });
  }
  if (kind === "notes") {
    const text = typeof body === "string" ? body : String((body as { text?: unknown })?.text ?? "");
    const res = await importWorkoutText(text, "note", { hint: "an iPhone Notes workout log" });
    return NextResponse.json({ ok: res.sessions > 0, ...res });
  }
  const items = Array.isArray(body) ? body : [body];
  if (items.length > 500) return NextResponse.json({ error: "max 500 records per request" }, { status: 413 });
  const sql = await db();

  try {
    switch (kind) {
      case "sleep": {
        const rows = z.array(Sleep).parse(items);
        for (const r of rows) {
          await sql`insert into sleep_logs (date, total_min, deep_min, rem_min, light_min, awake_min, recovery, hrv, rhr, bedtime, waketime, source, updated_at)
            values (${r.date}, ${r.totalMin}, ${r.deepMin ?? null}, ${r.remMin ?? null}, ${r.lightMin ?? null}, ${r.awakeMin ?? null}, ${r.recovery ?? null},
                    ${r.hrv ?? null}, ${r.rhr ?? null}, ${r.bedtime ?? null}, ${r.waketime ?? null}, ${r.source}, now())
            on conflict (user_id, date) do update set total_min = excluded.total_min, deep_min = excluded.deep_min, rem_min = excluded.rem_min,
              light_min = excluded.light_min, awake_min = excluded.awake_min, recovery = excluded.recovery, hrv = excluded.hrv,
              rhr = excluded.rhr, bedtime = excluded.bedtime, waketime = excluded.waketime, source = excluded.source, updated_at = now()`;
        }
        return NextResponse.json({ ok: true, kind, count: rows.length });
      }
      case "meals": {
        const rows = z.array(Meal).parse(items);
        for (const r of rows) {
          // idempotent on (date, time, name): re-sending a meal updates it
          const hit = await sql`select id from meals where date = ${r.date} and time = ${r.time} and name = ${r.name} limit 1`;
          if (hit.length)
            await sql`update meals set kcal = ${r.kcal}, protein = ${r.protein}, carbs = ${r.carbs}, fat = ${r.fat}, source = ${r.source} where id = ${hit[0].id}`;
          else
            await sql`insert into meals (date, time, name, kcal, protein, carbs, fat, source) values (${r.date}, ${r.time}, ${r.name}, ${r.kcal}, ${r.protein}, ${r.carbs}, ${r.fat}, ${r.source})`;
        }
        return NextResponse.json({ ok: true, kind, count: rows.length });
      }
      case "emails": {
        const rows = z.array(Email).parse(items);
        for (const r of rows) {
          await sql`insert into email_summaries (id, received_at, sender, subject, summary, bullets, tag, url)
            values (${r.id}, ${r.receivedAt}, ${r.sender}, ${r.subject}, ${r.summary}, ${sql.json(r.bullets)}, ${r.tag}, ${gmailUrl(r)})
            on conflict (user_id, id) do update set summary = excluded.summary, bullets = excluded.bullets, tag = excluded.tag,
              url = coalesce(excluded.url, email_summaries.url)`;
        }
        return NextResponse.json({ ok: true, kind, count: rows.length });
      }
      case "todos": {
        const rows = z.array(Todo).parse(items);
        for (const r of rows) {
          await sql`insert into todos (id, title, detail, due, sender, email_id, url)
            values (${r.id}, ${r.title}, ${r.detail}, ${r.due ?? null}, ${r.sender}, ${r.emailId ?? null}, ${gmailUrl(r)})
            on conflict (user_id, id) do update set title = excluded.title, detail = excluded.detail, due = excluded.due, sender = excluded.sender,
              url = coalesce(excluded.url, todos.url)`;
        }
        return NextResponse.json({ ok: true, kind, count: rows.length });
      }
      default:
        return NextResponse.json({ error: `unknown kind "${kind}"` }, { status: 404 });
    }
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "invalid payload", issues: e.issues.slice(0, 5) }, { status: 422 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

type Tx = TransactionSql;

/** One workout's sets, adding exercises the library doesn't know yet. */
async function insertSets(tx: Tx, workoutId: number, exercises: ParsedExercise[]) {
  for (const [order, ex] of exercises.entries()) {
    if (!ex.known) await tx`insert into exercises (name, muscle, kind) values (${ex.name}, 'Other', 'compound') on conflict (user_id, name) do nothing`;
    for (const [i, st] of ex.sets.entries()) {
      await tx`insert into sets (workout_id, exercise, ex_order, set_no, weight, unit, reps, reps_alt)
               values (${workoutId}, ${ex.name}, ${order}, ${i + 1}, ${st.weight}, ${st.unit}, ${st.reps}, ${st.alt})`;
    }
  }
}

/**
 * The Apple Notes gym note, already parsed by the gym-data-parser agent (scripts/gym_sync.py).
 * The note has no dates: a session is (kind, n), the nth time that split was logged. Known sessions keep
 * their date and get their sets replaced; a new one is dated `date` (the day the note was last edited).
 */
async function ingestGymNote(body: unknown) {
  const parsed = GymNote.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload", issues: parsed.error.issues.slice(0, 5) }, { status: 422 });
  const { splits, ideas, skipped } = parsed.data;
  const day = parsed.data.date ?? todayISO();
  const added: string[] = [];
  let updated = 0;

  const sql = await db();
  await sql.begin(async (tx) => {
    for (const sp of splits) {
      // the first import of this note (seed.ts) becomes sessions 1..n, so they're updated instead of copied
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from workouts where source = 'note' and kind = ${sp.kind}`;
      if (!n) {
        await tx`update workouts w set source = 'note', note_seq = r.n
          from (select id, row_number() over (order by date, id) as n from workouts
                where source = 'manual' and kind = ${sp.kind} and notes like 'Imported from your notes%') r
          where w.id = r.id`;
      }
      const fresh = sp.sessions.filter((s) => s.exercises.length);
      const known = new Map(
        (await tx<{ id: number; note_seq: number; notes: string }[]>`select id, note_seq, notes from workouts where source = 'note' and kind = ${sp.kind}`).map((r) => [r.note_seq, r]),
      );
      const newOnes = fresh.filter((s) => !known.has(s.n)).sort((a, b) => a.n - b.n);
      for (const s of fresh) {
        const exercises = s.exercises.map((e) => ({ ...matchExercise(e.name), sets: e.sets }));
        const hit = known.get(s.n);
        let id: number;
        if (hit) {
          id = hit.id;
          await tx`delete from sets where workout_id = ${id}`;
          if (s.notes && !hit.notes.includes(s.notes)) await tx`update workouts set notes = ${[hit.notes, s.notes].filter(Boolean).join(" ")} where id = ${id}`;
          updated++;
        } else {
          // several new sessions at once (a first sync, or the Mac was off): only the newest gets the real day, older ones a week apart, flagged
          const back = newOnes.length - 1 - newOnes.indexOf(s);
          const d = parseISO(day);
          d.setUTCDate(d.getUTCDate() - 7 * back);
          const date = d.toISOString().slice(0, 10);
          const [w] = await tx<{ id: number }[]>`insert into workouts (date, kind, notes, source, note_seq, date_estimated)
            values (${date}, ${sp.kind}, ${s.notes}, 'note', ${s.n}, ${newOnes.length > 1}) returning id`;
          id = w.id;
          added.push(`${SESSION_KINDS.find((k) => k.id === sp.kind)?.label ?? sp.kind} #${s.n} (${date})`);
        }
        await insertSets(tx, id, exercises);
      }
    }
  });

  const counts = Object.fromEntries(
    (await sql<{ kind: string; n: number }[]>`select kind, max(note_seq)::int as n from workouts where source = 'note' group by kind`).map((r) => [r.kind, r.n]),
  );
  const message = [
    added.length ? `New: ${added.join(", ")}.` : "No new sessions.",
    updated ? `Updated ${updated}.` : "",
    ideas.length ? `Ideas: ${ideas.join(", ")}.` : "",
    skipped.length ? `Couldn't read: ${skipped.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return NextResponse.json({ ok: true, kind: "gym-note", added, updated, counts, message });
}

/** The gym note Shortcut. Answers in plain text-ish JSON the Shortcut can show as-is. */
async function ingestWorkoutText(body: unknown) {
  const parsed = WorkoutText.safeParse(typeof body === "string" ? { text: body } : body);
  if (!parsed.success) return NextResponse.json({ error: "send { text: <the note> }" }, { status: 422 });
  const { sessions, skipped } = parseWorkoutNote(parsed.data.text, parsed.data.date ?? todayISO());
  if (!sessions.length) {
    return NextResponse.json({ ok: false, message: "No sets found. Check the note follows the gym template.", skipped }, { status: 422 });
  }
  if (sessions.length > 120) return NextResponse.json({ error: "max 120 sessions per note" }, { status: 413 });

  const sql = await db();
  await sql.begin(async (tx) => {
    for (const s of sessions) {
      // replace only what a shortcut sent for this day and type; hand-logged and imported workouts stay
      await tx`delete from workouts where source = 'shortcut' and date = ${s.date} and kind = ${s.kind}`;
      const [w] = await tx<{ id: number }[]>`insert into workouts (date, kind, notes, source) values (${s.date}, ${s.kind}, ${s.notes}, 'shortcut') returning id`;
      await insertSets(tx, w.id, s.exercises);
    }
  });

  const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const latest = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
  const sets = latest.exercises.reduce((n, e) => n + e.sets.length, 0);
  const newNames = [...new Set(sessions.flatMap((s) => s.exercises.filter((e) => !e.known).map((e) => e.name)))];
  const message = [
    `Saved ${sessions.length} session${sessions.length > 1 ? "s" : ""}. Latest: ${SESSION_KINDS.find((k) => k.id === latest.kind)?.label ?? latest.kind} on ${fmt(latest.date)}, ${latest.exercises.length} exercises, ${sets} sets.`,
    newNames.length ? `New exercises: ${newNames.join(", ")}.` : "",
    skipped.length ? `Couldn't read: ${skipped.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return NextResponse.json({ ok: true, kind: "workout-text", sessions: sessions.length, skipped, message });
}

/** A shop from a script (Lidl Plus sync), a Shortcut (receipt photo) or anything else. */
async function ingestGroceries(body: unknown) {
  const parsed = Groceries.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload", issues: parsed.error.issues.slice(0, 5) }, { status: 422 });
  const g = parsed.data;
  try {
    const sql = await db();
    // check before reading, so a re-sent receipt doesn't cost a Claude call
    if (g.extId && (await sql`select 1 from grocery_runs where ext_id = ${g.extId}`).length) return NextResponse.json({ ok: true, skipped: true, message: "Already saved." });
    let { items, store, total, date: day } = g;
    let source = g.source ?? "api";
    if (!items?.length) {
      if (!g.text && !g.image) return NextResponse.json({ error: "send items, text or image" }, { status: 422 });
      const draft = await readReceipt({ text: g.text, image: g.image ? { data: g.image, mediaType: g.mediaType } : undefined });
      items = draft.items;
      store ??= draft.store;
      total ??= draft.total ?? undefined;
      day ??= draft.date ?? undefined;
      source = g.source ?? (g.image ? "receipt" : "text");
    }
    if (!items.length) return NextResponse.json({ ok: false, message: "No food found." }, { status: 422 });
    const saved = await saveGroceryRun(sql, { date: day ?? todayISO(), store: store ?? "", total, source, extId: g.extId, items });
    if (!saved) return NextResponse.json({ ok: true, skipped: true, message: "Already saved." });
    return NextResponse.json({ ok: true, id: saved.id, message: `Saved ${saved.items} items${store ? ` from ${store}` : ""}.` });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
