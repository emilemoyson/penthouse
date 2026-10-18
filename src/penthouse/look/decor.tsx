"use client";

import { useMemo, useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { GlowLight } from "../scene/lights";

type G = Omit<ThreeElements["group"], "children">;

export const C = {
  walnut: "#5e3f2b",
  walnutDark: "#3f2a1c",
  oak: "#a37450",
  oakLight: "#c79b6e",
  cream: "#e9e1d3",
  boucle: "#ddd3c3",
  linen: "#d3c8b6",
  sand: "#c4b296",
  terracotta: "#b8643f",
  rust: "#9e4f2f",
  mustard: "#c9963f",
  sage: "#8a9f7f",
  sageDark: "#6b7f63",
  olive: "#5f6b45",
  forest: "#2f4a35",
  leaf: "#3e6b45",
  leafLight: "#5c8a52",
  leafDark: "#2a4a30",
  plum: "#5a3d55",
  ink: "#1d1a17",
  black: "#1a1816",
  brass: "#b8925a",
  steel: "#9a9ca4",
  warm: "#ffb36b",
  warmSoft: "#ffcf96",
};

/* ------------------------------------------------------------------ */
/* small seeded random so decor is stable across renders               */
/* ------------------------------------------------------------------ */
export function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Rounded box with shadows and a standard material. */
export function Block({
  size,
  color,
  radius = 0.02,
  rough = 0.8,
  metal = 0,
  map,
  emissive,
  emissiveIntensity,
  smoothness = 3,
  ...g
}: {
  size: [number, number, number];
  color: string;
  radius?: number;
  rough?: number;
  metal?: number;
  map?: THREE.Texture;
  emissive?: string;
  emissiveIntensity?: number;
  smoothness?: number;
} & G) {
  return (
    <RoundedBox args={[size[0], size[1], size[2]]} radius={Math.min(radius, Math.min(...size) / 2 - 0.0005)} smoothness={smoothness} castShadow receiveShadow {...(g as object)}>
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} map={map} emissive={emissive} emissiveIntensity={emissiveIntensity} />
    </RoundedBox>
  );
}

/* ------------------------------------------------------------------ */
/* pots                                                                */
/* ------------------------------------------------------------------ */

function potGeometry(r: number, h: number) {
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(r * 0.72, 0),
    new THREE.Vector2(r * 0.86, h * 0.08),
    new THREE.Vector2(r * 0.98, h * 0.55),
    new THREE.Vector2(r, h * 0.92),
    new THREE.Vector2(r * 1.04, h),
    new THREE.Vector2(r * 0.9, h),
    new THREE.Vector2(r * 0.88, h * 0.9),
  ];
  return new THREE.LatheGeometry(pts, 28);
}

export function Pot({ r = 0.16, h = 0.3, color = C.terracotta, ...g }: { r?: number; h?: number; color?: string } & G) {
  const geo = useMemo(() => potGeometry(r, h), [r, h]);
  return (
    <group {...g}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, h * 0.88, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[r * 0.88, 24]} />
        <meshStandardMaterial color="#3a2a1e" roughness={1} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* leaves & plants                                                     */
/* ------------------------------------------------------------------ */

const leafCache = new Map<string, THREE.BufferGeometry>();
/** A soft leaf: pointed tip, curved midrib, slight cup. Origin at the stem end, pointing +Y. */
export function leafGeometry(w: number, len: number, curl = 0.25, notch = false) {
  const key = `${w}-${len}-${curl}-${notch}`;
  if (leafCache.has(key)) return leafCache.get(key)!;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(w * 0.9, len * 0.15, w * 1.0, len * 0.65, 0, len);
  s.bezierCurveTo(-w * 1.0, len * 0.65, -w * 0.9, len * 0.15, 0, 0);
  if (notch) {
    // monstera-ish slits
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const h = new THREE.Path();
        const y = len * (0.3 + i * 0.18);
        h.moveTo(side * w * 0.35, y);
        h.lineTo(side * w * 0.85, y + len * 0.05);
        h.lineTo(side * w * 0.82, y + len * 0.085);
        h.lineTo(side * w * 0.33, y + len * 0.035);
        h.closePath();
        s.holes.push(h);
      }
  }
  const g = new THREE.ShapeGeometry(s, 10);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const t = y / len;
    p.setZ(i, Math.sin(t * Math.PI * 0.9) * len * curl * 0.5 - Math.abs(x) * Math.abs(x) * 1.2);
  }
  g.computeVertexNormals();
  leafCache.set(key, g);
  return g;
}

function Leaf({ w, len, color, curl, notch, ...g }: { w: number; len: number; color: string; curl?: number; notch?: boolean } & G) {
  return (
    <mesh geometry={leafGeometry(w, len, curl, notch)} castShadow {...g}>
      <meshStandardMaterial color={color} roughness={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

export type PlantKind = "monstera" | "fiddle" | "snake" | "olive" | "pothos" | "herb";

export function Plant({ kind, scale = 1, pot = C.terracotta, seed = 1, ...g }: { kind: PlantKind; scale?: number; pot?: string; seed?: number } & G) {
  const parts = useMemo(() => {
    const r = rng(seed * 97 + 13);
    const out: { pos: [number, number, number]; rot: [number, number, number]; w: number; len: number; color: string; notch?: boolean; curl?: number }[] = [];
    const greens = [C.leaf, C.leafLight, C.leafDark];
    if (kind === "monstera") {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + r() * 0.4;
        const h = 0.35 + r() * 0.55;
        out.push({ pos: [Math.cos(a) * 0.12, h, Math.sin(a) * 0.12], rot: [-0.9 - r() * 0.5, -a + Math.PI / 2, 0], w: 0.2 + r() * 0.06, len: 0.42 + r() * 0.12, color: greens[i % 3], notch: true, curl: 0.3 });
      }
    } else if (kind === "fiddle") {
      for (let i = 0; i < 16; i++) {
        const a = i * 2.4;
        out.push({ pos: [Math.cos(a) * 0.05, 0.55 + i * 0.07, Math.sin(a) * 0.05], rot: [-0.7 - r() * 0.4, -a, 0], w: 0.09, len: 0.22, color: greens[i % 3], curl: 0.4 });
      }
    } else if (kind === "snake") {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        out.push({ pos: [Math.cos(a) * 0.05, 0.25, Math.sin(a) * 0.05], rot: [(r() - 0.5) * 0.35, a, (r() - 0.5) * 0.3], w: 0.045, len: 0.55 + r() * 0.3, color: i % 2 ? "#4f6b3a" : "#3b5a35", curl: 0.05 });
      }
    } else if (kind === "olive") {
      for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2;
        const h = 0.9 + r() * 0.75;
        const rad = 0.08 + r() * 0.28 * (1 - Math.abs(h - 1.3));
        out.push({ pos: [Math.cos(a) * rad, h, Math.sin(a) * rad], rot: [r() * 3, r() * 3, r() * 3], w: 0.018, len: 0.09, color: r() > 0.5 ? "#7d8a68" : "#5f6e52", curl: 0.1 });
      }
    } else if (kind === "pothos") {
      for (let v = 0; v < 4; v++) {
        const a = (v / 4) * Math.PI * 2 + 0.3;
        for (let i = 0; i < 7; i++) {
          out.push({ pos: [Math.cos(a) * (0.12 + i * 0.015), 0.22 - i * 0.07, Math.sin(a) * (0.12 + i * 0.015)], rot: [0.6, -a + Math.PI / 2, (r() - 0.5) * 0.8], w: 0.035, len: 0.07, color: greens[(i + v) % 3], curl: 0.3 });
        }
      }
    } else {
      for (let i = 0; i < 14; i++) {
        const a = r() * Math.PI * 2;
        out.push({ pos: [Math.cos(a) * 0.03, 0.13 + r() * 0.06, Math.sin(a) * 0.03], rot: [-0.5 - r() * 0.6, a, 0], w: 0.025, len: 0.07, color: greens[i % 3], curl: 0.3 });
      }
    }
    return out;
  }, [kind, seed]);

  const potSize: Record<PlantKind, [number, number]> = {
    monstera: [0.2, 0.34],
    fiddle: [0.18, 0.38],
    snake: [0.13, 0.26],
    olive: [0.2, 0.4],
    pothos: [0.11, 0.17],
    herb: [0.06, 0.1],
  };
  const [pr, ph] = potSize[kind];
  return (
    <group scale={scale} {...g}>
      <Pot r={pr} h={ph} color={pot} />
      {(kind === "fiddle" || kind === "olive") && (
        <mesh position={[0, kind === "olive" ? 0.65 : 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.02, kind === "olive" ? 1.0 : 0.9, 6]} />
          <meshStandardMaterial color="#5a4433" roughness={0.9} />
        </mesh>
      )}
      {kind === "monstera" &&
        parts.map((p, i) => (
          <mesh key={`s${i}`} position={[p.pos[0] / 2, (p.pos[1] + ph) / 2, p.pos[2] / 2]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.006, 0.008, p.pos[1] - ph + 0.05, 5]} />
            <meshStandardMaterial color={C.leafDark} />
          </mesh>
        ))}
      {parts.map((p, i) => (
        <Leaf key={i} position={p.pos} rotation={p.rot} w={p.w} len={p.len} color={p.color} notch={p.notch} curl={p.curl} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* lighting fixtures (each carries its own light)                      */
/* ------------------------------------------------------------------ */

function shadeGeometry(rTop: number, rBot: number, h: number) {
  return new THREE.CylinderGeometry(rTop, rBot, h, 32, 1, true);
}

/** Ceramic table lamp with a linen drum shade. */
export function TableLamp({ base = C.cream, shade = "#efe3cc", intensity = 3, shadow = false, height = 0.55, ...g }: { base?: string; shade?: string; intensity?: number; shadow?: boolean; height?: number } & G) {
  const baseGeo = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0.07, 0),
          new THREE.Vector2(0.1, height * 0.25),
          new THREE.Vector2(0.075, height * 0.5),
          new THREE.Vector2(0.025, height * 0.58),
          new THREE.Vector2(0.015, height * 0.62),
        ],
        28,
      ),
    [height],
  );
  const shadeGeo = useMemo(() => shadeGeometry(0.11, 0.15, 0.2), []);
  return (
    <group {...g}>
      <mesh geometry={baseGeo} castShadow>
        <meshStandardMaterial color={base} roughness={0.35} />
      </mesh>
      <mesh geometry={shadeGeo} position={[0, height * 0.62 + 0.08, 0]}>
        <meshStandardMaterial color={shade} emissive={C.warm} emissiveIntensity={0.9} roughness={1} side={THREE.DoubleSide} transparent opacity={0.96} />
      </mesh>
      <GlowLight position={[0, height * 0.62 + 0.06, 0]} color="#ffb06a" intensity={intensity} distance={4} shadow={shadow} />
    </group>
  );
}

/** Arc floor lamp with a brass dome. */
export function ArcLamp({ intensity = 5, ...g }: { intensity?: number } & G) {
  const tube = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(0, 1.3, 0),
      new THREE.Vector3(0.25, 1.85, 0),
      new THREE.Vector3(0.75, 1.95, 0),
      new THREE.Vector3(1.05, 1.75, 0),
    ]);
    return new THREE.TubeGeometry(curve, 40, 0.012, 8, false);
  }, []);
  return (
    <group {...g}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.05, 32]} />
        <meshStandardMaterial color="#e6e1d8" roughness={0.3} />
      </mesh>
      <mesh geometry={tube} castShadow>
        <meshStandardMaterial color={C.brass} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[1.05, 1.68, 0]} castShadow>
        <sphereGeometry args={[0.16, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={C.brass} metalness={0.8} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[1.05, 1.66, 0]}>
        <sphereGeometry args={[0.05, 16, 12]} />
        <meshBasicMaterial color={C.warmSoft} toneMapped={false} />
      </mesh>
      <GlowLight position={[1.05, 1.55, 0]} color="#ffb06a" intensity={intensity} distance={5} />
    </group>
  );
}

/** Opal glass globe pendant on a cord to the ceiling. */
export function Pendant({ drop = 1.6, intensity = 3, r = 0.13, ...g }: { drop?: number; intensity?: number; r?: number } & G) {
  return (
    <group {...g}>
      <mesh position={[0, drop / 2, 0]}>
        <cylinderGeometry args={[0.004, 0.004, drop, 5]} />
        <meshBasicMaterial color="#222" />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.05, 16]} />
        <meshStandardMaterial color={C.brass} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, -r + 0.02, 0]}>
        <sphereGeometry args={[r, 32, 20]} />
        <meshStandardMaterial color="#fff4e2" emissive="#ffc27d" emissiveIntensity={1.6} roughness={0.2} transparent opacity={0.95} />
      </mesh>
      <GlowLight position={[0, -r - 0.05, 0]} color="#ffbd7a" intensity={intensity} distance={4.5} />
    </group>
  );
}

/** Articulated desk lamp. */
export function DeskLamp({ intensity = 2.2, ...g }: { intensity?: number } & G) {
  return (
    <group {...g}>
      <mesh position={[0, 0.012, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 0.024, 24]} />
        <meshStandardMaterial color={C.black} roughness={0.4} />
      </mesh>
      <mesh position={[0.04, 0.2, 0]} rotation-z={-0.35} castShadow>
        <cylinderGeometry args={[0.008, 0.008, 0.38, 8]} />
        <meshStandardMaterial color={C.black} />
      </mesh>
      <mesh position={[0.17, 0.38, 0]} rotation-z={1.0} castShadow>
        <cylinderGeometry args={[0.008, 0.008, 0.3, 8]} />
        <meshStandardMaterial color={C.black} />
      </mesh>
      <mesh position={[0.3, 0.33, 0]} rotation-z={2.4} castShadow>
        <coneGeometry args={[0.06, 0.12, 24, 1, true]} />
        <meshStandardMaterial color={C.black} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.31, 0.3, 0]}>
        <sphereGeometry args={[0.02, 12, 8]} />
        <meshBasicMaterial color={C.warmSoft} toneMapped={false} />
      </mesh>
      <GlowLight position={[0.32, 0.26, 0]} color="#ffc48a" intensity={intensity} distance={2.5} />
    </group>
  );
}

/** Candle with a flickering flame. */
export function Candle({ h = 0.1, r = 0.035, light = 0.8, ...g }: { h?: number; r?: number; light?: number } & G) {
  const flame = useRef<THREE.Mesh>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const off = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + off;
    const f = 0.85 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.08;
    if (flame.current) flame.current.scale.set(1, f, 1);
    if (lamp.current) lamp.current.intensity = light * f;
  });
  return (
    <group {...g}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[r, r, h, 20]} />
        <meshStandardMaterial color="#f1e8d8" roughness={0.6} />
      </mesh>
      <mesh ref={flame} position={[0, h + 0.02, 0]}>
        <sphereGeometry args={[0.01, 10, 8]} />
        <meshBasicMaterial color="#ffd38a" toneMapped={false} />
      </mesh>
      <pointLight ref={lamp} position={[0, h + 0.05, 0]} color="#ff9a4a" intensity={light} distance={1.6} decay={2} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* books, frames, objects                                              */
/* ------------------------------------------------------------------ */

const BOOK_COLORS = ["#b8643f", "#2f4a3a", "#d9a441", "#e9e1d3", "#3b3530", "#8a9f7f", "#6d3f43", "#2f4f6f", "#c9b79c"];

/** A row of upright books, length along X. */
export function BookRow({ width = 0.5, seed = 1, ...g }: { width?: number; seed?: number } & G) {
  const books = useMemo(() => {
    const r = rng(seed * 31 + 7);
    const out: { x: number; w: number; h: number; d: number; c: string; tilt: number }[] = [];
    let x = 0;
    while (x < width) {
      const w = 0.025 + r() * 0.03;
      out.push({ x: x + w / 2, w, h: 0.17 + r() * 0.09, d: 0.13 + r() * 0.04, c: BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)], tilt: 0 });
      x += w + 0.002;
    }
    if (out.length > 3) out[out.length - 1].tilt = -0.25;
    return out;
  }, [width, seed]);
  return (
    <group {...g}>
      {books.map((b, i) => (
        <mesh key={i} position={[b.x - width / 2 + (b.tilt ? b.h * 0.12 : 0), b.h / 2, 0]} rotation-z={b.tilt} castShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color={b.c} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** A small stack of books lying flat. */
export function BookStack({ count = 3, seed = 2, ...g }: { count?: number; seed?: number } & G) {
  const r = useMemo(() => rng(seed * 17 + 3), [seed]);
  const books = useMemo(() => Array.from({ length: count }, () => ({ w: 0.2 + r() * 0.06, d: 0.15 + r() * 0.04, h: 0.025 + r() * 0.02, rot: (r() - 0.5) * 0.4, c: BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)] })), [count, r]);
  let y = 0;
  return (
    <group {...g}>
      {books.map((b, i) => {
        const yy = y + b.h / 2;
        y += b.h;
        return (
          <mesh key={i} position={[0, yy, 0]} rotation-y={b.rot} castShadow receiveShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.c} roughness={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Thin-framed art print, hung facing +Z. */
export function Frame({ w, h, map, frame = C.walnutDark, ...g }: { w: number; h: number; map: THREE.Texture; frame?: string } & G) {
  return (
    <group {...g}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.06, h + 0.06, 0.03]} />
        <meshStandardMaterial color={frame} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.0155]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Ceramic vase with a few dried stems. */
export function Vase({ color = C.cream, ...g }: { color?: string } & G) {
  const geo = useMemo(
    () =>
      new THREE.LatheGeometry(
        [new THREE.Vector2(0, 0), new THREE.Vector2(0.05, 0), new THREE.Vector2(0.07, 0.08), new THREE.Vector2(0.04, 0.17), new THREE.Vector2(0.025, 0.2), new THREE.Vector2(0.03, 0.22)],
        24,
      ),
    [],
  );
  return (
    <group {...g}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {[-0.2, 0.1, 0.35].map((a, i) => (
        <mesh key={i} position={[Math.sin(a) * 0.08, 0.36, 0]} rotation-z={-a} castShadow>
          <cylinderGeometry args={[0.003, 0.003, 0.32, 4]} />
          <meshStandardMaterial color="#b89a6a" />
        </mesh>
      ))}
      {[-0.2, 0.1, 0.35].map((a, i) => (
        <mesh key={`h${i}`} position={[Math.sin(a) * 0.16, 0.52, 0]} castShadow>
          <sphereGeometry args={[0.025, 8, 6]} />
          <meshStandardMaterial color="#d8c39a" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Coffee mug. */
export function Mug({ color = C.cream, ...g }: { color?: string } & G) {
  return (
    <group {...g}>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.036, 0.09, 20]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0.045, 0.05, 0]} rotation-y={0}>
        <torusGeometry args={[0.022, 0.006, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.085, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.035, 16]} />
        <meshStandardMaterial color="#3a2416" roughness={0.3} />
      </mesh>
    </group>
  );
}
