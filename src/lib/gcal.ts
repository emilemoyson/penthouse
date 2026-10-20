import ical, { type ParameterValue, type VEvent } from "node-ical";
import { addDays, parseISO, TZ } from "@/lib/dates";
import type { CalendarItem } from "@/penthouse/data/types";

/**
 * Google Calendar, read from its secret iCal address (GOOGLE_CALENDAR_ICS_URL).
 * Settings → the calendar → Integrate calendar → "Secret address in iCal format". Read-only, no OAuth.
 * The kind comes from a #meeting / #school / #deadline / #personal tag in the description (the hourly email task writes it).
 */

const KINDS = ["meeting", "school", "deadline", "personal"] as const;

const text = (v: ParameterValue | undefined) => (typeof v === "string" ? v : (v?.val ?? ""));

const dayIn = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
/** All-day dates come back as local midnight (or midnight in their own tz), so read the day the same way. */
const fullDay = (d: Date & { tz?: string }) =>
  d.tz ? dayIn(d, d.tz) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const timeIn = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d);

function kindOf(description: string): string {
  const tag = description.match(/#(meeting|school|deadline|personal)\b/i)?.[1]?.toLowerCase();
  return tag && (KINDS as readonly string[]).includes(tag) ? tag : "personal";
}

export const googleCalendarEnabled = () => Boolean(process.env.GOOGLE_CALENDAR_ICS_URL);

/** Events from `from` to `to` (YYYY-MM-DD, inclusive), recurring ones expanded. null when not set up or the fetch fails. */
export async function loadGoogleEvents(from: string, to: string): Promise<CalendarItem[] | null> {
  const url = process.env.GOOGLE_CALENDAR_ICS_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = ical.sync.parseICS(await res.text());
    // pad the window by a day each side, then filter on the New York date
    const start = parseISO(addDays(from, -1));
    const end = parseISO(addDays(to, 2));
    const items: CalendarItem[] = [];
    for (const c of Object.values(data)) {
      if (!c || c.type !== "VEVENT") continue;
      const ev = c as VEvent;
      if (ev.status === "CANCELLED") continue;
      for (const inst of ical.expandRecurringEvent(ev, { from: start, to: end })) {
        // all-day dates keep their own day; timed events are shown in New York time
        const date = inst.isFullDay ? fullDay(inst.start) : dayIn(inst.start, TZ);
        if (date < from || date > to) continue;
        const e = inst.event;
        items.push({
          date,
          time: inst.isFullDay ? null : timeIn(inst.start),
          title: text(inst.summary) || "(no title)",
          kind: kindOf(text(e.description)),
          location: text(e.location) || undefined,
        });
      }
    }
    return items.sort((a, b) => a.date.localeCompare(b.date) || sortTime(a.time) - sortTime(b.time));
  } catch {
    return null;
  }
}

/** Minutes after midnight for "3:00 PM"; all-day first. */
function sortTime(t: string | null) {
  const m = t?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return -1;
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(m[2]);
}
