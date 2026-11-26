// Puts the five dermaga in the world and drives their living parts: the
// floating rumah rakit, pier signs, lamps that come on at dusk, and the
// Ampera rig (clock hands on device time, the lift span, the LED segments
// and the construction shader for the timeline).
import {
  BufferAttribute,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from 'three';
import type { Assets } from './assets';
import { meshesOf, tagged } from './assets';
import { swell } from './boats';
import { AMPERA_X, AMPERA_Z, KAPITAN, MUNAWAR, SITES } from './layout';

export interface SignText {
  roman: string;
  title: string;
  place: string;
}

export const SIGNS: SignText[] = [
  { roman: 'I', title: 'Masjid Cheng Ho', place: '15 Ulu, Jakabaring' },
  { roman: 'II', title: 'Rumah Rakit', place: 'Seberang Ulu' },
  { roman: 'III', title: 'Kapitan dan Al-Munawar', place: '7 Ulu dan 13 Ulu' },
  { roman: 'IV', title: 'Balai Tepian', place: 'Simbur Cahaya' },
  { roman: 'V', title: 'Jembatan Ampera', place: 'Seberang Ulu' },
];

/** Enamel pier sign, drawn once per dermaga. */
export function signTexture(t: SignText, anisotropy: number): Texture {
  const W = 1024;
  const H = 376;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#163a31';
  g.fillRect(0, 0, W, H);
  const grad = g.createRadialGradient(W * 0.3, H * 0.2, 10, W * 0.4, H * 0.4, W * 0.8);
  grad.addColorStop(0, 'rgba(255,255,255,0.07)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#e6eadd';
  g.lineWidth = 14;
  g.strokeRect(18, 18, W - 36, H - 36);
  g.strokeStyle = '#d8a33e';
  g.lineWidth = 3;
  g.strokeRect(40, 40, W - 80, H - 80);
  g.fillStyle = '#d8a33e';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = '700 46px "Plus Jakarta Sans Variable", "Segoe UI", sans-serif';
  g.fillText(`DERMAGA ${t.roman}`, W / 2, 112);
  g.fillStyle = '#e9eee4';
  let size = 86;
  g.font = `600 ${size}px "Newsreader Variable", Georgia, serif`;
  while (g.measureText(t.title).width > W - 140 && size > 40) {
    size -= 4;
    g.font = `600 ${size}px "Newsreader Variable", Georgia, serif`;
  }
  g.fillText(t.title, W / 2, 222);
  g.fillStyle = 'rgba(233,238,228,0.78)';
  g.font = '600 38px "Plus Jakarta Sans Variable", "Segoe UI", sans-serif';
  g.fillText(t.place, W / 2, 300);
  // a little enamel chipping
  g.fillStyle = 'rgba(20,24,22,0.55)';
  for (let i = 0; i < 18; i++) {
    const x = Math.random() < 0.5 ? 20 + Math.random() * 40 : W - 60 + Math.random() * 40;
    const y = 20 + Math.random() * (H - 40);
    g.beginPath();
    g.arc(x, y, 1 + Math.random() * 4, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

/**
 * Planar UVs for faces that only get a texture at runtime. The optimiser
 * drops UVs from meshes whose Blender material had no image, so the sign
 * faces and book pages arrive without them.
 */
export function ensurePlanarUV(mesh: Mesh, u: 'x' | 'y' | 'z', v: 'x' | 'y' | 'z', flipV = false) {
  const g = mesh.geometry;
  if (g.attributes.uv) return;
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const du = b.max[u] - b.min[u] || 1;
  const dv = b.max[v] - b.min[v] || 1;
  const get = (i: number, a: 'x' | 'y' | 'z') => (a === 'x' ? pos.getX(i) : a === 'y' ? pos.getY(i) : pos.getZ(i));
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (get(i, u) - b.min[u]) / du;
    const t = (get(i, v) - b.min[v]) / dv;
    uv[i * 2 + 1] = flipV ? 1 - t : t;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
}

// ------------------------------------------------------------ Ampera ----
const BUILD_GLSL = /* glsl */ `
uniform float uBuildOn;
uniform float uPier;
uniform float uTower;
uniform float uDeck;
uniform float uLiftB;
uniform vec3 uBridge;
varying vec3 vBuildP;
`;

export interface Build {
  on: number;
  pier: number;
  tower: number;
  deck: number;
  lift: number;
}

export class AmperaRig {
  root: Object3D;
  hands: { o: Object3D; kind: 'jam' | 'menit'; face: number }[] = [];
  clocks: Object3D[] = [];
  leds: { mesh: Mesh; mat: MeshStandardMaterial; seg: number; level: number; target: number }[] = [];
  lift: Object3D | null = null;
  cables: Object3D | null = null;
  liftY = 0;
  private uniforms = {
    uBuildOn: { value: 0 },
    uPier: { value: 1 },
    uTower: { value: 1 },
    uDeck: { value: 1 },
    uLiftB: { value: 1 },
    uBridge: { value: new Vector3(AMPERA_X, 0, AMPERA_Z) },
  };
  private shadowCasters: Mesh[] = [];
  private led = new Color('#ffcf7a');
  private ledHot = new Color('#ff5a4a');
  private street: MeshStandardMaterial | null = null;
  private dial: MeshStandardMaterial | null = null;
  private paint: MeshStandardMaterial[] = [];

  constructor(model: Object3D) {
    this.root = model;
    // own copies of the materials so the build shader cannot touch other models
    const clones = new Map<Material, Material>();
    for (const m of meshesOf(model)) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const next = mats.map((mat) => {
        if (!clones.has(mat)) clones.set(mat, this.patch(mat.clone()));
        return clones.get(mat)!;
      });
      m.material = Array.isArray(m.material) ? next : next[0];
      if (m.castShadow) this.shadowCasters.push(m);
    }
    for (const o of tagged(model, (u) => u.tm === 'hand_jam' || u.tm === 'hand_menit')) {
      this.hands.push({ o, kind: o.userData.tm === 'hand_jam' ? 'jam' : 'menit', face: Number(o.userData.tm_face) || 1 });
    }
    this.clocks = tagged(model, (u) => u.tm_glow === 'clock');
    for (const o of tagged(model, (u) => u.tm === 'led')) {
      for (const mesh of meshesOf(o)) {
        // a separate (still build-aware) material per segment so each can light alone
        const mat = this.patch((mesh.material as Material).clone()) as MeshStandardMaterial;
        mat.emissive = new Color(0, 0, 0);
        mat.emissiveIntensity = 1;
        mesh.material = mat;
        this.leds.push({ mesh, mat, seg: Number(o.userData.tm_seg), level: 0, target: 0 });
      }
    }
    this.leds.sort((a, b) => a.seg - b.seg);
    this.lift = tagged(model, (u) => u.tm === 'lift')[0] ?? null;
    if (this.lift) this.liftY = this.lift.position.y;
    this.cables = tagged(model, (u) => u.tm === 'cables')[0] ?? null;
    const street = tagged(model, (u) => u.tm_glow === 'street')[0];
    if (street) this.street = meshesOf(street)[0].material as MeshStandardMaterial;
    const dial = this.clocks[0];
    if (dial) this.dial = meshesOf(dial)[0].material as MeshStandardMaterial;
    // the red paint gets a faint floodlit glow after dark
    for (const m of clones.values()) if (/merah/.test(m.name)) this.paint.push(m as MeshStandardMaterial);
  }

  private patch(mat: Material): Material {
    const u = this.uniforms;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vBuildP;`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvBuildP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${BUILD_GLSL}`)
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
float buildEdge = 0.0;
if (uBuildOn > 0.5) {
  vec3 bp = vBuildP - uBridge;
  float ax = abs(bp.x);
  float h = bp.y;
  float d;
  if (abs(ax - 37.5) < 9.5) {
    float top = max(mix(-3.0, 12.6, uPier), mix(-3.0, 67.5, uTower));
    d = top - h;
  } else if (ax < 37.5) {
    d = ax - mix(37.6, -1.0, uLiftB);
    if (h > 40.0) d = min(d, (uTower - 0.98) * 400.0);
  } else {
    d = max(mix(-3.0, 9.2, uPier) - h, ax - mix(480.0, 37.0, uDeck));
  }
  if (d < 0.0) discard;
  buildEdge = 1.0 - smoothstep(0.0, 0.9, d);
}`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.62, 0.22) * buildEdge * 6.0;`,
        );
    };
    mat.customProgramCacheKey = () => `ampera_build_${mat.name}`;
    return mat;
  }

  setBuild(b: Build) {
    const u = this.uniforms;
    u.uBuildOn.value = b.on;
    u.uPier.value = b.pier;
    u.uTower.value = b.tower;
    u.uDeck.value = b.deck;
    u.uLiftB.value = b.lift;
    const building = b.on > 0.5;
    for (const m of this.shadowCasters) m.castShadow = !building;
  }

  /** Hands follow the device clock. */
  updateClock(date: Date) {
    const h = date.getHours() % 12;
    const mi = date.getMinutes();
    const s = date.getSeconds() + date.getMilliseconds() / 1000;
    const aMin = ((mi + s / 60) / 60) * Math.PI * 2;
    const aHour = ((h + mi / 60) / 12) * Math.PI * 2;
    for (const hand of this.hands) hand.o.rotation.z = (hand.kind === 'jam' ? aHour : aMin) * hand.face;
  }

  setClocksVisible(v: boolean) {
    for (const c of this.clocks) c.visible = v;
    for (const h of this.hands) h.o.visible = v;
  }

  /** Lit segments: one per dermaga already visited. */
  setLedTargets(lit: boolean[]) {
    for (const l of this.leds) l.target = lit[l.seg - 1] ? 1 : 0;
  }

  update(dt: number, t: number, lamps: number) {
    for (const l of this.leds) {
      l.level += (l.target - l.level) * Math.min(1, dt * 2.2);
      const wave = 0.75 + 0.25 * Math.sin(t * 1.6 - l.seg * 0.9);
      const k = l.level * (0.35 + 0.65 * lamps) * wave;
      l.mat.emissive.copy(this.led).lerp(this.ledHot, 0.25 + 0.25 * Math.sin(t * 0.7 + l.seg));
      l.mat.emissiveIntensity = k * 7;
    }
    if (this.street) {
      this.street.emissive.set('#ffd9a0');
      this.street.emissiveIntensity = lamps * 6;
    }
    if (this.dial) {
      this.dial.emissive.set('#fff3d6');
      this.dial.emissiveIntensity = lamps * 0.85;
    }
    for (const m of this.paint) {
      m.emissive.set('#c4180c');
      m.emissiveIntensity = lamps * 0.07;
    }
  }

  setLift(raise: number) {
    if (this.lift) this.lift.position.y = this.liftY + raise;
  }

  setCables(v: boolean) {
    if (this.cables) this.cables.visible = v;
  }
}

// ----------------------------------------------------------- stations ----
export interface StationSet {
  root: Group;
  groups: Group[]; // one per dermaga, positioned in the world
  piers: Group[];
  rakit: Group | null;
  munawar: Group | null;
  kapitan: Group | null;
  pempek: Group | null;
  ampera: AmperaRig | null;
  flame: Mesh | null;
  update(dt: number, t: number, lamps: number): void;
}

export function place(o: Object3D, pos: readonly number[], rotY: number) {
  o.position.set(pos[0], pos[1], pos[2]);
  o.rotation.y = rotY;
}

export function createStations(): StationSet {
  const root = new Group();
  root.name = 'dermaga';
  const groups = SITES.map((s, i) => {
    const g = new Group();
    g.name = `dermaga_${i + 1}`;
    place(g, s.anchor, s.rotY);
    root.add(g);
    return g;
  });
  const set: StationSet = {
    root,
    groups,
    piers: [],
    rakit: null,
    munawar: null,
    kapitan: null,
    pempek: null,
    ampera: null,
    flame: null,
    update(dt, t, lamps) {
      if (set.rakit) {
        const a = SITES[1].anchor;
        set.rakit.position.y = a[1] + swell(a[0], a[2], t) * 0.35;
        set.rakit.rotation.z = Math.sin(t * 0.9) * 0.006;
        set.rakit.rotation.x = Math.sin(t * 0.7 + 1) * 0.004;
      }
      if (set.flame) {
        const f = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.05;
        set.flame.scale.set(1, f, 1);
      }
      set.ampera?.update(dt, t, lamps);
    },
  };
  return set;
}

/** Attach a loaded model to its dermaga once it arrives. */
export function attach(set: StationSet, name: string, model: Group, assets: Assets, anisotropy: number) {
  switch (name) {
    case 'chengho':
      set.groups[0].add(model);
      break;
    case 'dermaga2':
      // the rakit floats: keep it in its own group so it can bob
      place(model, [0, 0, 0], 0);
      set.groups[1].add(model);
      set.rakit = set.groups[1];
      break;
    case 'munawar':
      place(model, MUNAWAR, Math.PI / 2);
      set.root.add(model);
      set.munawar = model;
      break;
    case 'kapitan':
      place(model, KAPITAN, Math.PI / 2);
      set.root.add(model);
      set.kapitan = model;
      break;
    case 'pempek': {
      // a cook's table in Kapitan's front yard, long side facing the river
      place(model, [KAPITAN[0] + 10.5, KAPITAN[1], KAPITAN[2] - 9], Math.PI / 2);
      set.root.add(model);
      set.pempek = model;
      model.traverse((o) => o.layers.set(1));
      break;
    }
    case 'dermaga4':
      set.groups[3].add(model);
      model.traverse((o) => {
        if (o.userData.tm === 'flame') set.flame = o as Mesh;
      });
      break;
    case 'ampera': {
      set.groups[4].add(model);
      set.ampera = new AmperaRig(model);
      break;
    }
    case 'dermaga_kayu': {
      SITES.forEach((s, i) => {
        const pier = model.clone(true);
        place(pier, s.pier, Math.PI / 2);
        pier.traverse((o) => {
          if (o.userData.tm === 'signface') {
            const mesh = o as Mesh;
            if (!mesh.geometry.attributes.uv) {
              mesh.geometry = mesh.geometry.clone();
              ensurePlanarUV(mesh, 'x', 'y');
            }
            const map = signTexture(SIGNS[i], anisotropy);
            // the face must read correctly from the river (+X once placed);
            // if its normal points inland, mirror the texture and show both sides
            const n = mesh.geometry.attributes.normal;
            const nx = n ? new Vector3(n.getX(0), n.getY(0), n.getZ(0)).applyQuaternion(mesh.quaternion).applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 2).x : 1;
            if (nx < 0) {
              map.repeat.x = -1;
              map.offset.x = 1;
            }
            mesh.material = new MeshStandardMaterial({ map, roughness: 0.32, metalness: 0, side: DoubleSide });
            mesh.renderOrder = 1;
          }
        });
        set.root.add(pier);
        set.piers.push(pier);
      });
      break;
    }
  }
  void assets;
}

/** Lamps and glowing materials keyed to the time of day. */
export function updateGlows(assets: Assets, lamps: number, t: number) {
  const g = (name: string, color: string, k: number) => {
    const m = assets.materials.get(name) as MeshStandardMaterial | undefined;
    if (!m || !m.isMeshStandardMaterial) return;
    m.emissive.set(color);
    m.emissiveIntensity = k;
  };
  const flick = 0.9 + 0.1 * Math.sin(t * 9.1) * Math.sin(t * 3.7);
  g('kaca_lampu_dermaga', '#ffbe73', lamps * 7 * flick);
  g('lampion', '#ff4a2a', 0.4 + lamps * 4.2);
  g('kaca_lentera', '#ffb357', 0.3 + lamps * 5.5 * flick);
  g('nyala_pelita', '#ff9a40', 3.2 * flick);
  g('ruang_gelap', '#ffae5c', lamps * 1.6);
  g('kaca_gelap', '#ffcf86', lamps * 0.9);
}
