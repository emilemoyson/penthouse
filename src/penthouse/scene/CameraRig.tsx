"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useZone } from "../store";
import { OVERVIEW, overviewPose, zoneById } from "../zones";

const _goalPos = new THREE.Vector3();
const _goalTarget = new THREE.Vector3();

/**
 * State-driven camera.
 * - overview: OrbitControls own the camera (restricted so the room never gets lost).
 * - flying / returning: controls are locked and we damp position + target toward the goal every frame.
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
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") useZone.getState().close();
      const map: Record<string, Parameters<ReturnType<typeof useZone.getState>["focus"]>[0]> = { "1": "bed", "2": "desk", "3": "gym", "4": "kitchen" };
      if (map[e.key]) useZone.getState().focus(map[e.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useFrame((_, dtRaw) => {
    const c = controls.current;
    if (!c) return;
    const dt = Math.min(dtRaw, 0.1);
    const cam = camera as THREE.PerspectiveCamera;

    // ---- projection offset so the focused object isn't hidden behind the panel
    const wide = size.width >= 900;
    const wantX = phase === "focused" || phase === "flying" ? (wide ? size.width * 0.2 : 0) : 0;
    const wantY = phase === "focused" || phase === "flying" ? (wide ? 0 : size.height * 0.24) : 0;
    shift.current.x = THREE.MathUtils.damp(shift.current.x, wantX, 4, dt);
    shift.current.y = THREE.MathUtils.damp(shift.current.y, wantY, 4, dt);
    if (Math.abs(shift.current.x) > 0.5 || Math.abs(shift.current.y) > 0.5) {
      cam.setViewOffset(size.width, size.height, shift.current.x, shift.current.y, size.width, size.height);
    } else if (cam.view) {
      cam.clearViewOffset();
    }

    if (phase === "overview") return;

    // ---- travel
    if (zone) {
      const z = zoneById(zone);
      _goalPos.set(...z.camera.position);
      _goalTarget.set(...z.camera.target);
    } else {
      const o = overviewPose(size.width / size.height);
      _goalPos.set(...o.position);
      _goalTarget.set(...o.target);
    }
    const lambda = phase === "returning" ? 2.6 : 2.9;
    cam.position.x = THREE.MathUtils.damp(cam.position.x, _goalPos.x, lambda, dt);
    cam.position.y = THREE.MathUtils.damp(cam.position.y, _goalPos.y, lambda, dt);
    cam.position.z = THREE.MathUtils.damp(cam.position.z, _goalPos.z, lambda, dt);
    c.target.x = THREE.MathUtils.damp(c.target.x, _goalTarget.x, lambda * 1.15, dt);
    c.target.y = THREE.MathUtils.damp(c.target.y, _goalTarget.y, lambda * 1.15, dt);
    c.target.z = THREE.MathUtils.damp(c.target.z, _goalTarget.z, lambda * 1.15, dt);
    cam.lookAt(c.target);

    const dist = cam.position.distanceTo(_goalPos) + c.target.distanceTo(_goalTarget);
    if (phase === "flying" && dist < 0.35) arrive(); // fade the panel in as the camera settles
    if (phase === "returning" && dist < 0.08) {
      c.update();
      settle();
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
