"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThreeElements } from "@react-three/fiber";
import type { VoxelModelData } from "./builder";

/* One shared geometry per voxel size, one shared material per layer: hundreds of models, a handful of programs. */
const geoCache = new Map<number, THREE.BoxGeometry>();
function boxGeo(size: number) {
  if (!geoCache.has(size)) geoCache.set(size, new THREE.BoxGeometry(size, size, size));
  return geoCache.get(size)!;
}
const solidMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.86, metalness: 0.02 });
const glowMats = new Map<number, THREE.MeshBasicMaterial>();
function glowMat(intensity: number) {
  const k = Math.round(intensity * 20) / 20;
  if (!glowMats.has(k)) {
    const m = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    m.color.setScalar(k); // instance colours multiply this, so >1 pushes glow voxels into bloom
    glowMats.set(k, m);
  }
  return glowMats.get(k)!;
}

const _m = new THREE.Matrix4();
const _col = new THREE.Color();

function fill(mesh: THREE.InstancedMesh, layer: VoxelModelData["solid"]) {
  for (let i = 0; i < layer.count; i++) {
    _m.makeTranslation(layer.positions[i * 3], layer.positions[i * 3 + 1], layer.positions[i * 3 + 2]);
    mesh.setMatrixAt(i, _m);
    _col.setRGB(layer.colors[i * 3], layer.colors[i * 3 + 1], layer.colors[i * 3 + 2]);
    mesh.setColorAt(i, _col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/**
 * Renders a baked voxel model as (at most) two instanced draw calls:
 * lit voxels (cast + receive shadows) and unlit glowing voxels (screens, LEDs, lamp shades).
 */
export function VoxelModel({
  data,
  glow = 1.6,
  castShadow = true,
  receiveShadow = true,
  ...group
}: {
  data: VoxelModelData;
  glow?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
} & Omit<ThreeElements["group"], "children">) {
  const solid = useRef<THREE.InstancedMesh>(null);
  const lit = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => boxGeo(data.size), [data.size]);

  useLayoutEffect(() => {
    if (solid.current) fill(solid.current, data.solid);
    if (lit.current) fill(lit.current, data.glow);
  }, [data]);

  return (
    <group {...group}>
      {data.solid.count > 0 && (
        <instancedMesh ref={solid} args={[geo, undefined, data.solid.count]} material={solidMat} castShadow={castShadow} receiveShadow={receiveShadow} />
      )}
      {data.glow.count > 0 && <instancedMesh ref={lit} args={[geo, undefined, data.glow.count]} material={glowMat(glow)} />}
    </group>
  );
}
