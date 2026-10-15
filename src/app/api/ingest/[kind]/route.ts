import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/ingest/:kind   (Authorization: Bearer $INGEST_TOKEN)
 *
 * The door for real data. Anything that can make an HTTP request can feed the penthouse:
 * a nightly garth/Garmin script, an Apple Shortcut, a GitHub Action, a Claude scheduled task.
 * Every kind accepts one object or an array of them, and re-sending the same record is safe (upserts).
 *
 *   sleep   { date, totalMin, deepMin?, remMin?, lightMin?, awakeMin?, recovery?, hrv?, rhr?, bedtime?, waketime?, source? }
 *   meals   { date, time?, name, kcal, protein?, carbs?, fat?, source? }
 *   emails  { id, receivedAt, sender, subject?, summary?, bullets?: string[], tag? }
 *   events  { date, title, note?, kind?: "school" | "personal" }
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
});
const Event = z.object({
  date,
  title: z.string().min(1).max(200),
  note: z.string().max(1000).default(""),
  kind: z.enum(["school", "personal"]).default("personal"),
});

function authorised(req: Request) {
  const token = process.env.INGEST_TOKEN;
  if (!token) return false;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (got.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!process.env.INGEST_TOKEN) return NextResponse.json({ error: "INGEST_TOKEN is not set on the server" }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { kind } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
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
            on conflict (date) do update set total_min = excluded.total_min, deep_min = excluded.deep_min, rem_min = excluded.rem_min,
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
          await sql`insert into email_summaries (id, received_at, sender, subject, summary, bullets, tag)
            values (${r.id}, ${r.receivedAt}, ${r.sender}, ${r.subject}, ${r.summary}, ${sql.json(r.bullets)}, ${r.tag})
            on conflict (id) do update set summary = excluded.summary, bullets = excluded.bullets, tag = excluded.tag`;
        }
        return NextResponse.json({ ok: true, kind, count: rows.length });
      }
      case "events": {
        const rows = z.array(Event).parse(items);
        for (const r of rows) {
          const hit = await sql`select id from events where date = ${r.date} and title = ${r.title} limit 1`;
          if (hit.length) await sql`update events set note = ${r.note}, kind = ${r.kind} where id = ${hit[0].id}`;
          else await sql`insert into events (date, title, note, kind) values (${r.date}, ${r.title}, ${r.note}, ${r.kind})`;
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
