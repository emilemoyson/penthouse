import { addDays, lastNDays } from "@/lib/dates";
import type { EmailSummary, Meal, PantryItem, SleepNight } from "./types";

/* Realistic placeholders, shown (and labelled as samples) until a real source is connected. */

export function sampleSleep(today: string): { lastNight: SleepNight; week: { date: string; totalMin: number; recovery: number | null }[] } {
  const mins = [414, 444, 372, 468, 426, 492, 432];
  const rec = [71, 76, 58, 82, 74, 88, 78];
  const days = lastNDays(7, today);
  return {
    lastNight: {
      date: today,
      totalMin: 432,
      deepMin: 75,
      remMin: 98,
      lightMin: 238,
      awakeMin: 21,
      recovery: 78,
      hrv: 61,
      rhr: 52,
      bedtime: "23:48",
      waketime: "07:15",
    },
    week: days.map((d, i) => ({ date: d, totalMin: mins[i], recovery: rec[i] })),
  };
}

export function sampleEmails(today: string): EmailSummary[] {
  const at = (n: number, h: number) => `${addDays(today, -n)}T${String(h).padStart(2, "0")}:00:00Z`;
  return [
    { id: "s1", receivedAt: at(0, 14), sender: "Recruiting · Example Capital", subject: "Application received", tag: "Job", bullets: ["Application confirmed for the 2027 analyst role", "Online assessment link arrives within a week"] },
    { id: "s2", receivedAt: at(0, 11), sender: "Program office", subject: "Deadline reminder", tag: "Action", bullets: ["Short form due Friday", "Submit through the student portal"] },
    { id: "s3", receivedAt: at(1, 18), sender: "Student club", subject: "Event logistics", tag: "Club", bullets: ["Room confirmed", "Two volunteers needed for check-in from 6pm"] },
    { id: "s4", receivedAt: at(2, 9), sender: "Course platform", subject: "Weekly progress", tag: "School", bullets: ["Summary of this week's progress", "Next module due Sunday"] },
  ];
}

export function sampleMeals(today: string): Meal[] {
  return [
    { id: -1, date: today, time: "08:10", name: "Eggs, toast, Greek yogurt", kcal: 610, protein: 42, carbs: 48, fat: 24, cost: 2.1, kind: "home" },
    { id: -2, date: today, time: "12:45", name: "Chicken rice bowl", kcal: 720, protein: 52, carbs: 86, fat: 18, cost: 3.4, kind: "home" },
    { id: -3, date: today, time: "16:00", name: "Protein shake", kcal: 160, protein: 30, carbs: 4, fat: 2, cost: 1.3, kind: "home" },
    { id: -4, date: today, time: "19:30", name: "Burrito bowl", kcal: 880, protein: 46, carbs: 92, fat: 32, cost: 14.5, kind: "out" },
  ];
}

export function sampleKcalWeek(today: string) {
  const v = [2480, 2710, 2350, 2890, 2600, 2420, 2370];
  const p = [148, 172, 131, 181, 160, 152, 170];
  return lastNDays(7, today).map((d, i) => ({ date: d, kcal: v[i], protein: p[i] }));
}

export function sampleSpend(today: string) {
  const g = [0, 0, 64.2, 0, 0, 18.4, 0];
  const o = [16.5, 0, 0, 22, 0, 0, 14.5];
  const days = lastNDays(7, today).map((date, i) => ({ date, groceries: g[i], out: o[i] }));
  const groceries = g.reduce((a, b) => a + b, 0);
  const out = o.reduce((a, b) => a + b, 0);
  return { week: groceries + out, groceries, out, days };
}

export function samplePantry(today: string): PantryItem[] {
  const item = (id: number, name: string, place: PantryItem["place"], qty: number, qty_start: number, unit: PantryItem["unit"], price: number, m: [number, number, number, number], daysLeft: number): PantryItem => ({
    id,
    name,
    place,
    qty,
    qty_start,
    unit,
    price,
    kcal_per: m[0],
    protein_per: m[1],
    carbs_per: m[2],
    fat_per: m[3],
    bought: addDays(today, -2),
    use_by: addDays(today, daysLeft),
    daysLeft,
  });
  return [
    item(-1, "Chicken thighs", "fridge", 520, 907, "g", 9.4, [177, 24, 0, 9], 1),
    item(-2, "Spinach", "fridge", 140, 283, "g", 3.49, [23, 3, 4, 0], 2),
    item(-3, "Eggs", "fridge", 8, 12, "item", 4.99, [72, 6, 0, 5], 18),
    item(-4, "Greek yogurt, 0%", "fridge", 600, 907, "g", 5.99, [59, 10, 4, 0], 12),
    item(-5, "Ground beef 90/10", "freezer", 454, 454, "g", 6.99, [176, 20, 0, 10], 80),
    item(-6, "Jasmine rice", "pantry", 1600, 2268, "g", 6.49, [365, 7, 80, 1], 170),
    item(-7, "Whey protein", "pantry", 22, 30, "serving", 39.99, [120, 24, 3, 1], 160),
  ];
}
