"use client";

import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { Zone, useGlow } from "../scene/Zone";
import { Character } from "../scene/Character";

/** Tiny spreadsheet painted onto the laptop screen. */
function useScreenTexture() {
  return useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 320;
    const c = cv.getContext("2d")!;
    c.fillStyle = "#0b1426";
    c.fillRect(0, 0, 512, 320);
    c.fillStyle = "#13274a";
    c.fillRect(0, 0, 512, 28);
    c.fillStyle = "#4b93ec";
    c.fillRect(12, 9, 60, 10);
    for (let r = 0; r < 11; r++) {
      for (let col = 0; col < 5; col++) {
        c.fillStyle = r === 0 ? "rgba(140,190,255,0.55)" : `rgba(160,200,255,${0.12 + ((r * 7 + col * 3) % 5) * 0.06})`;
        c.fillRect(14 + col * 98, 42 + r * 24, col === 0 ? 40 : 70 + ((r + col) % 3) * 8, 10);
      }
    }
    c.fillStyle = "#23b58a";
    c.fillRect(400, 90, 70, 10);
    c.fillStyle = "#f2a53a";
    c.fillRect(400, 162, 54, 10);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

export function Desk() {
  const glow = useGlow("desk", 1.3);
  const screen = useScreenTexture();
  return (
    <Zone id="desk" hitbox={{ size: [3.2, 1.6, 2.6], position: [4.6, 0.8, -4.3] }}>
      <group>
        {/* desk */}
        <RoundedBox args={[2.0, 0.06, 0.85]} radius={0.02} position={[4.6, 0.76, -4.65]} castShadow receiveShadow>
          <meshStandardMaterial color="#2a2420" roughness={0.45} />
        </RoundedBox>
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} position={[4.6 + x, 0.37, -4.65]} castShadow>
            <boxGeometry args={[0.05, 0.74, 0.75]} />
            <meshStandardMaterial color="#1a1a1f" metalness={0.7} roughness={0.35} />
          </mesh>
        ))}
        {/* under-desk glow */}
        <mesh position={[4.6, 0.72, -4.98]}>
          <boxGeometry args={[1.8, 0.015, 0.015]} />
          <meshBasicMaterial color="#4b93ec" toneMapped={false} />
        </mesh>

        {/* laptop */}
        <group position={[4.6, 0.79, -4.62]}>
          <mesh castShadow>
            <boxGeometry args={[0.62, 0.02, 0.42]} />
            <meshStandardMaterial color="#9a9aa6" metalness={0.8} roughness={0.3} />
          </mesh>
          <group position={[0, 0.01, -0.2]} rotation-x={-0.28}>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[0.62, 0.4, 0.015]} />
              <meshStandardMaterial color="#8c8c98" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.2, 0.009]}>
              <planeGeometry args={[0.58, 0.36]} />
              <meshBasicMaterial map={screen} toneMapped={false} color={new THREE.Color(1, 1, 1).multiplyScalar(0.75 + 0.2 * glow)} />
            </mesh>
          </group>
        </group>
        <pointLight position={[4.6, 1.15, -4.2]} color="#5aa0ff" intensity={3.2 * glow} distance={3.2} decay={2} />

        {/* mug + plant */}
        <mesh position={[5.3, 0.84, -4.5]} castShadow>
          <cylinderGeometry args={[0.05, 0.045, 0.1, 16]} />
          <meshStandardMaterial color="#e9e3ea" roughness={0.6} />
        </mesh>
        <mesh position={[3.85, 0.92, -4.85]} castShadow>
          <sphereGeometry args={[0.16, 8, 6]} />
          <meshStandardMaterial color="#1d3a2b" flatShading roughness={0.9} />
        </mesh>

        {/* chair */}
        <group position={[4.6, 0, -3.75]}>
          <RoundedBox args={[0.55, 0.08, 0.55]} radius={0.03} position={[0, 0.46, 0]} castShadow>
            <meshStandardMaterial color="#1f1d27" roughness={0.8} />
          </RoundedBox>
          <RoundedBox args={[0.55, 0.6, 0.07]} radius={0.03} position={[0, 0.82, 0.27]} castShadow>
            <meshStandardMaterial color="#1f1d27" roughness={0.8} />
          </RoundedBox>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.44, 8]} />
            <meshStandardMaterial color="#555" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.28, 0.28, 0.04, 16]} />
            <meshStandardMaterial color="#222" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>

        {/* ===== IDLE: character working at the laptop ===== */}
        {/* HOOK: replace with <Avatar action="type" .../> */}
        <Character action="type" position={[4.6, 0, -3.72]} rotation={[0, Math.PI, 0]} tint="#06122a" />
      </group>
    </Zone>
  );
}
