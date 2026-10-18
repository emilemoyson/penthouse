"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { fabric } from "../look/textures";
import { OUTFITS, type Outfit, type OutfitId } from "./outfits";

export type Action = "sleep" | "type" | "squat" | "stretch" | "cycle" | "walk" | "prep" | "idle";

/** Rig measurements (metres). Feet at y = 0, facing +Z, ~1.8 m tall. */
export const RIG = {
  hipY: 0.92,
  hipX: 0.1,
  thigh: 0.44,
  shin: 0.48, // knee → sole
  shoulderY: 0.47,
  shoulderX: 0.215,
  neckY: 0.55,
  upperArm: 0.28,
};

/* ------------------------------------------------------------------ */
/* geometry built once per outfit                                      */
/* ------------------------------------------------------------------ */

const torsoGeo = new THREE.LatheGeometry(
  [
    [0, 0.0],
    [0.17, 0.0],
    [0.175, 0.06],
    [0.168, 0.16],
    [0.178, 0.28],
    [0.195, 0.38],
    [0.2, 0.43],
    [0.185, 0.48],
    [0.13, 0.52],
    [0.06, 0.54],
    [0, 0.545],
  ].map(([r, y]) => new THREE.Vector2(r, y)),
  40,
);
const hemGeo = new THREE.CylinderGeometry(0.176, 0.174, 0.07, 40, 1, true);
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 8, 16);
const upperSleeveGeo = capsule(0.064, 0.18);
const foreSleeveGeo = capsule(0.056, 0.14);
const cuffGeo = new THREE.CylinderGeometry(0.048, 0.05, 0.045, 24);
const thighGeo = capsule(0.088, 0.3);
const shinGeo = new THREE.CylinderGeometry(0.075, 0.066, 0.3, 24);
const kneeGeo = new THREE.SphereGeometry(0.078, 20, 14);
const ankleCuffGeo = new THREE.CylinderGeometry(0.058, 0.06, 0.05, 24);
const headGeo = new THREE.SphereGeometry(0.12, 40, 32);
const hairCapGeo = new THREE.SphereGeometry(0.128, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);
const eyeGeo = new THREE.SphereGeometry(0.016, 16, 12);
const smileGeo = new THREE.TorusGeometry(0.02, 0.0035, 6, 16, Math.PI * 0.75);

function Mat({ color, rough = 0.9, map, metal = 0, emissive }: { color: string; rough?: number; map?: THREE.Texture; metal?: number; emissive?: string }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} map={map} emissive={emissive} emissiveIntensity={emissive ? 1.5 : 0} />;
}

function Hair({ o }: { o: Outfit }) {
  const style = o.hairStyle ?? "textured";
  const tufts = useMemo(() => {
    if (style !== "textured" && style !== "curly") return [];
    const out: [number, number, number, number][] = [];
    const n = style === "curly" ? 26 : 9;
    for (let i = 0; i < n; i++) {
      if (style === "curly") {
        const a = (i / n) * Math.PI * 2;
        const ring = i % 2 ? 0.08 : 0.05;
        out.push([Math.cos(a) * ring, 0.235 + (i % 3) * 0.008, Math.sin(a) * ring - 0.01, 0.045]);
      } else {
        out.push([-0.075 + i * 0.019, 0.215 - Math.abs(i - 4) * 0.004, 0.085 - Math.abs(i - 4) * 0.004, 0.032]);
      }
    }
    return out;
  }, [style]);

  if (o.beanie) {
    return (
      <group>
        <mesh position={[0, 0.15, -0.005]} scale={[1.04, 1.0, 1.04]} castShadow>
          <sphereGeometry args={[0.128, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <Mat color={o.beanie} rough={1} map={fabric()} />
        </mesh>
        <mesh position={[0, 0.155, -0.005]} rotation-x={Math.PI / 2} scale={[1.04, 1.04, 1]}>
          <torusGeometry args={[0.122, 0.022, 10, 36]} />
          <Mat color={o.beanie} rough={1} />
        </mesh>
        <mesh position={[0, 0.3, -0.01]} castShadow>
          <sphereGeometry args={[0.022, 12, 10]} />
          <Mat color={o.beanie} rough={1} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh geometry={hairCapGeo} position={[0, 0.135, -0.012]} rotation-x={-0.3} castShadow>
        <Mat color={o.hair} rough={0.75} />
      </mesh>
      {/* back of the head */}
      <mesh position={[0, 0.115, -0.045]} scale={[1.02, 0.9, 0.85]}>
        <sphereGeometry args={[0.122, 32, 20, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.45]} />
        <Mat color={o.hair} rough={0.75} />
      </mesh>
      {tufts.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, 0.8, 1]} castShadow>
          <sphereGeometry args={[r, 12, 10]} />
          <Mat color={o.hair} rough={0.75} />
        </mesh>
      ))}
      {style === "bun" && (
        <mesh position={[0, 0.25, -0.07]} castShadow>
          <sphereGeometry args={[0.055, 20, 16]} />
          <Mat color={o.hair} rough={0.75} />
        </mesh>
      )}
    </group>
  );
}

function Head({ o }: { o: Outfit }) {
  const lip = useMemo(() => new THREE.Color(o.skin).lerp(new THREE.Color("#8a3b3b"), 0.55).getStyle(), [o.skin]);
  const blush = useMemo(() => new THREE.Color(o.skin).lerp(new THREE.Color("#ff7a7a"), 0.3).getStyle(), [o.skin]);
  const shade = useMemo(() => new THREE.Color(o.skin).multiplyScalar(0.92).getStyle(), [o.skin]);
  return (
    <group>
      {/* neck */}
      <mesh position={[0, -0.01, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.05, 0.08, 20]} />
        <Mat color={shade} rough={0.6} />
      </mesh>
      <mesh geometry={headGeo} position={[0, 0.13, 0]} scale={[0.96, 1.05, 0.98]} castShadow>
        <Mat color={o.skin} rough={0.6} />
      </mesh>
      {/* ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.113, 0.125, -0.005]} scale={[0.45, 0.95, 0.7]}>
          <sphereGeometry args={[0.028, 14, 10]} />
          <Mat color={shade} rough={0.6} />
        </mesh>
      ))}
      {/* eyes with a catch-light */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.041, 0.138, 0.105]}>
          <mesh geometry={eyeGeo} scale={[0.85, 1.15, 0.45]}>
            <meshStandardMaterial color="#1a1412" roughness={0.3} />
          </mesh>
          <mesh position={[0.005, 0.006, 0.007]}>
            <sphereGeometry args={[0.0045, 8, 6]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
      {/* brows */}
      {[-1, 1].map((s) => (
        <mesh key={`b${s}`} position={[s * 0.043, 0.172, 0.108]} rotation-z={s * -0.12} rotation-x={-0.25}>
          <capsuleGeometry args={[0.005, 0.026, 4, 8]} />
          <Mat color={o.hair} rough={0.8} />
        </mesh>
      ))}
      {/* nose, smile, cheeks */}
      <mesh position={[0, 0.112, 0.117]} scale={[0.9, 1, 1]}>
        <sphereGeometry args={[0.013, 12, 10]} />
        <Mat color={shade} rough={0.6} />
      </mesh>
      <mesh geometry={smileGeo} position={[0, 0.09, 0.108]} rotation={[-0.2, 0, Math.PI + Math.PI * 0.125]}>
        <meshStandardMaterial color={lip} roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`c${s}`} position={[s * 0.07, 0.1, 0.092]} rotation-y={s * 0.55}>
          <circleGeometry args={[0.016, 16]} />
          <meshStandardMaterial color={blush} roughness={1} transparent opacity={0.6} />
        </mesh>
      ))}
      <Hair o={o} />
    </group>
  );
}

function Torso({ o }: { o: Outfit }) {
  const fab = fabric();
  const pocket = useMemo(() => new THREE.Color(o.hoodie).multiplyScalar(0.93).getStyle(), [o.hoodie]);
  return (
    <group>
      <mesh geometry={torsoGeo} scale={[1, 1, 0.64]} castShadow receiveShadow>
        <Mat color={o.hoodie} rough={1} map={fab} />
      </mesh>
      {/* ribbed hem */}
      <mesh geometry={hemGeo} position={[0, 0.03, 0]} scale={[1.01, 1, 0.65]} castShadow>
        <Mat color={o.hoodieTrim} rough={1} map={fab} />
      </mesh>
      {/* kangaroo pocket */}
      <RoundedBox args={[0.22, 0.12, 0.03]} radius={0.012} position={[0, 0.17, 0.104]} castShadow>
        <Mat color={pocket} rough={1} map={fab} />
      </RoundedBox>
      {/* hood bunched round the neck */}
      <mesh position={[0, 0.52, -0.015]} rotation-x={Math.PI / 2} scale={[1, 0.8, 1]} castShadow>
        <torusGeometry args={[0.085, 0.038, 14, 32]} />
        <Mat color={o.hoodie} rough={1} map={fab} />
      </mesh>
      <mesh position={[0, 0.46, -0.105]} scale={[0.15, 0.11, 0.06]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        <Mat color={o.hoodieTrim} rough={1} map={fab} />
      </mesh>
      {/* drawstrings with aglets */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.033, 0.4, 0.13]} rotation-z={s * 0.06}>
          <mesh>
            <cylinderGeometry args={[0.0045, 0.0045, 0.13, 6]} />
            <Mat color={o.strings} rough={0.8} />
          </mesh>
          <mesh position={[0, -0.075, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.022, 6]} />
            <Mat color={o.strings} rough={0.4} metal={0.3} />
          </mesh>
        </group>
      ))}
      {/* small chest logo */}
      <mesh position={[0.08, 0.36, 0.125]} rotation-y={0.2}>
        <circleGeometry args={[0.014, 16]} />
        <meshStandardMaterial color={o.logo} roughness={0.8} />
      </mesh>
      {/* headphones round the neck */}
      {o.headphones && (
        <group position={[0, 0.535, 0.01]}>
          <mesh rotation-x={Math.PI / 2 - 0.25}>
            <torusGeometry args={[0.1, 0.012, 10, 36]} />
            <Mat color={o.headphones} rough={0.4} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.088, -0.025, 0.055]} rotation-z={s * 0.4}>
              <mesh rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.038, 0.038, 0.03, 24]} />
                <Mat color={o.headphones!} rough={0.4} />
              </mesh>
              {o.headphonesGlow && (
                <mesh position={[s * 0.016, 0, 0]} rotation-y={(s * Math.PI) / 2}>
                  <ringGeometry args={[0.02, 0.025, 20]} />
                  <meshBasicMaterial color={o.headphonesGlow} toneMapped={false} />
                </mesh>
              )}
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

function UpperArm({ o }: { o: Outfit }) {
  return (
    <mesh geometry={upperSleeveGeo} position={[0, -0.13, 0]} castShadow>
      <Mat color={o.hoodie} rough={1} map={fabric()} />
    </mesh>
  );
}

function ForeArm({ o }: { o: Outfit }) {
  return (
    <group>
      <mesh geometry={foreSleeveGeo} position={[0, -0.09, 0]} castShadow>
        <Mat color={o.hoodie} rough={1} map={fabric()} />
      </mesh>
      <mesh geometry={cuffGeo} position={[0, -0.2, 0]} castShadow>
        <Mat color={o.hoodieTrim} rough={1} />
      </mesh>
      {/* hand */}
      <RoundedBox args={[0.055, 0.075, 0.03]} radius={0.014} position={[0, -0.265, 0.004]} castShadow>
        <Mat color={o.skin} rough={0.6} />
      </RoundedBox>
      <mesh position={[0, -0.255, 0.028]} rotation-x={0.6}>
        <capsuleGeometry args={[0.009, 0.025, 4, 8]} />
        <Mat color={o.skin} rough={0.6} />
      </mesh>
    </group>
  );
}

function Thigh({ o }: { o: Outfit }) {
  return (
    <mesh geometry={thighGeo} position={[0, -0.2, 0]} castShadow>
      <Mat color={o.pants} rough={1} map={fabric()} />
    </mesh>
  );
}

function Shin({ o }: { o: Outfit }) {
  const fab = fabric();
  return (
    <group>
      <mesh geometry={kneeGeo} position={[0, 0, 0]}>
        <Mat color={o.pants} rough={1} map={fab} />
      </mesh>
      <mesh geometry={shinGeo} position={[0, -0.16, 0]} castShadow>
        <Mat color={o.pants} rough={1} map={fab} />
      </mesh>
      <mesh geometry={ankleCuffGeo} position={[0, -0.33, 0]} castShadow>
        <Mat color={o.pantsCuff} rough={1} map={fab} />
      </mesh>
      <mesh position={[0, -0.375, 0]}>
        <cylinderGeometry args={[0.042, 0.042, 0.04, 16]} />
        <Mat color="#efece6" rough={1} />
      </mesh>
      {/* sneaker: upper, toe box, sole, laces, side stripe, heel tab */}
      <group position={[0, -0.43, 0.04]}>
        <RoundedBox args={[0.105, 0.075, 0.26]} radius={0.034} castShadow>
          <Mat color={o.shoe} rough={0.55} />
        </RoundedBox>
        <RoundedBox args={[0.115, 0.03, 0.28]} radius={0.012} position={[0, -0.04, 0.005]} castShadow>
          <Mat color={o.sole} rough={0.7} />
        </RoundedBox>
        {[0.02, 0.05, 0.08].map((z) => (
          <mesh key={z} position={[0, 0.04, z]}>
            <boxGeometry args={[0.06, 0.006, 0.008]} />
            <Mat color={o.strings === o.shoe ? "#d8d4cc" : "#f4f1ea"} rough={0.7} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.054, -0.005, 0.01]} rotation-y={(s * Math.PI) / 2} rotation-z={0.25}>
            <planeGeometry args={[0.14, 0.018]} />
            <meshStandardMaterial color={o.shoeAccent} roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <mesh position={[0, 0.03, -0.128]}>
          <boxGeometry args={[0.04, 0.04, 0.01]} />
          <Mat color={o.shoeAccent} rough={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Stylised character: oversized hoodie with hood + drawstrings + pocket, loose joggers with cuffs,
 * chunky sneakers, a face with catch-lit eyes, and a few hair styles. Driven by a joint rig.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │ HOOK: swap in a rigged GLB (Mixamo / VRoid / your own Blender model)          │
 * │   const { scene, animations } = useGLTF("/models/emile.glb");                 │
 * │   const { actions } = useAnimations(animations, root);                        │
 * │   useEffect(() => { const a = actions[CLIPS[action]];                         │
 * │     a?.reset().fadeIn(0.35).play(); return () => void a?.fadeOut(0.35); },     │
 * │     [action]);                                                                │
 * │   return <primitive ref={root} object={scene} />;                             │
 * │ Export feet at y = 0, facing +Z, ~1.8 units tall; keep these props.            │
 * └──────────────────────────────────────────────────────────────────────────────┘
 */
export function Character({
  action,
  outfit = "emile",
  position,
  rotation,
  speed = 1,
}: {
  action: Action;
  outfit?: OutfitId;
  position?: [number, number, number];
  rotation?: [number, number, number];
  speed?: number;
}) {
  const o = OUTFITS[outfit] as Outfit;
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const seed = useMemo(() => Math.random() * 10, []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime * speed + seed;
    const k = Math.min(1, dt * 8);
    const set = (g: THREE.Group | null, x: number, z = 0, y = 0) => {
      if (!g) return;
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, x, k);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, y, k);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, z, k);
    };
    const hipY = (y: number) => hips.current && (hips.current.position.y = THREE.MathUtils.lerp(hips.current.position.y, y, k));
    const H = RIG.hipY;
    const breathe = 1 + Math.sin(t * 1.4) * 0.008;
    if (torso.current) torso.current.scale.set(1, breathe, 1);

    switch (action) {
      case "sleep": {
        hipY(H);
        set(torso.current, 0);
        set(head.current, 0.05, 0.25, 0.25);
        set(armL.current, 0, 0.12);
        set(armR.current, 0, -0.12);
        set(foreL.current, -0.2);
        set(foreR.current, -0.2);
        set(legL.current, 0, 0.04);
        set(legR.current, 0, -0.04);
        set(shinL.current, 0);
        set(shinR.current, 0);
        if (torso.current) torso.current.scale.set(1, 1, 1 + (Math.sin(t * 0.9) * 0.5 + 0.5) * 0.04);
        break;
      }
      case "type": {
        hipY(0.53);
        set(torso.current, 0.1);
        set(head.current, 0.08 + Math.sin(t * 0.7) * 0.04, 0, Math.sin(t * 0.33) * 0.12);
        set(armL.current, -0.55, 0.16);
        set(armR.current, -0.55, -0.16);
        set(foreL.current, -1.05 + Math.sin(t * 10) * 0.05);
        set(foreR.current, -1.05 + Math.sin(t * 10 + 1.7) * 0.05);
        set(legL.current, -Math.PI / 2, 0.08);
        set(legR.current, -Math.PI / 2, -0.08);
        set(shinL.current, Math.PI / 2);
        set(shinR.current, Math.PI / 2);
        break;
      }
      case "squat": {
        const d = (1 - Math.cos(t * 2.1)) / 2;
        const a = d * 1.1;
        hipY(RIG.thigh * Math.cos(a) + RIG.shin * Math.cos(a) + 0.005);
        set(torso.current, a * 0.5);
        set(head.current, -a * 0.35);
        set(armL.current, -1.4, 0.12);
        set(armR.current, -1.4, -0.12);
        set(foreL.current, -0.8);
        set(foreR.current, -0.8);
        set(legL.current, -a, 0.1);
        set(legR.current, -a, -0.1);
        set(shinL.current, 2 * a);
        set(shinR.current, 2 * a);
        break;
      }
      case "stretch": {
        const s = Math.sin(t * 0.8);
        hipY(H);
        set(torso.current, 0, s * 0.28);
        set(head.current, 0, s * 0.15);
        set(armL.current, 0, 2.7 + s * 0.15);
        set(armR.current, 0, -2.7 + s * 0.15);
        set(foreL.current, 0);
        set(foreR.current, 0);
        set(legL.current, 0, 0.14);
        set(legR.current, 0, -0.14);
        set(shinL.current, 0);
        set(shinR.current, 0);
        break;
      }
      case "cycle": {
        const p = t * 5;
        hipY(H - 0.02);
        set(torso.current, 0.55);
        set(head.current, -0.35);
        set(armL.current, -1.15, 0.1);
        set(armR.current, -1.15, -0.1);
        set(foreL.current, -0.25);
        set(foreR.current, -0.25);
        set(legL.current, -1.05 + Math.sin(p) * 0.45);
        set(legR.current, -1.05 - Math.sin(p) * 0.45);
        set(shinL.current, 1.2 - Math.cos(p) * 0.45);
        set(shinR.current, 1.2 + Math.cos(p) * 0.45);
        break;
      }
      case "walk": {
        const w = Math.sin(t * 6);
        hipY(H + Math.abs(Math.cos(t * 6)) * 0.025);
        set(torso.current, 0.04, w * 0.03, w * 0.05);
        set(head.current, 0, 0, -w * 0.04);
        set(armL.current, w * 0.5, 0.08);
        set(armR.current, -w * 0.5, -0.08);
        set(foreL.current, -0.3);
        set(foreR.current, -0.3);
        set(legL.current, -w * 0.5);
        set(legR.current, w * 0.5);
        set(shinL.current, Math.max(0, w) * 0.75);
        set(shinR.current, Math.max(0, -w) * 0.75);
        break;
      }
      case "prep": {
        hipY(H);
        set(torso.current, 0.25);
        set(head.current, 0.4);
        set(armL.current, -0.95, 0.22);
        set(armR.current, -0.95 + Math.sin(t * 6) * 0.15, -0.22);
        set(foreL.current, -0.75);
        set(foreR.current, -0.75 + Math.sin(t * 6) * 0.25);
        set(legL.current, 0, 0.06);
        set(legR.current, 0, -0.06);
        set(shinL.current, 0);
        set(shinR.current, 0);
        break;
      }
      default: {
        const b = Math.sin(t * 1.2);
        hipY(H + b * 0.004);
        set(torso.current, b * 0.015);
        set(head.current, 0, 0, Math.sin(t * 0.4) * 0.2);
        set(armL.current, 0, 0.08);
        set(armR.current, 0, -0.08);
        [foreL, foreR, legL, legR, shinL, shinR].forEach((r) => set(r.current, 0));
      }
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <group ref={hips} position={[0, RIG.hipY, 0]}>
        <group ref={torso}>
          <Torso o={o} />
          <group ref={head} position={[0, RIG.neckY, 0]}>
            <Head o={o} />
          </group>
          {(
            [
              [armL, foreL, RIG.shoulderX],
              [armR, foreR, -RIG.shoulderX],
            ] as const
          ).map(([arm, fore, x], i) => (
            <group key={i} ref={arm} position={[x, RIG.shoulderY, 0]}>
              <UpperArm o={o} />
              <group ref={fore} position={[0, -RIG.upperArm, 0]}>
                <ForeArm o={o} />
              </group>
            </group>
          ))}
        </group>
        {(
          [
            [legL, shinL, RIG.hipX],
            [legR, shinR, -RIG.hipX],
          ] as const
        ).map(([leg, shin, x], i) => (
          <group key={i} ref={leg} position={[x, 0, 0]}>
            <Thigh o={o} />
            <group ref={shin} position={[0, -RIG.thigh, 0]}>
              <Shin o={o} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}
