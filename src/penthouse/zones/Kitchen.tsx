"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Zone, useGlow } from "../scene/Zone";
import { VoxelModel } from "../voxel/VoxelModel";
import { VoxelCharacter, type Action } from "../characters/VoxelCharacter";
import { GlowLight } from "../scene/lights";
import { backKitchen, island, pendant, stool } from "../models/furniture";

/**
 * Scripted walk loop: prep at the island → walk to the fridge → grab water → walk back.
 *
 * HOOK (pathfinding): replace these waypoints with routes from a navmesh:
 *   import { Pathfinding } from "three-pathfinding";
 *   const zone = Pathfinding.createZone(navMeshGeometry);   // bake from a floor GLB
 *   pathfinding.setZoneData("penthouse", zone);
 *   const route = pathfinding.findPath(from, to, "penthouse", groupId);
 * Then any agent can be sent anywhere ("walk to the bed at 23:00") instead of fixed points.
 */
const ISLAND = new THREE.Vector3(4.6, 0, 1.72);
const FRIDGE = new THREE.Vector3(7.35, 0, 3.15);
const PATH_OUT = [ISLAND, new THREE.Vector3(6.9, 0, 1.75), FRIDGE];
const PATH_BACK = [...PATH_OUT].reverse();
const SPEED = 0.95;

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
      <VoxelCharacter action={action} outfit="chef" />
    </group>
  );
}

/** 🍳 Kitchen: marble island, minimal stools, mini plants, back run with gold under-cabinet LEDs. */
export function Kitchen() {
  const glow = useGlow("kitchen", 1.25);
  return (
    <Zone id="kitchen" hitbox={{ size: [4.8, 2.4, 3.6], position: [6.2, 1.2, 2.2] }}>
      <VoxelModel data={island()} position={[4.6, 0, 2.6]} glow={glow} />
      {[3.75, 4.6, 5.45].map((x) => (
        <VoxelModel key={x} data={stool()} position={[x, 0, 3.55]} />
      ))}
      <VoxelModel data={backKitchen()} position={[8.3, 0, 1.4]} glow={glow * 1.2} />
      {[3.8, 4.6, 5.4].map((x) => (
        <VoxelModel key={x} data={pendant()} position={[x, 2.45, 2.6]} glow={glow * 1.4} castShadow={false} />
      ))}

      <Walker />

      {/* warm gold wash from the under-cabinet strip onto the counter */}
      <GlowLight position={[7.85, 1.5, 0.75]} color="#ffc36b" intensity={5.0 * glow} distance={3.2} shadow />
      <GlowLight position={[7.85, 1.5, 2.1]} color="#ffc36b" intensity={5.0 * glow} distance={3.2} />
      {/* pendants over the island */}
      <GlowLight position={[4.6, 2.2, 2.6]} color="#ffbe7a" intensity={7.5 * glow} distance={5} />
    </Zone>
  );
}
