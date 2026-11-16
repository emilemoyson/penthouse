import { db, runAsUser } from "../db";
import { importWorkoutText } from "../workout-import";
import { accessToken } from "./oauth";
import { syncGoogle } from "./google";
import { markSynced } from "./store";

const DAY = 86400;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Local date and time from a UTC timestamp plus an offset like "-05:00". */
function local(ts: string, offset?: string | null) {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset ?? "");
  const off = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60_000 : 0;
  const d = new Date(Date.parse(ts) + off).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}

async function getJson(url: string, token: string, headers: Record<string, string> = {}) {
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}`, ...headers }, cache: "no-store" });
  if (r.status === 401) throw new Error("The connection expired. Connect again.");
  if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
  return r.json();
}

/* ---------- Strava ---------- */

type StravaActivity = {
  id: number; name: string; sport_type?: string; type?: string; start_date: string; start_date_local: string;
  distance: number; moving_time: number; elapsed_time: number; average_heartrate?: number;
};

export async function syncStrava(userId: string, days = 14) {
  const token = await accessToken(userId, "strava");
  const after = Math.floor(Date.now() / 1000) - days * DAY;
  const acts: StravaActivity[] = [];
  for (let page = 1; page <= 5; page++) {
    const batch = (await getJson(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`, token)) as StravaActivity[];
    acts.push(...batch);
    if (batch.length < 100) break;
  }
  let runs = 0, workouts = 0;
  await runAsUser(userId, async () => {
    const sql = await db();
    for (const a of acts) {
      const sport = a.sport_type ?? a.type ?? "Workout";
      const date = a.start_date_local.slice(0, 10);
      const ext = String(a.id);
      if (/Run|Walk|Hike/.test(sport) && a.distance > 200) {
        const kind = /Walk|Hike/.test(sport) ? "easy" : a.distance >= 15000 ? "long" : "easy";
        await sql`insert into runs (date, distance_km, duration_sec, kind, avg_hr, notes, source, ext_id)
          values (${date}, ${Math.round(a.distance / 10) / 100}, ${a.moving_time}, ${kind}, ${a.average_heartrate ? Math.round(a.average_heartrate) : null}, ${a.name}, 'strava', ${ext})
          on conflict (user_id, source, ext_id) do update set distance_km = excluded.distance_km, duration_sec = excluded.duration_sec,
            avg_hr = excluded.avg_hr, notes = excluded.notes, date = excluded.date`;
        runs++;
      } else {
        await sql`insert into workouts (date, kind, notes, duration_min, source, ext_id)
          values (${date}, 'other', ${`${a.name} (${sport})`}, ${Math.round(a.moving_time / 60)}, 'strava', ${ext})
          on conflict (user_id, source, ext_id) do update set notes = excluded.notes, duration_min = excluded.duration_min, date = excluded.date`;
        workouts++;
      }
    }
  });
  return `${runs} runs and ${workouts} other activities`;
}

/* ---------- WHOOP ---------- */

const WHOOP = "https://api.prod.whoop.com/developer/v2";

async function whoopAll(path: string, token: string, start: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = [];
  let next: string | undefined;
  for (let i = 0; i < 8; i++) {
    const u = new URL(`${WHOOP}${path}`);
    u.searchParams.set("start", start);
    u.searchParams.set("limit", "25");
    if (next) u.searchParams.set("nextToken", next);
    const j = await getJson(u.toString(), token);
    out.push(...(j.records ?? []));
    next = j.next_token ?? j.nextToken;
    if (!next) break;
  }
  return out;
}

export async function syncWhoop(userId: string, days = 14) {
  const token = await accessToken(userId, "whoop");
  const start = new Date(Date.now() - days * DAY * 1000).toISOString();
  const [sleeps, recoveries, workouts] = await Promise.all([
    whoopAll("/activity/sleep", token, start),
    whoopAll("/recovery", token, start),
    whoopAll("/activity/workout", token, start),
  ]);
  const rec = new Map(recoveries.map((r) => [String(r.sleep_id), r.score ?? {}]));
  const min = (ms?: number) => (typeof ms === "number" ? Math.round(ms / 60000) : null);
  let nights = 0, sessions = 0;
  await runAsUser(userId, async () => {
    const sql = await db();
    for (const s of sleeps) {
      if (s.nap || s.score_state !== "SCORED" || !s.score?.stage_summary) continue;
      const st = s.score.stage_summary;
      const total = (st.total_light_sleep_time_milli ?? 0) + (st.total_slow_wave_sleep_time_milli ?? 0) + (st.total_rem_sleep_time_milli ?? 0);
      if (!total) continue;
      const end = local(s.end, s.timezone_offset);
      const bed = local(s.start, s.timezone_offset);
      const r = rec.get(String(s.id)) ?? {};
      await sql`insert into sleep_logs (date, total_min, deep_min, rem_min, light_min, awake_min, recovery, hrv, rhr, bedtime, waketime, source)
        values (${end.date}, ${min(total)}, ${min(st.total_slow_wave_sleep_time_milli)}, ${min(st.total_rem_sleep_time_milli)},
                ${min(st.total_light_sleep_time_milli)}, ${min(st.total_awake_time_milli)},
                ${r.recovery_score != null ? Math.round(r.recovery_score) : null}, ${r.hrv_rmssd_milli != null ? Math.round(r.hrv_rmssd_milli) : null},
                ${r.resting_heart_rate != null ? Math.round(r.resting_heart_rate) : null}, ${bed.time}, ${end.time}, 'whoop')
        on conflict (user_id, date) do update set total_min = excluded.total_min, deep_min = excluded.deep_min, rem_min = excluded.rem_min,
          light_min = excluded.light_min, awake_min = excluded.awake_min, recovery = excluded.recovery, hrv = excluded.hrv, rhr = excluded.rhr,
          bedtime = excluded.bedtime, waketime = excluded.waketime, source = excluded.source, updated_at = now()`;
      nights++;
    }
    for (const w of workouts) {
      const sport = String(w.sport_name ?? "Workout");
      const date = local(w.start, w.timezone_offset).date;
      const durMin = Math.round((Date.parse(w.end) - Date.parse(w.start)) / 60000);
      const dist = w.score?.distance_meter as number | undefined;
      if (/run/i.test(sport) && dist && dist > 200) {
        await sql`insert into runs (date, distance_km, duration_sec, kind, avg_hr, notes, source, ext_id)
          values (${date}, ${Math.round(dist / 10) / 100}, ${durMin * 60}, 'easy', ${w.score?.average_heart_rate ?? null}, ${sport}, 'whoop', ${String(w.id)})
          on conflict (user_id, source, ext_id) do update set distance_km = excluded.distance_km, duration_sec = excluded.duration_sec`;
      } else {
        const strain = w.score?.strain != null ? `, strain ${Number(w.score.strain).toFixed(1)}` : "";
        await sql`insert into workouts (date, kind, notes, duration_min, source, ext_id)
          values (${date}, 'other', ${`${sport}${strain}`}, ${durMin}, 'whoop', ${String(w.id)})
          on conflict (user_id, source, ext_id) do update set notes = excluded.notes, duration_min = excluded.duration_min`;
      }
      sessions++;
    }
  });
  return `${nights} nights and ${sessions} workouts`;
}

/* ---------- Notion ---------- */

const NOTION = { "Notion-Version": "2022-06-28" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rich = (arr: any[] | undefined) => (arr ?? []).map((t) => t.plain_text ?? "").join("");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function propText(p: any): string {
  switch (p?.type) {
    case "title": return rich(p.title);
    case "rich_text": return rich(p.rich_text);
    case "number": return p.number == null ? "" : String(p.number);
    case "date": return p.date?.start ?? "";
    case "select": return p.select?.name ?? "";
    case "multi_select": return (p.multi_select ?? []).map((s: { name: string }) => s.name).join(", ");
    case "checkbox": return p.checkbox ? "yes" : "";
    default: return "";
  }
}

async function pageText(id: string, token: string) {
  const lines: string[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const j = await getJson(`https://api.notion.com/v1/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`, token, NOTION);
    for (const b of j.results ?? []) {
      const t = rich(b[b.type]?.rich_text);
      if (t) lines.push(t);
    }
    if (!j.has_more) break;
    cursor = j.next_cursor;
  }
  return lines.join("\n");
}

export async function syncNotion(userId: string, days = 14) {
  const token = await accessToken(userId, "notion");
  const since = Date.now() - days * DAY * 1000;
  const j = await (await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...NOTION },
    body: JSON.stringify({ filter: { property: "object", value: "page" }, sort: { direction: "descending", timestamp: "last_edited_time" }, page_size: 50 }),
  })).json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pages = ((j.results ?? []) as any[]).filter((p) => Date.parse(p.last_edited_time) >= since).slice(0, 25);
  if (!pages.length) return "no pages edited lately";
  const parts: string[] = [];
  for (const p of pages) {
    const props = Object.entries(p.properties ?? {})
      .map(([k, v]) => `${k}: ${propText(v)}`)
      .filter((s) => !s.endsWith(": "))
      .join(" | ");
    const body = await pageText(p.id, token);
    parts.push(`--- page (edited ${p.last_edited_time.slice(0, 10)}, created ${String(p.created_time).slice(0, 10)}) ---\n${props}\n${body}`);
  }
  const res = await runAsUser(userId, () => importWorkoutText(parts.join("\n\n"), "notion", { hint: "Notion workout pages", sinceDays: days }));
  return res.message;
}

/* ---------- dispatcher ---------- */

const SYNC: Record<string, (userId: string, days?: number) => Promise<string>> = {
  strava: syncStrava,
  whoop: syncWhoop,
  notion: syncNotion,
  google: syncGoogle,
};

export const canSync = (id: string) => Object.hasOwn(SYNC, id);

export async function runSync(userId: string, id: string, days = 14): Promise<{ ok: boolean; message: string }> {
  try {
    const message = await SYNC[id](userId, days);
    await markSynced(userId, id, null);
    return { ok: true, message };
  } catch (e) {
    const message = e instanceof Error ? e.message : "sync failed";
    await markSynced(userId, id, message).catch(() => {});
    return { ok: false, message };
  }
}

export { isoDay };
