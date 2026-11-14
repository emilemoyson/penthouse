"use client";

import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, ListTodo, RefreshCw, type LucideIcon } from "lucide-react";
import type { FitnessData, ProfessionalData, SleepData, Source } from "../data/types";
import { useFitnessData, useProfessionalData, useSleepData } from "../data/hooks";
import { toggleTodo } from "../data/actions";
import { Bar, Columns, GlassCard, Metric, Pill, Ring } from "./glass";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (s: string | null) => (s ? `${MON[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}` : "–");
export const dow = (s: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(s + "T12:00:00Z").getUTCDay()];
export const nyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const plusDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const hm = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m`;

/* ---------------------------------------------------------------------- */
/* shared                                                                  */
/* ---------------------------------------------------------------------- */

export function SourceBar({ source, hint, loading, onRefresh }: { source: Source; hint: string; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {source === "live" ? (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-emerald-300/90">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          Live
        </span>
      ) : (
        <span className="rounded-full border border-dashed border-white/20 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-white/45">
          {source === "partial" ? "Partly live" : "Sample data"} · {hint}
        </span>
      )}
      <button onClick={onRefresh} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-white/40 transition hover:bg-white/10 hover:text-white" aria-label="Refresh">
        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
      </button>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; icon: LucideIcon }[] }) {
  return (
    <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-black/20 p-1">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12.5px] font-medium transition",
            value === t.id ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "text-white/55 hover:text-white",
          )}
        >
          <t.icon size={13} /> {t.label}
        </button>
      ))}
    </div>
  );
}

/* ====================================================================== */
/* 🛏️ Bed Station → useSleepData                                          */
/* ====================================================================== */

export function SleepPanel({ initial }: { initial: SleepData }) {
  const { data, loading, refresh } = useSleepData(initial);
  const n = data.lastNight;
  const stages = n
    ? [
        { k: "Deep", v: n.deepMin, c: "#6250d6" },
        { k: "REM", v: n.remMin, c: "#3987e5" },
        { k: "Light", v: n.lightMin, c: "#86b6ef" },
        { k: "Awake", v: n.awakeMin, c: "#f2a53a" },
      ].filter((s): s is { k: string; v: number; c: string } => s.v != null)
    : [];
  const stageTotal = stages.reduce((a, s) => a + s.v, 0);
  return (
    <div className="space-y-3">
      <SourceBar source={data.source} hint="send nights to /api/ingest/sleep" loading={loading} onRefresh={refresh} />
      {n ? (
        <>
          <div className="grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
            <Ring value={(n.recovery ?? 0) / 100} color="#f2a53a" size={118}>
              <div>
                <div className="text-[30px] font-semibold leading-none tnum">{n.recovery ?? "–"}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/50">Recovery</div>
              </div>
            </Ring>
            <div>
              <div className="text-[12px] text-white/50">{n.date === data.week[data.week.length - 1]?.date ? "Last night" : short(n.date)}</div>
              <div className="text-[30px] font-semibold tracking-tight tnum">{hm(n.totalMin)}</div>
              <div className="mt-0.5 text-[12.5px] text-white/55">
                {n.bedtime && n.waketime ? `${n.bedtime} → ${n.waketime}` : "Bed and wake times not sent"}
                {n.remMin != null && ` · ${Math.round((n.remMin / n.totalMin) * 100)}% REM`}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {n.hrv != null && <Pill tone="good">HRV {n.hrv} ms</Pill>}
                {n.rhr != null && <Pill>Resting HR {n.rhr}</Pill>}
                <Pill tone={n.totalMin >= data.targetMin ? "good" : "warn"}>{n.totalMin >= data.targetMin ? "Target met" : `${hm(data.targetMin - n.totalMin)} short`}</Pill>
              </div>
            </div>
          </div>
          {stages.length > 0 && (
            <GlassCard title="Sleep cycles">
              <div className="flex h-3 overflow-hidden rounded-full">
                {stages.map((x) => (
                  <div key={x.k} style={{ width: `${(x.v / stageTotal) * 100}%`, background: x.c }} className="border-r-2 border-[#100e18] last:border-0" title={`${x.k}: ${hm(x.v)}`} />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-[12px]">
                {stages.map((x) => (
                  <div key={x.k}>
                    <div className="flex items-center gap-1.5 text-white/55">
                      <span className="size-2 rounded-[2px]" style={{ background: x.c }} />
                      {x.k}
                    </div>
                    <div className="mt-0.5 font-medium tnum">{hm(x.v)}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </>
      ) : (
        <GlassCard>No nights logged yet.</GlassCard>
      )}
      <GlassCard title="Last 7 nights" right={<span className="text-[11px] text-white/40">target {hm(data.targetMin)}</span>}>
        <Columns values={data.week.map((w) => +(w.totalMin / 60).toFixed(2))} labels={data.week.map((w) => dow(w.date))} color="#f2a53a" target={data.targetMin / 60} format={(v) => hm(v * 60)} />
      </GlassCard>
    </div>
  );
}

/* ====================================================================== */
/* 🖥️ Office Command → useProfessionalData                                 */
/* ====================================================================== */

export function ProfessionalPanel({ initial }: { initial: ProfessionalData }) {
  const { data, loading, refresh, setData } = useProfessionalData(initial);
  const [tab, setTab] = useState<"todo" | "calendar">("todo");
  const openTodos = data.todos.items.filter((t) => !t.done).length;
  return (
    <div className="space-y-3">
      <SourceBar source={data.source} hint="calendar or to-dos not connected" loading={loading} onRefresh={refresh} />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "todo", label: `To-do${openTodos ? ` · ${openTodos}` : ""}`, icon: ListTodo },
          { id: "calendar", label: "Calendar", icon: CalendarDays },
        ]}
      />
      {tab === "todo" && <TodoList items={data.todos.items} onChange={setData} />}
      {tab === "calendar" && (
        <div className="space-y-3">
          <ComingUp items={data.calendar.items} />
          <WeekCalendar weekStart={data.calendar.weekStart} items={data.calendar.items} />
        </div>
      )}
    </div>
  );
}

/** Whole days from today to a date: negative = past. */
const daysFrom = (today: string, iso: string) => Math.round((Date.parse(iso + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000);
const relDay = (n: number) => (n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : n > 0 ? `In ${n} days` : `${-n} days ago`);

type TodoItem = ProfessionalData["todos"]["items"][number];

function TodoList({ items, onChange }: { items: TodoItem[]; onChange: (d: ProfessionalData) => void }) {
  const [pending, start] = useTransition();
  if (!items.length) return <GlassCard>Nothing to do right now. New items appear after the hourly email task runs.</GlassCard>;
  const today = nyToday();
  const open = items.filter((t) => !t.done);
  type Group = { key: string; title: string; tone: "bad" | "warn" | "neutral"; list: TodoItem[] };
  const groups: Group[] = ([
    { key: "over", title: "Overdue", tone: "bad", list: open.filter((t) => t.due && t.due < today) },
    { key: "today", title: "Today", tone: "warn", list: open.filter((t) => t.due === today) },
    { key: "week", title: "Next 7 days", tone: "neutral", list: open.filter((t) => t.due && t.due > today && daysFrom(today, t.due) <= 7) },
    { key: "later", title: "Later", tone: "neutral", list: open.filter((t) => t.due && daysFrom(today, t.due) > 7) },
    { key: "none", title: "No date", tone: "neutral", list: open.filter((t) => !t.due) },
    { key: "done", title: "Done", tone: "neutral", list: items.filter((t) => t.done) },
  ] as Group[]).filter((g) => g.list.length);
  return (
    <div className={clsx("max-h-[400px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]", pending && "opacity-70")}>
      {groups.map((g) => (
        <section key={g.key}>
          <h4 className={clsx("mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider", g.tone === "bad" ? "text-rose-300" : g.tone === "warn" ? "text-amber-200" : "text-white/45")}>
            {g.title}
            <span className="rounded-full bg-white/10 px-1.5 text-[10.5px] text-white/60 tnum">{g.list.length}</span>
          </h4>
          <ul className="space-y-1.5">
            {g.list.map((t) => {
              const n = t.due ? daysFrom(today, t.due) : null;
              return (
                <li key={t.id} className={clsx("flex gap-3 rounded-2xl border bg-white/[0.04] p-3", g.key === "over" ? "border-rose-300/30" : "border-white/[0.08]")}>
                  <button
                    onClick={() => start(async () => onChange(await toggleTodo(t.id, !t.done)))}
                    className={clsx(
                      "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-md border transition",
                      t.done ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-300" : "border-white/25 hover:border-white/50",
                    )}
                    aria-label={t.done ? "Mark as not done" : "Mark as done"}
                  >
                    {t.done && <Check size={12} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={clsx("text-[13px] leading-snug", t.done && "text-white/40 line-through")}>{t.title}</div>
                    {(t.detail || t.sender) && (
                      <div className="mt-0.5 text-[11.5px] text-white/40">
                        {t.sender}
                        {t.sender && t.detail ? " · " : ""}
                        {t.detail}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {t.due && !t.done && n !== null && <Pill tone={n < 0 ? "warn" : n <= 1 ? "accent" : "neutral"}>{n < 0 ? `${-n}d late` : n === 0 ? "Today" : n === 1 ? "Tomorrow" : short(t.due)}</Pill>}
                    {t.url && (
                      <a href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-sky-300/80 hover:text-sky-200" aria-label="Open the email">
                        Email <ArrowUpRight size={11} />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The next few things on the calendar, deadlines marked. */
function ComingUp({ items }: { items: ProfessionalData["calendar"]["items"] }) {
  const today = nyToday();
  const next = items.filter((e) => e.date >= today && daysFrom(today, e.date) <= 14).slice(0, 6);
  return (
    <GlassCard title="Coming up" right={<span className="text-[11px] text-white/40">next 14 days</span>}>
      {next.length ? (
        <ul className="space-y-1.5">
          {next.map((e, i) => (
            <li key={e.date + e.title + i} className="flex items-center gap-3 text-[12.5px]">
              <span className="w-[74px] shrink-0 text-white/50">{relDay(daysFrom(today, e.date))}</span>
              <span className="w-14 shrink-0 text-white/40 tnum">{e.time || "All day"}</span>
              <span className="min-w-0 flex-1 truncate text-white/90">{e.title}</span>
              {e.kind === "deadline" && <Pill tone="warn">Due</Pill>}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[12px] text-white/35">Nothing in the next two weeks.</span>
      )}
    </GlassCard>
  );
}

const KIND_LABEL: Record<string, string> = { school: "IE NYC", meeting: "Meeting", deadline: "Deadline", personal: "Personal" };

/** Monday → Sunday of one week, each day with what's on. ‹ › move between the 5 loaded weeks. */
function WeekCalendar({ weekStart, items }: { weekStart: string; items: ProfessionalData["calendar"]["items"] }) {
  const [offset, setOffset] = useState(0);
  const today = nyToday();
  const monday = plusDays(weekStart, offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => plusDays(monday, i));
  const byDay = useMemo(() => {
    const m = new Map<string, typeof items>();
    for (const it of items) m.set(it.date, [...(m.get(it.date) || []), it]);
    return m;
  }, [items]);
  const label = offset === 0 ? "This week" : offset === 1 ? "Next week" : `${short(days[0])} – ${short(days[6])}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} className="grid size-7 place-items-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-25" aria-label="Previous week">
          <ChevronLeft size={15} />
        </button>
        <div className="text-center leading-tight">
          <div className="text-[13px] font-medium">{label}</div>
          <div className="text-[11px] text-white/40">
            {short(days[0])} – {short(days[6])}
          </div>
        </div>
        <button onClick={() => setOffset((o) => Math.min(4, o + 1))} disabled={offset === 4} className="grid size-7 place-items-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-25" aria-label="Next week">
          <ChevronRight size={15} />
        </button>
      </div>
      <ul className="space-y-1">
        {days.map((d) => {
          const list = byDay.get(d) || [];
          const isToday = d === today;
          const past = d < today;
          return (
            <li
              key={d}
              className={clsx(
                "flex gap-3 rounded-xl border px-3 py-2",
                isToday ? "border-[#47dcff]/40 bg-[#47dcff]/[0.08]" : "border-white/[0.06] bg-white/[0.03]",
                past && "opacity-50",
              )}
            >
              <div className="w-10 shrink-0 leading-tight">
                <div className={clsx("text-[10.5px] font-medium uppercase tracking-wider", isToday ? "text-[#47dcff]" : "text-white/40")}>{dow(d)}</div>
                <div className="text-[16px] font-semibold tnum">{Number(d.slice(8, 10))}</div>
              </div>
              <div className="min-w-0 flex-1 self-center">
                {isToday && <div className="mb-1"><Pill tone="accent">Today</Pill></div>}
                {list.length ? (
                  <ul className="space-y-1">
                    {list.map((e, i) => (
                      <li key={e.title + i} className="flex gap-2 text-[12.5px] leading-snug">
                        <span className="w-14 shrink-0 text-white/45 tnum">{e.time || "All day"}</span>
                        <span className="min-w-0">
                          <span className="text-white/90">{e.title}</span>
                          <span className="text-white/35"> · {e.location || KIND_LABEL[e.kind] || "Personal"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[12px] text-white/25">Free</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ====================================================================== */
/* 🏋️ Gym Zone → useFitnessData                                            */
/* ====================================================================== */

export function FitnessPanel({ initial }: { initial: FitnessData }) {
  const { data, loading, refresh } = useFitnessData(initial);
  const maxSets = Math.max(22, ...data.muscleSplit.map((m) => m.sets));
  return (
    <div className="space-y-3">
      <SourceBar source={data.source} hint="log a workout in Training" loading={loading} onRefresh={refresh} />
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Sessions this week" value={data.sessionsThisWeek} unit={`/ ${data.sessionTarget}`} accent="#9b84ff" />
        <Metric label="Active minutes" value={data.activeMinutes} unit={`/ ${data.activeTarget}`} sub={data.minutesEstimated ? "some estimated from sets" : undefined} />
        <Metric label="Week streak" value={data.streakWeeks} unit="wks" sub={data.daysSinceLast != null ? `last session ${data.daysSinceLast}d ago` : undefined} />
      </div>
      <GlassCard title="Weekly frequency">
        <div className="grid grid-cols-7 gap-1.5">
          {data.week.map((d, i) => (
            <div key={d.date} className="text-center">
              <div className="mb-1 text-[10.5px] uppercase tracking-wider text-white/40">{d.day.slice(0, 2)}</div>
              <div
                className={clsx(
                  "flex h-12 flex-col items-center justify-center rounded-lg text-[11px] font-medium tnum transition",
                  d.trained ? "bg-[#9b84ff] text-[#120c24] shadow-[0_0_14px_#9b84ff77]" : d.ran ? "bg-[#23b58a]/80 text-[#04130e]" : "bg-white/[0.06] text-white/30",
                )}
                title={`${d.date}${d.minutes ? ` · ${d.minutes} min` : ""}`}
              >
                {d.trained ? "Gym" : d.ran ? "Run" : "·"}
                {d.minutes > 0 && <span className="text-[10px] opacity-75">{d.minutes}m</span>}
              </div>
              <div className={clsx("mx-auto mt-1 h-1 w-4 rounded-full", data.lastWeek[i]?.trained ? "bg-[#9b84ff]/45" : "bg-white/[0.06]")} title="Last week" />
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-white/35">Small bars underneath are last week.</div>
      </GlassCard>
      <GlassCard title="Muscle split" right={<span className="text-[11px] text-white/40">sets / week · 4-wk avg</span>}>
        <div className="space-y-2">
          {data.muscleSplit.map((m) => (
            <div key={m.muscle} className="grid grid-cols-[76px_1fr_30px] items-center gap-3 text-[12px]">
              <span className={m.sets === 0 ? "text-rose-300/80" : "text-white/65"}>{m.muscle}</span>
              <div className="relative h-2.5 rounded-[3px] bg-white/[0.06]">
                <div className="absolute inset-y-0 rounded-[3px] bg-emerald-400/10" style={{ left: `${(10 / maxSets) * 100}%`, width: `${(10 / maxSets) * 100}%` }} />
                {m.sets > 0 && <div className="absolute inset-y-0 left-0 rounded-[3px] bg-[#9b84ff]" style={{ width: `${(m.sets / maxSets) * 100}%` }} />}
              </div>
              <span className="text-right tnum text-white/70">{m.sets}</span>
            </div>
          ))}
        </div>
        {data.sessionSplit.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.sessionSplit.map((s) => (
              <Pill key={s.kind}>
                {s.kind[0].toUpperCase() + s.kind.slice(1)} × {s.count}
              </Pill>
            ))}
          </div>
        )}
      </GlassCard>
      {data.topLifts.length > 0 && (
        <GlassCard title="Main lifts">
          <ul className="divide-y divide-white/[0.06]">
            {data.topLifts.map((l) => (
              <li key={l.name} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{l.name}</div>
                  <div className="truncate font-mono text-[11.5px] text-white/45">{l.top}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {l.change != null && <span className={clsx("text-[12px] tnum", l.change > 0 ? "text-emerald-300" : l.change < 0 ? "text-rose-300" : "text-white/40")}>{l.change > 0 ? "+" : ""}{Math.round(l.change)}%</span>}
                  <Pill tone={l.status === "Add weight" ? "good" : l.status === "Stalled" ? "warn" : "neutral"}>{l.status}</Pill>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}

/* keep Bar exported for other panels */
export { Bar };
