import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { getSleepData } from "@/penthouse/data/server";
import { fDow } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bedroom" };

const hm = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;

export default async function BedroomPage() {
  const s = await getSleepData();
  const sample = s.source !== "live";
  const n = s.lastNight;
  const avg = s.week.filter((d) => d.totalMin > 0);
  const avgMin = avg.length ? avg.reduce((a, d) => a + d.totalMin, 0) / avg.length : 0;
  const max = Math.max(s.targetMin, ...s.week.map((d) => d.totalMin)) * 1.08;

  return (
    <>
      <PageHeader
        eyebrow="Bedroom"
        title="Sleep"
        sub={sample ? "Nothing real yet. Every number on this page is made-up sample data." : "From Apple Health, sent each morning by the iPhone Shortcut."}
        actions={<Badge tone={sample ? "warn" : "good"}>{sample ? "Sample data" : "Live"}</Badge>}
      />
      <div className={sample ? "opacity-70" : ""}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Last night" value={n ? hm(n.totalMin) : "–"} meta={n?.bedtime && n.waketime ? `${n.bedtime} to ${n.waketime}` : undefined} />
          <Stat label="7-day average" value={avgMin ? hm(avgMin) : "–"} meta={`target ${hm(s.targetMin)}`} progress={(avgMin / s.targetMin) * 100} />
          <Stat label="Deep + REM" value={n?.deepMin != null && n.remMin != null ? hm(n.deepMin + n.remMin) : "–"} />
          <Stat label="Resting heart rate" value={n?.rhr ?? "–"} unit={n?.rhr ? "bpm" : undefined} meta={n?.hrv ? `HRV ${n.hrv} ms` : undefined} />
        </div>
        <Card title="This week" sub="Hours asleep per night. The line is your target." className="mt-4">
          <div className="relative flex h-44 items-end gap-3">
            <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/60" style={{ bottom: `${(s.targetMin / max) * 100}%` }} />
            {s.week.map((d) => (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <div className="text-[11px] text-ink-3 tnum">{d.totalMin ? (d.totalMin / 60).toFixed(1) : ""}</div>
                <div className="w-full max-w-12 rounded-t-md bg-s2" style={{ height: `${(d.totalMin / max) * 100}%` }} />
                <div className="text-[11.5px] text-ink-3">{fDow(d.date)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {sample && (
        <Card title="Make it real" sub="A nightly iPhone Shortcut reads sleep from Apple Health and posts it here." className="mt-4">
          <ol className="list-decimal space-y-1.5 pl-5 text-[13.5px] text-ink-2">
            <li>Shortcuts app, Automation tab, New Automation, Time of Day: 9:00 AM, daily, Run Immediately.</li>
            <li>Add Find Health Samples: Sleep Analysis, start date in the last 1 day.</li>
            <li>Add Get Contents of URL: POST to <code className="font-mono text-[12.5px]">/api/ingest/sleep</code> on the live site, header Authorization: Bearer plus your ingest token, JSON body <code className="font-mono text-[12.5px]">{"{"} date, totalMin, deepMin, remMin, bedtime, waketime {"}"}</code>.</li>
            <li>Run it once by hand and this page switches from sample to live.</li>
          </ol>
        </Card>
      )}
    </>
  );
}
