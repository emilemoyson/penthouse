/**
 * Server-side loaders for the four zone panels. Each returns a typed payload and never throws:
 * if a source isn't connected yet it falls back to a labelled sample.
 *
 * Where live data comes from:
 *   sleep        → sleep_logs table   ← POST /api/ingest/sleep   (Garmin/garth script, Oura, WHOOP, Apple Health export)
 *   professional → Google Sheet (jobs) + email_summaries ← POST /api/ingest/emails + events table (calendar)
 *   fitness      → workouts / sets / runs tables (Training tab, later Strava)
 *   nutrition    → meals table        ← kitchen panel form or POST /api/ingest/meals
 */
import { db, getKV } from "@/lib/db";
import { addDays, daysBetween, fShort, lastNDays, mondayOf, todayISO } from "@/lib/dates";
import { loadTraining, fmtW } from "@/lib/training";
import { exerciseSummaries, setsPerMuscle } from "@/lib/coach";
import { loadJobs, jobAnalytics } from "@/lib/jobs";
import { sampleEmails, sampleKcalWeek, sampleMeals, sampleSleep } from "./samples";
import type { CalendarItem, FitnessData, NutritionData, PenthouseData, ProfessionalData, SleepData, SleepNight } from "./types";

const now = () => new Date().toISOString();

/* -------------------------------------------------------------------------- */
/* 🛏️  Sleep                                                                    */
/* -------------------------------------------------------------------------- */

type SleepRow = {
  date: string;
  total_min: number;
  deep_min: number | null;
  rem_min: number | null;
  light_min: number | null;
  awake_min: number | null;
  recovery: number | null;
  hrv: number | null;
  rhr: number | null;
  bedtime: string | null;
  waketime: string | null;
};

export async function getSleepData(today = todayISO()): Promise<SleepData> {
  const targetMin = (await getKV<{ sleepTargetMin?: number }>("targets", {})).sleepTargetMin ?? 480;
  try {
    const sql = await db();
    const rows = await sql<SleepRow[]>`select * from sleep_logs where date >= ${addDays(today, -13)} order by date`;
    if (!rows.length) {
      const s = sampleSleep(today);
      return { source: "sample", updatedAt: now(), lastNight: s.lastNight, week: s.week, targetMin };
    }
    const toNight = (r: SleepRow): SleepNight => ({
      date: r.date,
      totalMin: r.total_min,
      deepMin: r.deep_min,
      remMin: r.rem_min,
      lightMin: r.light_min,
      awakeMin: r.awake_min,
      recovery: r.recovery,
      hrv: r.hrv,
      rhr: r.rhr,
      bedtime: r.bedtime,
      waketime: r.waketime,
    });
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const last = rows[rows.length - 1];
    return {
      source: "live",
      updatedAt: now(),
      lastNight: toNight(last),
      week: lastNDays(7, today).map((d) => ({ date: d, totalMin: byDate.get(d)?.total_min ?? 0, recovery: byDate.get(d)?.recovery ?? null })),
      targetMin,
    };
  } catch {
    const s = sampleSleep(today);
    return { source: "sample", updatedAt: now(), lastNight: s.lastNight, week: s.week, targetMin };
  }
}

/* -------------------------------------------------------------------------- */
/* 🖥️  Professional                                                             */
/* -------------------------------------------------------------------------- */

export async function getProfessionalData(today = todayISO()): Promise<ProfessionalData> {
  // no database: still show the sheet and placeholders instead of breaking the home page
  const sql = await db().catch(() => null);

  // Jobs: the Job Search 2027 sheet
  const res = await loadJobs().catch(() => null);
  let jobs: ProfessionalData["jobs"] = { ok: false, message: "Couldn't load the job sheet.", rows: [], appliedThisWeek: 0, weeklyTarget: 10, active: 0, toApply: 0, responseRate: null };
  if (res?.ok) {
    const a = jobAnalytics(res.jobs, res.contacts, res.settings, today);
    const order = ["Interview", "Final round", "To do assessment", "Assessment complete", "Applied", "To apply", "Offer", "Ghosted", "Rejected", "Withdrawn", "Closed"];
    jobs = {
      ok: true,
      rows: [...res.jobs]
        .sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status) || (y.dateApplied || "").localeCompare(x.dateApplied || ""))
        .map((j) => ({ id: j.id, company: j.company, role: j.role, status: j.status, applied: j.dateApplied, link: j.link })),
      appliedThisWeek: a.appsThisWeek,
      weeklyTarget: res.settings.appTarget,
      active: a.active,
      toApply: a.toApply.length,
      responseRate: a.responseRate,
    };
  } else if (res && !res.ok && res.reason === "not_configured") {
    jobs.message = "Connect the Job Search sheet (JOBS_SHEET_URL / JOBS_SHEET_TOKEN).";
  }

  // AI email summaries: written by the inbox job into email_summaries
  const mail = sql
    ? await sql<{ id: string; received_at: Date; sender: string; subject: string; summary: string; bullets: string[]; tag: string; url: string | null }[]>`
        select id, received_at, sender, subject, summary, bullets, tag, url from email_summaries order by received_at desc limit 12`.catch(() => [])
    : [];
  const emails: ProfessionalData["emails"] = mail.length
    ? {
        source: "live",
        items: mail.map((m) => ({
          id: m.id,
          receivedAt: new Date(m.received_at).toISOString(),
          sender: m.sender,
          subject: m.subject,
          bullets: Array.isArray(m.bullets) && m.bullets.length ? m.bullets : m.summary ? [m.summary] : [],
          tag: m.tag,
          url: m.url ?? undefined,
        })),
      }
    : { source: "sample", items: sampleEmails(today) };

  // Calendar: events table (Ledger + school events). HOOK: merge Google Calendar here (calendar.events.list, timeMin=now).
  const weekStart = mondayOf(today);
  const ev = sql
    ? await sql<{ date: string; title: string; kind: string; note: string; time: string | null; location: string }[]>`
        select date, title, kind, note, time, location from events where date >= ${weekStart} and date <= ${addDays(weekStart, 34)} order by date, id limit 200`.catch(() => [])
    : [];
  const calendar: ProfessionalData["calendar"] = {
    source: sql ? "live" : "sample",
    weekStart,
    items: ev.map<CalendarItem>((e) => {
      const m = e.note?.match(/\b(\d{1,2}(:\d{2})?\s?(am|pm|AM|PM))/);
      return { date: e.date, time: e.time || (m ? m[1] : null), title: e.title, kind: e.kind, location: e.location || undefined };
    }),
  };

  // To-dos pulled out of emails by the morning inbox job (POST /api/ingest/todos)
  const td = sql
    ? await sql<{ id: string; title: string; detail: string; due: string | null; sender: string; done: boolean; url: string | null }[]>`
        select id, title, detail, due, sender, done, url from todos
        where not done or done_at > now() - interval '1 day'
        order by done, due nulls last, created_at desc limit 40`.catch(() => [])
    : [];
  const todos: ProfessionalData["todos"] = { source: sql ? "live" : "sample", items: td.map((t) => ({ ...t })) };

  const parts = [jobs.ok, emails.source === "live", calendar.source === "live"];
  return {
    source: parts.every(Boolean) ? "live" : parts.some(Boolean) ? "partial" : "sample",
    updatedAt: now(),
    jobs,
    emails,
    calendar,
    todos,
  };
}

/* -------------------------------------------------------------------------- */
/* 🏋️  Fitness                                                                  */
/* -------------------------------------------------------------------------- */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export async function getFitnessData(today = todayISO()): Promise<FitnessData> {
  const data = await loadTraining();
  const sql = await db();
  const legacy = (await sql<{ date: string }[]>`select date from habit_logs where gym = true`).map((r) => r.date);
  const durations = new Map((await sql<{ id: number; duration_min: number | null }[]>`select id, duration_min from workouts`).map((r) => [r.id, r.duration_min]));
  const gymDays = new Set([...data.workouts.map((w) => w.date), ...legacy]);
  const runDays = new Set(data.runs.map((r) => r.date));
  const monday = mondayOf(today);

  let estimated = false;
  const minutesOn = (d: string) => {
    let m = 0;
    for (const w of data.workouts.filter((x) => x.date === d)) {
      const dur = durations.get(w.id);
      if (dur) m += dur;
      else {
        m += Math.round(w.sets.length * 2.5); // ~2.5 min per working set incl. rest
        estimated = true;
      }
    }
    for (const r of data.runs.filter((x) => x.date === d)) m += Math.round(r.duration_sec / 60);
    return m;
  };

  const week = DAYS.map((day, i) => {
    const date = addDays(monday, i);
    return { day, date, trained: gymDays.has(date), ran: runDays.has(date), minutes: minutesOn(date) };
  });
  const lastWeek = DAYS.map((_, i) => ({ trained: gymDays.has(addDays(monday, i - 7)) }));
  const target = data.settings.gymTarget;

  // consecutive full weeks (before this one) at or above target
  let streakWeeks = 0;
  for (let w = 1; w < 52; w++) {
    const m = addDays(monday, -7 * w);
    const n = DAYS.filter((_, i) => gymDays.has(addDays(m, i))).length;
    if (n >= target) streakWeeks++;
    else break;
  }
  if (week.filter((d) => d.trained).length >= target) streakWeeks++;

  const sorted = [...gymDays].sort();
  const last = sorted[sorted.length - 1];
  const from28 = addDays(today, -27);
  const kinds = new Map<string, number>();
  for (const w of data.workouts) if (w.date >= from28) kinds.set(w.kind, (kinds.get(w.kind) || 0) + 1);

  const lifts = exerciseSummaries(data)
    .filter((l) => !l.name.includes("unnamed"))
    .sort((a, b) => b.sessions.length - a.sessions.length)
    .slice(0, 4)
    .map((l) => ({
      name: l.name,
      top: `${l.bodyweight ? "BW" : fmtW(l.last.topWeight) + " " + data.settings.unit} × ${l.last.topReps.join("/")}`,
      change: l.bodyweight ? null : l.changePct,
      status: { ready: "Add weight", progressing: "Progressing", holding: "Building reps", stalled: "Stalled", new: "New" }[l.status],
    }));

  const any = data.workouts.length + data.runs.length > 0;
  return {
    source: any ? "live" : "sample",
    updatedAt: now(),
    week,
    lastWeek,
    sessionsThisWeek: week.filter((d) => d.trained).length,
    sessionTarget: target,
    activeMinutes: week.reduce((a, d) => a + d.minutes, 0),
    activeTarget: 150,
    minutesEstimated: estimated,
    streakWeeks,
    daysSinceLast: last ? daysBetween(last, today) : null,
    muscleSplit: setsPerMuscle(data, 4, today)
      .filter((m) => m.muscle !== "Other")
      .map((m) => ({ muscle: m.muscle, sets: m.perWeek })),
    sessionSplit: [...kinds.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    topLifts: lifts,
  };
}

/* -------------------------------------------------------------------------- */
/* 🍳  Nutrition                                                                */
/* -------------------------------------------------------------------------- */

export const DEFAULT_TARGETS = { kcal: 2700, protein: 170, carbs: 320, fat: 85 };

export async function getNutritionData(today = todayISO()): Promise<NutritionData> {
  const targets = { ...DEFAULT_TARGETS, ...(await getKV<Partial<typeof DEFAULT_TARGETS>>("nutrition_targets", {})) };
  const sql = await db();
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from meals`;
  if (n === 0) {
    const meals = sampleMeals(today);
    return {
      source: "sample",
      updatedAt: now(),
      date: today,
      meals,
      totals: sum(meals),
      targets,
      week: sampleKcalWeek(today),
    };
  }
  const all = await sql<{ id: number; date: string; time: string; name: string; kcal: number; protein: number; carbs: number; fat: number; source: string }[]>`
    select id, date, time, name, kcal, protein, carbs, fat, source from meals where date >= ${addDays(today, -6)} order by date, time, id`;
  // a day synced from MyFitnessPal is complete on its own, so skip hand-logged rows that day to avoid double counting
  const mfpDays = new Set(all.filter((r) => r.source === "mfp").map((r) => r.date));
  const rows = all.filter((r) => !mfpDays.has(r.date) || r.source === "mfp");
  const meals = rows.filter((r) => r.date === today);
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.date, (byDay.get(r.date) || 0) + r.kcal);
  return {
    source: "live",
    updatedAt: now(),
    date: today,
    meals: [...meals],
    totals: sum(meals),
    targets,
    week: lastNDays(7, today).map((d) => ({ date: d, kcal: byDay.get(d) || 0 })),
  };
}

function sum(meals: { kcal: number; protein: number; carbs: number; fat: number }[]) {
  return meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

/* -------------------------------------------------------------------------- */

const LOADERS = { sleep: getSleepData, professional: getProfessionalData, fitness: getFitnessData, nutrition: getNutritionData };
export async function getZoneData<K extends keyof typeof LOADERS>(key: K) {
  return (await LOADERS[key]()) as Awaited<ReturnType<(typeof LOADERS)[K]>>;
}

/** Everything for the first paint (the page passes it down, hooks then keep it fresh). */
export async function getPenthouseData(): Promise<PenthouseData> {
  const today = todayISO();
  const [sleep, professional, fitness, nutrition] = await Promise.all([
    getSleepData(today),
    getProfessionalData(today),
    getFitnessData(today),
    getNutritionData(today),
  ]);
  return { today, sleep, professional, fitness, nutrition };
}

export { fShort };
