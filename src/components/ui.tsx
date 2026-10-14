import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] leading-tight">{title}</h1>
        {sub && <p className="mt-1 text-[14px] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
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
            {title && <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>}
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
        <span className="text-[28px] font-semibold tracking-[-0.02em] leading-none tnum">{value}</span>
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
