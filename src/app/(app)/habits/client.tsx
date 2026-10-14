"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { saveHabit } from "./actions";

type Log = { read_min: number | null; zetamac: number | null; gym: boolean; run: boolean; note: string };

export function CheckIn({
  date,
  label,
  log,
  autoGym,
  autoRun,
  prevHref,
  nextHref,
}: {
  date: string;
  label: string;
  log: Log;
  autoGym: boolean;
  autoRun: boolean;
  prevHref: string;
  nextHref: string | null;
}) {
  const [read, setRead] = useState(log.read_min == null ? "" : String(log.read_min));
  const [zeta, setZeta] = useState(log.zetamac == null ? "" : String(log.zetamac));
  const [gym, setGym] = useState(log.gym);
  const [run, setRun] = useState(log.run);
  const [note, setNote] = useState(log.note);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRead(log.read_min == null ? "" : String(log.read_min));
    setZeta(log.zetamac == null ? "" : String(log.zetamac));
    setGym(log.gym);
    setRun(log.run);
    setNote(log.note);
    setStatus("idle");
  }, [date, log]);

  function save(patch: Parameters<typeof saveHabit>[1], delay = 500) {
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(() => {
      start(async () => {
        await saveHabit(date, patch);
        setStatus("saved");
      });
    }, delay);
  }
  const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v)) || 0));

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Check in</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {label}
            <span className="ml-2 text-[12px]">{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}</span>
          </p>
        </div>
        <div className="flex gap-1">
          <Link href={prevHref} scroll={false} className="inline-flex size-8 items-center justify-center rounded-lg ring-1 ring-inset ring-line text-ink-2 hover:bg-surface-2" aria-label="Previous day">
            <ChevronLeft size={16} />
          </Link>
          {nextHref ? (
            <Link href={nextHref} scroll={false} className="inline-flex size-8 items-center justify-center rounded-lg ring-1 ring-inset ring-line text-ink-2 hover:bg-surface-2" aria-label="Next day">
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span className="inline-flex size-8 items-center justify-center rounded-lg ring-1 ring-inset ring-line text-ink-3 opacity-40">
              <ChevronRight size={16} />
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cell label="Reading" hint="minutes">
          <input
            inputMode="numeric"
            value={read}
            onChange={(e) => {
              setRead(e.target.value);
              save({ read_min: num(e.target.value) }, 700);
            }}
            placeholder="0"
            className="field font-mono text-[16px] tnum"
            aria-label="Reading minutes"
          />
        </Cell>
        <Cell label="Zetamac" hint="score">
          <input
            inputMode="numeric"
            value={zeta}
            onChange={(e) => {
              setZeta(e.target.value);
              save({ zetamac: num(e.target.value) }, 700);
            }}
            placeholder="–"
            className="field font-mono text-[16px] tnum"
            aria-label="Zetamac score"
          />
        </Cell>
        <Cell label="Gym" hint={autoGym ? "from Training" : "3 a week"}>
          <Toggle
            on={gym || autoGym}
            locked={autoGym}
            onClick={() => {
              if (autoGym) return;
              setGym(!gym);
              save({ gym: !gym }, 0);
            }}
          />
        </Cell>
        <Cell label="Run" hint={autoRun ? "from Training" : "2 a week"}>
          <Toggle
            on={run || autoRun}
            locked={autoRun}
            onClick={() => {
              if (autoRun) return;
              setRun(!run);
              save({ run: !run }, 0);
            }}
          />
        </Cell>
      </div>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          save({ note: e.target.value }, 900);
        }}
        rows={1}
        placeholder="Anything worth noting about this day"
        className="field mt-3 resize-y"
      />
    </div>
  );
}

function Cell({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-inset ring-line">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="truncate text-[11px] text-ink-3">{hint}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, locked, onClick }: { on: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={clsx(
        "flex h-10 w-full items-center justify-center gap-2 rounded-[10px] text-[13.5px] font-medium transition",
        on ? "bg-ink text-bg" : "bg-surface text-ink-2 ring-1 ring-inset ring-line hover:text-ink",
        locked && "cursor-default",
      )}
    >
      {on ? <Check size={15} /> : <span className="size-3.5 rounded-[4px] border-[1.5px] border-ink-3" />}
      {on ? "Done" : "Not yet"}
    </button>
  );
}

/** Number input that saves on blur/enter through a bound server action. */
export function NumberSave({ value, action, max, label }: { value: number | undefined; action: (v: number) => Promise<void>; max?: number; label: string }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  const [pending, start] = useTransition();
  const commit = () => {
    const n = v.trim() === "" ? 0 : Math.max(0, Math.min(max ?? 1e9, Math.round(Number(v)) || 0));
    if (n === (value ?? 0) && v !== "") return;
    start(() => action(n));
  };
  return (
    <input
      inputMode="numeric"
      value={v}
      onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      placeholder="0"
      aria-label={label}
      className={clsx("field h-9 font-mono tnum", pending && "opacity-60")}
    />
  );
}

/** A button that runs a bound server action. */
export function ActionButton({ action, children, className, pressed, label }: { action: () => Promise<void>; children: ReactNode; className?: string; pressed?: boolean; label?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-pressed={pressed} aria-label={label} disabled={pending} onClick={() => start(() => action())} className={clsx(className, pending && "opacity-60")}>
      {children}
    </button>
  );
}
