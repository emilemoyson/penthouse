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
  /** Full page that slides up over the scene. Omit for a room that only has its glass panel. */
  href?: string;
};

export const OVERVIEW = {
  position: [8.4, 8.6, 12.2] as V3,
  target: [-0.3, 0.5, -0.4] as V3,
};

/**
 * The studio is compact (11 x 10 m). Each corner was laid out for a bigger room, so its group is
 * shifted toward the middle by this much; anchors and camera poses below get the same shift.
 */
export const SHIFT: Record<ZoneId, V3> = {
  bed: [3.5, 0, 1],
  desk: [-1.5, 0, 1],
  gym: [3.5, 0, -1],
  kitchen: [-3.7, 0, -1],
};
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

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
  // the studio is about two thirds the size of the old 18 m room, so the portrait pull-back is too
  const dist = Math.min(31, 15.5 / Math.max(aspect, 0.45));
  const az = 1.22; // radians from +Z toward +X
  const el = 0.72; // elevation
  const pt: V3 = [tx + 0.3, ty, tz - 0.4]; // nudge so the office corner stays on screen
  return {
    position: [pt[0] + dist * Math.sin(az) * Math.cos(el), pt[1] + dist * Math.sin(el), pt[2] + dist * Math.cos(az) * Math.cos(el)] as V3,
    target: pt,
    k: dist / 24,
  };
}

const RAW: ZoneDef[] = [
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
    href: "/bedroom",
  },
  {
    id: "desk",
    labelY: 2.0,
    label: "Office",
    title: "Professional Hub",
    subtitle: "To-dos and calendar",
    key: "2",
    anchor: [4.6, 0, -5.0],
    // swoops over the right shoulder onto the desk
    camera: { position: [6.2, 2.55, -1.75], target: [4.75, 0.85, -5.3] },
    fov: 40,
    color: "#4b93ec",
    href: "/office",
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
    subtitle: "Fridge, meals, protein and spending",
    key: "4",
    anchor: [5.4, 0, 2.5],
    camera: { position: [1.4, 3.3, 8.2], target: [5.9, 0.95, 2.3] },
    fov: 34,
    color: "#23b58a",
    href: "/kitchen",
  },
];

export const ZONES: ZoneDef[] = RAW.map((z) => ({
  ...z,
  anchor: add(z.anchor, SHIFT[z.id]),
  camera: { position: add(z.camera.position, SHIFT[z.id]), target: add(z.camera.target, SHIFT[z.id]) },
}));

export const zoneById = (id: ZoneId) => ZONES.find((z) => z.id === id)!;
