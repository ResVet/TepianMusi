// Scroll position -> where the boat is, what the camera looks at, and the
// hour of the day. Sections in the page are measured once per layout and
// mapped from a probe line just below the middle of the viewport.
import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import { AMPERA_X, AMPERA_Z, KAPITAN, MUNAWAR, SITES, START, legPoints } from './layout';

export const HOURS = [5.33, 6.5, 8.5, 11.5, 16.5, 19.5];

export interface JourneyState {
  s: number; // 0 = start, k = berth of dermaga k
  hero: number;
  dock: number;
  dockIdx: number;
  leg: number;
  end: number;
  hour: number;
  active: string; // id of the section under the probe
  stop: number; // dermaga index under the probe, -1 when travelling
  progress: number; // 0..1 down the page
}

interface Seg {
  el: HTMLElement;
  kind: 'hero' | 'leg' | 'stop' | 'end';
  idx: number;
  top: number;
  height: number;
}

const ease = (x: number) => {
  // gentle departure and arrival with a long even cruise
  const t = MathUtils.clamp(x, 0, 1);
  const a = 0.22;
  if (t < a) return (t * t) / (2 * a * (1 - a));
  if (t > 1 - a) return 1 - ((1 - t) * (1 - t)) / (2 * a * (1 - a));
  return (t - a / 2) / (1 - a);
};

export class Journey {
  private segs: Seg[] = [];
  private docH = 1;
  legs: CatmullRomCurve3[] = [];
  private tmp = new Vector3();

  constructor() {
    for (let k = 0; k < 5; k++) {
      const pts = legPoints(k).map(([x, y, z]) => new Vector3(x, y, z));
      const c = new CatmullRomCurve3(pts, false, 'centripetal');
      c.arcLengthDivisions = 400;
      this.legs.push(c);
    }
  }

  measure() {
    this.segs = [];
    const els = document.querySelectorAll<HTMLElement>('[data-seg]');
    const sy = window.scrollY;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      this.segs.push({
        el,
        kind: el.dataset.seg as Seg['kind'],
        idx: Number(el.dataset.idx ?? 0),
        top: r.top + sy,
        height: Math.max(1, r.height),
      });
    });
    this.docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  /** Top of a section in document pixels (for scrollTo). */
  topOf(id: string): number | null {
    const s = this.segs.find((g) => g.el.id === id);
    return s ? s.top : null;
  }

  sample(scrollY: number, vh: number, out: JourneyState): JourneyState {
    const probe = scrollY + vh * 0.56;
    let seg = this.segs[0];
    for (const g of this.segs) if (g.top <= probe) seg = g;
    out.progress = MathUtils.clamp(scrollY / this.docH, 0, 1);
    out.active = seg?.el.id ?? '';
    out.hero = 0;
    out.dock = 0;
    out.end = 0;
    out.stop = -1;
    if (!seg) {
      out.s = 0;
      out.hero = 1;
      out.hour = HOURS[0];
      out.leg = 0;
      out.dockIdx = 0;
      return out;
    }
    const q = MathUtils.clamp((probe - seg.top) / seg.height, 0, 1);
    const k = seg.idx;
    switch (seg.kind) {
      case 'hero':
        out.s = 0;
        out.hero = 1;
        out.leg = 0;
        out.dockIdx = 0;
        out.hour = HOURS[0] + q * 0.08;
        break;
      case 'leg':
        out.s = k + ease((q - 0.1) / 0.8);
        out.leg = k;
        if (k === 0) out.hero = 1 - MathUtils.smoothstep(q, 0, 0.3);
        else {
          out.dock = 1 - MathUtils.smoothstep(q, 0, 0.26);
          out.dockIdx = k - 1;
        }
        out.hour = MathUtils.lerp(HOURS[k], HOURS[k + 1], MathUtils.clamp((q - 0.05) / 0.9, 0, 1));
        if (k === 0) out.hour = MathUtils.lerp(HOURS[0] + 0.08, HOURS[1], MathUtils.clamp((q - 0.05) / 0.9, 0, 1));
        break;
      case 'stop':
        out.s = k + 1;
        out.leg = k;
        out.dock = MathUtils.smoothstep(q, 0, 0.28);
        out.dockIdx = k;
        out.stop = k;
        out.hour = HOURS[k + 1] + q * 0.3;
        break;
      case 'end':
        out.s = 5;
        out.leg = 4;
        out.dock = 1;
        out.dockIdx = 4;
        out.end = MathUtils.smoothstep(q, 0.0, 0.55);
        out.hour = HOURS[5] + 0.3 + q * 0.45;
        break;
    }
    return out;
  }

  /** Boat position and heading for path parameter s (0..5). */
  boat(s: number, pos: Vector3, dir: Vector3) {
    const k = Math.min(4, Math.floor(Math.max(0, s)));
    const u = MathUtils.clamp(s - k, 0, 1);
    const c = this.legs[k];
    c.getPointAt(u, pos);
    c.getTangentAt(Math.min(0.999, Math.max(0.001, u)), dir);
    pos.y = 0;
    return pos;
  }

  /** Point ahead on the path, for look-ahead framing. */
  ahead(s: number, metres: number, out: Vector3) {
    const k = Math.min(4, Math.floor(Math.max(0, s)));
    const c = this.legs[k];
    const len = c.getLength();
    const u = MathUtils.clamp(s - k + metres / len, 0, 1);
    return c.getPointAt(u, out);
  }
}

// ------------------------------------------------------------ camera ----
export interface Pose {
  pos: Vector3;
  target: Vector3;
  fov: number;
  shiftX: number; // fraction of width; positive moves the subject left
  shiftY: number; // fraction of height; positive moves the subject up
}

export const makePose = (): Pose => ({ pos: new Vector3(), target: new Vector3(), fov: 40, shiftX: 0, shiftY: 0 });

export function lerpPose(a: Pose, b: Pose, t: number, out: Pose) {
  out.pos.lerpVectors(a.pos, b.pos, t);
  out.target.lerpVectors(a.target, b.target, t);
  out.fov = MathUtils.lerp(a.fov, b.fov, t);
  out.shiftX = MathUtils.lerp(a.shiftX, b.shiftX, t);
  out.shiftY = MathUtils.lerp(a.shiftY, b.shiftY, t);
  return out;
}

export function copyPose(a: Pose, out: Pose) {
  out.pos.copy(a.pos);
  out.target.copy(a.target);
  out.fov = a.fov;
  out.shiftX = a.shiftX;
  out.shiftY = a.shiftY;
  return out;
}

/** Chase styles per leg, in the boat frame: f forward, r right, u up. */
const CHASE: { off: [number, number, number]; look: [number, number, number]; fov: number }[] = [
  { off: [-13, 4.6, 3.2], look: [26, -7, 1.4], fov: 42 }, // dawn, behind and above
  { off: [-2.5, 8.2, 1.05], look: [7, -11, 1.5], fov: 40 }, // low at the waterline, beside the hull
  { off: [-26, 22, 26], look: [70, -12, 2], fov: 42 }, // drone, high over the river
  { off: [15, -4.8, 3.0], look: [-9, 1.8, 1.1], fov: 40 }, // ahead, looking back at the ketek
  { off: [-11.5, 3.2, 2.5], look: [44, -2, 5.5], fov: 42 }, // into the sunset toward Ampera
];

export function chasePose(leg: number, boat: Vector3, dir: Vector3, out: Pose) {
  const c = CHASE[MathUtils.clamp(leg, 0, CHASE.length - 1)];
  const fx = dir.x;
  const fz = dir.z;
  const rx = -fz;
  const rz = fx;
  out.pos.set(boat.x + fx * c.off[0] + rx * c.off[1], c.off[2], boat.z + fz * c.off[0] + rz * c.off[1]);
  out.target.set(boat.x + fx * c.look[0] + rx * c.look[1], c.look[2], boat.z + fz * c.look[0] + rz * c.look[1]);
  out.fov = c.fov;
  out.shiftX = 0;
  out.shiftY = 0;
  return out;
}

export function heroPose(out: Pose, narrow: boolean) {
  const [x, , z] = START;
  if (narrow) {
    // phones: boat in the upper half, text and ticket below it
    out.pos.set(x + 8, 3.6, z + 17);
    out.target.set(x - 4.3, -4.9, z - 9.1);
    out.fov = 52;
  } else {
    // horizon through the middle, ketek just right of centre, low in frame
    out.pos.set(x + 12, 4, z + 22);
    out.target.set(x - 5.3, 4, z - 14.1);
    out.fov = 40;
  }
  out.shiftX = 0;
  out.shiftY = 0;
  return out;
}

/** Station framing. `side` is where the text panel sits (1 right, -1 left). */
export function stationPose(i: number, out: Pose, narrow: boolean, side: number) {
  const s = SITES[i];
  const [ax, ay, az] = s.anchor;
  switch (i) {
    case 0:
      out.pos.set(ax + 76, ay + 6.2, az + 40);
      out.target.set(ax + 8, ay + 10.5, az - 1);
      out.fov = 38;
      break;
    case 1:
      out.pos.set(ax + 17.5, 3.8, az + 13);
      out.target.set(ax + 0.5, 2.0, az - 0.5);
      out.fov = 40;
      break;
    case 2:
      // along the bank: Al-Munawar near, Kapitan beyond, river under the panel
      out.pos.set(MUNAWAR[0] + 44, 17, MUNAWAR[2] + 22);
      out.target.set(MUNAWAR[0] - 6, 3, KAPITAN[2] + 8);
      out.fov = 48;
      break;
    case 3:
      out.pos.set(ax + 19.5, ay + 4.6, az + 12);
      out.target.set(ax + 0.5, ay + 3.3, az - 0.5);
      out.fov = 40;
      break;
    default:
      out.pos.set(-104, 7.5, AMPERA_Z + 238);
      out.target.set(AMPERA_X - 6, 27, AMPERA_Z);
      out.fov = 36;
      break;
  }
  if (narrow) {
    out.fov += 10;
    out.shiftX = 0;
    out.shiftY = 0.16;
  } else {
    out.shiftX = (i === 2 ? 0.07 : 0.15) * side;
    out.shiftY = 0;
  }
  return out;
}

export function endPose(out: Pose, narrow: boolean) {
  out.pos.set(-236, 88, AMPERA_Z + 210);
  out.target.set(AMPERA_X - 20, 18, AMPERA_Z - 20);
  out.fov = narrow ? 50 : 38;
  out.shiftX = narrow ? 0 : 0.08;
  out.shiftY = narrow ? 0.12 : 0;
  return out;
}
