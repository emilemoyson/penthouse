"use client";

import { useEffect, useState } from "react";
import { Zone, useGlow } from "../scene/Zone";
import { VoxelModel } from "../voxel/VoxelModel";
import { VoxelCharacter, type Action } from "../characters/VoxelCharacter";
import { GlowLight } from "../scene/lights";
import { bike, dumbbellRack, gymSmalls, yogaMat } from "../models/furniture";

/** 🏋️ Gym corner: yoga mat, dumbbell rack, indoor bike. Coach agent loops squats and stretches. */
export function Gym() {
  const glow = useGlow("gym", 1.3);
  const [action, setAction] = useState<Action>("squat");
  useEffect(() => {
    const id = setInterval(() => setAction((a) => (a === "squat" ? "stretch" : "squat")), 9000);
    return () => clearInterval(id);
  }, []);

  return (
    <Zone id="gym" hitbox={{ size: [4.2, 2.4, 3.4], position: [-6.4, 1.2, 3.1] }}>
      <VoxelModel data={yogaMat()} position={[-4.6, 0.005, 3.3]} />
      <VoxelModel data={dumbbellRack()} position={[-8.45, 0, 2.7]} />
      <VoxelModel data={bike()} position={[-6.7, 0, 4.4]} rotation={[0, Math.PI / 2, 0]} glow={glow} />
      <VoxelModel data={gymSmalls()} position={[-6.6, 0, 1.75]} />

      {/* neon ring on the wall */}
      <mesh position={[-8.97, 2.45, 2.7]} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.5, 0.03, 6, 48]} />
        <meshBasicMaterial color="#a48cff" toneMapped={false} />
      </mesh>

      {/* ===== IDLE: sub-agent "coach" training =====
          HOOK: Mixamo "Air Squat" / "Stretching" clips map straight onto these actions */}
      <VoxelCharacter action={action} outfit="coach" position={[-4.6, 0.02, 3.2]} rotation={[0, 0.6, 0]} />

      <GlowLight position={[-8.3, 2.4, 2.7]} color="#8a6bff" intensity={4.8 * glow} distance={6} />
      <GlowLight position={[-3.6, 2.2, 4.6]} color="#c9b8ff" intensity={3 * glow} distance={4} />
      <GlowLight position={[-5.2, 3.1, 3.4]} color="#9b84ff" intensity={8.4 * glow} distance={7} shadow />
    </Zone>
  );
}
