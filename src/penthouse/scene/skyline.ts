import * as THREE from "three";

/**
 * Manhattan across the river, painted once to a canvas: downtown and the bridge on the left, midtown
 * on the right, the water and its reflections at the bottom. Flat painted shapes in three depths,
 * warm and pink windows, a glow behind the towers. The waterline sits at 80% of the height.
 * Swap for a photo later: new THREE.TextureLoader().load("/textures/skyline.jpg").
 */
const cache = new Map<number, THREE.CanvasTexture>();

/** The night painting; its daytime twin is on `userData.day`. Painted once per seed. */
export function makeSkylineTexture(seed = 7): THREE.CanvasTexture {
  const hit = cache.get(seed);
  if (hit) return hit;
  const tex = paintSkyline(seed);
  cache.set(seed, tex);
  return tex;
}

function paintSkyline(seed: number): THREE.CanvasTexture {
  const W = 3072;
  const H = 1024;
  const SEA = H * 0.8;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const real = cv.getContext("2d")!;
  // A second canvas takes the same shapes as flat pale silhouettes: the city by day, laid over the haze.
  const dv = document.createElement("canvas");
  dv.width = W;
  dv.height = H;
  const d = dv.getContext("2d")!;
  let rec = false;
  let base = "#a9bdd6";
  const linear = new WeakSet<object>();
  const dayShade = (style: string | CanvasGradient | CanvasPattern) => {
    let t = 0.3;
    if (typeof style === "string") {
      const n = parseInt(style.slice(1), 16);
      const luma = (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255;
      t = Math.min(0.6, Math.max(0, (luma - 0.1) * 1.2));
    }
    return "#" + new THREE.Color(base).lerp(new THREE.Color("#eef3fa"), t).getHexString();
  };
  const solid = (style: string | CanvasGradient | CanvasPattern) =>
    typeof style === "string" ? style.startsWith("#") : linear.has(style);
  const SKIP = new Set(["createLinearGradient", "createRadialGradient", "createPattern", "getImageData", "putImageData", "drawImage", "measureText"]);
  const COPY = new Set(["globalAlpha", "lineWidth", "lineCap", "lineJoin"]);
  const c = new Proxy(real, {
    get(t, prop: string) {
      const v = (t as unknown as Record<string, unknown>)[prop];
      if (typeof v !== "function") return v;
      return (...args: unknown[]) => {
        const out = (v as (...a: unknown[]) => unknown).apply(t, args);
        if (prop === "createLinearGradient") linear.add(out as object);
        if (SKIP.has(prop)) return out;
        const paints = prop === "fill" || prop === "fillRect" || prop === "stroke" || prop === "strokeRect";
        if (paints) {
          const style = prop.startsWith("fill") ? t.fillStyle : t.strokeStyle;
          if (!rec || !solid(style)) return out;
          d.fillStyle = d.strokeStyle = dayShade(style);
        }
        (d as unknown as Record<string, (...a: unknown[]) => unknown>)[prop](...args);
        return out;
      };
    },
    set(t, prop: string, value) {
      (t as unknown as Record<string, unknown>)[prop] = value;
      if (COPY.has(prop)) (d as unknown as Record<string, unknown>)[prop] = value;
      return true;
    },
  });
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

  // sky: deep indigo down to a pink and amber glow on the horizon
  const sky = c.createLinearGradient(0, 0, 0, SEA);
  sky.addColorStop(0, "#07061a");
  sky.addColorStop(0.4, "#15103a");
  sky.addColorStop(0.7, "#3a1d5c");
  sky.addColorStop(0.9, "#8a2f6e");
  sky.addColorStop(1, "#d8644f");
  c.fillStyle = sky;
  c.fillRect(0, 0, W, SEA);

  // brush strokes across the sky
  for (let i = 0; i < 140; i++) {
    const y = rnd() * SEA * 0.9;
    c.strokeStyle = `rgba(${rnd() > 0.5 ? "255,130,190" : "120,110,255"},${0.02 + rnd() * 0.04})`;
    c.lineWidth = 6 + rnd() * 26;
    c.lineCap = "round";
    const x = rnd() * W;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + 200, y - 14 + rnd() * 28, x + 320 + rnd() * 380, y - 10 + rnd() * 20);
    c.stroke();
  }
  // stars and a moon
  for (let i = 0; i < 220; i++) {
    c.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.5})`;
    c.beginPath();
    c.arc(rnd() * W, rnd() * SEA * 0.5, rnd() * 1.6, 0, Math.PI * 2);
    c.fill();
  }
  const mg = c.createRadialGradient(W * 0.3, H * 0.16, 0, W * 0.3, H * 0.16, 170);
  mg.addColorStop(0, "rgba(255,244,225,1)");
  mg.addColorStop(0.2, "rgba(255,240,220,0.95)");
  mg.addColorStop(0.24, "rgba(255,200,220,0.22)");
  mg.addColorStop(1, "rgba(255,200,220,0)");
  c.fillStyle = mg;
  c.fillRect(W * 0.3 - 180, H * 0.16 - 180, 360, 360);
  // glow behind midtown and downtown
  for (const [gx, gr, col] of [
    [0.56, 760, "255,120,170"],
    [0.27, 520, "255,150,110"],
  ] as const) {
    const g = c.createRadialGradient(W * gx, SEA, 0, W * gx, SEA, gr);
    g.addColorStop(0, `rgba(${col},0.5)`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, SEA);
  }

  const WARM = ["#ffd58a", "#ffc46b", "#ffe2a8", "#ff9fba", "#9fdcff", "#ffb07a"];
  /** Lit windows in a grid inside a rectangle. */
  const windows = (x: number, y: number, w: number, h: number, cw: number, ch: number, p: number, alpha = 1) => {
    for (let yy = y + ch; yy < y + h - ch; yy += ch * 2) {
      const row = rnd() < 0.12; // a whole floor lit now and then
      for (let xx = x + cw * 0.8; xx < x + w - cw; xx += cw * 1.8) {
        if (!row && rnd() > p) continue;
        c.globalAlpha = alpha * (0.55 + rnd() * 0.45);
        c.fillStyle = pick(WARM);
        c.fillRect(xx, yy, cw, ch);
      }
    }
    c.globalAlpha = 1;
  };
  /** A plain block with a lighter left face, so it reads as painted, not flat. */
  const block = (x: number, w: number, h: number, col: string, face: string, p = 0.3, cw = 4, ch = 5) => {
    c.fillStyle = col;
    c.fillRect(x, SEA - h, w, h);
    c.fillStyle = face;
    c.fillRect(x, SEA - h, w * 0.32, h);
    windows(x, SEA - h, w, h, cw, ch, p);
  };
  const spire = (x: number, y: number, h: number, col: string, tip?: string) => {
    c.strokeStyle = col;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x, y - h);
    c.stroke();
    if (tip) {
      c.fillStyle = tip;
      c.beginPath();
      c.arc(x, y - h, 4, 0, Math.PI * 2);
      c.fill();
    }
  };
  const glowDot = (x: number, y: number, r: number, col: string) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},0.7)`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // ---- far layer: hazy filler, lighter than what stands in front
  rec = true;
  for (let x = -20; x < W; ) {
    const w = 34 + rnd() * 70;
    const mid = Math.exp(-Math.pow((x - W * 0.57) / 620, 2)) * 150 + Math.exp(-Math.pow((x - W * 0.27) / 300, 2)) * 110;
    block(x, w, 50 + rnd() * 70 + mid * (0.5 + rnd() * 0.6), "#3b2a66", "#4a3578", 0.18, 3, 4);
    x += w + rnd() * 6;
  }

  const A = "#231a48"; // mid layer
  base = "#7f97b8";
  const AF = "#30245c";

  // ---- downtown: One World Trade and its neighbours
  {
    const x = 860;
    const h = 430;
    c.fillStyle = A;
    c.beginPath();
    c.moveTo(x - 40, SEA);
    c.lineTo(x - 26, SEA - h);
    c.lineTo(x + 26, SEA - h);
    c.lineTo(x + 40, SEA);
    c.fill();
    // the long glass facets
    c.fillStyle = "#3d3276";
    c.beginPath();
    c.moveTo(x - 40, SEA);
    c.lineTo(x, SEA - h);
    c.lineTo(x + 26, SEA - h);
    c.lineTo(x - 6, SEA);
    c.fill();
    c.fillStyle = "#5a4a9a";
    c.globalAlpha = 0.5;
    c.beginPath();
    c.moveTo(x - 40, SEA);
    c.lineTo(x - 26, SEA - h);
    c.lineTo(x, SEA - h);
    c.fill();
    c.globalAlpha = 1;
    windows(x - 24, SEA - h + 10, 48, h - 20, 3, 4, 0.22);
    c.fillStyle = A;
    c.fillRect(x - 12, SEA - h - 14, 24, 14);
    spire(x, SEA - h - 14, 96, "#cfd3ff", "#ff5a6e");
    glowDot(x, SEA - h - 110, 26, "255,90,110");
    for (const [dx, w, hh] of [
      [-150, 60, 250],
      [-84, 46, 300],
      [56, 52, 270],
      [116, 64, 220],
      [190, 50, 190],
      [-230, 70, 180],
    ]) {
      block(x + dx, w, hh, A, AF, 0.3);
    }
    // a slanted glass top, like the towers by the memorial
    c.fillStyle = AF;
    c.beginPath();
    c.moveTo(x + 56, SEA - 270);
    c.lineTo(x + 108, SEA - 300);
    c.lineTo(x + 108, SEA - 270);
    c.fill();
  }

  // ---- midtown fillers between the landmarks
  for (let x = 1240; x < 2760; ) {
    const w = 40 + rnd() * 56;
    block(x, w, 130 + rnd() * 150, A, AF, 0.32);
    x += w + 4 + rnd() * 30;
  }
  for (let x = 20; x < 620; ) {
    const w = 40 + rnd() * 60;
    block(x, w, 70 + rnd() * 90, A, AF, 0.28);
    x += w + rnd() * 20;
  }
  for (let x = 1080; x < 1240; ) {
    const w = 36 + rnd() * 40;
    block(x, w, 70 + rnd() * 60, A, AF, 0.28);
    x += w + rnd() * 14;
  }

  // ---- Hudson Yards: a tall slanted top with the pointed deck on its side
  {
    const x = 1420;
    c.fillStyle = A;
    c.beginPath();
    c.moveTo(x, SEA);
    c.lineTo(x, SEA - 310);
    c.lineTo(x + 58, SEA - 350);
    c.lineTo(x + 58, SEA);
    c.fill();
    c.fillStyle = AF;
    c.fillRect(x, SEA - 310, 18, 310);
    c.fillStyle = A;
    c.beginPath();
    c.moveTo(x, SEA - 268);
    c.lineTo(x - 30, SEA - 274);
    c.lineTo(x, SEA - 256);
    c.fill();
    windows(x, SEA - 300, 58, 300, 3, 4, 0.3);
  }

  // ---- Empire State: stepped shoulders, a lit crown and the mast
  {
    const x = 1700;
    const steps = [
      [104, 96],
      [84, 190],
      [64, 262],
      [46, 300],
      [28, 322],
    ];
    for (const [w, h] of steps) {
      c.fillStyle = A;
      c.fillRect(x - w / 2, SEA - h, w, h);
      c.fillStyle = AF;
      c.fillRect(x - w / 2, SEA - h, w * 0.3, h);
    }
    windows(x - 30, SEA - 256, 60, 250, 3, 5, 0.42);
    // crown lit in colour
    const g = c.createLinearGradient(0, SEA - 368, 0, SEA - 300);
    g.addColorStop(0, "#fff0f6");
    g.addColorStop(1, "#ff5fa8");
    c.fillStyle = g;
    c.fillRect(x - 14, SEA - 322, 28, 22);
    c.fillRect(x - 9, SEA - 344, 18, 22);
    c.fillRect(x - 5, SEA - 362, 10, 18);
    spire(x, SEA - 362, 66, "#ffd9ea", "#ffffff");
    glowDot(x, SEA - 340, 70, "255,95,168");
  }

  // ---- a slanted top with a thin spire, west of the Empire State
  {
    const x = 1830;
    c.fillStyle = A;
    c.beginPath();
    c.moveTo(x, SEA);
    c.lineTo(x, SEA - 250);
    c.lineTo(x + 44, SEA - 290);
    c.lineTo(x + 44, SEA);
    c.fill();
    c.fillStyle = AF;
    c.fillRect(x, SEA - 250, 14, 250);
    windows(x, SEA - 246, 44, 240, 3, 4, 0.34);
    spire(x + 40, SEA - 288, 70, "#cfd3ff");
  }

  // ---- a tapered glass tower by Grand Central
  {
    const x = 1960;
    c.fillStyle = A;
    c.beginPath();
    c.moveTo(x - 34, SEA);
    c.lineTo(x - 26, SEA - 250);
    c.lineTo(x - 6, SEA - 356);
    c.lineTo(x + 8, SEA - 330);
    c.lineTo(x + 26, SEA - 240);
    c.lineTo(x + 34, SEA);
    c.fill();
    c.fillStyle = AF;
    c.beginPath();
    c.moveTo(x - 34, SEA);
    c.lineTo(x - 26, SEA - 250);
    c.lineTo(x - 6, SEA - 356);
    c.lineTo(x - 8, SEA);
    c.fill();
    windows(x - 24, SEA - 240, 48, 236, 3, 4, 0.36);
    spire(x - 6, SEA - 356, 44, "#cfd3ff", "#ffffff");
  }

  // ---- Chrysler: a slim shaft, the crown of arcs, the needle
  {
    const x = 2070;
    c.fillStyle = A;
    c.fillRect(x - 24, SEA - 236, 48, 236);
    c.fillStyle = AF;
    c.fillRect(x - 24, SEA - 236, 15, 236);
    windows(x - 22, SEA - 230, 44, 226, 3, 5, 0.4);
    for (let i = 0; i < 6; i++) {
      const w = 22 - i * 3.3;
      const y = SEA - 236 - i * 15;
      c.fillStyle = i % 2 ? "#ffe9b8" : "#f5c877";
      c.beginPath();
      c.moveTo(x - w, y);
      c.quadraticCurveTo(x - w * 0.86, y - 22, x, y - 26);
      c.quadraticCurveTo(x + w * 0.86, y - 22, x + w, y);
      c.closePath();
      c.fill();
      c.fillStyle = "#231a48";
      for (const sx of [-0.5, 0.5]) {
        c.beginPath();
        c.moveTo(x + sx * w - 2.4, y - 3);
        c.lineTo(x + sx * w, y - 10);
        c.lineTo(x + sx * w + 2.4, y - 3);
        c.fill();
      }
    }
    spire(x, SEA - 336, 62, "#ffe9b8", "#ffffff");
    glowDot(x, SEA - 300, 60, "255,214,140");
  }

  // ---- the pencil towers uptown: a square grid of windows, a stepped feather, the tallest glass slab
  {
    const x = 2330;
    c.fillStyle = A;
    c.fillRect(x - 14, SEA - 404, 28, 404);
    c.fillStyle = AF;
    c.fillRect(x - 14, SEA - 404, 9, 404);
    for (let yy = SEA - 398; yy < SEA - 8; yy += 11) {
      for (let k = 0; k < 3; k++) {
        if (rnd() > 0.45) continue;
        c.globalAlpha = 0.6 + rnd() * 0.4;
        c.fillStyle = pick(WARM);
        c.fillRect(x - 11 + k * 8, yy, 5, 6);
      }
    }
    c.globalAlpha = 1;

    const x2 = 2470;
    const st = [
      [22, 300],
      [18, 350],
      [13, 390],
      [8, 420],
      [4, 440],
    ];
    for (const [w, h] of st) {
      c.fillStyle = A;
      c.fillRect(x2 - w / 2, SEA - h, w, h);
    }
    c.fillStyle = "#ffcf8a";
    c.globalAlpha = 0.5;
    c.fillRect(x2 - 1, SEA - 436, 2, 420);
    c.globalAlpha = 1;

    const x3 = 2580;
    c.fillStyle = A;
    c.fillRect(x3 - 20, SEA - 452, 40, 452);
    c.fillRect(x3 - 20, SEA - 300, 52, 300);
    c.fillStyle = AF;
    c.fillRect(x3 - 20, SEA - 452, 12, 452);
    windows(x3 - 18, SEA - 446, 36, 440, 3, 4, 0.3);
    spire(x3 + 4, SEA - 452, 26, "#cfd3ff");
  }

  // ---- red beacons on the tall roofs
  for (const [bx, by] of [
    [2330, 404],
    [2470, 440],
    [1449, 350],
    [776, 300],
  ]) {
    c.fillStyle = "#ff4a5e";
    c.beginPath();
    c.arc(bx, SEA - by - 3, 3, 0, Math.PI * 2);
    c.fill();
    glowDot(bx, SEA - by - 3, 16, "255,74,94");
  }

  rec = false;
  // soften the far and mid layers a touch (blur by scaling down and up, which is fast)
  {
    const small = document.createElement("canvas");
    small.width = W / 2;
    small.height = H / 2;
    const sc = small.getContext("2d")!;
    sc.imageSmoothingQuality = "high";
    sc.drawImage(cv, 0, 0, small.width, small.height);
    c.globalAlpha = 0.55;
    c.drawImage(small, 0, 0, W, H);
    c.globalAlpha = 1;
  }

  // ---- the water: dark, with the city's light pulled down into it in strokes
  const sea = c.createLinearGradient(0, SEA, 0, H);
  sea.addColorStop(0, "#3a1c52");
  sea.addColorStop(0.25, "#1b1238");
  sea.addColorStop(1, "#0d0a22");
  c.fillStyle = sea;
  c.fillRect(0, SEA, W, H - SEA);
  for (let i = 0; i < 520; i++) {
    const x = rnd() * W;
    const near = Math.exp(-Math.pow((x - W * 0.57) / 700, 2)) + Math.exp(-Math.pow((x - W * 0.27) / 320, 2)) * 0.8;
    if (rnd() > 0.25 + near) continue;
    c.fillStyle = pick(WARM);
    c.globalAlpha = 0.1 + rnd() * 0.3;
    c.fillRect(x, SEA + 2 + rnd() * 16, 2 + rnd() * 3, 20 + rnd() * 120);
  }
  c.globalAlpha = 0.16;
  c.strokeStyle = "#ffd0e4";
  c.lineWidth = 2;
  for (let i = 0; i < 70; i++) {
    const y = SEA + 10 + rnd() * (H - SEA - 20);
    const x = rnd() * W;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 30 + rnd() * 120, y);
    c.stroke();
  }
  c.globalAlpha = 1;

  {
    const water = d.createLinearGradient(0, SEA, 0, H);
    water.addColorStop(0, "#a9bfd6");
    water.addColorStop(1, "#6f8fb3");
    d.fillStyle = water;
    d.fillRect(0, SEA, W, H - SEA);
  }
  rec = true;
  base = "#5f7696";
  // ---- the bridge: two stone towers with pointed arches, the sweep of the cables, a lit deck
  {
    const DECK = SEA - 64;
    const T1 = 250;
    const T2 = 640;
    const TOP = SEA - 190;
    const stone = "#15102e";
    c.strokeStyle = stone;
    c.lineWidth = 5;
    const cable = (x0: number, y0: number, x1: number, y1: number, sag: number) => {
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1);
      c.stroke();
    };
    cable(T1, TOP, T2, TOP, 232);
    cable(-80, DECK - 6, T1, TOP, 20);
    cable(T2, TOP, 1010, DECK + 6, 20);
    // suspenders
    c.lineWidth = 1.2;
    for (let x = T1 + 14; x < T2; x += 13) {
      const u = (x - T1) / (T2 - T1);
      const y = TOP + 4 * u * (1 - u) * 116;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, DECK);
      c.stroke();
    }
    // the diagonal stays fanning from each tower
    c.globalAlpha = 0.6;
    for (const tx of [T1, T2]) {
      for (let k = 1; k <= 7; k++) {
        for (const dir of [-1, 1]) {
          c.beginPath();
          c.moveTo(tx, TOP + 6);
          c.lineTo(tx + dir * k * 22, DECK);
          c.stroke();
        }
      }
    }
    c.globalAlpha = 1;
    // deck
    c.fillStyle = stone;
    c.fillRect(-80, DECK, 1100, 9);
    c.fillRect(1000, DECK + 4, 60, 60);
    // towers
    for (const tx of [T1, T2]) {
      c.fillStyle = stone;
      c.fillRect(tx - 28, TOP - 8, 56, SEA - TOP + 30);
      c.fillRect(tx - 33, TOP - 14, 66, 10);
      c.fillStyle = "#4a2a66";
      for (const ax of [-12, 12]) {
        c.beginPath();
        c.moveTo(tx + ax - 7, DECK - 4);
        c.lineTo(tx + ax - 7, TOP + 44);
        c.quadraticCurveTo(tx + ax, TOP + 22, tx + ax + 7, TOP + 44);
        c.lineTo(tx + ax + 7, DECK - 4);
        c.fill();
      }
      c.fillStyle = "#2a1f52";
      c.fillRect(tx - 28, TOP - 8, 12, SEA - TOP + 30);
    }
    // lights along the deck and up the main cable
    for (let x = -70; x < 1010; x += 17) {
      c.fillStyle = "#ffe2a8";
      c.globalAlpha = 0.9;
      c.fillRect(x, DECK - 3, 3, 3);
    }
    for (let x = T1; x <= T2; x += 26) {
      const u = (x - T1) / (T2 - T1);
      c.fillRect(x - 1, TOP + 4 * u * (1 - u) * 116 - 2, 3, 3);
    }
    c.globalAlpha = 1;
  }

  // ---- the near shore: low dark warehouses and piers, a few lit windows
  for (let x = -10; x < W; ) {
    const w = 60 + rnd() * 150;
    const h = 14 + rnd() * 40;
    if (rnd() > 0.3) {
      c.fillStyle = "#0e0a20";
      c.fillRect(x, H - h, w, h);
      windows(x, H - h, w, h, 5, 4, 0.2, 0.8);
    }
    x += w + rnd() * 40;
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const day = new THREE.CanvasTexture(dv);
  day.colorSpace = THREE.SRGBColorSpace;
  day.anisotropy = 8;
  tex.userData.day = day;
  return tex;
}
