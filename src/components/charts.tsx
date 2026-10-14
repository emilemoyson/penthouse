"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TipProps = { active?: boolean; payload?: readonly any[] };

const AXIS = { stroke: "var(--border-strong)", tickLine: false, axisLine: false } as const;

type TipRow = { label: string; value: ReactNode; color?: string };

function TipBox({ title, rows }: { title: ReactNode; rows: TipRow[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lg">
      <div className="mb-1 font-medium text-ink">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-ink-2">
          {r.color && <span className="inline-block size-2 rounded-full" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-medium text-ink tnum">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Weekly columns with a target line ---------------- */

export function WeeklyColumns({
  data,
  dataKey,
  target,
  unitLabel,
  color = "var(--s1)",
  height = 220,
  minTop = 4,
  decimals = 0,
}: {
  data: { label: string; [k: string]: number | string }[];
  dataKey: string;
  target?: number;
  unitLabel: string;
  color?: string;
  height?: number;
  minTop?: number;
  decimals?: number;
}) {
  const max = Math.max(minTop, target ? target + 1 : 0, ...data.map((d) => Number(d[dataKey]) || 0));
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={12} tickMargin={8} />
          <YAxis {...AXIS} width={34} allowDecimals={decimals > 0} domain={[0, Math.ceil(max)]} tickMargin={4} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }: TipProps) =>
              active && payload?.length ? (
                <TipBox
                  title={`Week of ${payload[0].payload.label}`}
                  rows={[{ label: unitLabel, value: Number(payload[0].value).toFixed(decimals), color }]}
                />
              ) : null
            }
          />
          {target != null && (
            <ReferenceLine
              y={target}
              stroke="var(--warn)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `target ${target}`, position: "insideTopRight", fill: "var(--warn)", fontSize: 11 }}
            />
          )}
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- Daily columns (reading minutes etc.) ---------------- */

export function DailyColumns({
  data,
  unitLabel,
  height = 200,
  color = "var(--s1)",
}: {
  data: { label: string; value: number; date: string }[];
  unitLabel: string;
  height?: number;
  color?: string;
}) {
  const max = Math.max(30, ...data.map((d) => d.value));
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={18} tickMargin={8} />
          <YAxis {...AXIS} width={34} domain={[0, max]} tickMargin={4} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }: TipProps) =>
              active && payload?.length ? (
                <TipBox title={payload[0].payload.label} rows={[{ label: unitLabel, value: payload[0].value, color }]} />
              ) : null
            }
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- Generic time line ---------------- */

export type LineSeries = { key: string; name: string; color: string; dashed?: boolean };

export function TimeLine({
  data,
  series,
  height = 240,
  valueFmt: valueFmtProp,
  format,
  unit = "",
  reversed = false,
  zero = false,
}: {
  data: { label: string; [k: string]: number | string | null }[];
  series: LineSeries[];
  height?: number;
  valueFmt?: (v: number) => string;
  /** Use from server components, where functions can't be passed. */
  format?: "pace" | "number";
  unit?: string;
  reversed?: boolean;
  zero?: boolean;
}) {
  const valueFmt =
    valueFmtProp ||
    (format === "pace"
      ? (v: number) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`
      : (v: number) => String(Math.round(v * 10) / 10));
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={20} tickMargin={8} />
          <YAxis
            {...AXIS}
            width={42}
            reversed={reversed}
            domain={zero ? [0, "auto"] : ["auto", "auto"]}
            tickFormatter={(v) => valueFmt(Number(v))}
            tickMargin={4}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={({ active, payload }: TipProps) =>
              active && payload?.length ? (
                <TipBox
                  title={String(payload[0].payload.tip || payload[0].payload.label)}
                  rows={payload
                    .filter((p) => p.value != null)
                    .map((p) => ({
                      label: String(p.name),
                      value: `${valueFmt(Number(p.value))}${unit ? " " + unit : ""}`,
                      color: String(p.color),
                    }))}
                />
              ) : null
            }
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              dot={{ r: 4, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
              activeDot={{ r: 5.5, stroke: "var(--surface)", strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
      {items.map((it) => (
        <span key={it.name} className="inline-flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden>
            <line x1="1" x2="15" y1="4" y2="4" stroke={it.color} strokeWidth="2" strokeDasharray={it.dashed ? "4 3" : undefined} strokeLinecap="round" />
          </svg>
          {it.name}
        </span>
      ))}
    </div>
  );
}
