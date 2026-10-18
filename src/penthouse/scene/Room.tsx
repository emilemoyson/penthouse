"use client";

import { useMemo } from "react";
import { MeshReflectorMaterial } from "@react-three/drei";
import { makeSkylineTexture } from "./skyline";
import { artPrint, plaster, roundRug, woodFloor } from "../look/textures";
import { ArcLamp, BookRow, BookStack, C, Candle, Frame, Plant, TableLamp, Vase } from "../look/decor";
import { Bookshelf, CoffeeTable, Curtain, LoungeChair, RecordConsole, SideTable, Sofa } from "../look/furniture";
import { GlowLight } from "./lights";

export const ROOM = { w: 18, d: 12, h: 4.2 };
const HW = ROOM.w / 2;
const HD = ROOM.d / 2;

/** The apartment shell: oak floor, lime-wash wall, floor-to-ceiling glass with linen curtains, the city, and the living room. */
export function Room({ reflective = true }: { reflective?: boolean }) {
  const floor = useMemo(() => woodFloor([4, 2.7]), []);
  const wall = useMemo(() => plaster("#6b5648", [3, 1]), []);
  const sky = useMemo(() => makeSkylineTexture(), []);
  const rug = useMemo(() => roundRug("#d9cbb3", "#b8643f", "#8a9f7f"), []);

  return (
    <group>
      {/* ---------- oak floor ---------- */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        {reflective ? (
          <MeshReflectorMaterial
            map={floor}
            resolution={512}
            blur={[400, 120]}
            mixBlur={1}
            mixStrength={0.55}
            roughness={0.7}
            depthScale={0.5}
            minDepthThreshold={0.5}
            maxDepthThreshold={1.2}
            metalness={0.1}
            mirror={0.25}
            color="#ffffff"
          />
        ) : (
          <meshStandardMaterial map={floor} roughness={0.6} />
        )}
      </mesh>
      <mesh position={[0, -0.16, 0]}>
        <boxGeometry args={[ROOM.w + 0.3, 0.3, ROOM.d + 0.3]} />
        <meshStandardMaterial color="#1a1411" roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.32, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color="#0b0908" />
      </mesh>

      {/* ---------- glass wall ---------- */}
      <group position={[0, 0, -HD]}>
        <mesh position={[0, ROOM.h - 0.1, 0]} castShadow>
          <boxGeometry args={[ROOM.w, 0.2, 0.25]} />
          <meshStandardMaterial color="#1c1714" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[ROOM.w, 0.1, 0.25]} />
          <meshStandardMaterial color="#1c1714" roughness={0.6} />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => -HW + i * 3).map((x) => (
          <mesh key={x} position={[x, ROOM.h / 2, 0]} castShadow>
            <boxGeometry args={[0.07, ROOM.h, 0.12]} />
            <meshStandardMaterial color="#2a2420" metalness={0.5} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, ROOM.h / 2, 0.02]}>
          <planeGeometry args={[ROOM.w, ROOM.h]} />
          <meshStandardMaterial color="#9bb0d6" transparent opacity={0.05} roughness={0.05} metalness={0.9} depthWrite={false} />
        </mesh>
        {/* curtain track + sheer linen panels, gathered at the ends and between rooms */}
        <mesh position={[0, ROOM.h - 0.22, 0.25]}>
          <boxGeometry args={[ROOM.w, 0.025, 0.04]} />
          <meshStandardMaterial color={C.black} />
        </mesh>
        <Curtain width={1.4} position={[-HW + 0.75, ROOM.h - 0.22, 0.28]} />
        <Curtain width={1.0} position={[-1.6, ROOM.h - 0.22, 0.28]} />
        <Curtain width={1.0} position={[2.2, ROOM.h - 0.22, 0.28]} />
        <Curtain width={1.4} position={[HW - 0.75, ROOM.h - 0.22, 0.28]} />
      </group>

      {/* ---------- the city ---------- */}
      <mesh position={[0, 4.5, -26]}>
        <planeGeometry args={[96, 24]} />
        <meshBasicMaterial map={sky} toneMapped={false} color="#b4aec4" />
      </mesh>
      <GlowLight position={[0, 2.2, -7.5]} color="#6a5aa0" intensity={4} distance={9} />

      {/* ---------- left wall ---------- */}
      <mesh position={[-HW - 0.1, ROOM.h / 2, 0]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.d, ROOM.h]} />
        <meshStandardMaterial map={wall} roughness={0.95} />
      </mesh>
      <mesh position={[-HW - 0.2, ROOM.h / 2, 0]}>
        <boxGeometry args={[0.2, ROOM.h, ROOM.d]} />
        <meshStandardMaterial color="#120e0c" />
      </mesh>
      {/* oak skirting */}
      <mesh position={[-HW - 0.08, 0.06, 0]}>
        <boxGeometry args={[0.03, 0.12, ROOM.d]} />
        <meshStandardMaterial color={C.oak} roughness={0.6} />
      </mesh>
      {/* gallery wall above the bed */}
      <Frame w={0.62} h={0.8} map={artPrint(0)} position={[-HW - 0.07, 2.15, -4.0]} rotation-y={Math.PI / 2} />
      <Frame w={0.5} h={0.62} map={artPrint(1)} position={[-HW - 0.07, 2.05, -2.95]} rotation-y={Math.PI / 2} frame={C.oak} />

      {/* ---------- living room ---------- */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0.35]} receiveShadow>
        <circleGeometry args={[1.7, 64]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <Sofa position={[0, 0, 1.25]} />
      <CoffeeTable position={[0, 0, 0.05]} />
      <BookStack position={[-0.15, 0.4, 0.05]} count={3} seed={4} />
      <Vase position={[0.22, 0.4, -0.12]} />
      <Candle position={[0.2, 0.4, 0.2]} />
      <Candle position={[0.3, 0.4, 0.14]} h={0.07} />
      <LoungeChair position={[2.15, 0, -0.05]} rotation-y={-1.0} />
      <SideTable position={[2.0, 0, 0.85]} />
      <Candle position={[2.0, 0.535, 0.85]} light={0.6} />
      <ArcLamp position={[-1.85, 0, 1.55]} rotation-y={-0.5} />
      <Plant kind="monstera" position={[2.7, 0, -1.25]} scale={1.5} seed={3} pot={C.cream} />
      <Plant kind="olive" position={[-2.0, 0, -0.9]} scale={1.15} seed={5} pot={C.terracotta} />

      {/* turntable corner by the glass */}
      <RecordConsole position={[-2.35, 0, -5.55]} />
      <TableLamp position={[-2.95, 0.54, -5.55]} height={0.45} base={C.terracotta} intensity={2.2} />

      {/* bookshelf between the living room and the gym */}
      <Bookshelf position={[-3.3, 0, 1.0]} rotation-y={Math.PI / 2}>
        <BookRow width={0.75} seed={1} position={[0, 0.035, 0]} />
        <BookRow width={0.5} seed={2} position={[-0.15, 0.465, 0]} />
        <Plant kind="pothos" position={[0.28, 0.465, 0]} seed={2} pot={C.cream} />
        <BookRow width={0.6} seed={3} position={[0.1, 0.915, 0]} />
        <Vase position={[-0.3, 0.915, 0]} color={C.terracotta} />
        <BookStack position={[-0.2, 1.365, 0]} count={4} seed={9} />
        <Plant kind="herb" position={[0.25, 1.365, 0]} seed={4} scale={1.6} pot={C.sage} />
      </Bookshelf>
    </group>
  );
}
