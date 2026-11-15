import { NextResponse } from "next/server";
import { rootSql } from "@/lib/db";
import { canSync, runSync } from "@/lib/connectors/sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Hourly (vercel.json): refresh every OAuth connection with the last 3 days, a few users at a time. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await rootSql()<{ user_id: string; connector: string }[]>`
    select user_id, connector from user_connectors where status = 'connected' and secret is not null
    order by last_sync nulls first limit 200`;
  const jobs = rows.filter((r) => canSync(r.connector));
  const results: { connector: string; ok: boolean }[] = [];
  const started = Date.now();
  for (let i = 0; i < jobs.length && Date.now() - started < 250_000; i += 5) {
    const batch = jobs.slice(i, i + 5);
    const out = await Promise.all(batch.map((j) => runSync(j.user_id, j.connector, 3)));
    out.forEach((o, k) => results.push({ connector: batch[k].connector, ok: o.ok }));
  }
  return NextResponse.json({ ran: results.length, failed: results.filter((r) => !r.ok).length });
}
