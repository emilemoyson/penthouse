"use client";

import { useMemo } from "react";
import { MeshReflectorMaterial } from "@react-three/drei";
import { floorTexture, pixelSkyline, rugTexture, wallTexture } from "../voxel/textures";
import { VoxelModel } from "../voxel/VoxelModel";
import { bigPlant, coffeeTable, floorLamp, recordConsole, sofa } from "../models/furniture";
import { GlowLight } from "./lights";

export const ROOM = { w: 18, d: 12, h: 4.2 };
const HW = ROOM.w / 2;
const HD = ROOM.d / 2;

export function Room({ reflective = true }: { reflective?: boolean }) {
  const floor = useMemo(() => floorTexture(ROOM.w, ROOM.d), []);
  const wall = useMemo(() => wallTexture(ROOM.d, ROOM.h), []);
  const sky = useMemo(() => pixelSkyline(), []);
  const rug = useMemo(() => rugTexture(4.2, 3, [44, 38, 60], [58, 50, 76]), []);

  return (
    <group>
      {/* ---------- pixel walnut floor (glossy on high quality) ---------- */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        {reflective ? (
          <MeshReflectorMaterial
            map={floor}
            resolution={512}
            blur={[300, 90]}
            mixBlur={1}
            mixStrength={0.9}
            roughness={0.75}
            depthScale={0.5}
            minDepthThreshold={0.5}
            maxDepthThreshold={1.2}
            metalness={0.25}
            mirror={0.3}
            color="#ffffff"
          />
        ) : (
          <meshStandardMaterial map={floor} roughness={0.7} metalness={0.1} />
        )}
      </mesh>
      <mesh position={[0, -0.16, 0]}>
        <boxGeometry args={[ROOM.w + 0.3, 0.3, ROOM.d + 0.3]} />
        <meshStandardMaterial color="#09080d" roughness={0.9} />
      </mesh>
      {/* the drop below the penthouse */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.32, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color="#05050a" />
      </mesh>

      {/* ---------- back wall: floor-to-ceiling glass in a chunky black frame ---------- */}
      <group position={[0, 0, -HD]}>
        <mesh position={[0, ROOM.h - 0.12, 0]} castShadow>
          <boxGeometry args={[ROOM.w, 0.24, 0.3]} />
          <meshStandardMaterial color="#121117" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[ROOM.w, 0.12, 0.3]} />
          <meshStandardMaterial color="#121117" roughness={0.6} />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => -HW + i * 3).map((x) => (
          <mesh key={x} position={[x, ROOM.h / 2, 0]} castShadow>
            <boxGeometry args={[0.12, ROOM.h, 0.18]} />
            <meshStandardMaterial color="#1a1921" roughness={0.5} metalness={0.4} />
          </mesh>
        ))}
        {/* transom bar */}
        <mesh position={[0, 3.05, 0]} castShadow>
          <boxGeometry args={[ROOM.w, 0.06, 0.12]} />
          <meshStandardMaterial color="#1a1921" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, ROOM.h / 2, 0.02]}>
          <planeGeometry args={[ROOM.w, ROOM.h]} />
          <meshStandardMaterial color="#7d9bd6" transparent opacity={0.045} roughness={0.05} metalness={0.9} depthWrite={false} />
        </mesh>
      </group>

      {/* ---------- glowing pixel city (blurred by the DOF pass) ---------- */}
      <mesh position={[0, 6.5, -28]}>
        <planeGeometry args={[100, 31.25]} />
        <meshBasicMaterial map={sky} toneMapped={false} color="#c9c4dc" />
      </mesh>
      <GlowLight position={[0, 2.4, -7.2]} color="#7a4fb0" intensity={5} distance={9} />

      {/* ---------- left wall, pixel plaster + cove LED ---------- */}
      <mesh position={[-HW - 0.1, ROOM.h / 2, 0]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.d, ROOM.h]} />
        <meshStandardMaterial map={wall} roughness={0.95} />
      </mesh>
      <mesh position={[-HW - 0.2, ROOM.h / 2, 0]}>
        <boxGeometry args={[0.2, ROOM.h, ROOM.d]} />
        <meshStandardMaterial color="#0d0c12" />
      </mesh>
      <mesh position={[-HW + 0.03, ROOM.h - 0.05, 0]}>
        <boxGeometry args={[0.03, 0.03, ROOM.d - 0.4]} />
        <meshBasicMaterial color="#8a6bff" toneMapped={false} />
      </mesh>
      {/* framed pixel print above the bed */}
      <mesh position={[-HW + 0.01, 2.45, -3.4]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.7, 1.0]} />
        <meshBasicMaterial map={sky} toneMapped={false} color="#8a85a0" />
      </mesh>
      <mesh position={[-HW - 0.005, 2.45, -3.4]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.82, 1.12]} />
        <meshStandardMaterial color="#141218" />
      </mesh>

      {/* ---------- living area ---------- */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0.45]} receiveShadow>
        <planeGeometry args={[4.2, 3]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <VoxelModel data={sofa()} position={[0, 0, 1.35]} rotation={[0, Math.PI, 0]} />
      <VoxelModel data={coffeeTable()} position={[0, 0, 0.0]} />
      <VoxelModel data={floorLamp()} position={[-2.35, 0, 1.5]} />
      <VoxelModel data={bigPlant()} position={[2.6, 0, -0.9]} />
      <VoxelModel data={recordConsole()} position={[-2.6, 0, -5.55]} />
      <GlowLight position={[-1.63, 1.55, 1.5]} color="#ffa64d" intensity={4} distance={4.5} />
      <GlowLight position={[0.24, 0.75, 0]} color="#ff9a4a" intensity={1.2} distance={2.2} />
    </group>
  );
}
