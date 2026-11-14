import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";

export function PageHeader({ title, sub, actions, eyebrow }: { title: string; sub?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[11.5px] font-medium uppercase tracking-[0.16em] text-ink-3">{eyebrow}</div>}
        <h1 className="font-serif text-[32px] font-medium leading-[1.05] tracking-[-0.015em]">{title}</h1>
        {sub && <p className="mt-1.5 text-[14px] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Sub-tabs under the page header. Each tab is a link to `?tab=id`, so the server renders only that tab. */
export function RoomTabs({ base, items, active }: { base: string; items: { id: string; label: string; count?: number }[]; active: string }) {
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]" aria-label="Sections">
      {items.map((it, i) => {
        const on = it.id === active;
        return (
          <Link
            key={it.id}
            href={i === 0 ? base : `${base}?tab=${it.id}`}
            scroll={false}
            prefetch
            aria-current={on ? "page" : undefined}
            className={clsx(
              "tab-link -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-[14px] font-medium",
              on ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {it.label}
            {it.count != null && it.count > 0 && (
              <span className={clsx("tnum rounded-full px-1.5 text-[11px]", on ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-3")}>{it.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Reads `?tab=` against the allowed ids; falls back to the first. */
export function pickTab<T extends string>(raw: string | string[] | undefined, ids: readonly T[]): T {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (ids as readonly string[]).includes(v ?? "") ? (v as T) : ids[0];
}

export function Card({
  title,
  sub,
  action,
  children,
  className,
  pad = true,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section
      className={clsx(
        "min-w-0 rounded-2xl border border-line bg-surface shadow-[var(--shadow)]",
        pad && "p-5 sm:p-6",
        className,
      )}
    >
      {(title || action) && (
        <div className={clsx("flex flex-wrap items-start justify-between gap-3", pad ? "mb-4" : "px-5 pt-5 sm:px-6 sm:pt-6 mb-4")}>
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-[-0.005em]">{title}</h2>}
            {sub && <p className="mt-0.5 text-[13px] text-ink-3 max-w-[68ch]">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  unit,
  meta,
  progress,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  meta?: ReactNode;
  progress?: number;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-[var(--shadow)]">
      <div className="text-[12.5px] font-medium text-ink-3">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-serif text-[30px] font-medium tracking-[-0.02em] leading-none tnum">{value}</span>
        {unit && <span className="text-[13px] text-ink-3">{unit}</span>}
      </div>
      {progress != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div
            className={clsx(
              "h-full rounded-full transition-[width] duration-500",
              tone === "good" ? "bg-good" : tone === "warn" ? "bg-warn" : tone === "bad" ? "bg-bad" : "bg-accent",
            )}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      {meta && <div className="mt-2 text-[12.5px] text-ink-3 leading-snug">{meta}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "good" | "warn" | "bad";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-[1.5]",
        tone === "neutral" && "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line",
        tone === "accent" && "bg-accent-soft text-accent-ink",
        tone === "good" && "bg-good-soft text-good",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "bad" && "bg-bad-soft text-bad",
        className,
      )}
    >
      {children}
    </span>
  );
}

const btnBase =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] text-[13.5px] font-medium transition disabled:opacity-50 disabled:pointer-events-none";
export const btn = {
  primary: clsx(btnBase, "h-9 px-3.5 bg-ink text-bg hover:opacity-90"),
  secondary: clsx(btnBase, "h-9 px-3.5 border border-line bg-surface text-ink hover:bg-surface-2"),
  ghost: clsx(btnBase, "h-8 px-2.5 text-ink-2 hover:bg-surface-2 hover:text-ink"),
  danger: clsx(btnBase, "h-8 px-2.5 text-bad hover:bg-bad-soft"),
};

export function LinkButton({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof btn;
  className?: string;
}) {
  return (
    <Link href={href} className={clsx(btn[variant], className)}>
      {children}
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13.5px] text-ink-3">{children}</div>;
}

export function Segmented({
  items,
  active,
}: {
  items: { href: string; label: string; id: string }[];
  active: string;
}) {
  return (
    <nav className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow)] [scrollbar-width:none]">
      {items.map((it) => (
        <Link
          key={it.id}
          href={it.href}
          scroll={false}
          className={clsx(
            "whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition",
            active === it.id ? "bg-ink text-bg" : "text-ink-2 hover:text-ink hover:bg-surface-2",
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

export function Delta({ value, suffix = "%", goodWhenUp = true }: { value: number | null; suffix?: string; goodWhenUp?: boolean }) {
  if (value == null || !isFinite(value)) return <span className="text-ink-3">–</span>;
  const r = Math.round(value * 10) / 10;
  const up = r > 0;
  const flat = r === 0;
  const good = flat ? null : up === goodWhenUp;
  return (
    <span className={clsx("tnum font-medium", good === true && "text-good", good === false && "text-bad", flat && "text-ink-3")}>
      {up ? "+" : ""}
      {r}
      {suffix}
    </span>
  );
}
