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
  const dist = Math.min(40, 22.5 / Math.max(aspect, 0.45));
  const az = 1.22; // radians from +Z toward +X
  const el = 0.72; // elevation
  return {
    position: [tx + dist * Math.sin(az) * Math.cos(el), ty + dist * Math.sin(el), tz + dist * Math.cos(az) * Math.cos(el)] as V3,
    target: OVERVIEW.target,
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
    anchor: [-5.2, 0, -3.2],
    camera: { position: [-1.6, 3.3, 1.6], target: [-5.2, 0.55, -3.4] },
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
    anchor: [4.6, 0, -4.1],
    // over the shoulder, framing the laptop
    camera: { position: [5.35, 1.95, -1.95], target: [4.6, 0.95, -4.55] },
    color: "#4b93ec",
    href: "/jobs",
  },
  {
    id: "gym",
    labelY: 2.9,
    label: "Gym",
    title: "Fitness Analytics",
    subtitle: "Frequency, lifts and streaks",
    key: "3",
    anchor: [-5.2, 0, 3],
    camera: { position: [-0.8, 3.2, 7.6], target: [-5.2, 1.0, 2.6] },
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
    anchor: [4.6, 0, 2.8],
    camera: { position: [9.2, 3.5, 7.4], target: [4.4, 0.95, 2.6] },
    color: "#23b58a",
    href: "/habits",
  },
];

export const zoneById = (id: ZoneId) => ZONES.find((z) => z.id === id)!;
