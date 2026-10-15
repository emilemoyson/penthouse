import { VoxelBuilder, hash3, mix, shade, type VoxelModelData } from "../voxel/builder";

/**
 * Every prop in the penthouse, built from voxels at one shared density (FV metres per voxel).
 * Each builder documents its pivot: the point that sits at the model's local origin.
 * Coordinates below are in voxel units. +Z is "front" unless noted.
 *
 * HOOK: any of these can be swapped for a MagicaVoxel export:
 *   const { nodes } = useGLTF("/models/bed.glb")  →  <primitive object={nodes.Bed} />
 * Keep the same pivot and scale (1 voxel = FV m) and the zone layout stays correct.
 */
export const FV = 0.06;

const P = {
  walnut: "#5b3a27",
  walnutDark: "#3e2719",
  walnutLight: "#7a5135",
  black: "#17161b",
  charcoal: "#24232a",
  steel: "#8d8f99",
  cream: "#e9e2d4",
  linen: "#d8cfbf",
  plum: "#4a3a62",
  plumLight: "#5c4a78",
  mustard: "#c4913c",
  marble: "#e7e4e0",
  vein: "#a9a6a4",
  terracotta: "#b5643f",
  leaf: "#3f6b45",
  leafLight: "#5f8f57",
  leafDark: "#2b4a31",
  amber: "#ffb35c",
  gold: "#ffcb6b",
  cyan: "#47dcff",
  ink: "#0b1020",
};

const cache = new Map<string, VoxelModelData>();
function memo(name: string, make: () => VoxelModelData) {
  if (!cache.has(name)) cache.set(name, make());
  return cache.get(name)!;
}

/* ============================== SLEEPING AREA ============================== */

/** Low platform bed, head toward -X. Pivot: bottom centre. Footprint 2.7 m × 2.1 m. */
export const bed = () =>
  memo("bed", () => {
    const b = new VoxelBuilder(21);
    const L = 44;
    const Wd = 34;
    // floating plinth (recessed) + frame
    b.box(3, 0, 3, L - 3, 1, Wd - 3, P.black);
    b.box(0, 2, 0, L, 4, Wd, P.walnut);
    b.paint((x, y, z) => (y === 4 && (x === 0 || x === L || z === 0 || z === Wd) ? P.walnutLight : null));
    // amber under-glow around the plinth
    for (let x = 3; x <= L - 3; x++) {
      b.set(x, 0, 2, P.amber, { glow: true });
      b.set(x, 0, Wd - 2, P.amber, { glow: true });
    }
    for (let z = 3; z <= Wd - 3; z++) b.set(L - 2, 0, z, P.amber, { glow: true });
    // mattress with rounded corners
    b.box(1, 5, 1, L - 1, 8, Wd - 1, P.cream);
    for (const x of [1, L - 1]) for (const z of [1, Wd - 1]) b.del(x, 8, z);
    b.paint((x, y, z) => (y === 5 ? shade(P.cream, 0.85) : null));
    // upholstered headboard with vertical channels
    b.box(-2, 2, -1, 0, 20, Wd + 1, (x, y, z) => (z % 4 === 0 ? shade("#3b3347", 0.8) : "#3b3347"));
    b.box(-2, 21, 0, 0, 21, Wd, shade("#3b3347", 1.1));
    // pillows
    b.ellipsoid(6, 10, 9, 3.6, 2, 6.5, "#f2ede6");
    b.ellipsoid(6, 10, 25, 3.6, 2, 6.5, "#f2ede6");
    b.ellipsoid(9.5, 10, 17, 2.4, 1.8, 4, "#8e7fbf"); // accent cushion
    // rumpled blanket from the chest down, draping over the sides
    const fold = (x: number, z: number) =>
      1.2 + Math.sin(x * 0.45) * 0.8 + Math.cos(z * 0.38 + x * 0.21) * 0.9 + (hash3(x, 0, z, 4) - 0.5) * 0.6 + (z > 10 && z < 24 ? 0.8 : 0);
    b.heightfield(14, 0, L, Wd, 9, fold, (x, y, z, top) => (y === top ? (Math.sin(x * 0.45 + z * 0.2) > 0.4 ? P.plumLight : P.plum) : shade(P.plum, 0.85)));
    for (let x = 14; x <= L; x++)
      for (const z of [-1, Wd + 1]) for (let y = 5; y <= 9; y++) b.set(x, y, z, shade(P.plum, 0.8 + (x % 3) * 0.05));
    for (let z = -1; z <= Wd + 1; z++) for (let y = 5; y <= 9; y++) b.set(L + 1, y, z, shade(P.plum, 0.82));
    // folded mustard throw at the foot
    b.box(L - 6, 10, 2, L - 2, 11, Wd - 2, (x) => (x % 2 ? P.mustard : shade(P.mustard, 0.85)));
    return b.build(FV, [L / 2, 0, Wd / 2]);
  });

/** Nightstand with a voxel lamp, books and a phone. Pivot: bottom centre. */
export const nightstand = () =>
  memo("nightstand", () => {
    const b = new VoxelBuilder(22);
    b.box(-4, 0, -4, 4, 8, 4, P.walnut);
    b.box(-4, 4, 5, 4, 4, 5, P.walnutDark); // drawer seam
    b.set(0, 6, 5, P.steel); // knob
    // lamp: base, stem, glowing shade
    b.cylY(-1, -1, 1.6, 9, 9, P.black);
    b.box(-1, 10, -1, -1, 13, -1, P.steel);
    b.cylY(-1, -1, 2.6, 14, 17, P.amber, { glow: true });
    b.cylY(-1, -1, 2.6, 18, 18, shade(P.amber, 0.7));
    // books + phone
    b.box(1, 9, 1, 4, 9, 4, "#6d3f43");
    b.box(1, 10, 1, 4, 10, 3, "#2f4f6f");
    b.box(-3, 9, 2, -2, 9, 4, P.black);
    b.set(-3, 10, 3, P.cyan, { glow: true });
    return b.build(FV, [0, 0, 0]);
  });

/* ================================== OFFICE ================================= */

/** Walnut desk with felt mat, ultrawide monitor, mechanical keyboard, mouse, laptop. Faces +Z (you sit on the +Z side). Pivot: bottom centre. */
export const desk = () =>
  memo("desk", () => {
    const b = new VoxelBuilder(31);
    // top 32 × 13, at 0.78 m
    b.box(-16, 12, -6, 15, 12, 6, P.walnut);
    b.paint((x, y, z) => (y === 12 && (z === 6 || x === -16 || x === 15) ? P.walnutLight : null));
    // sled legs
    for (const x of [-15, 14]) {
      b.box(x, 0, -5, x, 11, -5, P.black);
      b.box(x, 0, 5, x, 11, 5, P.black);
      b.box(x, 0, -5, x, 0, 5, P.black);
      b.box(x, 11, -5, x, 11, 5, P.black);
    }
    // dark felt desk mat
    b.box(-11, 13, -1, 10, 13, 5, "#1d1c23");
    // ultrawide monitor (slight curve), stand and base
    b.box(-3, 13, -5, 2, 13, -3, P.charcoal);
    b.box(-1, 14, -4, 0, 18, -4, P.charcoal);
    const sx0 = -10;
    const sx1 = 9;
    for (let x = sx0 - 1; x <= sx1 + 1; x++) {
      const zc = Math.abs(x + 0.5) > 8 ? -4 : -5; // curved wings come forward
      for (let y = 17; y <= 25; y++) {
        const edge = x === sx0 - 1 || x === sx1 + 1 || y === 17 || y === 25;
        b.set(x, y, zc - 1, P.black);
        if (edge) b.set(x, y, zc, P.black);
        else {
          // screen content: dark UI with cyan charts and text rows
          let col = "#0c1a2c";
          const u = x - sx0;
          const v = y - 18;
          if (v === 6) col = u < 3 ? "#ff6fa5" : "#14304f"; // title bar
          else if (u >= 1 && u <= 8 && v <= 4) col = v < [2, 3, 4, 3, 5, 4, 5, 6][u - 1] - 1 ? "#47dcff" : "#0c1a2c"; // bar chart
          else if (u >= 10 && v <= 5 && v % 2 === 1) col = hash3(u, v, 1) > 0.35 ? "#7fb6ff" : "#0c1a2c"; // text
          else if (u >= 10 && v === 0) col = "#ffcb6b";
          b.set(x, y, zc, col, { glow: true });
        }
      }
    }
    // mechanical keyboard
    b.box(-6, 13, 1, 4, 13, 3, "#2a2a31");
    for (let x = -6; x <= 4; x++)
      for (let z = 1; z <= 3; z++) {
        let cap = x % 2 === 0 ? "#e9e4da" : "#cfc8bb";
        if (x === -6 && z === 1) cap = "#ff8a3d"; // esc
        if (x === 4 && z === 2) cap = "#ff8a3d"; // enter
        if (z === 3 && x >= -3 && x <= 1) cap = "#bdb6a8"; // spacebar row
        b.set(x, 14, z, cap);
      }
    for (let x = -6; x <= 4; x++) b.set(x, 13, 4, "#9b7bff", { glow: true }); // underglow lip
    // mouse
    b.box(7, 14, 2, 7, 14, 3, "#e9e4da");
    // laptop on the right, screen facing the chair
    b.box(9, 13, -2, 14, 13, 3, "#a6a8b2");
    b.box(9, 14, -3, 14, 18, -3, "#a6a8b2");
    for (let x = 9; x <= 14; x++)
      for (let y = 14; y <= 18; y++) {
        const edge = x === 9 || x === 14 || y === 14 || y === 18;
        const row = y - 15;
        b.set(x, y, -2, edge ? "#2a2c34" : row === 2 ? "#1f6feb" : (x + row) % 3 === 0 ? "#2b6a59" : "#d8e6ff", edge ? {} : { glow: true });
      }
    // mug + mini plant
    b.cylY(-14, 3, 1.2, 13, 15, "#e9e4da");
    b.set(-14, 16, 3, "#3a2416");
    b.cylY(-13, -3, 1.4, 13, 14, P.terracotta);
    for (let i = 0; i < 14; i++) b.set(-13 + Math.round(Math.sin(i * 2.1) * 1.5), 15 + (i % 4), -3 + Math.round(Math.cos(i * 1.7) * 1.5), i % 3 ? P.leaf : P.leafLight);
    return b.build(FV, [0, 0, 0]);
  });

/** Ergonomic mesh chair, back toward +Z. Pivot: bottom centre (under the seat). */
export const chair = () =>
  memo("chair", () => {
    const b = new VoxelBuilder(32);
    // five-star base on casters
    for (const [dx, dz] of [[0, -4], [4, -1], [2, 4], [-2, 4], [-4, -1]]) {
      const steps = 4;
      for (let i = 0; i <= steps; i++) b.set(Math.round((dx * i) / steps), 1, Math.round((dz * i) / steps), P.charcoal);
      b.set(dx, 0, dz, P.black);
    }
    b.box(0, 2, 0, 0, 4, 0, P.steel); // gas lift
    // seat cushion (top at ~0.42 m)
    b.box(-4, 5, -4, 4, 6, 4, "#2b2a33");
    b.paint((x, y, z) => (y === 6 && Math.abs(x) < 4 && Math.abs(z) < 4 ? "#33323c" : null));
    // mesh back with lumbar + headrest
    b.box(-4, 7, 5, 4, 18, 5, (x, y) => ((x + y) % 2 === 0 ? "#2b2a33" : "#3a3946"));
    b.box(-3, 10, 4, 3, 11, 4, "#45444f");
    b.box(-2, 19, 5, 2, 21, 5, "#2b2a33");
    b.box(-5, 7, 5, -5, 18, 5, P.charcoal).box(5, 7, 5, 5, 18, 5, P.charcoal);
    // armrests
    for (const x of [-5, 5]) {
      b.box(x, 7, 0, x, 9, 0, P.charcoal);
      b.box(x, 10, -2, x, 10, 2, "#3a3946");
    }
    return b.build(FV, [0.5, 0, 0.5]);
  });

/* =================================== GYM =================================== */

/** Matte black yoga mat with a rolled end. Long side along Z. Pivot: bottom centre. */
export const yogaMat = () =>
  memo("yogaMat", () => {
    const b = new VoxelBuilder(41, 0.04);
    b.box(-5, 0, -15, 5, 0, 14, "#141417");
    b.paint((x, y, z) => (Math.abs(x) === 5 || z === -15 ? "#1d1d22" : null));
    b.cylX(1.4, 15.5, 1.4, -5, 5, "#1b1b20");
    return b.build(FV, [0.5, 0, 0]);
  });

/** Two-tier A-frame dumbbell rack with five hex pairs. Long side along Z. Pivot: bottom centre. */
export const dumbbellRack = () =>
  memo("dumbbellRack", () => {
    const b = new VoxelBuilder(42);
    for (const z of [-12, 12]) {
      for (let y = 0; y <= 12; y++) {
        b.set(-3 + Math.floor(y / 4), y, z, P.black);
        b.set(3 - Math.floor(y / 4), y, z, P.black);
      }
    }
    b.box(-2, 5, -12, -2, 5, 12, P.charcoal); // lower rail
    b.box(1, 10, -12, 1, 10, 12, P.charcoal); // upper rail
    const sizes = [1, 1.3, 1.6, 1.9, 2.2];
    sizes.forEach((r, i) => {
      const z = -9 + i * 4.5;
      // lower tier, heavier
      b.cylX(6 + r, z, r + 0.2, -4, -3, "#25252b");
      b.cylX(6 + r, z, r + 0.2, 0, 1, "#25252b");
      b.box(-2, 6 + Math.round(r), Math.round(z), -1, 6 + Math.round(r), Math.round(z), P.steel);
      // upper tier, lighter, with a coloured band
      const rr = r * 0.7;
      b.cylX(11 + rr, z, rr, -1, -1, "#2b2b31");
      b.cylX(11 + rr, z, rr, 2, 2, "#2b2b31");
      b.set(0, 11 + Math.round(rr), Math.round(z), ["#ff8a3d", "#47dcff", "#9b7bff", "#ffcb6b", "#ff6fa5"][i]);
      b.set(1, 11 + Math.round(rr), Math.round(z), P.steel);
    });
    return b.build(FV, [0.5, 0, 0.5]);
  });

/** Modern indoor bike, facing +Z. Pivot: bottom centre. */
export const bike = () =>
  memo("bike", () => {
    const b = new VoxelBuilder(43);
    // feet
    b.box(-4, 0, -10, 4, 0, -10, P.black);
    b.box(-4, 0, 9, 4, 0, 9, P.black);
    // flywheel at the front with a glowing ring
    b.cylX(6, 7, 5, -1, 1, "#202027");
    b.cylX(6, 7, 5.2, 0, 0, "#ff8a3d", { ring: true, glow: true });
    b.cylX(6, 7, 1.2, -2, 2, P.steel);
    // frame
    for (let i = 0; i <= 12; i++) b.set(0, 1 + i, 9 - Math.round(i * 0.9), P.charcoal); // down tube
    for (let i = 0; i <= 10; i++) b.set(0, 1 + Math.round(i * 1.3), -9 + Math.round(i * 0.5), P.charcoal); // seat tube
    b.box(0, 0, -9, 0, 1, 9, P.charcoal);
    // seat
    b.box(-1, 15, -6, 1, 15, -2, "#2b2a33");
    b.box(0, 14, -4, 0, 14, -4, P.steel);
    // handlebars + console
    b.box(0, 13, 1, 0, 17, 1, P.charcoal);
    b.box(-3, 17, 2, 3, 17, 2, P.charcoal);
    b.box(-1, 18, 1, 1, 19, 1, P.black);
    b.set(0, 18, 2, P.cyan, { glow: true }).set(-1, 19, 2, P.cyan, { glow: true }).set(1, 18, 2, "#ff8a3d", { glow: true });
    // pedals
    b.box(-2, 5, 0, -2, 5, 1, P.black).box(2, 7, -1, 2, 7, 0, P.black);
    return b.build(FV, [0.5, 0, 0.5]);
  });

/** Kettlebell + foam roller cluster. Pivot: bottom centre. */
export const gymSmalls = () =>
  memo("gymSmalls", () => {
    const b = new VoxelBuilder(44);
    b.ellipsoid(0, 2, 0, 2.4, 2.2, 2.4, "#1c1c22");
    b.box(-1, 5, 0, 1, 5, 0, "#1c1c22").set(-2, 4, 0, "#1c1c22").set(2, 4, 0, "#1c1c22");
    b.cylX(1.6, 6, 1.6, -5, 5, "#5d4e8c");
    return b.build(FV, [0, 0, 0]);
  });

/* ================================= KITCHEN ================================= */

/** Marble island with waterfall ends and a walnut slatted body. Long side along X. Pivot: bottom centre. */
export const island = () =>
  memo("island", () => {
    const b = new VoxelBuilder(51, 0.03);
    const marble = (x: number, y: number, z: number) => {
      const v = Math.sin(x * 0.35 + z * 0.9 + Math.sin(y * 0.7 + z * 0.3) * 2.2);
      if (Math.abs(v) < 0.07) return P.vein;
      return hash3(x, y, z, 2) > 0.94 ? shade(P.marble, 0.94) : P.marble;
    };
    // slatted walnut body (recessed)
    b.box(-19, 1, -6, 19, 13, 6, (x) => (x % 3 === 0 ? P.walnutDark : P.walnut));
    b.box(-19, 0, -6, 19, 0, 6, P.black);
    // marble top with overhang on the +Z (stool) side
    b.box(-22, 14, -8, 22, 15, 9, marble);
    // waterfall ends
    b.box(-22, 0, -8, -21, 13, 9, marble);
    b.box(21, 0, -8, 22, 13, 9, marble);
    // gold LED strip under the overhang
    for (let x = -20; x <= 20; x++) b.set(x, 13, 8, P.gold, { glow: true });
    // cutting board, bowl, and two mini plants
    b.box(-6, 16, -2, 1, 16, 2, "#9a6a43");
    b.set(-1, 17, 0, "#e04f3f").set(-3, 17, 1, "#7cc35b").set(-4, 17, -1, "#f2c14e");
    b.cylY(7, 0, 2.2, 16, 17, "#ece8e2", { ring: true });
    b.cylY(7, 0, 1.4, 16, 16, "#ece8e2");
    for (const [px, pz] of [[15, -3], [18, 1]]) {
      b.cylY(px, pz, 1.3, 16, 17, P.terracotta);
      for (let i = 0; i < 12; i++)
        b.set(px + Math.round(Math.sin(i * 2.3) * 1.6), 18 + (i % 3), pz + Math.round(Math.cos(i * 1.9) * 1.6), i % 3 === 0 ? P.leafLight : P.leaf);
      b.set(px, 21, pz, P.leafLight);
    }
    return b.build(FV, [0.5, 0, 0.5]);
  });

/** Minimal bar stool. Pivot: bottom centre. */
export const stool = () =>
  memo("stool", () => {
    const b = new VoxelBuilder(52);
    b.cylY(0, 0, 2.6, 11, 11, "#2c2a33");
    b.cylY(0, 0, 2.2, 12, 12, "#3a3843");
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) b.box(x, 0, z, x, 10, z, P.black);
    b.cylY(0, 0, 2.4, 4, 4, P.steel, { ring: true });
    return b.build(FV, [0, 0, 0]);
  });

/** Back run of cabinets with counter, upper cabinets, gold under-cabinet LEDs and a fridge. Runs along Z. Pivot: bottom centre of the counter run. */
export const backKitchen = () =>
  memo("backKitchen", () => {
    const b = new VoxelBuilder(53);
    const Z0 = -22;
    const Z1 = 22;
    // base cabinets + quartz counter
    b.box(-5, 1, Z0, 5, 14, Z1, (x, y, z) => (z % 8 === 0 ? P.black : "#22212a"));
    b.box(-5, 0, Z0, 5, 0, Z1, P.black);
    b.box(-6, 15, Z0, 5, 15, Z1, "#cfc9c2");
    for (let z = Z0 + 4; z < Z1; z += 8) b.box(-6, 12, z, -6, 12, z + 1, P.steel); // handles
    // backsplash + upper cabinets
    b.box(5, 16, Z0, 5, 26, Z1, (x, y, z) => ((y + Math.floor(z / 2)) % 2 ? "#2d2b36" : "#33313d"));
    b.box(0, 27, Z0, 5, 36, Z1, (x, y, z) => (z % 8 === 0 ? P.black : "#22212a"));
    // warm gold under-cabinet LED strip
    for (let z = Z0 + 1; z <= Z1 - 1; z++) b.set(0, 26, z, P.gold, { glow: true });
    // sink + tap
    b.box(-4, 15, -4, -1, 15, 3, "#3c3f48");
    b.box(2, 16, 0, 2, 20, 0, P.steel).box(0, 20, 0, 2, 20, 0, P.steel);
    // kettle, jars, cookbook
    b.cylY(-2, 12, 1.6, 16, 19, P.black);
    b.set(-2, 20, 12, P.steel);
    for (const [z, c] of [[-14, "#e8dcc6"], [-11, "#c69d6a"], [-8, "#8e7a5c"]] as const) b.cylY(-1, z, 1.1, 16, 18, c);
    b.box(-2, 16, 17, 2, 21, 17, "#6d3f43");
    // fridge at the +Z end
    b.box(-6, 0, Z1 + 1, 5, 40, Z1 + 14, "#2b2a33");
    b.box(-7, 18, Z1 + 2, -7, 30, Z1 + 2, P.steel);
    b.box(-7, 5, Z1 + 2, -7, 15, Z1 + 2, P.steel);
    b.box(-6, 16, Z1 + 1, -6, 16, Z1 + 14, P.black);
    return b.build(FV, [0.5, 0, 0]);
  });

/** Glass pendant with a warm voxel bulb. Pivot: bulb centre. */
export const pendant = () =>
  memo("pendant", () => {
    const b = new VoxelBuilder(54);
    b.box(0, 3, 0, 0, 30, 0, P.black);
    b.ellipsoid(0, 0, 0, 2.2, 2, 2.2, P.gold, { glow: true });
    b.box(-1, 2, -1, 1, 2, 1, P.black);
    return b.build(FV, [0.5, 0, 0.5]);
  });

/* ================================== LIVING ================================= */

/** Low three-seat sofa, facing -Z (toward the windows). Pivot: bottom centre. */
export const sofa = () =>
  memo("sofa", () => {
    const b = new VoxelBuilder(61, 0.05);
    const base = "#2b2738";
    b.box(-24, 1, -7, 24, 5, 7, base);
    b.box(-24, 0, -7, 24, 0, 7, P.black);
    // seat cushions
    for (const x0 of [-22, -7, 8]) b.box(x0, 6, -7, x0 + 13, 8, 4, "#38334a");
    // back cushions + arms
    b.box(-24, 6, 5, 24, 14, 7, base);
    for (const x0 of [-22, -7, 8]) b.box(x0, 9, 3, x0 + 13, 14, 4, "#3e3852");
    b.box(-27, 1, -7, -25, 11, 7, base).box(25, 1, -7, 27, 11, 7, base);
    // throw pillows + blanket
    b.ellipsoid(-18, 11, 1, 3, 2.8, 1.6, P.mustard);
    b.ellipsoid(18, 11, 1, 3, 2.8, 1.6, "#9384c2");
    b.box(4, 9, -6, 14, 9, 2, (x) => (x % 2 ? "#b9a98d" : "#a39274"));
    return b.build(FV, [0.5, 0, 0.5]);
  });

/** Walnut coffee table with books and a candle. Pivot: bottom centre. */
export const coffeeTable = () =>
  memo("coffeeTable", () => {
    const b = new VoxelBuilder(62);
    b.box(-11, 5, -6, 11, 6, 6, P.walnut);
    b.box(-10, 0, -5, 10, 4, 5, P.walnutDark);
    b.carve(-9, 1, -6, 9, 3, 6);
    b.box(-8, 7, -3, -2, 7, 2, "#2f4f6f").box(-7, 8, -3, -2, 8, 1, "#c6b79b");
    b.cylY(4, 0, 1.2, 7, 9, "#efe6d6");
    b.set(4, 10, 0, P.amber, { glow: true });
    return b.build(FV, [0.5, 0, 0.5]);
  });

/** Arc floor lamp with a warm glow. Pivot: base centre. */
export const floorLamp = () =>
  memo("floorLamp", () => {
    const b = new VoxelBuilder(63);
    b.cylY(0, 0, 2.2, 0, 1, P.black);
    for (let i = 0; i <= 30; i++) {
      const a = (i / 30) * Math.PI * 0.62;
      b.set(Math.round(Math.sin(a) * 12), 2 + Math.round(Math.sin(a + 0.4) * 24 + i * 0.3), 0, P.steel);
    }
    b.ellipsoid(12, 26, 0, 2.6, 1.8, 2.6, P.amber, { glow: true });
    b.ellipsoid(12, 28, 0, 3, 1.2, 3, P.black);
    return b.build(FV, [0.5, 0, 0.5]);
  });

/** Big pixel monstera in a terracotta pot. Pivot: base centre. */
export const bigPlant = () =>
  memo("bigPlant", () => {
    const b = new VoxelBuilder(64);
    b.cylY(0, 0, 3.5, 0, 7, P.terracotta);
    b.cylY(0, 0, 3.5, 7, 7, shade(P.terracotta, 0.8));
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const len = 6 + (i % 3) * 2;
      for (let s = 0; s <= len; s++) {
        const x = Math.round(Math.cos(a) * s * 0.7);
        const z = Math.round(Math.sin(a) * s * 0.7);
        const y = 8 + Math.round(s * 1.4 - (s * s) / (len * 2.2));
        b.set(x, y, z, P.leafDark);
        if (s > len * 0.45) {
          b.ellipsoid(x, y, z, 2.2, 0.9, 2.2, (i + s) % 3 === 0 ? P.leafLight : P.leaf);
        }
      }
    }
    return b.build(FV, [0, 0, 0]);
  });

/** Turntable on a low console with a speaker, for the lofi corner. Pivot: bottom centre. */
export const recordConsole = () =>
  memo("recordConsole", () => {
    const b = new VoxelBuilder(65);
    b.box(-10, 0, -3, 10, 7, 3, P.walnut);
    b.box(-10, 3, 4, 10, 3, 4, P.walnutDark);
    b.box(-8, 8, -2, -1, 8, 2, P.charcoal);
    b.cylY(-4.5, 0, 2, 9, 9, "#121214");
    b.set(-4.5, 10, 0, "#c4913c");
    b.box(-2, 9, -2, -2, 9, 1, P.steel);
    b.box(3, 8, -2, 8, 15, 2, "#202027");
    b.cylZ(5.5, 11, 1.6, 3, 3, "#3a3946");
    b.set(8, 14, 3, P.cyan, { glow: true });
    return b.build(FV, [0.5, 0, 0.5]);
  });

export const PALETTE = P;
export { mix, shade };
