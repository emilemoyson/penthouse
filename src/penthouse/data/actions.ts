"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, setKV } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { getNutritionData, getProfessionalData } from "./server";

const MealIn = z.object({
  name: z.string().trim().min(1).max(200),
  kcal: z.coerce.number().int().min(0).max(10000),
  protein: z.coerce.number().min(0).max(1000).default(0),
  carbs: z.coerce.number().min(0).max(2000).default(0),
  fat: z.coerce.number().min(0).max(1000).default(0),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

/** Kitchen panel: log a meal, returns the refreshed nutrition payload. */
export async function addMeal(input: z.input<typeof MealIn>) {
  const m = MealIn.parse(input);
  const time =
    m.time ??
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" }).format(new Date());
  const sql = await db();
  await sql`insert into meals (date, time, name, kcal, protein, carbs, fat, source)
            values (${todayISO()}, ${time}, ${m.name}, ${m.kcal}, ${m.protein}, ${m.carbs}, ${m.fat}, 'manual')`;
  revalidatePath("/");
  return getNutritionData();
}

export async function deleteMeal(id: number) {
  if (id < 0) return getNutritionData(); // sample rows aren't stored
  const sql = await db();
  await sql`delete from meals where id = ${id}`;
  revalidatePath("/");
  return getNutritionData();
}

export async function setNutritionTargets(t: { kcal: number; protein: number; carbs: number; fat: number }) {
  await setKV("nutrition_targets", t);
  revalidatePath("/");
  return getNutritionData();
}

/** Office panel: tick a to-do on or off, returns the refreshed office payload. */
export async function toggleTodo(id: string, done: boolean) {
  const sql = await db();
  await sql`update todos set done = ${done}, done_at = ${done ? new Date() : null} where id = ${id}`;
  revalidatePath("/");
  return getProfessionalData();
}
