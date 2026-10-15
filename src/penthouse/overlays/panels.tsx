"use client";

import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { ArrowUpRight, CalendarDays, ChevronDown, Inbox, Plus, RefreshCw, Table2, Trash2, X } from "lucide-react";
import type { FitnessData, NutritionData, ProfessionalData, SleepData, Source } from "../data/types";
import { useFitnessData, useNutritionData, useProfessionalData, useSleepData } from "../data/hooks";
import { addMeal, deleteMeal } from "../data/actions";
import { Bar, Columns, GlassCard, Metric, Pill, Ring } from "./glass";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (s: string | null) => (s ? `${MON[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}` : "–");
const dow = (s: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(s + "T12:00:00Z").getUTCDay()];
const hm = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m`;

/* ---------------------------------------------------------------------- */
/* shared                                                                  */
/* ---------------------------------------------------------------------- */

function SourceBar({ source, hint, loading, onRefresh }: { source: Source; hint: string; loading: boolean; onRefresh: () => void }) {
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

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; icon: typeof Table2 }[] }) {
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

export function ProfessionalPanel({ initial }: { initial: ProfessionalData }) {
  const { data, loading, refresh } = useProfessionalData(initial);
  const [tab, setTab] = useState<"jobs" | "inbox" | "calendar">("jobs");
  const j = data.jobs;
  return (
    <div className="space-y-3">
      <SourceBar source={data.source} hint="inbox summaries not connected" loading={loading} onRefresh={refresh} />
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Applied this week" value={j.appliedThisWeek} unit={`/ ${j.weeklyTarget}`} accent="#47dcff" />
        <Metric label="In progress" value={j.active} />
        <Metric label="To apply" value={j.toApply} sub={j.responseRate != null ? `${Math.round(j.responseRate * 100)}% response rate` : undefined} />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "jobs", label: "Applications", icon: Table2 },
          { id: "inbox", label: "AI inbox", icon: Inbox },
          { id: "calendar", label: "Calendar", icon: CalendarDays },
        ]}
      />
      {tab === "jobs" && (j.ok ? <JobGrid rows={j.rows} /> : <GlassCard>{j.message}</GlassCard>)}
      {tab === "inbox" && (
        <div className="space-y-2">
          {data.emails.source !== "live" && <p className="text-[11.5px] text-white/40">Placeholder rows. Summaries appear here once the inbox job posts to /api/ingest/emails.</p>}
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {data.emails.items.map((e) => (
              <div key={e.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium">{e.sender}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Pill tone={e.tag === "Action" ? "warn" : e.tag === "Job" ? "accent" : "neutral"}>{e.tag}</Pill>
                    <span className="text-[11px] text-white/35 tnum">{short(e.receivedAt.slice(0, 10))}</span>
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[12px] text-white/45">{e.subject}</div>
                <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-white/80">
                  {e.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-sky-300/80" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "calendar" && <CalendarFeed items={data.calendar.items} />}
    </div>
  );
}

function JobGrid({ rows }: { rows: ProfessionalData["jobs"]["rows"] }) {
  const cols = ["Company", "Role", "Status", "Date applied"];
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#070b12]/70 font-mono text-[11.5px]">
      <div className="max-h-[340px] overflow-auto [scrollbar-width:thin]">
        <table className="w-full min-w-[500px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#121b29] text-white/40">
              <th className="w-8 border-b border-r border-white/10 py-1 font-normal" />
              {cols.map((c, i) => (
                <th key={c} className="border-b border-r border-white/10 px-2 py-1 text-center font-normal last:border-r-0">
                  {String.fromCharCode(65 + i)}
                </th>
              ))}
            </tr>
            <tr className="bg-[#0e1622] text-white/85">
              <td className="border-b border-r border-white/10 bg-[#121b29] py-1 text-center text-white/40">1</td>
              {cols.map((c) => (
                <td key={c} className="border-b border-r border-white/10 px-2 py-1 font-semibold last:border-r-0">
                  {c}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || i} className="text-white/80 hover:bg-cyan-300/[0.06]">
                <td className="border-b border-r border-white/[0.07] bg-[#121b29]/70 py-1 text-center text-white/35">{i + 2}</td>
                <td className="max-w-[130px] truncate border-b border-r border-white/[0.07] px-2 py-1">
                  {r.link ? (
                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-300 hover:underline">
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
                <td className="border-b border-white/[0.07] px-2 py-1 text-white/60 tnum">{short(r.applied)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalendarFeed({ items }: { items: ProfessionalData["calendar"]["items"] }) {
  const groups = useMemo(() => {
    const m = new Map<string, typeof items>();
    for (const it of items) m.set(it.date, [...(m.get(it.date) || []), it]);
    return [...m.entries()];
  }, [items]);
  if (!groups.length) return <GlassCard>Nothing in the next 30 days.</GlassCard>;
  return (
    <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
      {groups.map(([d, list]) => (
        <div key={d} className="flex gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
          <div className="w-11 shrink-0 text-center leading-tight">
            <div className="text-[10px] uppercase tracking-wider text-white/40">{dow(d)}</div>
            <div className="text-[19px] font-semibold tnum">{Number(d.slice(8, 10))}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/35">{MON[Number(d.slice(5, 7)) - 1]}</div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5 border-l border-white/10 pl-3">
            {list.map((e) => (
              <li key={e.title}>
                <div className="text-[13px] leading-snug">{e.title}</div>
                <div className="text-[11.5px] text-white/40">
                  {e.time ? `${e.time} · ` : ""}
                  {e.kind === "school" ? "IE NYC" : "Personal"}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
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

/* ====================================================================== */
/* 🍳 Kitchen Lab → useNutritionData                                       */
/* ====================================================================== */

const MACROS = [
  { k: "protein", label: "Protein", color: "#3987e5" },
  { k: "carbs", label: "Carbs", color: "#d95926" },
  { k: "fat", label: "Fats", color: "#199e70" },
] as const;

export function NutritionPanel({ initial }: { initial: NutritionData }) {
  const { data, loading, refresh, setData } = useNutritionData(initial);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
  const t = data.totals;
  const left = data.targets.kcal - t.kcal;
  const visible = open ? data.meals : data.meals.slice(-3);

  const submit = () => {
    if (!form.name.trim() || !form.kcal) return;
    start(async () => {
      const next = await addMeal({ name: form.name, kcal: Number(form.kcal), protein: Number(form.protein || 0), carbs: Number(form.carbs || 0), fat: Number(form.fat || 0) });
      setData(next);
      setForm({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
      setAdding(false);
      setOpen(true);
    });
  };

  return (
    <div className="space-y-3">
      <SourceBar source={data.source} hint="log your first meal below" loading={loading || pending} onRefresh={refresh} />
      <div className="grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
        <Ring value={t.kcal / data.targets.kcal} color="#ffcb6b" size={118}>
          <div>
            <div className="text-[24px] font-semibold leading-none tnum">{t.kcal.toLocaleString()}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/50">of {data.targets.kcal.toLocaleString()} kcal</div>
          </div>
        </Ring>
        <div>
          <div className="text-[12px] text-white/50">{left >= 0 ? "Left today" : "Over target"}</div>
          <div className="text-[28px] font-semibold tracking-tight tnum">
            {Math.abs(left).toLocaleString()} <span className="text-[14px] font-normal text-white/45">kcal</span>
          </div>
          <div className="mt-1 text-[12px] text-white/50">{data.meals.length} meals logged</div>
        </div>
      </div>

      {/* macro grid */}
      <div className="grid grid-cols-3 gap-2">
        {MACROS.map((m) => {
          const v = Math.round(t[m.k]);
          const target = data.targets[m.k];
          return (
            <div key={m.k} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
              <div className="flex items-center gap-1.5 text-[11.5px] text-white/55">
                <span className="size-2 rounded-[2px]" style={{ background: m.color }} />
                {m.label}
              </div>
              <div className="mt-1 text-[22px] font-semibold leading-none tnum">
                {v}
                <span className="ml-0.5 text-[12px] font-normal text-white/40">/ {target}g</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (v / target) * 100)}%`, background: m.color, boxShadow: `0 0 10px ${m.color}aa` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* meal log */}
      <GlassCard
        title="Meal log"
        right={
          <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-white/70 hover:bg-white/10 hover:text-white">
            {adding ? <X size={13} /> : <Plus size={13} />} {adding ? "Cancel" : "Add meal"}
          </button>
        }
      >
        {adding && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="mb-3 grid grid-cols-4 gap-2"
          >
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="What did you eat?" className="glass-field col-span-4" />
            {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
              <input
                key={k}
                inputMode="numeric"
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value.replace(/[^\d.]/g, "") })}
                placeholder={k === "kcal" ? "kcal" : `${k[0].toUpperCase()}${k.slice(1)} g`}
                className="glass-field font-mono"
              />
            ))}
            <button disabled={pending || !form.name.trim() || !form.kcal} className="col-span-4 h-9 rounded-lg bg-white/90 text-[13px] font-medium text-black transition hover:bg-white disabled:opacity-40">
              {pending ? "Saving…" : "Log meal"}
            </button>
          </form>
        )}
        <ul className="divide-y divide-white/[0.06]">
          {visible.map((m) => (
            <li key={m.id} className="group flex items-center gap-3 py-2 text-[13px]">
              <span className="w-11 font-mono text-[11.5px] text-white/40">{m.time || "–"}</span>
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
              <span className="hidden font-mono text-[11px] text-white/45 sm:inline">
                P{Math.round(m.protein)} C{Math.round(m.carbs)} F{Math.round(m.fat)}
              </span>
              <span className="w-16 text-right font-medium tnum">{m.kcal}</span>
              {data.source === "live" && (
                <button
                  onClick={() => start(async () => setData(await deleteMeal(m.id)))}
                  className="text-white/25 opacity-0 transition group-hover:opacity-100 hover:text-rose-300"
                  aria-label={`Delete ${m.name}`}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          ))}
          {!data.meals.length && <li className="py-2 text-[13px] text-white/45">Nothing logged today.</li>}
        </ul>
        {data.meals.length > 3 && (
          <button onClick={() => setOpen((o) => !o)} className="mt-1 inline-flex items-center gap-1 text-[12px] text-white/50 hover:text-white">
            <ChevronDown size={13} className={clsx("transition", open && "rotate-180")} />
            {open ? "Show less" : `Show all ${data.meals.length}`}
          </button>
        )}
      </GlassCard>

      <GlassCard title="Calories, last 7 days" right={<span className="text-[11px] text-white/40">target {data.targets.kcal}</span>}>
        <Columns values={data.week.map((w) => w.kcal)} labels={data.week.map((w) => dow(w.date))} color="#ffcb6b" target={data.targets.kcal} format={(v) => `${v} kcal`} />
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

/* keep Bar exported for other panels */
export { Bar };
