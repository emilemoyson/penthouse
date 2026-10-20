/**
 * Kitchen math shared by the server and the kitchen panel (no database access here).
 * Pantry amounts are stored in g, ml, item or serving. Macros are per 100 g/ml, or per item/serving.
 */
import { addDays, daysBetween } from "./dates";

export const PLACES = ["fridge", "freezer", "pantry"] as const;
export type Place = (typeof PLACES)[number];
export const UNITS = ["g", "ml", "item", "serving"] as const;
export type Unit = (typeof UNITS)[number];

/** Units people type, mapped to a stored unit and a factor. */
const ALIASES: Record<string, [Unit, number]> = {
  g: ["g", 1],
  gram: ["g", 1],
  grams: ["g", 1],
  kg: ["g", 1000],
  lb: ["g", 453.592],
  lbs: ["g", 453.592],
  oz: ["g", 28.3495],
  ml: ["ml", 1],
  l: ["ml", 1000],
  "fl oz": ["ml", 29.5735],
  floz: ["ml", 29.5735],
  gal: ["ml", 3785.41],
  item: ["item", 1],
  items: ["item", 1],
  x: ["item", 1],
  pc: ["item", 1],
  pcs: ["item", 1],
  each: ["item", 1],
  serving: ["serving", 1],
  servings: ["serving", 1],
};
export const INPUT_UNITS = ["g", "kg", "lb", "oz", "ml", "l", "fl oz", "item", "serving"] as const;

/** Converts an amount in any known unit to the stored unit. Unknown units count as items. */
export function normalizeQty(qty: number, unit: string): { qty: number; unit: Unit } {
  const [u, f] = ALIASES[unit.trim().toLowerCase()] ?? ["item", 1];
  return { qty: Math.round(qty * f * 100) / 100, unit: u };
}

/** Macros are given per this many units. */
export const perBase = (unit: string) => (unit === "g" || unit === "ml" ? 100 : 1);
export const perLabel = (unit: string) => (unit === "g" ? "100 g" : unit === "ml" ? "100 ml" : unit);

type ItemLike = {
  unit: string;
  qty_start: number;
  price: number;
  kcal_per: number;
  protein_per: number;
  carbs_per: number;
  fat_per: number;
};

export function itemCost(item: ItemLike, amount: number) {
  return item.qty_start > 0 ? (item.price / item.qty_start) * amount : 0;
}

export function itemMacros(item: ItemLike, amount: number) {
  const k = amount / perBase(item.unit);
  return { kcal: item.kcal_per * k, protein: item.protein_per * k, carbs: item.carbs_per * k, fat: item.fat_per * k };
}

/** portions: "made 4, ate 1". weight: weigh the finished dish, then how many grams were eaten. */
export type CookSplit = { by: "portions"; made: number; ate: number } | { by: "weight"; cooked: number; ate: number };
/** Something not from the fridge (oil, salt, a spice), with its macros for the amount used. */
export type CookExtra = { name: string; kcal: number; protein: number; carbs: number; fat: number };
type Macros = { kcal: number; protein: number; carbs: number; fat: number };

/**
 * What a cook does, without saving: amounts taken (never more than is left), totals for the dish,
 * the eaten share, and the leftovers item (per portion, or per 100 g of the cooked dish).
 * cookMeal saves exactly this, and the kitchen chat shows it before saving.
 */
export function previewCook(
  items: (ItemLike & { id: number; qty: number })[],
  c: { uses: { itemId: number; amount: number }[]; split: CookSplit; extras?: CookExtra[] },
) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const tot = { kcal: 0, protein: 0, carbs: 0, fat: 0, cost: 0 };
  const uses = c.uses.flatMap((u) => {
    const it = byId.get(u.itemId);
    if (!it) return [];
    const amount = Math.max(0, Math.min(u.amount, it.qty));
    const m = itemMacros(it, amount);
    tot.kcal += m.kcal;
    tot.protein += m.protein;
    tot.carbs += m.carbs;
    tot.fat += m.fat;
    tot.cost += itemCost(it, amount);
    return amount > 0 ? [{ itemId: it.id, amount, left: it.qty - amount, short: u.amount > it.qty + 0.0001 }] : [];
  });
  for (const x of c.extras ?? []) {
    tot.kcal += x.kcal;
    tot.protein += x.protein;
    tot.carbs += x.carbs;
    tot.fat += x.fat;
  }
  const sp = c.split;
  const total = sp.by === "portions" ? sp.made : sp.cooked;
  const share = total > 0 ? Math.min(1, sp.ate / total) : 0; // share of the dish eaten now
  const left = Math.max(0, total - sp.ate);
  const scale = (k: number): Macros => ({ kcal: tot.kcal * k, protein: tot.protein * k, carbs: tot.carbs * k, fat: tot.fat * k });
  // leftovers are per portion, or per 100 g of the cooked dish
  const base = sp.by === "portions" ? sp.made : sp.cooked / 100;
  return {
    uses,
    share,
    total: tot,
    eaten: { ...scale(share), cost: tot.cost * share },
    leftovers:
      left > 0.0001
        ? { qty: left, unit: sp.by === "portions" ? ("serving" as const) : ("g" as const), cost: tot.cost * (1 - share), per: scale(1 / base) }
        : null,
  };
}

/** Default shelf life when no use-by date is set, counted from the day it was bought. */
const SHELF_DAYS: Record<string, number> = { fridge: 5, freezer: 90, pantry: 180 };

export function expiryOf(item: { place: string; bought: string; use_by: string | null }) {
  return item.use_by || addDays(item.bought, SHELF_DAYS[item.place] ?? 5);
}

/** Days left before it should be used, negative when past. */
export function daysLeft(item: { place: string; bought: string; use_by: string | null }, today: string) {
  return daysBetween(today, expiryOf(item));
}

export const USE_SOON_DAYS = 3;

export function fmtQty(qty: number, unit: string) {
  const n = unit === "g" || unit === "ml" ? Math.round(qty) : Math.round(qty * 10) / 10;
  if (unit === "g" && n >= 1000) return `${Math.round(n / 100) / 10} kg`;
  if (unit === "ml" && n >= 1000) return `${Math.round(n / 100) / 10} l`;
  if (unit === "item") return `${n}`;
  if (unit === "serving") return `${n} ${n === 1 ? "portion" : "portions"}`;
  return `${n} ${unit}`;
}

export const money = (v: number) => `$${v.toFixed(2)}`;
