"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { nudgeRise, onRiseFrame, setRise } from "../rise";

/**
 * Full view of the focused room: its page (/training, /habits, /kitchen) slides up over the night sky,
 * in step with the camera rise (src/penthouse/rise.ts). The page runs in a same-origin iframe, so its
 * forms, server actions and links work as usual; in a frame it drops its nav and background
 * (html.embedded in globals.css). Scrolling up at the top of the page, Esc, the handle or a click on
 * the sky bring you back down into the room.
 */
export function Sheet({ href }: { href: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // a new room: start fresh, and only load its page once the rise begins
  useEffect(() => {
    setMounted(false);
    setLoaded(false);
  }, [href]);

  useEffect(
    () =>
      onRiseFrame((e, raw) => {
        if (raw > 0 && !mounted) setMounted(true);
        const w = wrap.current;
        const p = panel.current;
        if (!w || !p) return;
        w.style.display = raw > 0.001 ? "block" : "none";
        // the sheet trails the camera slightly, so the sky shows first and the page arrives as it settles
        const s = Math.min(1, Math.max(0, (e - 0.12) / 0.88));
        p.style.transform = `translate3d(0, ${(1 - s) * 104}%, 0)`;
        w.style.pointerEvents = raw > 0.6 ? "auto" : "none";
      }),
    [mounted],
  );

  // the frame's own document scrolls; listen there for Esc and for scrolling up past the top
  const onLoad = () => {
    setLoaded(true);
    const win = frame.current?.contentWindow;
    if (!win) return;
    let touchY: number | null = null;
    win.addEventListener("keydown", (e) => e.key === "Escape" && setRise(0));
    win.addEventListener("wheel", (e) => win.scrollY <= 0 && e.deltaY < 0 && nudgeRise(e.deltaY), { passive: true });
    win.addEventListener("touchstart", (e) => (touchY = e.touches[0].clientY), { passive: true });
    win.addEventListener(
      "touchmove",
      (e) => {
        const y = e.touches[0].clientY;
        if (touchY != null && win.scrollY <= 0 && y > touchY) nudgeRise((touchY - y) * 1.6);
        touchY = y;
      },
      { passive: true },
    );
    win.addEventListener("touchend", () => (touchY = null), { passive: true });
  };

  return (
    <div ref={wrap} className="absolute inset-0 z-30" style={{ display: "none", pointerEvents: "none" }}>
      {/* the sky stays visible above the page; clicking it comes back down */}
      <button aria-label="Back to the room" onClick={() => setRise(0)} className="absolute inset-0 cursor-n-resize" />
      <section
        ref={panel}
        role="dialog"
        aria-label="Full view"
        className={clsx(
          "absolute inset-x-0 bottom-0 top-[14dvh] flex flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-white/10 will-change-transform",
          "bg-[#0b0b0e]/45 shadow-[0_-30px_120px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[28px] backdrop-saturate-[1.3]",
          "lg:inset-x-8",
        )}
        style={{ transform: "translate3d(0, 104%, 0)" }}
      >
        <button
          onClick={() => setRise(0)}
          className="group flex shrink-0 flex-col items-center gap-1 pb-1 pt-2.5 text-white/35 transition hover:text-white/70"
          aria-label="Back to the room"
        >
          <span className="h-1 w-10 rounded-full bg-white/20 transition group-hover:bg-white/40" />
          <ChevronDown size={14} />
        </button>
        <div className="relative min-h-0 flex-1">
          {!loaded && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="size-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
            </div>
          )}
          {mounted && (
            <iframe
              ref={frame}
              key={href}
              src={href}
              title="Full view"
              onLoad={onLoad}
              className={clsx("size-full border-0 bg-transparent transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
            />
          )}
        </div>
      </section>
    </div>
  );
}

/** Opens the full view (the "Full view" button and the hint at the bottom of a panel). */
export const openFullView = () => setRise(1);
