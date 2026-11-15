"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Effect, EffectAttribute } from "postprocessing";

/**
 * Painterly pass: makes the whole studio read like a hand-painted animation frame instead of a render.
 *
 * 1. A Kuwahara filter: for every pixel it looks at the four small squares around it and keeps the
 *    average colour of the calmest one. Flat areas become smooth patches of paint, while edges stay sharp,
 *    which is what gives painted backgrounds their brush-stroke look.
 * 2. A colour grade: richer saturation, violet-blue shadows and warm highlights, like a city at night
 *    lit by lamps and neon.
 */
const frag = /* glsl */ `
uniform float strength;
uniform float saturation;
uniform float grade;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
  vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
  for (int j = -3; j <= 0; j++) {
    for (int i = -3; i <= 0; i++) {
      vec2 o = vec2(float(i), float(j)) * texelSize * 1.15;
      vec3 c;
      c = texture2D(inputBuffer, uv + o).rgb;                 m0 += c; s0 += c * c;
      c = texture2D(inputBuffer, uv + vec2(-o.x, o.y)).rgb;   m1 += c; s1 += c * c;
      c = texture2D(inputBuffer, uv + vec2(o.x, -o.y)).rgb;   m2 += c; s2 += c * c;
      c = texture2D(inputBuffer, uv - o).rgb;                 m3 += c; s3 += c * c;
    }
  }
  float n = 16.0;
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  vec3 v0 = abs(s0 / n - m0 * m0), v1 = abs(s1 / n - m1 * m1), v2 = abs(s2 / n - m2 * m2), v3 = abs(s3 / n - m3 * m3);
  float d0 = v0.r + v0.g + v0.b, d1 = v1.r + v1.g + v1.b, d2 = v2.r + v2.g + v2.b, d3 = v3.r + v3.g + v3.b;
  vec3 col = m0; float best = d0;
  if (d1 < best) { best = d1; col = m1; }
  if (d2 < best) { best = d2; col = m2; }
  if (d3 < best) { best = d3; col = m3; }
  col = mix(inputColor.rgb, col, strength);

  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation);
  vec3 shadowTint = vec3(0.035, 0.0, 0.085);
  vec3 lightTint = vec3(0.06, 0.025, -0.03);
  col += mix(shadowTint, lightTint, smoothstep(0.08, 0.6, l)) * grade;
  outputColor = vec4(max(col, 0.0), inputColor.a);
}
`;

class PainterlyEffect extends Effect {
  constructor({ strength = 1, saturation = 1.25, grade = 0.8 } = {}) {
    super("PainterlyEffect", frag, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ["strength", new THREE.Uniform(strength)],
        ["saturation", new THREE.Uniform(saturation)],
        ["grade", new THREE.Uniform(grade)],
      ]),
    });
  }
}

/** Put inside <EffectComposer>, first. */
export function Painterly({ strength = 1, saturation = 1.25, grade = 0.8 }: { strength?: number; saturation?: number; grade?: number }) {
  const effect = useMemo(() => new PainterlyEffect({ strength, saturation, grade }), [strength, saturation, grade]);
  return <primitive object={effect} dispose={null} />;
}
