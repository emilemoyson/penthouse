import Link from "next/link";
import { CircleAlert, CircleCheck, Info, TriangleAlert, Plus, Pencil, Footprints } from "lucide-react";
import { loadTraining, fmtW, paceStr, durStr } from "@/lib/training";
import { coachNotes, exerciseSummaries, runStats, setsPerMuscle, weeklySessions, type Insight, type ExStatus } from "@/lib/coach";
import { addDays, daysBetween, fShort, fDow, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { SESSION_KINDS, RUN_KINDS, WEEKLY_SET_RANGE } from "@/lib/exercises";
import { Badge, Card, Delta, Empty, LinkButton, PageHeader, Stat } from "@/components/ui";
import { WeeklyColumns, TimeLine } from "@/components/charts";
import { LiftExplorer, type LiftOption } from "./lift-explorer";
import { DeleteButton } from "./delete-button";
import { deleteWorkout, deleteRun } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Training" };

const STATUS: Record<ExStatus, { label: string; tone: "good" | "accent" | "warn" | "neutral" }> = {
  ready: { label: "Add weight", tone: "good" },
  progressing: { label: "Progressing", tone: "accent" },
  holding: { label: "Building reps", tone: "neutral" },
  stalled: { label: "Stalled", tone: "warn" },
  new: { label: "New", tone: "neutral" },
};

export default async function TrainingPage() {
  const today = todayISO();
  const data = await loadTraining();
  const sql = await db();
  const legacy = await sql<{ date: string }[]>`select date from habit_logs where gym = true`;
  const extraGym = legacy.map((r) => r.date);

  const unit = data.settings.unit;
  const notes = coachNotes(data, today, extraGym);
  const lifts = exerciseSummaries(data);
  const weeks = weeklySessions(data, 12, today, extraGym);
  const vol = setsPerMuscle(data, 4, today);
  const rs = runStats(data, today);
  const thisWeek = weeks[weeks.length - 1];

  const allDays = [...new Set([...data.workouts.map((w) => w.date), ...extraGym])].sort();
  const lastDay = allDays[allDays.length - 1];
  const gap = lastDay ? daysBetween(lastDay, today) : null;

  const setsIn = (from: string, to: string) =>
    data.workouts.filter((w) => w.date >= from && w.date <= to).reduce((a, w) => a + w.sets.length, 0);
  const sets28 = setsIn(addDays(today, -27), today);
  const setsPrev28 = setsIn(addDays(today, -55), addDays(today, -28));
  const setsChange = setsPrev28 >= 20 ? ((sets28 - setsPrev28) / setsPrev28) * 100 : null;

  const estimatedCount = data.workouts.filter((w) => w.date_estimated).length;

  const liftOptions: LiftOption[] = lifts
    .filter((l) => l.sessions.length > 0)
    .sort((a, b) => b.sessions.length - a.sessions.length)
    .map((l) => ({
      name: l.name,
      muscle: l.muscle,
      bodyweight: l.bodyweight,
      status: l.status,
      sessions: l.sessions.map((s) => ({
        date: s.date,
        label: fShort(s.date),
        estimated: s.estimated,
        best: s.best,
        topWeight: s.topWeight,
        sets: s.sets,
      })),
    }));

  return (
    <>
      <PageHeader
        title="Training"
        sub="Gym and running, read the way a coach would."
        actions={
          <>
            <LinkButton href="/training/run" variant="secondary">
              <Footprints size={15} /> Log run
            </LinkButton>
            <LinkButton href="/training/log">
              <Plus size={15} /> Log workout
            </LinkButton>
          </>
        }
      />

      {estimatedCount > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[13.5px] text-ink-2">
          <Info size={16} className="mt-0.5 shrink-0 text-accent" />
          <p>
            {estimatedCount} sessions came from your gym notes, which had no dates, so their dates are estimates (marked with *). Fix them under{" "}
            <a href="#sessions" className="font-medium text-ink underline decoration-line-strong underline-offset-2">
              Recent sessions
            </a>{" "}
            and every chart updates.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Gym this week"
          value={thisWeek.gym}
          unit={`/ ${data.settings.gymTarget}`}
          progress={(thisWeek.gym / data.settings.gymTarget) * 100}
          tone={thisWeek.gym >= data.settings.gymTarget ? "good" : undefined}
          meta={thisWeek.gym >= data.settings.gymTarget ? "Target hit" : `${data.settings.gymTarget - thisWeek.gym} to go`}
        />
        <Stat
          label="Since last session"
          value={gap == null ? "–" : gap}
          unit={gap === 1 ? "day" : "days"}
          meta={lastDay ? `${fDow(lastDay)} ${fShort(lastDay)}` : "Nothing logged yet"}
        />
        <Stat
          label="Working sets, 28 days"
          value={sets28}
          meta={
            setsChange != null ? (
              <>
                <Delta value={setsChange} /> vs the 28 days before
              </>
            ) : (
              "Across all lifts"
            )
          }
        />
        <Stat
          label="Running this week"
          value={rs.kmThisWeek.toFixed(1)}
          unit="km"
          meta={rs.count ? `${thisWeek.run} of ${data.settings.runTarget} runs` : "No runs logged yet"}
        />
      </div>

      {/* Coach */}
      <Card title="Coach's notes" sub="What your logs say right now, most important first." className="mt-4">
        <ul className="grid gap-x-8 gap-y-1 md:grid-cols-2">
          {notes.map((n, i) => (
            <InsightRow key={i} n={n} />
          ))}
        </ul>
      </Card>

      {/* Frequency + volume */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card title="Sessions per week" sub="Last 12 weeks, Monday to Sunday. Dashed line is your target." className="lg:col-span-3">
          <WeeklyColumns data={weeks} dataKey="gym" target={data.settings.gymTarget} unitLabel="Sessions" />
        </Card>
        <Card title="Weekly sets per muscle" sub="4-week average. The shaded band is the 10 to 20 sets most research recommends." className="lg:col-span-2">
          <MuscleBars rows={vol} />
        </Card>
      </div>

      {/* Lifts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card title="Lift progress" sub="Pick a lift. Estimated 1-rep max blends weight and reps, so it rises when either goes up." className="lg:col-span-3">
          {liftOptions.length ? <LiftExplorer lifts={liftOptions} unit={unit} /> : <Empty>Log a workout to see your lifts here.</Empty>}
        </Card>
        <Card title="Next time in the gym" sub="What to aim for on each lift, based on your last session." className="lg:col-span-2" pad={false}>
          <ul className="divide-y divide-line">
            {lifts.map((l) => (
              <li key={l.name} className="px-5 py-3 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[14px] font-medium">{l.name}</span>
                  <Badge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-3 text-[12.5px] text-ink-3">
                  <span className="truncate">{l.advice}</span>
                  {l.changePct != null && !l.bodyweight && (
                    <span className="shrink-0">
                      <Delta value={l.changePct} />
                    </span>
                  )}
                </div>
              </li>
            ))}
            {!lifts.length && <li className="px-6 pb-6 text-[13.5px] text-ink-3">Nothing yet.</li>}
          </ul>
        </Card>
      </div>

      {/* Running */}
      <h2 className="mb-3 mt-10 text-[17px] font-semibold tracking-tight">Running</h2>
      {rs.count === 0 ? (
        <Card>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[14px] font-medium">No runs logged yet</p>
              <p className="mt-0.5 text-[13px] text-ink-3">
                Log distance and time and you get weekly kilometres, pace trends and a warning if mileage jumps too fast. Strava import can plug in here later.
              </p>
            </div>
            <LinkButton href="/training/run" variant="secondary">
              <Footprints size={15} /> Log a run
            </LinkButton>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label="This week" value={rs.kmThisWeek.toFixed(1)} unit="km" meta={`Last week ${rs.lastWeekKm.toFixed(1)} km`} />
            <Stat label="4-week average" value={rs.avg4.toFixed(1)} unit="km / wk" />
            <Stat label="Average pace, 4 weeks" value={rs.avgPace4w ? paceStr(rs.avgPace4w) : "–"} unit="/km" />
            <Stat label="Longest run" value={rs.longest.toFixed(1)} unit="km" meta={`${rs.totalKm.toFixed(0)} km logged in total`} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card title="Kilometres per week" sub="Last 12 weeks.">
              <WeeklyColumns data={weeks} dataKey="km" unitLabel="km" color="var(--s3)" minTop={10} decimals={1} />
            </Card>
            <Card title="Pace per run" sub="Minutes per km, faster is higher.">
              <TimeLine
                data={rs.pacePts.map((p) => ({ label: fShort(p.date), tip: `${fShort(p.date)} · ${p.km.toFixed(1)} km ${p.kind}`, pace: Math.round(p.pace) }))}
                series={[{ key: "pace", name: "Pace", color: "var(--s3)" }]}
                format="pace"
                unit="/km"
                reversed
                height={220}
              />
            </Card>
          </div>
          <Card title="Recent runs" className="mt-4" pad={false}>
            <ul className="divide-y divide-line">
              {rs.runs
                .slice()
                .reverse()
                .slice(0, 8)
                .map((r) => (
                  <li key={r.id} className="flex items-center gap-4 px-5 py-3 sm:px-6">
                    <DateChip date={r.date} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium tnum">
                        {r.distance_km.toFixed(2)} km <span className="font-normal text-ink-3">in {durStr(r.duration_sec)}</span>
                      </div>
                      <div className="text-[12.5px] text-ink-3">
                        {paceStr(r.duration_sec / r.distance_km)} /km · {RUN_KINDS.find((k) => k.id === r.kind)?.label || r.kind}
                        {r.avg_hr ? ` · ${r.avg_hr} bpm` : ""}
                        {r.notes ? ` · ${r.notes}` : ""}
                      </div>
                    </div>
                    <Link href={`/training/run?id=${r.id}`} className="inline-flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Edit run">
                      <Pencil size={14} />
                    </Link>
                    <DeleteButton action={deleteRun} id={r.id} label="run" />
                  </li>
                ))}
            </ul>
          </Card>
        </>
      )}

      {/* Sessions */}
      <h2 id="sessions" className="mb-3 mt-10 scroll-mt-24 text-[17px] font-semibold tracking-tight">
        Recent sessions
      </h2>
      <Card pad={false}>
        {data.workouts.length ? (
          <ul className="divide-y divide-line">
            {data.workouts.slice(0, 20).map((w) => {
              const exs = [...new Set(w.sets.map((s) => s.exercise))];
              return (
                <li key={w.id} className="flex items-start gap-4 px-5 py-3.5 sm:px-6">
                  <DateChip date={w.date} estimated={w.date_estimated} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium">{SESSION_KINDS.find((k) => k.id === w.kind)?.label || w.kind}</span>
                      <span className="text-[12.5px] text-ink-3">
                        {exs.length} exercises · {w.sets.length} sets
                      </span>
                      {w.date_estimated && <Badge tone="warn">Date estimated</Badge>}
                    </div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">
                      {exs
                        .map((e) => {
                          const ss = w.sets.filter((s) => s.exercise === e);
                          const top = Math.max(...ss.map((s) => s.weight));
                          return `${e} ${top ? fmtW(top) + " " + ss[0].unit : "BW"} × ${ss.map((s) => s.reps).join("/")}`;
                        })
                        .join("  ·  ")}
                    </p>
                  </div>
                  <Link href={`/training/log?id=${w.id}`} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Edit session">
                    <Pencil size={14} />
                  </Link>
                  <DeleteButton action={deleteWorkout} id={w.id} label="session" />
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-6">
            <Empty>No sessions yet.</Empty>
          </div>
        )}
      </Card>
    </>
  );
}

function InsightRow({ n }: { n: Insight }) {
  const Icon = n.tone === "good" ? CircleCheck : n.tone === "bad" ? CircleAlert : n.tone === "warn" ? TriangleAlert : Info;
  const color = n.tone === "good" ? "text-good" : n.tone === "bad" ? "text-bad" : n.tone === "warn" ? "text-warn" : "text-accent";
  return (
    <li className="flex gap-3 py-2.5">
      <Icon size={17} className={`mt-[2px] shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="text-[14px] font-medium leading-snug">{n.title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{n.body}</p>
      </div>
    </li>
  );
}

function MuscleBars({ rows }: { rows: { muscle: string; perWeek: number }[] }) {
  const [lo, hi] = WEEKLY_SET_RANGE;
  const max = Math.max(24, ...rows.map((r) => r.perWeek));
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <div>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const tone = r.perWeek === 0 ? "text-bad" : r.perWeek < lo ? "text-ink-2" : "text-ink";
          return (
            <div key={r.muscle} className="grid grid-cols-[84px_1fr_36px] items-center gap-3 text-[13px]">
              <span className="truncate text-ink-2">{r.muscle}</span>
              <div className="relative h-[14px] rounded-[4px] bg-surface-2">
                <div className="absolute inset-y-0 rounded-[3px] bg-good/12" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} />
                {r.perWeek > 0 && (
                  <div className="absolute inset-y-[2px] left-0 rounded-r-[4px] bg-[var(--s1)]" style={{ width: pct(r.perWeek) }} title={`${r.perWeek} sets per week`} />
                )}
              </div>
              <span className={`text-right font-medium tnum ${tone}`}>{r.perWeek === 0 ? "0" : r.perWeek}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-[84px_1fr_36px] gap-3 text-[11px] text-ink-3">
        <span />
        <div className="relative h-3 font-mono">
          <span className="absolute -translate-x-1/2" style={{ left: pct(lo) }}>
            {lo}
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: pct(hi) }}>
            {hi}
          </span>
        </div>
        <span className="text-right">sets</span>
      </div>
    </div>
  );
}

function DateChip({ date, estimated }: { date: string; estimated?: boolean }) {
  const d = new Date(date + "T12:00:00Z");
  return (
    <div className="w-11 shrink-0 rounded-lg border border-line bg-surface-2 py-1 text-center leading-tight" title={estimated ? "Estimated date" : undefined}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}</div>
      <div className="text-[17px] font-semibold tnum">
        {d.getUTCDate()}
        {estimated && <span className="text-[11px] text-warn">*</span>}
      </div>
    </div>
  );
}
