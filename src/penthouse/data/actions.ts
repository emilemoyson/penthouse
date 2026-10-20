"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, setKV } from "@/lib/db";
import { addDays, todayISO } from "@/lib/dates";
import { normalizeQty, perBase, previewCook } from "@/lib/kitchen";
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

/**
 * Deletes a meal. If it was cooked from the pantry and its leftovers are untouched, the cook is undone:
 * the ingredients go back and the leftovers item is removed. Otherwise only the meal row goes.
 */
export async function deleteMeal(id: number) {
  if (id < 0) return getNutritionData(); // sample rows aren't stored
  const sql = await db();
  await sql.begin(async (tx) => {
    const [m] = await tx<{ cook_id: number | null }[]>`select cook_id from meals where id = ${id}`;
    const [cook] = m?.cook_id
      ? await tx<{ id: number; leftover_item_id: number | null }[]>`select id, leftover_item_id from cooks where id = ${m.cook_id}`
      : [];
    const lo = cook?.leftover_item_id
      ? (await tx<{ qty: number; qty_start: number; finished_at: Date | null }[]>`select qty, qty_start, finished_at from pantry_items where id = ${cook.leftover_item_id}`)[0]
      : null;
    const undo = cook && (!lo || (lo.finished_at == null && Math.abs(lo.qty - lo.qty_start) < 0.0001));
    if (undo) {
      const uses = await tx<{ item_id: number; amount: number }[]>`select item_id, amount from cook_uses where cook_id = ${cook.id}`;
      for (const u of uses) await tx`update pantry_items set qty = least(qty_start, qty + ${u.amount}), finished_at = null where id = ${u.item_id}`;
      if (cook.leftover_item_id) await tx`delete from pantry_items where id = ${cook.leftover_item_id}`;
      await tx`delete from meals where cook_id = ${cook.id}`;
      await tx`delete from cooks where id = ${cook.id}`;
    } else {
      await tx`delete from meals where id = ${id}`;
    }
  });
  revalidatePath("/");
  revalidatePath("/kitchen");
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

const CookIn = z
  .object({
    name: z.string().trim().min(1).max(200),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    uses: z.array(z.object({ itemId: z.number().int().positive(), amount: z.coerce.number().positive() })).min(1).max(30),
    /** portions: "made 4, ate 1". weight: weigh the finished dish, then how many grams were eaten. See CookSplit. */
    split: z.discriminatedUnion("by", [
      z.object({ by: z.literal("portions"), made: z.coerce.number().min(0.5).max(50), ate: z.coerce.number().min(0).max(50) }),
      z.object({ by: z.literal("weight"), cooked: z.coerce.number().positive().max(50_000), ate: z.coerce.number().min(0).max(50_000) }),
    ]),
    keepIn: z.enum(["fridge", "freezer"]).default("fridge"),
    /** not from the fridge (oil, salt): macros for the amount used, added to the dish */
    extras: z
      .array(z.object({ name: z.string().trim().min(1).max(100), kcal: z.coerce.number().min(0).max(5000), protein: z.coerce.number().min(0).max(500), carbs: z.coerce.number().min(0).max(500), fat: z.coerce.number().min(0).max(500) }))
      .max(20)
      .default([]),
  })
  .refine((c) => (c.split.by === "portions" ? c.split.ate <= c.split.made : c.split.ate <= c.split.cooked), { message: "Ate more than was made" });
export type CookInput = z.input<typeof CookIn>;

/**
 * Cooks from the pantry. Takes what was used off the pantry, logs the part that was eaten as a meal
 * (macros and cost from the items), and keeps the rest as a leftovers item: per portion, or per 100 g when weighed.
 * Every cook is recorded with what it used, so deleting its meal can put the food back.
 */
export async function cookMeal(input: CookInput) {
  const c = CookIn.parse(input);
  const sql = await db();
  const ids = c.uses.map((u) => u.itemId);
  const items = await sql<{ id: number; qty: number; qty_start: number; unit: string; price: number; kcal_per: number; protein_per: number; carbs_per: number; fat_per: number }[]>`
    select id, qty, qty_start, unit, price, kcal_per, protein_per, carbs_per, fat_per from pantry_items where id in ${sql(ids)} and finished_at is null`;
  const p = previewCook(items, c);
  if (!p.uses.length) return getNutritionData();
  const date = c.date ?? todayISO();

  await sql.begin(async (tx) => {
    const [cook] = await tx<{ id: number }[]>`insert into cooks (date, name) values (${date}, ${c.name}) returning id`;
    for (const u of p.uses) {
      await tx`insert into cook_uses (cook_id, item_id, amount) values (${cook.id}, ${u.itemId}, ${u.amount})`;
      await tx`update pantry_items set qty = greatest(0, qty - ${u.amount}),
                 finished_at = case when qty - ${u.amount} <= 0.0001 then now() else finished_at end
               where id = ${u.itemId}`;
    }
    const e = p.eaten;
    if (p.share > 0) {
      await tx`insert into meals (date, time, name, kcal, protein, carbs, fat, cost, kind, source, cook_id)
               values (${date}, ${date === todayISO() ? nowHM() : ""}, ${c.name}, ${Math.round(e.kcal)}, ${e.protein}, ${e.carbs},
                       ${e.fat}, ${e.cost}, 'home', 'manual', ${cook.id})`;
    }
    const lo = p.leftovers;
    if (lo) {
      const [row] = await tx<{ id: number }[]>`
        insert into pantry_items (name, place, qty, qty_start, unit, price, kcal_per, protein_per, carbs_per, fat_per, bought, use_by)
        values (${`${c.name}, leftovers`}, ${c.keepIn}, ${lo.qty}, ${lo.qty}, ${lo.unit}, ${lo.cost},
                ${lo.per.kcal}, ${lo.per.protein}, ${lo.per.carbs}, ${lo.per.fat}, ${date}, ${addDays(date, c.keepIn === "freezer" ? 90 : 4)})
        returning id`;
      await tx`update cooks set leftover_item_id = ${row.id} where id = ${cook.id}`;
    }
  });
  revalidatePath("/");
  revalidatePath("/kitchen");
  return getNutritionData();
}

/** Eat some of a pantry item as is (leftovers, a yogurt, a shake): any amount, in the item's unit. */
export async function eatItem(itemId: number, amount: number) {
  const sql = await db();
  const [it] = await sql<{ name: string }[]>`select name from pantry_items where id = ${itemId}`;
  if (!it || !(amount > 0)) return getNutritionData();
  return cookMeal({ name: it.name.replace(/, leftovers$/, ""), uses: [{ itemId, amount }], split: { by: "portions", made: 1, ate: 1 } });
}

const PantryPatch = GroceryItemIn.pick({ place: true, use_by: true }).extend({
  qty: z.coerce.number().min(0).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  /** the real package size, in any unit people type (2 lb, 32 oz, 907 g); true just confirms the guess */
  size: z.union([z.literal(true), z.object({ qty: z.coerce.number().positive().max(100_000), unit: z.string().max(10) })]).optional(),
});

export async function updatePantryItem(id: number, patch: z.input<typeof PantryPatch>) {
  if (id < 0) return getNutritionData();
  const p = PantryPatch.parse(patch);
  const sql = await db();
  if (p.name != null) await sql`update pantry_items set name = ${p.name} where id = ${id}`;
  if (p.place != null) await sql`update pantry_items set place = ${p.place} where id = ${id}`;
  if (p.use_by !== undefined) await sql`update pantry_items set use_by = ${p.use_by ?? null} where id = ${id}`;
  // more than was bought means the package size was guessed wrong: the price then covers the new amount
  if (p.qty != null)
    await sql`update pantry_items set qty = ${p.qty}, qty_start = greatest(qty_start, ${p.qty}), finished_at = ${p.qty <= 0 ? new Date() : null},
                size_guessed = size_guessed and ${p.qty} <= qty_start where id = ${id}`;
  if (p.size === true) await sql`update pantry_items set size_guessed = false where id = ${id}`;
  else if (p.size) await fixPackageSize(id, p.size);
  revalidatePath("/");
  revalidatePath("/kitchen");
  return getNutritionData();
}

/**
 * The package was a different size than guessed. What's left keeps its share (757 of a guessed 907 g stays 83 %),
 * the price now covers the new size, and a count ("1 item") that becomes a weight gets its macros moved to per 100 g.
 */
async function fixPackageSize(id: number, size: { qty: number; unit: string }) {
  const sql = await db();
  const [it] = await sql<{ qty: number; qty_start: number; unit: string; kcal_per: number; protein_per: number; carbs_per: number; fat_per: number }[]>`
    select qty, qty_start, unit, kcal_per, protein_per, carbs_per, fat_per from pantry_items where id = ${id}`;
  if (!it || !(it.qty_start > 0)) return;
  const n = normalizeQty(size.qty, size.unit);
  // macros per 1 unit before, then per base unit after (per 100 g, or per item)
  const k = it.unit === n.unit ? 1 : ((it.qty_start / perBase(it.unit)) / (n.qty / perBase(n.unit)));
  const share = it.qty / it.qty_start;
  await sql`update pantry_items set qty = ${share * n.qty}, qty_start = ${n.qty}, unit = ${n.unit},
              kcal_per = ${it.kcal_per * k}, protein_per = ${it.protein_per * k}, carbs_per = ${it.carbs_per * k}, fat_per = ${it.fat_per * k},
              size_guessed = false
            where id = ${id}`;
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
