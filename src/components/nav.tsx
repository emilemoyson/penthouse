"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Briefcase, ChefHat, Dumbbell, BedDouble, LogOut, Home, LayoutGrid } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { logout } from "@/app/login/actions";
import { ROOMS, SITE_NAME } from "@/lib/site";

const ICONS = { office: Briefcase, kitchen: ChefHat, gym: Dumbbell, bedroom: BedDouble } as const;

/** One bar for every room page: name (back to the studio), room switcher, theme, sign out. */
export function StudioBar() {
  const path = usePathname();
  return (
    <header data-app-nav className="sticky top-0 z-30 border-b border-line bg-[var(--bar)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" prefetch className="group flex shrink-0 items-center gap-2 rounded-lg pr-2" title="Back to the 3D studio">
          <Home size={16} className="text-ink-3 transition group-hover:text-accent" />
          <span className="font-serif text-[18px] font-medium tracking-[-0.01em]">{SITE_NAME}</span>
        </Link>
        <nav className="mx-auto flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full border border-line bg-surface/70 p-1 [scrollbar-width:none]">
          <Link
            href="/dashboard"
            prefetch
            aria-current={path.startsWith("/dashboard") ? "page" : undefined}
            className={clsx(
              "tab-link flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium",
              path.startsWith("/dashboard") ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <LayoutGrid size={14} />
            <span className="hidden sm:inline">Today</span>
          </Link>
          <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />
          {ROOMS.map((r) => {
            const Icon = ICONS[r.id];
            const on = path.startsWith(r.href);
            return (
              <Link
                key={r.id}
                href={r.href}
                prefetch
                aria-current={on ? "page" : undefined}
                className={clsx(
                  "tab-link flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium",
                  on ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon size={14} strokeWidth={on ? 2.2 : 1.9} />
                <span className="hidden sm:inline">{r.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-0.5">
          <ThemeToggle />
          <form action={logout}>
            <button className="inline-flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Sign out" title="Sign out">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
