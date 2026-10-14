"use client";

import { useEffect, useState } from "react";
import { RoundedBox } from "@react-three/drei";
import { Zone, useGlow } from "../scene/Zone";
import { Character, type Action } from "../scene/Character";

function Plate({ x }: { x: number }) {
  return (
    <mesh position={[x, 0, 0]} rotation-z={Math.PI / 2} castShadow>
      <cylinderGeometry args={[0.22, 0.22, 0.05, 24]} />
      <meshStandardMaterial color="#141418" roughness={0.6} metalness={0.3} />
    </mesh>
  );
}

export function Gym() {
  const glow = useGlow("gym", 1.3);
  // alternate between squats and a stretch every few reps
  const [action, setAction] = useState<Action>("squat");
  useEffect(() => {
    const id = setInterval(() => setAction((a) => (a === "squat" ? "stretch" : "squat")), 9000);
    return () => clearInterval(id);
  }, []);

  return (
    <Zone id="gym" hitbox={{ size: [3.8, 2.4, 3.2], position: [-5.6, 1.2, 3] }}>
      <group>
        {/* rubber floor */}
        <mesh rotation-x={-Math.PI / 2} position={[-5.6, 0.015, 3]} receiveShadow>
          <planeGeometry args={[3.6, 3]} />
          <meshStandardMaterial color="#121115" roughness={1} />
        </mesh>
        {/* yoga mat */}
        <mesh rotation-x={-Math.PI / 2} position={[-4.25, 0.025, 3.35]} receiveShadow>
          <planeGeometry args={[0.7, 1.8]} />
          <meshStandardMaterial color="#4a3c86" roughness={0.9} />
        </mesh>

        {/* squat rack */}
        <group position={[-6.4, 0, 2.6]}>
          {[
            [-0.6, -0.5],
            [0.6, -0.5],
            [-0.6, 0.5],
            [0.6, 0.5],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 1.15, z]} castShadow>
              <boxGeometry args={[0.07, 2.3, 0.07]} />
              <meshStandardMaterial color="#2a2833" metalness={0.75} roughness={0.35} />
            </mesh>
          ))}
          {[-0.5, 0.5].map((z) => (
            <mesh key={z} position={[0, 2.28, z]}>
              <boxGeometry args={[1.27, 0.07, 0.07]} />
              <meshStandardMaterial color="#2a2833" metalness={0.75} roughness={0.35} />
            </mesh>
          ))}
          {/* barbell on hooks */}
          <group position={[0, 1.42, -0.5]}>
            <mesh rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 2.0, 8]} />
              <meshStandardMaterial color="#b9b9c4" metalness={0.95} roughness={0.2} />
            </mesh>
            <Plate x={-0.82} />
            <Plate x={-0.76} />
            <Plate x={0.76} />
            <Plate x={0.82} />
          </group>
        </group>

        {/* bench */}
        <RoundedBox args={[0.35, 0.1, 1.2]} radius={0.03} position={[-6.4, 0.45, 2.75]} castShadow>
          <meshStandardMaterial color="#26222f" roughness={0.8} />
        </RoundedBox>
        <mesh position={[-6.4, 0.2, 2.75]}>
          <boxGeometry args={[0.08, 0.4, 0.9]} />
          <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* dumbbell rack against the wall */}
        <group position={[-8.55, 0, 3.5]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[0.5, 0.06, 1.6]} />
            <meshStandardMaterial color="#25232c" metalness={0.5} roughness={0.5} />
          </mesh>
          {[-0.6, -0.3, 0, 0.3, 0.6].map((z, i) => (
            <mesh key={z} position={[0, 0.45, z]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.06 + i * 0.008, 0.06 + i * 0.008, 0.3, 12]} />
              <meshStandardMaterial color="#141418" metalness={0.4} roughness={0.5} />
            </mesh>
          ))}
        </group>

        {/* neon ring on the wall */}
        <mesh position={[-8.97, 2.4, 2.7]} rotation-y={Math.PI / 2}>
          <torusGeometry args={[0.55, 0.025, 12, 64]} />
          <meshBasicMaterial color="#a48cff" toneMapped={false} />
        </mesh>
        <pointLight position={[-8.3, 2.4, 2.7]} color="#8a6bff" intensity={4 * glow} distance={6} decay={2} />
        <pointLight position={[-5.0, 3.2, 3.4]} color="#9b84ff" intensity={9 * glow} distance={7} decay={2} />

        {/* ===== IDLE: workout loop ===== */}
        {/* HOOK: replace with <Avatar action={action} .../> (Mixamo "Air Squat" / "Stretching" clips work well) */}
        <Character action={action} position={[-4.25, 0.03, 3.35]} rotation={[0, 0.55, 0]} tint="#160a30" />
      </group>
    </Zone>
  );
}
