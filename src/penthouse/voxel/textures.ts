import * as THREE from "three";
import { hash3 } from "./builder";

/** World size of one texture pixel. Matches the furniture voxel size so walls, floor and props share one pixel density. */
export const TEXEL = 0.06;

function canvas(w: number, h: number) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return { cv, ctx };
}

function pixelTexture(cv: HTMLCanvasElement, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  return t;
}

const hex = (r: number, g: number, b: number) => `rgb(${r | 0},${g | 0},${b | 0})`;

/** Dark walnut floorboards, 64×64 tile. */
export function floorTexture(widthM: number, depthM: number) {
  const N = 64;
  const { cv, ctx } = canvas(N, N);
  const rowH = 8;
  for (let row = 0; row < N / rowH; row++) {
    const offset = (row * 23) % 64;
    const lens = [22, 18, 24];
    let x = -offset;
    let i = 0;
    while (x < N) {
      const len = lens[(row + i) % 3];
      const tone = 0.82 + hash3(row, i, 3) * 0.3;
      for (let px = x; px < x + len; px++) {
        for (let py = row * rowH; py < row * rowH + rowH; py++) {
          const xx = ((px % N) + N) % N;
          const grain = (hash3(xx, py, 7) - 0.5) * 0.12 + (py % rowH === 3 ? -0.04 : 0);
          let k = tone + grain;
          if (py % rowH === rowH - 1) k *= 0.55; // seam
          if (px === x) k *= 0.6; // end joint
          ctx.fillStyle = hex(58 * k, 38 * k, 28 * k);
          ctx.fillRect(xx, py, 1, 1);
        }
      }
      x += len;
      i++;
    }
  }
  const tilesX = widthM / (N * TEXEL);
  const tilesY = depthM / (N * TEXEL);
  return pixelTexture(cv, tilesX, tilesY);
}

/** Matte plaster with a faint pixel grain, 32×32 tile. */
export function wallTexture(widthM: number, heightM: number, base: [number, number, number] = [26, 23, 34]) {
  const N = 32;
  const { cv, ctx } = canvas(N, N);
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const k = 0.92 + hash3(x, y, 11) * 0.16;
      ctx.fillStyle = hex(base[0] * k, base[1] * k, base[2] * k);
      ctx.fillRect(x, y, 1, 1);
    }
  return pixelTexture(cv, widthM / (N * TEXEL), heightM / (N * TEXEL));
}

/** Woven rug. */
export function rugTexture(widthM: number, depthM: number, a: [number, number, number], b: [number, number, number]) {
  const N = 16;
  const { cv, ctx } = canvas(N, N);
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const stripe = (x + y) % 8 < 4 ? a : b;
      const k = 0.9 + hash3(x, y, 5) * 0.2;
      ctx.fillStyle = hex(stripe[0] * k, stripe[1] * k, stripe[2] * k);
      ctx.fillRect(x, y, 1, 1);
    }
  return pixelTexture(cv, widthM / (N * TEXEL), depthM / (N * TEXEL));
}

/**
 * Pixel-art city at night, painted at low resolution with integer pixels and
 * dithered sky bands. Displayed with nearest filtering; the lens blur comes from
 * the depth-of-field pass so it reads as "far away, out of focus".
 */
export function pixelSkyline(seed = 3) {
  const W = 512;
  const H = 160;
  const { cv, ctx } = canvas(W, H);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);

  // dithered sky bands, deep space black → violet haze on the horizon
  const bands: [number, number, number][] = [
    [5, 5, 10],
    [9, 8, 22],
    [16, 12, 38],
    [30, 18, 58],
    [52, 26, 74],
    [86, 38, 86],
  ];
  const bandH = (H * 0.78) / bands.length;
  for (let y = 0; y < H; y++) {
    const f = Math.min(bands.length - 1, y / bandH);
    const i = Math.floor(f);
    const t = f - i;
    for (let x = 0; x < W; x++) {
      const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y % 4][x % 4] / 16;
      const c = bands[t > bayer && i + 1 < bands.length ? i + 1 : i];
      ctx.fillStyle = hex(...c);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // stars
  for (let i = 0; i < 140; i++) {
    const v = 120 + rnd() * 135;
    ctx.fillStyle = hex(v, v, v + 20);
    ctx.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H * 0.5), 1, 1);
  }
  // pixel moon with a crescent shadow
  const mx = 402;
  const my = 30;
  for (let x = -9; x <= 9; x++)
    for (let y = -9; y <= 9; y++) {
      const d = Math.hypot(x, y);
      if (d <= 8.6) {
        const lit = Math.hypot(x + 4, y - 2) > 7.5;
        ctx.fillStyle = lit ? "#fff1d6" : "#2a2440";
        if (lit && hash3(x, y, 9) > 0.85) ctx.fillStyle = "#e6d3b0";
        ctx.fillRect(mx + x, my + y, 1, 1);
      } else if (d <= 13 && hash3(x, y, 2) > 0.55) {
        ctx.fillStyle = "rgba(255,230,190,0.08)";
        ctx.fillRect(mx + x, my + y, 1, 1);
      }
    }

  const layers = [
    { base: H * 0.72, minH: 18, maxH: 48, minW: 10, maxW: 24, color: [22, 16, 40], lit: 0.12 },
    { base: H * 0.84, minH: 22, maxH: 70, minW: 12, maxW: 30, color: [14, 10, 26], lit: 0.22 },
    { base: H, minH: 28, maxH: 96, minW: 14, maxW: 38, color: [8, 7, 14], lit: 0.32 },
  ];
  const signs = ["#ff4fa3", "#3ee0ff", "#ffb347", "#9b7bff"];
  for (const L of layers) {
    let x = -4;
    while (x < W) {
      const w = Math.round(L.minW + rnd() * (L.maxW - L.minW));
      const h = Math.round(L.minH + rnd() * (L.maxH - L.minH));
      const top = Math.round(L.base - h);
      ctx.fillStyle = hex(...(L.color as [number, number, number]));
      ctx.fillRect(x, top, w, H - top);
      // stepped roof
      if (rnd() < 0.35) ctx.fillRect(x + 2, top - 3, w - 4, 3);
      if (rnd() < 0.18) {
        ctx.fillRect(x + Math.floor(w / 2), top - 9, 1, 9);
        ctx.fillStyle = "#ff3b3b";
        ctx.fillRect(x + Math.floor(w / 2), top - 10, 1, 1);
      }
      // windows on a 2px grid
      for (let wy = top + 3; wy < H - 2; wy += 3)
        for (let wx = x + 2; wx < x + w - 2; wx += 2) {
          if (rnd() > L.lit) continue;
          const warm = rnd() < 0.7;
          const a = 0.55 + rnd() * 0.45;
          ctx.fillStyle = warm ? `rgba(255,${190 + rnd() * 50},${110 + rnd() * 60},${a})` : `rgba(${130 + rnd() * 50},${200 + rnd() * 40},255,${a})`;
          ctx.fillRect(wx, wy, 1, 1);
        }
      // the odd neon sign
      if (L === layers[2] && rnd() < 0.16) {
        ctx.fillStyle = signs[Math.floor(rnd() * signs.length)];
        ctx.fillRect(x + 2, top + 6 + Math.floor(rnd() * 10), Math.max(3, w - 6), 2);
      }
      x += w + Math.floor(rnd() * 4);
    }
  }
  const t = pixelTexture(cv);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}
