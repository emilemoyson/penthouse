import { ArrowUpRight, Check, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { loadHabits, GUIDE, GUIDE_TOTAL, QLEVELS, QTOTAL, LC, COURSES, C_HOURS, CLAUDE, slug, type HabitsData } from "@/lib/habits";
import { addDays, daysBetween, fDow, fLong, fShort, fMonth, fDay, lastNDays, mondayOf, relDay, todayISO } from "@/lib/dates";
import { Badge, Card, Empty, PageHeader, Segmented, Stat, btn } from "@/components/ui";
import { DailyColumns, TimeLine } from "@/components/charts";
import { CheckIn, NumberSave, ActionButton } from "./client";
import { addBook, addEvent, cycleBook, deleteBook, deleteEvent, setLeetcode, setQuestions, toggleCourse, toggleGuide } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Habits" };

const VIEWS = [
  { id: "today", label: "Today" },
  { id: "quant", label: "Quant prep" },
  { id: "claude", label: "Master in Claude" },
  { id: "reading", label: "Reading" },
];
const TARGET = { gym: 3, run: 2, read: 7 };

export default async function HabitsPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.id === sp.view) ? sp.view! : "today";
  const today = todayISO();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const h = await loadHabits();

  return (
    <>
      <PageHeader title="Habits" sub={fLong(today)} actions={<Segmented active={view} items={VIEWS.map((v) => ({ ...v, href: v.id === "today" ? "/habits" : `/habits?view=${v.id}` }))} />} />
      {view === "today" && <TodayView h={h} today={today} date={date} />}
      {view === "quant" && <QuantView h={h} today={today} />}
      {view === "claude" && <ClaudeView h={h} today={today} />}
      {view === "reading" && <ReadingView h={h} today={today} />}
    </>
  );
}

/* ------------------------------------------------------------------ */

const readMin = (h: HabitsData, d: string) => h.byDate.get(d)?.read_min || 0;

function readingStreak(h: HabitsData, today: string) {
  let n = 0;
  let c = today;
  if (!readMin(h, c)) c = addDays(c, -1);
  while (readMin(h, c) > 0) {
    n++;
    c = addDays(c, -1);
  }
  return n;
}

function claudeProgress(h: HabitsData, today: string) {
  const doneSet = h.progress.datacamp.done || {};
  const doneCourses = COURSES.filter((c) => doneSet[c.slug]);
  const hours = doneCourses.reduce((a, c) => a + c.hours, 0);
  const span = daysBetween(CLAUDE.start, CLAUDE.courseTarget);
  const el = Math.max(0, Math.min(span, daysBetween(CLAUDE.start, today)));
  const expected = (C_HOURS * el) / span;
  return { done: doneCourses.length, hours, expected };
}

function TodayView({ h, today, date }: { h: HabitsData; today: string; date: string }) {
  const log = h.byDate.get(date) || { date, read_min: null, zetamac: null, gym: false, run: false, note: "" };
  const week = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(date), i));
  const pace = [
    { label: "Gym", hit: (d: string) => h.gymDays.has(d), target: TARGET.gym },
    { label: "Run", hit: (d: string) => h.runSet.has(d), target: TARGET.run },
    { label: "Reading", hit: (d: string) => readMin(h, d) > 0, target: TARGET.read },
  ];
  const z30 = lastNDays(30, today)
    .map((d) => h.byDate.get(d)?.zetamac)
    .filter((v): v is number => v != null);
  const zBest = z30.length ? Math.max(...z30) : null;
  const cp = claudeProgress(h, today);
  const oq = Object.values(h.progress.questions.byLevel || {}).reduce((a, b) => a + Number(b || 0), 0);
  const upcoming = h.events.filter((e) => e.date >= today).slice(0, 7);
  const recent = h.logs
    .filter((l) => l.read_min || l.zetamac != null || l.gym || l.run || l.note)
    .slice(-12)
    .reverse();

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <CheckIn
          date={date}
          label={date === today ? "Today" : fLong(date)}
          log={log}
          autoGym={h.autoGym.has(date)}
          autoRun={h.autoRun.has(date)}
          prevHref={`/habits?date=${addDays(date, -1)}`}
          nextHref={date < today ? (addDays(date, 1) === today ? "/habits" : `/habits?date=${addDays(date, 1)}`) : null}
        />
        <Card title="This week" sub={`Week of ${fShort(week[0])}. Gym and runs fill in automatically from Training.`}>
          <div className="space-y-3">
            {pace.map((p) => {
              const n = week.filter(p.hit).length;
              return (
                <div key={p.label} className="grid grid-cols-[72px_1fr_56px] items-center gap-3">
                  <span className="text-[13.5px] font-medium text-ink-2">{p.label}</span>
                  <div className="grid grid-cols-7 gap-1.5">
                    {week.map((d) => (
                      <div
                        key={d}
                        title={`${fDow(d)} ${fShort(d)}`}
                        className={clsx(
                          "flex h-7 items-center justify-center rounded-md text-[10.5px] font-medium",
                          p.hit(d) ? "bg-[var(--s1)] text-white" : d > today ? "bg-surface-2/50 text-ink-3/50" : "bg-surface-2 text-ink-3",
                          d === date && "ring-2 ring-ink ring-offset-1 ring-offset-surface",
                        )}
                      >
                        {fDow(d).slice(0, 1)}
                      </div>
                    ))}
                  </div>
                  <span className={clsx("text-right text-[13px] font-medium tnum", n >= p.target ? "text-good" : "text-ink-2")}>
                    {n}/{p.target}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Recent entries" pad={false}>
          {recent.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-[13.5px]">
                <thead>
                  <tr className="border-y border-line bg-surface-2/60 text-left text-[12px] text-ink-3">
                    <th className="py-2 pl-5 pr-4 font-medium sm:pl-6">Day</th>
                    <th className="py-2 pr-4 font-medium">Reading</th>
                    <th className="py-2 pr-4 font-medium">Zetamac</th>
                    <th className="py-2 pr-4 font-medium">Gym</th>
                    <th className="py-2 pr-5 font-medium sm:pr-6">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((l) => (
                    <tr key={l.date} className="border-b border-line/70 last:border-0">
                      <td className="py-2.5 pl-5 pr-4 whitespace-nowrap sm:pl-6">
                        <a href={`/habits?date=${l.date}`} className="hover:underline">
                          {fDow(l.date)} {fShort(l.date)}
                        </a>
                      </td>
                      <td className="py-2.5 pr-4 tnum">{l.read_min ? `${l.read_min} min` : <span className="text-ink-3">–</span>}</td>
                      <td className="py-2.5 pr-4 tnum">{l.zetamac ?? <span className="text-ink-3">–</span>}</td>
                      <td className="py-2.5 pr-4">{h.gymDays.has(l.date) ? <Check size={15} className="text-accent" /> : <span className="text-ink-3">–</span>}</td>
                      <td className="max-w-[220px] truncate py-2.5 pr-5 text-ink-2 sm:pr-6">{l.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 pb-6">
              <Empty>Nothing logged yet.</Empty>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Stat label="Reading streak" value={readingStreak(h, today)} unit={readingStreak(h, today) === 1 ? "day" : "days"} />
          <Stat label="Zetamac best" value={zBest ?? "–"} meta="Last 30 days" />
          <Stat label="Claude courses" value={cp.done} unit="/ 10" progress={cp.done * 10} />
          <Stat label="OpenQuant" value={oq} unit={`/ ${QTOTAL}`} progress={(oq / QTOTAL) * 100} />
        </div>
        <Card title="Up next" sub="School and personal dates." pad={false}>
          <ul className="divide-y divide-line">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-5 py-3 sm:px-6">
                <div className="w-11 shrink-0 rounded-lg border border-line bg-surface-2 py-1 text-center leading-tight">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{fMonth(e.date)}</div>
                  <div className="text-[17px] font-semibold tnum">{fDay(e.date)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium leading-snug">{e.title}</div>
                  {e.note && <div className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-3">{e.note}</div>}
                  <div className="mt-1.5 flex gap-1.5">
                    <Badge tone={daysBetween(today, e.date) <= 2 ? "warn" : "neutral"}>{relDay(e.date, today)}</Badge>
                    <Badge>{e.kind === "school" ? "IE NYC" : "Personal"}</Badge>
                  </div>
                </div>
                <ActionButton action={deleteEvent.bind(null, e.id)} label={`Remove ${e.title}`} className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
                  <X size={14} />
                </ActionButton>
              </li>
            ))}
            {!upcoming.length && <li className="px-6 pb-4 text-[13.5px] text-ink-3">Nothing coming up.</li>}
          </ul>
          <form action={addEvent} className="grid grid-cols-[1fr_auto] gap-2 border-t border-line px-5 py-4 sm:px-6">
            <input name="title" placeholder="Add a date" className="field h-9 text-[13.5px]" required />
            <input name="date" type="date" min={today} className="field h-9 w-[150px] text-[13.5px]" required />
            <select name="kind" className="field h-9 text-[13.5px]" defaultValue="personal">
              <option value="personal">Personal</option>
              <option value="school">IE NYC</option>
            </select>
            <button className={btn.primary}>Add</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function QuantView({ h, today }: { h: HabitsData; today: string }) {
  const done = h.progress.guide.done || {};
  const guideCount = Object.values(done).filter(Boolean).length;
  const by = h.progress.questions.byLevel || {};
  const oq = Object.values(by).reduce((a, b) => a + Number(b || 0), 0);
  const lc = h.progress.leetcode || {};
  const lcTotal = (lc.easy || 0) + (lc.medium || 0) + (lc.hard || 0);
  const zpts = h.logs.filter((l) => l.zetamac != null && daysBetween(l.date, today) <= 90);
  const zAll = h.logs.filter((l) => l.zetamac != null).map((l) => l.zetamac!);
  const last5 = zpts.slice(-5).map((l) => l.zetamac!);
  const avg5 = last5.length ? Math.round(last5.reduce((a, b) => a + b, 0) / last5.length) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Theory topics" value={guideCount} unit={`/ ${GUIDE_TOTAL}`} progress={(guideCount / GUIDE_TOTAL) * 100} meta="OpenQuant study guide" />
        <Stat label="OpenQuant questions" value={oq} unit={`/ ${QTOTAL}`} progress={(oq / QTOTAL) * 100} meta="Levels 1 to 10" />
        <Stat label="LeetCode solved" value={lcTotal} meta="Easy, medium and hard" />
        <Stat label="Zetamac best" value={zAll.length ? Math.max(...zAll) : "–"} meta={avg5 != null ? `Average of last 5: ${avg5}` : "No games logged"} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Zetamac scores" sub="One point per logged game, last 90 days. Log scores in the Today check-in.">
          {zpts.length > 1 ? (
            <TimeLine data={zpts.map((l) => ({ label: fShort(l.date), score: l.zetamac }))} series={[{ key: "score", name: "Score", color: "var(--s1)" }]} height={220} />
          ) : (
            <Empty>Log a couple of games to see the trend.</Empty>
          )}
        </Card>
        <Card title="LeetCode" sub="Solved counts by difficulty. Saves when you leave the field.">
          <div className="grid grid-cols-3 gap-3">
            {LC.map(([d, total]) => (
              <label key={d} className="block">
                <span className="mb-1 block text-[12.5px] font-medium text-ink-2">{d}</span>
                <NumberSave value={lc[d.toLowerCase() as "easy"]} action={setLeetcode.bind(null, d.toLowerCase() as "easy")} max={total} label={`LeetCode ${d} solved`} />
                <span className="mt-1 block text-[11.5px] text-ink-3">of {total.toLocaleString()}</span>
              </label>
            ))}
          </div>
        </Card>
      </div>
      <Card title="OpenQuant study guide" sub="Tick a topic when you've finished it on openquant.co." className="mt-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE.map((g) => {
            const n = g.topics.filter((t) => done[slug(t)]).length;
            return (
              <div key={g.sec} className="rounded-xl bg-surface-2 p-3 ring-1 ring-inset ring-line">
                <div className="mb-1 flex justify-between text-[13px] font-semibold">
                  {g.sec}
                  <span className="font-mono font-normal text-ink-3">
                    {n}/{g.topics.length}
                  </span>
                </div>
                {g.topics.map((t) => {
                  const on = !!done[slug(t)];
                  return (
                    <ActionButton key={t} action={toggleGuide.bind(null, slug(t))} pressed={on} className="flex w-full items-center gap-2.5 py-1.5 text-left text-[13.5px]">
                      <span className={clsx("grid size-4 shrink-0 place-items-center rounded-[4px] border-[1.5px]", on ? "border-accent bg-accent text-white" : "border-ink-3")}>{on && <Check size={11} strokeWidth={3} />}</span>
                      <span className={on ? "text-ink-3 line-through" : ""}>{t}</span>
                    </ActionButton>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="OpenQuant questions by level" sub="How many you've solved at each difficulty, out of what exists." className="mt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {QLEVELS.map(([lvl, total]) => (
            <label key={lvl} className={clsx("block rounded-xl bg-surface-2 p-3 ring-1 ring-inset ring-line", !total && "opacity-50")}>
              <span className="mb-1 flex justify-between text-[12.5px] font-medium text-ink-2">
                Level {lvl}
                <span className="font-normal text-ink-3">of {total}</span>
              </span>
              {total ? <NumberSave value={by[lvl]} action={setQuestions.bind(null, lvl)} max={total} label={`Level ${lvl} solved`} /> : <div className="h-9 text-[12px] leading-9 text-ink-3">None yet</div>}
              {total > 0 && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(Number(by[lvl] || 0) / total) * 100}%` }} />
                </div>
              )}
            </label>
          ))}
        </div>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */

function ClaudeView({ h, today }: { h: HabitsData; today: string }) {
  const doneSet = h.progress.datacamp.done || {};
  const cp = claudeProgress(h, today);
  const daysLeft = Math.max(0, daysBetween(today, CLAUDE.courseTarget));
  const left = C_HOURS - cp.hours;
  const perWeek = daysLeft > 0 ? left / (daysLeft / 7) : left;
  const behind = cp.expected - cp.hours;
  const groups = [...new Set(COURSES.map((c) => c.group))];
  let idx = 0;
  const dates: [string, string, string][] = [
    [CLAUDE.courseTarget, "All ten courses finished", "Leaves time for the project and test prep."],
    [CLAUDE.projectOpen, "Project submissions open", "Update the goal in MyGrowthPlan first."],
    [CLAUDE.testOpen, "Final test window opens", "About 60 min, one attempt, booked slot."],
    [CLAUDE.projectDue, "Project deadline", "23:59 ET. Write-up, artifacts and demo video."],
    [CLAUDE.close, "Challenge closes", "DataCamp assignments expire."],
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Courses complete" value={cp.done} unit="/ 10" progress={cp.done * 10} />
        <Stat
          label="Hours done"
          value={Math.round(cp.hours * 10) / 10}
          unit={`/ ${C_HOURS} h`}
          progress={(cp.hours / C_HOURS) * 100}
          tone={behind > 1 ? "warn" : "good"}
          meta={behind > 1 ? `${Math.round(behind * 10) / 10} h behind the pace for Oct 25` : "On pace"}
        />
        <Stat label="Needed per week" value={left <= 0 ? 0 : Math.round(perWeek * 10) / 10} unit="h" meta={daysLeft ? `${daysLeft} days to Oct 25` : "Course target has passed"} />
        <Stat label="Next deadline" value={relDay(dates.find((d) => d[0] >= today)?.[0] || CLAUDE.close, today)} meta={dates.find((d) => d[0] >= today)?.[1] || "Done"} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card title="The ten courses" sub="Take them in order. Tick one off when DataCamp shows it complete." className="lg:col-span-3" pad={false}>
          {groups.map((g) => (
            <div key={g}>
              <div className="border-y border-line bg-surface-2/60 px-5 py-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-ink-3 sm:px-6">{g}</div>
              <ul className="divide-y divide-line">
                {COURSES.filter((c) => c.group === g).map((c) => {
                  idx++;
                  const on = !!doneSet[c.slug];
                  return (
                    <li key={c.slug} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                      <span className="w-5 text-right font-mono text-[12px] text-ink-3">{idx}</span>
                      <div className="min-w-0 flex-1">
                        <a href={`https://www.datacamp.com/courses/${c.slug}`} target="_blank" rel="noopener noreferrer" className={clsx("inline-flex items-center gap-1 text-[14px] font-medium hover:underline", on && "text-ink-3")}>
                          {c.title} <ArrowUpRight size={12} className="text-ink-3" />
                        </a>
                        <div className="text-[12px] text-ink-3">{c.hours} h</div>
                      </div>
                      <ActionButton
                        action={toggleCourse.bind(null, c.slug)}
                        pressed={on}
                        className={clsx(
                          "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition",
                          on ? "bg-good-soft text-good" : "text-ink-2 ring-1 ring-inset ring-line hover:bg-surface-2",
                        )}
                      >
                        {on ? (
                          <>
                            <Check size={13} /> Done
                          </>
                        ) : (
                          "Mark done"
                        )}
                      </ActionButton>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Card>
        <Card title="Key dates" className="lg:col-span-2" pad={false}>
          <ul className="divide-y divide-line">
            {dates.map(([d, t, n]) => (
              <li key={d} className="flex items-start gap-3 px-5 py-3 sm:px-6">
                <div className="w-11 shrink-0 rounded-lg border border-line bg-surface-2 py-1 text-center leading-tight">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{fMonth(d)}</div>
                  <div className="text-[17px] font-semibold tnum">{fDay(d)}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium">{t}</div>
                  <div className="text-[12.5px] text-ink-3">{n}</div>
                  <div className="mt-1">{d >= today ? <Badge tone={daysBetween(today, d) <= 7 ? "warn" : "neutral"}>{relDay(d, today)}</Badge> : <Badge>Passed</Badge>}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function ReadingView({ h, today }: { h: HabitsData; today: string }) {
  const days = lastNDays(30, today);
  const d7 = lastNDays(7, today);
  const sum = (a: string[]) => a.reduce((x, d) => x + readMin(h, d), 0);
  const daysRead = days.filter((d) => readMin(h, d) > 0).length;
  let best = 0;
  let run = 0;
  lastNDays(180, today).forEach((d) => {
    if (readMin(h, d) > 0) {
      run++;
      best = Math.max(best, run);
    } else run = 0;
  });
  const order: Record<string, number> = { reading: 0, next: 1, finished: 2 };
  const books = [...h.books].sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Current streak" value={readingStreak(h, today)} unit={readingStreak(h, today) === 1 ? "day" : "days"} meta={`Longest: ${best} day${best === 1 ? "" : "s"}`} />
        <Stat label="Last 7 days" value={sum(d7)} unit="min" meta={`${d7.filter((d) => readMin(h, d) > 0).length} of 7 days read`} progress={(d7.filter((d) => readMin(h, d) > 0).length / 7) * 100} />
        <Stat label="Days read, 30 days" value={daysRead} unit="/ 30" progress={(daysRead / 30) * 100} />
        <Stat label="Average sitting" value={daysRead ? Math.round(sum(days) / daysRead) : 0} unit="min" meta="On days you read" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card title="Minutes read per day" sub="Last 30 days. Log minutes in the Today check-in." className="lg:col-span-3">
          <DailyColumns data={days.map((d) => ({ date: d, label: fShort(d), value: readMin(h, d) }))} unitLabel="Minutes" height={230} />
        </Card>
        <Card title="Books" sub="Move steps a book from Up next to Reading to Finished." className="lg:col-span-2" pad={false}>
          <ul className="divide-y divide-line">
            {books.map((b) => (
              <li key={b.id} className="flex items-center gap-2 px-5 py-3 sm:px-6">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{b.title}</div>
                  {b.author && <div className="truncate text-[12.5px] text-ink-3">{b.author}</div>}
                </div>
                <Badge tone={b.status === "reading" ? "accent" : b.status === "finished" ? "good" : "neutral"}>{b.status === "next" ? "Up next" : b.status === "finished" ? "Finished" : "Reading"}</Badge>
                <ActionButton action={cycleBook.bind(null, b.id)} className={btn.ghost}>
                  Move
                </ActionButton>
                <ActionButton action={deleteBook.bind(null, b.id)} label={`Remove ${b.title}`} className="inline-flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-bad-soft hover:text-bad">
                  <Trash2 size={14} />
                </ActionButton>
              </li>
            ))}
            {!books.length && <li className="px-6 pb-2 text-[13.5px] text-ink-3">No books yet. Add what you&apos;re reading now.</li>}
          </ul>
          <form action={addBook} className="grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-line px-5 py-4 sm:px-6">
            <input name="title" placeholder="Title" className="field h-9 text-[13.5px]" required />
            <input name="author" placeholder="Author" className="field h-9 text-[13.5px]" />
            <button className={btn.primary}>Add</button>
          </form>
        </Card>
      </div>
    </>
  );
}
