"use client";

import { Zone, useGlow } from "../scene/Zone";
import { VoxelModel } from "../voxel/VoxelModel";
import { VoxelCharacter } from "../characters/VoxelCharacter";
import { GlowLight } from "../scene/lights";
import { chair, desk } from "../models/furniture";

/** 🖥️ Office: walnut desk, ultrawide, mechanical keyboard, laptop, ergonomic chair. Emile at work. */
export function Desk() {
  const glow = useGlow("desk", 1.15);
  return (
    <Zone id="desk" hitbox={{ size: [2.6, 1.8, 2.2], position: [4.6, 0.9, -4.2] }}>
      <VoxelModel data={desk()} position={[4.6, 0, -4.75]} glow={glow} />
      <VoxelModel data={chair()} position={[4.6, 0, -3.72]} />

      {/* ===== IDLE: you, working =====
          HOOK: swap for <Avatar url="/models/emile-voxel.glb" action="type" /> */}
      <VoxelCharacter action="type" outfit="emile" position={[4.6, 0, -3.76]} rotation={[0, Math.PI, 0]} />

      {/* soft neon cyan from the monitors */}
      <GlowLight position={[4.6, 1.35, -4.85]} color="#47dcff" intensity={8.7 * glow} distance={5} shadow />
      <GlowLight position={[5.3, 1.0, -4.6]} color="#7fb6ff" intensity={2.0 * glow} distance={2} />
    </Zone>
  );
}
