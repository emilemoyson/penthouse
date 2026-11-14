"use client";

import { Zone, useGlow } from "../scene/Zone";
import { Character } from "../characters/Character";
import { GlowLight } from "../scene/lights";
import { Desk as DeskTop, KeyboardMouse, LaptopOnStand, Monitor, OfficeChair } from "../look/furniture";
import { BookStack, C, DeskLamp, Mug, Plant } from "../look/decor";
import { berberRug } from "../look/textures";
import { useMemo } from "react";
import { useAmbient } from "../ambient";

/** 🖥️ Office: walnut desk facing the city, ultrawide on an arm, laptop on a stand, desk lamp, plants. Emile at work. */
export function Desk() {
  const glow = useGlow("desk", 1);
  // the lamp dims as the to-do list clears
  const lamp = useAmbient((s) => s.officeLight);
  const rug = useMemo(() => berberRug("#3f3a35", "#8a7a66"), []);
  const top = 0.76;
  return (
    <Zone id="desk" hitbox={{ size: [2.6, 1.8, 2.4], position: [4.6, 0.9, -4.6] }}>
      <mesh rotation-x={-Math.PI / 2} position={[4.6, 0.006, -4.75]} receiveShadow>
        <planeGeometry args={[2.4, 1.9]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <DeskTop position={[4.6, 0, -5.3]} />
      <group position={[4.6, top, -5.3]}>
        <Monitor glow={glow} position={[-0.15, 0, 0]} />
        <KeyboardMouse position={[-0.15, 0, 0.17]} />
        <LaptopOnStand glow={glow} position={[0.55, 0, -0.05]} rotation-y={-0.3} />
        <DeskLamp position={[-0.68, 0, -0.18]} rotation-y={-0.4} intensity={2.4 * glow * lamp} />
        <Mug position={[0.3, 0, 0.2]} color={C.cream} />
        <BookStack position={[-0.6, 0, 0.15]} count={2} seed={11} />
        <Plant kind="herb" position={[0.68, 0, 0.25]} scale={1.4} seed={6} pot={C.terracotta} />
      </group>
      <OfficeChair position={[4.45, 0, -4.48]} rotation-y={0.05} />
      <Plant kind="monstera" position={[6.1, 0, -5.45]} scale={1.2} seed={12} pot={C.black} />

      {/* ===== IDLE: you, working =====
          HOOK: swap for <Avatar url="/models/emile.glb" action="type" /> */}
      <Character action="type" outfit="emile" position={[4.45, 0, -4.5]} rotation={[0, Math.PI, 0]} />

      {/* cool spill from the screens */}
      <GlowLight position={[4.45, 1.3, -5.0]} color="#7fb3ff" intensity={2.6 * glow * (0.4 + 0.6 * lamp)} distance={3.5} shadow />
    </Zone>
  );
}
