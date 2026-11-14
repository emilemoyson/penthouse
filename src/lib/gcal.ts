import ical, { type ParameterValue, type VEvent } from "node-ical";
import { addDays, parseISO, TZ } from "@/lib/dates";
import type { CalendarItem } from "@/penthouse/data/types";

/**
 * Google Calendar, read from its secret iCal address (GOOGLE_CALENDAR_ICS_URL).
 * Settings → the calendar → Integrate calendar → "Secret address in iCal format". Read-only, no OAuth.
 * Extra feeds (for example iCloud calendars published from the iPhone) go in EXTRA_CALENDAR_ICS_URLS, comma separated.
 * webcal:// links are accepted. One feed failing does not hide the others.
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

function feedUrls(): string[] {
  const all = [process.env.GOOGLE_CALENDAR_ICS_URL, ...(process.env.EXTRA_CALENDAR_ICS_URLS ?? "").split(",")];
  return all.map((u) => (u ?? "").trim().replace(/^webcal:\/\//i, "https://")).filter(Boolean);
}

export const googleCalendarEnabled = () => feedUrls().length > 0;

/** Events from `from` to `to` (YYYY-MM-DD, inclusive), recurring ones expanded. null when not set up or the fetch fails. */
export async function loadGoogleEvents(from: string, to: string): Promise<CalendarItem[] | null> {
  const urls = feedUrls();
  if (!urls.length) return null;
  const feeds = await Promise.all(urls.map((u) => loadFeed(u, from, to)));
  if (feeds.every((f) => f === null)) return null;
  const seen = new Set<string>();
  const items: CalendarItem[] = [];
  for (const feed of feeds) {
    // the same event can sit in two feeds (an invite on Google and on iCloud); two identical ones inside one feed both stay
    const fresh = (feed ?? []).filter((it) => !seen.has(`${it.date}|${it.time}|${it.title.toLowerCase()}`));
    for (const it of fresh) seen.add(`${it.date}|${it.time}|${it.title.toLowerCase()}`);
    items.push(...fresh);
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || sortTime(a.time) - sortTime(b.time));
}

async function loadFeed(url: string, from: string, to: string): Promise<CalendarItem[] | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) });
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
    return items;
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
