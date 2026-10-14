import { create } from "zustand";

export type ZoneId = "bed" | "desk" | "gym" | "kitchen";

/**
 * overview  : free look with restricted OrbitControls
 * flying    : camera is travelling to a zone (controls locked)
 * focused   : camera has arrived, glass overlay is visible
 * returning : camera is travelling back to the overview pose
 */
export type Phase = "overview" | "flying" | "focused" | "returning";

type State = {
  zone: ZoneId | null;
  phase: Phase;
  hovered: ZoneId | null;
  focus: (z: ZoneId) => void;
  arrive: () => void;
  close: () => void;
  settle: () => void;
  hover: (z: ZoneId | null) => void;
};

export const useZone = create<State>((set, get) => ({
  zone: null,
  phase: "overview",
  hovered: null,
  focus: (z) => {
    if (get().zone === z && get().phase === "focused") return;
    set({ zone: z, phase: "flying", hovered: null });
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
}));
