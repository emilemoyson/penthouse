import { create } from "zustand";
import * as THREE from "three";
import type { PenthouseData } from "./data/types";
import type { ZoneId } from "./store";

/**
 * Ambient state: the studio shows how the day is going without numbers.
 *   office lamp  dims as to-dos clear
 *   bed          unmade after a short night
 *   kitchen      shelves empty as the pantry runs low
 *   gym          glows on a training day
 *   windows      follow New York time of day (see skyAt)
 * The numbers themselves live on the classic Today page.
 */
export type Ambient = {
  officeLight: number; // 0.25 (nothing open) → 1 (six or more open)
  bedUnmade: boolean;
  pantryFill: number; // 0 → 1
  trainedToday: boolean;
};

export const useAmbient = create<Ambient>(() => ({ officeLight: 1, bedUnmade: false, pantryFill: 1, trainedToday: false }));

export function ambientFrom(d: PenthouseData): Ambient {
  const open = d.professional.todos.items.filter((t) => !t.done).length;
  const night = d.sleep.lastNight;
  const day = d.fitness.week.find((w) => w.date === d.today);
  return {
    officeLight: 0.25 + 0.75 * Math.min(1, open / 6),
    bedUnmade: !!night && night.totalMin < d.sleep.targetMin - 45,
    pantryFill: Math.min(1, d.nutrition.pantry.length / 14),
    trainedToday: !!day && (day.trained || day.ran),
  };
}

const hm = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}`;

/** One plain line per room for the studio card. The details are on the Today page. */
export function statusLine(zone: ZoneId, d: PenthouseData): string {
  if (zone === "bed") {
    const n = d.sleep.lastNight;
    if (!n) return "No sleep logged for last night.";
    const short = n.totalMin < d.sleep.targetMin - 45;
    return `${hm(n.totalMin)} last night${short ? ", short of your goal" : ""}${n.recovery != null ? `, recovery ${n.recovery}%` : ""}.`;
  }
  if (zone === "desk") {
    const open = d.professional.todos.items.filter((t) => !t.done);
    const next = d.professional.calendar.items.filter((e) => e.date === d.today);
    const todos = open.length === 0 ? "Nothing open" : `${open.length} open to-do${open.length === 1 ? "" : "s"}`;
    const cal = next.length === 0 ? "a clear calendar" : `${next.length} thing${next.length === 1 ? "" : "s"} on the calendar`;
    return `${todos}, ${cal} today.`;
  }
  if (zone === "gym") {
    const f = d.fitness;
    const last = f.daysSinceLast == null ? "no sessions yet" : f.daysSinceLast === 0 ? "trained today" : `last session ${f.daysSinceLast}d ago`;
    return `${f.sessionsThisWeek} of ${f.sessionTarget} sessions this week, ${last}.`;
  }
  const n = d.nutrition;
  const pct = n.targets.kcal ? Math.round((n.totals.kcal / n.targets.kcal) * 100) : 0;
  const soon = n.pantry.filter((p) => p.daysLeft <= 3).length;
  return `${pct}% of today's calories, ${Math.round(n.totals.protein)} g protein${soon ? `, ${soon} thing${soon === 1 ? "" : "s"} to use soon` : ""}.`;
}

/* ---------------------------------------------------------------------- */
/* Time of day                                                             */
/* ---------------------------------------------------------------------- */

/** Hour in New York as a fraction (14.5 = 2:30 pm). `?hour=14` in the URL overrides it, for demos. */
export function nyHour(): number {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("hour");
    if (q != null && !Number.isNaN(Number(q))) return ((Number(q) % 24) + 24) % 24;
  }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const NIGHT = new THREE.Color("#9fb2ff");
const GOLD = new THREE.Color("#ffad6b");
const NOON = new THREE.Color("#fff3e0");
const HAZE_DAY = new THREE.Color("#a9c4e0");
const HAZE_GOLD = new THREE.Color("#e8946a");

/**
 * Light through the glass for an hour of the day.
 * day: 0 at night, 1 at midday. golden: how much of a sunrise or sunset glow there is.
 */
export function skyAt(h: number) {
  const day = smooth(5.5, 8, h) * (1 - smooth(17, 19.5, h));
  const golden = Math.max(0, 1 - Math.abs(h - 6.8) / 1.4) + Math.max(0, 1 - Math.abs(h - 18.3) / 1.4);
  const g = Math.min(1, golden);
  const sun = NIGHT.clone().lerp(NOON, day).lerp(GOLD, g * 0.8);
  const haze = HAZE_DAY.clone().lerp(HAZE_GOLD, g);
  return {
    day,
    golden: g,
    sunColor: sun,
    sunIntensity: 0.3 + day * 2.2 + g * 0.6,
    ambient: day * 0.35,
    haze,
    hazeOpacity: Math.min(0.78, day * 0.72 + g * 0.35),
  };
}
