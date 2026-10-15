"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "../zones";
import { labelEls } from "../labels";
import type { ThreeEvent } from "@react-three/fiber";
import { useZone, type ZoneId } from "../store";

/**
 * Wraps a zone's meshes: hover highlight and click-to-focus. (Labels live in the DOM, see LabelProjector.)
 * `hitbox` is an invisible box that makes the whole area easy to click, not just thin meshes.
 */
export function Zone({ id, children, hitbox }: { id: ZoneId; children: ReactNode; hitbox: { size: [number, number, number]; position: [number, number, number] } }) {
  const hovered = useZone((s) => s.hovered === id);
  const phase = useZone((s) => s.phase);
  const hover = useZone((s) => s.hover);
  const focus = useZone((s) => s.focus);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  const interactive = phase === "overview";
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (interactive) hover(id);
  };
  const out = () => hovered && hover(null);
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (phase === "overview") focus(id);
  };

  return (
    <group onPointerOver={over} onPointerOut={out} onClick={click}>
      {children}
      <mesh position={hitbox.position} visible={false}>
        <boxGeometry args={hitbox.size} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

/** Emissive strength for accent pieces: brighter on hover or while focused. */
export function useGlow(id: ZoneId, base = 1.2) {
  const hovered = useZone((s) => s.hovered === id);
  const active = useZone((s) => s.zone === id);
  return hovered ? base * 1.4 : active ? base * 1.1 : base;
}

/** Projects each zone's anchor to screen space and moves its DOM label there. Cheap: no React renders per frame. */
export function LabelProjector() {
  const v = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    for (const z of ZONES) {
      const el = labelEls.get(z.id);
      if (!el) continue;
      v.current.set(z.anchor[0], z.labelY, z.anchor[2]).project(camera);
      const behind = v.current.z > 1;
      const x = ((v.current.x + 1) / 2) * size.width;
      const y = ((1 - v.current.y) / 2) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.visibility = behind ? "hidden" : "visible";
    }
  });
  return null;
}
