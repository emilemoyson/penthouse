"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, setKV } from "@/lib/db";
import { addDays, todayISO } from "@/lib/dates";
import { itemCost, itemMacros } from "@/lib/kitchen";
import { GroceryItemIn, saveGroceryRun as saveRun, type GroceryRunIn } from "@/lib/groceries";
import { readReceipt, type ReceiptInput } from "@/lib/receipt";
import { getNutritionData, getProfessionalData } from "./server";

const MealIn = z.object({
  name: z.string().trim().min(1).max(200),
  kcal: z.coerce.number().int().min(0).max(10000),
  protein: z.coerce.number().min(0).max(1000).default(0),
  carbs: z.coerce.number().min(0).max(2000).default(0),
  fat: z.coerce.number().min(0).max(1000).default(0),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  cost: z.coerce.number().min(0).max(10_000).nullish(),
  kind: z.enum(["home", "out"]).default("home"),
});

const nowHM = () =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" }).format(new Date());

/** Kitchen panel: log a meal, returns the refreshed nutrition payload. */
export async function addMeal(input: z.input<typeof MealIn>) {
  const m = MealIn.parse(input);
  const sql = await db();
  await sql`insert into meals (date, time, name, kcal, protein, carbs, fat, cost, kind, source)
            values (${todayISO()}, ${m.time ?? nowHM()}, ${m.name}, ${m.kcal}, ${m.protein}, ${m.carbs}, ${m.fat}, ${m.cost ?? null}, ${m.kind}, 'manual')`;
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

/* ---------- groceries and pantry ---------- */

/** Reads a receipt photo or typed groceries into a draft. Nothing is saved until saveGroceryRun. */
export async function parseGroceries(input: ReceiptInput) {
  try {
    return { ok: true as const, draft: await readReceipt(input) };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Couldn't read that." };
  }
}

export async function saveGroceryRun(input: Omit<GroceryRunIn, "date"> & { date?: string }) {
  const sql = await db();
  await saveRun(sql, { ...input, date: input.date || todayISO() });
  revalidatePath("/");
  return getNutritionData();
}

const CookIn = z.object({
  name: z.string().trim().min(1).max(200),
  uses: z.array(z.object({ itemId: z.number().int().positive(), amount: z.coerce.number().positive() })).min(1).max(30),
  servings: z.coerce.number().int().min(1).max(20).default(1),
});

/**
 * Cooks from the pantry: logs one serving as a meal with macros and cost worked out from the items,
 * takes the amounts used off the pantry, and keeps the other servings in the fridge as leftovers.
 */
export async function cookMeal(input: z.input<typeof CookIn>) {
  const c = CookIn.parse(input);
  const sql = await db();
  const ids = c.uses.map((u) => u.itemId);
  const items = await sql<{ id: number; qty: number; qty_start: number; unit: string; price: number; kcal_per: number; protein_per: number; carbs_per: number; fat_per: number }[]>`
    select id, qty, qty_start, unit, price, kcal_per, protein_per, carbs_per, fat_per from pantry_items where id in ${sql(ids)}`;
  const byId = new Map(items.map((i) => [i.id, i]));
  const tot = { kcal: 0, protein: 0, carbs: 0, fat: 0, cost: 0 };
  for (const u of c.uses) {
    const it = byId.get(u.itemId);
    if (!it) continue;
    const amount = Math.min(u.amount, it.qty);
    const m = itemMacros(it, amount);
    tot.kcal += m.kcal;
    tot.protein += m.protein;
    tot.carbs += m.carbs;
    tot.fat += m.fat;
    tot.cost += itemCost(it, amount);
  }
  const n = c.servings;
  const today = todayISO();
  await sql.begin(async (tx) => {
    for (const u of c.uses) {
      await tx`update pantry_items set qty = greatest(0, qty - ${u.amount}),
                 finished_at = case when qty - ${u.amount} <= 0.0001 then now() else finished_at end
               where id = ${u.itemId}`;
    }
    await tx`insert into meals (date, time, name, kcal, protein, carbs, fat, cost, kind, source)
             values (${today}, ${nowHM()}, ${c.name}, ${Math.round(tot.kcal / n)}, ${tot.protein / n}, ${tot.carbs / n}, ${tot.fat / n}, ${tot.cost / n}, 'home', 'manual')`;
    if (n > 1) {
      await tx`insert into pantry_items (name, place, qty, qty_start, unit, price, kcal_per, protein_per, carbs_per, fat_per, bought, use_by)
               values (${`${c.name}, leftovers`}, 'fridge', ${n - 1}, ${n - 1}, 'serving', ${(tot.cost / n) * (n - 1)},
                       ${tot.kcal / n}, ${tot.protein / n}, ${tot.carbs / n}, ${tot.fat / n}, ${today}, ${addDays(today, 4)})`;
    }
  });
  revalidatePath("/");
  return getNutritionData();
}

/** Eat one serving of a pantry item as is (a shake, a yogurt, leftovers). */
export async function eatItem(itemId: number, amount: number) {
  const sql = await db();
  const [it] = await sql<{ name: string }[]>`select name from pantry_items where id = ${itemId}`;
  if (!it) return getNutritionData();
  return cookMeal({ name: it.name.replace(/, leftovers$/, ""), uses: [{ itemId, amount }] });
}

const PantryPatch = GroceryItemIn.pick({ place: true, use_by: true }).extend({ qty: z.coerce.number().min(0).optional(), name: z.string().trim().min(1).max(200).optional() });

export async function updatePantryItem(id: number, patch: z.input<typeof PantryPatch>) {
  if (id < 0) return getNutritionData();
  const p = PantryPatch.parse(patch);
  const sql = await db();
  if (p.name != null) await sql`update pantry_items set name = ${p.name} where id = ${id}`;
  if (p.place != null) await sql`update pantry_items set place = ${p.place} where id = ${id}`;
  if (p.use_by !== undefined) await sql`update pantry_items set use_by = ${p.use_by ?? null} where id = ${id}`;
  if (p.qty != null) await sql`update pantry_items set qty = ${p.qty}, finished_at = ${p.qty <= 0 ? new Date() : null} where id = ${id}`;
  revalidatePath("/");
  revalidatePath("/kitchen");
  return getNutritionData();
}

/** Gone (eaten without logging, or thrown out). */
export async function finishPantryItem(id: number) {
  if (id < 0) return getNutritionData();
  const sql = await db();
  await sql`update pantry_items set finished_at = now() where id = ${id}`;
  revalidatePath("/");
  revalidatePath("/kitchen");
  return getNutritionData();
}

export async function deleteGroceryRun(id: number) {
  const sql = await db();
  await sql.begin(async (tx) => {
    await tx`delete from pantry_items where run_id = ${id}`;
    await tx`delete from grocery_runs where id = ${id}`;
  });
  revalidatePath("/");
  revalidatePath("/kitchen");
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
