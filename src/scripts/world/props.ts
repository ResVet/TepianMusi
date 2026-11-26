// Scatters the Blender houses, palms, nipah and trees along Seberang Ulu
// (and a lighter mix on the far bank) as chunked InstancedMeshes, so whole
// stretches of river cull away when they are behind the camera.
import { Color, InstancedMesh, Matrix4, Mesh, Object3D, Quaternion, Vector3, type Material } from 'three';
import { AMPERA_Z, isClear, leftEdge, rightEdge, rng } from './layout';
import { heightAt } from './terrain';

export interface Placement {
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  tint?: number; // 0..1, used to light some windows at night
}

export type PropName =
  | 'rumah_a' | 'rumah_b' | 'rumah_c' | 'rumah_d' | 'rakit_a' | 'rakit_b'
  | 'kelapa_a' | 'kelapa_b' | 'nipah' | 'pohon' | 'semak' | 'jukung_hijau' | 'jukung_biru';

const CHUNK = 520;

export function planProps(density: number): Map<PropName, Placement[]> {
  const r = rng(2026);
  const out = new Map<PropName, Placement[]>();
  const add = (n: PropName, p: Placement) => {
    if (!out.has(n)) out.set(n, []);
    out.get(n)!.push(p);
  };
  const houses: PropName[] = ['rumah_a', 'rumah_b', 'rumah_c', 'rumah_d'];
  const taken: [number, number, number][] = [];
  const free = (x: number, z: number, rad: number) => {
    for (const [tx, tz, tr] of taken) if (Math.hypot(x - tx, z - tz) < rad + tr) return false;
    return true;
  };
  const take = (x: number, z: number, rad: number) => taken.push([x, z, rad]);

  // Seberang Ulu, the side we sail along
  for (let z = 560; z > AMPERA_Z + 60; z -= 13) {
    const e = leftEdge(z);
    // first row of rumah panggung facing the river
    if (r() < 0.62 * density) {
      const x = e - 9 - r() * 9;
      const zz = z + (r() - 0.5) * 4;
      if (isClear(x, zz, 7) && free(x, zz, 6)) {
        add(houses[Math.floor(r() * 4)], { x, y: heightAt(x, zz), z: zz, rot: Math.PI / 2 + (r() - 0.5) * 0.24, scale: 0.92 + r() * 0.16, tint: r() });
        take(x, zz, 6);
      }
    }
    if (r() < 0.4 * density) {
      const x = e - 30 - r() * 22;
      const zz = z + (r() - 0.5) * 6;
      if (isClear(x, zz, 7) && free(x, zz, 6.5)) {
        add(houses[Math.floor(r() * 4)], { x, y: heightAt(x, zz), z: zz, rot: Math.PI / 2 + (r() - 0.5) * 0.5, scale: 0.9 + r() * 0.2, tint: r() });
        take(x, zz, 6.5);
      }
    }
    // coconut palms between and in front of the houses
    for (let k = 0; k < 2; k++) {
      if (r() < 0.42 * density) {
        const x = e - 2.5 - r() * 34;
        const zz = z + (r() - 0.5) * 12;
        if (isClear(x, zz, 2) && free(x, zz, 2.2)) {
          add(r() < 0.5 ? 'kelapa_a' : 'kelapa_b', { x, y: heightAt(x, zz) - 0.05, z: zz, rot: r() * Math.PI * 2, scale: 0.85 + r() * 0.35 });
          take(x, zz, 1.2);
        }
      }
    }
    // nipah right at the waterline
    for (let k = 0; k < 3; k++) {
      if (r() < 0.5 * density) {
        const x = e - 1.2 + r() * 4.2;
        const zz = z + (r() - 0.5) * 13;
        if (isClear(x, zz, 4) && free(x, zz, 1.2)) add('nipah', { x, y: -0.25, z: zz, rot: r() * Math.PI * 2, scale: 0.8 + r() * 0.5 });
      }
    }
    if (r() < 0.36 * density) {
      const x = e - 22 - r() * 70;
      const zz = z + (r() - 0.5) * 10;
      if (isClear(x, zz, 4) && free(x, zz, 4)) {
        add('pohon', { x, y: heightAt(x, zz) - 0.05, z: zz, rot: r() * Math.PI * 2, scale: 0.85 + r() * 0.5 });
        take(x, zz, 3);
      }
    }
    if (r() < 0.55 * density) {
      const x = e - 4 - r() * 40;
      const zz = z + (r() - 0.5) * 10;
      if (isClear(x, zz, 2) && free(x, zz, 1.5)) add('semak', { x, y: heightAt(x, zz) - 0.1, z: zz, rot: r() * Math.PI * 2, scale: 0.8 + r() * 0.7 });
    }
  }
  // rows of rumah rakit along two stretches, moored just off the bank
  const rakitRow = (z0: number, z1: number) => {
    for (let z = z0; z > z1; z -= 15 + r() * 5) {
      const x = leftEdge(z) + 4.6 + r() * 2;
      if (!isClear(x, z, 6) || !free(x, z, 5)) continue;
      add(r() < 0.5 ? 'rakit_a' : 'rakit_b', { x, y: 0, z, rot: Math.PI / 2 + (r() - 0.5) * 0.1, scale: 1 });
      take(x, z, 5);
      if (r() < 0.35) add(r() < 0.5 ? 'jukung_hijau' : 'jukung_biru', { x: x + 5.2, y: 0, z: z + (r() - 0.5) * 4, rot: Math.PI / 2 + (r() - 0.5) * 0.3, scale: 1 });
    }
  };
  rakitRow(120, -60);
  rakitRow(-690, -960);
  rakitRow(-1140, -1370);
  rakitRow(-1560, -1640);

  // Seberang Ilir: a waterline of nipah and palms with a few houses
  for (let z = 560; z > -4300; z -= 10) {
    const e = rightEdge(z);
    for (let k = 0; k < 2; k++) {
      if (r() < 0.55 * density) add('nipah', { x: e + 1.2 - r() * 4.4, y: -0.25, z: z + (r() - 0.5) * 10, rot: r() * Math.PI * 2, scale: 0.9 + r() * 0.6 });
    }
    if (Math.abs(z - AMPERA_Z) < 120) continue;
    if (r() < 0.3 * density) {
      const x = e + 3 + r() * 20;
      add(r() < 0.5 ? 'kelapa_a' : 'kelapa_b', { x, y: heightAt(x, z) - 0.05, z, rot: r() * Math.PI * 2, scale: 0.9 + r() * 0.3 });
    }
  }
  return out;
}

const m = new Matrix4();
const local = new Matrix4();
const q = new Quaternion();
const p = new Vector3();
const s = new Vector3();
const UP = new Vector3(0, 1, 0);

/**
 * Turn placements into instanced meshes. `parts` are the meshes of one
 * loaded prop with their transforms relative to the prop root. Parts whose
 * material passes `special.match` get `special.make(material)` instead and a
 * per-instance colour (used for windows that may or may not be lit).
 */
export function instance(name: string, parts: { mesh: Mesh; matrix: Matrix4 }[], list: Placement[], parent: Object3D,
  special?: { match: (mat: Material) => boolean; make: (mat: Material) => Material }) {
  const chunks = new Map<number, Placement[]>();
  for (const pl of list) {
    const c = Math.floor(pl.z / CHUNK);
    if (!chunks.has(c)) chunks.set(c, []);
    chunks.get(c)!.push(pl);
  }
  const made: InstancedMesh[] = [];
  const col = new Color();
  for (const [c, items] of chunks) {
    for (const part of parts) {
      const base = part.mesh.material as Material;
      const isSpecial = !!special && special.match(base);
      const mat = isSpecial ? special!.make(base) : base;
      const im = new InstancedMesh(part.mesh.geometry, mat, items.length);
      items.forEach((pl, i) => {
        q.setFromAxisAngle(UP, pl.rot);
        m.compose(p.set(pl.x, pl.y, pl.z), q, s.setScalar(pl.scale));
        local.multiplyMatrices(m, part.matrix);
        im.setMatrixAt(i, local);
        if (isSpecial) im.setColorAt(i, col.setScalar(pl.tint !== undefined && pl.tint > 0.4 ? 1 : 0.06));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = part.mesh.castShadow;
      im.receiveShadow = true;
      im.name = `${name}_${c}`;
      parent.add(im);
      made.push(im);
    }
  }
  return made;
}
