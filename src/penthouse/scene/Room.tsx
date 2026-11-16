"use client";

import { useEffect, useMemo, useState } from "react";
import { MeshReflectorMaterial } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useZone } from "../store";
import { makeSkylineTexture } from "./skyline";
import { NightSky } from "./NightSky";
import { artPrint, brick, roundRug, woodFloor } from "../look/textures";
import { ArcLamp, BookRow, BookStack, C, Candle, Frame, Plant, TableLamp, Vase } from "../look/decor";
import { Bookshelf, Curtain, LoungeChair, RecordConsole, SideTable } from "../look/furniture";
import { GlowLight } from "./lights";
import { Neighbourhood } from "./Neighbourhood";

export const ROOM = { w: 11, d: 10, h: 3.6 };
const HW = ROOM.w / 2;
const HD = ROOM.d / 2;

/** The apartment shell: oak floor, lime-wash wall, floor-to-ceiling glass with linen curtains, the city, and the living room. */
export function Room({ reflective = true }: { reflective?: boolean }) {
  const floor = useMemo(() => woodFloor([2.4, 2.2]), []);
  const wall = useMemo(() => brick([4.5, 1.8]), []);
  const header = useMemo(() => brick([5, 0.45]), []);
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

      {/* ---------- glass wall ---------- */}
      <group position={[0, 0, -HD]}>
        <mesh position={[0, ROOM.h - 0.1, 0]} castShadow>
          <boxGeometry args={[ROOM.w, 0.2, 0.25]} />
          <meshStandardMaterial color="#1c1714" roughness={0.6} />
        </mesh>
        {/* exposed brick above the factory windows and at both ends, like an old walk-up */}
        <mesh position={[0, ROOM.h - 0.45, 0.05]} receiveShadow>
          <boxGeometry args={[ROOM.w + 0.4, 0.9, 0.35]} />
          <meshStandardMaterial map={header} roughness={0.92} color="#e6d6c8" />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={`pier${s}`} position={[s * (HW + 0.05), ROOM.h / 2, 0.05]} castShadow receiveShadow>
            <boxGeometry args={[0.5, ROOM.h, 0.35]} />
            <meshStandardMaterial map={wall} roughness={0.92} color="#e6d6c8" />
          </mesh>
        ))}
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[ROOM.w, 0.1, 0.25]} />
          <meshStandardMaterial color="#1c1714" roughness={0.6} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => -HW + i * 1.375).map((x) => (
          <mesh key={x} position={[x, ROOM.h / 2, 0]} castShadow>
            <boxGeometry args={[0.09, ROOM.h, 0.12]} />
            <meshStandardMaterial color="#141414" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        {/* steel transoms: the classic factory-window grid */}
        {[0.9, 1.8, 2.7].map((y) => (
          <mesh key={`tr${y}`} position={[0, y, 0]}>
            <boxGeometry args={[ROOM.w, 0.05, 0.08]} />
            <meshStandardMaterial color="#141414" metalness={0.6} roughness={0.4} />
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
        <Curtain width={0.8} position={[-HW + 0.45, ROOM.h - 0.22, 0.28]} />
        <Curtain width={0.8} position={[HW - 0.45, ROOM.h - 0.22, 0.28]} />
      </group>

      {/* ---------- the city: Manhattan across the river, and the neighbourhood around the building ---------- */}
      <mesh position={[-12, 0, -31]}>
        <planeGeometry args={[114, 38]} />
        <meshBasicMaterial map={sky} toneMapped={false} color="#8f88a4" fog={false} />
      </mesh>
      <Neighbourhood />
      <GlowLight position={[0, 2.2, -6]} color="#6a5aa0" intensity={4} distance={9} />
      {/* neon from the street: pink on one side, cyan on the other */}
      <GlowLight position={[-3.2, 2.4, -4.4]} color="#ff3d9a" intensity={5} distance={7} />
      <GlowLight position={[3.6, 2.6, -4.4]} color="#2fd6ff" intensity={4} distance={7} />
      <NightSky />

      {/* ---------- left wall ---------- */}
      <mesh position={[-HW - 0.09, ROOM.h / 2, 0]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.d, ROOM.h]} />
        <meshStandardMaterial map={wall} roughness={0.92} color="#e6d6c8" emissive="#ffffff" emissiveMap={wall} emissiveIntensity={0.12} />
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
      <Frame w={0.62} h={0.8} map={artPrint(0)} position={[-HW - 0.07, 2.35, -2.6]} rotation-y={Math.PI / 2} />
      <Frame w={0.5} h={0.62} map={artPrint(1)} position={[-HW - 0.07, 2.25, -1.7]} rotation-y={Math.PI / 2} frame={C.oak} />
      {/* gallery wall over the gym and living side */}
      <Frame w={0.9} h={1.2} map={artPrint(2)} position={[-HW - 0.07, 2.3, 3.3]} rotation-y={Math.PI / 2} />
      <Frame w={0.55} h={0.7} map={artPrint(0)} position={[-HW - 0.07, 2.7, -0.6]} rotation-y={Math.PI / 2} frame={C.oak} />
      <Frame w={0.45} h={0.55} map={artPrint(1)} position={[-HW - 0.07, 2.0, -0.55]} rotation-y={Math.PI / 2} />
      {/* warm string lights draped along the brick */}
      {Array.from({ length: 22 }, (_, i) => {
        const z = -4.8 + i * 0.45;
        const y = 3.3 - Math.abs(Math.sin((i / 21) * Math.PI * 3)) * 0.35;
        return (
          <mesh key={`bulb${i}`} position={[-HW - 0.02, y, z]}>
            <sphereGeometry args={[0.03, 10, 8]} />
            <meshBasicMaterial color="#ffcf8a" toneMapped={false} />
          </mesh>
        );
      })}
      <GlowLight position={[-HW + 0.6, 3.0, -2.2]} color="#ffb870" intensity={1.6} distance={6} />
      <GlowLight position={[-HW + 0.6, 3.0, 2.2]} color="#ffb870" intensity={1.6} distance={6} />

      {/* ---------- the middle: a rug, a leather armchair, records and plants ---------- */}
      <mesh rotation-x={-Math.PI / 2} position={[0.4, 0.006, -0.9]} receiveShadow>
        <circleGeometry args={[1.25, 64]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <LoungeChair position={[0.1, 0, -1.5]} rotation-y={0.5} />
      <SideTable position={[0.95, 0, -1.0]} />
      <Candle position={[0.95, 0.535, -1.0]} light={0.6} />
      <BookStack position={[0.9, 0, -0.35]} count={5} seed={4} />
      <ArcLamp position={[-0.75, 0, -2.3]} rotation-y={0.9} />

      {/* turntable corner by the window, monstera beside it */}
      <RecordConsole position={[0.0, 0, -4.55]} />
      <TableLamp position={[-0.6, 0.54, -4.55]} height={0.45} base={C.terracotta} intensity={2.2} />
      <Plant kind="monstera" position={[1.25, 0, -4.35]} scale={1.4} seed={3} pot={C.cream} />
      <Plant kind="olive" position={[-4.9, 0, 4.5]} scale={1.1} seed={5} pot={C.terracotta} />

      {/* cast-iron radiator under the window */}
      <group position={[-1.7, 0, -4.75]}>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[i * 0.09 - 0.36, 0.36, 0]} castShadow>
            <boxGeometry args={[0.06, 0.6, 0.16]} />
            <meshStandardMaterial color="#d8d2c6" roughness={0.5} metalness={0.3} />
          </mesh>
        ))}
      </group>

      {/* fire escape outside the factory windows */}
      <group position={[1.5, 0, -HD - 0.75]}>
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[4.6, 0.06, 1.2]} />
          <meshStandardMaterial color="#17141a" roughness={0.7} metalness={0.5} />
        </mesh>
        {[0.5, 1.0].map((y) => (
          <mesh key={y} position={[0, y, -0.58]}>
            <boxGeometry args={[4.6, 0.04, 0.04]} />
            <meshStandardMaterial color="#17141a" metalness={0.5} />
          </mesh>
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[-2.3 + i * 0.418, 0.5, -0.58]}>
            <boxGeometry args={[0.03, 1.0, 0.03]} />
            <meshStandardMaterial color="#17141a" metalness={0.5} />
          </mesh>
        ))}
        {/* ladder up to the next landing */}
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[1.7 + x, 1.9, -0.2]} rotation-x={0.12}>
            <boxGeometry args={[0.04, 3.9, 0.04]} />
            <meshStandardMaterial color="#17141a" metalness={0.5} />
          </mesh>
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={`r${i}`} position={[1.7, 0.3 + i * 0.36, -0.2 - (0.3 + i * 0.36 - 1.9) * 0.12]}>
            <boxGeometry args={[0.44, 0.03, 0.03]} />
            <meshStandardMaterial color="#17141a" metalness={0.5} />
          </mesh>
        ))}
      </group>

      <ConnectorShelf />
    </group>
  );
}

const SPINES = ["#e5484d", "#3b82f6", "#22c55e", "#fb923c", "#38bdf8", "#e879f9"];

/**
 * The bookshelf between the bed and the gym is where the connectors live: one thick book per source,
 * glowing when it is connected and dull when it is not. Clicking the shelf opens the connector list.
 */
function ConnectorShelf() {
  const lit = useZone((s) => s.lit);
  const open = useZone((s) => s.shelf);
  const [hot, setHot] = useState(false);
  useEffect(() => {
    if (hot) document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hot]);
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return; // a drag, not a click
    const st = useZone.getState();
    if (st.phase === "overview") st.setShelf(true);
  };
  return (
    <group
      position={[-3.2, 0, -0.1]}
      onClick={click}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHot(true);
      }}
      onPointerOut={() => setHot(false)}
    >
      <Bookshelf>
        <BookRow width={0.75} seed={1} position={[0, 0.035, 0]} />
        <BookRow width={0.5} seed={2} position={[-0.15, 0.465, 0]} />
        <Plant kind="pothos" position={[0.28, 0.465, 0]} seed={2} pot={C.cream} />
        <BookRow width={0.6} seed={3} position={[0.1, 0.915, 0]} />
        <Vase position={[-0.3, 0.915, 0]} color={C.terracotta} />
        {SPINES.map((c, i) => {
          const on = !!lit[i];
          return (
            <mesh key={c} position={[-0.3 + i * 0.085, 1.365 + 0.15, 0]} rotation-z={i === 5 ? -0.18 : 0}>
              <boxGeometry args={[0.07, 0.3 - (i % 3) * 0.02, 0.2]} />
              <meshStandardMaterial color={on ? c : "#4a4550"} emissive={c} emissiveIntensity={on ? (hot || open ? 2.4 : 1.3) : 0} roughness={0.6} toneMapped={false} />
            </mesh>
          );
        })}
        <Plant kind="herb" position={[0.33, 1.365, 0]} seed={4} scale={1.3} pot={C.sage} />
      </Bookshelf>
      <GlowLight position={[0, 1.6, 0.5]} color="#ffb870" intensity={hot || open ? 3 : 1.2} distance={3} />
      <mesh position={[0, 0.95, 0]} visible={false} userData={{ shelf: true }}>
        <boxGeometry args={[1.2, 1.9, 0.6]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
