"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { Zone, useGlow } from "../scene/Zone";
import { Character, type Action } from "../scene/Character";

/**
 * Scripted walk loop: prep at the island → walk to the fridge → grab water → walk back.
 *
 * HOOK (pathfinding): replace PATH with routes from a navmesh, e.g.
 *   import { Pathfinding } from "three-pathfinding";
 *   const path = pathfinding.findPath(from, to, ZONE_ID, groupId);
 * Bake the navmesh from a simplified floor GLB in Blender, then let any zone
 * request a route ("walk to the bed at 23:00") instead of these fixed points.
 */
const ISLAND = new THREE.Vector3(4.6, 0, 1.78);
const FRIDGE = new THREE.Vector3(7.75, 0, 4.25);
const PATH_OUT = [ISLAND, new THREE.Vector3(6.6, 0, 1.9), new THREE.Vector3(7.75, 0, 3.4), FRIDGE];
const PATH_BACK = [...PATH_OUT].reverse();
const SPEED = 1.0; // m/s

type Step = { kind: "hold"; action: Action; secs: number; face: number } | { kind: "walk"; path: THREE.Vector3[] };
const SCRIPT: Step[] = [
  { kind: "hold", action: "prep", secs: 7, face: 0 },
  { kind: "walk", path: PATH_OUT },
  { kind: "hold", action: "idle", secs: 2.5, face: Math.PI / 2 },
  { kind: "walk", path: PATH_BACK },
];

function Walker() {
  const root = useRef<THREE.Group>(null);
  const [action, setAction] = useState<Action>("prep");
  const st = useRef({ step: 0, t: 0, seg: 0, segT: 0 });

  useFrame((_, dtRaw) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    const step = SCRIPT[s.step];
    const next = () => {
      s.step = (s.step + 1) % SCRIPT.length;
      s.t = 0;
      s.seg = 0;
      s.segT = 0;
      const n = SCRIPT[s.step];
      setAction(n.kind === "walk" ? "walk" : n.action);
    };
    if (step.kind === "hold") {
      s.t += dt;
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, step.face, 6, dt);
      if (s.t >= step.secs) next();
      return;
    }
    const a = step.path[s.seg];
    const b = step.path[s.seg + 1];
    if (!b) return next();
    const len = a.distanceTo(b);
    s.segT += (dt * SPEED) / len;
    if (s.segT >= 1) {
      s.seg++;
      s.segT = 0;
      return;
    }
    g.position.lerpVectors(a, b, s.segT);
    const heading = Math.atan2(b.x - a.x, b.z - a.z);
    let d = heading - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 8);
  });

  return (
    <group ref={root} position={ISLAND.toArray()}>
      {/* HOOK: replace with <Avatar action={action} /> */}
      <Character action={action} tint="#03241a" />
    </group>
  );
}

export function Kitchen() {
  const glow = useGlow("kitchen", 1.3);
  return (
    <Zone id="kitchen" hitbox={{ size: [4.6, 2.2, 3.4], position: [6.2, 1.1, 3.0] }}>
      <group>
        {/* island */}
        <RoundedBox args={[2.6, 0.9, 0.95]} radius={0.03} position={[4.6, 0.45, 2.6]} castShadow receiveShadow>
          <meshStandardMaterial color="#1b1922" roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[2.75, 0.06, 1.05]} radius={0.02} position={[4.6, 0.93, 2.6]} castShadow receiveShadow>
          <meshStandardMaterial color="#cfcad6" roughness={0.18} metalness={0.1} />
        </RoundedBox>
        {/* toe-kick glow */}
        <mesh position={[4.6, 0.03, 3.1]}>
          <boxGeometry args={[2.5, 0.015, 0.015]} />
          <meshBasicMaterial color="#23b58a" toneMapped={false} />
        </mesh>
        {/* cutting board + bowl */}
        <mesh position={[4.45, 0.975, 2.5]} castShadow>
          <boxGeometry args={[0.5, 0.025, 0.32]} />
          <meshStandardMaterial color="#7a5a3e" roughness={0.8} />
        </mesh>
        <mesh position={[5.1, 1.0, 2.65]} castShadow>
          <sphereGeometry args={[0.13, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color="#e8e2ea" roughness={0.4} side={THREE.DoubleSide} />
        </mesh>

        {/* stools */}
        {[3.8, 4.6, 5.4].map((x) => (
          <group key={x} position={[x, 0, 3.45]}>
            <mesh position={[0, 0.66, 0]} castShadow>
              <cylinderGeometry args={[0.19, 0.19, 0.06, 20]} />
              <meshStandardMaterial color="#2c2836" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.33, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.66, 8]} />
              <meshStandardMaterial color="#888" metalness={0.9} roughness={0.25} />
            </mesh>
          </group>
        ))}

        {/* back counter + fridge along the right edge */}
        <RoundedBox args={[0.7, 0.92, 2.6]} radius={0.02} position={[8.55, 0.46, 1.6]} castShadow receiveShadow>
          <meshStandardMaterial color="#1b1922" roughness={0.6} />
        </RoundedBox>
        <mesh position={[8.55, 0.94, 1.6]}>
          <boxGeometry args={[0.74, 0.05, 2.64]} />
          <meshStandardMaterial color="#cfcad6" roughness={0.18} />
        </mesh>
        <RoundedBox args={[0.8, 2.1, 0.85]} radius={0.04} position={[8.5, 1.05, 4.4]} castShadow>
          <meshStandardMaterial color="#2a2833" metalness={0.65} roughness={0.3} />
        </RoundedBox>

        {/* pendant lights */}
        {[3.8, 4.6, 5.4].map((x) => (
          <group key={x} position={[x, 0, 2.6]}>
            <mesh position={[0, 3.35, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 1.7, 4]} />
              <meshBasicMaterial color="#333" />
            </mesh>
            <mesh position={[0, 2.45, 0]}>
              <sphereGeometry args={[0.1, 20, 16]} />
              <meshStandardMaterial color="#ffe0b0" emissive="#ffc070" emissiveIntensity={2.4 * glow} toneMapped={false} />
            </mesh>
          </group>
        ))}
        <pointLight position={[4.6, 2.2, 2.6]} color="#ffbe7a" intensity={7 * glow} distance={5.5} decay={2} />
        <pointLight position={[7.6, 1.6, 3.4]} color="#23b58a" intensity={1.6 * glow} distance={4} decay={2} />

        {/* ===== IDLE: character prepping / getting water ===== */}
        <Walker />
      </group>
    </Zone>
  );
}
