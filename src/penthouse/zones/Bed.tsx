"use client";

import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { Zone, useGlow } from "../scene/Zone";
import { Character } from "../scene/Character";

// Mannequin lying on its back: local up → world -X (head to the headboard), local forward → world +Y (face up).
const LYING = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().set(0, -1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0, 1));

export function Bed() {
  const glow = useGlow("bed", 1.4);
  const rot = useMemo(() => [LYING.x, LYING.y, LYING.z] as [number, number, number], []);
  return (
    <Zone id="bed" hitbox={{ size: [3.4, 1.4, 3.2], position: [-6.2, 0.7, -3.4] }}>
      <group>
        {/* platform + frame */}
        <RoundedBox args={[2.8, 0.32, 2.2]} radius={0.06} position={[-6.2, 0.16, -3.4]} castShadow receiveShadow>
          <meshStandardMaterial color="#1c1924" roughness={0.7} />
        </RoundedBox>
        {/* under-bed LED */}
        <mesh position={[-6.2, 0.02, -3.4]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[2.9, 2.3]} />
          <meshBasicMaterial color="#f2a53a" transparent opacity={0.12 * glow} toneMapped={false} />
        </mesh>
        {/* mattress */}
        <RoundedBox args={[2.6, 0.28, 2.0]} radius={0.1} position={[-6.15, 0.46, -3.4]} castShadow receiveShadow>
          <meshStandardMaterial color="#d6d0dc" roughness={0.95} />
        </RoundedBox>
        {/* headboard */}
        <RoundedBox args={[0.18, 1.2, 2.3]} radius={0.06} position={[-7.55, 0.75, -3.4]} castShadow>
          <meshStandardMaterial color="#2a2434" roughness={0.9} />
        </RoundedBox>
        <mesh position={[-7.66, 1.38, -3.4]}>
          <boxGeometry args={[0.02, 0.03, 2.2]} />
          <meshBasicMaterial color="#ffb45c" toneMapped={false} />
        </mesh>
        {/* pillows */}
        <RoundedBox args={[0.45, 0.16, 0.8]} radius={0.07} position={[-7.15, 0.67, -3.85]} castShadow>
          <meshStandardMaterial color="#efeaf2" roughness={1} />
        </RoundedBox>
        <RoundedBox args={[0.45, 0.16, 0.8]} radius={0.07} position={[-7.15, 0.67, -2.95]}>
          <meshStandardMaterial color="#efeaf2" roughness={1} />
        </RoundedBox>

        {/* ===== IDLE: character resting ===== */}
        {/* HOOK: replace with <Avatar action="sleep" .../> (see scene/Character.tsx) */}
        <Character action="sleep" position={[-5.25, 0.78, -3.7]} rotation={rot} speed={0.6} tint="#2a1a08" />

        {/* blanket over the legs */}
        <RoundedBox args={[1.55, 0.14, 2.04]} radius={0.06} position={[-5.62, 0.72, -3.4]} castShadow>
          <meshStandardMaterial color="#5a3d6e" roughness={1} />
        </RoundedBox>

        {/* nightstand + lamp */}
        <RoundedBox args={[0.55, 0.55, 0.5]} radius={0.04} position={[-7.2, 0.28, -5.0]} castShadow>
          <meshStandardMaterial color="#201c27" roughness={0.6} />
        </RoundedBox>
        <mesh position={[-7.2, 0.82, -5.0]}>
          <sphereGeometry args={[0.13, 20, 16]} />
          <meshStandardMaterial color="#ffcf8a" emissive="#ffb050" emissiveIntensity={2.2 * glow} toneMapped={false} />
        </mesh>
        <pointLight position={[-7.0, 1.1, -4.6]} color="#ffa040" intensity={5 * glow} distance={5} decay={2} castShadow={false} />
      </group>
    </Zone>
  );
}
