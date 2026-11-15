import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { MUSCLES } from "@/lib/exercises";

/**
 * What the room agents can change. The agent only proposes: each tool call becomes a card in the chat,
 * and nothing is written until the user presses Save, which posts the same input to /api/room/:zone/apply.
 * Both sides validate with the schemas below, so a card can't save something the agent couldn't propose.
 */

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD");
const HM = z.string().regex(/^\d{2}:\d{2}$/).describe("24h HH:MM");

const Exercise = z.object({
  name: z.string().trim().min(1).max(80).describe("Use the name already in the user's log when it's the same exercise."),
  muscle: z.enum(MUSCLES).optional().describe("Only for an exercise not in the log yet."),
  sets: z.array(z.object({ weight: z.number().min(0).max(2000), reps: z.number().int().min(1).max(200) })).min(1).max(20),
});
const Workout = z.object({
  date: Day,
  kind: z.enum(["push", "pull", "legs", "upper", "lower", "full", "other"]),
  durationMin: z.number().int().min(1).max(600).optional(),
  unit: z.enum(["lb", "kg"]).describe("Weight unit for every set. the user usually uses lb."),
  notes: z.string().max(2000).optional(),
  exercises: z.array(Exercise).min(1).max(20),
});

export const ACTIONS = {
  log_meal: {
    zone: "kitchen",
    describe: "Propose logging a meal or snack, on any day. Estimate macros if the user didn't give them (restaurant items: use the chain's published numbers when you know them).",
    schema: z.object({
      date: Day,
      time: HM.optional(),
      name: z.string().trim().min(1).max(200),
      kcal: z.number().int().min(0).max(10000),
      protein: z.number().min(0).max(1000),
      carbs: z.number().min(0).max(2000),
      fat: z.number().min(0).max(1000),
      kind: z.enum(["home", "out"]).describe("out = bought ready to eat (restaurant, takeout)."),
      cost: z.number().min(0).max(10000).optional().describe("Dollars, only if the user said what they paid."),
    }),
  },
  delete_meal: {
    zone: "kitchen",
    describe: "Propose removing a logged meal (by its id from the recent meals list).",
    schema: z.object({ id: z.number().int().positive() }),
  },
  add_todo: {
    zone: "desk",
    describe: "Propose adding a to-do.",
    schema: z.object({ title: z.string().trim().min(1).max(200), due: Day.optional() }),
  },
  update_todo: {
    zone: "desk",
    describe: "Propose changing a to-do: tick it off or reopen it, rename it, or set or clear its due date. Only include what changes.",
    schema: z.object({
      id: z.string().min(1).max(300),
      title: z.string().trim().min(1).max(200).optional(),
      due: Day.nullable().optional().describe("null clears the due date."),
      done: z.boolean().optional(),
    }),
  },
  log_workout: {
    zone: "gym",
    describe: "Propose logging a lifting session.",
    schema: Workout,
  },
  edit_workout: {
    zone: "gym",
    describe: "Propose changing a logged session (by id from the recent sessions list). Send the whole session as it should end up, every exercise and set, not just the change.",
    schema: Workout.extend({ id: z.number().int().positive() }),
  },
  delete_workout: {
    zone: "gym",
    describe: "Propose removing a logged session.",
    schema: z.object({ id: z.number().int().positive() }),
  },
  log_run: {
    zone: "gym",
    describe: "Propose logging a run.",
    schema: z.object({
      date: Day,
      distanceKm: z.number().positive().max(300).describe("Kilometres. 1 mile = 1.609 km."),
      durationMin: z.number().positive().max(1440),
      kind: z.enum(["easy", "long", "tempo", "intervals", "race"]),
      avgHr: z.number().int().min(30).max(240).optional(),
      notes: z.string().max(1000).optional(),
    }),
  },
  log_sleep: {
    zone: "bed",
    describe: "Propose logging or correcting a night of sleep. date is the morning the user woke up. Replaces what's stored for that night.",
    schema: z.object({
      date: Day,
      totalMin: z.number().int().min(0).max(1440).describe("Minutes asleep."),
      bedtime: HM.optional(),
      waketime: HM.optional(),
      recovery: z.number().int().min(0).max(100).optional(),
    }),
  },
} as const;

export type ActionName = keyof typeof ACTIONS;
export type RoomZone = "bed" | "desk" | "gym" | "kitchen";
export type ActionCard = { id: string; tool: ActionName; input: unknown; title: string; lines: string[] };

export const isAction = (n: string): n is ActionName => n in ACTIONS;

export function toolsFor(zone: RoomZone): Anthropic.Beta.BetaTool[] {
  return (Object.keys(ACTIONS) as ActionName[])
    .filter((n) => ACTIONS[n].zone === zone)
    .map((n) => {
      const { $schema: _, ...schema } = z.toJSONSchema(ACTIONS[n].schema, { io: "input" }) as Record<string, unknown>;
      return { name: n, description: `${ACTIONS[n].describe} Does not save: the user sees a card and presses Save.`, input_schema: schema as Anthropic.Beta.BetaTool["input_schema"] };
    });
}

type Parsed<N extends ActionName> = z.output<(typeof ACTIONS)[N]["schema"]>;

/** Validates a proposal for this room and words its card. Throws a plain message the agent can act on. */
export async function check(zone: RoomZone, tool: string, input: unknown): Promise<{ title: string; lines: string[]; input: unknown }> {
  if (!isAction(tool) || ACTIONS[tool].zone !== zone) throw new Error(`This room can't ${tool}.`);
  const p = ACTIONS[tool].schema.safeParse(input);
  if (!p.success) throw new Error(`Invalid input: ${p.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  const v = p.data;
  const sql = await db();
  const r0 = Math.round;

  switch (tool) {
    case "log_meal": {
      const m = v as Parsed<"log_meal">;
      return { input: m, title: `Log ${m.name}`, lines: [`${when(m.date)}${m.time ? `, ${m.time}` : ""}${m.kind === "out" ? ", eaten out" : ""}`, `${m.kcal} kcal · P ${r0(m.protein)} g · C ${r0(m.carbs)} g · F ${r0(m.fat)} g${m.cost != null ? ` · $${m.cost.toFixed(2)}` : ""}`] };
    }
    case "delete_meal": {
      const { id } = v as Parsed<"delete_meal">;
      const [m] = await sql<{ name: string; date: string; kcal: number; cook_id: number | null }[]>`select name, date, kcal, cook_id from meals where id = ${id}`;
      if (!m) throw new Error(`No meal with id ${id}.`);
      if (m.cook_id) throw new Error("This meal was cooked from the fridge. Removing it puts the ingredients back, so it has to be done on the kitchen page.");
      return { input: v, title: `Remove ${m.name}`, lines: [`${when(m.date)}, ${m.kcal} kcal`] };
    }
    case "add_todo": {
      const t = v as Parsed<"add_todo">;
      return { input: t, title: `Add to-do`, lines: [t.title, t.due ? `Due ${when(t.due)}` : "No due date"] };
    }
    case "update_todo": {
      const t = v as Parsed<"update_todo">;
      const [row] = await sql<{ title: string }[]>`select title from todos where id = ${t.id}`;
      if (!row) throw new Error(`No to-do with id ${t.id}.`);
      const lines = [row.title];
      if (t.done != null) lines.push(t.done ? "Mark as done" : "Reopen");
      if (t.title) lines.push(`Rename to: ${t.title}`);
      if (t.due !== undefined) lines.push(t.due ? `Due ${when(t.due)}` : "Clear the due date");
      if (lines.length === 1) throw new Error("Nothing to change.");
      return { input: t, title: t.done ? "Tick off to-do" : "Change to-do", lines };
    }
    case "log_workout":
    case "edit_workout": {
      const w = v as Parsed<"edit_workout">;
      if (tool === "edit_workout") {
        const [row] = await sql`select id from workouts where id = ${w.id}`;
        if (!row) throw new Error(`No session with id ${w.id}.`);
      }
      const sets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
      return {
        input: w,
        title: `${tool === "edit_workout" ? "Update" : "Log"} ${w.kind} session`,
        lines: [
          `${when(w.date)}${w.durationMin ? `, ${w.durationMin} min` : ""}, ${sets} sets`,
          ...w.exercises.map((e) => `${e.name}: ${e.sets.map((s) => `${s.weight}×${s.reps}`).join(", ")} ${w.unit}`),
        ],
      };
    }
    case "delete_workout": {
      const { id } = v as Parsed<"delete_workout">;
      const [row] = await sql<{ date: string; kind: string }[]>`select date, kind from workouts where id = ${id}`;
      if (!row) throw new Error(`No session with id ${id}.`);
      return { input: v, title: `Remove ${row.kind} session`, lines: [when(row.date)] };
    }
    case "log_run": {
      const r = v as Parsed<"log_run">;
      const pace = r.durationMin / r.distanceKm;
      return { input: r, title: `Log ${r.kind} run`, lines: [when(r.date), `${r.distanceKm} km in ${r0(r.durationMin)} min, ${Math.floor(pace)}:${String(r0((pace % 1) * 60)).padStart(2, "0")} /km${r.avgHr ? `, ${r.avgHr} bpm` : ""}`] };
    }
    case "log_sleep": {
      const s = v as Parsed<"log_sleep">;
      return { input: s, title: "Log sleep", lines: [`Night ending ${when(s.date)}`, `${Math.floor(s.totalMin / 60)}h ${String(s.totalMin % 60).padStart(2, "0")}${s.bedtime ? `, in bed ${s.bedtime}` : ""}${s.waketime ? `, up ${s.waketime}` : ""}${s.recovery != null ? `, recovery ${s.recovery}%` : ""}`] };
    }
  }
}

/** Writes a confirmed card. Re-validated here because it comes back from the browser. Returns a one-line summary. */
export async function apply(zone: RoomZone, tool: string, input: unknown): Promise<string> {
  const card = await check(zone, tool, input);
  const v = card.input as never;
  const sql = await db();
  switch (tool as ActionName) {
    case "log_meal": {
      const m = v as Parsed<"log_meal">;
      await sql`insert into meals (date, time, name, kcal, protein, carbs, fat, cost, kind, source)
                values (${m.date}, ${m.time ?? ""}, ${m.name}, ${m.kcal}, ${m.protein}, ${m.carbs}, ${m.fat}, ${m.cost ?? null}, ${m.kind}, 'room-agent')`;
      break;
    }
    case "delete_meal":
      await sql`delete from meals where id = ${(v as Parsed<"delete_meal">).id} and cook_id is null`;
      break;
    case "add_todo": {
      const t = v as Parsed<"add_todo">;
      await sql`insert into todos (id, title, due, sender) values (${"manual-" + randomUUID()}, ${t.title}, ${t.due ?? null}, 'You')`;
      break;
    }
    case "update_todo": {
      const t = v as Parsed<"update_todo">;
      if (t.title) await sql`update todos set title = ${t.title} where id = ${t.id}`;
      if (t.due !== undefined) await sql`update todos set due = ${t.due} where id = ${t.id}`;
      if (t.done != null) await sql`update todos set done = ${t.done}, done_at = ${t.done ? new Date() : null} where id = ${t.id}`;
      break;
    }
    case "log_workout":
    case "edit_workout": {
      const w = v as Parsed<"edit_workout">;
      await sql.begin(async (tx) => {
        let id = tool === "edit_workout" ? w.id : undefined;
        if (id) {
          const hit = await tx`update workouts set date = ${w.date}, kind = ${w.kind}, notes = ${w.notes ?? ""}, duration_min = ${w.durationMin ?? null}, date_estimated = false where id = ${id} returning id`;
          if (!hit.length) throw new Error("That workout wasn't found.");
          await tx`delete from sets where workout_id = ${id}`;
        } else {
          const [row] = await tx`insert into workouts (date, kind, notes, duration_min) values (${w.date}, ${w.kind}, ${w.notes ?? ""}, ${w.durationMin ?? null}) returning id`;
          id = row.id as number;
        }
        for (const [i, ex] of w.exercises.entries()) {
          if (ex.muscle) await tx`insert into exercises (name, muscle) values (${ex.name}, ${ex.muscle}) on conflict (user_id, name) do nothing`;
          for (const [j, s] of ex.sets.entries())
            await tx`insert into sets (workout_id, exercise, ex_order, set_no, weight, unit, reps) values (${id!}, ${ex.name}, ${i}, ${j + 1}, ${s.weight}, ${w.unit}, ${s.reps})`;
        }
      });
      break;
    }
    case "delete_workout":
      await sql`delete from workouts where id = ${(v as Parsed<"delete_workout">).id}`;
      break;
    case "log_run": {
      const r = v as Parsed<"log_run">;
      await sql`insert into runs (date, distance_km, duration_sec, kind, avg_hr, notes)
                values (${r.date}, ${r.distanceKm}, ${Math.round(r.durationMin * 60)}, ${r.kind}, ${r.avgHr ?? null}, ${r.notes ?? ""})`;
      break;
    }
    case "log_sleep": {
      const s = v as Parsed<"log_sleep">;
      await sql`insert into sleep_logs (date, total_min, bedtime, waketime, recovery, source)
                values (${s.date}, ${s.totalMin}, ${s.bedtime ?? null}, ${s.waketime ?? null}, ${s.recovery ?? null}, 'manual')
                on conflict (user_id, date) do update set total_min = excluded.total_min, bedtime = excluded.bedtime, waketime = excluded.waketime,
                  recovery = coalesce(excluded.recovery, sleep_logs.recovery), source = 'manual', updated_at = now()`;
      break;
    }
  }
  for (const p of ["/", "/dashboard", "/kitchen", "/training", "/office", "/bedroom"]) revalidatePath(p);
  return `${card.title}: ${card.lines.join("; ")}`;
}

/** Extra rows the agent needs to edit things: ids the room's summary data doesn't carry. */
export async function editContext(zone: RoomZone, today: string): Promise<string> {
  const sql = await db();
  const from = addDays(today, -13);
  if (zone === "kitchen") {
    const meals = await sql<{ id: number; date: string; time: string; name: string; kcal: number; protein: number; kind: string; cook_id: number | null }[]>`
      select id, date, time, name, kcal, protein, kind, cook_id from meals where date >= ${addDays(today, -6)} order by date, time`;
    return `Meals logged in the last 7 days (id | date time | name | kcal | protein):\n${meals.map((m) => `${m.id} | ${m.date} ${m.time} | ${m.name}${m.cook_id ? " (cooked from the fridge; remove it on the kitchen page)" : ""} | ${m.kcal} | ${Math.round(m.protein)} g`).join("\n") || "none"}`;
  }
  if (zone === "gym") {
    const ws = await sql<{ id: number; date: string; kind: string; duration_min: number | null }[]>`select id, date, kind, duration_min from workouts where date >= ${from} order by date`;
    const sets = ws.length
      ? await sql<{ workout_id: number; exercise: string; weight: number; unit: string; reps: number }[]>`
          select workout_id, exercise, weight, unit, reps from sets where workout_id in ${sql(ws.map((w) => w.id))} order by workout_id, ex_order, set_no`
      : [];
    const runs = await sql<{ date: string; distance_km: number; duration_sec: number; kind: string }[]>`select date, distance_km, duration_sec, kind from runs where date >= ${from} order by date`;
    const names = await sql<{ name: string }[]>`select distinct exercise as name from sets order by 1 limit 200`;
    const session = (w: (typeof ws)[number]) => {
      const by = new Map<string, string[]>();
      for (const s of sets.filter((s) => s.workout_id === w.id)) by.set(s.exercise, [...(by.get(s.exercise) ?? []), `${s.weight}${s.unit}×${s.reps}`]);
      return `id ${w.id} | ${w.date} | ${w.kind}${w.duration_min ? ` | ${w.duration_min} min` : ""}\n${[...by].map(([n, ss]) => `  ${n}: ${ss.join(", ")}`).join("\n")}`;
    };
    return `Lifting sessions in the last 14 days:\n${ws.map(session).join("\n") || "none"}\n\nRuns in the last 14 days:\n${runs.map((r) => `${r.date} | ${r.kind} | ${r.distance_km} km | ${Math.round(r.duration_sec / 60)} min`).join("\n") || "none"}\n\nExercise names in the log: ${names.map((n) => n.name).join(", ")}`;
  }
  return "";
}

const when = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
