import { ArrowUpRight, CalendarClock, CircleAlert, ExternalLink, Info, RefreshCw, Send, Hourglass } from "lucide-react";
import { loadJobs, jobAnalytics, SHEET_URL, STAGES, CLOSED } from "@/lib/jobs";
import { fShort, todayISO } from "@/lib/dates";
import { Badge, Card, Empty, PageHeader, Stat, btn } from "@/components/ui";
import { WeeklyColumns } from "@/components/charts";
import { JobsTable } from "./jobs-table";
import { CopyButton } from "./copy-button";
import { refreshJobs } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs" };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export default async function JobsPage() {
  const res = await loadJobs();
  const today = todayISO();

  const header = (sub: React.ReactNode) => (
    <PageHeader
      title="Job search"
      sub={sub}
      actions={
        <>
          <form action={refreshJobs}>
            <button className={btn.secondary}>
              <RefreshCw size={14} /> Refresh
            </button>
          </form>
          <a href={SHEET_URL} target="_blank" rel="noopener noreferrer" className={btn.primary}>
            Open sheet <ExternalLink size={14} />
          </a>
        </>
      }
    />
  );

  if (!res.ok) {
    return (
      <>
        {header("Live view of your Job Search 2027 sheet.")}
        <Card title={res.reason === "not_configured" ? "Connect your sheet" : "Couldn't load the sheet"}>
          <p className="text-[14px] text-ink-2">
            {res.reason === "not_configured"
              ? "Add JOBS_SHEET_URL and JOBS_SHEET_TOKEN in Vercel (Settings → Environment Variables), then redeploy. The setup guide in the project's README walks through it in about five minutes."
              : res.message}
          </p>
        </Card>
      </>
    );
  }

  const { jobs, contacts, settings } = res;
  const a = jobAnalytics(jobs, contacts, settings, today);
  const maxStage = Math.max(1, ...a.stageCounts.map((s) => s.count));

  return (
    <>
      {header(
        <>
          Live from <span className="font-medium text-ink">Job Search 2027</span> · updated {ago(res.updatedAt)}
          {res.demo && <Badge className="ml-2">Local snapshot</Badge>}
        </>,
      )}

      {a.missingDates.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[13.5px] text-ink-2">
          <Info size={16} className="mt-0.5 shrink-0 text-accent" />
          <p>
            {a.missingDates.length} jobs are marked <span className="font-medium text-ink">Applied</span> but have no application date in the sheet (
            {a.missingDates
              .slice(0, 4)
              .map((j) => j.company)
              .join(", ")}
            {a.missingDates.length > 4 ? "…" : ""}). Add the dates, or set them back to <span className="font-medium text-ink">To apply</span> if you haven&apos;t sent them yet, so the weekly
            counts are right.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Applications this week"
          value={a.appsThisWeek}
          unit={`/ ${settings.appTarget}`}
          progress={(a.appsThisWeek / settings.appTarget) * 100}
          tone={a.appsThisWeek >= settings.appTarget ? "good" : undefined}
          meta={a.appsThisWeek >= settings.appTarget ? "Target hit" : `${settings.appTarget - a.appsThisWeek} to go by Sunday`}
        />
        <Stat
          label="Outreach this week"
          value={a.outreachThisWeek}
          unit={`/ ${settings.outreachTarget}`}
          progress={(a.outreachThisWeek / settings.outreachTarget) * 100}
          tone={a.outreachThisWeek >= settings.outreachTarget ? "good" : undefined}
          meta={`${a.toSend.length} message${a.toSend.length === 1 ? "" : "s"} drafted and ready`}
        />
        <Stat label="In progress" value={a.active} meta={`${a.interviews} at interview stage`} />
        <Stat
          label="Response rate"
          value={a.responseRate == null ? "–" : Math.round(a.responseRate * 100)}
          unit={a.responseRate == null ? undefined : "%"}
          meta={`${a.responded} of ${a.applied} applications heard back`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card title="Pipeline" sub="Every job in the sheet by its current status." className="lg:col-span-2">
          <div className="space-y-2">
            {a.stageCounts
              .filter((s) => (STAGES as readonly string[]).includes(s.status))
              .map((s) => (
                <StageRow key={s.status} label={s.status} count={s.count} max={maxStage} color="var(--s1)" />
              ))}
            <div className="my-3 border-t border-line" />
            {a.stageCounts
              .filter((s) => (CLOSED as readonly string[]).includes(s.status))
              .map((s) => (
                <StageRow key={s.status} label={s.status} count={s.count} max={maxStage} color="var(--ink-3)" />
              ))}
          </div>
        </Card>
        <Card title="Applications per week" sub={`Last 8 weeks, by date applied. Dashed line is your target of ${settings.appTarget}.`} className="lg:col-span-3">
          <WeeklyColumns data={a.weeks} dataKey="apps" target={settings.appTarget} unitLabel="Applications" minTop={settings.appTarget + 2} height={250} />
        </Card>
      </div>

      {/* Next actions */}
      <h2 className="mb-3 mt-10 text-[17px] font-semibold tracking-tight">Next actions</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Apply next" sub="Soonest deadline first, then freshest posting." pad={false}>
          <ul className="divide-y divide-line">
            {a.toApply.slice(0, 6).map((j) => (
              <li key={j.id} className="px-5 py-3 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">{j.company}</div>
                    <div className="truncate text-[12.5px] text-ink-3" title={j.role}>
                      {j.role}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {j.daysLeft != null && (
                        <Badge tone={j.daysLeft < 0 ? "bad" : j.daysLeft <= 7 ? "warn" : "neutral"}>
                          <CalendarClock size={11} />
                          {j.daysLeft < 0 ? "Deadline passed" : j.daysLeft === 0 ? "Due today" : `${j.daysLeft} days left`}
                        </Badge>
                      )}
                      {j.age != null && j.age > 120 && <Badge tone="warn">Posted {Math.round(j.age / 30)} months ago</Badge>}
                      {j.eligible === "Check" && <Badge>Check eligibility</Badge>}
                    </div>
                  </div>
                  {j.link && (
                    <a href={j.link} target="_blank" rel="noopener noreferrer" className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-accent-soft hover:text-accent-ink" aria-label={`Open ${j.company} posting`}>
                      <ArrowUpRight size={15} />
                    </a>
                  )}
                </div>
              </li>
            ))}
            {!a.toApply.length && <li className="px-6 pb-6 text-[13.5px] text-ink-3">Nothing queued. The job finder adds new ones to the sheet.</li>}
          </ul>
        </Card>

        <Card title="Messages to send" sub="Drafted outreach, ready to copy into LinkedIn." pad={false}>
          <ul className="divide-y divide-line">
            {a.toSend.slice(0, 4).map((c) => (
              <li key={c.id} className="px-5 py-3 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">{c.name}</div>
                    <div className="truncate text-[12.5px] text-ink-3">
                      {c.title} · {c.company}
                    </div>
                  </div>
                  {c.priority && <Badge tone={c.priority === "High" ? "warn" : "neutral"}>{c.priority}</Badge>}
                </div>
                {c.message && <p className="mt-2 line-clamp-3 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">{c.message}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.message && <CopyButton text={c.message} />}
                  {c.linkedin && (
                    <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-accent-ink hover:bg-accent-soft">
                      <Send size={13} /> LinkedIn
                    </a>
                  )}
                </div>
              </li>
            ))}
            {!a.toSend.length && <li className="px-6 pb-6 text-[13.5px] text-ink-3">No drafts waiting.</li>}
          </ul>
        </Card>

        <Card title="Needs a nudge" sub={`Follow-ups due, and applications quiet for ${settings.ghostDays}+ days.`} pad={false}>
          <ul className="divide-y divide-line">
            {a.followUps.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-5 py-3 sm:px-6">
                <Send size={15} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0 text-[13.5px]">
                  <span className="font-medium">Follow up with {c.name}</span>
                  <div className="text-[12.5px] text-ink-3">
                    {c.company} · due {c.followUp ? fShort(c.followUp) : ""}
                  </div>
                </div>
              </li>
            ))}
            {a.stale.map((j) => (
              <li key={j.id} className="flex items-start gap-3 px-5 py-3 sm:px-6">
                <Hourglass size={15} className="mt-0.5 shrink-0 text-warn" />
                <div className="min-w-0 text-[13.5px]">
                  <span className="font-medium">{j.company}</span>
                  <div className="truncate text-[12.5px] text-ink-3">
                    No news for {j.days} days. Mark as Ghosted or chase it.
                  </div>
                </div>
              </li>
            ))}
            {!a.followUps.length && !a.stale.length && (
              <li className="flex items-center gap-2 px-5 pb-6 text-[13.5px] text-ink-3 sm:px-6">
                <CircleAlert size={14} className="opacity-0" /> All quiet. Nothing overdue.
              </li>
            )}
          </ul>
        </Card>
      </div>

      {/* By area */}
      <Card title="By area" sub="Where your applications are going." className="mt-4" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13.5px]">
            <thead>
              <tr className="border-y border-line bg-surface-2/60 text-left text-[12px] text-ink-3">
                <th className="py-2 pl-5 pr-4 font-medium sm:pl-6">Area</th>
                <th className="py-2 pr-4 text-right font-medium">Tracked</th>
                <th className="py-2 pr-4 text-right font-medium">To apply</th>
                <th className="py-2 pr-4 text-right font-medium">Applied</th>
                <th className="py-2 pr-4 text-right font-medium">In progress</th>
                <th className="py-2 pr-4 text-right font-medium">Rejected</th>
                <th className="py-2 pr-5 text-right font-medium sm:pr-6">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {a.buckets.map((b) => (
                <tr key={b.bucket} className="border-b border-line/70 last:border-0">
                  <td className="py-2.5 pl-5 pr-4 font-medium sm:pl-6">{b.bucket}</td>
                  <td className="py-2.5 pr-4 text-right tnum">{b.tracked}</td>
                  <td className="py-2.5 pr-4 text-right tnum text-ink-2">{b.toApply || <span className="text-ink-3">–</span>}</td>
                  <td className="py-2.5 pr-4 text-right tnum text-ink-2">{b.applied || <span className="text-ink-3">–</span>}</td>
                  <td className="py-2.5 pr-4 text-right tnum text-ink-2">{b.active || <span className="text-ink-3">–</span>}</td>
                  <td className="py-2.5 pr-4 text-right tnum text-ink-2">{b.rejected || <span className="text-ink-3">–</span>}</td>
                  <td className="py-2.5 pr-5 text-right tnum text-ink-2 sm:pr-6">{b.contacts || <span className="text-ink-3">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <h2 className="mb-3 mt-10 text-[17px] font-semibold tracking-tight">All jobs</h2>
      <Card pad={false} className="pt-5 sm:pt-6">
        {jobs.length ? <JobsTable jobs={jobs} /> : <Empty>No jobs in the sheet yet.</Empty>}
      </Card>
    </>
  );
}

function StageRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  return (
    <div className="grid grid-cols-[150px_1fr_28px] items-center gap-3 text-[13px]">
      <span className={count ? "text-ink-2" : "text-ink-3"}>{label}</span>
      <div className="h-[14px] rounded-[4px] bg-surface-2">
        {count > 0 && <div className="h-full rounded-r-[4px]" style={{ width: `${(count / max) * 100}%`, background: color, minWidth: 6 }} />}
      </div>
      <span className={`text-right font-medium tnum ${count ? "" : "text-ink-3"}`}>{count}</span>
    </div>
  );
}
