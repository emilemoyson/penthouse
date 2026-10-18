import type { ZoneId } from "./store";

type V3 = [number, number, number];

export type ZoneDef = {
  id: ZoneId;
  label: string;
  title: string;
  subtitle: string;
  key: string; // keyboard shortcut
  /** Where the zone sits in the room (used for labels and hit areas). */
  anchor: V3;
  /** Height of the floating label. */
  labelY: number;
  /** Camera pose when the zone is focused. */
  camera: { position: V3; target: V3 };
  /** Lens when focused (narrower = more telephoto, cinematic). */
  fov?: number;
  /** Accent glow for lights, hover and the overlay. */
  color: string;
  href: string;
};

export const OVERVIEW = {
  position: [13.4, 13.2, 18.6] as V3,
  target: [-0.6, 0.0, -0.2] as V3,
};

/**
 * Overview pose for the current screen shape.
 * Landscape: three-quarter view from the front-right corner.
 * Portrait: swing round to look along the room's long side so it fills a tall screen, and pull back.
 */
export function overviewPose(aspect: number) {
  const [tx, ty, tz] = OVERVIEW.target;
  if (aspect >= 1) {
    const k = Math.min(1.6, Math.max(1, 1.55 / aspect));
    const [px, py, pz] = OVERVIEW.position;
    return { position: [tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k] as V3, target: OVERVIEW.target, k };
  }
  const dist = Math.min(46, 23.5 / Math.max(aspect, 0.45));
  const az = 1.22; // radians from +Z toward +X
  const el = 0.72; // elevation
  const pt: V3 = [tx + 0.3, ty, tz - 0.4]; // nudge so the office corner stays on screen
  return {
    position: [pt[0] + dist * Math.sin(az) * Math.cos(el), pt[1] + dist * Math.sin(el), pt[2] + dist * Math.cos(az) * Math.cos(el)] as V3,
    target: pt,
    k: dist / 24,
  };
}

export const ZONES: ZoneDef[] = [
  {
    id: "bed",
    labelY: 1.9,
    label: "Bedroom",
    title: "Sleep & Recovery",
    subtitle: "Last night, REM and today's energy",
    key: "1",
    anchor: [-7.4, 0, -3.4],
    camera: { position: [-2.3, 3.4, 0.6], target: [-7.4, 0.55, -3.5] },
    fov: 34,
    color: "#f2a53a",
    href: "/habits",
  },
  {
    id: "desk",
    labelY: 2.0,
    label: "Office",
    title: "Professional Hub",
    subtitle: "Job search, inbox and calendar",
    key: "2",
    anchor: [4.6, 0, -5.0],
    // swoops over the right shoulder onto the desk
    camera: { position: [6.2, 2.55, -1.75], target: [4.75, 0.85, -5.3] },
    fov: 40,
    color: "#4b93ec",
    href: "/jobs",
  },
  {
    id: "gym",
    labelY: 2.4,
    label: "Gym",
    title: "Fitness Analytics",
    subtitle: "Frequency, lifts and streaks",
    key: "3",
    anchor: [-6.6, 0, 3.2],
    camera: { position: [-1.0, 3.4, 8.9], target: [-6.8, 0.85, 3.1] },
    fov: 34,
    color: "#9085e9",
    href: "/training",
  },
  {
    id: "kitchen",
    labelY: 2.9,
    label: "Kitchen",
    title: "Diet & Nutrition",
    subtitle: "Calories, macros and meals",
    key: "4",
    anchor: [5.4, 0, 2.5],
    camera: { position: [1.4, 3.3, 8.2], target: [5.9, 0.95, 2.3] },
    fov: 34,
    color: "#23b58a",
    href: "/habits",
  },
];

export const zoneById = (id: ZoneId) => ZONES.find((z) => z.id === id)!;
