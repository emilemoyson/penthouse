"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { nyHour, skyAt } from "../ambient";
import { useZone } from "../store";
import { makeSkylineTexture } from "./skyline";
import { setRim } from "../characters/Character";

/**
 * Light through the glass follows the real time in New York: moonlight at night, a warm low sun at
 * sunrise and sunset, bright daylight in between. A haze layer in front of the painted night skyline
 * turns it into a daytime city. Checks the clock every 20 seconds.
 */
export function Daylight() {
  const high = useZone((s) => s.quality === "high");
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hazeMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }), []);
  const haze = useRef(hazeMat);
  const cityMat = useMemo(() => new THREE.MeshBasicMaterial({ map: makeSkylineTexture().userData.day as THREE.Texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }), []);
  const groundMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#140b2a", toneMapped: false }), []);
  const tmp = useRef(new THREE.Color());
  const last = useRef(-1);

  useFrame(({ clock, scene }) => {
    const t = clock.elapsedTime;
    if (last.current >= 0 && t - last.current < 20) return;
    last.current = t;
    const h = nyHour();
    const s = skyAt(h);
    useZone.getState().setHour(h);
    setRim(s);
    if (sun.current) {
      sun.current.color.copy(s.sunColor);
      sun.current.intensity = s.sunIntensity;
    }
    if (amb.current) amb.current.intensity = s.ambient * 3;
    // the ground, the backdrop and the fog share one colour: deep violet at night, the sky's haze by day
    tmp.current.set("#140b2a").lerp(s.haze, Math.min(1, s.hazeOpacity * 1.1));
    groundMat.color.copy(tmp.current);
    if (scene.background instanceof THREE.Color) scene.background.copy(tmp.current);
    if (scene.fog) scene.fog.color.copy(tmp.current);
    if (haze.current) {
      haze.current.color.copy(s.haze);
      haze.current.opacity = s.hazeOpacity;
    }
    // the daytime city: pale silhouettes that take a little of the sky's colour
    cityMat.color.set("#ffffff").lerp(s.haze, 0.35);
    cityMat.opacity = Math.min(1, s.hazeOpacity / 0.6);
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
      <mesh position={[-12, 0, -30.8]} material={hazeMat}>
        <planeGeometry args={[114, 38]} />
      </mesh>
      <mesh position={[-12, 0, -30.6]} material={cityMat}>
        <planeGeometry args={[114, 38]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -16.3, 0]} material={groundMat}>
        <planeGeometry args={[400, 400]} />
      </mesh>
    </>
  );
}
