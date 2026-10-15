"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { X, LayoutGrid, Grid2x2 } from "lucide-react";
import { useZone, type ZoneId } from "./store";
import { ZONES, zoneById } from "./zones";
import type { PenthouseData } from "./data/types";
import { labelEls } from "./labels";
import { FitnessPanel, FullPageLink, NutritionPanel, ProfessionalPanel, SleepPanel } from "./overlays/panels";

// WebGL only runs in the browser
const Scene = dynamic(() => import("./scene/Scene"), { ssr: false, loading: () => <Loader /> });

export function Penthouse({ data }: { data: PenthouseData }) {
  return (
    <div className="dark-room fixed inset-0 overflow-hidden bg-[#05050a] text-white">
      <div className="absolute inset-0">
        <Scene />
      </div>
      <ZoneLabels />
      <Hud />
      <Overlay data={data} />
    </div>
  );
}

function Loader() {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-3 text-white/50">
        <div className="size-8 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
        <span className="text-[12px] tracking-[0.2em] uppercase">Turning on the lights</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <span className="opacity-0">00:00</span>;
  const t = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" });
  const d = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/New_York" });
  return (
    <>
      <span className="font-mono text-[22px] font-light tracking-tight text-white tnum">{t}</span>
      <span className="text-[12px] text-white/45">{d} · New York</span>
    </>
  );
}

function Hud() {
  const phase = useZone((s) => s.phase);
  const focus = useZone((s) => s.focus);
  const hovered = useZone((s) => s.hovered);
  const hover = useZone((s) => s.hover);
  const free = phase === "overview" || phase === "returning";
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setHint(false), 7000);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      {/* top-left: identity + clock */}
      <div className={clsx("pointer-events-none absolute left-5 top-5 transition-opacity duration-500 sm:left-7 sm:top-6", free ? "opacity-100" : "opacity-0 sm:opacity-100")}>
        <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/40">Emile&apos;s penthouse</div>
        <div className="mt-1 flex flex-col">
          <Clock />
        </div>
      </div>

      {/* top-right: pixel filter + classic pages */}
      <PixelToggle free={free} />
      <a
        href="/training"
        className={clsx(
          "absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-white/70 backdrop-blur-md transition hover:bg-white/[0.12] hover:text-white sm:right-7 sm:top-6",
          free ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <LayoutGrid size={13} /> Classic view
      </a>

      {/* bottom dock */}
      <div className={clsx("absolute inset-x-0 bottom-5 flex flex-col items-center gap-3 px-4 transition-all duration-500", free ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")}>
        <p className={clsx("text-[12px] text-white/40 transition-opacity duration-700", hint ? "opacity-100" : "opacity-0")}>Drag to look around · scroll to zoom · click a room</p>
        <nav className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.05] p-1.5 shadow-2xl backdrop-blur-xl">
          {ZONES.map((z) => (
            <button
              key={z.id}
              onClick={() => focus(z.id)}
              onMouseEnter={() => hover(z.id)}
              onMouseLeave={() => hover(null)}
              className={clsx(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium transition sm:px-4",
                hovered === z.id ? "bg-white/[0.12] text-white" : "text-white/65 hover:text-white",
              )}
            >
              <span className="size-1.5 rounded-full" style={{ background: z.color, boxShadow: `0 0 10px ${z.color}` }} />
              <span>{z.label}</span>
              <kbd className="hidden font-mono text-[10px] text-white/30 sm:inline">{z.key}</kbd>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------- */

function Overlay({ data }: { data: PenthouseData }) {
  const zone = useZone((s) => s.zone);
  const phase = useZone((s) => s.phase);
  const close = useZone((s) => s.close);
  // keep the last zone mounted while the panel fades out
  const [shown, setShown] = useState<ZoneId | null>(null);
  useEffect(() => {
    if (zone) setShown(zone);
  }, [zone]);
  const visible = phase === "focused" && zone != null;
  const def = shown ? zoneById(shown) : null;

  return (
    <aside
      aria-hidden={!visible}
      className={clsx(
        "absolute z-20 flex flex-col overflow-hidden rounded-[26px] border text-white",
        "border-white/10 bg-black/40 shadow-[0_24px_90px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[20px] backdrop-saturate-[1.4]",
        "inset-x-3 bottom-3 top-[44dvh] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-6 lg:w-[min(560px,42vw)]",
        "transition-all duration-500 ease-out",
        visible ? "translate-y-0 opacity-100 lg:translate-x-0" : "pointer-events-none translate-y-6 opacity-0 lg:translate-x-8 lg:translate-y-0",
      )}
    >
      {def && (
        <>
          {/* accent glow */}
          <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full opacity-30 blur-3xl" style={{ background: def.color }} />
          <header className="relative flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 pb-4 pt-5 sm:px-6">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
                <span className="size-1.5 rounded-full" style={{ background: def.color, boxShadow: `0 0 10px ${def.color}` }} />
                {def.label}
              </div>
              <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight">{def.title}</h2>
              <p className="text-[13px] text-white/50">{def.subtitle}</p>
            </div>
            <div className="flex items-center gap-1">
              <FullPageLink href={def.href} />
              <button onClick={close} className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/[0.14] hover:text-white" aria-label="Zoom out">
                <X size={16} />
              </button>
            </div>
          </header>
          <div className="relative flex-1 overflow-y-auto px-5 py-4 sm:px-6 [scrollbar-width:thin]">
            {shown === "bed" && <SleepPanel initial={data.sleep} />}
            {shown === "desk" && <ProfessionalPanel initial={data.professional} />}
            {shown === "gym" && <FitnessPanel initial={data.fitness} />}
            {shown === "kitchen" && <NutritionPanel initial={data.nutrition} />}
          </div>
          <footer className="relative hidden border-t border-white/[0.06] px-6 py-2.5 text-[11.5px] text-white/35 lg:block">
            <kbd className="font-mono">Esc</kbd> to zoom out · <kbd className="font-mono">1–4</kbd> to jump between rooms
          </footer>
        </>
      )}
    </aside>
  );
}

/* ---------------------------------------------------------------------- */

function ZoneLabels() {
  const phase = useZone((s) => s.phase);
  const hovered = useZone((s) => s.hovered);
  const focus = useZone((s) => s.focus);
  const hover = useZone((s) => s.hover);
  const show = phase === "overview";
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {ZONES.map((z) => {
        const on = hovered === z.id;
        return (
          <button
            key={z.id}
            ref={(el) => {
              if (el) labelEls.set(z.id, el);
              else labelEls.delete(z.id);
            }}
            onClick={() => focus(z.id)}
            onMouseEnter={() => hover(z.id)}
            onMouseLeave={() => hover(null)}
            tabIndex={-1}
            style={{ transform: "translate3d(-999px,-999px,0)", boxShadow: on ? `0 0 28px ${z.color}66` : undefined }}
            className={clsx(
              "absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-medium tracking-wide backdrop-blur-md transition-[opacity,background-color,border-color] duration-300",
              on ? "border-white/30 bg-white/[0.16] text-white" : "border-white/15 bg-white/[0.07] text-white/85",
              show ? "pointer-events-auto opacity-100" : "opacity-0",
            )}
          >
            <span className="size-1.5 rounded-full" style={{ background: z.color, boxShadow: `0 0 8px ${z.color}` }} />
            {z.label}
            <span className="ml-0.5 font-mono text-[10px] text-white/40">{z.key}</span>
          </button>
        );
      })}
    </div>
  );
}

function PixelToggle({ free }: { free: boolean }) {
  const pixel = useZone((s) => s.pixel);
  const setPixel = useZone((s) => s.setPixel);
  return (
    <button
      onClick={() => setPixel(!pixel)}
      title="Pixel filter"
      className={clsx(
        "absolute right-[156px] top-6 hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium backdrop-blur-md transition sm:inline-flex",
        pixel ? "border-white/25 bg-white/[0.14] text-white" : "border-white/10 bg-white/[0.06] text-white/60 hover:text-white",
        free ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <Grid2x2 size={13} /> Pixel {pixel ? "on" : "off"}
    </button>
  );
}
