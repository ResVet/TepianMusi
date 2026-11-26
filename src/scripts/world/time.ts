// Time of day for the trip: 05.20 at the hilir to 20.00 under Ampera.
// Directions: +Z east (behind the boat), -Z west (toward Ampera), +X north.
// The sun's arc leans north a little so the dermaga facades, which face the
// river (+X), catch light through the day.
import { Color, MathUtils, Vector3 } from 'three';

export interface Sky {
  hour: number;
  sunEl: number; // degrees
  sunAz: number; // radians, 0 = east (+Z), PI = west (-Z), PI/2 = north (+X)
  zenith: string;
  horizon: string;
  ground: string;
  sun: string; // sun light colour
  sunI: number; // directional light intensity
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  env: number; // environment (IBL) intensity
  fog: number; // FogExp2 density
  exposure: number;
  glow: number; // sky sun glow strength
  stars: number;
  cloud: number; // cloud coverage 0..1
  cloudLit: string;
  cloudDark: string;
  lamps: number; // 0..1, artificial lights
  city: number; // 0..1, glow of the city on the horizon
  water: string; // water body colour
  mist: number; // low mist over the river
  bloom: number;
}

const K: Sky[] = [
  { hour: 5.0, sunEl: -9, sunAz: 0.42, zenith: '#0b1426', horizon: '#3b3f52', ground: '#1a1c22', sun: '#ff9a6a', sunI: 0, hemiSky: '#5a6d96', hemiGround: '#1e1c1a', hemiI: 0.35, env: 0.5, fog: 0.0019, exposure: 1.55, glow: 0.4, stars: 0.6, cloud: 0.32, cloudLit: '#3a3e55', cloudDark: '#141824', lamps: 1, city: 0.5, water: '#1d2026', mist: 0.75, bloom: 1.15 },
  { hour: 5.6, sunEl: -2.5, sunAz: 0.4, zenith: '#22345a', horizon: '#c98a72', ground: '#3a3330', sun: '#ff8c55', sunI: 0.25, hemiSky: '#7d8fb5', hemiGround: '#2d2722', hemiI: 0.45, env: 0.7, fog: 0.0021, exposure: 1.25, glow: 1.0, stars: 0.15, cloud: 0.36, cloudLit: '#e5a07e', cloudDark: '#4a4256', lamps: 0.85, city: 0.25, water: '#2c2a2c', mist: 1, bloom: 1.0 },
  { hour: 6.5, sunEl: 7, sunAz: 0.38, zenith: '#3c6cad', horizon: '#f6ad76', ground: '#6b5a4c', sun: '#ffb47a', sunI: 1.9, hemiSky: '#9fb6d6', hemiGround: '#4a3f33', hemiI: 0.45, env: 0.85, fog: 0.0016, exposure: 1.05, glow: 1.0, stars: 0, cloud: 0.33, cloudLit: '#ffd0a0', cloudDark: '#8a7f8c', lamps: 0.15, city: 0, water: '#3a352c', mist: 0.75, bloom: 0.85 },
  { hour: 8.5, sunEl: 32, sunAz: 0.55, zenith: '#2f6fc4', horizon: '#bcd5e8', ground: '#7d7464', sun: '#fff0d8', sunI: 3.0, hemiSky: '#a9c4e2', hemiGround: '#5a5040', hemiI: 0.4, env: 1.0, fog: 0.0011, exposure: 0.95, glow: 0.6, stars: 0, cloud: 0.36, cloudLit: '#ffffff', cloudDark: '#a4acb8', lamps: 0, city: 0, water: '#4a4130', mist: 0.18, bloom: 0.7 },
  { hour: 11.5, sunEl: 72, sunAz: 1.25, zenith: '#2369cc', horizon: '#cbdfee', ground: '#857d6c', sun: '#fffaf0', sunI: 3.4, hemiSky: '#b3cdea', hemiGround: '#62584a', hemiI: 0.38, env: 1.0, fog: 0.00085, exposure: 0.9, glow: 0.45, stars: 0, cloud: 0.42, cloudLit: '#ffffff', cloudDark: '#aab4c2', lamps: 0, city: 0, water: '#4d4431', mist: 0, bloom: 0.65 },
  { hour: 14.5, sunEl: 48, sunAz: 2.35, zenith: '#2a6cc6', horizon: '#d2e0e8', ground: '#857b68', sun: '#fff3de', sunI: 3.2, hemiSky: '#afc8e4', hemiGround: '#5f5444', hemiI: 0.38, env: 1.0, fog: 0.0009, exposure: 0.92, glow: 0.5, stars: 0, cloud: 0.55, cloudLit: '#ffffff', cloudDark: '#9fa9b8', lamps: 0, city: 0, water: '#4b4230', mist: 0, bloom: 0.65 },
  { hour: 16.5, sunEl: 19, sunAz: 2.72, zenith: '#3b67a8', horizon: '#f3ba83', ground: '#7a644e', sun: '#ffc78c', sunI: 2.8, hemiSky: '#a9b9d2', hemiGround: '#5a4836', hemiI: 0.4, env: 0.95, fog: 0.001, exposure: 0.98, glow: 0.95, stars: 0, cloud: 0.5, cloudLit: '#ffe2bc', cloudDark: '#8c8794', lamps: 0, city: 0, water: '#4a3c2b', mist: 0.05, bloom: 0.8 },
  { hour: 18.1, sunEl: 0.5, sunAz: 2.9, zenith: '#2e3b66', horizon: '#ff8f55', ground: '#4a3328', sun: '#ff7438', sunI: 1.1, hemiSky: '#7a7fa6', hemiGround: '#3a2a22', hemiI: 0.42, env: 0.75, fog: 0.0012, exposure: 1.12, glow: 1.25, stars: 0.05, cloud: 0.46, cloudLit: '#ff9a62', cloudDark: '#4d3c54', lamps: 0.55, city: 0.25, water: '#3a2a24', mist: 0.2, bloom: 1.0 },
  { hour: 18.8, sunEl: -6, sunAz: 2.95, zenith: '#151f3d', horizon: '#6b4a5c', ground: '#231c22', sun: '#ff6a3a', sunI: 0, hemiSky: '#4f5a85', hemiGround: '#221a1a', hemiI: 0.4, env: 0.55, fog: 0.0012, exposure: 1.4, glow: 0.7, stars: 0.4, cloud: 0.4, cloudLit: '#7a5068', cloudDark: '#1f1a2c', lamps: 1, city: 0.7, water: '#1d1a22', mist: 0.25, bloom: 1.25 },
  { hour: 19.5, sunEl: -16, sunAz: 3.0, zenith: '#070c1c', horizon: '#2a2638', ground: '#121116', sun: '#ff6a3a', sunI: 0, hemiSky: '#3d4a78', hemiGround: '#17130f', hemiI: 0.38, env: 0.5, fog: 0.00105, exposure: 1.55, glow: 0.3, stars: 1, cloud: 0.32, cloudLit: '#3a3248', cloudDark: '#0c0d16', lamps: 1, city: 1, water: '#111219', mist: 0.18, bloom: 1.35 },
  { hour: 21.0, sunEl: -30, sunAz: 3.1, zenith: '#050913', horizon: '#221f30', ground: '#0e0d12', sun: '#ff6a3a', sunI: 0, hemiSky: '#36416c', hemiGround: '#141110', hemiI: 0.36, env: 0.45, fog: 0.001, exposure: 1.6, glow: 0.2, stars: 1, cloud: 0.3, cloudLit: '#2e2a3c', cloudDark: '#0a0b12', lamps: 1, city: 1, water: '#0e0f15', mist: 0.15, bloom: 1.4 },
];

const NUM_KEYS: (keyof Sky)[] = ['sunEl', 'sunAz', 'sunI', 'hemiI', 'env', 'fog', 'exposure', 'glow', 'stars', 'cloud', 'lamps', 'city', 'mist', 'bloom'];
const COL_KEYS: (keyof Sky)[] = ['zenith', 'horizon', 'ground', 'sun', 'hemiSky', 'hemiGround', 'cloudLit', 'cloudDark', 'water'];

export interface SkyState {
  hour: number;
  sunDir: Vector3;
  moonDir: Vector3;
  nums: Record<string, number>;
  cols: Record<string, Color>;
}

const ca = new Color();
const cb = new Color();

export function createSkyState(): SkyState {
  const cols: Record<string, Color> = {};
  for (const k of COL_KEYS) cols[k as string] = new Color();
  return { hour: 0, sunDir: new Vector3(), moonDir: new Vector3(0.35, 0.62, -0.7).normalize(), nums: {}, cols };
}

/** Interpolate the keyframes at `hour` into `out` (no allocation). */
export function sampleSky(hour: number, out: SkyState): SkyState {
  const h = MathUtils.clamp(hour, K[0].hour, K[K.length - 1].hour);
  let i = 0;
  while (i < K.length - 2 && K[i + 1].hour < h) i++;
  const a = K[i];
  const b = K[i + 1];
  const t = MathUtils.smoothstep(h, a.hour, b.hour) * 0.35 + ((h - a.hour) / (b.hour - a.hour)) * 0.65;
  for (const k of NUM_KEYS) out.nums[k as string] = MathUtils.lerp(a[k] as number, b[k] as number, t);
  for (const k of COL_KEYS) {
    // mix in linear space for smooth sky transitions
    ca.set(a[k] as string);
    cb.set(b[k] as string);
    out.cols[k as string].copy(ca).lerp(cb, t);
  }
  out.hour = h;
  const el = MathUtils.degToRad(out.nums.sunEl);
  const az = out.nums.sunAz;
  out.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  return out;
}

/** "06.30" style clock text for a fractional hour. */
export function clockText(hour: number): string {
  const total = Math.round(hour * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}.${String(mm).padStart(2, '0')}`;
}

/** A short Indonesian name for the part of the day. */
export function dayPart(hour: number): string {
  if (hour < 5.75) return 'Subuh';
  if (hour < 10.5) return 'Pagi';
  if (hour < 15) return 'Siang';
  if (hour < 18.2) return 'Sore';
  return 'Malam';
}
