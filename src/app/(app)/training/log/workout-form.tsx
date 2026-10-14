"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Plus, X, RotateCcw, Trash2 } from "lucide-react";
import { saveWorkout } from "../actions";
import { MUSCLES, SESSION_KINDS } from "@/lib/exercises";
import { btn } from "@/components/ui";

type SetIn = { weight: string; reps: string };
type ExIn = { key: number; name: string; muscle: string; exKind: "compound" | "isolation"; sets: SetIn[] };

export type LastByKind = Record<string, { date: string; exercises: { name: string; unit: string; sets: { weight: number; reps: number }[] }[] }>;
export type LastByExercise = Record<string, { date: string; text: string; weight: number }>;
export type InitialWorkout = {
  id: number;
  date: string;
  kind: string;
  notes: string;
  unit: "lb" | "kg";
  exercises: { name: string; sets: SetIn[] }[];
};

let keySeq = 1;
const blankEx = (): ExIn => ({ key: keySeq++, name: "", muscle: "Chest", exKind: "compound", sets: [{ weight: "", reps: "" }] });

export function WorkoutForm({
  today,
  defaultUnit,
  library,
  lastByKind,
  lastByExercise,
  initial,
}: {
  today: string;
  defaultUnit: "lb" | "kg";
  library: { name: string; muscle: string; kind: "compound" | "isolation" }[];
  lastByKind: LastByKind;
  lastByExercise: LastByExercise;
  initial: InitialWorkout | null;
}) {
  const [state, action, pending] = useActionState(saveWorkout, undefined);
  const [date, setDate] = useState(initial?.date || today);
  const [kind, setKind] = useState(initial?.kind || "push");
  const [unit, setUnit] = useState<"lb" | "kg">(initial?.unit || defaultUnit);
  const [notes, setNotes] = useState(initial?.notes || "");
  const [exs, setExs] = useState<ExIn[]>(
    initial ? initial.exercises.map((e) => ({ key: keySeq++, name: e.name, muscle: "Chest", exKind: "compound", sets: e.sets })) : [blankEx()],
  );
  const libMap = useMemo(() => new Map(library.map((l) => [l.name.toLowerCase(), l])), [library]);

  const last = lastByKind[kind];
  const isEmpty = exs.every((e) => !e.name && e.sets.every((s) => !s.weight && !s.reps));

  function startFromLast() {
    if (!last) return;
    setExs(
      last.exercises.map((e) => ({
        key: keySeq++,
        name: e.name,
        muscle: "Chest",
        exKind: "compound",
        sets: e.sets.map((s) => ({ weight: String(s.weight), reps: "" })),
      })),
    );
    if (last.exercises[0]) setUnit(last.exercises[0].unit as "lb" | "kg");
  }

  const update = (k: number, f: (e: ExIn) => ExIn) => setExs((xs) => xs.map((e) => (e.key === k ? f(e) : e)));

  const payload = JSON.stringify({
    id: initial?.id,
    date,
    kind,
    notes,
    unit,
    exercises: exs
      .filter((e) => e.name.trim())
      .map((e) => {
        const known = libMap.get(e.name.trim().toLowerCase());
        return {
          name: known ? known.name : e.name.trim(),
          ...(known ? {} : { muscle: e.muscle, exKind: e.exKind }),
          sets: e.sets
            .filter((s) => s.reps !== "")
            .map((s) => ({ weight: Number(s.weight.replace(",", ".")) || 0, reps: Math.round(Number(s.reps)) || 0 })),
        };
      })
      .filter((e) => e.sets.length),
  });

  return (
    <form action={action} className="space-y-4 pb-24">
      <input type="hidden" name="payload" value={payload} />
      <datalist id="exercise-list">
        {library.map((l) => (
          <option key={l.name} value={l.name} />
        ))}
      </datalist>

      {/* Session meta */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-ink-3">Date</span>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="field" required />
          </label>
          <div>
            <span className="mb-1.5 block text-[12.5px] font-medium text-ink-3">Session</span>
            <div className="flex flex-wrap gap-1.5">
              {SESSION_KINDS.map((k) => (
                <button
                  type="button"
                  key={k.id}
                  onClick={() => setKind(k.id)}
                  className={clsx(
                    "h-10 rounded-[10px] px-3.5 text-[13.5px] font-medium transition",
                    kind === k.id ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line hover:text-ink",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-[10px] bg-surface-2 p-1 ring-1 ring-inset ring-line" role="group" aria-label="Weight unit">
            {(["lb", "kg"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={clsx("rounded-[7px] px-3 py-1 text-[12.5px] font-medium", unit === u ? "bg-surface text-ink shadow-sm" : "text-ink-3")}
              >
                {u}
              </button>
            ))}
          </div>
          {last && !initial && (
            <button type="button" onClick={startFromLast} className={btn.secondary}>
              <RotateCcw size={14} /> {isEmpty ? "Start from" : "Reset to"} last {SESSION_KINDS.find((k) => k.id === kind)?.label} ({last.date})
            </button>
          )}
        </div>
      </div>

      {/* Exercises */}
      {exs.map((ex, idx) => {
        const known = libMap.get(ex.name.trim().toLowerCase());
        const hint = lastByExercise[known?.name || ex.name.trim()];
        return (
          <div key={ex.key} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="mt-2.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink-2 ring-1 ring-inset ring-line">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <input
                  list="exercise-list"
                  value={ex.name}
                  onChange={(e) => update(ex.key, (x) => ({ ...x, name: e.target.value }))}
                  placeholder="Exercise, e.g. Flat DB press"
                  className="field text-[15px] font-medium"
                  aria-label="Exercise name"
                />
                {hint && (
                  <p className="mt-1.5 text-[12.5px] text-ink-3">
                    Last time ({hint.date}): <span className="font-mono text-ink-2">{hint.text}</span>
                  </p>
                )}
                {ex.name.trim() && !known && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
                    New exercise. Works
                    <select value={ex.muscle} onChange={(e) => update(ex.key, (x) => ({ ...x, muscle: e.target.value }))} className="field h-8 w-auto py-0 text-[12.5px]">
                      {MUSCLES.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={ex.exKind}
                      onChange={(e) => update(ex.key, (x) => ({ ...x, exKind: e.target.value as "compound" | "isolation" }))}
                      className="field h-8 w-auto py-0 text-[12.5px]"
                    >
                      <option value="compound">Compound</option>
                      <option value="isolation">Isolation</option>
                    </select>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setExs((xs) => (xs.length > 1 ? xs.filter((x) => x.key !== ex.key) : [blankEx()]))}
                className="mt-1 inline-flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-bad-soft hover:text-bad"
                aria-label="Remove exercise"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="mt-4 sm:pl-9">
              <div className="grid grid-cols-[44px_1fr_1fr_32px] gap-2 px-0.5 pb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-ink-3">
                <span>Set</span>
                <span>Weight ({unit})</span>
                <span>Reps</span>
                <span />
              </div>
              <div className="space-y-2">
                {ex.sets.map((s, si) => (
                  <div key={si} className="grid grid-cols-[44px_1fr_1fr_32px] items-center gap-2">
                    <span className="text-center text-[13px] font-medium text-ink-3 tnum">{si + 1}</span>
                    <input
                      inputMode="decimal"
                      value={s.weight}
                      placeholder={si > 0 ? ex.sets[si - 1].weight || "0" : "0 = bodyweight"}
                      onChange={(e) => update(ex.key, (x) => ({ ...x, sets: x.sets.map((y, j) => (j === si ? { ...y, weight: e.target.value } : y)) }))}
                      className="field font-mono tnum"
                      aria-label={`Set ${si + 1} weight`}
                    />
                    <input
                      inputMode="numeric"
                      value={s.reps}
                      placeholder="reps"
                      onChange={(e) => update(ex.key, (x) => ({ ...x, sets: x.sets.map((y, j) => (j === si ? { ...y, reps: e.target.value.replace(/[^\d]/g, "") } : y)) }))}
                      className="field font-mono tnum"
                      aria-label={`Set ${si + 1} reps`}
                    />
                    <button
                      type="button"
                      onClick={() => update(ex.key, (x) => ({ ...x, sets: x.sets.length > 1 ? x.sets.filter((_, j) => j !== si) : x.sets }))}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                      disabled={ex.sets.length === 1}
                      aria-label={`Remove set ${si + 1}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  update(ex.key, (x) => {
                    const prev = x.sets[x.sets.length - 1];
                    return { ...x, sets: [...x.sets, { weight: prev?.weight || "", reps: "" }] };
                  })
                }
                className={clsx(btn.ghost, "mt-2")}
              >
                <Plus size={14} /> Add set
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setExs((xs) => [...xs, blankEx()])}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-[14px] font-medium text-ink-2 transition hover:bg-surface hover:text-ink"
      >
        <Plus size={16} /> Add exercise
      </button>

      <label className="block rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
        <span className="mb-1.5 block text-[12.5px] font-medium text-ink-3">Notes (optional)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="field" placeholder="How it felt, sleep, anything off" />
      </label>

      <div className="fixed inset-x-0 bottom-[60px] z-20 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-[232px]">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-3">
          <p className="text-[13px] text-ink-3">
            {state?.error ? <span className="text-bad">{state.error}</span> : `${exs.filter((e) => e.name.trim()).length} exercises · ${exs.reduce((a, e) => a + e.sets.filter((s) => s.reps).length, 0)} sets`}
          </p>
          <div className="flex gap-2">
            <Link href="/training" className={btn.secondary}>
              Cancel
            </Link>
            <button disabled={pending} className={btn.primary}>
              {pending ? "Saving…" : initial ? "Save changes" : "Save workout"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
