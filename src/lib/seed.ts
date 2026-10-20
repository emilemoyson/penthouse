/* eslint-disable @typescript-eslint/no-explicit-any */
import { DEFAULT_EXERCISES } from "./exercises";

/**
 * Starter data imported once on first run:
 *  - Workouts transcribed from Emile's gym notes (Push / Pull). The notes have no dates,
 *    so each line is treated as one session in order and given an estimated date
 *    (flagged in the UI so it can be corrected).
 *  - Daily logs and progress from the old Ledger page. (Its events moved to Google Calendar.)
 */

type SeedSet = { w: number; reps: number; alt?: number };
type SeedEx = { exercise: string; sets: SeedSet[] };
type SeedWorkout = { date: string; kind: string; notes: string; ex: SeedEx[] };

// "45 x 9 x 9 x 7" -> three sets at 45
const s = (w: number, ...reps: number[]): SeedSet[] => reps.map((r) => ({ w, reps: r }));
// per-side reps such as "12 (11)"
const ss = (w: number, ...pairs: [number, number][]): SeedSet[] => pairs.map(([r, a]) => ({ w, reps: r, alt: a }));

const IMPORTED = "Imported from your notes. Date is an estimate, edit it if you remember the real one.";

export const SEED_WORKOUTS: SeedWorkout[] = [
  {
    date: "2026-09-14",
    kind: "push",
    notes: IMPORTED,
    ex: [
      { exercise: "Flat DB press", sets: s(45, 9, 9, 7) },
      { exercise: "Incline DB press", sets: s(40, 8, 8, 6) },
      { exercise: "Shoulder press", sets: s(40, 9, 8, 7) },
      { exercise: "Tricep pushdown", sets: s(37.5, 11, 12, 11) },
    ],
  },
  {
    date: "2026-09-16",
    kind: "pull",
    notes: IMPORTED + " Pull-up competition vs Adrian (lost).",
    ex: [
      { exercise: "Pull-up", sets: s(0, 9, 9, 9) },
      { exercise: "Close-grip lat pulldown", sets: s(85, 10, 11, 11) },
      { exercise: "Seated row (machine)", sets: s(75, 11, 11, 12) },
      { exercise: "Face pull", sets: s(37.5, 12, 12, 12) },
      { exercise: "Tricep rope pushdown", sets: [{ w: 27.5, reps: 12 }, { w: 32.5, reps: 12 }, { w: 32.5, reps: 12 }] },
      { exercise: "Dumbbell (unnamed)", sets: s(25, 10, 10) },
    ],
  },
  {
    date: "2026-09-21",
    kind: "push",
    notes: IMPORTED,
    ex: [
      { exercise: "Flat DB press", sets: s(45, 9, 8, 8) },
      { exercise: "Incline DB press", sets: s(40, 8, 9, 6) },
      { exercise: "Shoulder press", sets: s(40, 9, 8) },
      { exercise: "Cable lateral raise", sets: ss(12.5, [12, 11], [14, 14]) },
      { exercise: "Pec fly (machine)", sets: s(85, 10, 8) },
      { exercise: "Tricep pushdown", sets: s(37.5, 11, 10, 7) },
    ],
  },
  {
    date: "2026-09-24",
    kind: "pull",
    notes: IMPORTED,
    ex: [
      { exercise: "Pull-up", sets: s(0, 10, 10, 8) },
      { exercise: "Close-grip lat pulldown", sets: s(85, 11, 11, 11) },
      { exercise: "Seated row (machine)", sets: [{ w: 75, reps: 10 }, { w: 85, reps: 12 }, { w: 85, reps: 12 }] },
      { exercise: "Face pull", sets: s(42.5, 12, 12, 12) },
      { exercise: "Dumbbell (unnamed)", sets: s(25, 11, 10) },
    ],
  },
  {
    date: "2026-09-28",
    kind: "push",
    notes: IMPORTED,
    ex: [
      { exercise: "Flat DB press", sets: s(50, 9, 8, 7) },
      { exercise: "Incline DB press", sets: s(45, 7, 8) },
      { exercise: "Shoulder press", sets: s(40, 9, 9, 8) },
      { exercise: "Cable lateral raise", sets: ss(12.5, [12, 12], [12, 12]) },
    ],
  },
  {
    date: "2026-10-01",
    kind: "pull",
    notes: IMPORTED,
    ex: [
      { exercise: "Close-grip lat pulldown", sets: s(100, 11, 10, 10) },
      { exercise: "Face pull", sets: s(42.5, 12, 12, 12) },
      { exercise: "Dumbbell (unnamed)", sets: ss(15, [10, 10], [12, 12]) },
    ],
  },
  {
    date: "2026-10-05",
    kind: "push",
    notes: IMPORTED + " Ideas to add: chest press, pec fly, cable chest fly.",
    ex: [
      { exercise: "Flat DB press", sets: s(50, 8, 8, 8) },
      { exercise: "Incline DB press", sets: s(45, 7, 7, 7) },
      { exercise: "Shoulder press", sets: s(40, 10, 10, 7) },
      { exercise: "Cable lateral raise", sets: ss(12.5, [14, 14], [14, 14]) },
    ],
  },
];

const LEDGER_LOGS = [
  { date: "2026-09-14", gym: true, zetamac: 8 },
  { date: "2026-09-15", zetamac: 10 },
  { date: "2026-09-16", gym: true, zetamac: 11 },
  { date: "2026-09-17", gym: true, zetamac: 15 },
  { date: "2026-09-21", gym: true, read: 15, zetamac: 12 },
  { date: "2026-09-22", read: 0, zetamac: 17 },
  { date: "2026-09-23", read: 20, zetamac: 20 },
  { date: "2026-09-24", gym: true },
];

export async function seedDatabase(sql: any) {
  // Exercise library
  for (const e of DEFAULT_EXERCISES) {
    await sql`insert into exercises (name, muscle, kind) values (${e.name}, ${e.muscle}, ${e.kind}) on conflict (name) do nothing`;
  }

  const [{ n }] = await sql`select count(*)::int as n from workouts`;
  if (n === 0) {
    for (const w of SEED_WORKOUTS) {
      const [row] = await sql`insert into workouts (date, kind, notes, date_estimated) values (${w.date}, ${w.kind}, ${w.notes}, true) returning id`;
      let order = 0;
      for (const ex of w.ex) {
        let setNo = 1;
        for (const st of ex.sets) {
          await sql`insert into sets (workout_id, exercise, ex_order, set_no, weight, unit, reps, reps_alt)
                    values (${row.id}, ${ex.exercise}, ${order}, ${setNo}, ${st.w}, 'lb', ${st.reps}, ${st.alt ?? null})`;
          setNo++;
        }
        order++;
      }
    }
  }

  for (const l of LEDGER_LOGS) {
    const r = l as { date: string; gym?: boolean; zetamac?: number; read?: number };
    await sql`insert into habit_logs (date, read_min, zetamac, gym, run, note)
              values (${r.date}, ${r.read ?? null}, ${r.zetamac ?? null}, ${!!r.gym}, false, '')
              on conflict (date) do nothing`;
  }
}
