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

export type JobRow = { id: string; company: string; role: string; status: string; applied: string | null; link: string };
export type EmailSummary = { id: string; receivedAt: string; sender: string; subject: string; bullets: string[]; tag: string; url?: string };
export type CalendarItem = { date: string; time: string | null; title: string; kind: string; location?: string };
export type Todo = { id: string; title: string; detail: string; due: string | null; sender: string; done: boolean; url: string | null };

export type ProfessionalData = {
  source: Source;
  updatedAt: string;
  jobs: { ok: boolean; message?: string; rows: JobRow[]; appliedThisWeek: number; weeklyTarget: number; active: number; toApply: number; responseRate: number | null };
  emails: { source: Source; items: EmailSummary[] };
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

export type Meal = { id: number; date: string; time: string; name: string; kcal: number; protein: number; carbs: number; fat: number };
export type NutritionData = {
  source: Source;
  updatedAt: string;
  date: string;
  meals: Meal[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
  targets: { kcal: number; protein: number; carbs: number; fat: number };
  week: { date: string; kcal: number }[];
};

export type PenthouseData = {
  today: string;
  sleep: SleepData;
  professional: ProfessionalData;
  fitness: FitnessData;
  nutrition: NutritionData;
};

export type ZoneDataKey = "sleep" | "professional" | "fitness" | "nutrition";
