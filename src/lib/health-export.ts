import { db, getKV, setKV } from "./db";

/**
 * Maps a "Health Auto Export" (iOS app) REST payload to Office tables.
 *   { data: { metrics: [{ name, units, data: [...] }], workouts: [...] } }
 * Sleep -> sleep_logs, running/walking workouts with distance -> runs, other workouts -> workouts,
 * steps and active energy -> kv "health_daily". Every write is an upsert, so resending is safe.
 */

type Num = { qty?: number; units?: string } | number | undefined;
const num = (v: Num) => (typeof v === "number" ? v : typeof v?.qty === "number" ? v.qty : undefined);
const day = (s: unknown) => (typeof s === "string" ? s.slice(0, 10) : "");
const hhmm = (s: unknown) => (typeof s === "string" ? (s.match(/\d{2}:\d{2}/)?.[0] ?? null) : null);
const toKm = (v: Num) => {
  const q = num(v);
  if (q === undefined) return undefined;
  const u = typeof v === "object" ? (v.units ?? "km").toLowerCase() : "km";
  return u.startsWith("mi") ? q * 1.60934 : u === "m" ? q / 1000 : q;
};

export async function ingestHealth(body: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = (body as any)?.data ?? body ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metrics: any[] = Array.isArray(data.metrics) ? data.metrics : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workouts: any[] = Array.isArray(data.workouts) ? data.workouts : [];
  const sql = await db();
  const out = { sleep: 0, runs: 0, workouts: 0, days: 0 };

  const daily = await getKV<Record<string, { steps?: number; activeKcal?: number }>>("health_daily", {});
  const seen = new Set<string>();

  for (const m of metrics) {
    const name = String(m?.name ?? "");
    const rows = Array.isArray(m?.data) ? m.data : [];
    if (name === "sleep_analysis") {
      for (const r of rows) {
        const date = day(r.sleepEnd ?? r.date);
        const hours = num(r.totalSleep) ?? num(r.asleep) ?? (num(r.core) ?? 0) + (num(r.deep) ?? 0) + (num(r.rem) ?? 0);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !hours) continue;
        const min = (h: Num) => (num(h) === undefined ? null : Math.round(num(h)! * 60));
        await sql`insert into sleep_logs (date, total_min, deep_min, rem_min, light_min, awake_min, bedtime, waketime, source)
          values (${date}, ${Math.round(hours * 60)}, ${min(r.deep)}, ${min(r.rem)}, ${min(r.core)}, ${min(r.awake)},
                  ${hhmm(r.sleepStart)}, ${hhmm(r.sleepEnd)}, 'apple-health')
          on conflict (user_id, date) do update set total_min = excluded.total_min, deep_min = excluded.deep_min,
            rem_min = excluded.rem_min, light_min = excluded.light_min, awake_min = excluded.awake_min,
            bedtime = excluded.bedtime, waketime = excluded.waketime, source = excluded.source, updated_at = now()`;
        out.sleep++;
      }
    } else if (name === "step_count" || name === "active_energy") {
      const kj = (m.units ?? "").toLowerCase() === "kj";
      for (const r of rows) {
        const d = day(r.date);
        const q = num(r.qty ?? r);
        if (!d || q === undefined) continue;
        // values arrive per day (or per hour): sum within this payload, replace what an earlier send stored
        const key = `${name}|${d}`;
        const cur = (daily[d] ??= {});
        const v = Math.round(kj ? q / 4.184 : q);
        if (name === "step_count") cur.steps = (seen.has(key) ? (cur.steps ?? 0) : 0) + v;
        else cur.activeKcal = (seen.has(key) ? (cur.activeKcal ?? 0) : 0) + v;
        seen.add(key);
      }
    }
  }

  for (const w of workouts) {
    const name = String(w?.name ?? "Workout");
    const date = day(w.start);
    if (!date) continue;
    const ext = String(w.id ?? `${w.start}|${name}`);
    const durSec = Math.round(num(w.duration) ?? 0);
    const km = toKm(w.distance);
    if (/run|walk|hike/i.test(name) && km && km > 0.2) {
      const hr = num(w.avgHeartRate) ?? num(w.heartRate?.avg);
      await sql`insert into runs (date, distance_km, duration_sec, kind, avg_hr, notes, source, ext_id)
        values (${date}, ${Math.round(km * 100) / 100}, ${durSec}, ${/walk|hike/i.test(name) ? "walk" : "easy"},
                ${hr ? Math.round(hr) : null}, ${name}, 'apple-health', ${ext})
        on conflict (user_id, source, ext_id) do update set distance_km = excluded.distance_km, duration_sec = excluded.duration_sec, avg_hr = excluded.avg_hr`;
      out.runs++;
    } else {
      await sql`insert into workouts (date, kind, notes, duration_min, source, ext_id)
        values (${date}, ${"other"}, ${name}, ${Math.round(durSec / 60) || null}, 'apple-health', ${ext})
        on conflict (user_id, source, ext_id) do update set duration_min = excluded.duration_min`;
      out.workouts++;
    }
  }

  const keys = Object.keys(daily).sort().slice(-60);
  out.days = keys.length;
  if (keys.length) await setKV("health_daily", Object.fromEntries(keys.map((k) => [k, daily[k]])));
  return { ok: true, ...out, message: `Saved ${out.sleep} nights, ${out.runs} runs, ${out.workouts} workouts, ${out.days} days of steps.` };
}
