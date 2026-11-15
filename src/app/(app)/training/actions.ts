"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { MUSCLES } from "@/lib/exercises";

const WorkoutInput = z.object({
  id: z.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.string().min(1).max(20),
  notes: z.string().max(2000).default(""),
  durationMin: z.number().int().min(1).max(600).nullable().optional(),
  unit: z.enum(["lb", "kg"]),
  exercises: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        muscle: z.enum(MUSCLES).optional(),
        exKind: z.enum(["compound", "isolation"]).optional(),
        sets: z
          .array(z.object({ weight: z.number().min(0).max(2000), reps: z.number().int().min(0).max(200) }))
          .min(1),
      }),
    )
    .min(1),
});

export async function saveWorkout(_prev: { error?: string } | undefined, form: FormData) {
  let parsed;
  try {
    parsed = WorkoutInput.parse(JSON.parse(String(form.get("payload") || "{}")));
  } catch {
    return { error: "Something's missing. Every exercise needs a name and at least one set with reps." };
  }
  const sql = await db();
  const w = parsed;
  await sql.begin(async (tx) => {
    let id = w.id;
    if (id) {
      await tx`update workouts set date = ${w.date}, kind = ${w.kind}, notes = ${w.notes}, duration_min = ${w.durationMin ?? null}, date_estimated = false where id = ${id}`;
      await tx`delete from sets where workout_id = ${id}`;
    } else {
      const [row] = await tx`insert into workouts (date, kind, notes, duration_min) values (${w.date}, ${w.kind}, ${w.notes}, ${w.durationMin ?? null}) returning id`;
      id = row.id as number;
    }
    for (const [i, ex] of w.exercises.entries()) {
      if (ex.muscle) {
        await tx`insert into exercises (name, muscle, kind) values (${ex.name}, ${ex.muscle}, ${ex.exKind || "compound"})
                 on conflict (user_id, name) do update set muscle = excluded.muscle, kind = excluded.kind`;
      }
      for (const [j, s] of ex.sets.entries()) {
        if (s.reps <= 0) continue;
        await tx`insert into sets (workout_id, exercise, ex_order, set_no, weight, unit, reps)
                 values (${id!}, ${ex.name}, ${i}, ${j + 1}, ${s.weight}, ${w.unit}, ${s.reps})`;
      }
    }
  });
  revalidatePath("/training");
  revalidatePath("/");
  redirect("/training");
}

export async function deleteWorkout(id: number) {
  const sql = await db();
  await sql`delete from workouts where id = ${id}`;
  revalidatePath("/training");
}

const RunInput = z.object({
  id: z.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  distance_km: z.number().positive().max(300),
  duration_sec: z.number().int().positive().max(86400),
  kind: z.string().min(1).max(20),
  avg_hr: z.number().int().min(30).max(240).nullable(),
  notes: z.string().max(1000).default(""),
});

function parseDuration(s: string): number | null {
  const parts = s.trim().split(":").map((p) => p.trim());
  if (!parts.length || parts.some((p) => p === "" || isNaN(Number(p)))) return null;
  const n = parts.map(Number);
  if (n.length === 1) return Math.round(n[0] * 60); // minutes
  if (n.length === 2) return n[0] * 60 + n[1];
  if (n.length === 3) return n[0] * 3600 + n[1] * 60 + n[2];
  return null;
}

export async function saveRun(_prev: { error?: string } | undefined, form: FormData) {
  const duration = parseDuration(String(form.get("duration") || ""));
  if (!duration) return { error: "Time should look like 27:40 or 1:05:30." };
  const hr = String(form.get("avg_hr") || "").trim();
  const idRaw = String(form.get("id") || "");
  const res = RunInput.safeParse({
    id: idRaw ? Number(idRaw) : undefined,
    date: String(form.get("date") || ""),
    distance_km: Number(String(form.get("distance") || "").replace(",", ".")),
    duration_sec: duration,
    kind: String(form.get("kind") || "easy"),
    avg_hr: hr ? Number(hr) : null,
    notes: String(form.get("notes") || ""),
  });
  if (!res.success) return { error: "Check the date, distance and time." };
  const r = res.data;
  const sql = await db();
  if (r.id) {
    await sql`update runs set date = ${r.date}, distance_km = ${r.distance_km}, duration_sec = ${r.duration_sec}, kind = ${r.kind},
              avg_hr = ${r.avg_hr}, notes = ${r.notes} where id = ${r.id}`;
  } else {
    await sql`insert into runs (date, distance_km, duration_sec, kind, avg_hr, notes)
              values (${r.date}, ${r.distance_km}, ${r.duration_sec}, ${r.kind}, ${r.avg_hr}, ${r.notes})`;
  }
  revalidatePath("/training");
  redirect("/training");
}

export async function deleteRun(id: number) {
  const sql = await db();
  await sql`delete from runs where id = ${id}`;
  revalidatePath("/training");
}
