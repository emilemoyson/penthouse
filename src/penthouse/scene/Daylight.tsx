"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { nyHour, skyAt } from "../ambient";
import { useZone } from "../store";

/**
 * Light through the glass follows the real time in New York: moonlight at night, a warm low sun at
 * sunrise and sunset, bright daylight in between. A haze layer in front of the painted night skyline
 * turns it into a daytime city. Checks the clock every 20 seconds.
 */
export function Daylight() {
  const high = useZone((s) => s.quality === "high");
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const haze = useRef<THREE.MeshBasicMaterial>(null);
  const last = useRef(-1);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (last.current >= 0 && t - last.current < 20) return;
    last.current = t;
    const s = skyAt(nyHour());
    if (sun.current) {
      sun.current.color.copy(s.sunColor);
      sun.current.intensity = s.sunIntensity;
    }
    if (amb.current) amb.current.intensity = s.ambient;
    if (haze.current) {
      haze.current.color.copy(s.haze);
      haze.current.opacity = s.hazeOpacity;
    }
  });

  return (
    <>
      {/* moon by night, sun by day (casts the mullion shadows on high) */}
      <directionalLight
        ref={sun}
        position={[-6, 10, -16]}
        intensity={0.3}
        color="#9fb2ff"
        castShadow={high}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
      />
      <ambientLight ref={amb} intensity={0} color="#dfe8f5" />
      {/* daytime haze over the city painting */}
      <mesh position={[0, 4.5, -25.8]}>
        <planeGeometry args={[96, 24]} />
        <meshBasicMaterial ref={haze} transparent opacity={0} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
    </>
  );
}
