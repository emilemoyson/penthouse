"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Dumbbell, Briefcase, CircleCheckBig, LogOut, Building2 } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { logout } from "@/app/login/actions";

const ITEMS = [
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/habits", label: "Habits", icon: CircleCheckBig },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-[9px] bg-gradient-to-br from-[#4b93ec] to-[#1baf7a] text-white text-[13px] font-semibold shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset]">E</span>
      <span className="text-[15px] font-semibold tracking-tight">Emile</span>
    </Link>
  );
}

export function Sidebar() {
  const path = usePathname();
  const penthouse = (
    <Link
      href="/"
      className="mt-6 flex items-center gap-2.5 rounded-lg bg-[#0a0a0f] px-2.5 py-2 text-[13.5px] font-medium text-white/85 ring-1 ring-inset ring-white/10 transition hover:text-white"
    >
      <Building2 size={16} className="text-[#9085e9]" />
      Penthouse view
    </Link>
  );
  return (
    <aside data-app-nav className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-line bg-[var(--sidebar)] px-3 py-5 lg:flex">
      <div className="px-2.5">
        <Brand />
      </div>
      <nav className="mt-8 flex flex-col gap-0.5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const on = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-medium transition",
                on ? "bg-surface-2 text-ink ring-1 ring-inset ring-line-strong/60" : "text-ink-2 hover:bg-surface-2/70 hover:text-ink",
              )}
            >
              <Icon size={17} strokeWidth={on ? 2.2 : 1.9} className={on ? "text-accent" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>
      {penthouse}
      <div className="mt-auto flex items-center justify-between px-1">
        <ThemeToggle />
        <form action={logout}>
          <button className="inline-flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Sign out" title="Sign out">
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileTop() {
  return (
    <header data-app-nav className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3 backdrop-blur lg:hidden">
      <Brand />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <form action={logout}>
          <button className="inline-flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2" aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </header>
  );
}

export function MobileTabs() {
  const path = usePathname();
  return (
    <nav data-app-nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const on = path.startsWith(href);
        return (
          <Link key={href} href={href} className={clsx("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", on ? "text-ink" : "text-ink-3")}>
            <Icon size={20} strokeWidth={on ? 2.2 : 1.8} className={on ? "text-accent" : ""} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
