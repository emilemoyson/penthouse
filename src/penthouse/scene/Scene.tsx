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
import { OVERVIEW } from "../zones";
import { Bed } from "../zones/Bed";
import { Desk } from "../zones/Desk";
import { Gym } from "../zones/Gym";
import { Kitchen } from "../zones/Kitchen";
import { useZone } from "../store";

export const BG = "#05050a";

/**
 * Lens stack: bloom for the neon/LED voxels, a depth-of-field that keeps whatever the camera
 * is looking at sharp (so the pixel skyline melts into bokeh), then grain + vignette.
 */
function Lens() {
  const dof = useRef<DepthOfFieldEffect>(null);
  useFrame(() => {
    dof.current?.target?.copy(focusPoint);
  });
  return (
    <EffectComposer multisampling={0}>
      <DepthOfField ref={dof} target={[0, 0, 0]} worldFocusRange={14} bokehScale={3} resolutionScale={0.5} />
      <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.2} intensity={1.05} radius={0.72} />
      <Noise opacity={0.04} premultiply />
      <Vignette offset={0.22} darkness={0.82} />
    </EffectComposer>
  );
}

export default function Scene() {
  const quality = useZone((s) => s.quality);
  const pixel = useZone((s) => s.pixel);
  const setQuality = useZone((s) => s.setQuality);
  const high = quality === "high";

  // phones, ?quality=low|high and ?pixel=0|1 (handy for testing)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const qq = q.get("quality");
    if (qq === "low" || qq === "high") setQuality(qq);
    else if (window.matchMedia("(max-width: 640px)").matches) setQuality("low");
    if (q.get("pixel") === "0") useZone.getState().setPixel(false);
  }, [setQuality]);

  return (
    <Canvas
      shadows={high ? "percentage" : false}
      // Pixel mode renders at half resolution and lets the browser upscale with nearest-neighbour:
      // crisp chunky pixels, and ~4× fewer fragments to shade.
      dpr={pixel ? 0.5 : high ? [1, 1.75] : 1}
      style={{ imageRendering: pixel ? "pixelated" : "auto" }}
      camera={{ position: OVERVIEW.position, fov: 36, near: 0.1, far: 160 }}
      gl={{ antialias: !pixel, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2, powerPreference: "high-performance" }}
      onPointerMissed={() => useZone.getState().phase === "overview" && useZone.getState().hover(null)}
    >
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 32, 80]} />

      {/* ---------- no bright global light: a whisper of ambient, the rest is local ---------- */}
      <ambientLight intensity={high ? 0.1 : 0.16} color="#5c5aa0" />
      <hemisphereLight args={["#3a3570", "#0a0a12", high ? 0.22 : 0.38]} />
      {/* faint moonlight through the glass (casts the mullion shadows on high) */}
      <directionalLight
        position={[-6, 10, -16]}
        intensity={0.35}
        color="#8fa6ff"
        castShadow={high}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
      />
      {/* camera-side fill so silhouettes never go fully black */}
      <pointLight position={[2, 5, 9]} intensity={high ? 2.6 : 4} color="#4a3f7a" distance={18} decay={2} />

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
