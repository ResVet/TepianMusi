// Foam trail behind a boat: a ribbon that widens and fades with age,
// with bright Kelvin arms at its edges and churned prop wash in the middle.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Mesh,
  RepeatWrapping,
  ShaderMaterial,
  Vector3,
  type Texture,
} from 'three';

const vert = /* glsl */ `
attribute float aAge;
attribute float aSide;
attribute float aStrength;
varying float vAge;
varying float vSide;
varying float vStrength;
varying vec3 vWorld;
void main() {
  vAge = aAge;
  vSide = aSide;
  vStrength = aStrength;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const frag = /* glsl */ `
uniform sampler2D tFoam;
uniform float uTime;
uniform vec3 uColor;
uniform float uBright;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying float vAge;
varying float vSide;
varying float vStrength;
varying vec3 vWorld;
void main() {
  float a = clamp(vAge, 0.0, 1.0);
  float side = abs(vSide);
  vec3 f1 = texture2D(tFoam, vWorld.xz * 0.11 + vec2(0.0, uTime * 0.02)).rgb;
  vec3 f2 = texture2D(tFoam, vWorld.xz * 0.37 - vec2(uTime * 0.03, 0.0)).rgb;
  float arms = smoothstep(0.55, 0.92, side) * (1.0 - smoothstep(0.92, 1.0, side));
  float wash = (1.0 - smoothstep(0.0, 0.42, side)) * (1.0 - smoothstep(0.0, 0.55, a));
  float foam = arms * (0.55 + 0.6 * f1.r) + wash * (0.45 + 0.8 * f2.r) + f2.b * 0.25 * (1.0 - side);
  foam *= mix(0.9, 0.5, f1.g);
  float life = pow(1.0 - a, 1.6) * smoothstep(0.0, 0.04, a + 0.02);
  float alpha = clamp(foam * life * vStrength, 0.0, 1.0);
  float dist = length(cameraPosition - vWorld);
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  vec3 col = uColor * uBright;
  gl_FragColor = vec4(col * alpha * (1.0 - fog), 1.0);
}`;

export class Wake {
  mesh: Mesh;
  private n: number;
  private head = 0;
  private count = 0;
  private pts: { p: Vector3; side: Vector3; t: number; s: number }[] = [];
  private pos: Float32Array;
  private age: Float32Array;
  private strength: Float32Array;
  private last = new Vector3(1e9, 0, 0);
  private tail = new Vector3();
  private tailSide = new Vector3(1, 0, 0);
  private tmp = new Vector3();
  mat: ShaderMaterial;

  constructor(foam: Texture, private width = 1.0, private spread = 0.55, private life = 14, samples = 64) {
    foam.wrapS = foam.wrapT = RepeatWrapping;
    this.n = samples;
    for (let i = 0; i < samples; i++) this.pts.push({ p: new Vector3(), side: new Vector3(), t: -1e9, s: 0 });
    this.pos = new Float32Array(samples * 2 * 3);
    this.age = new Float32Array(samples * 2);
    this.strength = new Float32Array(samples * 2);
    const side = new Float32Array(samples * 2);
    for (let i = 0; i < samples; i++) {
      side[i * 2] = -1;
      side[i * 2 + 1] = 1;
    }
    const idx: number[] = [];
    for (let i = 0; i < samples - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    g.setAttribute('aAge', new BufferAttribute(this.age, 1).setUsage(DynamicDrawUsage));
    g.setAttribute('aStrength', new BufferAttribute(this.strength, 1).setUsage(DynamicDrawUsage));
    g.setAttribute('aSide', new BufferAttribute(side, 1));
    g.setIndex(idx);
    this.mat = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        tFoam: { value: foam },
        uTime: { value: 0 },
        uColor: { value: new Color('#e9e2cf') },
        uBright: { value: 0.6 },
        uFogColor: { value: new Color() },
        uFogDensity: { value: 0.001 },
      },
    });
    this.mesh = new Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.name = 'buih';
  }

  /** stern: world position at the waterline behind the hull; dir: heading. */
  update(time: number, stern: Vector3, dir: Vector3, speed: number) {
    const moved = this.tmp.subVectors(stern, this.last).length();
    if (moved > 25) {
      // the boat jumped (map link, respawn): start a fresh trail
      this.count = 0;
      this.head = 0;
    }
    if (moved > 0.7 || this.count === 0) {
      const slot = this.pts[this.head];
      slot.p.copy(stern);
      slot.side.set(-dir.z, 0, dir.x).normalize();
      slot.t = time;
      slot.s = Math.min(1, speed / 4);
      this.head = (this.head + 1) % this.n;
      this.count = Math.min(this.n, this.count + 1);
      this.last.copy(stern);
    }
    // newest first: the live stern point, then the stored samples
    for (let i = 0; i < this.n; i++) {
      let p: Vector3;
      let side: Vector3;
      let ageT: number;
      let s: number;
      if (i === 0) {
        p = stern;
        side = this.tmp.set(-dir.z, 0, dir.x).normalize();
        ageT = 0;
        s = Math.min(1, speed / 4);
      } else {
        const k = (this.head - i + this.n * 2) % this.n;
        const slot = this.pts[k];
        if (i > this.count) {
          // collapse unused segments onto the oldest live point so no
          // triangle stretches back to a stale trail
          p = this.tail;
          side = this.tailSide;
          ageT = this.life;
          s = 0;
        } else {
          p = slot.p;
          side = slot.side;
          ageT = time - slot.t;
          s = slot.s;
        }
      }
      if (i <= this.count) {
        this.tail.copy(p);
        this.tailSide.copy(side);
      }
      const a = Math.min(1, ageT / this.life);
      const w = this.width + ageT * this.spread;
      const j = i * 2;
      this.pos[j * 3] = p.x - side.x * w;
      this.pos[j * 3 + 1] = 0.03;
      this.pos[j * 3 + 2] = p.z - side.z * w;
      this.pos[j * 3 + 3] = p.x + side.x * w;
      this.pos[j * 3 + 4] = 0.03;
      this.pos[j * 3 + 5] = p.z + side.z * w;
      this.age[j] = this.age[j + 1] = a;
      this.strength[j] = this.strength[j + 1] = s;
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAge.needsUpdate = true;
    g.attributes.aStrength.needsUpdate = true;
    this.mat.uniforms.uTime.value = time;
  }

  setLook(fog: Color, density: number, bright: number) {
    this.mat.uniforms.uFogColor.value.copy(fog);
    this.mat.uniforms.uFogDensity.value = density;
    this.mat.uniforms.uBright.value = bright;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
