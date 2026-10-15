"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useZone } from "../store";

/**
 * A warm, local point light. On high quality it can cast soft PCF shadows (small maps,
 * blurred with `radius`) so voxels throw those chunky, cosy shadows.
 */
export function GlowLight({
  position,
  color,
  intensity,
  distance = 5,
  shadow = false,
}: {
  position: [number, number, number];
  color: string;
  intensity: number;
  distance?: number;
  shadow?: boolean;
}) {
  const high = useZone((s) => s.quality === "high");
  const cast = shadow && high;
  // without bloom the room needs a touch more light to read
  intensity = high ? intensity : intensity * 1.35;
  return (
    <pointLight
      position={position}
      color={color}
      intensity={intensity}
      distance={distance}
      decay={2}
      castShadow={cast}
      shadow-mapSize={[512, 512]}
      shadow-radius={6}
      shadow-bias={-0.002}
      shadow-normalBias={0.02}
      shadow-camera-near={0.05}
      shadow-camera-far={distance}
    />
  );
}

/**
 * Point-light shadows re-render the scene six times per light. Furniture never moves,
 * so refreshing shadow maps at ~20 fps instead of every frame keeps characters' shadows
 * alive at a fraction of the cost.
 */
export function ShadowThrottle({ every = 3 }: { every?: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  const n = useRef(0);
  useFrame(() => {
    if (++n.current % every === 0) gl.shadowMap.needsUpdate = true;
  });
  return null;
}
