"use client";

import { useMemo, type ReactNode } from "react";
import type { ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { Block, C, rng, Mug } from "./decor";
import { fabric, laptopScreen, marble, monitorScreen } from "./textures";

type G = Omit<ThreeElements["group"], "children">;

/* Conventions: origin at the floor under the piece's centre, front faces +Z unless noted. */

/* =============================== BEDROOM =============================== */

/** Upholstered queen bed with a channel-tufted headboard. Head toward -X. ~2.2 m × 1.75 m. */
export function Bed({ duvet = "#cdbfae", occupied = false, ...g }: { duvet?: string; occupied?: boolean } & G) {
  const fab = fabric();
  const L = 2.2;
  const W = 1.75;
  return (
    <group {...g}>
      {/* base frame */}
      <Block size={[L, 0.28, W + 0.08]} position={[0, 0.17, 0]} color="#6b5a4c" radius={0.06} map={fab} rough={1} />
      <Block size={[L - 0.2, 0.04, W - 0.1]} position={[0, 0.025, 0]} color={C.black} radius={0.01} />
      {/* mattress */}
      <Block size={[L - 0.1, 0.24, W - 0.04]} position={[0.03, 0.42, 0]} color="#f1ebe1" radius={0.07} map={fab} rough={1} />
      {/* channel-tufted headboard */}
      {Array.from({ length: 7 }, (_, i) => (
        <Block key={i} size={[0.14, 1.05, W / 7 - 0.012]} position={[-L / 2 - 0.02, 0.75, -W / 2 + W / 14 + (i * W) / 7]} color="#7a6656" radius={0.06} map={fab} rough={1} />
      ))}
      {/* pillows: two sleeping + two euro + accent */}
      {[-0.42, 0.42].map((z) => (
        <Block key={z} size={[0.42, 0.16, 0.7]} position={[-L / 2 + 0.38, 0.62, z]} rotation-z={0.12} color="#f7f3ec" radius={0.075} map={fab} rough={1} />
      ))}
      {[-0.42, 0.42].map((z) => (
        <Block key={`e${z}`} size={[0.16, 0.5, 0.62]} position={[-L / 2 + 0.16, 0.8, z]} rotation-z={0.18} color="#c9b8a2" radius={0.07} map={fab} rough={1} />
      ))}
      {!occupied && <Block size={[0.14, 0.32, 0.46]} position={[-L / 2 + 0.52, 0.72, 0]} rotation-z={0.3} color={C.terracotta} radius={0.06} map={fab} rough={1} />}
      {/* duvet: soft slab folded back at the top, with a couple of rumples */}
      <Block size={[L - 0.62, 0.12, W + 0.06]} position={[0.31, 0.58, 0]} color={duvet} radius={0.06} map={fab} rough={1} />
      <Block size={[0.26, 0.14, W + 0.08]} position={[-0.38, 0.61, 0]} color="#e9e1d3" radius={0.07} map={fab} rough={1} />
      {[
        [0.2, 0.3],
        [0.7, -0.35],
        [0.95, 0.4],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.61, z]} scale={[0.32, 0.06, 0.28]} castShadow receiveShadow>
          <sphereGeometry args={[1, 20, 12]} />
          <meshStandardMaterial color={duvet} roughness={1} map={fab} />
        </mesh>
      ))}
      {/* duvet drape over the sides */}
      {[-1, 1].map((s) => (
        <Block key={s} size={[L - 0.62, 0.32, 0.05]} position={[0.31, 0.46, s * (W / 2 + 0.05)]} color={duvet} radius={0.02} map={fab} rough={1} />
      ))}
      {/* knitted throw across the foot */}
      <Block size={[0.42, 0.06, W + 0.12]} position={[L / 2 - 0.3, 0.66, 0]} color={C.mustard} radius={0.03} map={fab} rough={1} />
      <Block size={[0.42, 0.3, 0.04]} position={[L / 2 - 0.3, 0.52, W / 2 + 0.08]} color={C.mustard} radius={0.02} map={fab} rough={1} />
    </group>
  );
}

/** Walnut nightstand with a drawer and an open shelf. Pivot: floor centre. */
export function Nightstand(g: G) {
  return (
    <group {...g}>
      <Block size={[0.48, 0.5, 0.42]} position={[0, 0.3, 0]} color={C.walnut} radius={0.015} rough={0.55} />
      <Block size={[0.44, 0.18, 0.02]} position={[0, 0.42, 0.205]} color={C.walnutDark} radius={0.005} />
      <mesh position={[0, 0.42, 0.22]}>
        <boxGeometry args={[0.1, 0.012, 0.012]} />
        <meshStandardMaterial color={C.brass} metalness={0.8} roughness={0.3} />
      </mesh>
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, 0.025, 0]} castShadow>
          <cylinderGeometry args={[0.015, 0.012, 0.05, 8]} />
          <meshStandardMaterial color={C.walnutDark} />
        </mesh>
      ))}
    </group>
  );
}

/** Upholstered bench for the foot of the bed. Long side along Z. */
export function Bench(g: G) {
  const fab = fabric();
  return (
    <group {...g}>
      <Block size={[0.42, 0.14, 1.3]} position={[0, 0.4, 0]} color={C.sage} radius={0.05} map={fab} rough={1} />
      {[
        [-0.15, -0.55],
        [0.15, -0.55],
        [-0.15, 0.55],
        [0.15, 0.55],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.17, z]} castShadow>
          <cylinderGeometry args={[0.018, 0.014, 0.34, 8]} />
          <meshStandardMaterial color={C.walnut} />
        </mesh>
      ))}
    </group>
  );
}

/* ================================ OFFICE =============================== */

/** Solid walnut desk, faces +Z (you sit on the +Z side). 1.6 m × 0.75 m. */
export function Desk(g: G) {
  return (
    <group {...g}>
      <Block size={[1.6, 0.04, 0.75]} position={[0, 0.74, 0]} color={C.walnut} radius={0.012} rough={0.45} />
      {[-0.74, 0.74].map((x) =>
        [-0.3, 0.3].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.36, z]} castShadow>
            <boxGeometry args={[0.04, 0.72, 0.04]} />
            <meshStandardMaterial color={C.walnutDark} roughness={0.5} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.64, -0.3]} castShadow>
        <boxGeometry args={[1.44, 0.12, 0.03]} />
        <meshStandardMaterial color={C.walnutDark} roughness={0.5} />
      </mesh>
      {/* felt desk mat */}
      <Block size={[0.9, 0.006, 0.4]} position={[-0.08, 0.763, 0.12]} color="#3b3732" radius={0.003} rough={1} />
    </group>
  );
}

/** 34" monitor on a clamp arm with a live-looking dashboard. Sits on the desk top (y=0 is the desk surface). */
export function Monitor({ glow = 1, ...g }: { glow?: number } & G) {
  const screen = monitorScreen();
  return (
    <group {...g}>
      <mesh position={[0, 0.02, -0.28]} castShadow>
        <boxGeometry args={[0.06, 0.04, 0.08]} />
        <meshStandardMaterial color={C.black} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.2, -0.27]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.36, 10]} />
        <meshStandardMaterial color={C.black} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.38, -0.2]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.16, 10]} />
        <meshStandardMaterial color={C.black} metalness={0.6} roughness={0.35} />
      </mesh>
      <Block size={[0.82, 0.36, 0.025]} position={[0, 0.4, -0.11]} color="#121214" radius={0.01} rough={0.5} />
      <mesh position={[0, 0.405, -0.0965]}>
        <planeGeometry args={[0.79, 0.33]} />
        <meshBasicMaterial map={screen} toneMapped={false} color={new THREE.Color(0.85 * glow, 0.85 * glow, 0.85 * glow)} />
      </mesh>
    </group>
  );
}

/** Low-profile mechanical keyboard + mouse. On the desk surface. */
export function KeyboardMouse(g: G) {
  const keys = useMemo(() => {
    const out: { x: number; z: number; w: number; c: string }[] = [];
    for (let r = 0; r < 5; r++) {
      let x = -0.16;
      for (let k = 0; k < 14 && x < 0.16; k++) {
        const w = r === 4 && k === 4 ? 0.1 : 0.019;
        const accent = (r === 0 && k === 0) || (r === 2 && k === 12);
        out.push({ x: x + w / 2, z: -0.045 + r * 0.022, w, c: accent ? "#c2683f" : r === 4 && k === 4 ? "#d8d2c6" : k % 2 ? "#e6e0d4" : "#d8d2c6" });
        x += w + 0.004;
      }
    }
    return out;
  }, []);
  return (
    <group {...g}>
      <Block size={[0.35, 0.02, 0.13]} position={[0, 0.01, 0]} color="#2e2b28" radius={0.006} />
      {keys.map((k, i) => (
        <mesh key={i} position={[k.x, 0.026, k.z]} castShadow>
          <boxGeometry args={[k.w, 0.012, 0.018]} />
          <meshStandardMaterial color={k.c} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0.28, 0.014, 0.02]} scale={[0.032, 0.016, 0.055]} castShadow>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color="#e6e0d4" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Laptop on an aluminium stand, screen facing +Z. On the desk surface. */
export function LaptopOnStand({ glow = 1, ...g }: { glow?: number } & G) {
  const screen = laptopScreen();
  return (
    <group {...g}>
      {/* stand */}
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.06, -0.03]} rotation-x={-0.35} castShadow>
          <boxGeometry args={[0.02, 0.14, 0.2]} />
          <meshStandardMaterial color={C.steel} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <group position={[0, 0.11, -0.02]} rotation-x={0.3}>
        <Block size={[0.32, 0.012, 0.22]} color="#b5b7bd" radius={0.005} metal={0.7} rough={0.35} />
        <group position={[0, 0.006, -0.11]} rotation-x={-1.95}>
          <Block size={[0.32, 0.01, 0.21]} position={[0, 0, -0.105]} color="#b5b7bd" radius={0.005} metal={0.7} rough={0.35} />
          <mesh position={[0, 0.0055, -0.105]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.3, 0.19]} />
            <meshBasicMaterial map={screen} toneMapped={false} color={new THREE.Color(0.9 * glow, 0.9 * glow, 0.9 * glow)} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Ergonomic chair, back toward +Z. Pivot: floor under the seat. */
export function OfficeChair(g: G) {
  const fab = fabric();
  return (
    <group {...g}>
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation-y={a}>
            <mesh position={[0, 0.06, 0.15]} rotation-x={Math.PI / 2 - 0.12} castShadow>
              <cylinderGeometry args={[0.014, 0.018, 0.3, 8]} />
              <meshStandardMaterial color={C.black} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.03, 0.29]}>
              <sphereGeometry args={[0.025, 10, 8]} />
              <meshStandardMaterial color={C.black} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.32, 12]} />
        <meshStandardMaterial color={C.steel} metalness={0.8} roughness={0.3} />
      </mesh>
      <Block size={[0.5, 0.08, 0.48]} position={[0, 0.43, 0]} color="#3d3a36" radius={0.035} map={fab} rough={1} />
      {/* curved mesh back */}
      <group position={[0, 0.78, 0.26]} rotation-x={0.12}>
        <Block size={[0.46, 0.58, 0.05]} color="#2f2c29" radius={0.04} map={fab} rough={1} />
        <Block size={[0.3, 0.16, 0.05]} position={[0, 0.39, 0.0]} color="#2f2c29" radius={0.04} map={fab} rough={1} />
      </group>
      <mesh position={[0, 0.55, 0.25]} castShadow>
        <boxGeometry args={[0.06, 0.2, 0.03]} />
        <meshStandardMaterial color={C.black} />
      </mesh>
      {[-0.26, 0.26].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.55, 0.02]} castShadow>
            <boxGeometry args={[0.025, 0.16, 0.025]} />
            <meshStandardMaterial color={C.black} />
          </mesh>
          <Block size={[0.06, 0.03, 0.24]} position={[x, 0.64, 0.02]} color="#2f2c29" radius={0.012} />
        </group>
      ))}
    </group>
  );
}

/* ================================== GYM ================================== */

export function Dumbbell({ r = 0.06, len = 0.3, ...g }: { r?: number; len?: number } & G) {
  return (
    <group {...g}>
      <mesh rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.014, 0.014, len, 10]} />
        <meshStandardMaterial color={C.steel} metalness={0.9} roughness={0.25} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (len / 2 - r * 0.6), 0, 0]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[r, r, r * 1.2, 6]} />
          <meshStandardMaterial color="#222024" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** Two-tier dumbbell rack, long side along Z. */
export function DumbbellRack(g: G) {
  const sizes = [0.045, 0.052, 0.058, 0.064, 0.07];
  return (
    <group {...g}>
      {[-0.6, 0.6].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[-0.12, 0.4, 0]} rotation-z={0.18} castShadow>
            <boxGeometry args={[0.04, 0.82, 0.04]} />
            <meshStandardMaterial color={C.black} roughness={0.4} />
          </mesh>
          <mesh position={[0.12, 0.4, 0]} rotation-z={-0.18} castShadow>
            <boxGeometry args={[0.04, 0.82, 0.04]} />
            <meshStandardMaterial color={C.black} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <Block size={[0.2, 0.025, 1.3]} position={[0.05, 0.34, 0]} rotation-z={-0.2} color="#2a2826" radius={0.008} />
      <Block size={[0.16, 0.025, 1.3]} position={[-0.02, 0.66, 0]} rotation-z={-0.2} color="#2a2826" radius={0.008} />
      {sizes.map((r, i) => (
        <group key={i}>
          <Dumbbell r={r} position={[0.06, 0.4 + r * 0.5, -0.48 + i * 0.24]} rotation-y={Math.PI / 2} />
          <Dumbbell r={r * 0.75} len={0.24} position={[-0.02, 0.7 + r * 0.4, -0.48 + i * 0.24]} rotation-y={Math.PI / 2} />
        </group>
      ))}
    </group>
  );
}

/** Adjustable flat bench, long side along Z. */
export function FlatBench(g: G) {
  return (
    <group {...g}>
      <Block size={[0.3, 0.08, 1.15]} position={[0, 0.44, 0]} color="#2c2a2e" radius={0.03} rough={0.7} />
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.06, 0.38, 0.8]} />
        <meshStandardMaterial color={C.black} roughness={0.4} />
      </mesh>
      {[-0.5, 0.5].map((z) => (
        <mesh key={z} position={[0, 0.03, z]} castShadow>
          <boxGeometry args={[0.42, 0.06, 0.06]} />
          <meshStandardMaterial color={C.black} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Yoga mat laid flat (long side along Z) with a rolled end. */
export function YogaMat({ color = "#5f6b55", ...g }: { color?: string } & G) {
  return (
    <group {...g}>
      <Block size={[0.62, 0.006, 1.7]} position={[0, 0.003, 0]} color={color} radius={0.002} rough={0.9} />
      <mesh position={[0, 0.06, 0.9]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.62, 24]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  );
}

export function Kettlebell({ s = 1, color = "#202024", ...g }: { s?: number; color?: string } & G) {
  return (
    <group scale={s} {...g}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <sphereGeometry args={[0.1, 20, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <torusGeometry args={[0.06, 0.016, 8, 20, Math.PI]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Indoor bike, facing +Z. */
export function Bike(g: G) {
  return (
    <group {...g}>
      <Block size={[0.5, 0.04, 0.08]} position={[0, 0.03, 0.45]} color={C.black} radius={0.015} />
      <Block size={[0.5, 0.04, 0.08]} position={[0, 0.03, -0.5]} color={C.black} radius={0.015} />
      <mesh position={[0, 0.32, 0.4]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.06, 36]} />
        <meshStandardMaterial color="#2a2a2e" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.32, 0.4]} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.245, 0.008, 6, 48]} />
        <meshBasicMaterial color={C.warm} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.5, 0.05]} rotation-x={-0.75} castShadow>
        <boxGeometry args={[0.06, 0.95, 0.06]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.48, -0.3]} rotation-x={0.25} castShadow>
        <boxGeometry args={[0.06, 0.85, 0.06]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.4} />
      </mesh>
      <Block size={[0.16, 0.05, 0.26]} position={[0, 0.92, -0.38]} color="#1d1b1a" radius={0.02} />
      <mesh position={[0, 1.0, 0.36]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 0.44, 8]} />
        <meshStandardMaterial color={C.black} />
      </mesh>
      <Block size={[0.14, 0.09, 0.02]} position={[0, 1.06, 0.33]} rotation-x={-0.4} color={C.black} radius={0.008} />
      <mesh position={[0, 1.065, 0.341]} rotation-x={-0.4}>
        <planeGeometry args={[0.11, 0.06]} />
        <meshBasicMaterial color="#5aa8ff" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Tall floor mirror leaning on the wall, facing +X. */
export function LeaningMirror(g: G) {
  return (
    <group {...g}>
      <group rotation-z={-0.08}>
        <Block size={[0.05, 1.8, 0.75]} position={[0, 0.9, 0]} color={C.oak} radius={0.02} />
        <mesh position={[0.028, 0.9, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[0.67, 1.72]} />
          <meshStandardMaterial color="#9fb0bf" metalness={1} roughness={0.08} envMapIntensity={1} />
        </mesh>
      </group>
    </group>
  );
}

/* ================================ KITCHEN =============================== */

/** Island: fluted oak front, marble top with waterfall ends. Long side along X, stools on +Z. 2.4 × 0.95 m. */
export function Island(g: G) {
  const m = marble();
  return (
    <group {...g}>
      <Block size={[2.3, 0.86, 0.8]} position={[0, 0.45, -0.05]} color="#2b2522" radius={0.01} />
      {/* fluting on the stool side */}
      {Array.from({ length: 46 }, (_, i) => (
        <mesh key={i} position={[-1.125 + i * 0.05, 0.45, 0.36]} castShadow receiveShadow>
          <cylinderGeometry args={[0.024, 0.024, 0.84, 10, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={C.oak} roughness={0.55} />
        </mesh>
      ))}
      {/* marble top + waterfall ends */}
      <Block size={[2.44, 0.05, 0.98]} position={[0, 0.905, 0.04]} color="#ffffff" radius={0.008} map={m} rough={0.18} />
      {[-1, 1].map((s) => (
        <Block key={s} size={[0.05, 0.88, 0.98]} position={[s * 1.195, 0.44, 0.04]} color="#ffffff" radius={0.008} map={m} rough={0.18} />
      ))}
      {/* warm strip under the overhang */}
      <mesh position={[0, 0.875, 0.5]}>
        <boxGeometry args={[2.3, 0.008, 0.008]} />
        <meshBasicMaterial color={C.warmSoft} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Minimal bar stool: oak seat, black frame. */
export function Stool(g: G) {
  return (
    <group {...g}>
      <mesh position={[0, 0.68, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.19, 0.18, 0.05, 32]} />
        <meshStandardMaterial color={C.oak} roughness={0.5} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.12, 0.33, Math.sin(a) * 0.12]} rotation={[Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.68, 8]} />
            <meshStandardMaterial color={C.black} roughness={0.4} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.25, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.135, 0.008, 6, 32]} />
        <meshStandardMaterial color={C.black} />
      </mesh>
    </group>
  );
}

/** Back run along Z: sage cabinets, marble counter, open oak shelves with jars and plates, warm LED, fridge. Front faces -X. */
export function BackKitchen({ length = 2.6, fill = 1, ...g }: { length?: number; fill?: number } & G) {
  const m = marble();
  const r = useMemo(() => rng(5), []);
  const jars = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ z: -length / 2 + 0.25 + i * 0.32, h: 0.12 + r() * 0.1, c: ["#e8dcc6", "#c69d6a", "#8e7a5c", "#f1ebe0"][i % 4] })), [length, r]);
  return (
    <group {...g}>
      {/* base cabinets with slim brass pulls */}
      <Block size={[0.62, 0.86, length]} position={[0, 0.45, 0]} color={C.sageDark} radius={0.01} rough={0.6} />
      {Array.from({ length: 4 }, (_, i) => (
        <group key={i}>
          <mesh position={[-0.315, 0.45, -length / 2 + length / 8 + (i * length) / 4]}>
            <boxGeometry args={[0.005, 0.82, length / 4 - 0.02]} />
            <meshStandardMaterial color={C.sage} roughness={0.6} />
          </mesh>
          <mesh position={[-0.325, 0.74, -length / 2 + length / 8 + (i * length) / 4]}>
            <boxGeometry args={[0.012, 0.012, 0.16]} />
            <meshStandardMaterial color={C.brass} metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <Block size={[0.66, 0.04, length + 0.02]} position={[-0.02, 0.9, 0]} color="#ffffff" radius={0.006} map={m} rough={0.2} />
      {/* zellige-ish backsplash */}
      <Block size={[0.02, 0.62, length]} position={[0.3, 1.23, 0]} color="#d9cdb8" radius={0.004} rough={0.35} />
      {/* open oak shelves */}
      {[1.5, 1.9].map((y) => (
        <Block key={y} size={[0.28, 0.035, length - 0.1]} position={[0.16, y, 0]} color={C.oakLight} radius={0.005} rough={0.5} />
      ))}
      {/* warm strip under the lower shelf */}
      <mesh position={[0.05, 1.475, 0]}>
        <boxGeometry args={[0.01, 0.008, length - 0.2]} />
        <meshBasicMaterial color={C.warmSoft} toneMapped={false} />
      </mesh>
      {jars.slice(0, Math.round(fill * jars.length)).map((j, i) => (
        <mesh key={i} position={[0.15, 1.52 + j.h / 2, j.z]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, j.h, 16]} />
          <meshStandardMaterial color={j.c} roughness={0.3} transparent opacity={0.92} />
        </mesh>
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={`p${i}`} position={[0.2, 1.92 + 0.12, -0.6 + i * 0.012]} rotation-y={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.012, 32]} />
          <meshStandardMaterial color={i % 2 ? "#ebe4d8" : "#d7cbb8"} roughness={0.4} />
        </mesh>
      ))}
      {[0.35, 0.55, 0.8].map((z, i) => (
        <mesh key={`b${i}`} position={[0.16, 1.92 + 0.07, z]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.07, 0.04, 0.12, 20]} />
          <meshStandardMaterial color={["#b8643f", "#e9e1d3", "#3b3530"][i]} roughness={0.4} />
        </mesh>
      ))}
      {/* sink + tap, coffee machine, kettle, cutting board */}
      <Block size={[0.4, 0.02, 0.5]} position={[-0.05, 0.925, -0.55]} color="#3a3c42" radius={0.01} metal={0.6} rough={0.3} />
      <mesh position={[0.18, 1.05, -0.55]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.26, 8]} />
        <meshStandardMaterial color={C.brass} metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0.08, 1.17, -0.55]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.01, 0.01, 0.2, 8]} />
        <meshStandardMaterial color={C.brass} metalness={0.9} roughness={0.25} />
      </mesh>
      <Block size={[0.28, 0.34, 0.22]} position={[0.1, 1.09, 0.35]} color="#e8e3da" radius={0.03} rough={0.3} />
      <Block size={[0.12, 0.05, 0.14]} position={[-0.04, 1.0, 0.35]} color={C.black} radius={0.01} />
      <Mug position={[-0.08, 0.92, 0.48]} color={C.terracotta} />
      <mesh position={[0.05, 1.0, 0.9]} castShadow>
        <cylinderGeometry args={[0.07, 0.085, 0.17, 20]} />
        <meshStandardMaterial color={C.black} roughness={0.35} metalness={0.3} />
      </mesh>
      <Block size={[0.3, 0.02, 0.42]} position={[-0.1, 0.93, 0.0]} rotation-y={0.1} color={C.oakLight} radius={0.008} />
    </group>
  );
}

/** Integrated fridge column with oak panel. Front faces -X. */
export function Fridge(g: G) {
  return (
    <group {...g}>
      <Block size={[0.66, 2.1, 0.82]} position={[0, 1.05, 0]} color={C.sageDark} radius={0.01} rough={0.6} />
      <mesh position={[-0.335, 1.05, 0]}>
        <boxGeometry args={[0.005, 2.06, 0.005]} />
        <meshStandardMaterial color="#4c5a46" />
      </mesh>
      <mesh position={[-0.345, 1.25, -0.3]}>
        <boxGeometry args={[0.014, 0.5, 0.014]} />
        <meshStandardMaterial color={C.brass} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Fruit bowl. */
export function FruitBowl({ fill = 1, ...g }: { fill?: number } & G) {
  const fruit = [
    { p: [0, 0.07, 0], c: "#e0a030" },
    { p: [0.06, 0.07, 0.03], c: "#c84a2f" },
    { p: [-0.05, 0.07, 0.04], c: "#7aa04a" },
    { p: [0.01, 0.11, -0.04], c: "#e0a030" },
  ] as const;
  return (
    <group {...g}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <sphereGeometry args={[0.13, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color={C.walnut} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      {fruit.slice(0, Math.round(fill * fruit.length)).map((f, i) => (
        <mesh key={i} position={f.p as unknown as [number, number, number]} castShadow>
          <sphereGeometry args={[0.04, 16, 12]} />
          <meshStandardMaterial color={f.c} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/* ================================= LIVING ================================ */

/** Curvy bouclé sofa, faces -Z (toward the windows). ~2.3 m. */
export function Sofa({ color = C.boucle, ...g }: { color?: string } & G) {
  const fab = fabric();
  return (
    <group {...g}>
      <Block size={[2.3, 0.3, 0.95]} position={[0, 0.2, 0]} color={color} radius={0.12} map={fab} rough={1} />
      {[-0.56, 0.56].map((x) => (
        <Block key={x} size={[1.08, 0.16, 0.78]} position={[x, 0.42, -0.07]} color={color} radius={0.08} map={fab} rough={1} />
      ))}
      <Block size={[2.3, 0.52, 0.26]} position={[0, 0.52, 0.36]} color={color} radius={0.13} map={fab} rough={1} />
      {[-1.1, 1.1].map((x) => (
        <Block key={x} size={[0.26, 0.5, 0.95]} position={[x, 0.36, 0]} color={color} radius={0.13} map={fab} rough={1} />
      ))}
      {/* cushions + throw */}
      <Block size={[0.45, 0.42, 0.13]} position={[-0.72, 0.68, 0.18]} rotation={[-0.2, 0.15, 0.08]} color={C.terracotta} radius={0.06} map={fab} rough={1} />
      <Block size={[0.42, 0.4, 0.13]} position={[0.75, 0.67, 0.18]} rotation={[-0.2, -0.2, -0.1]} color={C.sage} radius={0.06} map={fab} rough={1} />
      <Block size={[0.4, 0.38, 0.12]} position={[0.32, 0.64, 0.14]} rotation={[-0.25, 0.1, 0.05]} color="#e8dcc6" radius={0.06} map={fab} rough={1} />
      <Block size={[0.6, 0.05, 0.85]} position={[-0.2, 0.53, -0.05]} rotation-y={0.12} color={C.mustard} radius={0.02} map={fab} rough={1} />
    </group>
  );
}

/** Lounge chair with oak frame and leather-look cushions. Faces +Z. */
export function LoungeChair(g: G) {
  const fab = fabric();
  return (
    <group {...g}>
      {[-0.34, 0.34].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.25, 0]} castShadow>
            <boxGeometry args={[0.04, 0.5, 0.8]} />
            <meshStandardMaterial color={C.oak} roughness={0.5} />
          </mesh>
        </group>
      ))}
      <Block size={[0.66, 0.14, 0.7]} position={[0, 0.33, 0.02]} color="#8a5232" radius={0.05} rough={0.55} />
      <group position={[0, 0.62, -0.3]} rotation-x={-0.3}>
        <Block size={[0.66, 0.55, 0.13]} color="#8a5232" radius={0.06} rough={0.55} />
      </group>
      <Block size={[0.4, 0.05, 0.4]} position={[0.05, 0.43, 0.1]} rotation-y={0.4} color="#e8dcc6" radius={0.02} map={fab} rough={1} />
    </group>
  );
}

/** Round walnut coffee table on a pedestal. */
export function CoffeeTable(g: G) {
  return (
    <group {...g}>
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.04, 48]} />
        <meshStandardMaterial color={C.walnut} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.24, 0.36, 32]} />
        <meshStandardMaterial color={C.walnutDark} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Small side table. */
export function SideTable(g: G) {
  return (
    <group {...g}>
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.03, 32]} />
        <meshStandardMaterial color="#cdbfae" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 12]} />
        <meshStandardMaterial color={C.black} />
      </mesh>
      <mesh position={[0, 0.01, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.02, 24]} />
        <meshStandardMaterial color={C.black} />
      </mesh>
    </group>
  );
}

/** Low media console with a turntable and a speaker. Faces +Z. */
export function RecordConsole(g: G) {
  return (
    <group {...g}>
      <Block size={[1.5, 0.48, 0.42]} position={[0, 0.3, 0]} color={C.walnut} radius={0.012} rough={0.5} />
      {[-0.375, 0.375].map((x) => (
        <mesh key={x} position={[x, 0.3, 0.212]}>
          <boxGeometry args={[0.72, 0.42, 0.005]} />
          <meshStandardMaterial color={C.walnutDark} roughness={0.55} />
        </mesh>
      ))}
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.03, 0]} castShadow>
          <cylinderGeometry args={[0.015, 0.012, 0.06, 8]} />
          <meshStandardMaterial color={C.black} />
        </mesh>
      ))}
      {/* turntable */}
      <Block size={[0.44, 0.08, 0.34]} position={[-0.35, 0.58, 0]} color="#d8cfc2" radius={0.01} />
      <mesh position={[-0.38, 0.625, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.008, 40]} />
        <meshStandardMaterial color="#141414" roughness={0.3} />
      </mesh>
      <mesh position={[-0.38, 0.63, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.003, 24]} />
        <meshStandardMaterial color={C.terracotta} />
      </mesh>
      {/* speaker */}
      <Block size={[0.22, 0.34, 0.22]} position={[0.45, 0.71, 0]} color="#2a2724" radius={0.02} />
      <mesh position={[0.45, 0.7, 0.112]}>
        <circleGeometry args={[0.07, 24]} />
        <meshStandardMaterial color="#3a3632" roughness={1} />
      </mesh>
    </group>
  );
}

/** Open oak bookshelf, faces +Z. 0.9 m wide, 1.8 m tall. */
export function Bookshelf({ children, ...g }: { children?: ReactNode } & G) {
  return (
    <group {...g}>
      {[-0.44, 0.44].map((x) => (
        <Block key={x} size={[0.03, 1.8, 0.32]} position={[x, 0.9, 0]} color={C.oak} radius={0.004} rough={0.5} />
      ))}
      {[0.02, 0.45, 0.9, 1.35, 1.78].map((y) => (
        <Block key={y} size={[0.9, 0.03, 0.32]} position={[0, y, 0]} color={C.oak} radius={0.004} rough={0.5} />
      ))}
      {children}
    </group>
  );
}

/** Sheer linen curtain panel, hanging from y=top, folds along X. */
export function Curtain({ width = 1.2, height = 3.9, color = "#efe6d6", ...g }: { width?: number; height?: number; color?: string } & G) {
  const geo = useMemo(() => {
    const geom = new THREE.PlaneGeometry(width, height, 48, 1);
    const p = geom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / width) * Math.PI * 9) * 0.04);
    geom.computeVertexNormals();
    return geom;
  }, [width, height]);
  return (
    <group {...g}>
      <mesh geometry={geo} position={[0, -height / 2, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={1} transparent opacity={0.78} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
