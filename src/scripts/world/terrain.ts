// River banks: two long strips of land that dip under the waterline, with
// grass blending into wet mud near the water. Heights are deterministic so
// props and stations can be placed on them.
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  type Texture,
} from 'three';
import { AMPERA_X, AMPERA_Z, KAPITAN, LAND_Y, MUNAWAR, SITES, leftEdge, rightEdge } from './layout';

const Z_START = 700;
const Z_END = -4500;
const ROW = 6;
// column offsets from the waterline, positive = out into the river
const COLS = [16, 11, 7.5, 5, 3.4, 2.2, 1.2, 0.4, -0.5, -1.5, -2.8, -4.3, -6, -8.5, -12, -17, -24, -33, -45,
  -60, -80, -105, -140, -190, -260, -350, -470, -620, -800];

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

interface Flat {
  x: number;
  z: number;
  r: number;
  y: number;
}
const FLATS: Flat[] = [
  { x: SITES[0].anchor[0] + 10, z: SITES[0].anchor[2] + 4, r: 48, y: LAND_Y - 0.14 },
  { x: MUNAWAR[0] + 8, z: MUNAWAR[2] - 8, r: 34, y: LAND_Y - 0.14 },
  { x: KAPITAN[0] + 6, z: KAPITAN[2] - 6, r: 34, y: LAND_Y - 0.14 },
  { x: SITES[3].anchor[0], z: SITES[3].anchor[2], r: 13, y: LAND_Y - 0.2 },
];

/** Ground height from the waterline offset `o` (positive = into the river). */
function profile(o: number, x: number, z: number, land: number) {
  if (o >= 0) return -0.12 - o * 0.24 - Math.max(0, o - 6) * 0.12;
  const bank = smooth(0, -5.5, o);
  const n = (vnoise(x * 0.045, z * 0.045) - 0.5) * 0.5 + (vnoise(x * 0.17, z * 0.17) - 0.5) * 0.14;
  const inland = smooth(-120, -600, o) * 1.6;
  return -0.12 + (land + 0.12) * bank + n * bank + inland;
}

function approachBottom(x: number) {
  const u = Math.min(1, Math.max(0, (Math.abs(x - AMPERA_X) - 177) / 300));
  return 11.5 - 10.5 * Math.pow(u, 1.15) - 1.3;
}

export function heightAt(x: number, z: number): number {
  const le = leftEdge(z);
  const re = rightEdge(z);
  let h: number;
  if (x < (le + re) / 2) h = profile(x - le, x, z, LAND_Y);
  else h = profile(re - x, x, z, LAND_Y + 0.35);
  if (h > 0) {
    for (const f of FLATS) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r + 14) {
        const k = 1 - smooth(f.r, f.r + 14, d);
        h = h + (f.y - h) * k;
      }
    }
  }
  if (Math.abs(z - AMPERA_Z) < 14 && Math.abs(x - AMPERA_X) > 150) h = Math.min(h, approachBottom(x));
  return h;
}

function bank(side: -1 | 1): BufferGeometry {
  const rows = Math.floor((Z_START - Z_END) / ROW) + 1;
  const cols = COLS.length;
  const pos = new Float32Array(rows * cols * 3);
  const uv = new Float32Array(rows * cols * 2);
  const wet = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const z = Z_START - r * ROW;
    const edge = side < 0 ? leftEdge(z) : rightEdge(z);
    for (let c = 0; c < cols; c++) {
      const o = COLS[c];
      const x = side < 0 ? edge + o : edge - o;
      const y = heightAt(x, z);
      const i = r * cols + c;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      uv[i * 2] = x / 7;
      uv[i * 2 + 1] = z / 7;
      const n = vnoise(x * 0.11, z * 0.11);
      wet[i] = Math.min(1, Math.max(0, 1 - smooth(-0.05, 0.75 + n * 0.5, y)));
    }
  }
  const idx = new Uint32Array((rows - 1) * (cols - 1) * 6);
  let k = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      // winding so the surface faces up on both banks: on the left bank
      // x falls as the column index grows, on the right bank it rises
      if (side < 0) {
        idx[k++] = a; idx[k++] = d; idx[k++] = b;
        idx[k++] = b; idx[k++] = d; idx[k++] = e;
      } else {
        idx[k++] = a; idx[k++] = b; idx[k++] = d;
        idx[k++] = b; idx[k++] = e; idx[k++] = d;
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setAttribute('aWet', new BufferAttribute(wet, 1));
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export interface TerrainMaps {
  grass: Texture;
  grassN: Texture;
  grassR: Texture;
  mud: Texture;
  mudN: Texture;
  mudR: Texture;
}

export function createTerrain(maps: TerrainMaps, anisotropy: number): Mesh[] {
  for (const t of Object.values(maps)) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = anisotropy;
  }
  maps.grass.colorSpace = SRGBColorSpace;
  maps.mud.colorSpace = SRGBColorSpace;
  const mat = new MeshStandardMaterial({
    map: maps.grass,
    normalMap: maps.grassN,
    normalScale: new Vector2(0.9, 0.9),
    roughnessMap: maps.grassR,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.8,
  });
  mat.name = 'tanah_tepian';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMud = { value: maps.mud };
    sh.uniforms.uMudN = { value: maps.mudN };
    sh.uniforms.uMudR = { value: maps.mudR };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aWet;\nvarying float vWet;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWet = aWet;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D uMud;\nuniform sampler2D uMudN;\nuniform sampler2D uMudR;\nvarying float vWet;\nfloat wetMix = 0.0;',
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  // two scales of the same grass, mixed by a very slow macro pattern, so the
  // tiling does not show from the air
  vec4 g1 = texture2D(map, vMapUv);
  vec4 g2 = texture2D(map, vMapUv * 0.29 + vec2(0.37, 0.71));
  float macro = texture2D(map, vMapUv * 0.041 + vec2(0.13, 0.52)).g;
  vec4 grassC = mix(g1, g2, smoothstep(0.22, 0.62, macro));
  grassC.rgb *= 0.82 + 0.36 * macro;
  vec3 mudC = texture2D(uMud, vMapUv * 1.37).rgb;
  wetMix = smoothstep(0.05, 0.95, vWet + (grassC.g - 0.32) * 0.9);
  vec3 ground = mix(grassC.rgb, mudC, wetMix);
  ground *= 1.0 - 0.28 * smoothstep(0.6, 1.0, vWet);
  diffuseColor.rgb *= ground;
#endif`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  float rG = texture2D(roughnessMap, vRoughnessMapUv).g;
  float rM = texture2D(uMudR, vRoughnessMapUv * 1.37).g;
  roughnessFactor *= mix(rG, rM, wetMix) * (1.0 - 0.35 * smoothstep(0.75, 1.0, vWet));
#endif`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#ifdef USE_NORMALMAP_TANGENTSPACE
  vec3 nG = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  vec3 nM = texture2D(uMudN, vNormalMapUv * 1.37).xyz * 2.0 - 1.0;
  vec3 mapN = normalize(mix(nG, nM, wetMix));
  mapN.xy *= normalScale;
  normal = normalize(tbn * mapN);
#else
  #include <normal_fragment_maps>
#endif`,
      );
  };
  mat.customProgramCacheKey = () => 'tanah_tepian_v2';
  const out: Mesh[] = [];
  for (const side of [-1, 1] as const) {
    const m = new Mesh(bank(side), mat);
    m.name = side < 0 ? 'tepian_ulu' : 'tepian_ilir';
    m.receiveShadow = true;
    m.castShadow = false;
    out.push(m);
  }
  return out;
}
