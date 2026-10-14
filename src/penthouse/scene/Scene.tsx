"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor, Preload } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import * as THREE from "three";
import { Room } from "./Room";
import { CameraRig } from "./CameraRig";
import { LabelProjector } from "./Zone";
import { OVERVIEW } from "../zones";
import { Bed } from "../zones/Bed";
import { Desk } from "../zones/Desk";
import { Gym } from "../zones/Gym";
import { Kitchen } from "../zones/Kitchen";
import { useZone } from "../store";

function initialQuality(): "high" | "low" {
  if (typeof window === "undefined") return "high";
  const q = new URLSearchParams(window.location.search).get("quality");
  if (q === "low" || q === "high") return q;
  return window.matchMedia("(max-width: 640px)").matches ? "low" : "high";
}

export default function Scene() {
  // "low" drops reflections, shadows and post-processing for phones / weak GPUs (?quality=low forces it)
  const [quality, setQuality] = useState(initialQuality);
  const high = quality === "high";
  return (
    <Canvas
      shadows={high ? "percentage" : false}
      dpr={high ? [1, 1.75] : 1}
      camera={{ position: OVERVIEW.position, fov: 36, near: 0.1, far: 140 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05, powerPreference: "high-performance" }}
      onPointerMissed={() => useZone.getState().phase === "overview" && useZone.getState().hover(null)}
    >
      <color attach="background" args={["#0a0a0f"]} />
      <fog attach="fog" args={["#0a0a0f", 30, 75]} />

      {/* ---------- Lighting: dim base, everything else is local ---------- */}
      <ambientLight intensity={0.22} color="#6b6aa8" />
      {/* moonlight through the glass, the only shadow-casting light */}
      <directionalLight
        position={[-6, 9, -14]}
        intensity={0.55}
        color="#8fa6ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0004}
      />
      {/* soft fill from the camera side so silhouettes don't go fully black */}
      <pointLight position={[2, 5, 9]} intensity={3} color="#5a4a8a" distance={18} decay={2} />

      <PerformanceMonitor onDecline={() => setQuality("low")} />
      <Suspense fallback={null}>
        <Room reflective={high} />
        <Bed />
        <Desk />
        <Gym />
        <Kitchen />
        <Preload all />
      </Suspense>

      <CameraRig />
      <LabelProjector />

      {high && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.9} radius={0.7} />
          <Noise opacity={0.035} premultiply />
          <Vignette offset={0.25} darkness={0.75} />
        </EffectComposer>
      )}
      <AdaptiveDpr pixelated />
    </Canvas>
  );
}
