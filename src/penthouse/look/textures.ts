import * as THREE from "three";

/** Painted-once canvas textures for the cosy apartment: wood, plaster, fabric, marble, rugs, prints, screens. */

const cache = new Map<string, THREE.Texture>();
function once(key: string, make: () => THREE.Texture) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
}

function canvas(w: number, h = w) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return { cv, ctx: cv.getContext("2d")! };
}

function tex(cv: HTMLCanvasElement, repeat: [number, number] = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const reseed = (s: number) => (seed = s);

/** Warm oak planks, long boards with soft grain. */
export const woodFloor = (repeat: [number, number]) =>
  once(`floor${repeat}`, () => {
    reseed(11);
    const N = 1024;
    const { cv, ctx } = canvas(N);
    const rows = 8;
    const rh = N / rows;
    for (let r = 0; r < rows; r++) {
      let x = -((r * 397) % 600);
      while (x < N) {
        const len = 380 + rnd() * 420;
        const tone = 0.82 + rnd() * 0.3;
        const base = [150 * tone, 104 * tone, 68 * tone];
        ctx.fillStyle = `rgb(${base.join(",")})`;
        ctx.fillRect(x, r * rh, len, rh);
        // grain
        for (let g = 0; g < 26; g++) {
          const gy = r * rh + rnd() * rh;
          const a = 0.04 + rnd() * 0.07;
          ctx.strokeStyle = rnd() > 0.5 ? `rgba(70,40,20,${a})` : `rgba(255,220,180,${a * 0.7})`;
          ctx.lineWidth = 1 + rnd() * 2;
          ctx.beginPath();
          ctx.moveTo(x, gy);
          for (let k = 0; k <= len; k += 40) ctx.lineTo(x + k, gy + Math.sin(k * 0.01 + g) * 3);
          ctx.stroke();
        }
        // a knot now and then
        if (rnd() < 0.25) {
          const kx = x + rnd() * len;
          const ky = r * rh + rh * (0.3 + rnd() * 0.4);
          const grd = ctx.createRadialGradient(kx, ky, 0, kx, ky, 10);
          grd.addColorStop(0, "rgba(60,32,16,0.5)");
          grd.addColorStop(1, "rgba(60,32,16,0)");
          ctx.fillStyle = grd;
          ctx.fillRect(kx - 12, ky - 8, 24, 16);
        }
        ctx.fillStyle = "rgba(30,18,10,0.55)";
        ctx.fillRect(x, r * rh, 2, rh); // end joint
        x += len;
      }
      ctx.fillStyle = "rgba(30,18,10,0.6)";
      ctx.fillRect(0, r * rh, N, 2); // seam
    }
    return tex(cv, repeat);
  });

/** Lime-wash plaster. */
export const plaster = (hex = "#5a4a40", repeat: [number, number] = [3, 1]) =>
  once(`plaster${hex}${repeat}`, () => {
    reseed(5);
    const N = 512;
    const { cv, ctx } = canvas(N);
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 900; i++) {
      const x = rnd() * N;
      const y = rnd() * N;
      const r = 8 + rnd() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const light = rnd() > 0.5;
      g.addColorStop(0, light ? "rgba(255,240,220,0.035)" : "rgba(0,0,0,0.04)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return tex(cv, repeat);
  });

/** Fine woven fabric / bouclé noise, used as a bump-like colour variation. */
export const fabric = () =>
  once("fabric", () => {
    reseed(3);
    const N = 256;
    const { cv, ctx } = canvas(N);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 9000; i++) {
      const v = 200 + rnd() * 55;
      ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
      const s = 1 + rnd() * 2.5;
      ctx.beginPath();
      ctx.arc(rnd() * N, rnd() * N, s, 0, Math.PI * 2);
      ctx.fill();
    }
    return tex(cv, [3, 3]);
  });

/** Calacatta-style marble. */
export const marble = () =>
  once("marble", () => {
    reseed(9);
    const W = 1024;
    const H = 512;
    const { cv, ctx } = canvas(W, H);
    ctx.fillStyle = "#efebe5";
    ctx.fillRect(0, 0, W, H);
    for (let v = 0; v < 9; v++) {
      let x = rnd() * W;
      let y = 0;
      ctx.strokeStyle = `rgba(${120 + rnd() * 40},${110 + rnd() * 30},${100 + rnd() * 30},${0.25 + rnd() * 0.35})`;
      ctx.lineWidth = 0.8 + rnd() * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (y < H) {
        x += (rnd() - 0.45) * 40;
        y += 10 + rnd() * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return tex(cv, [1, 1]);
  });

/** Round rug with soft concentric bands. */
export const roundRug = (a: string, b: string, c: string) =>
  once(`rr${a}${b}${c}`, () => {
    const N = 512;
    const { cv, ctx } = canvas(N);
    const bands = [a, b, a, c, a];
    bands.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(N / 2, N / 2, (N / 2) * (1 - i * 0.17), 0, Math.PI * 2);
      ctx.fill();
    });
    reseed(4);
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`;
      ctx.fillRect(rnd() * N, rnd() * N, 2, 2);
    }
    const t = tex(cv);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

/** Berber-style rectangular rug with diamond lines. */
export const berberRug = (bg: string, line: string) =>
  once(`br${bg}${line}`, () => {
    const W = 512;
    const H = 768;
    const { cv, ctx } = canvas(W, H);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = line;
    ctx.lineWidth = 5;
    const s = 96;
    for (let y = -s; y < H + s; y += s)
      for (let x = 0; x < W + s; x += s) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + s / 2, y + s / 2);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s / 2, y + s / 2);
        ctx.closePath();
        ctx.stroke();
      }
    reseed(8);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.05})`;
      ctx.fillRect(rnd() * W, rnd() * H, 2, 2);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, W, H);
    return tex(cv);
  });

/** Mid-century print: sun over arches. */
export const artPrint = (variant: 0 | 1 | 2) =>
  once(`art${variant}`, () => {
    const W = 400;
    const H = 520;
    const { cv, ctx } = canvas(W, H);
    const pal = [
      ["#efe4d2", "#c4673e", "#2f4a3a", "#d9a441"],
      ["#e9e1d3", "#8a9f7f", "#b8643f", "#3b3530"],
      ["#1f2430", "#d9a441", "#b8643f", "#e9e1d3"],
    ][variant];
    ctx.fillStyle = pal[0];
    ctx.fillRect(0, 0, W, H);
    if (variant === 0) {
      ctx.fillStyle = pal[1];
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.42, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal[2];
      ctx.fillRect(0, H * 0.62, W, H);
      ctx.fillStyle = pal[3];
      ctx.beginPath();
      ctx.arc(W * 0.3, H * 0.62, 70, Math.PI, 0);
      ctx.fill();
    } else if (variant === 1) {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = pal[1 + (i % 3)];
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.85, 170 - i * 40, Math.PI, 0);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = pal[1];
      ctx.beginPath();
      ctx.arc(W * 0.65, H * 0.3, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal[3];
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(30, H * 0.55 + i * 28);
        ctx.bezierCurveTo(W * 0.35, H * 0.45 + i * 28, W * 0.65, H * 0.65 + i * 28, W - 30, H * 0.55 + i * 28);
        ctx.stroke();
      }
    }
    return tex(cv);
  });

/** Monitor UI: dark dashboard with charts. */
export const monitorScreen = () =>
  once("monitor", () => {
    const W = 1024;
    const H = 420;
    const { cv, ctx } = canvas(W, H);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0d1626");
    g.addColorStop(1, "#141a2e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, 0, 70, H);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i === 1 ? "#5aa8ff" : "rgba(255,255,255,0.25)";
      ctx.fillRect(22, 40 + i * 50, 26, 26);
    }
    const card = (x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 14);
      ctx.fill();
    };
    card(100, 30, 560, 220);
    reseed(2);
    for (let i = 0; i < 14; i++) {
      const h = 40 + rnd() * 130;
      ctx.fillStyle = i === 13 ? "#ffb35c" : "#5aa8ff";
      ctx.fillRect(130 + i * 36, 230 - h, 22, h);
    }
    card(690, 30, 300, 220);
    ctx.strokeStyle = "#7ee0c3";
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) ctx.lineTo(710 + i * 26, 200 - Math.sin(i * 0.7) * 50 - i * 6);
    ctx.stroke();
    card(100, 275, 890, 120);
    for (let r = 0; r < 4; r++) {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(125, 297 + r * 24, 220, 9);
      ctx.fillStyle = r === 0 ? "#7ee0c3" : r === 2 ? "#ffb35c" : "rgba(90,168,255,0.7)";
      ctx.fillRect(800, 297 + r * 24, 90, 9);
    }
    const t = tex(cv);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

/** Laptop: a spreadsheet of applications. */
export const laptopScreen = () =>
  once("laptop", () => {
    const W = 640;
    const H = 400;
    const { cv, ctx } = canvas(W, H);
    ctx.fillStyle = "#f6f4ef";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1f6f4a";
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = "#e6e3dc";
    ctx.fillRect(0, 34, W, 22);
    reseed(6);
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 5; c++) {
        const x = 10 + c * 126;
        const y = 66 + r * 25;
        ctx.strokeStyle = "rgba(0,0,0,0.08)";
        ctx.strokeRect(x - 6, y - 6, 126, 25);
        ctx.fillStyle = c === 3 ? (r % 4 === 0 ? "#2f8f5b" : r % 3 === 0 ? "#c2683f" : "#3f6fb6") : "rgba(30,30,30,0.55)";
        ctx.fillRect(x, y + 2, 40 + rnd() * 60, 7);
      }
    }
    const t = tex(cv);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

/** Vinyl / book spines strip. */
export const spines = () =>
  once("spines", () => {
    const W = 512;
    const H = 128;
    const { cv, ctx } = canvas(W, H);
    reseed(12);
    const cols = ["#b8643f", "#2f4a3a", "#d9a441", "#e9e1d3", "#3b3530", "#8a9f7f", "#6d3f43", "#2f4f6f"];
    let x = 0;
    while (x < W) {
      const w = 10 + rnd() * 18;
      ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
      const h = H * (0.75 + rnd() * 0.25);
      ctx.fillRect(x, H - h, w - 1, h);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x + w * 0.3, H - h + 12, w * 0.4, 3);
      x += w;
    }
    const t = tex(cv);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
