// Distant town: cheap instanced houses and blocks with windows that light
// up at night, round tree crowns for the far banks, and riverside lamps
// around Ampera. Everything here is seen from 150 m or more.
import {
  BoxGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  type Material,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { AMPERA_Z, isClear, leftEdge, rightEdge, rng } from './layout';
import { heightAt } from './terrain';

const m4 = new Matrix4();
const q = new Quaternion();
const v = new Vector3();
const s = new Vector3();
const UP = new Vector3(0, 1, 0);

function houseGeometry(): BufferGeometry {
  const walls = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  // gable roof: a prism along local x
  const roof = new BufferGeometry();
  const h = 0.42;
  const o = 0.06;
  const p = [
    -0.5 - o, 1, -0.5 - o, 0.5 + o, 1, -0.5 - o, 0.5 + o, 1 + h, 0, -0.5 - o, 1 + h, 0,
    -0.5 - o, 1, 0.5 + o, -0.5 - o, 1 + h, 0, 0.5 + o, 1 + h, 0, 0.5 + o, 1, 0.5 + o,
    -0.5, 1, -0.5, -0.5, 1 + h, 0, -0.5, 1, 0.5,
    0.5, 1, -0.5, 0.5, 1, 0.5, 0.5, 1 + h, 0,
  ];
  roof.setAttribute('position', new Float32BufferAttribute(p, 3));
  roof.setIndex([0, 3, 1, 1, 3, 2, 4, 7, 5, 7, 6, 5, 8, 10, 9, 11, 13, 12]);
  roof.computeVertexNormals();
  const tone = (g: BufferGeometry, r: number, gg: number, b: number, roofFlag: number) => {
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      c[i * 3] = r;
      c[i * 3 + 1] = gg;
      c[i * 3 + 2] = b;
      f[i] = roofFlag;
    }
    g.setAttribute('color', new BufferAttribute(c, 3));
    g.setAttribute('aRoof', new BufferAttribute(f, 1));
  };
  const w2 = walls.toNonIndexed();
  tone(w2, 1, 1, 1, 0);
  const r2 = roof.toNonIndexed();
  tone(r2, 0.42, 0.3, 0.24, 1);
  w2.deleteAttribute('uv');
  const merged = mergeGeometries([w2, r2]);
  return merged;
}

function blockGeometry(): BufferGeometry {
  const g = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0).toNonIndexed();
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3).fill(1);
  const f = new Float32Array(n);
  const pos = g.attributes.position;
  for (let i = 0; i < n; i++) if (pos.getY(i) > 0.999 && g.attributes.normal.getY(i) > 0.5) f[i] = 1;
  g.setAttribute('color', new BufferAttribute(c, 3));
  g.setAttribute('aRoof', new BufferAttribute(f, 1));
  return g;
}

/** Shared material: vertex/instance tint plus night windows on the walls. */
function townMaterial(): { mat: MeshStandardMaterial; night: { value: number } } {
  const night = { value: 0 };
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, envMapIntensity: 0.7 });
  mat.name = 'kota';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = night;
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aRoof;
attribute vec3 aRoofCol;
varying vec3 vLocal;
varying vec3 vLocalN;
varying float vRoofF;
varying vec3 vRoofCol;
flat varying float vSeed;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
vLocal = position * sc;
vLocalN = normal;
vRoofF = aRoof;
vRoofCol = aRoofCol;
vSeed = float(gl_InstanceID);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uNight;
varying vec3 vLocal;
varying vec3 vLocalN;
varying float vRoofF;
varying vec3 vRoofCol;
flat varying float vSeed;
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`,
      )
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vRoofCol, step(0.5, vRoofF));`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
if (uNight > 0.001 && vRoofF < 0.5 && abs(vLocalN.y) < 0.5) {
  float along = abs(vLocalN.x) > 0.5 ? vLocal.z : vLocal.x;
  vec2 cell = vec2(along / 2.4, (vLocal.y - 0.5) / 2.9);
  vec2 id = floor(cell);
  vec2 f = fract(cell);
  float win = step(0.28, f.x) * step(f.x, 0.72) * step(0.3, f.y) * step(f.y, 0.78);
  float on = step(0.55, h21(id + vSeed * 7.13 + vLocalN.xz * 3.1));
  float warm = h21(id * 1.7 + vSeed);
  vec3 lamp = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.85, 0.62), warm);
  float low = step(0.4, vLocal.y);
  totalEmissiveRadiance += lamp * win * on * low * uNight * 2.6;
}`,
      );
  };
  mat.customProgramCacheKey = () => 'kota_v2';
  return { mat, night };
}

export interface Town {
  root: Object3D;
  setNight(n: number, lamps: number): void;
  setLeaves(m: Material): void;
}

export function createTown(density: number): Town {
  const root = new Object3D();
  root.name = 'kota';
  const { mat, night } = townMaterial();
  const r = rng(91);
  const houses: Matrix4[] = [];
  const hcol: Color[] = [];
  const blocks: Matrix4[] = [];
  const bcol: Color[] = [];
  const trees: Matrix4[] = [];
  const tcol: Color[] = [];

  const wall = ['#d8cfbc', '#cbb995', '#b7c4b0', '#d4bfae', '#bcc7cb', '#ddd3b2', '#c6a882', '#a9b5a0'];
  const roof = ['#7e4430', '#6a2f25', '#767d80', '#4c392b', '#3e5649', '#8a5a3c', '#5b6366'];
  const hroof: Color[] = [];
  const broof: Color[] = [];
  const pushHouse = (x: number, z: number, rot: number, w: number, d: number, hgt: number) => {
    const y = heightAt(x, z);
    q.setFromAxisAngle(UP, rot);
    houses.push(new Matrix4().compose(v.set(x, y - 0.3, z), q, s.set(w, hgt, d)));
    hcol.push(new Color(wall[Math.floor(r() * wall.length)]).multiplyScalar(0.62 + r() * 0.22));
    hroof.push(new Color(roof[Math.floor(r() * roof.length)]).multiplyScalar(0.75 + r() * 0.3));
  };
  const pushBlock = (x: number, z: number, rot: number, w: number, d: number, hgt: number) => {
    const y = heightAt(x, z);
    q.setFromAxisAngle(UP, rot);
    blocks.push(new Matrix4().compose(v.set(x, y - 0.3, z), q, s.set(w, hgt, d)));
    bcol.push(new Color(wall[Math.floor(r() * wall.length)]).multiplyScalar(0.58 + r() * 0.25));
    broof.push(new Color('#59605f').multiplyScalar(0.7 + r() * 0.4));
  };
  const pushTree = (x: number, z: number, size: number) => {
    const y = heightAt(x, z);
    q.setFromAxisAngle(UP, r() * Math.PI * 2);
    trees.push(new Matrix4().compose(v.set(x, y + size * 0.9, z), q, s.set(size * (0.9 + r() * 0.4), size * (0.8 + r() * 0.5), size * (0.9 + r() * 0.4))));
    tcol.push(new Color().setHSL(0.22 + r() * 0.07, 0.35 + r() * 0.2, 0.16 + r() * 0.1));
  };

  // Seberang Ilir (right bank): waterfront houses, then town, then trees
  for (let z = 520; z > -4300; z -= 11) {
    const e = rightEdge(z);
    const cityK = Math.max(0, 1 - Math.abs(z - AMPERA_Z) / 900);
    if (r() < 0.55 * density) pushHouse(e + 9 + r() * 10, z + r() * 6, -Math.PI / 2 + (r() - 0.5) * 0.3, 6 + r() * 4, 7 + r() * 4, 3 + r() * 1.8);
    if (r() < 0.45 * density) pushHouse(e + 28 + r() * 30, z + r() * 8, -Math.PI / 2 + (r() - 0.5) * 0.5, 6 + r() * 5, 7 + r() * 5, 3 + r() * 2.2);
    if (r() < (0.25 + cityK * 0.6) * density) pushBlock(e + 70 + r() * 160, z + r() * 8, (r() - 0.5) * 0.2, 10 + r() * 14, 10 + r() * 16, 6 + r() * 10 + cityK * 18 * r());
    if (r() < 0.8 * density) pushTree(e + 14 + r() * 140, z + r() * 10, 3 + r() * 3);
    if (r() < 0.5 * density) pushTree(e + 2 + r() * 6, z + r() * 10, 2.4 + r() * 2);
  }
  // far side of Seberang Ulu, behind the scattered GLB houses
  for (let z = 520; z > -4300; z -= 13) {
    const e = leftEdge(z);
    const cityK = Math.max(0, 1 - Math.abs(z - AMPERA_Z) / 700);
    // inland on this side only the city near Ampera shows; elsewhere the
    // dermaga look inland, so the horizon there is trees
    const x2 = e - 170 - r() * 200;
    if (cityK > 0.2 && r() < (0.2 + cityK * 0.7) * density) pushBlock(x2, z, (r() - 0.5) * 0.3, 10 + r() * 12, 10 + r() * 12, 5 + r() * 8 + cityK * 14 * r());
    const xt = e - 95 - r() * 260;
    if (r() < 0.9 * density && isClear(xt, z, 30)) pushTree(xt, z + r() * 8, 3 + r() * 3.5);
  }
  // past the bridge both banks become town
  for (let z = AMPERA_Z - 60; z > -4300; z -= 16) {
    for (const side of [-1, 1]) {
      const e = side < 0 ? leftEdge(z) : rightEdge(z);
      for (let k = 0; k < 3; k++) {
        if (r() < 0.6 * density) {
          const x = e + side * (12 + k * 28 + r() * 14);
          pushBlock(x, z + r() * 6, (r() - 0.5) * 0.2, 9 + r() * 10, 9 + r() * 12, 5 + r() * 12);
        }
      }
    }
  }

  const mk = (geo: BufferGeometry, mats: Matrix4[], cols: Color[], name: string, material: Material = mat, roofs?: Color[]) => {
    if (roofs) {
      const a = new Float32Array(roofs.length * 3);
      roofs.forEach((c, i) => c.toArray(a, i * 3));
      geo.setAttribute('aRoofCol', new InstancedBufferAttribute(a, 3));
    }
    const im = new InstancedMesh(geo, material, mats.length);
    mats.forEach((m, i) => {
      im.setMatrixAt(i, m);
      im.setColorAt(i, cols[i]);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.name = name;
    im.castShadow = false;
    im.receiveShadow = true;
    root.add(im);
    return im;
  };
  mk(houseGeometry(), houses, hcol, 'kota_rumah', mat, hroof);
  mk(blockGeometry(), blocks, bcol, 'kota_gedung', mat, broof);

  // far tree crowns: a lumpy sphere with spherical UVs, so the leaf texture
  // from the Blender bushes can be swapped in once it has loaded
  const crown = new IcosahedronGeometry(1, 2);
  const cp = crown.attributes.position;
  const uvs = new Float32Array(cp.count * 2);
  const jr = rng(5);
  for (let i = 0; i < cp.count; i++) {
    v.fromBufferAttribute(cp, i).normalize();
    uvs[i * 2] = (Math.atan2(v.z, v.x) / (Math.PI * 2) + 0.5) * 3;
    uvs[i * 2 + 1] = (Math.asin(v.y) / Math.PI + 0.5) * 2;
    const n = 0.82 + 0.18 * Math.sin(v.x * 5.1 + v.y * 3.7) * Math.cos(v.z * 4.3) + jr() * 0.08;
    v.multiplyScalar(n);
    cp.setXYZ(i, v.x, v.y * 0.9, v.z);
  }
  crown.setAttribute('uv', new BufferAttribute(uvs, 2));
  crown.computeVertexNormals();
  const leaf = new MeshStandardMaterial({ color: '#4f6b33', roughness: 0.92, metalness: 0, envMapIntensity: 0.6 });
  leaf.name = 'tajuk_jauh';
  const crowns = mk(crown, trees, tcol, 'kota_pohon', leaf);

  // riverside lamps near the bridge, both banks
  const lampMats: Matrix4[] = [];
  const headMats: Matrix4[] = [];
  for (let z = AMPERA_Z + 420; z > AMPERA_Z - 420; z -= 24) {
    if (Math.abs(z - AMPERA_Z) < 30) continue;
    for (const side of [-1, 1]) {
      const e = side < 0 ? leftEdge(z) : rightEdge(z);
      const x = e + side * 4.5;
      const y = heightAt(x, z);
      lampMats.push(new Matrix4().compose(v.set(x, y + 2.4, z), q.identity(), s.set(1, 1, 1)));
      headMats.push(new Matrix4().compose(v.set(x, y + 4.9, z), q.identity(), s.set(1, 1, 1)));
    }
  }
  const pole = new CylinderGeometry(0.07, 0.1, 4.8, 6);
  const poleMat = new MeshStandardMaterial({ color: '#2b2f2e', roughness: 0.6, metalness: 0.6 });
  poleMat.name = 'tiang_lampu';
  const head = new SphereGeometry(0.28, 12, 8);
  const headMat = new MeshStandardMaterial({ color: '#fff4dc', emissive: new Color('#ffcf8a'), emissiveIntensity: 0, roughness: 0.3 });
  headMat.name = 'bola_lampu';
  const poles = new InstancedMesh(pole, poleMat, lampMats.length);
  const heads = new InstancedMesh(head, headMat, headMats.length);
  lampMats.forEach((m, i) => poles.setMatrixAt(i, m));
  headMats.forEach((m, i) => heads.setMatrixAt(i, m));
  poles.computeBoundingSphere();
  heads.computeBoundingSphere();
  poles.name = 'tiang_tepian';
  heads.name = 'lampu_tepian';
  root.add(poles, heads);

  return {
    root,
    setNight(n: number, lamps: number) {
      night.value = n;
      headMat.emissiveIntensity = lamps * 9;
    },
    setLeaves(m: Material) {
      const c = (m as MeshStandardMaterial).clone();
      c.name = 'tajuk_jauh_daun';
      c.color.set('#ffffff');
      crowns.material = c;
      // the leaf texture carries the green; instance colours only vary it
      const vr = rng(17);
      const col = new Color();
      for (let i = 0; i < crowns.count; i++) crowns.setColorAt(i, col.setRGB(0.72 + vr() * 0.3, 0.78 + vr() * 0.3, 0.62 + vr() * 0.25));
      if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    },
  };
}
