// Loads the Blender models and keeps one copy of each named material, so
// the shared library materials (kayu_balok appears in fifteen files) only
// reach the GPU once.
import {
  type Group,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MODEL_BYTES } from '../../generated/models';
import { BASE } from '../base';

const TEX_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap'] as const;

// Materials that should not cast shadows (glass, liquids, light shells).
const NO_SHADOW = /^(gelas_kaca|air_minum|acar_cair|minyak|kaca_lentera|kaca_lampu_dermaga|nyala_pelita|lampion|ruang_gelap|kolong_gelap|jam_muka|ampera_led|lampu_jalan|cuko)$/;

export type Progress = (loaded: number, total: number) => void;

export class Assets {
  private loader = new GLTFLoader();
  private pending = new Map<string, Promise<Group>>();
  private ready = new Map<string, Group>();
  readonly materials = new Map<string, Material>();
  private loadedBytes = new Map<string, number>();
  private anisotropy: number;

  constructor(renderer: WebGLRenderer, private base = `${BASE}models/`) {
    MeshoptDecoder.useWorkers?.(Math.min(2, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)));
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  bytes(names: string[]) {
    let total = 0;
    let loaded = 0;
    for (const n of names) {
      total += MODEL_BYTES[n] ?? 0;
      loaded += Math.min(this.loadedBytes.get(n) ?? 0, MODEL_BYTES[n] ?? 0);
    }
    return { loaded, total };
  }

  get(name: string): Group | undefined {
    return this.ready.get(name);
  }

  load(name: string): Promise<Group> {
    const p = this.pending.get(name);
    if (p) return p;
    const promise = new Promise<Group>((resolve, reject) => {
      this.loader.load(
        `${this.base}${name}.glb`,
        (gltf) => {
          this.loadedBytes.set(name, MODEL_BYTES[name] ?? 0);
          const root = gltf.scene;
          root.name = name;
          this.process(root);
          this.ready.set(name, root);
          resolve(root);
        },
        (e) => {
          if (e.lengthComputable || e.loaded) this.loadedBytes.set(name, e.loaded);
        },
        (err) => reject(err),
      );
    });
    this.pending.set(name, promise);
    return promise;
  }

  private process(root: Object3D) {
    const dropped = new Set<Material>();
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = mats.map((m) => {
        const kept = this.materials.get(m.name);
        if (kept && kept !== m) {
          dropped.add(m);
          return kept;
        }
        if (!kept) this.register(m);
        return m;
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
      const shadowless = next.every((m) => NO_SHADOW.test(m.name) || m.transparent);
      mesh.castShadow = !shadowless;
      mesh.receiveShadow = true;
    });
    // free textures of dropped duplicates unless a kept material shares them
    const keep = new Set<Texture>();
    for (const m of this.materials.values()) for (const s of TEX_SLOTS) {
      const t = (m as MeshStandardMaterial)[s];
      if (t) keep.add(t);
    }
    for (const m of dropped) {
      for (const s of TEX_SLOTS) {
        const t = (m as MeshStandardMaterial)[s];
        if (t && !keep.has(t)) {
          const img = t.image as { close?: () => void } | undefined;
          img?.close?.();
          t.dispose();
        }
      }
      m.dispose();
    }
  }

  private register(m: Material) {
    this.materials.set(m.name, m);
    const sm = m as MeshStandardMaterial;
    for (const s of TEX_SLOTS) {
      const t = sm[s];
      if (t) t.anisotropy = s === 'map' || s === 'normalMap' ? this.anisotropy : 1;
    }
    if (sm.transparent) sm.depthWrite = false;
    if (sm.isMeshStandardMaterial) sm.envMapIntensity = 1;
  }
}

/** Find the first descendant with a given name. */
export function byName<T extends Object3D = Mesh>(root: Object3D, name: string): T {
  const o = root.getObjectByName(name);
  if (!o) throw new Error(`model node missing: ${name}`);
  return o as T;
}

/**
 * All descendants whose userData (the Blender custom props) match. A node
 * with several materials loads as a Group of meshes, so this returns
 * plain objects rather than meshes.
 */
export function tagged(root: Object3D, test: (u: Record<string, unknown>) => boolean): Object3D[] {
  const out: Object3D[] = [];
  root.traverse((o) => {
    if (o !== root && test(o.userData)) out.push(o);
  });
  return out;
}

/** Meshes inside an object (the object itself if it is one). */
export function meshesOf(o: Object3D): Mesh[] {
  const out: Mesh[] = [];
  o.traverse((c) => {
    if ((c as Mesh).isMesh) out.push(c as Mesh);
  });
  return out;
}
