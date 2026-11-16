"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "../zones";
import { labelEls, shelfLabel } from "../labels";
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
  // the connector bookshelf stands inside a room's click area: when it is the nearest thing hit, let it take the click
  const onShelf = (e: ThreeEvent<MouseEvent | PointerEvent>) => !!e.intersections[0]?.object.userData.shelf;
  const over = (e: ThreeEvent<PointerEvent>) => {
    if (onShelf(e)) return;
    e.stopPropagation();
    if (interactive) hover(id);
  };
  const out = () => hovered && hover(null);
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (onShelf(e)) return;
    e.stopPropagation();
    if (e.delta > 6) return; // the pointer moved: that was a drag to turn the view
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
    const spots: [HTMLElement | null | undefined, number, number, number][] = ZONES.map((z) => [labelEls.get(z.id), z.anchor[0], z.labelY, z.anchor[2]]);
    spots.push([shelfLabel.el, ...shelfLabel.at]);
    for (const [el, px, py, pz] of spots) {
      if (!el) continue;
      v.current.set(px, py, pz).project(camera);
      const behind = v.current.z > 1;
      const x = ((v.current.x + 1) / 2) * size.width;
      const y = ((1 - v.current.y) / 2) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.visibility = behind ? "hidden" : "visible";
    }
  });
  return null;
}
