"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { saveRun } from "../actions";
import { RUN_KINDS } from "@/lib/exercises";
import { btn } from "@/components/ui";

function toSec(s: string) {
  const p = s.trim().split(":").map(Number);
  if (p.some(isNaN) || !s.trim()) return 0;
  if (p.length === 1) return p[0] * 60;
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] * 3600 + p[1] * 60 + p[2];
}

export function RunForm({
  today,
  initial,
}: {
  today: string;
  initial: { id: number; date: string; distance_km: number; duration: string; kind: string; avg_hr: number | null; notes: string } | null;
}) {
  const [state, action, pending] = useActionState(saveRun, undefined);
  const [dist, setDist] = useState(initial ? String(initial.distance_km) : "");
  const [dur, setDur] = useState(initial?.duration || "");
  const [kind, setKind] = useState(initial?.kind || "easy");
  const km = Number(dist.replace(",", "."));
  const sec = toSec(dur);
  const pace = km > 0 && sec > 0 ? sec / km : 0;

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="kind" value={kind} />
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-medium text-ink-3">Date</span>
        <input type="date" name="date" defaultValue={initial?.date || today} max={today} className="field" required />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-ink-3">Distance (km)</span>
          <input name="distance" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} placeholder="5.2" className="field font-mono" required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-ink-3">Time</span>
          <input name="duration" value={dur} onChange={(e) => setDur(e.target.value)} placeholder="27:40" className="field font-mono" required />
        </label>
      </div>
      <div className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
        Pace{" "}
        <span className="font-mono text-[15px] font-medium text-ink">
          {pace ? `${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, "0")}` : "–"}
        </span>{" "}
        /km
      </div>
      <div>
        <span className="mb-1.5 block text-[12.5px] font-medium text-ink-3">Type</span>
        <div className="flex flex-wrap gap-1.5">
          {RUN_KINDS.map((k) => (
            <button
              type="button"
              key={k.id}
              onClick={() => setKind(k.id)}
              className={clsx(
                "h-9 rounded-[10px] px-3 text-[13px] font-medium transition",
                kind === k.id ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line hover:text-ink",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-ink-3">Avg HR (optional)</span>
          <input name="avg_hr" inputMode="numeric" defaultValue={initial?.avg_hr ?? ""} placeholder="bpm" className="field font-mono" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-ink-3">Notes (optional)</span>
          <input name="notes" defaultValue={initial?.notes || ""} placeholder="Route, how it felt" className="field" />
        </label>
      </div>
      {state?.error && <p className="text-[13px] text-bad">{state.error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Link href="/training" className={btn.secondary}>
          Cancel
        </Link>
        <button disabled={pending} className={btn.primary}>
          {pending ? "Saving…" : initial ? "Save changes" : "Save run"}
        </button>
      </div>
    </form>
  );
}
