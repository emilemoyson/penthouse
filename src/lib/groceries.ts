import { z } from "zod";
import type { Sql } from "postgres";
import { normalizeQty, PLACES } from "./kitchen";
import { estimateItems, receiptEnabled } from "./receipt";

/** One bought line. Macros are optional: missing ones are looked up by barcode, then estimated by Claude. */
export const GroceryItemIn = z.object({
  name: z.string().trim().min(1).max(200),
  qty: z.coerce.number().positive().max(100_000).default(1),
  unit: z.string().max(10).default("item"), // g, kg, lb, oz, ml, l, fl oz, item, serving
  price: z.coerce.number().min(0).max(10_000).default(0),
  place: z.enum(PLACES).optional(),
  kcal_per: z.coerce.number().min(0).max(5000).optional(),
  protein_per: z.coerce.number().min(0).max(1000).optional(),
  carbs_per: z.coerce.number().min(0).max(1000).optional(),
  fat_per: z.coerce.number().min(0).max(1000).optional(),
  use_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  barcode: z.string().max(40).nullish(),
});
export type GroceryItemIn = z.input<typeof GroceryItemIn>;

export const GroceryRunIn = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  store: z.string().max(100).default(""),
  total: z.coerce.number().min(0).max(10_000).optional(), // defaults to the sum of item prices
  source: z.string().max(40).default("manual"),
  extId: z.string().max(200).optional(), // receipt id from another app; re-sending the same one is skipped
  items: z.array(GroceryItemIn).min(1).max(200),
});
export type GroceryRunIn = z.input<typeof GroceryRunIn>;

type Full = z.output<typeof GroceryItemIn> & { place: (typeof PLACES)[number]; kcal_per: number; protein_per: number; carbs_per: number; fat_per: number };
const hasMacros = (i: z.output<typeof GroceryItemIn>) => i.kcal_per != null;

/** Nutrition label from Open Food Facts (free, no key). Per 100 g/ml, plus the package size when known. */
async function lookupBarcode(code: string) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=quantity,product_quantity,product_quantity_unit,nutriments`, {
      headers: { "User-Agent": "penthouse-dashboard/1.0 (personal use)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      status?: number;
      product?: { quantity?: string; product_quantity?: number | string; product_quantity_unit?: string; nutriments?: Record<string, number> };
    };
    const p = j.product;
    const n = p?.nutriments;
    if (j.status !== 1 || !p || !n || n["energy-kcal_100g"] == null) return null;
    // the numeric size isn't always returned; "5.3 OZ (150 g)" has it too
    const m = p.quantity?.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
    const size = Number(p.product_quantity) || (m ? Number(m[1].replace(",", ".")) : null);
    return {
      unit: (p.product_quantity_unit ?? m?.[2] ?? "g").toLowerCase() === "ml" ? "ml" : "g",
      size,
      kcal_per: n["energy-kcal_100g"] ?? 0,
      protein_per: n.proteins_100g ?? 0,
      carbs_per: n.carbohydrates_100g ?? 0,
      fat_per: n.fat_100g ?? 0,
    };
  } catch {
    return null;
  }
}

/** Fills in missing macros: barcode first, then one Claude call for the rest. Items Claude can't reach keep zeros. */
export async function completeItems(items: z.output<typeof GroceryItemIn>[]): Promise<Full[]> {
  const out: (Full | null)[] = await Promise.all(
    items.map(async (i) => {
      if (hasMacros(i)) return { ...i, place: i.place ?? "fridge", kcal_per: i.kcal_per!, protein_per: i.protein_per ?? 0, carbs_per: i.carbs_per ?? 0, fat_per: i.fat_per ?? 0 };
      if (!i.barcode) return null;
      const off = await lookupBarcode(i.barcode);
      // a count of packages becomes grams or ml; without a package size the per-100 g label can't be used
      const byCount = !["g", "kg", "lb", "oz", "ml", "l", "fl oz"].includes(i.unit.toLowerCase());
      if (!off || (byCount && !off.size)) return null;
      return {
        ...i,
        qty: byCount && off.size ? i.qty * off.size : i.qty,
        unit: byCount && off.size ? off.unit : i.unit,
        place: i.place ?? "fridge",
        kcal_per: off.kcal_per,
        protein_per: off.protein_per,
        carbs_per: off.carbs_per,
        fat_per: off.fat_per,
      };
    }),
  );
  const missing = out.map((o, idx) => (o ? -1 : idx)).filter((idx) => idx >= 0);
  if (missing.length) {
    const est = receiptEnabled() ? await estimateItems(missing.map((idx) => items[idx])).catch(() => null) : null;
    missing.forEach((idx, k) => {
      const i = items[idx];
      const e = est?.[k];
      out[idx] = e
        ? { ...i, qty: e.qty, unit: e.unit, place: i.place ?? e.place, kcal_per: e.kcal_per, protein_per: e.protein_per, carbs_per: e.carbs_per, fat_per: e.fat_per, use_by: i.use_by ?? e.use_by }
        : { ...i, place: i.place ?? "fridge", kcal_per: 0, protein_per: 0, carbs_per: 0, fat_per: 0 };
    });
  }
  return out as Full[];
}

/** Saves a shop and puts its items in the pantry. Returns null when a run with the same extId already exists. */
export async function saveGroceryRun(sql: Sql, input: GroceryRunIn): Promise<{ id: number; items: number } | null> {
  const run = GroceryRunIn.parse(input);
  if (run.extId) {
    const hit = await sql`select id from grocery_runs where ext_id = ${run.extId} limit 1`;
    if (hit.length) return null;
  }
  const items = await completeItems(run.items);
  const total = run.total ?? Math.round(items.reduce((a, i) => a + i.price, 0) * 100) / 100;
  return sql.begin(async (tx) => {
    const [r] = await tx<{ id: number }[]>`
      insert into grocery_runs (date, store, total, source, ext_id) values (${run.date}, ${run.store}, ${total}, ${run.source}, ${run.extId ?? null}) returning id`;
    for (const i of items) {
      const { qty, unit } = normalizeQty(i.qty, i.unit);
      await tx`insert into pantry_items (run_id, name, place, qty, qty_start, unit, price, kcal_per, protein_per, carbs_per, fat_per, bought, use_by, barcode)
        values (${r.id}, ${i.name}, ${i.place}, ${qty}, ${qty}, ${unit}, ${i.price}, ${i.kcal_per}, ${i.protein_per}, ${i.carbs_per}, ${i.fat_per},
                ${run.date}, ${i.use_by ?? null}, ${i.barcode ?? null})`;
    }
    return { id: r.id, items: items.length };
  });
}
