import * as THREE from "three";

/**
 * VoxelBuilder: a tiny "voxel paint" API used for every model in the penthouse.
 *
 *   const b = new VoxelBuilder();
 *   b.box(0, 0, 0, 9, 2, 5, "#5b3a29");     // inclusive integer ranges, in voxel units
 *   b.set(4, 3, 2, "#7af", { glow: true });  // glowing voxels go into a separate unlit, bloom-friendly mesh
 *   const model = b.build(0.06, [5, 0, 3]);  // voxel size in metres + pivot (in voxel units)
 *
 * Interior voxels are culled on build, and every voxel gets a tiny deterministic brightness
 * jitter so flat surfaces read as hand-placed pixel art instead of plastic.
 */

export type ColorIn = string | number | THREE.Color;
type Cell = { c: THREE.Color; glow: boolean; jitter: number };

export type VoxelModelData = {
  size: number;
  solid: { positions: Float32Array; colors: Float32Array; count: number };
  glow: { positions: Float32Array; colors: Float32Array; count: number };
  /** Bounds in metres, after the pivot offset (handy for hit boxes and labels). */
  min: [number, number, number];
  max: [number, number, number];
};

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

/** Stable 0..1 hash of a voxel coordinate. */
export function hash3(x: number, y: number, z: number, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const _c = new THREE.Color();
export function color(c: ColorIn) {
  return c instanceof THREE.Color ? c.clone() : new THREE.Color(c as THREE.ColorRepresentation);
}

export class VoxelBuilder {
  private cells = new Map<string, Cell>();
  constructor(private seed = 1, private defaultJitter = 0.07) {}

  get size() {
    return this.cells.size;
  }

  has(x: number, y: number, z: number) {
    return this.cells.has(key(x, y, z));
  }

  get(x: number, y: number, z: number) {
    return this.cells.get(key(x, y, z));
  }

  set(x: number, y: number, z: number, c: ColorIn, opts: { glow?: boolean; jitter?: number } = {}) {
    this.cells.set(key(Math.round(x), Math.round(y), Math.round(z)), {
      c: color(c),
      glow: !!opts.glow,
      jitter: opts.jitter ?? (opts.glow ? 0.03 : this.defaultJitter),
    });
    return this;
  }

  del(x: number, y: number, z: number) {
    this.cells.delete(key(x, y, z));
    return this;
  }

  /** Inclusive box fill. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: ColorIn | ((x: number, y: number, z: number) => ColorIn | null), opts: { glow?: boolean; jitter?: number } = {}) {
    const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
    const [az, bz] = [Math.min(z0, z1), Math.max(z0, z1)];
    for (let x = ax; x <= bx; x++)
      for (let y = ay; y <= by; y++)
        for (let z = az; z <= bz; z++) {
          const col = typeof c === "function" ? c(x, y, z) : c;
          if (col != null) this.set(x, y, z, col, opts);
        }
    return this;
  }

  /** Remove a box (carving). */
  carve(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.del(x, y, z);
    return this;
  }

  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: ColorIn, opts: { glow?: boolean; jitter?: number } = {}) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (d <= 1) this.set(x, y, z, c, opts);
        }
    return this;
  }

  /** Vertical cylinder (axis Y). */
  cylY(cx: number, cz: number, r: number, y0: number, y1: number, c: ColorIn, opts: { glow?: boolean; jitter?: number; ring?: boolean } = {}) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > r + 0.15) continue;
        if (opts.ring && d < r - 1) continue;
        for (let y = y0; y <= y1; y++) this.set(x, y, z, c, opts);
      }
    return this;
  }

  /** Cylinder along X (wheels, dumbbell heads, barbells). */
  cylX(cy: number, cz: number, r: number, x0: number, x1: number, c: ColorIn, opts: { glow?: boolean; jitter?: number; ring?: boolean } = {}) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
        const d = Math.hypot(y - cy, z - cz);
        if (d > r + 0.15) continue;
        if (opts.ring && d < r - 1) continue;
        for (let x = x0; x <= x1; x++) this.set(x, y, z, c, opts);
      }
    return this;
  }

  /** Cylinder along Z. */
  cylZ(cx: number, cy: number, r: number, z0: number, z1: number, c: ColorIn, opts: { glow?: boolean; jitter?: number; ring?: boolean } = {}) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r + 0.15) continue;
        if (opts.ring && d < r - 1) continue;
        for (let z = z0; z <= z1; z++) this.set(x, y, z, c, opts);
      }
    return this;
  }

  /** A column of voxels whose top follows height(x, z). Great for rumpled blankets and cushions. */
  heightfield(x0: number, z0: number, x1: number, z1: number, base: number, height: (x: number, z: number) => number, c: ColorIn | ((x: number, y: number, z: number, top: number) => ColorIn)) {
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const top = base + Math.max(0, Math.round(height(x, z)));
        for (let y = base; y <= top; y++) this.set(x, y, z, typeof c === "function" ? c(x, y, z, top) : c);
      }
    return this;
  }

  /** Recolour existing voxels. Return null to keep the current colour. */
  paint(fn: (x: number, y: number, z: number, current: THREE.Color) => ColorIn | null) {
    for (const [k, cell] of this.cells) {
      const [x, y, z] = k.split(",").map(Number);
      const next = fn(x, y, z, cell.c);
      if (next != null) cell.c = color(next);
    }
    return this;
  }

  /** Copy another builder in at an offset. */
  merge(other: VoxelBuilder, dx = 0, dy = 0, dz = 0) {
    for (const [k, cell] of other.cells) {
      const [x, y, z] = k.split(",").map(Number);
      this.cells.set(key(x + dx, y + dy, z + dz), { ...cell, c: cell.c.clone() });
    }
    return this;
  }

  /** Mirror everything across x = axis (inclusive). */
  mirrorX(axis: number) {
    const add: [string, Cell][] = [];
    for (const [k, cell] of this.cells) {
      const [x, y, z] = k.split(",").map(Number);
      add.push([key(2 * axis - x, y, z), { ...cell, c: cell.c.clone() }]);
    }
    for (const [k, v] of add) this.cells.set(k, v);
    return this;
  }

  /**
   * Bake to instance buffers.
   * @param size  voxel edge length in metres
   * @param pivot pivot in voxel units; the model's local origin sits there
   */
  build(size: number, pivot: [number, number, number] = [0, 0, 0]): VoxelModelData {
    const solidP: number[] = [];
    const solidC: number[] = [];
    const glowP: number[] = [];
    const glowC: number[] = [];
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

    for (const [k, cell] of this.cells) {
      const [x, y, z] = k.split(",").map(Number);
      // cull voxels that can't be seen (all six neighbours are solid, non-glowing)
      const n = (dx: number, dy: number, dz: number) => {
        const o = this.cells.get(key(x + dx, y + dy, z + dz));
        return !!o && !o.glow;
      };
      if (!cell.glow && n(1, 0, 0) && n(-1, 0, 0) && n(0, 1, 0) && n(0, -1, 0) && n(0, 0, 1) && n(0, 0, -1)) continue;

      const px = (x - pivot[0] + 0.5) * size;
      const py = (y - pivot[1] + 0.5) * size;
      const pz = (z - pivot[2] + 0.5) * size;
      const j = 1 + (hash3(x, y, z, this.seed) - 0.5) * 2 * cell.jitter;
      _c.copy(cell.c).multiplyScalar(j);
      (cell.glow ? glowP : solidP).push(px, py, pz);
      (cell.glow ? glowC : solidC).push(_c.r, _c.g, _c.b);
      min[0] = Math.min(min[0], px - size / 2);
      min[1] = Math.min(min[1], py - size / 2);
      min[2] = Math.min(min[2], pz - size / 2);
      max[0] = Math.max(max[0], px + size / 2);
      max[1] = Math.max(max[1], py + size / 2);
      max[2] = Math.max(max[2], pz + size / 2);
    }
    return {
      size,
      solid: { positions: new Float32Array(solidP), colors: new Float32Array(solidC), count: solidP.length / 3 },
      glow: { positions: new Float32Array(glowP), colors: new Float32Array(glowC), count: glowP.length / 3 },
      min,
      max,
    };
  }
}

/* ----------------------------- colour helpers ----------------------------- */

/** Mix two colours (t = 0 → a, 1 → b). */
export function mix(a: ColorIn, b: ColorIn, t: number) {
  return color(a).lerp(color(b), t);
}
export function shade(c: ColorIn, k: number) {
  return color(c).multiplyScalar(k);
}
