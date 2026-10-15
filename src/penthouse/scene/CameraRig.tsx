"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useZone } from "../store";
import { OVERVIEW, overviewPose, zoneById } from "../zones";

/** World point the lens focuses on (read by the depth-of-field pass every frame). */
export const focusPoint = new THREE.Vector3(...OVERVIEW.target);

const BASE_FOV = 36;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

type Tween = {
  start: number;
  p: number;
  dur: number;
  fromPos: THREE.Vector3;
  ctrl: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromFov: number;
  toFov: number;
};

/**
 * Cinematic, state-driven camera.
 * - overview: OrbitControls own the camera (restricted so the room never gets lost).
 * - flying / returning: a timed tween along a raised quadratic Bézier arc with ease-in-out,
 *   the look-at target leading slightly (ease-out) and a small FOV dolly for a lens-like push-in.
 * - focused: camera holds the zone pose; a projection offset slides the subject out from under the glass panel.
 */
export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const zone = useZone((s) => s.zone);
  const phase = useZone((s) => s.phase);
  const arrive = useZone((s) => s.arrive);
  const settle = useZone((s) => s.settle);
  const shift = useRef({ x: 0, y: 0 });
  const tween = useRef<Tween | null>(null);
  const k = overviewPose(size.width / size.height).k;

  // place the camera for this screen shape on first load
  useEffect(() => {
    const o = overviewPose(size.width / size.height);
    if (useZone.getState().phase === "overview") {
      camera.position.set(...o.position);
      controls.current?.target.set(...o.target);
      controls.current?.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc closes, 1-4 jump to zones
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") useZone.getState().close();
      const map: Record<string, Parameters<ReturnType<typeof useZone.getState>["focus"]>[0]> = { "1": "bed", "2": "desk", "3": "gym", "4": "kitchen" };
      if (map[e.key]) useZone.getState().focus(map[e.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // start a new flight whenever the destination changes (also mid-flight)
  useEffect(() => {
    if (phase !== "flying" && phase !== "returning") return;
    const c = controls.current;
    if (!c) return;
    const cam = camera as THREE.PerspectiveCamera;
    let toPos: THREE.Vector3;
    let toTarget: THREE.Vector3;
    let toFov = BASE_FOV;
    if (zone && phase === "flying") {
      const z = zoneById(zone);
      toPos = new THREE.Vector3(...z.camera.position);
      toTarget = new THREE.Vector3(...z.camera.target);
      toFov = z.fov ?? 34;
    } else {
      const o = overviewPose(size.width / size.height);
      toPos = new THREE.Vector3(...o.position);
      toTarget = new THREE.Vector3(...o.target);
    }
    const fromPos = cam.position.clone();
    const dist = fromPos.distanceTo(toPos);
    // raise the arc's control point so the camera swoops instead of sliding through furniture
    const ctrl = fromPos.clone().lerp(toPos, 0.5);
    ctrl.y = Math.max(fromPos.y, toPos.y) + Math.min(3.5, dist * 0.18);
    tween.current = {
      start: performance.now(),
      p: 0,
      dur: THREE.MathUtils.clamp(0.9 + dist * 0.07, 1.2, 2.3),
      fromPos,
      ctrl,
      toPos,
      fromTarget: c.target.clone(),
      toTarget,
      fromFov: cam.fov,
      toFov,
    };
  }, [zone, phase, camera, size.width, size.height]);

  useFrame((_, dtRaw) => {
    const c = controls.current;
    if (!c) return;
    const dt = Math.min(dtRaw, 0.1);
    const cam = camera as THREE.PerspectiveCamera;

    // ---- projection offset so the focused object isn't hidden behind the panel
    const wide = size.width >= 1024; // matches the panel's lg: breakpoint
    const away = phase === "focused" || phase === "flying";
    const wantX = away ? (wide ? size.width * 0.2 : 0) : 0;
    const wantY = away ? (wide ? 0 : size.height * 0.3) : 0;
    shift.current.x = THREE.MathUtils.damp(shift.current.x, wantX, 3.5, dt);
    shift.current.y = THREE.MathUtils.damp(shift.current.y, wantY, 3.5, dt);
    if (Math.abs(shift.current.x) > 0.5 || Math.abs(shift.current.y) > 0.5) {
      cam.setViewOffset(size.width, size.height, shift.current.x, shift.current.y, size.width, size.height);
    } else if (cam.view?.enabled) {
      cam.clearViewOffset();
    }

    focusPoint.lerp(c.target, Math.min(1, dt * 6));

    const tw = tween.current;
    if (!tw || (phase !== "flying" && phase !== "returning")) return;
    // wall-clock progress: a dropped frame never slows the flight down
    tw.p = Math.min(1, (performance.now() - tw.start) / (tw.dur * 1000));
    const e = easeInOutCubic(tw.p);
    const u = 1 - e;
    cam.position.set(
      u * u * tw.fromPos.x + 2 * u * e * tw.ctrl.x + e * e * tw.toPos.x,
      u * u * tw.fromPos.y + 2 * u * e * tw.ctrl.y + e * e * tw.toPos.y,
      u * u * tw.fromPos.z + 2 * u * e * tw.ctrl.z + e * e * tw.toPos.z,
    );
    c.target.lerpVectors(tw.fromTarget, tw.toTarget, easeOutQuart(Math.min(1, tw.p * 1.1)));
    cam.fov = THREE.MathUtils.lerp(tw.fromFov, tw.toFov, e);
    cam.updateProjectionMatrix();
    cam.lookAt(c.target);

    if (phase === "flying" && tw.p > 0.82) arrive(); // fade the panel in as the camera settles
    if (tw.p >= 1) {
      tween.current = null;
      if (phase === "returning") {
        c.update();
        settle();
      }
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={phase === "overview"}
      target={OVERVIEW.target}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.6}
      minDistance={10}
      maxDistance={30 * k}
      minPolarAngle={Math.PI * 0.18}
      maxPolarAngle={Math.PI * 0.42}
      minAzimuthAngle={-0.2}
      maxAzimuthAngle={1.3}
    />
  );
}
