"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { easeRise, rise } from "../rise";

/**
 * A star dome around the whole scene. Invisible in the room; it fades in as the camera
 * rises (src/penthouse/rise.ts) so the view above the skyline becomes the night sky.
 */
export function NightSky() {
  const tex = useMemo(() => makeSkyTexture(), []);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const e = easeRise(rise.value);
    if (mesh.current) mesh.current.visible = e > 0.002;
    if (mat.current) mat.current.opacity = Math.min(1, e * 1.6);
  });

  return (
    <mesh ref={mesh} visible={false} renderOrder={-1} rotation-y={0.6}>
      <sphereGeometry args={[140, 48, 24]} />
      <meshBasicMaterial ref={mat} map={tex} side={THREE.BackSide} transparent opacity={0} depthWrite={false} fog={false} toneMapped={false} />
    </mesh>
  );
}

/** Equirectangular night: deep navy zenith, violet glow toward the horizon, stars, a faint milky band. */
function makeSkyTexture(seed = 11): THREE.CanvasTexture {
  const W = 4096;
  const H = 2048;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);

  // top of the canvas is the zenith, the middle is the horizon
  const g = ctx.createLinearGradient(0, 0, 0, H);
  // near the horizon it matches the top of the skyline painting (scene/skyline.ts) so the two meet without a line
  g.addColorStop(0, "#020208");
  g.addColorStop(0.22, "#05061a");
  g.addColorStop(0.36, "#04040f");
  g.addColorStop(0.5, "#030309");
  g.addColorStop(1, "#030305");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // milky band: soft diagonal haze, blurred by drawing small and scaling up
  const small = document.createElement("canvas");
  small.width = 256;
  small.height = 128;
  const sc = small.getContext("2d")!;
  for (let i = 0; i < 90; i++) {
    const x = (i / 90) * 256;
    const y = 18 + Math.sin(i / 14) * 10 + x * 0.12;
    const r = 6 + rnd() * 12;
    const rg = sc.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(150,140,220,${0.05 + rnd() * 0.05})`);
    rg.addColorStop(1, "rgba(150,140,220,0)");
    sc.fillStyle = rg;
    sc.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.drawImage(small, 0, 0, W, H);

  // stars, sparser toward the pole where the sphere squeezes the texture
  for (let i = 0; i < 2600; i++) {
    const y = Math.pow(rnd(), 0.8) * H * 0.5;
    if (rnd() > 0.25 + (y / (H * 0.5)) * 0.75) continue;
    const x = rnd() * W;
    const big = rnd() > 0.985;
    const r = big ? 1.6 + rnd() * 1.4 : 0.5 + rnd() * 1.1;
    const a = big ? 0.85 : 0.25 + rnd() * 0.55;
    const tint = rnd();
    const col = tint > 0.85 ? "255,214,180" : tint > 0.7 ? "190,210,255" : "255,255,255";
    if (big) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      halo.addColorStop(0, `rgba(${col},0.35)`);
      halo.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    }
    ctx.fillStyle = `rgba(${col},${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
