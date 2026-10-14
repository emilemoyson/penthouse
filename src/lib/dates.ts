export const TZ = "America/New_York";

/** Today's date (YYYY-MM-DD) in New York, regardless of where the server runs. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(s: string, n: number): string {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 864e5);
}
/** Monday of the week containing s. */
export function mondayOf(s: string): string {
  const d = parseISO(s);
  const w = (d.getUTCDay() + 6) % 7;
  return addDays(s, -w);
}
export function lastNWeeks(n: number, today = todayISO()): string[] {
  const m = mondayOf(today);
  return Array.from({ length: n }, (_, i) => addDays(m, -7 * (n - 1 - i)));
}
export function lastNDays(n: number, today = todayISO()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)));
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const fShort = (s: string) => {
  const d = parseISO(s);
  return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
export const fDow = (s: string) => DOW[parseISO(s).getUTCDay()];
export const fLong = (s: string) =>
  parseISO(s).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
export const fMonth = (s: string) => MON[parseISO(s).getUTCMonth()];
export const fDay = (s: string) => parseISO(s).getUTCDate();

export function relDay(s: string, today = todayISO()): string {
  const n = daysBetween(today, s);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${-n} days ago`;
  return `In ${n} days`;
}

/** Parse "Oct 13 2026" / "13 Oct 2026" / "2026-10-13" into ISO, or null. */
export function looseDate(v: string | undefined | null): string | null {
  if (!v) return null;
  const t = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (m) {
    const mi = MON.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(t);
  if (!isNaN(d.getTime())) return toISO(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
  return null;
}
