"use client";

import { useState } from "react";
import clsx from "clsx";
import { ArrowUpRight, CalendarDays, Inbox, Table2 } from "lucide-react";
import type { PenthouseData } from "../types";
import { Bar, Columns, GlassCard, Metric, Pill, Ring, SampleBadge } from "./glass";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (s: string | null) => (s ? `${MON[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}` : "–");
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/* ====================================================================== */
/* 1. Sleep & Recovery (sample until Garmin is connected)                  */
/* ====================================================================== */

const SLEEP = {
  hours: [6.9, 7.4, 6.2, 7.8, 7.1, 8.2, 7.2],
  last: { total: 7.2, rem: 1.63, deep: 1.25, light: 3.97, awake: 0.35, bed: "23:48", wake: "07:15" },
  energy: 78,
  hrv: 61,
  rhr: 52,
};
const fmtH = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;

export function SleepPanel() {
  const s = SLEEP.last;
  const stages = [
    { k: "Deep", v: s.deep, c: "#6250d6" },
    { k: "REM", v: s.rem, c: "#3987e5" },
    { k: "Light", v: s.light, c: "#86b6ef" },
    { k: "Awake", v: s.awake, c: "#f2a53a" },
  ];
  const total = stages.reduce((a, x) => a + x.v, 0);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SampleBadge>Sample data · connect Garmin to go live</SampleBadge>
      </div>
      <div className="grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
        <Ring value={SLEEP.energy / 100} color="#f2a53a" size={118}>
          <div>
            <div className="text-[30px] font-semibold leading-none tnum">{SLEEP.energy}</div>
            <div className="mt-1 text-[10.5px] uppercase tracking-wider text-white/50">Energy</div>
          </div>
        </Ring>
        <div>
          <div className="text-[12px] text-white/50">Last night</div>
          <div className="text-[28px] font-semibold tracking-tight tnum">{fmtH(s.total)}</div>
          <div className="mt-0.5 text-[12.5px] text-white/55">
            {s.bed} → {s.wake} · {Math.round((s.rem / s.total) * 100)}% REM
          </div>
          <div className="mt-2 flex gap-1.5">
            <Pill tone="good">HRV {SLEEP.hrv} ms</Pill>
            <Pill>Resting HR {SLEEP.rhr}</Pill>
          </div>
        </div>
      </div>
      <GlassCard title="Sleep stages">
        <div className="flex h-3 overflow-hidden rounded-full">
          {stages.map((x) => (
            <div key={x.k} style={{ width: `${(x.v / total) * 100}%`, background: x.c }} className="border-r-2 border-[#15131f] last:border-0" title={`${x.k}: ${fmtH(x.v)}`} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-[12px]">
          {stages.map((x) => (
            <div key={x.k}>
              <div className="flex items-center gap-1.5 text-white/55">
                <span className="size-2 rounded-full" style={{ background: x.c }} />
                {x.k}
              </div>
              <div className="mt-0.5 font-medium tnum">{fmtH(x.v)}</div>
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard title="Hours slept, last 7 nights" right={<span className="text-[11px] text-white/40">target 8h</span>}>
        <Columns values={SLEEP.hours} labels={["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"]} color="#f2a53a" target={8} format={fmtH} />
      </GlassCard>
    </div>
  );
}

/* ====================================================================== */
/* 2. Professional Hub                                                     */
/* ====================================================================== */

// Placeholder rows only. These get replaced by real AI summaries once an inbox is connected.
const EMAILS = [
  { from: "Recruiting · Example Capital", subject: "Application received", summary: "Confirms your application. An online assessment link follows within a week.", tag: "Job", tone: "accent" as const },
  { from: "Program office", subject: "Deadline reminder", summary: "A form is due Friday. One short paragraph, submitted through the student portal.", tag: "Action", tone: "warn" as const },
  { from: "Student club", subject: "Event logistics", summary: "Room is confirmed. Two volunteers needed for check-in from 6pm.", tag: "Club", tone: "neutral" as const },
  { from: "Course platform", subject: "Weekly progress", summary: "Summary of the week's course progress and what's due next.", tag: "School", tone: "neutral" as const },
];

const STATUS_TONE: Record<string, "good" | "accent" | "warn" | "bad" | "neutral"> = {
  Offer: "good",
  Interview: "accent",
  "Final round": "accent",
  "To do assessment": "accent",
  "Assessment complete": "accent",
  Applied: "accent",
  "To apply": "warn",
  Rejected: "bad",
};

export function DeskPanel({ data }: { data: PenthouseData }) {
  const [tab, setTab] = useState<"jobs" | "inbox" | "calendar">("jobs");
  const tabs = [
    { id: "jobs" as const, label: "Job search", icon: Table2 },
    { id: "inbox" as const, label: "Inbox", icon: Inbox },
    { id: "calendar" as const, label: "Calendar", icon: CalendarDays },
  ];
  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12.5px] font-medium transition",
              tab === t.id ? "bg-white/[0.12] text-white" : "text-white/55 hover:text-white",
            )}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "jobs" && <JobsGrid data={data} />}
      {tab === "inbox" && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <SampleBadge>Sample · AI summaries need a Gmail link</SampleBadge>
          </div>
          {EMAILS.map((e) => (
            <div key={e.subject} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium">{e.from}</span>
                <Pill tone={e.tone}>{e.tag}</Pill>
              </div>
              <div className="mt-0.5 truncate text-[12px] text-white/45">{e.subject}</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/75">{e.summary}</p>
            </div>
          ))}
        </div>
      )}
      {tab === "calendar" && <CalendarView data={data} />}
    </div>
  );
}

function JobsGrid({ data }: { data: PenthouseData }) {
  const j = data.jobs;
  if (!j.ok) return <GlassCard>{j.message}</GlassCard>;
  const cols = ["Company", "Role", "Status", "Applied", "Deadline"];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Applied this week" value={j.appsThisWeek} unit={`/ ${j.appTarget}`} accent="#4b93ec" />
        <Metric label="In progress" value={j.active} />
        <Metric label="To apply" value={j.toApply} sub={j.responseRate != null ? `${Math.round(j.responseRate * 100)}% response rate` : undefined} />
      </div>
      {/* Excel-style grid */}
      <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0b0f17]/60 font-mono text-[11.5px]">
        <div className="max-h-[300px] overflow-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#16202f] text-white/45">
                <th className="w-8 border-b border-r border-white/10 py-1 font-normal" />
                {cols.map((c, i) => (
                  <th key={c} className="border-b border-r border-white/10 px-2 py-1 text-center font-normal last:border-r-0">
                    {String.fromCharCode(65 + i)}
                  </th>
                ))}
              </tr>
              <tr className="bg-[#111a27] text-white/80">
                <td className="border-b border-r border-white/10 bg-[#16202f] py-1 text-center text-white/45">1</td>
                {cols.map((c) => (
                  <td key={c} className="border-b border-r border-white/10 px-2 py-1 font-semibold last:border-r-0">
                    {c}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {j.rows.map((r, i) => (
                <tr key={r.id || i} className="text-white/80 hover:bg-sky-400/[0.06]">
                  <td className="border-b border-r border-white/[0.07] bg-[#16202f]/70 py-1 text-center text-white/40">{i + 2}</td>
                  <td className="max-w-[130px] truncate border-b border-r border-white/[0.07] px-2 py-1">
                    {r.link ? (
                      <a href={r.link} target="_blank" rel="noopener noreferrer" className="hover:text-sky-300 hover:underline">
                        {r.company}
                      </a>
                    ) : (
                      r.company
                    )}
                  </td>
                  <td className="max-w-[170px] truncate border-b border-r border-white/[0.07] px-2 py-1 text-white/60" title={r.role}>
                    {r.role}
                  </td>
                  <td className="border-b border-r border-white/[0.07] px-2 py-1">
                    <Pill tone={STATUS_TONE[r.status] || "neutral"}>{r.status}</Pill>
                  </td>
                  <td className="border-b border-r border-white/[0.07] px-2 py-1 text-white/60">{short(r.applied)}</td>
                  <td className="border-b border-white/[0.07] px-2 py-1 text-white/60">{short(r.deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ data }: { data: PenthouseData }) {
  const today = data.today;
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  const first = new Date(Date.UTC(y, m, 1));
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const iso = (d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const byDay = new Map<string, number>();
  data.events.forEach((e) => byDay.set(e.date, (byDay.get(e.date) || 0) + 1));
  const upcoming = data.events.filter((e) => e.date >= today).slice(0, 5);
  return (
    <div className="space-y-3">
      <GlassCard title={`${MON[m]} ${y}`}>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-white/35">
          {DOW.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1 text-center text-[12.5px]">
          {Array.from({ length: lead }, (_, i) => (
            <div key={`l${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const d = iso(i + 1);
            const n = byDay.get(d) || 0;
            const isToday = d === today;
            return (
              <div
                key={d}
                className={clsx(
                  "relative flex h-8 items-center justify-center rounded-lg tnum",
                  isToday ? "bg-sky-400/90 font-semibold text-[#0a0a0f]" : d < today ? "text-white/30" : "text-white/80",
                )}
              >
                {i + 1}
                {n > 0 && !isToday && <span className="absolute bottom-1 size-1 rounded-full bg-sky-300" />}
              </div>
            );
          })}
        </div>
      </GlassCard>
      <GlassCard title="Coming up">
        <ul className="space-y-2.5">
          {upcoming.map((e) => (
            <li key={e.date + e.title} className="flex gap-3">
              <div className="w-10 shrink-0 text-center leading-tight">
                <div className="text-[10px] uppercase tracking-wider text-white/40">{MON[Number(e.date.slice(5, 7)) - 1]}</div>
                <div className="text-[16px] font-semibold tnum">{Number(e.date.slice(8, 10))}</div>
              </div>
              <div className="min-w-0 border-l border-white/10 pl-3">
                <div className="text-[13px] leading-snug">{e.title}</div>
                <div className="text-[11.5px] text-white/40">{e.kind === "school" ? "IE NYC" : "Personal"}</div>
              </div>
            </li>
          ))}
          {!upcoming.length && <li className="text-[13px] text-white/45">Nothing scheduled.</li>}
        </ul>
      </GlassCard>
    </div>
  );
}

/* ====================================================================== */
/* 3. Fitness Analytics (live from Training)                               */
/* ====================================================================== */

export function GymPanel({ data }: { data: PenthouseData }) {
  const t = data.training;
  if (!t) return <GlassCard>Training data isn&apos;t available right now.</GlassCard>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="This week" value={t.gymThisWeek} unit={`/ ${t.gymTarget}`} accent="#9085e9" sub={t.gymThisWeek >= t.gymTarget ? "Target hit" : `${t.gymTarget - t.gymThisWeek} to go`} />
        <Metric label="Since last" value={t.sinceLast ?? "–"} unit="days" sub={t.lastDate ? short(t.lastDate) : undefined} />
        <Metric label="Sets, 28 days" value={t.sets28} sub={`${t.runKmWeek.toFixed(1)} km run this week`} />
      </div>
      <GlassCard title="Sessions per week" right={<span className="text-[11px] text-white/40">{t.weeksHit} of 12 weeks on target</span>}>
        <Columns values={t.weeks.map((w) => w.gym)} labels={t.weeks.map((w) => w.label)} color="#9085e9" target={t.gymTarget} />
      </GlassCard>
      <GlassCard title="Consistency, 8 weeks">
        <div className="flex gap-3">
          <div className="grid grid-rows-7 gap-1 text-[9.5px] leading-[14px] text-white/30">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="grid flex-1 grid-flow-col grid-rows-7 gap-1">
            {t.heat.flat().map((c) => (
              <div
                key={c.date}
                title={`${short(c.date)}${c.on ? " · trained" : ""}`}
                className={clsx("h-[14px] rounded-[3px]", c.on ? "bg-[#9085e9] shadow-[0_0_8px_#9085e988]" : c.date > data.today ? "bg-white/[0.02]" : "bg-white/[0.07]")}
              />
            ))}
          </div>
        </div>
      </GlassCard>
      <GlassCard title="Lifts">
        <ul className="divide-y divide-white/[0.06]">
          {t.lifts.map((l) => (
            <li key={l.name} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{l.name}</div>
                <div className="truncate font-mono text-[11.5px] text-white/45">{l.top}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {l.change != null && <span className={clsx("text-[12px] tnum", l.change > 0 ? "text-emerald-300" : l.change < 0 ? "text-rose-300" : "text-white/40")}>{l.change > 0 ? "+" : ""}{Math.round(l.change)}%</span>}
                <Pill tone={l.tone}>{l.status}</Pill>
              </div>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}

/* ====================================================================== */
/* 4. Diet & Nutrition (sample until a food log exists)                    */
/* ====================================================================== */

const FOOD = {
  target: 2700,
  macros: { protein: [148, 170], carbs: [212, 320], fat: [61, 85] } as Record<string, [number, number]>,
  meals: [
    { time: "08:10", name: "Overnight oats, whey, berries", kcal: 610, p: 42 },
    { time: "12:45", name: "Chicken rice bowl", kcal: 720, p: 52 },
    { time: "16:00", name: "Greek yogurt + granola", kcal: 330, p: 24 },
    { time: "19:30", name: "Salmon, potatoes, greens", kcal: 520, p: 30 },
  ],
  week: [2480, 2710, 2350, 2890, 2600, 2420, 2180],
};

export function KitchenPanel() {
  const eaten = FOOD.meals.reduce((a, m) => a + m.kcal, 0);
  const left = FOOD.target - eaten;
  const colors = { protein: "#3987e5", carbs: "#d95926", fat: "#199e70" } as const;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SampleBadge>Sample data · meal logging comes next</SampleBadge>
      </div>
      <div className="grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
        <Ring value={eaten / FOOD.target} color="#23b58a" size={118}>
          <div>
            <div className="text-[24px] font-semibold leading-none tnum">{eaten.toLocaleString()}</div>
            <div className="mt-1 text-[10.5px] uppercase tracking-wider text-white/50">of {FOOD.target.toLocaleString()} kcal</div>
          </div>
        </Ring>
        <div className="space-y-3">
          {(["protein", "carbs", "fat"] as const).map((k) => (
            <Bar key={k} label={k[0].toUpperCase() + k.slice(1)} value={FOOD.macros[k][0]} max={FOOD.macros[k][1]} color={colors[k]} unit=" g" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Left today" value={left.toLocaleString()} unit="kcal" accent="#23b58a" />
        <Metric label="Protein per meal" value="37" unit="g avg" />
      </div>
      <GlassCard title="Meals today">
        <ul className="divide-y divide-white/[0.06]">
          {FOOD.meals.map((m) => (
            <li key={m.time} className="flex items-center gap-3 py-2 text-[13px]">
              <span className="w-11 font-mono text-[11.5px] text-white/40">{m.time}</span>
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
              <span className="tnum text-white/55">{m.p}g P</span>
              <span className="w-16 text-right font-medium tnum">{m.kcal} kcal</span>
            </li>
          ))}
        </ul>
      </GlassCard>
      <GlassCard title="Calories, last 7 days" right={<span className="text-[11px] text-white/40">target {FOOD.target}</span>}>
        <Columns values={FOOD.week} labels={["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"]} color="#23b58a" target={FOOD.target} format={(v) => `${v} kcal`} />
      </GlassCard>
    </div>
  );
}

export function FullPageLink({ href }: { href: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-white/60 transition hover:bg-white/10 hover:text-white">
      Full page <ArrowUpRight size={13} />
    </a>
  );
}
