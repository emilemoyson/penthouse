/**
 * The "rise": scrolling down in a focused room lifts the camera out of the room into the
 * night sky while that room's full page slides up over it. One number, 0 (in the room) → 1 (full view).
 *
 * `target` follows the wheel / touch input; `value` eases toward it every frame (CameraRig steps it)
 * and everything that moves (camera, sky, panel, sheet) reads `value`, so they stay in lockstep.
 * Letting go part-way snaps to the nearer end, in the direction you were scrolling.
 */
export const rise = { target: 0, value: 0 };

const SCROLL_PX = 950; // wheel distance for the whole rise
let snapTimer: ReturnType<typeof setTimeout> | null = null;
let lastDir = 0;

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function setRise(t: number) {
  if (snapTimer) clearTimeout(snapTimer);
  snapTimer = null;
  rise.target = clamp(t);
}

/** Feed a scroll delta in pixels (positive = down). */
export function nudgeRise(dy: number) {
  if (!dy) return;
  lastDir = Math.sign(dy);
  rise.target = clamp(rise.target + dy / SCROLL_PX);
  if (snapTimer) clearTimeout(snapTimer);
  snapTimer = setTimeout(() => {
    snapTimer = null;
    const t = rise.target;
    if (t <= 0 || t >= 1) return;
    rise.target = lastDir > 0 ? (t > 0.22 ? 1 : 0) : t < 0.78 ? 0 : 1;
  }, 160);
}

/** Back in the room at once (switching or leaving rooms). */
export function resetRise() {
  setRise(0);
  rise.value = 0;
}

/** Ease used by everything that follows the rise, so the motion reads as one gesture. */
export const easeRise = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Run fn with the current eased rise on every animation frame (for DOM elements; no React re-renders). */
export function onRiseFrame(fn: (e: number, raw: number) => void) {
  let id = 0;
  let last = -1;
  const loop = () => {
    if (rise.value !== last) {
      last = rise.value;
      fn(easeRise(rise.value), rise.value);
    }
    id = requestAnimationFrame(loop);
  };
  id = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(id);
}

/** True when the wheel should scroll something inside `stopAt` (e.g. the panel's own list) instead of rising. */
export function innerCanScroll(target: EventTarget | null, dy: number, stopAt: Element | null) {
  let el = target instanceof Element ? target : null;
  while (el && el !== stopAt) {
    const s = getComputedStyle(el);
    if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
    }
    el = el.parentElement;
  }
  return false;
}
