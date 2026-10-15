import { VoxelBuilder, mix, shade, type VoxelModelData } from "../voxel/builder";
import type { Outfit } from "./outfits";

/** Character voxel size (metres). Finer than furniture so faces, laces and drawstrings read. */
export const CV = 0.04;

/** Rig measurements in metres, derived from the voxel layout below. */
export const RIG = {
  hipY: 22 * CV, // sole → hip joint
  hipX: 2.6 * CV,
  shoulderY: 12 * CV, // above the hips
  shoulderX: 8.5 * CV,
  neckY: 14 * CV, // head pivot above the hips
  kneeY: -10 * CV, // below the hip joint
  elbowY: -8 * CV, // below the shoulder
  thigh: 10 * CV,
  shin: 12 * CV,
};

export type CharacterParts = {
  head: VoxelModelData;
  torso: VoxelModelData;
  upperArm: VoxelModelData;
  foreArm: VoxelModelData;
  thigh: VoxelModelData;
  shin: VoxelModelData;
};

const rib = (base: string, x: number) => (x % 2 === 0 ? base : shade(base, 0.86));

function head(o: Outfit) {
  const b = new VoxelBuilder(11, 0.05);
  // skull 9×9×8, face toward +Z
  b.box(-4, 0, -4, 4, 8, 3, o.skin);
  for (const x of [-4, 4]) for (const y of [0, 8]) for (const z of [-4, 3]) b.del(x, y, z);
  for (const x of [-4, 4]) b.del(x, 0, 2);
  // hair: crown, back and sides, with an uneven fringe
  b.paint((x, y, z) => {
    if (y >= 7) return o.hair;
    if (z <= -3 && y >= 2) return o.hair;
    if ((x === -4 || x === 4) && y >= 5 && z <= 1) return o.hair;
    return null;
  });
  for (const [x, y] of [[-4, 6], [-3, 6], [-2, 6], [-1, 5], [0, 6], [1, 6], [3, 6], [4, 6], [-3, 5]]) b.set(x, y, 3, o.hair);
  b.box(-4, 9, -3, 3, 9, 2, o.hair); // volume on top
  b.set(-1, 9, 3, o.hair).set(2, 9, 3, o.hair);
  // face
  const eye = "#17121d";
  b.set(-2, 3, 3, eye).set(-2, 4, 3, eye).set(2, 3, 3, eye).set(2, 4, 3, eye);
  b.set(-3, 5, 3, shade(o.hair, 1.2)).set(-2, 5, 3, shade(o.hair, 1.2)).set(2, 5, 3, shade(o.hair, 1.2)).set(3, 5, 3, shade(o.hair, 1.2));
  const blush = mix(o.skin, "#ff6f7d", 0.35);
  b.set(-3, 2, 3, blush).set(3, 2, 3, blush);
  b.set(0, 3, 4, shade(o.skin, 0.93)); // nose
  b.set(0, 1, 3, mix(o.skin, "#7a3b33", 0.55)).set(-1, 1, 3, mix(o.skin, "#7a3b33", 0.3));
  // ears
  b.box(-5, 3, -1, -5, 4, 0, shade(o.skin, 0.95)).box(5, 3, -1, 5, 4, 0, shade(o.skin, 0.95));
  // beanie
  if (o.beanie) {
    b.box(-5, 6, -5, 5, 9, 4, (x, y, z) => (Math.abs(x) === 5 && (z === -5 || z === 4) ? null : y === 6 ? rib(o.beanie!, x) : o.beanie!));
    b.box(-4, 10, -4, 4, 10, 3, o.beanie);
    b.carve(-3, 6, 4, 3, 6, 4); // keep the fringe/eyes clear
    b.set(0, 11, 0, shade(o.beanie, 1.15)); // stub
  }
  return b.build(CV, [0.5, 0, 0.5]);
}

function torso(o: Outfit) {
  const b = new VoxelBuilder(12);
  // oversized hoodie body 13 × 13 × 7
  b.box(-6, 0, -3, 6, 12, 3, o.hoodie);
  // drop the shoulders
  b.carve(-6, 12, -3, -6, 12, 3).carve(6, 12, -3, 6, 12, 3);
  b.del(-6, 11, -3).del(6, 11, -3).del(-6, 11, 3).del(6, 11, 3);
  // ribbed hem
  b.box(-6, 0, -3, 6, 1, 3, (x) => rib(o.hoodieTrim, x));
  // soft folds above the hem
  b.paint((x, y, z) => (y === 2 && (x + z) % 3 === 0 ? shade(o.hoodie, 0.9) : null));
  // kangaroo pocket (raised one voxel)
  b.box(-3, 2, 4, 3, 5, 4, shade(o.hoodie, 0.93));
  b.box(-3, 5, 4, 3, 5, 4, shade(o.hoodie, 0.8));
  b.set(-3, 3, 4, shade(o.hoodie, 0.7)).set(3, 3, 4, shade(o.hoodie, 0.7));
  // drawstrings with aglets
  for (const x of [-1, 1]) {
    b.box(x, 8, 4, x, 11, 4, o.strings);
    b.set(x, 7, 4, shade(o.strings, 0.7));
  }
  // tiny chest logo
  b.set(3, 9, 3, o.logo).set(4, 9, 3, o.logo).set(4, 10, 3, o.logo);
  // hood bunched behind the neck + collar ring
  b.box(-4, 10, -5, 4, 13, -4, o.hoodieTrim);
  b.box(-5, 13, -4, 5, 13, 3, o.hoodie);
  b.carve(-2, 13, -2, 2, 13, 2);
  b.box(-3, 12, -6, 3, 12, -6, shade(o.hoodieTrim, 0.85));
  // neck
  b.box(-1, 13, -1, 1, 13, 1, shade(o.skin, 0.92));
  // headphones resting round the neck
  if (o.headphones) {
    b.cylY(0, 0, 3.2, 14, 14, o.headphones, { ring: true });
    for (const x of [-4, 4]) {
      b.box(x, 12, 0, x, 14, 2, o.headphones);
      if (o.headphonesGlow) b.set(x + Math.sign(x), 13, 1, o.headphonesGlow, { glow: true });
    }
  }
  return b.build(CV, [0.5, 0, 0.5]);
}

function upperArm(o: Outfit) {
  const b = new VoxelBuilder(13);
  b.box(-2, -8, -2, 1, -1, 1, o.hoodie);
  b.box(-2, 0, -1, 1, 0, 1, o.hoodie); // shoulder cap
  b.paint((x, y, z) => (y === -5 && (x + z) % 2 === 0 ? shade(o.hoodie, 0.9) : null)); // fold
  return b.build(CV, [0, 0, 0]);
}

function foreArm(o: Outfit) {
  const b = new VoxelBuilder(14);
  b.box(-2, -6, -2, 1, -1, 1, o.hoodie);
  b.paint((x, y, z) => (y === -3 && (x + z) % 2 === 1 ? shade(o.hoodie, 0.9) : null));
  b.box(-2, -7, -2, 1, -7, 1, (x) => rib(o.hoodieTrim, x));
  b.box(-1, -10, -1, 0, -8, 1, o.skin);
  b.set(1, -9, 1, shade(o.skin, 0.95)); // thumb
  return b.build(CV, [0, 0, 0]);
}

function thigh(o: Outfit) {
  const b = new VoxelBuilder(15);
  b.box(-2, -10, -2, 2, -1, 2, o.pants);
  b.paint((x, y, z) => {
    if (Math.abs(x) === 2 && z === 0) return shade(o.pants, 0.82); // side seam
    if ((y === -4 || y === -7) && (x + z) % 2 === 0) return shade(o.pants, 0.9); // slouch folds
    return null;
  });
  b.box(-2, -1, -2, 2, -1, 2, shade(o.pants, 0.95));
  return b.build(CV, [0.5, 0, 0.5]);
}

function shin(o: Outfit) {
  const b = new VoxelBuilder(16);
  // jogger leg + ribbed cuff
  b.box(-2, -7, -2, 2, -1, 2, o.pants);
  b.paint((x, y, z) => (Math.abs(x) === 2 && z === 0 ? shade(o.pants, 0.82) : y === -5 && (x + z) % 2 === 0 ? shade(o.pants, 0.9) : null));
  b.box(-2, -8, -2, 2, -8, 2, (x) => rib(o.pantsCuff, x));
  // sneaker: sole, upper, heel collar, toe box
  b.box(-2, -12, -3, 2, -12, 4, o.sole);
  b.box(-2, -11, -3, 2, -10, 4, o.shoe);
  b.box(-2, -9, -3, 2, -9, -1, o.shoe);
  b.del(-2, -10, 4).del(2, -10, 4);
  // side stripe, heel tab, laces
  for (const x of [-2, 2]) for (let z = -1; z <= 3; z++) b.set(x, -11, z, o.shoeAccent);
  b.box(-1, -10, -3, 1, -9, -3, o.shoeAccent);
  for (const [x, z] of [[-1, 1], [1, 1], [-1, 3], [1, 3]]) b.set(x, -10, z, shade(o.shoe, 0.8));
  b.set(0, -10, 2, shade(o.shoe, 0.8));
  return b.build(CV, [0.5, 0, 0.5]);
}

const cache = new Map<string, CharacterParts>();

/** Bake all body parts for an outfit (memoised per outfit). */
export function buildCharacter(o: Outfit): CharacterParts {
  const k = JSON.stringify(o);
  if (!cache.has(k)) {
    cache.set(k, { head: head(o), torso: torso(o), upperArm: upperArm(o), foreArm: foreArm(o), thigh: thigh(o), shin: shin(o) });
  }
  return cache.get(k)!;
}
