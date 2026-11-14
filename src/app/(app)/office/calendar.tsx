"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import type { CalendarItem } from "@/penthouse/data/types";
import { addDays, fDay, fDow, fMonth } from "@/lib/dates";

// Colours follow the #kind tag the email task writes into each event.
const KIND: Record<string, { label: string; bar: string; soft: string }> = {
  meeting: { label: "Meeting", bar: "var(--s1)", soft: "color-mix(in srgb, var(--s1) 14%, var(--surface))" },
  school: { label: "School", bar: "var(--s2)", soft: "color-mix(in srgb, var(--s2) 16%, var(--surface))" },
  deadline: { label: "Deadline", bar: "var(--bad)", soft: "color-mix(in srgb, var(--bad) 13%, var(--surface))" },
  personal: { label: "Personal", bar: "var(--s3)", soft: "color-mix(in srgb, var(--s3) 18%, var(--surface))" },
};
const kindOf = (k: string) => KIND[k] ?? KIND.personal;

const START_H = 7;
const END_H = 24;
const ROW = 38; // px per hour

/** "3:30 PM" -> minutes after midnight */
function minutes(t: string | null): number | null {
  const m = t?.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + Number(m[2]);
}

type Placed = CalendarItem & { top: number; lane: number; lanes: number };

/** Lays out one day's timed events; events without an end time get an hour, overlapping ones share the width. */
function place(items: CalendarItem[]): Placed[] {
  const timed = items
    .map((e) => ({ e, m: minutes(e.time)! }))
    .sort((a, b) => a.m - b.m);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1));
    cluster.forEach((p) => (p.lanes = lanes));
    out.push(...cluster);
    cluster = [];
  };
  for (const { e, m } of timed) {
    if (m >= clusterEnd) flush();
    const used = new Set(cluster.filter((p) => p.top + 60 > m).map((p) => p.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...e, top: m, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, m + 60);
  }
  flush();
  return out;
}

export function WeekCalendar({ items, weekStart, today }: { items: CalendarItem[]; weekStart: string; today: string }) {
  const [view, setView] = useState<"week" | "month">("week");
  const [week, setWeek] = useState(0); // 0..4, the feed covers five weeks from this Monday
  const [open, setOpen] = useState<CalendarItem | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // Open the week at 8 am, or an hour before now if later in the day
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const h = Math.max(8, Math.min(END_H - 6, new Date().getHours() - 1));
    el.scrollTop = (h - START_H) * ROW;
  }, [view]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const e of items) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [items]);

  const start = addDays(weekStart, week * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const rangeLabel =
    view === "week"
      ? `${fMonth(days[0])} ${fDay(days[0])} to ${fMonth(days[6]) === fMonth(days[0]) ? "" : fMonth(days[6]) + " "}${fDay(days[6])}`
      : `${fMonth(weekStart)} ${fDay(weekStart)} to ${fMonth(addDays(weekStart, 34))} ${fDay(addDays(weekStart, 34))}`;
  const nowMin = (() => {
    const p = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: false, timeZone: "America/New_York" }).formatToParts(new Date());
    return Number(p.find((x) => x.type === "hour")?.value) * 60 + Number(p.find((x) => x.type === "minute")?.value);
  })();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <div className="flex items-center">
            <button
              className="inline-flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-30"
              onClick={() => setWeek((w) => Math.max(0, w - 1))}
              disabled={view === "month" || week === 0}
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="inline-flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-30"
              onClick={() => setWeek((w) => Math.min(4, w + 1))}
              disabled={view === "month" || week === 4}
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="font-serif text-[17px] font-medium">{rangeLabel}</div>
          {view === "week" && week !== 0 && (
            <button onClick={() => setWeek(0)} className="rounded-lg border border-line px-2.5 py-1 text-[12.5px] text-ink-2 hover:bg-surface-2">
              This week
            </button>
          )}
          <div className="ml-auto flex rounded-lg border border-line bg-surface-2 p-0.5 text-[12.5px] font-medium">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={clsx("tab-link rounded-md px-2.5 py-1 capitalize", view === v ? "bg-surface text-ink shadow-[var(--shadow)]" : "text-ink-3 hover:text-ink")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {view === "week" ? (
          <>
          <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
            {/* day headers */}
            <div />
            {days.map((d) => (
              <div key={d} className={clsx("border-l border-line px-2 pb-1.5 pt-2 text-center", d === today && "bg-accent-soft/50")}>
                <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">{fDow(d)}</div>
                <div className={clsx("mx-auto mt-0.5 grid size-7 place-items-center rounded-full font-serif text-[16px] tnum", d === today && "bg-accent text-white")}>
                  {fDay(d)}
                </div>
              </div>
            ))}
            {/* all-day row */}
            <div className="border-t border-line pr-2 pt-1 text-right text-[10.5px] text-ink-3">all day</div>
            {days.map((d) => (
              <div key={d} className="min-h-7 space-y-0.5 border-l border-t border-line p-0.5">
                {(byDay.get(d) ?? [])
                  .filter((e) => minutes(e.time) == null)
                  .map((e, i) => (
                    <Chip key={i} e={e} onClick={() => setOpen(e)} />
                  ))}
              </div>
            ))}
          </div>
          <div ref={scroller} className="grid max-h-[calc(100dvh-330px)] min-h-[300px] grid-cols-[52px_repeat(7,minmax(0,1fr))] overflow-y-auto [scrollbar-width:thin]">
            {/* hour grid */}
            <div className="relative border-t border-line" style={{ height: (END_H - START_H) * ROW }}>
              {Array.from({ length: END_H - START_H }, (_, i) => (
                <div key={i} className="absolute right-2 -translate-y-1/2 text-[10.5px] text-ink-3 tnum" style={{ top: i * ROW }}>
                  {i === 0 ? "" : `${((START_H + i + 11) % 12) + 1} ${START_H + i < 12 ? "am" : "pm"}`}
                </div>
              ))}
            </div>
            {days.map((d) => (
              <div
                key={d}
                className={clsx("relative border-l border-t border-line", d === today && "bg-accent-soft/25")}
                style={{
                  height: (END_H - START_H) * ROW,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW - 1}px, var(--grid) ${ROW - 1}px, var(--grid) ${ROW}px)`,
                }}
              >
                {d === today && nowMin >= START_H * 60 && nowMin <= END_H * 60 && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 h-px bg-accent" style={{ top: ((nowMin - START_H * 60) / 60) * ROW }}>
                    <span className="absolute -left-1 -top-1 size-2 rounded-full bg-accent" />
                  </div>
                )}
                {place((byDay.get(d) ?? []).filter((e) => minutes(e.time) != null)).map((e, i) => {
                  const k = kindOf(e.kind);
                  const top = Math.max(0, Math.min((END_H - START_H) * 60 - 30, e.top - START_H * 60));
                  return (
                    <button
                      key={i}
                      onClick={() => setOpen(e)}
                      className="card-lift absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left hover:brightness-95"
                      style={{
                        top: (top / 60) * ROW + 1,
                        height: ROW - 3,
                        left: `calc(${(e.lane / e.lanes) * 100}% + 2px)`,
                        width: `calc(${100 / e.lanes}% - 4px)`,
                        background: k.soft,
                        borderColor: k.bar,
                      }}
                    >
                      <div className="truncate text-[11.5px] font-medium leading-tight">{e.title}</div>
                      <div className="truncate text-[10.5px] text-ink-3 tnum">{e.time}</div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          </>
        ) : (
          <div className="grid grid-cols-7">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="border-l border-line px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3 first:border-l-0">
                {d}
              </div>
            ))}
            {Array.from({ length: 35 }, (_, i) => addDays(weekStart, i)).map((d, i) => {
              const list = byDay.get(d) ?? [];
              return (
                <div key={d} style={{ height: "max(86px, calc((100dvh - 395px) / 5))" }} className={clsx("overflow-hidden border-t border-line p-1.5", i % 7 && "border-l", d === today && "bg-accent-soft/40", d < today && "opacity-55")}>
                  <div className={clsx("mb-1 inline-grid size-6 place-items-center rounded-full text-[12px] tnum", d === today ? "bg-accent text-white" : "text-ink-2")}>
                    {fDay(d)}
                  </div>
                  {fDay(d) === 1 && <span className="ml-1 text-[11px] text-ink-3">{fMonth(d)}</span>}
                  <div className="space-y-0.5">
                    {list.slice(0, 3).map((e, j) => (
                      <Chip key={j} e={e} onClick={() => setOpen(e)} />
                    ))}
                    {list.length > 3 && <div className="px-1 text-[11px] text-ink-3">+{list.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <aside className="flex min-w-0 flex-col gap-4">
        {open ? <Detail e={open} onClose={() => setOpen(null)} /> : <Agenda byDay={byDay} today={today} onPick={setOpen} />}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <div className="mb-2 text-[12px] font-medium text-ink-3">Colours</div>
          <div className="grid grid-cols-2 gap-1.5 text-[12.5px]">
            {Object.entries(KIND).map(([id, k]) => (
              <div key={id} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: k.bar }} />
                {k.label}
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[11.5px] leading-snug text-ink-3">From the #meeting, #school, #deadline or #personal tag the email task adds.</p>
        </div>
      </aside>
    </div>
  );
}

function Chip({ e, onClick }: { e: CalendarItem; onClick: () => void }) {
  const k = kindOf(e.kind);
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:brightness-95"
      style={{ background: k.soft }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: k.bar }} />
      {e.time && <span className="shrink-0 text-ink-3 tnum">{e.time.replace(":00", "").replace(" ", "").toLowerCase()}</span>}
      <span className="truncate">{e.title}</span>
    </button>
  );
}

function Agenda({ byDay, today, onPick }: { byDay: Map<string, CalendarItem[]>; today: string; onPick: (e: CalendarItem) => void }) {
  const next = [today, addDays(today, 1)];
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
      {next.map((d, i) => {
        const list = byDay.get(d) ?? [];
        return (
          <div key={d} className={clsx(i && "mt-4")}>
            <div className="mb-1.5 font-serif text-[16px] font-medium">{i === 0 ? "Today" : "Tomorrow"}</div>
            {list.length === 0 ? (
              <div className="text-[13px] text-ink-3">Nothing scheduled.</div>
            ) : (
              <ul className="space-y-1">
                {list.map((e, j) => (
                  <li key={j}>
                    <button onClick={() => onPick(e)} className="flex w-full items-baseline gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-surface-2">
                      <span className="w-14 shrink-0 text-[12px] text-ink-3 tnum">{e.time ?? "All day"}</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">{e.title}</span>
                      <span className="size-2 shrink-0 self-center rounded-full" style={{ background: kindOf(e.kind).bar }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Detail({ e, onClose }: { e: CalendarItem; onClose: () => void }) {
  const k = kindOf(e.kind);
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(e.date + "T12:00:00Z"));
  const mapHref = e.location && !/^https?:/i.test(e.location) ? `https://maps.apple.com/?q=${encodeURIComponent(e.location)}` : e.location;
  return (
    <div className="fade-in rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]" style={{ borderTop: `3px solid ${k.bar}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11.5px] font-medium uppercase tracking-[0.12em]" style={{ color: k.bar }}>
          {k.label}
        </div>
        <button onClick={onClose} className="-m-1 rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close">
          <X size={15} />
        </button>
      </div>
      <h3 className="mt-1 font-serif text-[19px] font-medium leading-snug">{e.title}</h3>
      <div className="mt-2 text-[13px] text-ink-2">
        {day}
        {e.time ? `, ${e.time}` : ", all day"}
      </div>
      {e.location && (
        <a href={mapHref} target="_blank" rel="noreferrer" className="mt-2 flex items-start gap-1.5 text-[13px] text-accent-ink hover:underline">
          <MapPin size={14} className="mt-0.5 shrink-0" />
          <span className="break-words">{e.location}</span>
        </a>
      )}
    </div>
  );
}
