"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { skyAt } from "../ambient";
import { useZone } from "../store";

/** Street level. The studio is the top floor of a five storey walk-up. */
export const STREET = -16;

const HW = 5.65; // half the building's footprint
const HD = 5.15;

/* ------------------------------------------------------------------ */
/* helpers: everything outside is a handful of merged, unlit meshes    */
/* ------------------------------------------------------------------ */

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

function paint(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
}

/** Collects painted shapes and merges them into one geometry. */
class Bag {
  parts: THREE.BufferGeometry[] = [];
  constructor(private tone: (hex: string) => THREE.Color) {}
  put(g: THREE.BufferGeometry, hex: string, x: number, y: number, z: number, ry = 0) {
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    // merging needs every part in the same form
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    this.parts.push(paint(flat, this.tone(hex)));
  }
  /** A box given by its centre on the ground plane and its bottom and top. */
  box(x: number, z: number, w: number, d: number, y0: number, y1: number, hex: string, ry = 0) {
    this.put(new THREE.BoxGeometry(w, y1 - y0, d), hex, x, (y0 + y1) / 2, z, ry);
  }
  cyl(x: number, z: number, r0: number, r1: number, y0: number, y1: number, hex: string, seg = 12) {
    this.put(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), hex, x, (y0 + y1) / 2, z);
  }
  build() {
    const g = mergeGeometries(this.parts, false)!;
    this.parts.forEach((p) => p.dispose());
    return g;
  }
}

/** Four window walls for a block; UVs count windows so one facade texture fits every building. */
function walls(bag: Bag, x: number, z: number, w: number, d: number, y0: number, y1: number, tint: string) {
  const h = y1 - y0;
  const faces: [number, number, number, number][] = [
    [x, z + d / 2, w, 0],
    [x, z - d / 2, w, Math.PI],
    [x + w / 2, z, d, Math.PI / 2],
    [x - w / 2, z, d, -Math.PI / 2],
  ];
  for (const [fx, fz, fw, ry] of faces) {
    const g = new THREE.PlaneGeometry(fw, h);
    const uv = g.attributes.uv;
    const cols = Math.max(1, Math.round(fw / 2.1));
    const rows = Math.max(1, Math.round(h / 3));
    const ou = Math.floor(rnd() * 8);
    const ov = Math.floor(rnd() * 8);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * cols + ou) / 8, (uv.getY(i) * rows + ov) / 8);
    bag.put(g, tint, fx, y0 + h / 2, fz, ry);
  }
}

/** Brick and windows, painted flat. Lit panes at night, sky-coloured glass by day. */
function facadeTexture(day: number): THREE.CanvasTexture {
  const CW = 64;
  const CH = 96;
  const cv = document.createElement("canvas");
  cv.width = CW * 8;
  cv.height = CH * 8;
  const c = cv.getContext("2d")!;
  let s = 5;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const lerp = (a: string, b: string) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), day).getHexString();

  c.fillStyle = lerp("#35264f", "#b48a76");
  c.fillRect(0, 0, cv.width, cv.height);
  // brick courses and a few loose brush marks
  c.strokeStyle = lerp("#2a1d42", "#9c7462");
  c.lineWidth = 1;
  for (let y = 4; y < cv.height; y += 8) {
    c.globalAlpha = 0.5;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(cv.width, y);
    c.stroke();
  }
  for (let i = 0; i < 260; i++) {
    c.globalAlpha = 0.05 + r() * 0.08;
    c.fillStyle = r() > 0.5 ? lerp("#6a4a8a", "#e0b8a0") : lerp("#1c1232", "#7a5646");
    c.fillRect(r() * cv.width, r() * cv.height, 10 + r() * 50, 3 + r() * 6);
  }
  c.globalAlpha = 1;

  const LIT = ["#ffd58a", "#ffc46b", "#ffe2a8", "#ff9fba", "#ffb07a", "#a8e0ff"];
  const pLit = 0.5 - 0.44 * day;
  for (let cy = 0; cy < 8; cy++) {
    for (let cx = 0; cx < 8; cx++) {
      const x = cx * CW + 15;
      const y = cy * CH + 22;
      const w = 34;
      const h = 54;
      // stone lintel and sill
      c.fillStyle = lerp("#4c3a6c", "#d6bfae");
      c.fillRect(x - 4, y - 7, w + 8, 6);
      c.fillRect(x - 5, y + h, w + 10, 5);
      const lit = r() < pLit;
      if (lit) {
        const col = LIT[Math.floor(r() * LIT.length)];
        const g = c.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, col);
        g.addColorStop(1, day > 0.5 ? "#e8b890" : "#ff8f5a");
        c.fillStyle = g;
      } else {
        const g = c.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, lerp("#141230", "#8fb0cf"));
        g.addColorStop(1, lerp("#221a44", "#5f7f9f"));
        c.fillStyle = g;
      }
      c.fillRect(x, y, w, h);
      // a blind pulled part of the way down, or a curtain
      if (r() > 0.55) {
        c.fillStyle = lit ? "rgba(255,240,215,0.55)" : lerp("#2c2450", "#cfd8e0");
        c.fillRect(x, y, w, 8 + r() * 26);
      } else if (lit && r() > 0.5) {
        c.fillStyle = "rgba(120,40,70,0.45)";
        c.fillRect(x, y, 9, h);
      }
      // sash bars
      c.fillStyle = lerp("#120c22", "#3c2c2a");
      c.fillRect(x + w / 2 - 1.5, y, 3, h);
      c.fillRect(x, y + h / 2 - 1.5, w, 3);
      c.lineWidth = 3;
      c.strokeStyle = lerp("#120c22", "#3c2c2a");
      c.strokeRect(x, y, w, h);
    }
    // a line of trim between floors
    c.fillStyle = lerp("#241a3c", "#8f6a5a");
    c.fillRect(0, cy * CH + CH - 4, cv.width, 3);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** A sign painted to a canvas: neon letters with a glow, on a dark board. */
function signTexture(text: string, color: string, vertical = false): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  const n = text.length;
  cv.width = vertical ? 128 : 96 * n + 64;
  cv.height = vertical ? 112 * n + 48 : 160;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#150f24";
  c.fillRect(0, 0, cv.width, cv.height);
  c.strokeStyle = color;
  c.globalAlpha = 0.5;
  c.lineWidth = 4;
  c.strokeRect(8, 8, cv.width - 16, cv.height - 16);
  c.globalAlpha = 1;
  c.font = "700 96px 'Arial Narrow', Arial, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const pass of [0, 1]) {
    c.shadowColor = color;
    c.shadowBlur = pass ? 6 : 34;
    c.fillStyle = pass ? "#ffffff" : color;
    [...text].forEach((ch, i) => {
      if (vertical) c.fillText(ch, cv.width / 2, 80 + i * 112);
      else c.fillText(ch, 80 + i * 96, cv.height / 2 + 6);
    });
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/* the layout                                                          */
/* ------------------------------------------------------------------ */

type Block = { x: number; z: number; w: number; d: number; top: number; tint: string; tank?: boolean };

const TINTS = ["#ffffff", "#f6cdb8", "#e9b3a2", "#dccdf0", "#f6dfc2", "#c9d3ee", "#eec0c8"];

/** Neighbours: the block behind (low, so the skyline shows over it), the avenue's far side, and two taller ones on the left. */
function blocks(): Block[] {
  const out: Block[] = [];
  // behind the back street
  for (let x = -34; x < 5; ) {
    const w = 6 + rnd() * 5;
    const front = -5.5 + rnd() * 3.2;
    out.push({ x: x + w / 2, z: -15.5, w, d: 7, top: front, tint: pick(TINTS), tank: rnd() > 0.45 });
    if (rnd() > 0.3) out.push({ x: x + w / 2, z: -22.5, w, d: 6.6, top: -7 + rnd() * 4.5, tint: pick(TINTS), tank: rnd() > 0.6 });
    x += w + 0.25;
  }
  // across the avenue
  for (let z = 18; z > -26; ) {
    const d = 6 + rnd() * 5;
    if (!(z - d < -5.4 && z > -12)) out.push({ x: 19.5, z: z - d / 2, w: 10, d, top: -9 + rnd() * 6.5, tint: pick(TINTS), tank: rnd() > 0.5 });
    z -= d + 0.25;
  }
  // our own side of the avenue, north of the back street
  out.push({ x: 2.2, z: -15.5, w: 6.6, d: 7, top: -4.2, tint: "#f6cdb8", tank: true });
  // the left: an old hotel that stands taller than the studio, and its neighbours
  out.push({ x: -12.4, z: 0.2, w: 13.3, d: 10, top: 6.4, tint: "#d9b0b4", tank: true });
  out.push({ x: -25, z: -1, w: 11, d: 12, top: 2.5, tint: "#dccdf0", tank: true });
  out.push({ x: -14, z: 12, w: 14, d: 12, top: -2, tint: "#f6dfc2" });
  return out;
}

function buildWorld(day: number) {
  seed = 11;
  // unlit paint: full colour by day, pulled toward deep violet at night
  const night = new THREE.Color(0.4, 0.33, 0.6);
  const white = new THREE.Color(1, 1, 1);
  const tone = (hex: string) => new THREE.Color(hex).multiply(night.clone().lerp(white, day));
  const glowK = 1 - 0.75 * day;
  const lightTone = (hex: string) => new THREE.Color(hex).multiplyScalar(0.25 + glowK);
  const plain = (hex: string) => new THREE.Color(hex);

  // walls a little under full strength at night, so lit windows close to the camera do not flood the lens
  const wall = new Bag((hex) => plain(hex).multiplyScalar(0.7 + 0.3 * day));
  const flat = new Bag(tone);
  const glow = new Bag(lightTone);

  /* ---- our building: brick below the studio, a cornice, a stoop ---- */
  walls(wall, 0, 0, HW * 2, HD * 2, STREET, -0.31, "#f0b6a0");
  flat.box(0, 0, HW * 2 + 0.5, HD * 2 + 0.5, -0.62, -0.31, "#5a4038");
  flat.box(0, 0, HW * 2 + 0.24, HD * 2 + 0.24, -0.9, -0.62, "#7a5648");
  flat.box(0, 0, HW * 2 + 0.2, HD * 2 + 0.2, STREET, STREET + 3.4, "#3a2c34"); // shop floor
  // shop windows and an awning on the avenue side
  for (const z of [-2.9, 0.6, 3.4]) {
    glow.box(HW + 0.12, z, 0.06, 2.4, STREET + 0.5, STREET + 2.6, "#ffcf8a");
    flat.box(HW + 0.75, z, 1.3, 2.7, STREET + 2.75, STREET + 2.95, z === 0.6 ? "#c9443e" : "#2f6f6a");
  }
  // fire escape down the avenue side: landings, rails and ladders
  for (let i = 0; i < 4; i++) {
    const y = -3.3 - i * 3;
    flat.box(HW + 0.55, -1.2, 1.0, 4.2, y, y + 0.07, "#2a242c");
    flat.box(HW + 1.03, -1.2, 0.05, 4.2, y + 0.9, y + 0.95, "#2a242c");
    for (let k = 0; k < 8; k++) flat.box(HW + 1.03, -3.2 + k * 0.57, 0.04, 0.04, y, y + 0.9, "#2a242c");
    const g = new THREE.BoxGeometry(0.5, 3.5, 0.06);
    g.rotateX(i % 2 ? 0.62 : -0.62);
    flat.put(g, "#2a242c", HW + 0.5, y + 1.5, -1.2);
  }

  /* ---- neighbours ---- */
  for (const b of blocks()) {
    walls(wall, b.x, b.z, b.w, b.d, STREET, b.top, b.tint);
    // tar roof inside a parapet
    flat.box(b.x, b.z, b.w, b.d, b.top - 0.05, b.top, pick(["#6d6672", "#5d5a68", "#7a6c6a"]));
    const pc = "#8a6a5c";
    flat.box(b.x, b.z + b.d / 2 - 0.11, b.w, 0.22, b.top, b.top + 0.5, pc);
    flat.box(b.x, b.z - b.d / 2 + 0.11, b.w, 0.22, b.top, b.top + 0.5, pc);
    flat.box(b.x + b.w / 2 - 0.11, b.z, 0.22, b.d, b.top, b.top + 0.5, pc);
    flat.box(b.x - b.w / 2 + 0.11, b.z, 0.22, b.d, b.top, b.top + 0.5, pc);
    // stair bulkhead with a lit door
    const bx = b.x + (rnd() - 0.5) * (b.w - 4);
    const bz = b.z - b.d / 4;
    flat.box(bx, bz, 2.1, 2.4, b.top, b.top + 2.3, "#7d5a50");
    flat.box(bx, bz, 2.3, 2.6, b.top + 2.3, b.top + 2.42, "#4a3a40");
    glow.box(bx, bz + 1.22, 0.7, 0.04, b.top + 0.1, b.top + 1.6, "#ffb86a");
    // air units, a vent pipe, a skylight
    for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) {
      const ax = b.x + (rnd() - 0.5) * (b.w - 2.4);
      const az = b.z + (rnd() - 0.2) * (b.d / 2 - 1);
      flat.box(ax, az, 1.1, 0.8, b.top, b.top + 0.7, "#9a98a4");
      flat.cyl(ax, az, 0.3, 0.3, b.top + 0.7, b.top + 0.76, "#3c3a44", 10);
    }
    flat.cyl(b.x + b.w / 2 - 1, b.z + b.d / 2 - 1, 0.13, 0.13, b.top, b.top + 1.5, "#55505c", 8);
    if (rnd() > 0.5) glow.box(b.x - b.w / 4, b.z + b.d / 4, 1.6, 1.0, b.top + 0.12, b.top + 0.2, "#8fd0ff");
    // the wooden water tower
    if (b.tank) {
      const tx = b.x + (rnd() - 0.5) * (b.w - 3.6);
      const tz = b.z + b.d / 2 - 1.9;
      const ty = b.top + 2.2;
      for (const [lx, lz] of [
        [-0.75, -0.75],
        [0.75, -0.75],
        [-0.75, 0.75],
        [0.75, 0.75],
      ]) {
        flat.box(tx + lx, tz + lz, 0.12, 0.12, b.top, ty, "#2c2630");
      }
      flat.box(tx, tz, 1.9, 0.08, b.top + 1.0, b.top + 1.1, "#2c2630");
      flat.box(tx, tz, 0.08, 1.9, b.top + 1.0, b.top + 1.1, "#2c2630");
      flat.box(tx, tz, 2.3, 2.3, ty, ty + 0.12, "#3a3038");
      flat.cyl(tx, tz, 1.05, 1.12, ty + 0.12, ty + 2.5, "#a8683e", 14);
      for (const hy of [0.5, 1.3, 2.1]) flat.cyl(tx, tz, 1.12, 1.13, ty + hy, ty + hy + 0.07, "#4a2c1c", 14);
      flat.cyl(tx, tz, 1.25, 0.05, ty + 2.5, ty + 3.5, "#6a4028", 14);
    }
  }

  /* ---- streets: the avenue on the right, the cross street behind ---- */
  const road = "#3a3644";
  const walk = "#8d8794";
  flat.box(10, -4, 6.4, 70, STREET - 0.2, STREET + 0.02, road);
  flat.box(-14, -8.75, 44, 4.6, STREET - 0.2, STREET + 0.02, road);
  flat.box(6.25, 0, 1.1, 10.6, STREET - 0.2, STREET + 0.16, walk);
  flat.box(13.75, -4, 1.1, 70, STREET - 0.2, STREET + 0.16, walk);
  flat.box(-14, -5.8, 43, 1.3, STREET - 0.2, STREET + 0.16, walk);
  flat.box(-14, -11.6, 43, 1.1, STREET - 0.2, STREET + 0.16, walk);
  flat.box(6.25, -25, 1.1, 27, STREET - 0.2, STREET + 0.16, walk);
  for (let z = -38; z < 30; z += 2.6) flat.box(10, z, 0.14, 1.2, STREET + 0.02, STREET + 0.04, "#e8d9a0");
  for (let x = -35; x < 6; x += 2.6) flat.box(x, -8.75, 1.2, 0.14, STREET + 0.02, STREET + 0.04, "#e8d9a0");
  // zebra crossings where they meet
  for (let k = 0; k < 7; k++) {
    flat.box(7.4 + k * 0.86, -5.9, 0.5, 1.5, STREET + 0.02, STREET + 0.04, "#d9d4e0");
    flat.box(7.4 + k * 0.86, -11.7, 0.5, 1.5, STREET + 0.02, STREET + 0.04, "#d9d4e0");
  }
  // street lamps and their pools of light
  const lamp = (x: number, z: number, dx: number) => {
    flat.cyl(x, z, 0.08, 0.06, STREET, STREET + 4.4, "#2a2630", 8);
    flat.box(x + dx * 0.5, z, 1.0, 0.08, STREET + 4.36, STREET + 4.44, "#2a2630");
    glow.box(x + dx * 0.95, z, 0.5, 0.26, STREET + 4.22, STREET + 4.36, "#ffd9a0");
    const g = new THREE.CircleGeometry(2.3, 20);
    g.rotateX(-Math.PI / 2);
    glow.put(g, "#6a4a2c", x + dx * 1.4, STREET + 0.05, z);
  };
  for (let z = -34; z < 26; z += 9) {
    lamp(6.5, z, 1);
    lamp(13.5, z + 4.5, -1);
  }
  for (let x = -32; x < 4; x += 9) lamp(x, -6.2, 0);
  // trees along the avenue
  for (let z = -30; z < 24; z += 6.5) {
    for (const x of [6.3, 13.7]) {
      if (Math.abs(z + 8.75) < 4) continue;
      flat.cyl(x, z + 2, 0.12, 0.09, STREET, STREET + 1.8, "#4a3428", 6);
      const g = new THREE.IcosahedronGeometry(1.0 + rnd() * 0.35, 1);
      g.scale(1, 0.85, 1);
      flat.put(g, pick(["#4f8f5a", "#3f7a58", "#6aa05c", "#c9773a"]), x, STREET + 2.6, z + 2);
    }
  }
  // parked cars
  for (let z = -32; z < 24; z += 5.2) {
    if (Math.abs(z + 8.75) < 4.5 || rnd() > 0.7) continue;
    const col = pick(["#b9423c", "#3c5f9a", "#d8d2c8", "#2c2a34", "#3f8a7a"]);
    flat.box(7.35, z, 1.5, 3.4, STREET + 0.25, STREET + 0.85, col);
    flat.box(7.35, z - 0.1, 1.36, 1.9, STREET + 0.85, STREET + 1.3, "#1c1a26");
  }

  /* ---- the elevated line over the cross street ---- */
  const TY = -9.4;
  flat.box(-12, -8.75, 62, 2.6, TY - 0.5, TY, "#3a4a44");
  flat.box(-12, -7.5, 62, 0.12, TY, TY + 0.55, "#2c3834");
  flat.box(-12, -10.0, 62, 0.12, TY, TY + 0.55, "#2c3834");
  for (let x = -40; x <= 18; x += 6.5) {
    if (Math.abs(x - 10) < 3.4) continue;
    for (const z of [-7.6, -9.9]) flat.box(x, z, 0.3, 0.3, STREET, TY - 0.5, "#2c3834");
    flat.box(x, -8.75, 0.34, 2.6, TY - 1.0, TY - 0.5, "#2c3834");
  }
  for (const x of [6.7, 13.3]) for (const z of [-7.6, -9.9]) flat.box(x, z, 0.34, 0.34, STREET, TY - 0.5, "#2c3834");

  /* ---- rooftop life: string lights and beacons ---- */
  for (let k = 0; k < 13; k++) {
    const u = k / 12;
    glow.box(-4.2 + u * 6, -13.2, 0.12, 0.12, -1.9 - Math.sin(u * Math.PI) * 0.45, -1.78 - Math.sin(u * Math.PI) * 0.45, pick(["#ffd98a", "#ff9fba", "#9fe0ff"]));
  }
  glow.box(-12.4, 0.2, 0.2, 0.2, 12.2, 12.4, "#ff4a5e");

  /* ---- far silhouettes on the left and right, so no edge of the view is empty ---- */
  for (let i = 0; i < 16; i++) {
    const left = i < 10;
    const x = left ? -40 - rnd() * 22 : 30 + rnd() * 18;
    const z = left ? 16 - i * 4.4 : 10 - (i - 10) * 7;
    const w = 6 + rnd() * 7;
    walls(wall, x, z, w, w, STREET, -6 + rnd() * 17, pick(["#b9a6d8", "#a898c8", "#c8b0d0"]));
  }

  return { wall: wall.build(), flat: flat.build(), glow: glow.build() };
}

/** Cars share two painted bodies; the train is one long mesh. */
function carGeo(body: string, top: string) {
  const b = new Bag((h) => new THREE.Color(h));
  b.box(0, 0, 1.5, 3.5, 0.25, 0.85, body);
  b.box(0, -0.15, 1.36, 1.9, 0.85, 1.3, top);
  b.box(-0.5, 1.76, 0.3, 0.04, 0.5, 0.68, "#fff6d0");
  b.box(0.5, 1.76, 0.3, 0.04, 0.5, 0.68, "#fff6d0");
  b.box(-0.5, -1.76, 0.3, 0.04, 0.52, 0.66, "#ff3b4a");
  b.box(0.5, -1.76, 0.3, 0.04, 0.52, 0.66, "#ff3b4a");
  return b.build();
}

function trainGeo(lit: number) {
  const b = new Bag((h) => new THREE.Color(h));
  for (let c = 0; c < 4; c++) {
    const x = c * 6.1;
    b.box(x, 0, 5.8, 1.7, 0.2, 2.1, "#9aa3b0");
    b.box(x, 0, 5.8, 1.74, 0.75, 0.95, "#c9443e");
    b.box(x, 0, 5.6, 1.5, 2.1, 2.25, "#6d7480");
    for (let k = 0; k < 6; k++) {
      const col = new THREE.Color("#ffe6a8").multiplyScalar(0.35 + lit).getStyle();
      b.box(x - 2.2 + k * 0.88, 0, 0.6, 1.78, 1.15, 1.75, col);
    }
  }
  b.box(-3.0, 0, 0.1, 1.2, 0.5, 0.9, "#fff6d0");
  return b.build();
}

const CARS: { lane: number; dir: 1 | -1; speed: number; start: number; cab: boolean }[] = [
  { lane: 9.2, dir: -1, speed: 3.4, start: 0, cab: true },
  { lane: 9.2, dir: -1, speed: 3.0, start: 31, cab: false },
  { lane: 11.3, dir: 1, speed: 3.2, start: 12, cab: false },
  { lane: 11.3, dir: 1, speed: 2.8, start: 44, cab: true },
];

/**
 * The world around the studio: the walk-up it sits on, the avenue and the cross street with its
 * elevated line, the rooftops of the block behind, and two neon signs. Unlit, flat paint in a few
 * merged meshes, so it costs little. Colours follow the hour in New York (the store's quarter-hour clock).
 */
export function Neighbourhood() {
  const hour = useZone((s) => s.hour);
  const sky = useMemo(() => skyAt(hour), [hour]);
  const world = useMemo(() => buildWorld(sky.day), [sky.day]);
  const facade = useMemo(() => facadeTexture(sky.day), [sky.day]);
  const hotel = useMemo(() => signTexture("HOTEL", "#ff4f9a", true), []);
  const records = useMemo(() => signTexture("RECORDS", "#3fe0ff"), []);
  const deli = useMemo(() => signTexture("DELI", "#ffb84a"), []);
  const cab = useMemo(() => carGeo("#f2b631", "#2a2420"), []);
  const car = useMemo(() => carGeo("#3c4f8a", "#1c1a26"), []);
  const train = useMemo(() => trainGeo(1 - 0.75 * sky.day), [sky.day]);
  const cars = useRef<(THREE.Mesh | null)[]>([]);
  const trainRef = useRef<THREE.Mesh>(null);
  const signK = 0.72 - 0.35 * sky.day;
  const signColor = useMemo(() => new THREE.Color(signK, signK, signK), [signK]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    CARS.forEach((c, i) => {
      const m = cars.current[i];
      if (!m) return;
      const span = 70;
      const u = (((t * c.speed + c.start) % span) + span) % span;
      m.position.z = c.dir > 0 ? -40 + u : 30 - u;
    });
    // a train crosses now and then
    if (trainRef.current) {
      const u = (t + 20) % 48;
      trainRef.current.visible = u < 16;
      trainRef.current.position.x = 34 - u * 5.4;
    }
  });

  return (
    <group>
      <mesh geometry={world.wall}>
        <meshBasicMaterial map={facade} vertexColors toneMapped={false} />
      </mesh>
      <mesh geometry={world.flat}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      <mesh geometry={world.glow}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>

      {/* neon: the hotel's blade sign, a record shop on a roof behind, the deli downstairs */}
      <mesh position={[-5.1, 6.1, -1.5]}>
        <planeGeometry args={[1.0, 4.5]} />
        <meshBasicMaterial map={hotel} color={signColor} toneMapped={false} />
      </mesh>
      <mesh position={[-5.1, 6.1, -1.54]} rotation-y={Math.PI}>
        <planeGeometry args={[1.0, 4.5]} />
        <meshBasicMaterial color="#150f24" />
      </mesh>
      <group position={[-2.5, -1.9, -12.2]} scale={0.6}>
        <mesh>
          <planeGeometry args={[7.2, 1.6]} />
          <meshBasicMaterial map={records} color={signColor} toneMapped={false} />
        </mesh>
        {[-3, 0, 3].map((x) => (
          <mesh key={x} position={[x, -1.3, -0.1]}>
            <boxGeometry args={[0.1, 1.2, 0.1]} />
            <meshBasicMaterial color="#1c1622" />
          </mesh>
        ))}
      </group>
      <mesh position={[HW + 0.16, STREET + 3.5, 0.6]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[3.2, 1.0]} />
        <meshBasicMaterial map={deli} color={signColor} toneMapped={false} />
      </mesh>

      {CARS.map((c, i) => (
        <mesh
          key={i}
          ref={(m) => {
            cars.current[i] = m;
          }}
          geometry={c.cab ? cab : car}
          position={[c.lane, STREET, 0]}
          rotation-y={c.dir > 0 ? 0 : Math.PI}
        >
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>
      ))}
      <mesh ref={trainRef} geometry={train} position={[0, -9.4, -8.75]}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
    </group>
  );
}
