"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

/* Shared building blocks for the glass overlays (white-on-glass palette). */

export function GlassCard({ children, className, title, right }: { children: ReactNode; className?: string; title?: string; right?: ReactNode }) {
  return (
    <div className={clsx("rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4", className)}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-[12.5px] font-medium uppercase tracking-[0.08em] text-white/55">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Metric({ label, value, unit, sub, accent }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
      <div className="text-[12px] text-white/50">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-[26px] font-semibold leading-none tracking-tight tnum" style={accent ? { textShadow: `0 0 24px ${accent}66` } : undefined}>
          {value}
        </span>
        {unit && <span className="text-[12.5px] text-white/45">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[12px] leading-snug text-white/50">{sub}</div>}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "accent" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "neutral" && "bg-white/[0.07] text-white/70",
        tone === "good" && "bg-emerald-400/15 text-emerald-300",
        tone === "warn" && "bg-amber-400/15 text-amber-300",
        tone === "bad" && "bg-rose-400/15 text-rose-300",
        tone === "accent" && "bg-sky-400/15 text-sky-300",
      )}
    >
      {children}
    </span>
  );
}

export function SampleBadge({ children = "Sample data" }: { children?: ReactNode }) {
  return <span className="rounded-full border border-dashed border-white/20 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-white/45">{children}</span>;
}

/** Simple column chart in SVG. One series, optional target line. */
export function Columns({
  values,
  labels,
  color,
  target,
  height = 120,
  format = (v: number) => String(v),
  highlightLast = true,
}: {
  values: number[];
  labels: string[];
  color: string;
  target?: number;
  height?: number;
  format?: (v: number) => string;
  highlightLast?: boolean;
}) {
  const max = Math.max(1, target ? target * 1.25 : 0, ...values);
  const W = 100;
  const bw = W / values.length;
  const pad = Math.min(2.2, bw * 0.28);
  const H = 100;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }} className="w-full overflow-visible">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={H - f * H} y2={H - f * H} stroke="white" strokeOpacity={0.06} strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
        ))}
        {values.map((v, i) => {
          const h = (v / max) * H;
          const last = highlightLast && i === values.length - 1;
          return (
            <g key={i}>
              <title>{`${labels[i]}: ${format(v)}`}</title>
              <rect x={i * bw + pad / 2} y={H - Math.max(h, v > 0 ? 1.5 : 0.6)} width={bw - pad} height={Math.max(h, v > 0 ? 1.5 : 0.6)} rx={0.8} fill={v > 0 ? color : "white"} fillOpacity={v > 0 ? (last ? 1 : 0.75) : 0.08} />
            </g>
          );
        })}
        {target != null && <line x1={0} x2={W} y1={H - (target / max) * H} y2={H - (target / max) * H} stroke="#f2a53a" strokeDasharray="2 2" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-white/35 font-mono">
        <span>{labels[0]}</span>
        <span>{labels[Math.floor(labels.length / 2)]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

/** Ring gauge for a 0..1 value. */
export function Ring({ value, color, size = 120, stroke = 10, children }: { value: number; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="white" strokeOpacity={0.08} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: "stroke-dasharray .8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Horizontal progress bar with label + value. */
export function Bar({ label, value, max, color, unit = "" }: { label: string; value: number; max: number; color: string; unit?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
        <span className="flex items-center gap-2 text-white/75">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="tnum text-white/60">
          <span className="font-medium text-white">{value}</span> / {max}
          {unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color, boxShadow: `0 0 10px ${color}aa` }} />
      </div>
    </div>
  );
}
