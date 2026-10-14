import * as THREE from "three";

/**
 * Procedural night skyline, painted once to a canvas.
 * Far layers are blurred more than near ones, which reads like a camera
 * focused on the interior (shallow depth of field) without a costly DOF pass.
 * Swap for a photo later: new THREE.TextureLoader().load("/textures/skyline.jpg").
 */
export function makeSkylineTexture(seed = 7): THREE.CanvasTexture {
  const W = 3072;
  const H = 1024;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#05050c");
  sky.addColorStop(0.45, "#0d0b22");
  sky.addColorStop(0.72, "#2a1840");
  sky.addColorStop(0.86, "#4a2346");
  sky.addColorStop(1, "#1a1020");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // stars
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.45})`;
    const r = rnd() * 1.4;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H * 0.5, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // moon
  ctx.save();
  const mg = ctx.createRadialGradient(W * 0.78, H * 0.2, 0, W * 0.78, H * 0.2, 140);
  mg.addColorStop(0, "rgba(255,240,220,0.9)");
  mg.addColorStop(0.25, "rgba(255,230,200,0.35)");
  mg.addColorStop(1, "rgba(255,230,200,0)");
  ctx.fillStyle = mg;
  ctx.fillRect(W * 0.78 - 140, H * 0.2 - 140, 280, 280);
  ctx.restore();

  // haze band on horizon
  const haze = ctx.createLinearGradient(0, H * 0.6, 0, H);
  haze.addColorStop(0, "rgba(255,120,160,0)");
  haze.addColorStop(1, "rgba(255,120,160,0.18)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);

  const layers = [
    { base: H * 0.78, maxH: 0.34, minW: 50, maxW: 140, color: "#1a1530", blur: 5, lit: 0.18, win: 3 },
    { base: H * 0.86, maxH: 0.46, minW: 70, maxW: 190, color: "#110d20", blur: 3, lit: 0.28, win: 4 },
    { base: H * 0.98, maxH: 0.58, minW: 90, maxW: 240, color: "#08070f", blur: 1.6, lit: 0.36, win: 5 },
  ];

  for (const L of layers) {
    // Paint the layer on its own canvas, then soften it by drawing it down-scaled and back up.
    // (Cheaper than ctx.filter per shape, and works in Safari, which has no canvas filters.)
    const layer = document.createElement("canvas");
    layer.width = W;
    layer.height = H;
    const lc = layer.getContext("2d")!;
    let x = -20;
    while (x < W) {
      const w = L.minW + rnd() * (L.maxW - L.minW);
      const h = (0.12 + rnd() * L.maxH) * H;
      const top = L.base - h;
      lc.fillStyle = L.color;
      lc.fillRect(x, top, w, h + 40);
      // spire
      if (rnd() < 0.12) {
        lc.fillRect(x + w / 2 - 3, top - 60, 6, 60);
        lc.fillStyle = "rgba(255,60,60,0.9)";
        lc.fillRect(x + w / 2 - 3, top - 64, 6, 6);
      }
      // windows
      const cols = Math.floor(w / (L.win * 3));
      const rows = Math.floor(h / (L.win * 3.2));
      for (let r = 1; r < rows; r++) {
        for (let c = 1; c < cols; c++) {
          if (rnd() > L.lit) continue;
          const warm = rnd() < 0.72;
          const a = 0.35 + rnd() * 0.6;
          lc.fillStyle = warm ? `rgba(255,${180 + Math.floor(rnd() * 50)},${100 + Math.floor(rnd() * 60)},${a})` : `rgba(${120 + Math.floor(rnd() * 60)},${170 + Math.floor(rnd() * 50)},255,${a})`;
          lc.fillRect(x + c * L.win * 3, top + r * L.win * 3.2, L.win * 1.6, L.win * 1.9);
        }
      }
      x += w + rnd() * 18;
    }
    const k = 1 + L.blur * 0.7;
    const small = document.createElement("canvas");
    small.width = Math.round(W / k);
    small.height = Math.round(H / k);
    const sc = small.getContext("2d")!;
    sc.imageSmoothingQuality = "high";
    sc.drawImage(layer, 0, 0, small.width, small.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(small, 0, 0, W, H);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
