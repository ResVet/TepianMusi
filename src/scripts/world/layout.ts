// Geography of the scene, shared by the 3D world and the static map.
// World axes: the river runs along Z and the boat sails toward -Z (west,
// upstream to Ampera). Seberang Ulu, where every dermaga sits, is the left
// bank at -X. Units are metres; the Ampera model is built at real scale.
// Nothing here imports three.js so Astro can use it while building the page.

export type V3 = [number, number, number];

export const RIVER_Z0 = 320;
export const RIVER_Z1 = -2900;
export const AMPERA_Z = -2150;
export const AMPERA_X = 10;

const near = (z: number, c: number, r: number) => {
  const d = Math.abs(z - c) / r;
  return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d);
};

/** X of the Seberang Ulu waterline. */
export function leftEdge(z: number): number {
  const base = -150 + 9 * Math.sin(z * 0.0041 + 0.6) + 5 * Math.sin(z * 0.0113 + 2.1);
  // straighten the bank where the bridge abutment lands
  const k = near(z, AMPERA_Z, 260);
  return base * (1 - k) + -152 * k;
}

/** X of the Seberang Ilir waterline. */
export function rightEdge(z: number): number {
  const base = 174 + 10 * Math.sin(z * 0.0037 + 1.4) + 6 * Math.sin(z * 0.0091 + 0.2);
  const k = near(z, AMPERA_Z, 260);
  return base * (1 - k) + 172 * k;
}

export interface StationSite {
  /** Where the station's main model sits (y = 0). */
  anchor: V3;
  /** Rotation of the station models about Y. */
  rotY: number;
  /** Pier (dermaga kayu) position, same rotation as the station. */
  pier: V3;
  /** Where the ketek rests, centre of the hull. */
  berth: V3;
}

/** Height of the riverside land above the water, where station models stand. */
export const LAND_Y = 0.7;
const PIER_OUT = 1.0; // pier centre sits this far past the waterline
const BERTH_OUT = 2.95; // hull centre from pier centre

function site(z: number, setback: number, pierDz: number): StationSite {
  const e = leftEdge(z);
  const pz = z + pierDz;
  const px = leftEdge(pz) + PIER_OUT;
  return {
    anchor: [e - setback, LAND_Y, z],
    rotY: Math.PI / 2,
    pier: [px, 0, pz],
    berth: [px + BERTH_OUT, 0, pz],
  };
}

// Station I: Masjid Cheng Ho. The model's front court reaches local z = 36.
const s1 = site(-420, 44, 26);
// Station II: rumah rakit floating just off the bank.
const s2e = leftEdge(-820);
const s2: StationSite = {
  anchor: [s2e + 5.5, 0, -820],
  rotY: Math.PI / 2,
  pier: [leftEdge(-806) + PIER_OUT, 0, -806],
  berth: [leftEdge(-806) + PIER_OUT + BERTH_OUT, 0, -806],
};
// Station III: two kampung side by side. Anchor is the gap between them.
const s3 = site(-1250, 0, 0);
export const MUNAWAR: V3 = [leftEdge(-1196) - 16, LAND_Y, -1196];
export const KAPITAN: V3 = [leftEdge(-1300) - 16, LAND_Y, -1300];
// Station IV: balai on stilts at the waterline.
const s4 = site(-1690, 8, 18);
// Station V: the boat holds in the river facing Ampera.
const s5: StationSite = {
  anchor: [AMPERA_X, 0, AMPERA_Z],
  rotY: 0,
  pier: [leftEdge(-1955) + PIER_OUT, 0, -1955],
  berth: [-72, 0, -1985],
};

export const SITES: StationSite[] = [s1, s2, s3, s4, s5];

export const START: V3 = [-96, 0, 150];

/** Control points for each leg of the trip: leg k runs from stop k to stop k+1. */
export function legPoints(k: number): V3[] {
  const from = k === 0 ? START : SITES[k - 1].berth;
  const to = SITES[k].berth;
  const pts: V3[] = [from];
  // leave along the bank, swing into the river, come back in to berth
  const z0 = from[2];
  const z1 = to[2];
  const span = z0 - z1;
  const out = (z: number, d: number): V3 => [leftEdge(z) + d, 0, z];
  pts.push([from[0] + (k === 0 ? 2 : 1.5), 0, z0 - 16]);
  pts.push(out(z0 - span * 0.22, k === 0 ? 46 : 30));
  pts.push(out(z0 - span * 0.5, 44 + (k % 2) * 14));
  if (k === 4) {
    pts.push([-60, 0, z1 + 120]);
    pts.push([-70, 0, z1 + 22]);
  } else {
    pts.push(out(z0 - span * 0.8, 28));
    pts.push([to[0] + 1.5, 0, z1 + 16]);
  }
  pts.push(to);
  return pts;
}

/** Plain polyline of the whole trip for the map (x, z pairs). */
export function tripPolyline(step = 18): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < 5; k++) {
    const p = legPoints(k);
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i];
      const b = p[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / step));
      for (let j = 0; j < n; j++) out.push([a[0] + ((b[0] - a[0]) * j) / n, a[2] + ((b[2] - a[2]) * j) / n]);
    }
  }
  const last = SITES[4].berth;
  out.push([last[0], last[2]]);
  return out;
}

/** Simple deterministic PRNG so scattered props land in the same place each visit. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Areas kept clear of scattered houses and trees (x, z, radius). */
export const CLEAR: [number, number, number][] = [
  [s1.anchor[0] + 14, s1.anchor[2], 40],
  [s1.pier[0], s1.pier[2], 10],
  [s2.anchor[0] - 4, s2.anchor[2], 14],
  [s2.pier[0], s2.pier[2], 8],
  [MUNAWAR[0] + 6, MUNAWAR[2] - 8, 34],
  [KAPITAN[0] + 6, KAPITAN[2] - 6, 34],
  [s3.pier[0], s3.pier[2], 9],
  [s4.anchor[0], s4.anchor[2], 15],
  [s4.pier[0], s4.pier[2], 8],
  [s5.pier[0], s5.pier[2], 8],
];

export function isClear(x: number, z: number, pad = 0): boolean {
  for (const [cx, cz, r] of CLEAR) if (Math.hypot(x - cx, z - cz) < r + pad) return false;
  // keep the bridge approaches free
  if (Math.abs(z - AMPERA_Z) < 26 + pad) return false;
  return true;
}
