"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { TimeLine, Legend } from "@/components/charts";

type Sess = {
  date: string;
  label: string;
  estimated: boolean;
  best: number;
  topWeight: number;
  sets: { weight: number; reps: number; alt: number | null }[];
};
export type LiftOption = {
  name: string;
  muscle: string;
  bodyweight: boolean;
  status: string;
  sessions: Sess[];
};

const fmt = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

export function LiftExplorer({ lifts, unit }: { lifts: LiftOption[]; unit: string }) {
  const [sel, setSel] = useState(lifts[0]?.name || "");
  const lift = useMemo(() => lifts.find((l) => l.name === sel) || lifts[0], [lifts, sel]);
  if (!lift) return null;

  const data = lift.sessions.map((s) => ({
    label: s.label,
    tip: `${s.label}${s.estimated ? " (estimated date)" : ""}`,
    best: Math.round(s.best * 10) / 10,
    top: s.topWeight,
  }));
  const series = lift.bodyweight
    ? [{ key: "best", name: "Best set (reps)", color: "var(--s1)" }]
    : [
        { key: "best", name: "Estimated 1-rep max", color: "var(--s1)" },
        { key: "top", name: "Top set weight", color: "var(--s2)", dashed: true },
      ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {lifts.map((l) => (
          <button
            key={l.name}
            onClick={() => setSel(l.name)}
            className={clsx(
              "rounded-full px-3 py-1 text-[12.5px] font-medium transition",
              l.name === lift.name ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line hover:text-ink",
            )}
          >
            {l.name}
          </button>
        ))}
      </div>

      {lift.sessions.length > 1 ? (
        <>
          <TimeLine data={data} series={series} unit={lift.bodyweight ? "reps" : unit} valueFmt={fmt} height={240} />
          {series.length > 1 && <Legend items={series} />}
        </>
      ) : (
        <p className="py-6 text-center text-[13.5px] text-ink-3">One session so far. The trend line appears after the next one.</p>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[440px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-ink-3">
              <th className="py-2 pr-4 font-medium">Session</th>
              <th className="py-2 pr-4 font-medium">Sets</th>
              <th className="py-2 pr-4 text-right font-medium">{lift.bodyweight ? "Best" : "Est. 1RM"}</th>
            </tr>
          </thead>
          <tbody>
            {[...lift.sessions].reverse().map((s, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="py-2.5 pr-4 whitespace-nowrap text-ink-2">
                  {s.label}
                  {s.estimated && <span className="ml-1 text-ink-3" title="Estimated date">*</span>}
                </td>
                <td className="py-2.5 pr-4 font-mono text-[12.5px] tnum">
                  {groupSets(s.sets, lift.bodyweight, unit)}
                </td>
                <td className="py-2.5 pr-4 text-right font-medium tnum">
                  {fmt(s.best)}
                  {!lift.bodyweight && <span className="ml-0.5 text-ink-3 font-normal">{unit}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 45 × 9, 9, 7 · 50 × 8 */
function groupSets(sets: Sess["sets"], bw: boolean, unit: string) {
  const parts: string[] = [];
  let i = 0;
  while (i < sets.length) {
    const w = sets[i].weight;
    const reps: string[] = [];
    while (i < sets.length && sets[i].weight === w) {
      reps.push(sets[i].alt != null && sets[i].alt !== sets[i].reps ? `${sets[i].reps}/${sets[i].alt}` : String(sets[i].reps));
      i++;
    }
    parts.push(bw && w === 0 ? `BW × ${reps.join(", ")}` : `${fmt(w)} ${unit} × ${reps.join(", ")}`);
  }
  return parts.join("  ·  ");
}
