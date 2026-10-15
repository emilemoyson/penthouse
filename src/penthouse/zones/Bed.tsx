"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Zone, useGlow } from "../scene/Zone";
import { VoxelModel } from "../voxel/VoxelModel";
import { VoxelCharacter } from "../characters/VoxelCharacter";
import { GlowLight } from "../scene/lights";
import { bed, nightstand } from "../models/furniture";

// Lying on the back: local up → world -X (head on the pillows), local front → world +Y (face up).
const LYING = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().set(0, -1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0, 1));

/** 🛏️ Sleeping quarters: low platform bed against the left wall, amber lamp, recovery agent asleep. */
export function Bed() {
  const glow = useGlow("bed", 1.25);
  const rot = useMemo(() => [LYING.x, LYING.y, LYING.z] as [number, number, number], []);
  return (
    <Zone id="bed" hitbox={{ size: [3.2, 1.5, 3.0], position: [-7.3, 0.75, -3.4] }}>
      <VoxelModel data={bed()} position={[-7.4, 0, -3.4]} glow={glow} />
      <VoxelModel data={nightstand()} position={[-8.35, 0, -5.15]} glow={glow * 1.2} />

      {/* ===== IDLE: sub-agent "sleep" resting =====
          HOOK: <VoxelCharacter> takes the same props as your future GLB avatar (see characters/VoxelCharacter.tsx) */}
      <VoxelCharacter action="sleep" outfit="sleep" position={[-6.86, 0.66, -3.62]} rotation={rot} speed={0.7} />

      {/* warm amber key light from the lamp, casting soft shadows across the blanket */}
      <GlowLight position={[-8.3, 1.25, -4.85]} color="#ffa64d" intensity={8.8 * glow} distance={6} shadow />
      <GlowLight position={[-7.4, 0.15, -3.4]} color="#ff9a3c" intensity={1.8 * glow} distance={2.2} />
    </Zone>
  );
}
