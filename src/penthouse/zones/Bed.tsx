"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Zone, useGlow } from "../scene/Zone";
import { Character } from "../characters/Character";
import { Bed as BedFrame, Bench, Nightstand } from "../look/furniture";
import { BookStack, C, Candle, Plant, TableLamp, Mug } from "../look/decor";
import { berberRug, fabric } from "../look/textures";

// Lying on the back: local up → world -X (head on the pillows), local front → world +Y (face up).
const LYING = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().set(0, -1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0, 1));

/** 🛏️ Bedroom: upholstered bed against the plaster wall, walnut nightstands with ceramic lamps, rug, bench, plants. */
export function Bed() {
  const glow = useGlow("bed", 1);
  const rot = useMemo(() => [LYING.x, LYING.y, LYING.z] as [number, number, number], []);
  const rug = useMemo(() => berberRug("#e6dccb", "#3b3530"), []);
  const fab = fabric();
  return (
    <Zone id="bed" hitbox={{ size: [3.6, 1.6, 3.4], position: [-7.2, 0.8, -3.4] }}>
      <mesh rotation-x={-Math.PI / 2} rotation-z={Math.PI / 2} position={[-6.7, 0.006, -3.4]} receiveShadow>
        <planeGeometry args={[2.4, 3.4]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <BedFrame position={[-7.55, 0, -3.4]} occupied />

      {/* nightstands + lamps */}
      <Nightstand position={[-8.4, 0, -4.65]} />
      <TableLamp position={[-8.45, 0.55, -4.7]} intensity={4.5 * glow} shadow />
      <BookStack position={[-8.3, 0.55, -4.5]} count={2} seed={6} />
      <Nightstand position={[-8.4, 0, -2.15]} />
      <TableLamp position={[-8.45, 0.55, -2.1]} intensity={2.6 * glow} base={C.sage} />
      <Mug position={[-8.25, 0.55, -2.3]} color={C.terracotta} />

      <Bench position={[-6.05, 0, -3.4]} />
      <Candle position={[-6.05, 0.47, -3.0]} light={0.5} />
      <Plant kind="fiddle" position={[-8.45, 0, -5.55]} scale={1.25} seed={7} pot={C.cream} />
      <Plant kind="snake" position={[-8.5, 0, -1.4]} scale={1.1} seed={8} pot={C.black} />

      {/* ===== IDLE: sub-agent "sleep" resting under the duvet =====
          HOOK: <Character> takes the same props as a future GLB avatar (see characters/Character.tsx) */}
      <Character action="sleep" outfit="sleep" position={[-6.62, 0.72, -3.62]} rotation={rot} speed={0.7} />
      {/* duvet pulled up to the shoulders, with a turned-down sheet */}
      <mesh position={[-6.92, 0.66, -3.62]} rotation-z={Math.PI / 2} scale={[0.75, 1, 1.55]} castShadow receiveShadow>
        <capsuleGeometry args={[0.3, 0.95, 8, 24]} />
        <meshStandardMaterial color="#cdbfae" roughness={1} map={fab} />
      </mesh>
      <mesh position={[-7.66, 0.76, -3.62]} rotation-x={Math.PI / 2} scale={[0.55, 1, 0.4]} castShadow>
        <capsuleGeometry args={[0.18, 0.62, 6, 20]} />
        <meshStandardMaterial color="#efe8dc" roughness={1} map={fab} />
      </mesh>
    </Zone>
  );
}
