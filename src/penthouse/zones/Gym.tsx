"use client";

import { useEffect, useState } from "react";
import { Zone, useGlow } from "../scene/Zone";
import { Character, type Action } from "../characters/Character";
import { GlowLight } from "../scene/lights";
import { Bike, DumbbellRack, FlatBench, Kettlebell, LeaningMirror, YogaMat } from "../look/furniture";
import { C, Plant } from "../look/decor";
import { useAmbient } from "../ambient";

/** 🏋️ Home gym corner: rubber floor, dumbbell rack, bench, bike, leaning mirror. Coach agent loops squats and stretches. */
export function Gym() {
  const glow = useGlow("gym", 1);
  // the gym lights up on a day you trained, and sits low otherwise
  const trained = useAmbient((s) => s.trainedToday);
  const lit = trained ? 1.25 : 0.55;
  const [action, setAction] = useState<Action>("squat");
  useEffect(() => {
    const id = setInterval(() => setAction((a) => (a === "squat" ? "stretch" : "squat")), 45000);
    return () => clearInterval(id);
  }, []);

  return (
    <Zone id="gym" hitbox={{ size: [2.64, 1.44, 2.16], position: [-6.6, 1.2, 3.2] }}>
      {/* rubber gym floor */}
      <mesh rotation-x={-Math.PI / 2} position={[-6.7, 0.006, 3.2]} receiveShadow>
        <planeGeometry args={[4.4, 3.4]} />
        <meshStandardMaterial color="#25221f" roughness={0.95} />
      </mesh>
      <YogaMat position={[-5.2, 0.01, 3.4]} />
      <DumbbellRack position={[-8.55, 0, 2.3]} />
      <FlatBench position={[-7.1, 0, 2.6]} />
      <Bike position={[-7.3, 0, 4.4]} rotation-y={Math.PI / 2 + 0.3} />
      <Kettlebell position={[-6.3, 0, 1.75]} />
      <Kettlebell position={[-6.05, 0, 1.8]} s={0.8} color={C.terracotta} />
      <LeaningMirror position={[-8.9, 0, 4.2]} />
      <Plant kind="snake" position={[-8.5, 0, 1.1]} scale={1.2} seed={14} pot={C.cream} />

      {/* warm wall washer */}
      <mesh position={[-9.06, 2.62, 3.0]} rotation-y={Math.PI / 2}>
        <boxGeometry args={[2.6, 0.05, 0.07]} />
        <meshStandardMaterial color={C.brass} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[-9.04, 2.595, 3.0]} rotation-y={Math.PI / 2}>
        <boxGeometry args={[2.5, 0.012, 0.03]} />
        <meshBasicMaterial color={trained ? "#ffcf96" : "#6b5a48"} toneMapped={false} />
      </mesh>
      <GlowLight position={[-8.4, 2.5, 3.0]} color="#ffbf80" intensity={5 * glow * lit} distance={6} />
      <GlowLight position={[-5.6, 2.8, 3.6]} color="#ffd2a0" intensity={4 * glow * lit} distance={6} shadow />
      {/* always mounted so the light count never changes (no shader recompile) */}
      <GlowLight position={[-6.6, 0.4, 3.3]} color="#9085e9" intensity={trained ? 3.5 : 0} distance={4.5} />

      {/* ===== IDLE: sub-agent "coach" training ===== */}
      <Character action={action} outfit="coach" position={[-5.2, 0.015, 3.3]} rotation={[0, 0.6, 0]} />
    </Zone>
  );
}
