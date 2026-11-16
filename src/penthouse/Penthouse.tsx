"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUpRight, X, LayoutGrid, Play, Plus } from "lucide-react";
import { create } from "zustand";
import { useZone, type ZoneId } from "./store";
import { ZONES, zoneById } from "./zones";
import type { PenthouseData } from "./data/types";
import { SITE_NAME } from "@/lib/site";
import { labelEls, shelfLabel } from "./labels";
import { RoomChat } from "./overlays/RoomChat";
import { ambientFrom, nyHour, statusLine, useAmbient } from "./ambient";
import { onRiseFrame } from "./rise";

// WebGL only runs in the browser
const Scene = dynamic(() => import("./scene/Scene"), { ssr: false, loading: () => <Loader /> });

export function Penthouse({ data }: { data: PenthouseData }) {
  const root = useRef<HTMLDivElement>(null);

  // the rooms show the day without numbers: lamp, bed, shelves, gym lights
  useEffect(() => {
    useAmbient.setState(ambientFrom(data));
  }, [data]);

  return (
    <div ref={root} className="dark-room fixed inset-0 overflow-hidden bg-[#0b0908] text-white">
      <div className="absolute inset-0">
        <Scene />
      </div>
      <ZoneLabels />
      <Hud data={data} />
      <Overlay data={data} />
      <Tour data={data} />
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

function Hud({ data }: { data: PenthouseData }) {
  const phase = useZone((s) => s.phase);
  const touring = useTour((s) => s.step != null);
  const focus = useZone((s) => s.focus);
  const hovered = useZone((s) => s.hovered);
  const hover = useZone((s) => s.hover);
  const setShelf = useZone((s) => s.setShelf);
  const free = (phase === "overview" || phase === "returning") && !touring;
  const [hint, setHint] = useState(true);
  // the hour is only known in the browser (and ?hour= can change it), so name the walkthrough after mount
  const [greet, setGreet] = useState("Morning");
  useEffect(() => setGreet(greeting()), []);
  useEffect(() => {
    const id = setTimeout(() => setHint(false), 7000);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      {/* top-left: identity + clock */}
      <div className={clsx("pointer-events-none absolute left-5 top-5 transition-opacity duration-500 sm:left-7 sm:top-6", free ? "opacity-100" : "opacity-0 sm:opacity-100")}>
        <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/40">{SITE_NAME}</div>
        <div className="mt-1 flex flex-col">
          <Clock />
        </div>
      </div>
      <button
        onClick={startTour}
        className={clsx(
          "absolute left-5 top-[104px] inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-white/70 backdrop-blur-md transition hover:bg-white/[0.12] hover:text-white sm:left-7 sm:top-[112px]",
          free ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <Play size={12} /> {greet} walkthrough
      </button>

      <Connectors data={data} show={free} />

      {/* top-right: classic pages */}
      <a
        href="/dashboard"
        className={clsx(
          "absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-white/70 backdrop-blur-md transition hover:bg-white/[0.12] hover:text-white sm:right-7 sm:top-6",
          free ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <LayoutGrid size={13} /> Classic view
      </a>

      {/* bottom dock */}
      <div
        className={clsx(
          "absolute inset-x-0 bottom-5 flex flex-col items-center gap-3 px-4 transition-all duration-500",
          free ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
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
          <span className="mx-1 w-px self-stretch bg-white/10" />
          <button
            data-connectors
            onClick={() => setShelf(true)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium text-white/65 transition hover:bg-white/[0.12] hover:text-white sm:px-4"
          >
            <span className="size-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_#fcd34d]" />
            <span>Connectors</span>
            <kbd className="hidden font-mono text-[10px] text-white/30 sm:inline">5</kbd>
          </button>
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
  const touring = useTour((s) => s.step != null);
  const visible = phase === "focused" && zone != null && !touring;
  const def = shown ? zoneById(shown) : null;

  // as the camera rises the panel lifts and fades, leaving the sky and the full view
  const lift = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      onRiseFrame((e) => {
        const el = lift.current;
        if (!el) return;
        const f = Math.min(1, e * 2.4);
        el.style.opacity = String(1 - f);
        el.style.transform = f ? `translate3d(0, ${-f * 36}px, 0) scale(${1 - f * 0.03})` : "";
        el.style.visibility = f >= 1 ? "hidden" : "visible";
      }),
    [],
  );

  return (
    <>
      <div ref={lift} className="pointer-events-none absolute inset-0 z-20 will-change-transform">
        <aside
          aria-hidden={!visible}
          className={clsx(
            "absolute z-20 flex flex-col overflow-hidden rounded-[26px] border text-white",
            "border-white/10 bg-black/40 shadow-[0_24px_90px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[20px] backdrop-saturate-[1.4]",
            "inset-x-3 bottom-3 top-[44dvh] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-6 lg:w-[min(560px,42vw)]",
            "transition-all duration-500 ease-out",
            visible ? "pointer-events-auto translate-y-0 opacity-100 lg:translate-x-0" : "pointer-events-none translate-y-6 opacity-0 lg:translate-x-8 lg:translate-y-0",
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
                  <button
                    onClick={close}
                    className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/[0.14] hover:text-white"
                    aria-label="Zoom out"
                  >
                    <X size={16} />
                  </button>
                </div>
              </header>
              <div className="relative flex min-h-0 flex-1 flex-col px-5 py-4 sm:px-6">
                <p className="text-[15px] leading-snug text-white/90">{statusLine(def.id, data)}</p>
                <a
                  href="/dashboard"
                  className="mt-2 inline-flex w-fit items-center gap-1 text-[12.5px] font-medium text-white/55 transition hover:text-white"
                >
                  Open in Today <ArrowUpRight size={13} />
                </a>
                <div className="my-4 h-px shrink-0 bg-white/[0.08]" />
                <RoomChat zone={def.id} color={def.color} />
              </div>
              <footer className="relative hidden border-t border-white/[0.06] px-6 py-2.5 text-[11.5px] text-white/35 lg:block">
                <kbd className="font-mono">Esc</kbd> to zoom out · <kbd className="font-mono">1–4</kbd> to jump between rooms
              </footer>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------- */

function ZoneLabels() {
  const phase = useZone((s) => s.phase);
  const hovered = useZone((s) => s.hovered);
  const focus = useZone((s) => s.focus);
  const hover = useZone((s) => s.hover);
  const show = phase === "overview";
  const shelf = useZone((s) => s.shelf);
  const setShelf = useZone((s) => s.setShelf);
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
      <button
        ref={(el) => {
          shelfLabel.el = el;
        }}
        onClick={() => setShelf(true)}
        tabIndex={-1}
        style={{ transform: "translate3d(-999px,-999px,0)" }}
        className={clsx(
          "absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200/30 bg-white/[0.07] px-2.5 py-1 text-[11.5px] font-medium tracking-wide text-white/85 backdrop-blur-md transition-[opacity,background-color,border-color] duration-300 hover:border-amber-200/60 hover:bg-white/[0.16] hover:text-white",
          show && !shelf ? "pointer-events-auto opacity-100" : "opacity-0",
        )}
      >
        <span className="size-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" />
        Connectors
        <span className="ml-0.5 font-mono text-[10px] text-white/40">5</span>
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Morning walkthrough: one button tours the rooms with a caption each      */
/* ---------------------------------------------------------------------- */

const TOUR: ZoneId[] = ["bed", "desk", "gym", "kitchen"];
const STOP_MS = 6200;
// step: index into TOUR, TOUR.length for the closing card, null when not touring
const useTour = create<{ step: number | null }>(() => ({ step: null }));
let tourTimer: ReturnType<typeof setTimeout> | undefined;

function greeting() {
  const h = nyHour();
  return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
}

function goTo(step: number) {
  clearTimeout(tourTimer);
  useTour.setState({ step });
  if (step < TOUR.length) {
    useZone.getState().focus(TOUR[step]);
    tourTimer = setTimeout(() => goTo(step + 1), STOP_MS);
  } else {
    useZone.getState().close();
  }
}

function startTour() {
  goTo(0);
}

function stopTour() {
  clearTimeout(tourTimer);
  useTour.setState({ step: null });
}

const AMBIENT_NOTE: Record<ZoneId, (d: PenthouseData) => string> = {
  bed: (d) => (ambientFrom(d).bedUnmade ? "The bed's unmade: a short night." : "The bed's made: you slept enough."),
  desk: (d) => (ambientFrom(d).officeLight > 0.6 ? "The desk lamp is bright: there's a fair bit open." : "The desk lamp is low: not much left to do."),
  gym: (d) => (ambientFrom(d).trainedToday ? "The gym is lit: you trained today." : "The gym is dim: no session yet today."),
  kitchen: (d) => (ambientFrom(d).pantryFill > 0.5 ? "The shelves are stocked." : "The shelves are getting bare: time for groceries."),
};

function Tour({ data }: { data: PenthouseData }) {
  const step = useTour((s) => s.step);
  const zone = useZone((s) => s.zone);

  // Esc, a number key or a click elsewhere takes over the camera: end the tour
  useEffect(() => {
    if (step == null) return;
    const expected = step < TOUR.length ? TOUR[step] : null;
    if (zone !== expected) stopTour();
  }, [zone, step]);

  if (step == null) return null;
  const end = step >= TOUR.length;
  const def = end ? null : zoneById(TOUR[step]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div
        key={step}
        className="pointer-events-auto w-full max-w-[560px] animate-[tourIn_600ms_ease-out] rounded-2xl border border-white/10 bg-black/45 px-5 py-4 text-white shadow-2xl backdrop-blur-xl"
      >
        {def ? (
          <>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
              <span className="size-1.5 rounded-full" style={{ background: def.color, boxShadow: `0 0 10px ${def.color}` }} />
              {def.label} · {step + 1} of {TOUR.length}
            </div>
            <p className="mt-1.5 text-[16px] leading-snug">{statusLine(def.id, data)}</p>
            <p className="mt-0.5 text-[13px] text-white/50">{AMBIENT_NOTE[def.id](data)}</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full origin-left rounded-full" style={{ background: def.color, animation: `tourBar ${STOP_MS}ms linear forwards` }} />
              </div>
              <button onClick={() => goTo(step + 1)} className="text-[12px] text-white/55 transition hover:text-white">
                Next
              </button>
              <button onClick={() => (stopTour(), useZone.getState().close())} className="text-[12px] text-white/55 transition hover:text-white">
                Skip
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">That&rsquo;s the day</div>
              <p className="mt-1 text-[15px]">Everything in one place is on Today.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={stopTour} className="rounded-full px-3 py-1.5 text-[12.5px] text-white/60 transition hover:text-white">
                Stay here
              </button>
              <a href="/dashboard" className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-black transition hover:bg-white/85">
                Open Today <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Connectors: what feeds the apartment, lit when connected                 */
/* ---------------------------------------------------------------------- */

function Connectors({ data, show }: { data: PenthouseData; show: boolean }) {
  const todos = data.professional.todos;
  const from = (p: string) => todos.items.some((t) => t.id.startsWith(p));
  const gmail = todos.source === "live" && todos.items.some((t) => !/^(manual-|outlook:|blackboard:)/.test(t.id));
  const items = [
    { name: "Gmail", on: gmail, what: "To-dos from email, every hour" },
    { name: "Outlook", on: from("outlook:"), what: "To-dos from school email, every hour" },
    { name: "Calendar", on: data.professional.calendar.source === "live", what: "Google Calendar and iCal feeds" },
    { name: "Strava", on: false, what: "Runs and rides" },
    { name: "Garmin", on: false, what: "Sleep and training load" },
    { name: "WHOOP", on: false, what: "Recovery and strain" },
  ];
  const open = useZone((st) => st.shelf);
  const setShelf = useZone((st) => st.setShelf);
  const setLit = useZone((st) => st.setLit);
  const [want, setWant] = useState("");
  const key = items.map((c) => (c.on ? 1 : 0)).join("");
  useEffect(() => {
    setLit(key.split("").map((c) => c === "1"));
  }, [key, setLit]);
  // 5 opens the shelf from the overview, like 1 to 4 open the rooms
  useEffect(() => {
    if (!show || open) return;
    const five = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "5" && !e.metaKey && !e.ctrlKey && !(t && /INPUT|TEXTAREA/.test(t.tagName))) setShelf(true);
    };
    window.addEventListener("keydown", five);
    return () => window.removeEventListener("keydown", five);
  }, [show, open, setShelf]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setShelf(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, setShelf]);
  const name = want.trim();
  const body = `Connector: ${name}\n\nWhat it should bring into the Office:\n\n(Requested from the bookshelf. Claude Code picks this up and opens a pull request.)`;
  const href = `https://github.com/emilemoyson/penthouse/issues/new?title=${encodeURIComponent(`Connector request: ${name}`)}&body=${encodeURIComponent(body)}`;
  return (
    <>
    <div
      data-shelf={open ? "open" : "closed"}
      className={clsx(
        "absolute bottom-5 left-5 flex w-[min(340px,calc(100vw-2.5rem))] flex-col gap-2 rounded-3xl border border-white/12 bg-[#140b2a]/75 p-4 text-white shadow-2xl backdrop-blur-2xl transition-all duration-300 sm:left-7",
        show && open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-amber-200/70">The bookshelf</div>
          <div className="text-[16px] font-medium">Connectors</div>
        </div>
        <button onClick={() => setShelf(false)} aria-label="Close" className="rounded-full border border-white/15 p-1.5 text-white/60 transition hover:text-white">
          <X size={14} />
        </button>
      </div>
      <p className="text-[12.5px] leading-snug text-white/55">Each book is a source that feeds the Office. A lit spine is connected.</p>
      <ul className="flex flex-col gap-1">
        {items.map((c) => (
          <li key={c.name} className={clsx("flex items-center gap-2.5 rounded-xl px-2.5 py-2", c.on ? "bg-white/[0.08]" : "bg-white/[0.02]")}>
            <span className={clsx("size-2 shrink-0 rounded-full", c.on ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-white/20")} />
            <div className="min-w-0 flex-1">
              <div className={clsx("text-[13px] font-medium", c.on ? "text-white/90" : "text-white/45")}>{c.name}</div>
              <div className="truncate text-[11.5px] text-white/40">{c.what}</div>
            </div>
            <span className="text-[11px] text-white/40">{c.on ? "Connected" : "Not yet"}</span>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name) window.open(href, "_blank", "noopener");
        }}
        className="mt-1 flex items-center gap-2 rounded-xl border border-dashed border-white/20 px-2.5 focus-within:border-white/45"
      >
        <Plus size={13} className="text-white/45" />
        <input
          value={want}
          onChange={(e) => setWant(e.target.value)}
          maxLength={60}
          placeholder="Request a connector, e.g. Spotify"
          className="h-9 min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-white/35"
        />
        <button type="submit" disabled={!name} className="rounded-lg bg-white px-2.5 py-1 text-[11.5px] font-medium text-black transition disabled:opacity-30">
          Request
        </button>
      </form>
      <p className="text-[11px] leading-snug text-white/35">Opens a GitHub request in a new tab. It becomes a pull request once it is picked up.</p>
    </div>
    </>
  );
}
