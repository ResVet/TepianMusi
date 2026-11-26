// Shared machinery for the five dermaga: an orbit camera around a pivot,
// pointer and keyboard handling, ray picks on a plane, and the stamp.
import { gsap } from 'gsap';
import { MathUtils, Object3D, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { hud, h } from '../../ui/hud';
import { progress } from '../../ui/progress';
import { sound } from '../../ui/sound';
import { icons } from '../../../generated/icons';
import type { World } from '../index';
import { makePose } from '../journey';

export interface Orbit {
  pivot: Vector3;
  yaw: number; // radians around Y; 0 = camera on +X of the pivot
  pitch: number;
  dist: number;
  fov: number;
  yawMin: number;
  yawMax: number;
  pitchMin: number;
  pitchMax: number;
  distMin: number;
  distMax: number;
}

export abstract class Interaction {
  abstract readonly index: number;
  abstract readonly title: string;
  readonly sub: string;
  protected orbit: Orbit = {
    pivot: new Vector3(), yaw: 0, pitch: 0.3, dist: 10, fov: 40,
    yawMin: -0.8, yawMax: 0.8, pitchMin: 0.05, pitchMax: 1.2, distMin: 4, distMax: 20,
  };
  private goal = { yaw: 0, pitch: 0.3, dist: 10 };
  private pivotGoal = new Vector3();
  private pose = makePose();
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  private dragging = false;
  protected busy = false;
  protected ray = new Raycaster();
  private ndc = new Vector2();
  private plane = new Plane();
  private canvas: HTMLCanvasElement;
  protected done = false;

  constructor(protected world: World, sub: string) {
    this.sub = sub;
    this.canvas = world.renderer.domElement;
  }

  /** Called once each time the interaction opens: build UI, set orbit. */
  protected abstract setup(): void;
  /** Per-frame hook while open. */
  protected tick(_dt: number, _t: number): void {}
  /** Undo temporary scene changes when leaving. */
  protected teardown(): void {}

  open(onClosed: () => void) {
    this.done = progress.state.done[this.index];
    this.setup();
    this.goal.yaw = this.orbit.yaw;
    this.goal.pitch = this.orbit.pitch;
    this.goal.dist = this.orbit.dist;
    this.pivotGoal.copy(this.orbit.pivot);
    this.writePose();
    this.world.setOverride(this.pose);
    this.world.frozen = true;
    gsap.to(this.world, { overrideK: 1, duration: 1.4, ease: 'power3.inOut' });
    hud.show(this.title, this.sub, () => this.close(onClosed));
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    this.world.onTick = (dt, t) => this.frame(dt, t);
  }

  close(onClosed: () => void) {
    this.teardown();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    this.world.onTick = null;
    hud.hide();
    gsap.to(this.world, {
      overrideK: 0,
      duration: 1.2,
      ease: 'power3.inOut',
      onComplete: () => {
        this.world.frozen = false;
      },
    });
    onClosed();
  }

  private frame(dt: number, t: number) {
    const o = this.orbit;
    const k = 1 - Math.exp(-dt * 8);
    o.yaw += (this.goal.yaw - o.yaw) * k;
    o.pitch += (this.goal.pitch - o.pitch) * k;
    o.dist += (this.goal.dist - o.dist) * k;
    o.pivot.lerp(this.pivotGoal, 1 - Math.exp(-dt * 4));
    this.tick(dt, t);
    this.writePose();
    this.world.setOverride(this.pose);
    hud.project(this.world.camera, this.world.width, this.world.height);
  }

  private writePose() {
    const o = this.orbit;
    const cp = Math.cos(o.pitch);
    this.pose.pos.set(
      o.pivot.x + Math.cos(o.yaw) * cp * o.dist,
      o.pivot.y + Math.sin(o.pitch) * o.dist,
      o.pivot.z - Math.sin(o.yaw) * cp * o.dist,
    );
    this.pose.target.copy(o.pivot);
    this.pose.fov = o.fov;
    this.pose.shiftX = 0;
    // leave room for the bottom sheet
    this.pose.shiftY = this.world.narrow ? 0.24 : 0.15;
  }

  /** Move the orbit to look at a new point (animated). */
  protected focusOn(p: Vector3, dist?: number, yaw?: number, pitch?: number) {
    this.pivotGoal.copy(p);
    if (dist !== undefined) this.goal.dist = MathUtils.clamp(dist, this.orbit.distMin, this.orbit.distMax);
    if (yaw !== undefined) this.goal.yaw = MathUtils.clamp(yaw, this.orbit.yawMin, this.orbit.yawMax);
    if (pitch !== undefined) this.goal.pitch = MathUtils.clamp(pitch, this.orbit.pitchMin, this.orbit.pitchMax);
  }

  protected setLimits(o: Partial<Orbit>) {
    Object.assign(this.orbit, o);
    this.goal.yaw = MathUtils.clamp(this.goal.yaw, this.orbit.yawMin, this.orbit.yawMax);
    this.goal.pitch = MathUtils.clamp(this.goal.pitch, this.orbit.pitchMin, this.orbit.pitchMax);
    this.goal.dist = MathUtils.clamp(this.goal.dist, this.orbit.distMin, this.orbit.distMax);
  }

  // ---------------------------------------------------------- input ----
  private onDown = (e: PointerEvent) => {
    if (this.busy) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.dragging = true;
    this.canvas.setPointerCapture?.(e.pointerId);
    if (this.pointers.size === 2) this.pinch = this.pinchDist();
  };

  private onMove = (e: PointerEvent) => {
    if (!this.dragging || !this.pointers.has(e.pointerId)) return;
    const p = this.pointers.get(e.pointerId)!;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 2) {
      const d = this.pinchDist();
      if (this.pinch > 0) this.zoom(this.pinch / d);
      this.pinch = d;
      return;
    }
    const o = this.orbit;
    this.goal.yaw = MathUtils.clamp(this.goal.yaw - dx * 0.006, o.yawMin, o.yawMax);
    this.goal.pitch = MathUtils.clamp(this.goal.pitch + dy * 0.005, o.pitchMin, o.pitchMax);
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = 0;
    if (this.pointers.size === 0) this.dragging = false;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom(Math.exp(e.deltaY * 0.0012));
  };

  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const o = this.orbit;
    if (e.key === 'ArrowLeft') this.goal.yaw = MathUtils.clamp(this.goal.yaw + 0.12, o.yawMin, o.yawMax);
    else if (e.key === 'ArrowRight') this.goal.yaw = MathUtils.clamp(this.goal.yaw - 0.12, o.yawMin, o.yawMax);
    else if (e.key === 'ArrowUp') this.goal.pitch = MathUtils.clamp(this.goal.pitch + 0.08, o.pitchMin, o.pitchMax);
    else if (e.key === 'ArrowDown') this.goal.pitch = MathUtils.clamp(this.goal.pitch - 0.08, o.pitchMin, o.pitchMax);
    else if (e.key === '+' || e.key === '=') this.zoom(0.85);
    else if (e.key === '-') this.zoom(1.18);
    else return;
    e.preventDefault();
  };

  private zoom(f: number) {
    const o = this.orbit;
    this.goal.dist = MathUtils.clamp(this.goal.dist * f, o.distMin, o.distMax);
  }

  private pinchDist() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }

  /** Ray from a screen point onto a horizontal plane at world height y. */
  protected pickPlane(clientX: number, clientY: number, y: number, out: Vector3): boolean {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.world.camera);
    this.plane.set(new Vector3(0, 1, 0), -y);
    return this.ray.ray.intersectPlane(this.plane, out) !== null;
  }

  /** World position of a point given in an object's local space. */
  protected worldOf(o: Object3D, local: Vector3 | [number, number, number], out = new Vector3()) {
    if (Array.isArray(local)) out.set(local[0], local[1], local[2]);
    else out.copy(local);
    return o.localToWorld(out);
  }

  // ------------------------------------------------------- feedback ----
  /** Mark this dermaga done: stamp, sound, LED segment. */
  protected complete(message: string) {
    const first = progress.complete(this.index);
    sound.play('chime');
    if (first) setTimeout(() => sound.play('stamp'), 600);
    this.done = true;
    return this.backBox(message);
  }

  /** "Done" note with a way back, without fanfare (for repeat visits). */
  protected backBox(message: string) {
    const back = h('button', { class: 'tombol tombol--emas', type: 'button' });
    back.innerHTML = `${icons['check-circle-linear']}<span>Kembali ke perjalanan</span>`;
    back.addEventListener('click', () => hud.requestClose());
    return h('div', { class: 'selesai' }, h('p', { class: 'hud-umpan is-baik' }, message), back);
  }
}

export function chip(label: string, opts: { pressed?: boolean; cls?: string } = {}) {
  const b = h('button', { class: `chip ${opts.cls ?? ''}`, type: 'button' }, label);
  if (opts.pressed !== undefined) b.setAttribute('aria-pressed', String(opts.pressed));
  return b;
}

/** Arc an object from where it is to `to` (both in its parent's space). */
export function hop(o: Object3D, to: Vector3, height = 0.15, duration = 0.7) {
  const from = o.position.clone();
  const st = { t: 0 };
  return gsap.to(st, {
    t: 1,
    duration,
    ease: 'power2.inOut',
    onUpdate: () => {
      o.position.lerpVectors(from, to, st.t);
      o.position.y += Math.sin(st.t * Math.PI) * height;
    },
  });
}

/** Grow or shrink an object vertically into view. */
export function grow(o: Object3D, show: boolean, duration = 0.6) {
  if (show) {
    o.visible = true;
    o.scale.set(0.001, 0.001, 0.001);
    return gsap.to(o.scale, { x: 1, y: 1, z: 1, duration, ease: 'back.out(1.6)' });
  }
  return gsap.to(o.scale, {
    x: 0.001,
    y: 0.001,
    z: 0.001,
    duration: duration * 0.7,
    ease: 'power2.in',
    onComplete: () => {
      o.visible = false;
    },
  });
}
