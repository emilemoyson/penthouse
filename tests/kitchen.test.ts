import { describe, expect, it } from "vitest";
import { expiryOf, itemCost, itemMacros, normalizeQty, previewCook } from "@/lib/kitchen";

// 500 g of chicken: 165 kcal and 31 g protein per 100 g, bought for $5 (qty_start 500).
const chicken = { id: 1, unit: "g", qty: 500, qty_start: 500, price: 5, kcal_per: 165, protein_per: 31, carbs_per: 0, fat_per: 3.6 };
// 6 eggs: macros per item.
const eggs = { id: 2, unit: "item", qty: 6, qty_start: 6, price: 3, kcal_per: 70, protein_per: 6, carbs_per: 0.4, fat_per: 5 };

describe("normalizeQty", () => {
  it("converts to the stored unit", () => {
    expect(normalizeQty(1, "kg")).toEqual({ qty: 1000, unit: "g" });
    expect(normalizeQty(1, "lb")).toEqual({ qty: 453.59, unit: "g" });
    expect(normalizeQty(2, "l")).toEqual({ qty: 2000, unit: "ml" });
  });
  it("treats unknown units as items and ignores case and spaces", () => {
    expect(normalizeQty(3, "boxes")).toEqual({ qty: 3, unit: "item" });
    expect(normalizeQty(8, " FL OZ ")).toEqual({ qty: 236.59, unit: "ml" });
  });
});

describe("itemMacros and itemCost", () => {
  it("scales per-100g macros by the amount", () => {
    const m = itemMacros(chicken, 200);
    expect(m.kcal).toBeCloseTo(330);
    expect(m.protein).toBeCloseTo(62);
  });
  it("scales per-item macros by the count", () => {
    expect(itemMacros(eggs, 3).kcal).toBeCloseTo(210);
  });
  it("prices by share of the package and survives a zero package", () => {
    expect(itemCost(chicken, 100)).toBeCloseTo(1);
    expect(itemCost({ ...chicken, qty_start: 0 }, 100)).toBe(0);
  });
});

describe("previewCook", () => {
  it("splits a dish into the eaten share and leftovers per portion", () => {
    const r = previewCook([chicken], { uses: [{ itemId: 1, amount: 400 }], split: { by: "portions", made: 4, ate: 1 } });
    expect(r.total.kcal).toBeCloseTo(660);
    expect(r.share).toBeCloseTo(0.25);
    expect(r.eaten.kcal).toBeCloseTo(165);
    expect(r.eaten.cost).toBeCloseTo(1);
    expect(r.leftovers).toMatchObject({ qty: 3, unit: "serving" });
    expect(r.leftovers!.per.kcal).toBeCloseTo(165);
    expect(r.uses[0]).toMatchObject({ amount: 400, left: 100, short: false });
  });
  it("never takes more than what is left and flags it", () => {
    const r = previewCook([chicken], { uses: [{ itemId: 1, amount: 900 }], split: { by: "portions", made: 1, ate: 1 } });
    expect(r.uses[0]).toMatchObject({ amount: 500, left: 0, short: true });
    expect(r.total.kcal).toBeCloseTo(825);
    expect(r.leftovers).toBeNull();
  });
  it("weight split gives leftovers in grams, macros per 100 g of the dish", () => {
    const r = previewCook([chicken], { uses: [{ itemId: 1, amount: 400 }], split: { by: "weight", cooked: 800, ate: 200 } });
    expect(r.share).toBeCloseTo(0.25);
    expect(r.leftovers).toMatchObject({ qty: 600, unit: "g" });
    expect(r.leftovers!.per.kcal).toBeCloseTo(660 / 8);
  });
  it("adds extras (oil, spices) to the dish totals", () => {
    const r = previewCook([eggs], { uses: [{ itemId: 2, amount: 2 }], split: { by: "portions", made: 1, ate: 1 }, extras: [{ name: "oil", kcal: 120, protein: 0, carbs: 0, fat: 14 }] });
    expect(r.total.kcal).toBeCloseTo(260);
    expect(r.total.fat).toBeCloseTo(24);
  });
  it("ignores unknown items and zero amounts, and a zero total eats nothing", () => {
    const r = previewCook([chicken], { uses: [{ itemId: 99, amount: 10 }, { itemId: 1, amount: 0 }], split: { by: "portions", made: 0, ate: 1 } });
    expect(r.uses).toEqual([]);
    expect(r.share).toBe(0);
  });
});

describe("expiryOf", () => {
  it("uses the use-by date when there is one", () => {
    expect(expiryOf({ place: "fridge", bought: "2026-11-01", use_by: "2026-11-03" })).toBe("2026-11-03");
  });
  it("falls back to the shelf life of the place", () => {
    expect(expiryOf({ place: "fridge", bought: "2026-11-01", use_by: null })).toBe("2026-11-06");
    expect(expiryOf({ place: "freezer", bought: "2026-11-01", use_by: null })).toBe("2027-01-30");
  });
});
