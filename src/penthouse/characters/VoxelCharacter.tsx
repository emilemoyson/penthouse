"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VoxelModel } from "../voxel/VoxelModel";
import { buildCharacter, RIG } from "./buildCharacter";
import { OUTFITS, type OutfitId } from "./outfits";

export type Action = "sleep" | "type" | "squat" | "stretch" | "cycle" | "walk" | "prep" | "idle";

/**
 * Procedural voxel character: oversized hoodie, joggers, sneakers, driven by a small joint rig.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │ HOOK: drop in your rigged pixel/voxel GLB (MagicaVoxel → Blender → Mixamo)    │
 * │                                                                              │
 * │   import { useGLTF, useAnimations } from "@react-three/drei";                │
 * │   const { scene, animations } = useGLTF("/models/emile-voxel.glb");          │
 * │   const { actions } = useAnimations(animations, root);                       │
 * │   const CLIPS: Record<Action, string> = {                                    │
 * │     sleep: "Sleeping", type: "Typing", squat: "AirSquat", stretch: "Stretch",│
 * │     cycle: "Cycling", walk: "Walking", prep: "Chopping", idle: "Idle" };     │
 * │   useEffect(() => {                                                          │
 * │     const a = actions[CLIPS[action]];                                        │
 * │     a?.reset().fadeIn(0.35).play();                                          │
 * │     return () => void a?.fadeOut(0.35);                                      │
 * │   }, [action]);                                                              │
 * │   return <primitive ref={root} object={scene} />;                            │
 * │                                                                              │
 * │ Export with the feet at y = 0, facing +Z, ~1.8 units tall, and keep the      │
 * │ material on NearestFilter textures so it matches the room's pixel density.   │
 * │ Keep the props below (action, outfit, position, rotation) and every zone     │
 * │ keeps working unchanged. useGLTF.preload("/models/emile-voxel.glb") at the   │
 * │ bottom of the file avoids a pop-in.                                          │
 * └──────────────────────────────────────────────────────────────────────────────┘
 */
export function VoxelCharacter({
  action,
  outfit = "emile",
  position,
  rotation,
  speed = 1,
}: {
  action: Action;
  outfit?: OutfitId;
  position?: [number, number, number];
  rotation?: [number, number, number];
  speed?: number;
}) {
  const parts = useMemo(() => buildCharacter(OUTFITS[outfit]), [outfit]);
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const seed = useMemo(() => Math.random() * 10, []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime * speed + seed;
    const k = Math.min(1, dt * 8); // blend so switching actions eases instead of snapping
    const set = (g: THREE.Group | null, x: number, z = 0, y = 0) => {
      if (!g) return;
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, x, k);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, y, k);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, z, k);
    };
    const hipY = (y: number) => hips.current && (hips.current.position.y = THREE.MathUtils.lerp(hips.current.position.y, y, k));
    const H = RIG.hipY;

    switch (action) {
      case "sleep": {
        const b = Math.sin(t * 1.0) * 0.5 + 0.5;
        hipY(H);
        set(torso.current, 0);
        if (torso.current) torso.current.scale.set(1, 1, 1 + b * 0.03);
        set(head.current, 0.05, 0.3, 0.2);
        set(armL.current, 0.1, 0.15);
        set(armR.current, -0.5, -0.5);
        set(foreL.current, -0.3);
        set(foreR.current, -1.6);
        set(legL.current, 0, 0.05);
        set(legR.current, -0.35, -0.05);
        set(shinL.current, 0);
        set(shinR.current, 0.6);
        break;
      }
      case "type": {
        hipY(RIG.shin - 0.01);
        set(torso.current, 0.14);
        set(head.current, 0.1 + Math.sin(t * 0.7) * 0.05, 0, Math.sin(t * 0.33) * 0.12);
        set(armL.current, -0.6, 0.18);
        set(armR.current, -0.6, -0.18);
        set(foreL.current, -1.0 + Math.sin(t * 10) * 0.06);
        set(foreR.current, -1.0 + Math.sin(t * 10 + 1.7) * 0.06);
        set(legL.current, -Math.PI / 2, 0.08);
        set(legR.current, -Math.PI / 2, -0.08);
        set(shinL.current, Math.PI / 2);
        set(shinR.current, Math.PI / 2);
        break;
      }
      case "squat": {
        const d = (1 - Math.cos(t * 2.1)) / 2;
        const a = d * 1.1;
        hipY(H * Math.cos(a) + 0.01);
        set(torso.current, a * 0.5);
        set(head.current, -a * 0.35);
        set(armL.current, -1.4, 0.12);
        set(armR.current, -1.4, -0.12);
        set(foreL.current, -0.8);
        set(foreR.current, -0.8);
        set(legL.current, -a, 0.1);
        set(legR.current, -a, -0.1);
        set(shinL.current, 2 * a);
        set(shinR.current, 2 * a);
        break;
      }
      case "stretch": {
        const s = Math.sin(t * 0.8);
        hipY(H);
        set(torso.current, 0, s * 0.28);
        set(head.current, 0, s * 0.15);
        set(armL.current, 0, 2.7 + s * 0.15);
        set(armR.current, 0, -2.7 + s * 0.15);
        set(foreL.current, 0);
        set(foreR.current, 0);
        set(legL.current, 0, 0.14);
        set(legR.current, 0, -0.14);
        set(shinL.current, 0);
        set(shinR.current, 0);
        break;
      }
      case "cycle": {
        const p = t * 5;
        hipY(H - 0.02);
        set(torso.current, 0.55);
        set(head.current, -0.35);
        set(armL.current, -1.15, 0.1);
        set(armR.current, -1.15, -0.1);
        set(foreL.current, -0.25);
        set(foreR.current, -0.25);
        set(legL.current, -1.05 + Math.sin(p) * 0.45);
        set(legR.current, -1.05 - Math.sin(p) * 0.45);
        set(shinL.current, 1.2 - Math.cos(p) * 0.45);
        set(shinR.current, 1.2 + Math.cos(p) * 0.45);
        break;
      }
      case "walk": {
        const w = Math.sin(t * 6);
        hipY(H + Math.abs(Math.cos(t * 6)) * 0.025);
        set(torso.current, 0.04, w * 0.03);
        set(head.current, 0);
        set(armL.current, w * 0.5, 0.08);
        set(armR.current, -w * 0.5, -0.08);
        set(foreL.current, -0.3);
        set(foreR.current, -0.3);
        set(legL.current, -w * 0.5);
        set(legR.current, w * 0.5);
        set(shinL.current, Math.max(0, w) * 0.75);
        set(shinR.current, Math.max(0, -w) * 0.75);
        break;
      }
      case "prep": {
        hipY(H);
        set(torso.current, 0.25);
        set(head.current, 0.4);
        set(armL.current, -0.95, 0.22);
        set(armR.current, -0.95 + Math.sin(t * 6) * 0.15, -0.22);
        set(foreL.current, -0.75);
        set(foreR.current, -0.75 + Math.sin(t * 6) * 0.25);
        set(legL.current, 0, 0.06);
        set(legR.current, 0, -0.06);
        set(shinL.current, 0);
        set(shinR.current, 0);
        break;
      }
      default: {
        const b = Math.sin(t * 1.2);
        hipY(H + b * 0.004);
        set(torso.current, b * 0.015);
        set(head.current, 0, 0, Math.sin(t * 0.4) * 0.2);
        set(armL.current, 0, 0.08);
        set(armR.current, 0, -0.08);
        [foreL, foreR, legL, legR, shinL, shinR].forEach((r) => set(r.current, 0));
      }
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <group ref={hips} position={[0, RIG.hipY, 0]}>
        <group ref={torso}>
          <VoxelModel data={parts.torso} />
          <group ref={head} position={[0, RIG.neckY, 0]}>
            <VoxelModel data={parts.head} />
          </group>
          {(
            [
              [armL, foreL, RIG.shoulderX],
              [armR, foreR, -RIG.shoulderX],
            ] as const
          ).map(([arm, fore, x], i) => (
            <group key={i} ref={arm} position={[x, RIG.shoulderY, 0]}>
              <VoxelModel data={parts.upperArm} />
              <group ref={fore} position={[0, RIG.elbowY, 0]}>
                <VoxelModel data={parts.foreArm} />
              </group>
            </group>
          ))}
        </group>
        {(
          [
            [legL, shinL, RIG.hipX],
            [legR, shinR, -RIG.hipX],
          ] as const
        ).map(([leg, shin, x], i) => (
          <group key={i} ref={leg} position={[x, 0, 0]}>
            <VoxelModel data={parts.thigh} />
            <group ref={shin} position={[0, RIG.kneeY, 0]}>
              <VoxelModel data={parts.shin} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}
