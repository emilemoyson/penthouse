import { addDays, daysBetween, fShort, lastNWeeks, mondayOf, todayISO } from "./dates";
import { MUSCLES, WEEKLY_SET_RANGE, type Muscle } from "./exercises";
import { convert, fmtW, paceStr, type TrainingData, type Workout } from "./training";

/* ------------------------------------------------------------------ */
/* Per-exercise history                                                */
/* ------------------------------------------------------------------ */

export type ExSession = {
  date: string;
  workoutId: number;
  estimated: boolean;
  sets: { weight: number; reps: number; alt: number | null }[]; // weight in display unit
  topWeight: number;
  topReps: number[]; // reps of sets done at topWeight
  best: number; // best estimated 1RM (or best reps for bodyweight)
  volume: number; // sum weight × reps
};

export type ExStatus = "ready" | "progressing" | "holding" | "stalled" | "new";

export type ExSummary = {
  name: string;
  muscle: Muscle;
  kind: "compound" | "isolation";
  bodyweight: boolean;
  sessions: ExSession[];
  first: ExSession;
  last: ExSession;
  changePct: number | null;
  status: ExStatus;
  advice: string;
  nextWeight: number | null;
};

/** Epley estimate of a one-rep max. Only meaningful for weighted sets. */
export const e1rm = (w: number, reps: number) => (w > 0 ? w * (1 + reps / 30) : 0);

function increment(w: number, unit: "lb" | "kg") {
  if (unit === "kg") return w < 10 ? 1 : 2.5;
  return w < 20 ? 2.5 : 5;
}

export function exerciseSummaries(data: TrainingData): ExSummary[] {
  const unit = data.settings.unit;
  const byEx = new Map<string, ExSession[]>();
  const chrono = [...data.workouts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  for (const w of chrono) {
    const groups = new Map<string, Workout["sets"]>();
    for (const s of w.sets) {
      if (!groups.has(s.exercise)) groups.set(s.exercise, []);
      groups.get(s.exercise)!.push(s);
    }
    for (const [name, sets] of groups) {
      const conv = sets.map((s) => ({ weight: convert(s.weight, s.unit, unit), reps: s.reps, alt: s.reps_alt }));
      const topWeight = Math.max(...conv.map((s) => s.weight));
      const bw = topWeight === 0;
      const best = bw ? Math.max(...conv.map((s) => s.reps)) : Math.max(...conv.map((s) => e1rm(s.weight, s.reps)));
      const sess: ExSession = {
        date: w.date,
        workoutId: w.id,
        estimated: w.date_estimated,
        sets: conv,
        topWeight,
        topReps: conv.filter((s) => s.weight === topWeight).map((s) => s.reps),
        best,
        volume: conv.reduce((a, s) => a + s.weight * s.reps, 0),
      };
      if (!byEx.has(name)) byEx.set(name, []);
      byEx.get(name)!.push(sess);
    }
  }

  const out: ExSummary[] = [];
  for (const [name, sessions] of byEx) {
    const info = data.exercises.get(name) || { name, muscle: "Other" as Muscle, kind: "compound" as const };
    const first = sessions[0];
    const last = sessions[sessions.length - 1];
    const bodyweight = sessions.every((s) => s.topWeight === 0);
    const repTop = bodyweight ? 12 : info.kind === "compound" ? 10 : 12;
    const changePct = sessions.length > 1 && first.best > 0 ? ((last.best - first.best) / first.best) * 100 : null;

    let status: ExStatus = "holding";
    let advice = "";
    let nextWeight: number | null = null;
    const minTop = Math.min(...last.topReps);
    const prevBest = sessions.slice(0, -1).reduce((m, s) => Math.max(m, s.best), 0);

    if (sessions.length === 1) {
      status = "new";
      advice = "One session logged. Beat these numbers next time.";
    }
    if (minTop >= repTop && last.topReps.length >= 2) {
      status = "ready";
      if (bodyweight) advice = `${last.topReps.join(", ")} reps. Add a little weight (belt or dumbbell) or slow the lowering.`;
      else {
        nextWeight = last.topWeight + increment(last.topWeight, unit);
        advice = `Hit ${repTop}+ on every set at ${fmtW(last.topWeight)} ${unit}. Go to ${fmtW(nextWeight)} ${unit} next time.`;
      }
    } else if (sessions.length > 1) {
      const recent = sessions.slice(-3);
      const lastThreeNoPR = sessions.length >= 3 && recent.every((s) => s.best <= Math.max(...sessions.slice(0, -3).map((x) => x.best), 0) + 1e-9);
      if (last.best > prevBest * 1.005) {
        status = "progressing";
        advice = bodyweight
          ? `New best: ${Math.max(...last.topReps)} reps.`
          : `New best estimated 1RM (${fmtW(last.best)} ${unit}). Keep the weight, add reps until every set hits ${repTop}.`;
      } else if (lastThreeNoPR) {
        status = "stalled";
        advice = `No new best in your last 3 sessions. Try a lighter week, or drop to ${fmtW(Math.max(0, last.topWeight - increment(last.topWeight, unit)))} ${unit} and rebuild reps.`;
      } else {
        status = "holding";
        advice = bodyweight
          ? `Aim for ${repTop} reps on every set.`
          : `Stay at ${fmtW(last.topWeight)} ${unit} and push every set to ${repTop} reps (last: ${last.topReps.join(", ")}).`;
      }
    }

    out.push({ name, muscle: info.muscle, kind: info.kind, bodyweight, sessions, first, last, changePct, status, advice, nextWeight });
  }
  const order: Record<ExStatus, number> = { ready: 0, progressing: 1, stalled: 2, holding: 3, new: 4 };
  return out.sort((a, b) => order[a.status] - order[b.status] || (b.last.date > a.last.date ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Frequency & volume                                                  */
/* ------------------------------------------------------------------ */

export function trainingDays(data: TrainingData, extraGymDays: string[] = []) {
  return new Set([...data.workouts.map((w) => w.date), ...extraGymDays]);
}

export function weeklySessions(data: TrainingData, weeks = 12, today = todayISO(), extraGymDays: string[] = []) {
  const days = trainingDays(data, extraGymDays);
  const runDays = new Set(data.runs.map((r) => r.date));
  return lastNWeeks(weeks, today).map((monday) => {
    let gym = 0;
    let run = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      if (days.has(d)) gym++;
      if (runDays.has(d)) run++;
    }
    const km = data.runs.filter((r) => mondayOf(r.date) === monday).reduce((a, r) => a + r.distance_km, 0);
    return { week: monday, label: fShort(monday), gym, run, km: Math.round(km * 10) / 10 };
  });
}

/** Hard sets per muscle group per week, averaged over the last `weeks` weeks (including this one). */
export function setsPerMuscle(data: TrainingData, weeks = 4, today = todayISO()) {
  const from = addDays(mondayOf(today), -7 * (weeks - 1));
  const counts = new Map<Muscle, number>(MUSCLES.map((m) => [m, 0]));
  for (const w of data.workouts) {
    if (w.date < from || w.date > today) continue;
    for (const s of w.sets) {
      const m = data.exercises.get(s.exercise)?.muscle || "Other";
      counts.set(m, (counts.get(m) || 0) + 1);
    }
  }
  return MUSCLES.filter((m) => m !== "Other" || (counts.get(m) || 0) > 0).map((m) => ({
    muscle: m,
    perWeek: Math.round(((counts.get(m) || 0) / weeks) * 10) / 10,
    total: counts.get(m) || 0,
  }));
}

/* ------------------------------------------------------------------ */
/* Running                                                             */
/* ------------------------------------------------------------------ */

export function runStats(data: TrainingData, today = todayISO()) {
  const runs = [...data.runs].sort((a, b) => (a.date < b.date ? -1 : 1));
  const thisMonday = mondayOf(today);
  const kmThisWeek = runs.filter((r) => r.date >= thisMonday && r.date <= today).reduce((a, r) => a + r.distance_km, 0);
  const prev4 = [1, 2, 3, 4].map((i) => {
    const m = addDays(thisMonday, -7 * i);
    return runs.filter((r) => mondayOf(r.date) === m).reduce((a, r) => a + r.distance_km, 0);
  });
  const avg4 = prev4.reduce((a, b) => a + b, 0) / 4;
  const lastWeekKm = prev4[0];
  const longest = runs.reduce((m, r) => Math.max(m, r.distance_km), 0);
  const pacePts = runs.map((r) => ({ date: r.date, pace: r.duration_sec / r.distance_km, km: r.distance_km, kind: r.kind }));
  const totalKm = runs.reduce((a, r) => a + r.distance_km, 0);
  const last4w = runs.filter((r) => daysBetween(r.date, today) < 28);
  const avgPace4w = last4w.length ? last4w.reduce((a, r) => a + r.duration_sec, 0) / last4w.reduce((a, r) => a + r.distance_km, 0) : null;
  return { runs, kmThisWeek, lastWeekKm, avg4, longest, pacePts, totalKm, avgPace4w, count: runs.length };
}

/* ------------------------------------------------------------------ */
/* Coach's notes                                                       */
/* ------------------------------------------------------------------ */

export type Insight = { tone: "good" | "warn" | "bad" | "info"; title: string; body: string };

export function coachNotes(data: TrainingData, today = todayISO(), extraGymDays: string[] = []): Insight[] {
  const notes: Insight[] = [];
  const unit = data.settings.unit;
  const ex = exerciseSummaries(data);
  const days = [...trainingDays(data, extraGymDays)].sort();
  const lastDay = days[days.length - 1];
  const thisWeek = weeklySessions(data, 1, today, extraGymDays)[0];
  const target = data.settings.gymTarget;

  // 1. Consistency
  if (!lastDay) {
    notes.push({ tone: "info", title: "Log your first session", body: "Once a few workouts are in, this page turns them into progress and volume insights." });
  } else {
    const gap = daysBetween(lastDay, today);
    const dow = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7; // 0 = Mon
    const daysLeft = 7 - dow;
    const need = Math.max(0, target - thisWeek.gym);
    if (gap >= 5) {
      notes.push({
        tone: "bad",
        title: `${gap} days since your last session`,
        body: `Last workout was ${fShort(lastDay)}. Strength holds fine over a short break, but the habit doesn't. Get one in today or tomorrow.${need ? ` ${need} more this week hits your target of ${target}.` : ""}`,
      });
    } else if (need === 0) {
      notes.push({ tone: "good", title: `Weekly target hit: ${thisWeek.gym} sessions`, body: "Anything extra this week is a bonus. Make sure one of the remaining days is properly easy." });
    } else if (need > daysLeft) {
      notes.push({ tone: "warn", title: `${thisWeek.gym} of ${target} sessions this week`, body: `Only ${daysLeft} day${daysLeft === 1 ? "" : "s"} left in the week, so the target is out of reach. Get as many in as you can and reset Monday.` });
    } else {
      notes.push({ tone: "info", title: `${thisWeek.gym} of ${target} sessions this week`, body: `${need} more to go with ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.` });
    }
  }

  // 2. Missing muscle groups (legs)
  const vol = setsPerMuscle(data, 4, today);
  const legSets = vol.filter((v) => ["Quads", "Hamstrings", "Glutes"].includes(v.muscle)).reduce((a, v) => a + v.total, 0);
  const anySets = vol.reduce((a, v) => a + v.total, 0);
  if (anySets > 0 && legSets === 0) {
    notes.push({
      tone: "bad",
      title: "No leg training in the last 4 weeks",
      body: "Your split is push and pull only. Add a leg day (squat or leg press, Romanian deadlift, leg curl, calf raise). Football and running don't replace it for strength.",
    });
  }

  // 3. Ready to go up
  const ready = ex.filter((e) => e.status === "ready" && e.nextWeight != null && daysBetween(e.last.date, today) <= 28).slice(0, 3);
  if (ready.length) {
    notes.push({
      tone: "good",
      title: ready.length === 1 ? `Time to go heavier on ${ready[0].name}` : `${ready.length} lifts are ready for more weight`,
      body: ready.map((e) => `${e.name}: ${fmtW(e.last.topWeight)} → ${fmtW(e.nextWeight!)} ${unit}`).join(" · "),
    });
  }

  // 4. Biggest win
  const wins = ex.filter((e) => e.changePct != null && e.changePct > 0 && !e.bodyweight).sort((a, b) => b.changePct! - a.changePct!);
  if (wins.length) {
    const w = wins[0];
    notes.push({
      tone: "good",
      title: `${w.name} is up ${Math.round(w.changePct!)}%`,
      body: `Estimated 1-rep max went from ${fmtW(w.first.best)} to ${fmtW(w.last.best)} ${unit} since ${fShort(w.first.date)} (top set ${fmtW(w.first.topWeight)} → ${fmtW(w.last.topWeight)} ${unit}).`,
    });
  }

  // 5. Rep drop-off within a session
  const dropoffs = ex
    .filter((e) => daysBetween(e.last.date, today) <= 28 && e.kind === "compound" && !e.bodyweight)
    .map((e) => {
      const r = e.last.topReps;
      return { e, first: r[0], lastR: r[r.length - 1], drop: r.length >= 3 && r[0] > 0 ? (r[0] - r[r.length - 1]) / r[0] : 0 };
    })
    .filter((x) => x.drop >= 0.25)
    .sort((a, b) => b.drop - a.drop);
  if (dropoffs.length) {
    const d = dropoffs[0];
    notes.push({
      tone: "warn",
      title: `Big drop-off on your last set of ${d.e.name}`,
      body: `Reps fell from ${d.first} to ${d.lastR} at the same weight. Rest 2–3 minutes between sets on compound lifts so the last set still counts.`,
    });
  }

  // 6. Stalled lifts
  const stalled = ex.filter((e) => e.status === "stalled" && daysBetween(e.last.date, today) <= 28);
  if (stalled.length) {
    notes.push({ tone: "warn", title: `${stalled[0].name} has stalled`, body: stalled[0].advice });
  }

  // 7. Volume under range
  const [lo] = WEEKLY_SET_RANGE;
  const trained = vol.filter((v) => v.total > 0 && v.muscle !== "Other");
  const low = trained.filter((v) => v.perWeek < lo).sort((a, b) => a.perWeek - b.perWeek);
  if (low.length) {
    notes.push({
      tone: "info",
      title: "Some muscles are under 10 sets a week",
      body: `${low.map((v) => `${v.muscle} ${v.perWeek}`).join(", ")} sets/week (4-week average). Around 10–20 hard sets per muscle per week is where most growth research lands.`,
    });
  }

  // 8. Running
  const rs = runStats(data, today);
  if (rs.count === 0) {
    notes.push({ tone: "info", title: "No runs logged yet", body: `Your target is ${data.settings.runTarget} runs a week. Log one and weekly km and pace trends show up below.` });
  } else if (rs.avg4 > 0 && rs.kmThisWeek > rs.avg4 * 1.3 && rs.kmThisWeek - rs.avg4 > 3) {
    notes.push({
      tone: "warn",
      title: "Running volume jumped this week",
      body: `${rs.kmThisWeek.toFixed(1)} km vs a ${rs.avg4.toFixed(1)} km weekly average. Big jumps are the most common route to running injuries; keep the next runs easy.`,
    });
  } else if (rs.avgPace4w) {
    notes.push({ tone: "info", title: `Average pace ${paceStr(rs.avgPace4w)} /km`, body: `Across your runs in the last 4 weeks. Keep most runs at an easy, conversational pace and make one a week faster.` });
  }

  return notes.slice(0, 6);
}
