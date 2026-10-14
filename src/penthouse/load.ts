import { db } from "@/lib/db";
import { loadTraining, fmtW } from "@/lib/training";
import { coachNotes, exerciseSummaries, weeklySessions, runStats, type ExStatus } from "@/lib/coach";
import { loadJobs, jobAnalytics } from "@/lib/jobs";
import { addDays, daysBetween, mondayOf, todayISO } from "@/lib/dates";
import type { PenthouseData } from "./types";

const STATUS: Record<ExStatus, { label: string; tone: "good" | "accent" | "warn" | "neutral" }> = {
  ready: { label: "Add weight", tone: "good" },
  progressing: { label: "Progressing", tone: "accent" },
  holding: { label: "Building reps", tone: "neutral" },
  stalled: { label: "Stalled", tone: "warn" },
  new: { label: "New", tone: "neutral" },
};

async function training(today: string): Promise<PenthouseData["training"]> {
  const data = await loadTraining();
  const sql = await db();
  const extra = (await sql<{ date: string }[]>`select date from habit_logs where gym = true`).map((r) => r.date);
  const weeks = weeklySessions(data, 12, today, extra);
  const days = new Set([...data.workouts.map((w) => w.date), ...extra]);
  const sorted = [...days].sort();
  const last = sorted[sorted.length - 1] || null;
  const from = addDays(today, -27);
  const sets28 = data.workouts.filter((w) => w.date >= from && w.date <= today).reduce((a, w) => a + w.sets.length, 0);
  const start = addDays(mondayOf(today), -7 * 7);
  const heat = Array.from({ length: 8 }, (_, wk) => Array.from({ length: 7 }, (_, d) => {
    const date = addDays(start, wk * 7 + d);
    return { date, on: days.has(date) };
  }));
  const lifts = exerciseSummaries(data)
    .filter((l) => !l.name.includes("unnamed"))
    .slice(0, 6)
    .map((l) => ({
      name: l.name,
      status: STATUS[l.status].label,
      tone: STATUS[l.status].tone,
      top: `${l.bodyweight ? "BW" : fmtW(l.last.topWeight) + " " + data.settings.unit} × ${l.last.topReps.join(", ")}`,
      change: l.bodyweight ? null : l.changePct,
      advice: l.advice,
    }));
  return {
    gymThisWeek: weeks[weeks.length - 1].gym,
    gymTarget: data.settings.gymTarget,
    sinceLast: last ? daysBetween(last, today) : null,
    lastDate: last,
    sets28,
    runKmWeek: runStats(data, today).kmThisWeek,
    weeks: weeks.map((w) => ({ label: w.label, gym: w.gym })),
    weeksHit: weeks.filter((w) => w.gym >= data.settings.gymTarget).length,
    heat,
    lifts,
    notes: coachNotes(data, today, extra).map((n) => ({ tone: n.tone, title: n.title })),
  };
}

async function jobs(today: string): Promise<PenthouseData["jobs"]> {
  const res = await loadJobs();
  if (!res.ok) return { ok: false, message: res.reason === "not_configured" ? "Connect the Job Search sheet to see jobs here." : res.message || "Couldn't load the sheet." };
  const a = jobAnalytics(res.jobs, res.contacts, res.settings, today);
  const order = ["To apply", "Interview", "Final round", "To do assessment", "Assessment complete", "Applied", "Offer", "Ghosted", "Rejected", "Withdrawn", "Closed"];
  const rows = [...res.jobs]
    .sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status) || (y.dateApplied || "").localeCompare(x.dateApplied || ""))
    .map((j) => ({ id: j.id, company: j.company, role: j.role, status: j.status, bucket: j.bucket, applied: j.dateApplied, deadline: j.deadline, link: j.link }));
  return { ok: true, rows, appsThisWeek: a.appsThisWeek, appTarget: res.settings.appTarget, active: a.active, toApply: a.toApply.length, responseRate: a.responseRate };
}

export async function loadPenthouse(): Promise<PenthouseData> {
  const today = todayISO();
  const [t, j, events] = await Promise.all([
    training(today).catch(() => null),
    jobs(today).catch(() => ({ ok: false as const, message: "Couldn't load the sheet." })),
    db()
      .then((sql) => sql<{ date: string; title: string; kind: string }[]>`select date, title, kind from events where date >= ${addDays(today, -40)} order by date`)
      .then((r) => [...r])
      .catch(() => []),
  ]);
  return { today, training: t, jobs: j, events };
}
