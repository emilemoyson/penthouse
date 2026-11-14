import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, Briefcase, ChefHat, Dumbbell, BedDouble } from "lucide-react";
import type { ReactNode } from "react";
import { getPenthouseData } from "@/penthouse/data/server";
import type { CalendarItem, Source } from "@/penthouse/data/types";
import { addDays, fDay, fDow, fLong, fMonth } from "@/lib/dates";
import { DashTodos } from "./todos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Today" };

const KIND: Record<string, string> = { meeting: "var(--s1)", school: "var(--s2)", deadline: "var(--bad)", personal: "var(--s3)" };

const hm = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}`;

/**
 * The classic view on one screen: office (calendar + to-dos) on the left,
 * kitchen, gym and bedroom stacked on the right. On a laptop the page itself never
 * scrolls; a list that runs long scrolls inside its own panel. On a phone it stacks.
 */
export default async function Dashboard() {
  const { today, professional, nutrition, fitness, sleep } = await getPenthouseData();

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const agenda = days
    .map((d) => ({ date: d, items: professional.calendar.items.filter((e) => e.date === d) }))
    .filter((g) => g.date === today || g.items.length > 0);
  const todayEvents = agenda[0]?.items.length ?? 0;
  const open = professional.todos.items.filter((t) => !t.done).length;

  const n = nutrition;
  const kcalPct = n.targets.kcal ? n.totals.kcal / n.targets.kcal : 0;
  const protPct = n.targets.protein ? n.totals.protein / n.targets.protein : 0;
  const useSoon = n.pantry.filter((p) => p.daysLeft <= 3).slice(0, 3);

  const f = fitness;
  const s = sleep;
  const sleepMax = Math.max(s.targetMin, ...s.week.map((w) => w.totalMin), 1);

  return (
    <div data-fit className="flex flex-col gap-4 lg:h-[calc(100dvh-6.6rem)]">
      {/* heading row */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <div className="text-[11.5px] font-medium uppercase tracking-[0.2em] text-ink-3">Today</div>
          <h1 className="font-serif text-[28px] font-medium leading-tight tracking-[-0.02em]">{fLong(today)}</h1>
        </div>
        <div className="flex flex-wrap gap-2 text-[12.5px]">
          <Chip label="On the calendar" value={todayEvents} />
          <Chip label="Open to-dos" value={open} />
          <Chip label="Calories" value={`${Math.round(kcalPct * 100)}%`} />
          <Chip label="Sessions" value={`${f.sessionsThisWeek}/${f.sessionTarget}`} />
          <Chip label="Last night" value={s.lastNight ? hm(s.lastNight.totalMin) : "None"} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-12">
        {/* office */}
        <Panel className="lg:col-span-7" icon={<Briefcase size={15} />} title="Office" href="/office" source={professional.source}>
          <div className="grid min-h-0 flex-1 gap-5 md:grid-cols-2">
            <div className="flex min-h-0 min-w-0 flex-col">
              <SubHead>Next 7 days</SubHead>
              <div className="scroll-soft min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {agenda.map((g) => (
                  <div key={g.date}>
                    <div className={clsx("mb-1 text-[12px] font-medium", g.date === today ? "text-accent-ink" : "text-ink-3")}>
                      {g.date === today ? "Today" : g.date === addDays(today, 1) ? "Tomorrow" : `${fDow(g.date)} ${fMonth(g.date)} ${fDay(g.date)}`}
                    </div>
                    {g.items.length === 0 ? (
                      <div className="text-[13px] text-ink-3">Nothing scheduled.</div>
                    ) : (
                      <ul className="space-y-1">
                        {g.items.map((e, i) => (
                          <Event key={i} e={e} />
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex min-h-0 min-w-0 flex-col md:border-l md:border-line md:pl-5">
              <SubHead>To-dos</SubHead>
              <DashTodos items={professional.todos.items} today={today} />
            </div>
          </div>
        </Panel>

        {/* right column */}
        <div className="grid min-h-0 gap-4 lg:col-span-5 lg:grid-rows-3">
          <Panel icon={<ChefHat size={15} />} title="Kitchen" href="/kitchen" source={n.source}>
            <div className="grid flex-1 grid-cols-2 content-center gap-x-5 gap-y-2.5">
              <Meter label="Calories" now={n.totals.kcal} goal={n.targets.kcal} unit="kcal" pct={kcalPct} />
              <Meter label="Protein" now={n.totals.protein} goal={n.targets.protein} unit="g" pct={protPct} />
              <Mini label="Meals today" value={String(n.meals.length)} />
              <Mini label="Food spend, 7 days" value={`$${Math.round(n.spend.week)}`} />
            </div>
            <Foot>
              {useSoon.length ? `Use soon: ${useSoon.map((p) => p.name).join(", ")}` : n.meals.length ? `Last: ${n.meals[n.meals.length - 1].name}` : "No meals logged yet today."}
            </Foot>
          </Panel>

          <Panel icon={<Dumbbell size={15} />} title="Gym" href="/training" source={f.source}>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-3">
              <div className="flex gap-1.5">
                {f.week.map((d) => (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <div
                      className={clsx(
                        "size-7 rounded-lg border",
                        d.trained && d.ran ? "border-transparent bg-accent" : d.trained ? "border-transparent bg-s2" : d.ran ? "border-transparent bg-s3" : "border-line bg-surface-2",
                        d.date === today && "ring-2 ring-accent/50 ring-offset-1 ring-offset-[var(--surface)]",
                      )}
                      title={d.trained ? "Lifted" : d.ran ? "Ran" : "Rest"}
                    />
                    <span className="text-[10.5px] text-ink-3">{d.day.slice(0, 1)}</span>
                  </div>
                ))}
              </div>
              <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5">
                <Mini label="Sessions" value={`${f.sessionsThisWeek} of ${f.sessionTarget}`} />
                <Mini label="Active min" value={`${f.activeMinutes}${f.minutesEstimated ? "*" : ""}`} />
                <Mini label="Streak" value={`${f.streakWeeks} wk`} />
                <Mini label="Last session" value={f.daysSinceLast == null ? "None" : f.daysSinceLast === 0 ? "Today" : `${f.daysSinceLast}d ago`} />
              </div>
            </div>
            <Foot>{f.topLifts[0] ? `Top lift: ${f.topLifts[0].name}, ${f.topLifts[0].top}` : "Log a session to see your lifts."}</Foot>
          </Panel>

          <Panel icon={<BedDouble size={15} />} title="Bedroom" href="/bedroom" source={s.source}>
            <div className="flex flex-1 items-center gap-5">
              <div className="shrink-0">
                <div className="font-serif text-[28px] font-medium leading-none tracking-[-0.02em] tnum">{s.lastNight ? hm(s.lastNight.totalMin) : "None"}</div>
                <div className="mt-1 text-[12px] text-ink-3">
                  last night{s.lastNight?.recovery != null ? `, recovery ${s.lastNight.recovery}%` : ""}
                </div>
              </div>
              <div className="flex h-16 flex-1 items-end gap-1.5" aria-label="Sleep, last 7 nights">
                {s.week.map((w) => (
                  <div key={w.date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={clsx("w-full rounded-t-[4px]", w.totalMin >= s.targetMin ? "bg-s2" : "bg-surface-3")}
                      style={{ height: `${Math.max(6, (w.totalMin / sleepMax) * 52)}px` }}
                      title={`${fDow(w.date)}: ${hm(w.totalMin)}`}
                    />
                    <span className="text-[10.5px] text-ink-3">{fDow(w.date).slice(0, 1)}</span>
                  </div>
                ))}
              </div>
            </div>
            <Foot>{s.lastNight?.bedtime ? `In bed ${s.lastNight.bedtime}, up ${s.lastNight.waketime ?? "?"}. Goal ${hm(s.targetMin)}.` : `Goal ${hm(s.targetMin)} a night.`}</Foot>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, icon, href, source, className, children }: { title: string; icon: ReactNode; href: string; source: Source; className?: string; children: ReactNode }) {
  return (
    <section className={clsx("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)] xl:p-5", className)}>
      <header className="mb-2.5 flex items-center gap-2">
        <span className="text-ink-3">{icon}</span>
        <h2 className="text-[14.5px] font-semibold tracking-[-0.005em]">{title}</h2>
        {source !== "live" && (
          <span className={clsx("rounded-full px-1.5 py-px text-[10.5px] font-medium", source === "sample" ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink-3")}>
            {source === "sample" ? "Sample data" : "Partly live"}
          </span>
        )}
        <Link href={href} prefetch className="ml-auto inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] text-ink-3 transition hover:bg-surface-2 hover:text-ink">
          Open <ArrowUpRight size={13} />
        </Link>
      </header>
      {children}
    </section>
  );
}

function Event({ e }: { e: CalendarItem }) {
  return (
    <li className="flex items-start gap-2 text-[13px] leading-snug">
      <span className="mt-[5px] size-2 shrink-0 rounded-full" style={{ background: KIND[e.kind] ?? KIND.personal }} />
      <span className="w-[52px] shrink-0 tnum text-ink-3">{e.time ?? "All day"}</span>
      <span className="min-w-0 truncate" title={e.title}>{e.title}</span>
    </li>
  );
}

function Meter({ label, now, goal, unit, pct }: { label: string; now: number; goal: number; unit: string; pct: number }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-[12px] text-ink-3">
        <span>{label}</span>
        <span className="tnum">
          <span className="font-medium text-ink">{Math.round(now)}</span> / {goal} {unit}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className={clsx("h-full rounded-full", pct > 1.1 ? "bg-warn" : "bg-accent")} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
    </div>
  );
}

const Mini = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <div className="truncate text-[11.5px] text-ink-3">{label}</div>
    <div className="text-[15px] font-medium tnum">{value}</div>
  </div>
);

const Chip = ({ label, value }: { label: string; value: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1">
    <span className="text-ink-3">{label}</span>
    <span className="font-medium tnum">{value}</span>
  </span>
);

const SubHead = ({ children }: { children: ReactNode }) => (
  <div className="mb-2 text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-3">{children}</div>
);

const Foot = ({ children }: { children: ReactNode }) => <p className="mt-1.5 shrink-0 truncate text-[12px] text-ink-3">{children}</p>;
