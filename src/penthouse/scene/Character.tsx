"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type Action = "sleep" | "type" | "squat" | "stretch" | "walk" | "prep" | "idle";

/**
 * Placeholder mannequin with procedural idle loops.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ HOOK: swap in your rigged avatar (Ready Player Me / Mixamo)              │
 * │                                                                          │
 * │   const { scene, animations } = useGLTF("/models/emile.glb");            │
 * │   const { actions } = useAnimations(animations, root);                   │
 * │   useEffect(() => {                                                      │
 * │     const clip = CLIPS[action];           // e.g. { sleep: "Sleeping",   │
 * │     actions[clip]?.reset().fadeIn(0.4).play();  type: "Typing", ... }   │
 * │     return () => void actions[clip]?.fadeOut(0.4);                      │
 * │   }, [action]);                                                          │
 * │   return <primitive object={scene} ref={root} />;                        │
 * │                                                                          │
 * │ Keep the same props (action, position, rotation) so every zone keeps     │
 * │ working. RPM avatars are ~1.75 units tall and face +Z, same as this one. │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export function Character({
  action,
  position,
  rotation,
  speed = 1,
  tint = "#1a1626",
}: {
  action: Action;
  position?: [number, number, number];
  rotation?: [number, number, number];
  speed?: number;
  tint?: string;
}) {
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

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime * speed;
    const k = Math.min(1, dt * 8); // blend factor so switching actions eases instead of snapping
    const set = (g: THREE.Group | null, x: number, z = 0) => {
      if (!g) return;
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, x, k);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, z, k);
    };
    const hipY = (y: number) => hips.current && (hips.current.position.y = THREE.MathUtils.lerp(hips.current.position.y, y, k));

    switch (action) {
      case "sleep": {
        const b = Math.sin(t * 1.1) * 0.5 + 0.5;
        hipY(0.9);
        set(torso.current, 0);
        if (torso.current) torso.current.scale.setScalar(1 + b * 0.025);
        set(head.current, 0.05, 0.25);
        set(armL.current, 0.05, 0.12);
        set(armR.current, -0.1, -0.35);
        set(foreL.current, -0.2);
        set(foreR.current, -1.4);
        set(legL.current, 0, 0.04);
        set(legR.current, -0.25, -0.04);
        set(shinL.current, 0);
        set(shinR.current, 0.4);
        break;
      }
      case "type": {
        hipY(0.5);
        set(torso.current, 0.12);
        set(head.current, 0.12 + Math.sin(t * 0.6) * 0.04, Math.sin(t * 0.35) * 0.06);
        set(armL.current, -0.55, 0.12);
        set(armR.current, -0.55, -0.12);
        set(foreL.current, -1.05 + Math.sin(t * 9) * 0.05);
        set(foreR.current, -1.05 + Math.sin(t * 9 + 1.7) * 0.05);
        set(legL.current, -Math.PI / 2, 0.06);
        set(legR.current, -Math.PI / 2, -0.06);
        set(shinL.current, Math.PI / 2);
        set(shinR.current, Math.PI / 2);
        break;
      }
      case "squat": {
        const d = (1 - Math.cos(t * 2.2)) / 2; // 0 standing → 1 bottom
        const a = d * 1.15;
        hipY(0.9 * Math.cos(a) + 0.02);
        set(torso.current, a * 0.45);
        set(head.current, -a * 0.3);
        set(armL.current, -1.35, 0.15);
        set(armR.current, -1.35, -0.15);
        set(foreL.current, -0.9);
        set(foreR.current, -0.9);
        set(legL.current, -a, 0.08);
        set(legR.current, -a, -0.08);
        set(shinL.current, 2 * a);
        set(shinR.current, 2 * a);
        break;
      }
      case "stretch": {
        const s = Math.sin(t * 0.8);
        hipY(0.9);
        set(torso.current, 0, s * 0.25);
        set(head.current, 0, s * 0.15);
        set(armL.current, 0, 2.8 + s * 0.15);
        set(armR.current, 0, -2.8 + s * 0.15);
        set(foreL.current, 0);
        set(foreR.current, 0);
        set(legL.current, 0, 0.12);
        set(legR.current, 0, -0.12);
        set(shinL.current, 0);
        set(shinR.current, 0);
        break;
      }
      case "walk": {
        const w = Math.sin(t * 6);
        hipY(0.9 + Math.abs(Math.cos(t * 6)) * 0.03);
        set(torso.current, 0.05);
        set(head.current, 0);
        set(armL.current, w * 0.5, 0.06);
        set(armR.current, -w * 0.5, -0.06);
        set(foreL.current, -0.25);
        set(foreR.current, -0.25);
        set(legL.current, -w * 0.5);
        set(legR.current, w * 0.5);
        set(shinL.current, Math.max(0, w) * 0.7);
        set(shinR.current, Math.max(0, -w) * 0.7);
        break;
      }
      case "prep": {
        hipY(0.9);
        set(torso.current, 0.22);
        set(head.current, 0.35);
        set(armL.current, -0.9, 0.2);
        set(armR.current, -0.9 + Math.sin(t * 5) * 0.12, -0.2);
        set(foreL.current, -0.8);
        set(foreR.current, -0.8 + Math.sin(t * 5) * 0.2);
        set(legL.current, 0, 0.05);
        set(legR.current, 0, -0.05);
        set(shinL.current, 0);
        set(shinR.current, 0);
        break;
      }
      default: {
        hipY(0.9);
        set(torso.current, Math.sin(t) * 0.01);
        set(head.current, 0);
        [armL, armR, foreL, foreR, legL, legR, shinL, shinR].forEach((r) => set(r.current, 0));
      }
    }
  });

  const skin = <meshStandardMaterial color="#d9d3e6" roughness={0.55} metalness={0.05} emissive={tint} emissiveIntensity={0.6} />;
  const cloth = <meshStandardMaterial color="#3b3550" roughness={0.8} emissive={tint} emissiveIntensity={0.4} />;

  return (
    <group position={position} rotation={rotation}>
      <group ref={hips} position={[0, 0.9, 0]}>
        {/* torso */}
        <group ref={torso}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <capsuleGeometry args={[0.17, 0.32, 6, 12]} />
            {cloth}
          </mesh>
          <group ref={head} position={[0, 0.62, 0]}>
            <mesh position={[0, 0.1, 0]} castShadow>
              <sphereGeometry args={[0.12, 20, 16]} />
              {skin}
            </mesh>
          </group>
          {/* arms */}
          {(
            [
              [armL, foreL, 0.23],
              [armR, foreR, -0.23],
            ] as const
          ).map(([arm, fore, x], i) => (
            <group key={i} ref={arm} position={[x, 0.5, 0]}>
              <mesh position={[0, -0.15, 0]} castShadow>
                <capsuleGeometry args={[0.055, 0.2, 4, 8]} />
                {cloth}
              </mesh>
              <group ref={fore} position={[0, -0.3, 0]}>
                <mesh position={[0, -0.14, 0]} castShadow>
                  <capsuleGeometry args={[0.045, 0.2, 4, 8]} />
                  {skin}
                </mesh>
              </group>
            </group>
          ))}
        </group>
        {/* legs */}
        {(
          [
            [legL, shinL, 0.1],
            [legR, shinR, -0.1],
          ] as const
        ).map(([leg, shin, x], i) => (
          <group key={i} ref={leg} position={[x, 0, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.075, 0.3, 4, 8]} />
              <meshStandardMaterial color="#24202f" roughness={0.85} emissive={tint} emissiveIntensity={0.4} />
            </mesh>
            <group ref={shin} position={[0, -0.45, 0]}>
              <mesh position={[0, -0.21, 0]} castShadow>
                <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
                <meshStandardMaterial color="#24202f" roughness={0.85} emissive={tint} emissiveIntensity={0.4} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}
