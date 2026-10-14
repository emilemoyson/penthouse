import { db, getKV } from "./db";
import { DEFAULT_EXERCISES, MUSCLES, type Muscle } from "./exercises";

export type SetRow = {
  id: number;
  workout_id: number;
  exercise: string;
  ex_order: number;
  set_no: number;
  weight: number;
  unit: "lb" | "kg";
  reps: number;
  reps_alt: number | null;
};
export type Workout = {
  id: number;
  date: string;
  kind: string;
  notes: string;
  date_estimated: boolean;
  sets: SetRow[];
};
export type Run = {
  id: number;
  date: string;
  distance_km: number;
  duration_sec: number;
  kind: string;
  avg_hr: number | null;
  notes: string;
  source: string;
};
export type ExerciseInfo = { name: string; muscle: Muscle; kind: "compound" | "isolation" };
export type TrainingSettings = { unit: "lb" | "kg"; gymTarget: number; runTarget: number };

export const DEFAULT_SETTINGS: TrainingSettings = { unit: "lb", gymTarget: 3, runTarget: 2 };

export async function loadTraining() {
  const sql = await db();
  const [workouts, sets, exercises, runs, settings] = await Promise.all([
    sql<Omit<Workout, "sets">[]>`select id, date, kind, notes, date_estimated from workouts order by date desc, id desc`,
    sql<SetRow[]>`select id, workout_id, exercise, ex_order, set_no, weight, unit, reps, reps_alt from sets order by workout_id, ex_order, set_no`,
    sql<ExerciseInfo[]>`select name, muscle, kind from exercises order by name`,
    sql<Run[]>`select id, date, distance_km, duration_sec, kind, avg_hr, notes, source from runs order by date desc, id desc`,
    getKV<TrainingSettings>("training_settings", DEFAULT_SETTINGS),
  ]);
  const byW = new Map<number, SetRow[]>();
  for (const s of sets) {
    if (!byW.has(s.workout_id)) byW.set(s.workout_id, []);
    byW.get(s.workout_id)!.push(s);
  }
  const full: Workout[] = workouts.map((w) => ({ ...w, sets: byW.get(w.id) || [] }));
  const exMap = new Map<string, ExerciseInfo>();
  for (const e of DEFAULT_EXERCISES) exMap.set(e.name, e);
  for (const e of exercises) exMap.set(e.name, { ...e, muscle: (MUSCLES as readonly string[]).includes(e.muscle) ? e.muscle : "Other" });
  return { workouts: full, runs: [...runs], exercises: exMap, settings: { ...DEFAULT_SETTINGS, ...settings } };
}

export type TrainingData = Awaited<ReturnType<typeof loadTraining>>;

/* ---------- unit helpers ---------- */
export const KG_PER_LB = 0.45359237;
export function convert(w: number, from: "lb" | "kg", to: "lb" | "kg") {
  if (from === to) return w;
  return from === "kg" ? w / KG_PER_LB : w * KG_PER_LB;
}
export function fmtW(w: number) {
  const r = Math.round(w * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function paceStr(secPerKm: number) {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "–";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}
export function durStr(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
