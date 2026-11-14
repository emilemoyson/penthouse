"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor, Preload } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise, DepthOfField } from "@react-three/postprocessing";
import type { DepthOfFieldEffect } from "postprocessing";
import * as THREE from "three";
import { Room } from "./Room";
import { CameraRig, focusPoint } from "./CameraRig";
import { LabelProjector } from "./Zone";
import { ShadowThrottle } from "./lights";
import { Daylight } from "./Daylight";
import { OVERVIEW } from "../zones";
import { Bed } from "../zones/Bed";
import { Desk } from "../zones/Desk";
import { Gym } from "../zones/Gym";
import { Kitchen } from "../zones/Kitchen";
import { useZone } from "../store";

export const BG = "#0b0908";

/**
 * Lens stack: soft bloom for lamps and screens, a depth-of-field that keeps whatever the camera
 * is looking at sharp (so the city melts into bokeh), then grain + vignette.
 */
function Lens() {
  const dof = useRef<DepthOfFieldEffect>(null);
  useFrame(() => {
    dof.current?.target?.copy(focusPoint);
  });
  return (
    <EffectComposer multisampling={0}>
      <DepthOfField ref={dof} target={[0, 0, 0]} worldFocusRange={14} bokehScale={3} resolutionScale={0.5} />
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.25} intensity={0.75} radius={0.7} />
      <Noise opacity={0.03} premultiply />
      <Vignette offset={0.25} darkness={0.7} />
    </EffectComposer>
  );
}

export default function Scene() {
  const quality = useZone((s) => s.quality);
  const setQuality = useZone((s) => s.setQuality);
  const high = quality === "high";

  // phones, and ?quality=low|high (handy for testing)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const qq = q.get("quality");
    if (qq === "low" || qq === "high") setQuality(qq);
    else if (window.matchMedia("(max-width: 640px)").matches) setQuality("low");
  }, [setQuality]);

  return (
    <Canvas
      shadows={high ? "percentage" : false}
      dpr={high ? [1, 1.75] : 1}
      camera={{ position: OVERVIEW.position, fov: 36, near: 0.1, far: 160 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, powerPreference: "high-performance" }}
      onPointerMissed={() => useZone.getState().phase === "overview" && useZone.getState().hover(null)}
    >
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 32, 80]} />

      {/* ---------- no bright global light: a warm whisper of ambient, the rest is lamps ---------- */}
      <ambientLight intensity={high ? 0.12 : 0.2} color="#ffd8b0" />
      <hemisphereLight args={["#8a7aa8", "#2a1c14", high ? 0.25 : 0.4]} />
      {/* moonlight or daylight through the glass, by New York time */}
      <Daylight />
      {/* camera-side fill so silhouettes never go fully black */}
      <pointLight position={[2, 5, 9]} intensity={high ? 3 : 4.5} color="#7a5a48" distance={18} decay={2} />

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
      {high && <ShadowThrottle every={3} />}
      {high && <Lens />}
    </Canvas>
  );
}
