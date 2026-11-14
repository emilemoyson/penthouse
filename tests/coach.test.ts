import { describe, expect, it } from "vitest";
import { e1rm } from "@/lib/coach";

describe("e1rm (Epley)", () => {
  it("is the weight at one rep plus a third of it per ten reps", () => {
    expect(e1rm(100, 0)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 2);
    expect(e1rm(60, 5)).toBeCloseTo(70);
  });
  it("is zero for bodyweight or unloaded sets", () => {
    expect(e1rm(0, 12)).toBe(0);
  });
});
