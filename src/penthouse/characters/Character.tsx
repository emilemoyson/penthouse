"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { fabric } from "../look/textures";
import { nyHour, skyAt } from "../ambient";
import { OUTFITS, type Outfit, type OutfitId } from "./outfits";

export type Action = "sleep" | "type" | "squat" | "stretch" | "cycle" | "walk" | "prep" | "idle";

/** Rig measurements (metres). Feet at y = 0, facing +Z, ~1.85 m tall. */
export const RIG = {
  hipY: 0.92,
  hipX: 0.1,
  thigh: 0.44,
  shin: 0.48, // knee → sole
  shoulderY: 0.47,
  shoulderX: 0.215,
  neckY: 0.55,
  upperArm: 0.28,
};

/* ------------------------------------------------------------------ */
/* paint                                                               */
/* ------------------------------------------------------------------ */

/**
 * Painterly look: a toon material with a soft light ramp, so surfaces read as painted bands of colour.
 * The shader patch below keeps the figures in their own colours whatever lamp they stand under (no
 * blown-out faces), gives the shadow side a violet floor, and adds a coloured rim light: pink at night,
 * amber at golden hour, pale by day.
 */
const PAINT_RAMP = (() => {
  const d = new Uint8Array([70, 120, 190, 232, 255]);
  const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();
const INK = "#1d1411";

const RIM = { value: new THREE.Color("#ff4fa8") };
const RIM_K = { value: 0.4 };
/** Rim light follows the sky: pink neon at night, warm white by day, orange at golden hour. Daylight calls this as the hour moves. */
export function setRim(s: { day: number; golden: number }) {
  RIM.value.set("#ff4fa8").lerp(new THREE.Color("#fff1d8"), s.day).lerp(new THREE.Color("#ffa24a"), s.golden * 0.8);
  RIM_K.value = 0.42 - 0.26 * s.day + 0.14 * s.golden;
}
if (typeof window !== "undefined") setRim(skyAt(nyHour()));

function tune(shader: { uniforms: Record<string, unknown>; fragmentShader: string }) {
  shader.uniforms.uRim = RIM;
  shader.uniforms.uRimK = RIM_K;
  shader.fragmentShader = shader.fragmentShader
    .replace("void main() {", "uniform vec3 uRim;\nuniform float uRimK;\nvoid main() {")
    .replace(
      "#include <opaque_fragment>",
      `vec3 paintBase = diffuseColor.rgb;
      const vec3 paintW = vec3(0.299, 0.587, 0.114);
      // keep the figure's own colour: take how bright the light is, and only a little of its tint
      float paintL = min(dot(outgoingLight, paintW) / max(dot(paintBase, paintW), 0.02), 1.0);
      vec3 paintTint = outgoingLight / max(dot(outgoingLight, paintW), 0.001);
      vec3 paintLit = paintBase * paintL * mix(vec3(1.0), paintTint, 0.22);
      outgoingLight = max(paintLit, paintBase * vec3(0.22, 0.17, 0.32)) + totalEmissiveRadiance;
      float paintRim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
      outgoingLight += paintRim * uRim * uRimK * (0.3 + paintBase);
      #include <opaque_fragment>`,
    );
}
const paintKey = () => "figure-paint-2";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Mat({ color, rough = 0.9, map, metal = 0, emissive, side }: { color: string; rough?: number; map?: THREE.Texture; metal?: number; emissive?: string; side?: THREE.Side }) {
  return (
    <meshToonMaterial
      color={color}
      map={map}
      gradientMap={PAINT_RAMP}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={emissive ? 1.5 : 0}
      side={side ?? THREE.FrontSide}
      onBeforeCompile={tune}
      customProgramCacheKey={paintKey}
    />
  );
}
const Ink = ({ t = 0.007 }: { t?: number }) => <Outlines thickness={t} color={INK} />;

const mix = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getStyle();

/* ------------------------------------------------------------------ */
/* head: a long face with a tapered jaw, and a painted face on it       */
/* ------------------------------------------------------------------ */

const HC = 0.2; // head centre above the base of the neck

/** A point on the head for a unit direction: taller than wide, narrowing to the chin. */
function headPoint(d: THREE.Vector3, grow = 1, out = new THREE.Vector3()) {
  const t = Math.max(0, -d.y);
  const x = d.x * 0.104 * (1 - 0.36 * Math.pow(t, 1.5));
  const y = d.y * (d.y < 0 ? 0.142 : 0.128);
  const z = d.z * 0.116 * (d.z > 0 ? 1 - 0.1 * t * t : 1 - 0.3 * Math.pow(t, 1.3));
  return out.set(x * grow, y * grow, z * grow);
}
function shapeHead<T extends THREE.BufferGeometry>(g: T, grow = 1): T {
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    headPoint(v, grow, v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  return g;
}
const headGeo = shapeHead(new THREE.SphereGeometry(1, 44, 36));
// the face is a painted patch on the front of the head (+Z); see faceTexture for where things sit on it
const FACE = { phi: 1.05, th0: 0.2 * Math.PI, th: 0.62 * Math.PI };
const faceGeo = shapeHead(new THREE.SphereGeometry(1, 36, 28, Math.PI / 2 - FACE.phi, FACE.phi * 2, FACE.th0, FACE.th), 1.012);
const capGeo = shapeHead(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.46), 1.035);
const fadeGeo = shapeHead(new THREE.SphereGeometry(1, 40, 14, Math.PI / 2 + 1.3, Math.PI * 2 - 2.6, Math.PI * 0.3, Math.PI * 0.3), 1.014);
const beanieGeo = shapeHead(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.47), 1.09);
const locGeo = new THREE.CapsuleGeometry(0.019, 1, 5, 10);
const UP = new THREE.Vector3(0, 1, 0);

const faceCache = new Map<string, THREE.CanvasTexture>();
/**
 * The face, painted once per character: heavy-lidded almond eyes, thick brows, full lips, and a few
 * brush strokes of shadow. 512 px square; the eye line is at y = 223, the mouth at y = 396.
 */
function faceTexture(o: Outfit, asleep: boolean) {
  const key = `${o.skin}|${o.hair}|${asleep}`;
  const hit = faceCache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 512;
  const c = cv.getContext("2d")!;
  const shade = mix(o.skin, "#3a1530", 0.45);
  const lid = mix(o.skin, "#3a1530", 0.18);
  const lipTop = mix(o.skin, "#6d2433", 0.62);
  const lipLow = mix(o.skin, "#b04a55", 0.5);
  const brow = mix(o.hair, "#000000", 0.25);
  c.lineCap = "round";
  c.lineJoin = "round";

  for (const s of [-1, 1]) {
    c.save();
    c.translate(256 + s * 100, 223);
    c.scale(s * 1.22, 1.22);
    // brush strokes of shadow: the eye socket and the cheek
    c.globalAlpha = 0.2;
    c.strokeStyle = shade;
    c.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(40 + i * 13, 72 + i * 4);
      c.lineTo(16 + i * 13, 114 + i * 6);
      c.stroke();
    }
    c.globalAlpha = 1;
    // brow: thick by the nose, tapering out
    c.fillStyle = brow;
    c.beginPath();
    c.moveTo(-54, -50);
    c.quadraticCurveTo(-10, -84, 34, -78);
    c.quadraticCurveTo(54, -72, 66, -54);
    c.quadraticCurveTo(30, -64, -4, -60);
    c.quadraticCurveTo(-30, -54, -50, -32);
    c.closePath();
    c.fill();

    if (asleep) {
      c.strokeStyle = INK;
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(-44, -4);
      c.quadraticCurveTo(0, 16, 48, -6);
      c.stroke();
      c.lineWidth = 3.5;
      for (const x of [-18, 6, 30]) {
        c.beginPath();
        c.moveTo(x, 6 - Math.abs(x) * 0.12);
        c.lineTo(x + 5, 18 - Math.abs(x) * 0.12);
        c.stroke();
      }
    } else {
      const eye = new Path2D();
      eye.moveTo(-46, 6);
      eye.bezierCurveTo(-26, -24, 22, -30, 48, -8);
      eye.bezierCurveTo(28, 22, -22, 24, -46, 6);
      eye.closePath();
      c.save();
      c.clip(eye);
      c.fillStyle = "#f3ede2";
      c.fillRect(-60, -40, 120, 80);
      c.fillStyle = "#3b2416";
      c.beginPath();
      c.arc(2, -2, 22, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#0e0907";
      c.beginPath();
      c.arc(2, -2, 12, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(-7, -9, 5, 0, Math.PI * 2);
      c.fill();
      // relaxed upper lid over the top of the iris
      c.fillStyle = lid;
      c.beginPath();
      c.moveTo(-60, -40);
      c.lineTo(60, -40);
      c.lineTo(60, -10);
      c.lineTo(50, -10);
      c.quadraticCurveTo(0, -20, -48, 2);
      c.lineTo(-60, 2);
      c.closePath();
      c.fill();
      c.restore();
      c.strokeStyle = INK;
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(-48, 3);
      c.quadraticCurveTo(0, -20, 50, -10);
      c.lineTo(59, -17);
      c.stroke();
      c.globalAlpha = 0.55;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(-40, 10);
      c.quadraticCurveTo(0, 25, 45, -3);
      c.stroke();
      c.strokeStyle = shade;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-40, -22);
      c.quadraticCurveTo(4, -44, 52, -26);
      c.stroke();
      c.globalAlpha = 1;
    }
    c.restore();
  }

  // shadow under the nose
  c.fillStyle = shade;
  c.globalAlpha = 0.4;
  c.beginPath();
  c.ellipse(256, 334, 36, 9, 0, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;

  // mouth: full lips, a soft closed smile
  c.save();
  c.translate(256, 396);
  c.fillStyle = lipTop;
  c.beginPath();
  c.moveTo(-56, -2);
  c.quadraticCurveTo(-26, -20, -8, -14);
  c.quadraticCurveTo(0, -9, 8, -14);
  c.quadraticCurveTo(26, -20, 56, -2);
  c.quadraticCurveTo(0, 8, -56, -2);
  c.fill();
  c.fillStyle = lipLow;
  c.beginPath();
  c.moveTo(-56, -2);
  c.quadraticCurveTo(0, 8, 56, -2);
  c.quadraticCurveTo(30, 30, 0, 30);
  c.quadraticCurveTo(-30, 30, -56, -2);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 3.5;
  c.beginPath();
  c.moveTo(-61, -6);
  c.quadraticCurveTo(0, 11, 61, -6);
  c.stroke();
  c.fillStyle = "#ffffff";
  c.globalAlpha = 0.16;
  c.beginPath();
  c.ellipse(-6, 15, 20, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 0.35;
  c.strokeStyle = shade;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(-26, 46);
  c.quadraticCurveTo(0, 54, 26, 46);
  c.stroke();
  c.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  faceCache.set(key, tex);
  return tex;
}

/** Hood worn up: a soft shell over the head, open at the face, with a rolled rim. */
function Hood({ o }: { o: Outfit }) {
  return (
    <group position={[0, HC + 0.012, -0.018]}>
      <mesh scale={[1, 1.1, 1.08]} castShadow>
        <sphereGeometry args={[0.158, 36, 24, Math.PI / 2 + 1.0, Math.PI * 2 - 2.0, 0, Math.PI * 0.7]} />
        <Mat color={o.hoodie} map={fabric()} side={THREE.DoubleSide} />
      </mesh>
      {/* rolled rim framing the face */}
      <mesh position={[0, 0.0, 0.076]} rotation-x={-0.25} scale={[1, 1.18, 1]}>
        <torusGeometry args={[0.126, 0.02, 10, 32, Math.PI * 1.25]} />
        <Mat color={o.hoodieTrim} />
      </mesh>
    </group>
  );
}

type Loc = { pos: THREE.Vector3; q: THREE.Quaternion; len: number };
/** Short twists over the crown: each grows out from the scalp and tips upward, with a little disorder. */
function makeLocs(n: number, spread: number, long: number): Loc[] {
  const out: Loc[] = [];
  const d = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + 0.4;
    const rr = Math.sqrt((i + 0.5) / n);
    const th = rr * spread;
    d.set(Math.sin(th) * Math.cos(a), Math.cos(th), Math.sin(th) * Math.sin(a) + 0.1).normalize();
    const base = headPoint(d, 1.0);
    const j = (k: number) => (((i * k) % 7) / 7 - 0.5) * 0.5;
    const dir = new THREE.Vector3(d.x * 0.75 + j(3), d.y * 0.75 + 0.6, d.z * 0.75 + j(5) + 0.1).normalize();
    const len = long * (0.75 + ((i * 7) % 5) * 0.11);
    out.push({ pos: base.addScaledVector(dir, len * 0.4), q: new THREE.Quaternion().setFromUnitVectors(UP, dir), len });
  }
  return out;
}
const LOCS = { locs: makeLocs(52, 1.12, 0.05), bun: makeLocs(7, 0.5, 0.04) };
const AFRO = Array.from({ length: 22 }, (_, i) => {
  const y = 1 - (i / 21) * 1.25;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const a = i * 2.39996;
  return [Math.cos(a) * r * 0.125, y * 0.125, Math.sin(a) * r * 0.125, 0.052 + (i % 3) * 0.006] as const;
});

function Hair({ o }: { o: Outfit }) {
  const style = o.hairStyle ?? "locs";
  const fade = useMemo(() => mix(o.skin, o.hair, 0.6), [o.skin, o.hair]);

  if (o.beanie) {
    return (
      <group position={[0, HC, 0]}>
        <mesh geometry={fadeGeo}>
          <Mat color={fade} />
        </mesh>
        <mesh geometry={beanieGeo} position={[0, 0.012, -0.008]} rotation-x={-0.3} castShadow>
          <Mat color={o.beanie} map={fabric()} />
          <Ink />
        </mesh>
        <mesh position={[0, 0.052, -0.012]} rotation-x={Math.PI / 2 - 0.3} scale={[0.95, 1.07, 1]}>
          <torusGeometry args={[0.115, 0.022, 10, 36]} />
          <Mat color={o.beanie} />
        </mesh>
      </group>
    );
  }
  const locs = style === "locs" || style === "textured" ? LOCS.locs : style === "bun" ? LOCS.bun : [];
  return (
    <group position={[0, HC, 0]}>
      {/* close-cut sides and back, darker cap on top */}
      <mesh geometry={fadeGeo}>
        <Mat color={fade} />
      </mesh>
      <mesh geometry={capGeo} rotation-x={-0.32} position={[0, 0.002, -0.004]}>
        <Mat color={o.hair} />
      </mesh>
      {locs.map((l, i) => (
        <mesh key={i} geometry={locGeo} position={l.pos} quaternion={l.q} scale={[1, l.len, 1]} castShadow>
          <Mat color={i % 4 === 0 ? mix(o.hair, "#7a5a44", 0.25) : o.hair} />
        </mesh>
      ))}
      {(style === "afro" || style === "curly") && (
        <group position={[0, 0.095, -0.04]}>
          <mesh scale={[1.06, 0.98, 1]} castShadow>
            <sphereGeometry args={[0.142, 28, 20]} />
            <Mat color={o.hair} />
            <Ink />
          </mesh>
          {AFRO.map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[r, 12, 10]} />
              <Mat color={i % 5 === 0 ? mix(o.hair, "#7a5a44", 0.22) : o.hair} />
            </mesh>
          ))}
        </group>
      )}
      {style === "bun" && (
        <mesh position={[0, 0.175, -0.055]} scale={[1, 0.9, 1]} castShadow>
          <sphereGeometry args={[0.062, 20, 16]} />
          <Mat color={o.hair} />
          <Ink />
        </mesh>
      )}
    </group>
  );
}

function Head({ o, asleep }: { o: Outfit; asleep: boolean }) {
  const face = useMemo(() => faceTexture(o, asleep), [o, asleep]);
  const shade = useMemo(() => mix(o.skin, "#3a1530", 0.22), [o.skin]);
  return (
    <group scale={1.2}>
      {/* long neck */}
      <mesh position={[0, 0.03, -0.004]} castShadow>
        <cylinderGeometry args={[0.037, 0.045, 0.14, 20]} />
        <Mat color={shade} />
      </mesh>
      <mesh geometry={headGeo} position={[0, HC, 0]} castShadow>
        <Mat color={o.skin} />
        <Ink />
      </mesh>
      <mesh geometry={faceGeo} position={[0, HC, 0]} renderOrder={2}>
        <meshToonMaterial
          map={face}
          gradientMap={PAINT_RAMP}
          transparent
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          onBeforeCompile={tune}
          customProgramCacheKey={paintKey}
        />
      </mesh>
      {/* ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.101, HC - 0.012, -0.006]} scale={[0.4, 1, 0.7]}>
          <sphereGeometry args={[0.03, 14, 10]} />
          <Mat color={shade} />
        </mesh>
      ))}
      {/* nose: bridge, a broad tip and two wings, so it reads from the side too */}
      <group position={[0, HC - 0.02, 0.111]}>
        <mesh position={[0, 0.016, -0.004]} scale={[0.8, 1.9, 0.9]}>
          <sphereGeometry args={[0.013, 12, 10]} />
          <Mat color={o.skin} />
        </mesh>
        <mesh position={[0, -0.009, 0.008]} scale={[1.15, 0.9, 1]}>
          <sphereGeometry args={[0.018, 14, 12]} />
          <Mat color={o.skin} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.017, -0.013, -0.002]}>
            <sphereGeometry args={[0.0115, 10, 8]} />
            <Mat color={shade} />
          </mesh>
        ))}
      </group>
      {o.hoodUp ? (
        <>
          <group position={[0, HC, 0]}>
            <mesh geometry={capGeo} rotation-x={-0.32} position={[0, 0.002, -0.004]}>
              <Mat color={o.hair} />
            </mesh>
          </group>
          <Hood o={o} />
        </>
      ) : (
        <Hair o={o} />
      )}
      {o.headband && (
        <mesh position={[0, HC + 0.062, -0.004]} rotation-x={Math.PI / 2 - 0.16} scale={[0.93, 1.06, 1]}>
          <torusGeometry args={[0.108, 0.019, 10, 36]} />
          <Mat color={o.headband} />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* body                                                                */
/* ------------------------------------------------------------------ */

const lathe = (pts: number[][], seg = 40, from = 0, len = Math.PI * 2) =>
  new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, from, len);
/** Broad shoulders over a narrow waist. The hoodie hangs loose and long; the tee is cut close. */
const TORSO = {
  hoodie: lathe([[0, -0.07], [0.186, -0.07], [0.198, -0.02], [0.192, 0.12], [0.198, 0.28], [0.214, 0.4], [0.21, 0.45], [0.17, 0.5], [0.09, 0.535], [0, 0.54]]),
  suit: lathe([[0, -0.08], [0.182, -0.08], [0.178, 0.0], [0.162, 0.15], [0.178, 0.3], [0.205, 0.42], [0.2, 0.46], [0.16, 0.505], [0.08, 0.535], [0, 0.54]]),
  gym: lathe([[0, -0.04], [0.168, -0.04], [0.172, 0.0], [0.166, 0.16], [0.178, 0.32], [0.195, 0.43], [0.19, 0.465], [0.15, 0.505], [0.075, 0.535], [0, 0.54]]),
};
// sleeveless puffer vest, open down the front (the lathe starts at +Z)
const vestGeo = lathe([[0.2, -0.02], [0.214, 0.03], [0.21, 0.14], [0.215, 0.3], [0.232, 0.41], [0.226, 0.47], [0.15, 0.53]], 36, 0.42, Math.PI * 2 - 0.84);
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 8, 16);
const sleeveGeo = capsule(0.062, 0.18);
const foreSleeveGeo = capsule(0.055, 0.15);
const cuffGeo = new THREE.CylinderGeometry(0.047, 0.05, 0.045, 24);
const fingerGeo = capsule(0.0125, 0.046);
const thumbGeo = capsule(0.0145, 0.036);
const thighGeo = capsule(0.082, 0.3);
const shinGeo = new THREE.CylinderGeometry(0.074, 0.07, 0.32, 24);
const stackGeo = new THREE.CylinderGeometry(0.072, 0.09, 0.3, 24);
const kneeGeo = new THREE.SphereGeometry(0.076, 20, 14);
const ankleCuffGeo = new THREE.CylinderGeometry(0.058, 0.06, 0.05, 24);
const shortsGeo = new THREE.CylinderGeometry(0.1, 0.108, 0.3, 24);

function Torso({ o }: { o: Outfit }) {
  const fab = fabric();
  const kind = o.kind ?? "hoodie";
  const pocket = useMemo(() => new THREE.Color(o.hoodie).multiplyScalar(0.9).getStyle(), [o.hoodie]);
  return (
    <group>
      <mesh geometry={TORSO[kind]} scale={[1, 1, 0.62]} castShadow receiveShadow>
        <Mat color={o.hoodie} map={kind === "suit" ? undefined : fab} />
        <Ink />
      </mesh>
      {/* hips, so the legs join the body */}
      <mesh position={[0, kind === "gym" ? -0.04 : -0.05, 0]} scale={kind === "gym" ? [1.14, 0.5, 0.56] : [1, 0.5, 0.6]}>
        <sphereGeometry args={[0.17, 20, 14]} />
        <Mat color={o.pants} />
      </mesh>
      {kind === "suit" && <SuitFront o={o} />}
      {o.graphic && (
        <group position={[0, 0.3, 0.131]}>
          {/* bold block lettering across the chest */}
          {[-0.09, -0.03, 0.03, 0.09].map((x, i) => (
            <mesh key={x} position={[x, i % 2 ? 0.01 : -0.005, -Math.abs(x) * 0.1]} rotation-z={(i - 1.5) * 0.06} rotation-y={x * 2.2}>
              <planeGeometry args={[0.045, 0.075]} />
              <Mat color={o.graphic!} />
            </mesh>
          ))}
        </group>
      )}
      {kind === "hoodie" && <HoodieBits o={o} fab={fab} pocket={pocket} />}
      {o.vest && (
        <group>
          <mesh geometry={vestGeo} scale={[1, 1, 0.66]} castShadow>
            <Mat color={o.vest} side={THREE.DoubleSide} />
          </mesh>
          {/* quilting: darker bands round the vest */}
          {[0.1, 0.22, 0.34].map((y) => (
            <mesh key={y} position={[0, y, 0]} scale={[1, 1, 0.66]}>
              <cylinderGeometry args={[0.218 + (y > 0.3 ? 0.012 : 0), 0.216, 0.012, 36, 1, true, 0.42, Math.PI * 2 - 0.84]} />
              <Mat color={mix(o.vest!, "#000000", 0.35)} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      )}
      {o.chain && (
        <mesh position={[0, 0.455, 0.07]} rotation-x={Math.PI / 2 - 0.95} scale={[1, 1.25, 1]}>
          <torusGeometry args={[0.075, 0.006, 6, 28]} />
          <Mat color={o.chain} emissive={mix(o.chain, "#000000", 0.6)} />
        </mesh>
      )}
      {/* headphones round the neck */}
      {o.headphones && (
        <group position={[0, 0.545, 0.005]}>
          <mesh rotation-x={Math.PI / 2 - 0.25}>
            <torusGeometry args={[0.092, 0.013, 10, 36]} />
            <Mat color={o.headphones} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.08, -0.03, 0.055]} rotation-z={s * 0.4}>
              <mesh rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.04, 0.04, 0.032, 24]} />
                <Mat color={o.headphones!} />
              </mesh>
              {o.headphonesGlow && (
                <mesh position={[s * 0.017, 0, 0]} rotation-y={(s * Math.PI) / 2}>
                  <ringGeometry args={[0.02, 0.026, 20]} />
                  <meshBasicMaterial color={o.headphonesGlow} toneMapped={false} />
                </mesh>
              )}
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

function HoodieBits({ o, fab, pocket }: { o: Outfit; fab: THREE.Texture; pocket: string }) {
  return (
    <>
      {/* ribbed hem */}
      <mesh position={[0, -0.045, 0]} scale={[1, 1, 0.62]} castShadow>
        <cylinderGeometry args={[0.196, 0.186, 0.06, 40, 1, true]} />
        <Mat color={o.hoodieTrim} map={fab} />
      </mesh>
      {/* kangaroo pocket */}
      <RoundedBox args={[0.23, 0.12, 0.03]} radius={0.012} position={[0, 0.12, 0.108]} castShadow>
        <Mat color={pocket} map={fab} />
      </RoundedBox>
      {/* hood bunched round the neck (not when it's worn up) */}
      {!o.hoodUp && (
        <>
          <mesh position={[0, 0.525, -0.02]} rotation-x={Math.PI / 2} scale={[1, 0.8, 1]} castShadow>
            <torusGeometry args={[0.082, 0.038, 14, 32]} />
            <Mat color={o.hoodie} map={fab} />
          </mesh>
          <mesh position={[0, 0.46, -0.11]} scale={[0.15, 0.12, 0.06]} castShadow>
            <sphereGeometry args={[1, 24, 16]} />
            <Mat color={o.hoodieTrim} map={fab} />
          </mesh>
        </>
      )}
      {/* drawstrings with aglets */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.033, 0.4, 0.136]} rotation-z={s * 0.06}>
          <mesh>
            <cylinderGeometry args={[0.0045, 0.0045, 0.13, 6]} />
            <Mat color={o.strings} />
          </mesh>
          <mesh position={[0, -0.075, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.022, 6]} />
            <Mat color={o.strings} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Suit jacket front: open V showing the shirt and tie, lapels, two buttons. */
function SuitFront({ o }: { o: Outfit }) {
  const lapel = new THREE.Color(o.hoodie).multiplyScalar(0.72).getStyle();
  return (
    <group position={[0, 0, 0.122]}>
      <mesh position={[0, 0.42, 0.004]} rotation-z={Math.PI}>
        <circleGeometry args={[0.075, 3]} />
        <Mat color={o.shirt ?? "#f2efe8"} />
      </mesh>
      <mesh position={[0, 0.355, 0.008]}>
        <planeGeometry args={[0.028, 0.16]} />
        <Mat color={o.tie ?? "#8e2f3a"} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.05, 0.385, 0.012]} rotation-z={s * 0.38}>
          <planeGeometry args={[0.04, 0.18]} />
          <Mat color={lapel} />
        </mesh>
      ))}
      {[0.24, 0.17].map((y) => (
        <mesh key={y} position={[0.005, y, -0.008]}>
          <circleGeometry args={[0.009, 12]} />
          <Mat color="#141414" />
        </mesh>
      ))}
    </group>
  );
}

function UpperArm({ o }: { o: Outfit }) {
  const gym = o.kind === "gym";
  return (
    <group>
      {/* rounded shoulder */}
      <mesh castShadow>
        <sphereGeometry args={[gym ? 0.062 : 0.07, 18, 14]} />
        <Mat color={o.hoodie} map={o.kind === "suit" ? undefined : fabric()} />
      </mesh>
      {gym ? (
        <>
          <mesh position={[0, -RIG.upperArm / 2 - 0.02, 0]} castShadow>
            <cylinderGeometry args={[0.049, 0.046, RIG.upperArm - 0.04, 20, 1, true]} />
            <Mat color={o.skin} />
          </mesh>
          <mesh position={[0, -0.07, 0]}>
            <cylinderGeometry args={[0.06, 0.064, 0.14, 20]} />
            <Mat color={o.hoodie} map={fabric()} />
          </mesh>
        </>
      ) : (
        <mesh geometry={sleeveGeo} position={[0, -0.13, 0]} scale={o.kind === "suit" ? [0.9, 1, 0.9] : 1} castShadow>
          <Mat color={o.hoodie} map={o.kind === "suit" ? undefined : fabric()} />
          <Ink />
        </mesh>
      )}
    </group>
  );
}

/** Forearm and a big, long-fingered hand. `side` is +1 for the left arm, so the thumbs point forward and in. */
function ForeArm({ o, side }: { o: Outfit; side: number }) {
  const gym = o.kind === "gym";
  const suit = o.kind === "suit";
  return (
    <group>
      {gym ? (
        <>
          {/* one smooth arm: the elbow is filled, and the forearm is as thick as the upper arm */}
          <mesh>
            <sphereGeometry args={[0.0455, 16, 12]} />
            <Mat color={o.skin} />
          </mesh>
          <mesh position={[0, -0.125, 0]} castShadow>
            <cylinderGeometry args={[0.046, 0.034, 0.25, 20, 1, true]} />
            <Mat color={o.skin} />
          </mesh>
        </>
      ) : (
        <>
          <mesh geometry={foreSleeveGeo} position={[0, -0.1, 0]} scale={suit ? [0.88, 1, 0.88] : 1} castShadow>
            <Mat color={o.hoodie} map={suit ? undefined : fabric()} />
            <Ink />
          </mesh>
          <mesh geometry={cuffGeo} position={[0, -0.215, 0]} castShadow>
            <Mat color={suit ? (o.shirt ?? "#f2efe8") : o.hoodieTrim} />
          </mesh>
        </>
      )}
      <group position={[0, -0.285, 0.004]} scale={1.22}>
        <RoundedBox args={[0.044, 0.1, 0.086]} radius={0.018} castShadow>
          <Mat color={o.skin} />
          <Ink t={0.005} />
        </RoundedBox>
        {[-0.032, -0.011, 0.011, 0.032].map((z, i) => (
          <mesh key={z} geometry={fingerGeo} position={[-side * 0.004, -0.076 - (i === 1 || i === 2 ? 0.006 : 0), z]} rotation-z={-side * 0.22}>
            <Mat color={o.skin} />
          </mesh>
        ))}
        <mesh geometry={thumbGeo} position={[-side * 0.006, -0.014, 0.055]} rotation-x={0.75}>
          <Mat color={o.skin} />
        </mesh>
      </group>
    </group>
  );
}

function Thigh({ o }: { o: Outfit }) {
  if (o.kind === "gym") {
    return (
      <group>
        <mesh geometry={thighGeo} position={[0, -0.2, 0]} scale={[0.78, 1, 0.78]} castShadow>
          <Mat color={o.tights ?? o.skin} />
        </mesh>
        <mesh geometry={shortsGeo} position={[0, -0.1, 0]} castShadow>
          <Mat color={o.pants} map={fabric()} />
          <Ink />
        </mesh>
      </group>
    );
  }
  return (
    <mesh geometry={thighGeo} position={[0, -0.2, 0]} scale={o.baggy ? [1.22, 1, 1.22] : 1} castShadow>
      <Mat color={o.pants} map={o.kind === "suit" ? undefined : fabric()} />
      <Ink />
    </mesh>
  );
}

function Shin({ o }: { o: Outfit }) {
  const fab = fabric();
  const gym = o.kind === "gym";
  const suit = o.kind === "suit";
  const leg = gym ? (o.tights ?? o.skin) : o.pants;
  // loose trousers widen toward the hem and stack on the shoe; tights and cuffed joggers stay close
  const loose = !!o.baggy || suit;
  const wide = o.baggy ? 1.22 : gym ? 0.8 : 1;
  return (
    <group>
      <mesh geometry={kneeGeo} scale={wide}>
        <Mat color={leg} map={suit || gym ? undefined : fab} />
      </mesh>
      <mesh geometry={loose ? stackGeo : shinGeo} position={[0, -0.17, 0]} scale={[wide, 1, wide]} castShadow>
        <Mat color={leg} map={suit || gym ? undefined : fab} />
        <Ink />
      </mesh>
      {loose ? (
        <mesh position={[0, -0.335, 0.012]} rotation-x={Math.PI / 2} scale={[wide, wide * 1.12, 1]}>
          <torusGeometry args={[0.078, 0.022, 8, 24]} />
          <Mat color={o.pantsCuff} map={suit ? undefined : fab} />
        </mesh>
      ) : (
        <>
          <mesh geometry={ankleCuffGeo} position={[0, -0.34, 0]} castShadow>
            <Mat color={gym ? "#efece6" : o.pantsCuff} map={fab} />
          </mesh>
          <mesh position={[0, -0.38, 0]}>
            <cylinderGeometry args={[0.042, 0.042, 0.04, 16]} />
            <Mat color="#efece6" />
          </mesh>
        </>
      )}
      {/* big shoes: chunky sole, rounded toe, tongue, heel collar, side stripe */}
      <group position={[0, -0.425, 0.055]}>
        <RoundedBox args={[0.128, 0.05, 0.335]} radius={0.02} position={[0, -0.03, 0]} castShadow>
          <Mat color={o.sole} />
          <Ink />
        </RoundedBox>
        <RoundedBox args={[0.114, 0.082, 0.3]} radius={0.038} position={[0, 0.022, -0.004]} castShadow>
          <Mat color={o.shoe} />
          <Ink />
        </RoundedBox>
        {!suit && (
          <>
            <mesh position={[0, 0.0, 0.118]} scale={[1, 0.62, 1.05]}>
              <sphereGeometry args={[0.056, 16, 12]} />
              <Mat color={o.sole} />
            </mesh>
            <mesh position={[0, 0.07, 0.0]} rotation-x={-0.45}>
              <boxGeometry args={[0.062, 0.02, 0.1]} />
              <Mat color={o.shoe} />
            </mesh>
            {[0.03, 0.06, 0.09].map((z) => (
              <mesh key={z} position={[0, 0.066 - z * 0.25, z]}>
                <boxGeometry args={[0.066, 0.007, 0.01]} />
                <Mat color="#f4f1ea" />
              </mesh>
            ))}
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.058, 0.02, 0.0]} rotation-x={0.3}>
                <boxGeometry args={[0.004, 0.022, 0.15]} />
                <Mat color={o.shoeAccent} />
              </mesh>
            ))}
            <mesh position={[0, 0.062, -0.13]}>
              <boxGeometry args={[0.05, 0.05, 0.014]} />
              <Mat color={o.shoeAccent} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/**
 * Most of the time a figure holds still and just breathes. `pulse` is 1 for `on` seconds out of every
 * `period`, easing in and out, so a gesture (a few keystrokes, one squat, some chopping) comes now and then.
 */
const pulse = (t: number, period: number, on: number, ease = 0.7) => {
  const p = ((t % period) + period) % period;
  return smooth(0, ease, p) * (1 - smooth(on - ease, on, p));
};

/**
 * Stylised character: tall and lean, long neck, a painted face with heavy-lidded eyes, big hands and
 * big shoes, loose layered clothes. Driven by a joint rig. Mostly still; small gestures now and then.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │ HOOK: swap in a rigged GLB (Mixamo / VRoid / your own Blender model)          │
 * │   const { scene, animations } = useGLTF("/models/emile.glb");                 │
 * │   const { actions } = useAnimations(animations, root);                        │
 * │   useEffect(() => { const a = actions[CLIPS[action]];                         │
 * │     a?.reset().fadeIn(0.35).play(); return () => void a?.fadeOut(0.35); },     │
 * │     [action]);                                                                │
 * │   return <primitive ref={root} object={scene} />;                             │
 * │ Export feet at y = 0, facing +Z, ~1.8 units tall; keep these props.            │
 * └──────────────────────────────────────────────────────────────────────────────┘
 */
export function Character({
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
  const o = OUTFITS[outfit] as Outfit;
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
  const since = useRef({ action, t0: -1 });

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime * speed + seed;
    if (since.current.action !== action || since.current.t0 < 0) since.current = { action, t0: t };
    const lt = t - since.current.t0; // seconds in this action
    const k = Math.min(1, dt * 5);
    const set = (g: THREE.Group | null, x: number, z = 0, y = 0) => {
      if (!g) return;
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, x, k);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, y, k);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, z, k);
    };
    const hipY = (y: number) => hips.current && (hips.current.position.y = THREE.MathUtils.lerp(hips.current.position.y, y, k));
    const H = RIG.hipY;
    const breathe = 1 + Math.sin(t * 1.1) * 0.007;
    if (torso.current) torso.current.scale.set(1, breathe, 1);
    // a slow look to one side every so often
    const glance = pulse(t, 23, 5, 1.6) * (Math.floor(t / 23) % 2 ? 1 : -1);

    switch (action) {
      case "sleep": {
        hipY(H);
        set(torso.current, 0);
        set(head.current, 0.05, 0.25, 0.25);
        set(armL.current, 0, 0.12);
        set(armR.current, 0, -0.12);
        set(foreL.current, -0.2);
        set(foreR.current, -0.2);
        set(legL.current, 0, 0.04);
        set(legR.current, 0, -0.04);
        set(shinL.current, 0);
        set(shinR.current, 0);
        if (torso.current) torso.current.scale.set(1, 1, 1 + (Math.sin(t * 0.9) * 0.5 + 0.5) * 0.04);
        break;
      }
      case "type": {
        // reads the screen, hands resting on the keys; types a line every quarter minute or so
        const tap = pulse(t, 16, 4.5);
        hipY(0.53);
        set(torso.current, 0.1);
        set(head.current, 0.08 + tap * 0.05, 0, glance * 0.22);
        set(armL.current, -0.55, 0.16);
        set(armR.current, -0.55, -0.16);
        set(foreL.current, -1.05 + Math.sin(t * 7) * 0.04 * tap);
        set(foreR.current, -1.05 + Math.sin(t * 7 + 1.7) * 0.04 * tap);
        set(legL.current, -Math.PI / 2, 0.08);
        set(legR.current, -Math.PI / 2, -0.08);
        set(shinL.current, Math.PI / 2);
        set(shinR.current, Math.PI / 2);
        break;
      }
      case "squat": {
        // stands and rests; one slow squat every 14 seconds
        const p = (lt + 9) % 14;
        const d = smooth(0, 2.2, p) * (1 - smooth(3.2, 5.4, p));
        const a = d * 1.1;
        const up = Math.min(1, d * 2.5);
        hipY(RIG.thigh * Math.cos(a) + RIG.shin * Math.cos(a) + 0.005);
        set(torso.current, a * 0.5);
        set(head.current, -a * 0.35, 0, glance * 0.2 * (1 - up));
        set(armL.current, -1.4 * up, 0.12);
        set(armR.current, -1.4 * up, -0.12);
        set(foreL.current, -0.25 - 0.55 * up);
        set(foreR.current, -0.25 - 0.55 * up);
        set(legL.current, -a, 0.1);
        set(legR.current, -a, -0.1);
        set(shinL.current, 2 * a);
        set(shinR.current, 2 * a);
        break;
      }
      case "stretch": {
        // arms overhead, one long lean to each side, held
        const s = Math.tanh(Math.sin(lt * 0.26) * 2.2);
        hipY(H);
        set(torso.current, 0, s * 0.26);
        set(head.current, 0, s * 0.14);
        set(armL.current, 0, 2.7 + s * 0.14);
        set(armR.current, 0, -2.7 + s * 0.14);
        set(foreL.current, 0);
        set(foreR.current, 0);
        set(legL.current, 0, 0.14);
        set(legR.current, 0, -0.14);
        set(shinL.current, 0);
        set(shinR.current, 0);
        break;
      }
      case "cycle": {
        const p = t * 2.4;
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
        // an unhurried stroll
        const w = Math.sin(t * 4.4);
        hipY(H + Math.abs(Math.cos(t * 4.4)) * 0.02);
        set(torso.current, 0.04, w * 0.03, w * 0.05);
        set(head.current, 0, 0, -w * 0.04);
        set(armL.current, w * 0.4, 0.08);
        set(armR.current, -w * 0.4, -0.08);
        set(foreL.current, -0.25);
        set(foreR.current, -0.25);
        set(legL.current, -w * 0.42);
        set(legR.current, w * 0.42);
        set(shinL.current, Math.max(0, w) * 0.65);
        set(shinR.current, Math.max(0, -w) * 0.65);
        break;
      }
      case "prep": {
        // hands on the board; a short spell of chopping every ten seconds or so
        const chop = pulse(lt + 6, 11, 3.2);
        hipY(H);
        set(torso.current, 0.22);
        set(head.current, 0.38 - glance * glance * 0.25, 0, glance * 0.3);
        set(armL.current, -0.95, 0.22);
        set(armR.current, -0.95 + Math.sin(t * 5) * 0.12 * chop, -0.22);
        set(foreL.current, -0.75);
        set(foreR.current, -0.75 + Math.sin(t * 5) * 0.22 * chop);
        set(legL.current, 0, 0.06);
        set(legR.current, 0, -0.06);
        set(shinL.current, 0);
        set(shinR.current, 0);
        break;
      }
      default: {
        // standing easy, weight on one leg
        hipY(H - 0.004);
        set(torso.current, 0.02, 0.03);
        set(head.current, 0.02, -0.03, glance * 0.3);
        set(armL.current, 0, 0.09);
        set(armR.current, 0, -0.07);
        set(foreL.current, -0.12);
        set(foreR.current, -0.18);
        set(legL.current, 0, 0.05);
        set(legR.current, -0.06, -0.06);
        set(shinL.current, 0);
        set(shinR.current, 0.1);
      }
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <group ref={hips} position={[0, RIG.hipY, 0]}>
        <group ref={torso}>
          <Torso o={o} />
          <group ref={head} position={[0, RIG.neckY, 0]}>
            <Head o={o} asleep={action === "sleep"} />
          </group>
          {(
            [
              [armL, foreL, 1],
              [armR, foreR, -1],
            ] as const
          ).map(([arm, fore, side], i) => (
            <group key={i} ref={arm} position={[side * RIG.shoulderX, RIG.shoulderY, 0]}>
              <UpperArm o={o} />
              <group ref={fore} position={[0, -RIG.upperArm, 0]}>
                <ForeArm o={o} side={side} />
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
            <Thigh o={o} />
            <group ref={shin} position={[0, -RIG.thigh, 0]}>
              <Shin o={o} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}
