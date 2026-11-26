// Sky dome: gradient, sun and moon, drifting clouds and stars, all in one
// shader so the same look can feed the environment map.
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { SkyState } from './time';

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
#ifdef AT_FAR
  gl_Position.z = gl_Position.w;
#endif
}`;

const frag = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform vec3 uCloudLit;
uniform vec3 uCloudDark;
uniform vec3 uCity;
uniform float uGlow;
uniform float uStars;
uniform float uCloud;
uniform float uTime;
uniform float uCityGlow;
uniform float uSimple;
varying vec3 vDir;

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
             mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = r * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float up = clamp(h, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(up, 0.42));

  // warm haze band just above the horizon, strongest under the sun
  float sd = max(dot(d, uSunDir), 0.0);
  float band = exp(-abs(h) * 9.0);
  col = mix(col, uSunColor * 0.9 + uHorizon * 0.4, band * pow(sd, 3.0) * 0.55 * uGlow);

  // city glow low in the west and over the far banks at night
  float west = smoothstep(0.1, -0.9, d.z) * 0.6 + 0.4;
  col += uCity * uCityGlow * exp(-max(h, 0.0) * 14.0) * west * 0.5;

  // ground haze below the horizon
  col = mix(col, uGround, smoothstep(0.0, -0.06, h));

  // sun glow and disc
  float sunUp = smoothstep(-0.08, 0.02, uSunDir.y);
  col += uSunColor * (pow(sd, 8.0) * 0.28 + pow(sd, 90.0) * 0.9) * uGlow * sunUp;
  float disc = smoothstep(0.99975, 0.99992, sd);
  col += uSunColor * disc * 38.0 * smoothstep(-0.03, 0.01, uSunDir.y) * step(-0.01, h);

  // moon
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.75, 0.8, 0.9) * (smoothstep(0.99955, 0.99975, md) * 3.2 + pow(md, 300.0) * 0.12) * uStars;

  if (uSimple < 0.5) {
    // stars
    if (uStars > 0.001 && h > 0.0) {
      vec3 sp = d * 210.0;
      vec3 ci = floor(sp);
      float r = hash3(ci);
      vec3 j = vec3(hash3(ci + 1.7), hash3(ci + 4.3), hash3(ci + 9.1)) - 0.5;
      float dist = length(fract(sp) - 0.5 - j * 0.6);
      float tw = 0.65 + 0.35 * sin(uTime * (1.5 + r * 3.0) + r * 60.0);
      float star = step(0.986, r) * smoothstep(0.11, 0.0, dist) * tw;
      col += vec3(0.9, 0.93, 1.0) * star * uStars * smoothstep(0.0, 0.25, h) * 1.6;
    }
    // clouds on a virtual plane
    if (h > 0.0) {
      vec2 cp = d.xz / (h + 0.08) * 0.55 + vec2(uTime * 0.0035, uTime * 0.0012);
      float n = fbm(cp * 1.4);
      float n2 = fbm(cp * 3.1 + 7.3);
      float cov = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.28, n * 0.85 + n2 * 0.25);
      float thick = smoothstep(0.3, 0.9, n2);
      vec3 cc = mix(uCloudLit, uCloudDark, thick * 0.7);
      cc += uSunColor * pow(sd, 10.0) * 0.55 * sunUp * uGlow;
      float fade = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.65, 1.0, h) * 0.4);
      col = mix(col, cc, cov * fade * 0.92);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export class SkyDome {
  mesh: Mesh;
  mat: ShaderMaterial;

  constructor(radius = 4800, simple = false) {
    this.mat = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      side: BackSide,
      depthWrite: false,
      defines: simple ? {} : { AT_FAR: '' },
      fog: false,
      uniforms: {
        uZenith: { value: new Color() },
        uHorizon: { value: new Color() },
        uGround: { value: new Color() },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uSunColor: { value: new Color() },
        uMoonDir: { value: new Vector3(0, 1, 0) },
        uCloudLit: { value: new Color() },
        uCloudDark: { value: new Color() },
        uCity: { value: new Color('#ff9a52') },
        uGlow: { value: 1 },
        uStars: { value: 0 },
        uCloud: { value: 0.4 },
        uTime: { value: 0 },
        uCityGlow: { value: 0 },
        uSimple: { value: simple ? 1 : 0 },
      },
    });
    this.mesh = new Mesh(new SphereGeometry(radius, 48, 24), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.mesh.name = 'langit';
  }

  apply(s: SkyState, time: number) {
    const u = this.mat.uniforms;
    u.uZenith.value.copy(s.cols.zenith);
    u.uHorizon.value.copy(s.cols.horizon);
    u.uGround.value.copy(s.cols.ground);
    u.uSunDir.value.copy(s.sunDir);
    u.uSunColor.value.copy(s.cols.sun);
    u.uMoonDir.value.copy(s.moonDir);
    u.uCloudLit.value.copy(s.cols.cloudLit);
    u.uCloudDark.value.copy(s.cols.cloudDark);
    u.uGlow.value = s.nums.glow;
    u.uStars.value = s.nums.stars;
    u.uCloud.value = s.nums.cloud;
    u.uCityGlow.value = s.nums.city;
    u.uTime.value = time;
  }

  copyFrom(other: SkyDome) {
    const a = this.mat.uniforms;
    const b = other.mat.uniforms;
    for (const k of Object.keys(a)) {
      if (k === 'uSimple') continue;
      const v = b[k].value;
      if (typeof v === 'number') a[k].value = v;
      else a[k].value.copy(v);
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
