"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Zone, useGlow } from "../scene/Zone";
import { Character, type Action } from "../characters/Character";
import { GlowLight } from "../scene/lights";
import { BackKitchen, FruitBowl, Fridge, Island, Stool } from "../look/furniture";
import { C, Pendant, Plant } from "../look/decor";
import { useAmbient } from "../ambient";

/**
 * Scripted walk loop: prep at the island → walk to the fridge → grab water → walk back.
 *
 * HOOK (pathfinding): replace these waypoints with navmesh routes:
 *   import { Pathfinding } from "three-pathfinding";
 *   const zone = Pathfinding.createZone(navMeshGeometry);   // bake from a floor GLB
 *   pathfinding.setZoneData("home", zone);
 *   const route = pathfinding.findPath(from, to, "home", groupId);
 */
const ISLAND = new THREE.Vector3(4.6, 0, 1.75);
const FRIDGE = new THREE.Vector3(7.55, 0, 3.35);
const PATH_OUT = [ISLAND, new THREE.Vector3(6.9, 0, 1.8), FRIDGE];
const PATH_BACK = [...PATH_OUT].reverse();
const SPEED = 0.7;

type Step = { kind: "hold"; action: Action; secs: number; face: number } | { kind: "walk"; path: THREE.Vector3[] };
const SCRIPT: Step[] = [
  { kind: "hold", action: "prep", secs: 40, face: 0 },
  { kind: "walk", path: PATH_OUT },
  { kind: "hold", action: "idle", secs: 16, face: Math.PI / 2 },
  { kind: "walk", path: PATH_BACK },
];

function Walker() {
  const root = useRef<THREE.Group>(null);
  const [action, setAction] = useState<Action>("prep");
  const st = useRef({ step: 0, t: 0, seg: 0, segT: 0 });

  useFrame((_, dtRaw) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(dtRaw, 0.1);
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
    s.segT += (dt * SPEED) / a.distanceTo(b);
    if (s.segT >= 1) {
      s.seg++;
      s.segT = 0;
      return;
    }
    g.position.lerpVectors(a, b, s.segT);
    let d = Math.atan2(b.x - a.x, b.z - a.z) - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 8);
  });

  return (
    <group ref={root} position={ISLAND.toArray()}>
      {/* HOOK: <Avatar action={action} outfit="chef" /> */}
      <Character action={action} outfit="chef" />
    </group>
  );
}

/** 🍳 Kitchen: fluted oak island with marble top, oak stools, sage cabinets with open shelves and a warm strip, globe pendants. */
export function Kitchen() {
  const glow = useGlow("kitchen", 1);
  // shelves and fruit bowl empty as the pantry runs low
  const fill = useAmbient((s) => s.pantryFill);
  return (
    <Zone id="kitchen" hitbox={{ size: [4.8, 2.4, 3.8], position: [6.3, 1.2, 2.3] }}>
      <Island position={[4.6, 0, 2.6]} />
      {[3.8, 4.6, 5.4].map((x) => (
        <Stool key={x} position={[x, 0, 3.5]} />
      ))}
      <FruitBowl position={[5.15, 0.93, 2.55]} fill={fill} />
      <Plant kind="herb" position={[3.75, 0.93, 2.45]} scale={1.5} seed={21} pot={C.cream} />
      <Plant kind="herb" position={[3.95, 0.93, 2.7]} scale={1.3} seed={22} pot={C.terracotta} />
      <mesh position={[4.35, 0.94, 2.45]} rotation-y={0.2} castShadow>
        <boxGeometry args={[0.4, 0.025, 0.26]} />
        <meshStandardMaterial color={C.oakLight} roughness={0.6} />
      </mesh>

      <BackKitchen position={[8.45, 0, 1.6]} fill={fill} />
      <Fridge position={[8.45, 0, 3.35]} />
      <Plant kind="olive" position={[8.4, 0, 4.4]} scale={1.0} seed={23} pot={C.cream} />

      {[3.85, 4.6, 5.35].map((x) => (
        <Pendant key={x} position={[x, 2.35, 2.6]} drop={1.85} intensity={2.4 * glow} />
      ))}

      <Walker />

      {/* warm wash from the strip under the shelves onto the counter */}
      <GlowLight position={[8.1, 1.4, 0.9]} color="#ffc27d" intensity={2.6 * glow} distance={2.6} shadow />
      <GlowLight position={[8.1, 1.4, 2.3]} color="#ffc27d" intensity={2.6 * glow} distance={2.6} />
    </Zone>
  );
}
