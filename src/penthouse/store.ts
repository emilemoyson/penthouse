import { nyHour } from "./ambient";
import { create } from "zustand";

export type ZoneId = "bed" | "desk" | "gym" | "kitchen";

/**
 * overview  : free look with restricted OrbitControls
 * flying    : camera is travelling to a zone (controls locked)
 * focused   : camera has arrived, glass overlay is visible
 * returning : camera is travelling back to the overview pose
 */
export type Phase = "overview" | "flying" | "focused" | "returning";

export type Quality = "high" | "low";

type State = {
  zone: ZoneId | null;
  /** high: shadows, reflections, DOF + bloom. low: phones / weak GPUs. */
  quality: Quality;
  setQuality: (q: Quality) => void;
  phase: Phase;
  hovered: ZoneId | null;
  focus: (z: ZoneId) => void;
  arrive: () => void;
  close: () => void;
  settle: () => void;
  hover: (z: ZoneId | null) => void;
  /** The connector bookshelf: open or closed, and which books are lit (set from the page's data). */
  shelf: boolean;
  setShelf: (open: boolean) => void;
  lit: boolean[];
  setLit: (lit: boolean[]) => void;
  /** New York hour, rounded to the quarter hour; Daylight keeps it current so lamps, street and grade follow the clock. */
  hour: number;
  setHour: (h: number) => void;
};

export const useZone = create<State>((set, get) => ({
  zone: null,
  quality: "high",
  setQuality: (quality) => set({ quality }),
  phase: "overview",
  hovered: null,
  focus: (z) => {
    if (get().zone === z && get().phase === "focused") return;
    set({ zone: z, phase: "flying", hovered: null, shelf: false });
  },
  arrive: () => {
    if (get().phase === "flying") set({ phase: "focused" });
  },
  close: () => {
    if (get().zone) set({ zone: null, phase: "returning" });
  },
  settle: () => {
    if (get().phase === "returning") set({ phase: "overview" });
  },
  hover: (z) => set({ hovered: z }),
  shelf: false,
  setShelf: (shelf) => set({ shelf }),
  lit: [],
  setLit: (lit) => set({ lit }),
  hour: Math.round(nyHour() * 4) / 4,
  setHour: (h) => {
    const q = Math.round(h * 4) / 4;
    if (q !== get().hour) set({ hour: q });
  },
}));
