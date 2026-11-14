/**
 * Payload contracts for the four zone panels.
 * Each one says where it came from, so the UI can label sample data honestly.
 *   live    → every number comes from your own data
 *   partial → some parts are live, the rest are placeholders
 *   sample  → nothing connected yet, showing a realistic example
 */
export type Source = "live" | "partial" | "sample";

export type SleepNight = {
  date: string;
  totalMin: number;
  deepMin: number | null;
  remMin: number | null;
  lightMin: number | null;
  awakeMin: number | null;
  recovery: number | null;
  hrv: number | null;
  rhr: number | null;
  bedtime: string | null;
  waketime: string | null;
};

export type SleepData = {
  source: Source;
  updatedAt: string;
  lastNight: SleepNight | null;
  week: { date: string; totalMin: number; recovery: number | null }[]; // oldest → newest
  targetMin: number;
};

export type CalendarItem = { date: string; time: string | null; title: string; kind: string; location?: string };
export type Todo = { id: string; title: string; detail: string; due: string | null; sender: string; done: boolean; url: string | null };

export type ProfessionalData = {
  source: Source;
  updatedAt: string;
  calendar: { source: Source; weekStart: string; items: CalendarItem[] }; // weekStart: Monday of this week; items cover 5 weeks from it
  todos: { source: Source; items: Todo[] };
};

export type FitnessData = {
  source: Source;
  updatedAt: string;
  week: { day: string; date: string; trained: boolean; ran: boolean; minutes: number }[]; // Mon → Sun
  lastWeek: { trained: boolean }[];
  sessionsThisWeek: number;
  sessionTarget: number;
  activeMinutes: number;
  activeTarget: number;
  minutesEstimated: boolean;
  streakWeeks: number;
  daysSinceLast: number | null;
  muscleSplit: { muscle: string; sets: number }[]; // sets per week, 4-week average
  sessionSplit: { kind: string; count: number }[]; // last 4 weeks
  topLifts: { name: string; top: string; change: number | null; status: string }[];
};

export type Meal = { id: number; date: string; time: string; name: string; kcal: number; protein: number; carbs: number; fat: number; cost: number | null; kind: "home" | "out" };
export type PantryItem = {
  id: number;
  name: string;
  place: "fridge" | "freezer" | "pantry";
  qty: number; // left, in unit
  qty_start: number;
  unit: "g" | "ml" | "item" | "serving";
  price: number; // paid for qty_start
  kcal_per: number; // per 100 g/ml, or per item/serving
  protein_per: number;
  carbs_per: number;
  fat_per: number;
  bought: string;
  use_by: string | null;
  size_guessed: boolean; // package size wasn't on the receipt
  daysLeft: number;
};
export type GroceryRun = { id: number; date: string; store: string; total: number; items: number; source: string };
export type NutritionData = {
  source: Source;
  updatedAt: string;
  date: string;
  meals: Meal[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
  targets: { kcal: number; protein: number; carbs: number; fat: number };
  week: { date: string; kcal: number; protein: number }[];
  pantry: PantryItem[]; // open items, use-soon first
  spend: { week: number; groceries: number; out: number; days: { date: string; groceries: number; out: number }[] }; // last 7 days
  costToday: number; // food eaten today with a known cost
  proteinPerDollar: number | null; // last 7 days, meals with a known cost
  receipts: boolean; // ANTHROPIC_API_KEY is set, so photo and typed input work
};

export type PenthouseData = {
  today: string;
  sleep: SleepData;
  professional: ProfessionalData;
  fitness: FitnessData;
  nutrition: NutritionData;
};

export type ZoneDataKey = "sleep" | "professional" | "fitness" | "nutrition";
