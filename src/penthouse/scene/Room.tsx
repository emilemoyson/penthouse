"use client";

import { useMemo } from "react";
import { MeshReflectorMaterial, RoundedBox } from "@react-three/drei";
import { makeSkylineTexture } from "./skyline";

export const ROOM = { w: 18, d: 12, h: 4.2 };
const HALF_W = ROOM.w / 2;
const HALF_D = ROOM.d / 2;

const WALL = "#14121b";
const TRIM = "#1d1a26";

export function Room({ reflective = true }: { reflective?: boolean }) {
  const skyline = useMemo(() => makeSkylineTexture(), []);

  return (
    <group>
      {/* ---------- Glossy floor (reflects the neon accents) ---------- */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        {reflective ? (
        <MeshReflectorMaterial
          resolution={512}
          blur={[400, 120]}
          mixBlur={1}
          mixStrength={1.6}
          roughness={0.85}
          depthScale={0.6}
          minDepthThreshold={0.5}
          maxDepthThreshold={1.2}
          color="#0d0c12"
          metalness={0.55}
          mirror={0.4}
        />
        ) : (
          <meshStandardMaterial color="#0f0e15" roughness={0.45} metalness={0.4} />
        )}
      </mesh>

      {/* floor edge so the slab reads as a building section */}
      <mesh position={[0, -0.16, 0]}>
        <boxGeometry args={[ROOM.w + 0.3, 0.3, ROOM.d + 0.3]} />
        <meshStandardMaterial color="#09080d" roughness={0.9} />
      </mesh>

      {/* ---------- Back wall: floor-to-ceiling glass ---------- */}
      <group position={[0, 0, -HALF_D]}>
        {/* header + sill */}
        <mesh position={[0, ROOM.h - 0.12, 0]}>
          <boxGeometry args={[ROOM.w, 0.24, 0.25]} />
          <meshStandardMaterial color={TRIM} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[ROOM.w, 0.12, 0.25]} />
          <meshStandardMaterial color={TRIM} roughness={0.6} />
        </mesh>
        {/* mullions */}
        {Array.from({ length: 7 }, (_, i) => -HALF_W + i * 3).map((x) => (
          <mesh key={x} position={[x, ROOM.h / 2, 0]}>
            <boxGeometry args={[0.08, ROOM.h, 0.14]} />
            <meshStandardMaterial color="#25222f" metalness={0.6} roughness={0.35} />
          </mesh>
        ))}
        {/* glass */}
        <mesh position={[0, ROOM.h / 2, 0.02]}>
          <planeGeometry args={[ROOM.w, ROOM.h]} />
          <meshStandardMaterial color="#7d9bd6" transparent opacity={0.05} roughness={0.05} metalness={0.9} depthWrite={false} />
        </mesh>
      </group>

      {/* ---------- City outside ---------- */}
      <mesh position={[0, 4.5, -26]}>
        <planeGeometry args={[96, 24]} />
        <meshBasicMaterial map={skyline} toneMapped={false} color="#9a96b0" />
      </mesh>
      {/* the drop below the penthouse: a dark void that hides everything under floor level */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.32, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color="#0a0a0f" />
      </mesh>
      {/* faint city glow spilling onto the floor near the glass */}
      <pointLight position={[0, 2.2, -7.5]} color="#7a4fb0" intensity={6} distance={10} decay={2} />

      {/* ---------- Left wall ---------- */}
      <mesh position={[-HALF_W - 0.1, ROOM.h / 2, 0]} receiveShadow>
        <boxGeometry args={[0.2, ROOM.h, ROOM.d]} />
        <meshStandardMaterial color={WALL} roughness={0.92} />
      </mesh>
      {/* cove LED along the ceiling line */}
      <mesh position={[-HALF_W + 0.02, ROOM.h - 0.05, 0]}>
        <boxGeometry args={[0.03, 0.03, ROOM.d - 0.4]} />
        <meshBasicMaterial color="#8a6bff" toneMapped={false} />
      </mesh>
      {/* wall art */}
      <mesh position={[-HALF_W + 0.02, 2.35, 0.05]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.8, 1.1]} />
        <meshStandardMaterial color="#1e1830" emissive="#3b2a66" emissiveIntensity={0.35} roughness={0.7} />
      </mesh>

      {/* ---------- Living area in the middle ---------- */}
      <LivingArea />
    </group>
  );
}

function LivingArea() {
  return (
    <group position={[0, 0, 0.2]}>
      {/* rug */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} receiveShadow>
        <planeGeometry args={[4.2, 3]} />
        <meshStandardMaterial color="#1f1b2a" roughness={1} />
      </mesh>
      {/* low sofa facing the window */}
      <group position={[0, 0, 0.9]}>
        <RoundedBox args={[2.8, 0.4, 0.95]} radius={0.12} position={[0, 0.3, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#2a2638" roughness={0.9} />
        </RoundedBox>
        <RoundedBox args={[2.8, 0.55, 0.25]} radius={0.1} position={[0, 0.62, 0.38]} castShadow>
          <meshStandardMaterial color="#2a2638" roughness={0.9} />
        </RoundedBox>
      </group>
      {/* coffee table */}
      <RoundedBox args={[1.4, 0.08, 0.7]} radius={0.03} position={[0, 0.36, -0.4]} castShadow receiveShadow>
        <meshStandardMaterial color="#1a1720" roughness={0.3} metalness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0.18, -0.4]}>
        <cylinderGeometry args={[0.06, 0.06, 0.34, 12]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* candle glow */}
      <mesh position={[0.35, 0.45, -0.4]}>
        <cylinderGeometry args={[0.04, 0.04, 0.1, 12]} />
        <meshBasicMaterial color="#ffb062" toneMapped={false} />
      </mesh>
      <pointLight position={[0.35, 0.65, -0.4]} color="#ff9a4a" intensity={1.6} distance={3} decay={2} />

      {/* plant */}
      <group position={[2.4, 0, -1.2]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.17, 0.5, 16]} />
          <meshStandardMaterial color="#26222e" roughness={0.8} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.sin(i * 1.3) * 0.18, 0.75 + i * 0.12, Math.cos(i * 1.3) * 0.18]} rotation={[0.4 * Math.sin(i), i, 0.5]} castShadow>
            <sphereGeometry args={[0.24, 8, 6]} />
            <meshStandardMaterial color="#1e3a2c" roughness={0.9} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}
