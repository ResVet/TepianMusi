// The ketek we ride, the jukung traffic around it, and the egrets.
import { Group, Mesh, Object3D, Vector3, type Camera, type Texture } from 'three';
import { meshesOf } from './assets';
import { leftEdge, rightEdge, rng } from './layout';
import { Wake } from './wake';

/** Move a mesh's origin to the centre of its geometry (keeps it in place). */
export function recenter(mesh: Mesh) {
  const g = mesh.geometry;
  g.computeBoundingBox();
  const c = new Vector3();
  g.boundingBox!.getCenter(c);
  if (c.lengthSq() < 1e-8) return;
  mesh.geometry = g.clone().translate(-c.x, -c.y, -c.z);
  mesh.position.add(c.applyQuaternion(mesh.quaternion).multiply(mesh.scale));
}

/** Water surface height used for bobbing (gentle, long swell). */
export function swell(x: number, z: number, t: number) {
  return 0.05 * Math.sin(x * 0.21 + t * 1.3) + 0.035 * Math.sin(z * 0.17 - t * 1.1) + 0.02 * Math.sin((x + z) * 0.5 + t * 2.3);
}

export class Boat {
  root = new Group();
  private bob = new Group();
  private prop: Mesh | null = null;
  wake: Wake;
  speed = 0;
  private spin = 0;
  private stern = new Vector3();
  private dir = new Vector3(0, 0, -1);
  private last = new Vector3(Number.NaN, 0, 0);
  private yaw = Math.PI / 2;

  constructor(model: Object3D, foam: Texture, private length: number, wakeWidth = 1.0) {
    const body = model.clone(true);
    this.bob.add(body);
    this.root.add(this.bob);
    body.traverse((o) => {
      if (o.userData.tm === 'prop' && (o as Mesh).isMesh) this.prop = o as Mesh;
    });
    if (this.prop) recenter(this.prop);
    this.wake = new Wake(foam, wakeWidth, 0.5, 13);
    this.wake.mesh.layers.set(1);
  }

  /** Place the boat. `dir` is the heading on the water plane. */
  place(pos: Vector3, dir: Vector3, dt: number, t: number) {
    if (!Number.isNaN(this.last.x) && dt > 0) {
      const v = pos.distanceTo(this.last) / dt;
      this.speed += (Math.min(v, 14) - this.speed) * Math.min(1, dt * 3);
    }
    this.last.copy(pos);
    if (dir.lengthSq() > 1e-6) this.dir.copy(dir).setY(0).normalize();
    const targetYaw = Math.atan2(-this.dir.z, this.dir.x);
    let dy = targetYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const turn = dy;
    this.yaw += dy * Math.min(1, dt * 6 + 0.02);
    this.root.position.set(pos.x, 0, pos.z);
    this.root.rotation.y = this.yaw;
    const sp = Math.min(1, this.speed / 6);
    this.bob.position.y = swell(pos.x, pos.z, t) * (1 - sp * 0.5) - 0.02 + sp * 0.04;
    this.bob.rotation.x = 0.025 * Math.sin(t * 1.3 + pos.z * 0.1) - turn * 0.6 * sp;
    this.bob.rotation.z = 0.018 * Math.sin(t * 1.05) + sp * 0.035;
    this.spin += dt * (4 + this.speed * 7);
    if (this.prop) this.prop.rotation.x = this.spin;
    this.stern.set(-this.length * 0.5, 0, 0).applyAxisAngle(Object3D.DEFAULT_UP, this.yaw).add(this.root.position);
    this.wake.update(t, this.stern, this.dir, this.speed);
  }

  get heading() {
    return this.dir;
  }
}

interface Runner {
  boat: Boat;
  lane: number;
  dir: 1 | -1;
  v: number;
  z: number;
}

/** A few jukung puttering up and down the river near the camera. */
export class Traffic {
  root = new Group();
  private runners: Runner[] = [];
  private pos = new Vector3();
  private d = new Vector3();
  private r = rng(7);

  constructor(models: Object3D[], foam: Texture, count: number) {
    const lanes = [-112, -70, -18, 40, 96];
    for (let i = 0; i < count; i++) {
      const boat = new Boat(models[i % models.length], foam, 8.5, 0.7);
      const dir: 1 | -1 = i % 2 === 0 ? -1 : 1;
      const runner: Runner = { boat, lane: lanes[i % lanes.length] + (this.r() - 0.5) * 12, dir, v: 4.5 + this.r() * 3, z: 200 - i * 180 };
      this.runners.push(runner);
      this.root.add(boat.root);
    }
  }

  get wakes() {
    return this.runners.map((r) => r.boat.wake);
  }

  update(dt: number, t: number, camZ: number) {
    for (const r of this.runners) {
      r.z += r.dir * -r.v * dt;
      // keep them within reach of the camera
      const rel = r.z - camZ;
      if (rel < -900 || rel > 500) {
        r.z = camZ + (r.dir < 0 ? 380 + this.r() * 100 : -700 - this.r() * 150);
        r.lane = [-112, -70, -18, 40, 96][Math.floor(this.r() * 5)] + (this.r() - 0.5) * 10;
        r.v = 4.5 + this.r() * 3;
      }
      const le = leftEdge(r.z) + 26;
      const re = rightEdge(r.z) - 26;
      const x = Math.min(re, Math.max(le, r.lane + Math.sin(r.z * 0.004 + r.lane) * 8));
      this.pos.set(x, 0, r.z);
      this.d.set(Math.cos(r.z * 0.004 + r.lane) * 0.03, 0, -r.dir);
      r.boat.place(this.pos, this.d, dt, t);
    }
  }
}

interface Bird {
  o: Object3D;
  wings: { o: Object3D; side: number }[];
  off: Vector3;
  phase: number;
}

/** Kuntul: a small flock crossing the river and a few birds at the waterline. */
export class Egrets {
  root = new Group();
  private flock: Bird[] = [];
  private center = new Vector3();
  private vel = new Vector3();
  private r = rng(11);
  private timer = 0;

  constructor(model: Object3D, perched: [number, number, number][]) {
    for (let i = 0; i < 7; i++) {
      const o = model.clone(true);
      o.scale.setScalar(1.15);
      const wings: Bird['wings'] = [];
      o.traverse((c) => {
        if (c.userData.tm === 'wing') wings.push({ o: c, side: Number(c.userData.tm_side) || 1 });
      });
      this.flock.push({ o, wings, off: new Vector3((i % 2 ? 1 : -1) * Math.ceil(i / 2) * 2.2, (this.r() - 0.5) * 1.2, -Math.ceil(i / 2) * 2.6), phase: this.r() * 6 });
      this.root.add(o);
    }
    for (const [x, y, z] of perched) {
      const o = model.clone(true);
      o.traverse((c) => {
        if (c.userData.tm === 'wing') c.scale.set(1, 1, 0.25);
      });
      o.position.set(x, y + 0.25, z);
      o.rotation.y = this.r() * Math.PI * 2;
      o.rotation.z = 0.5;
      this.root.add(o);
    }
    this.respawn(new Vector3(-90, 0, 0));
  }

  private respawn(cam: Vector3) {
    // cross the view diagonally, ahead of the camera
    const z = cam.z - 120 - this.r() * 120;
    const fromLeft = this.r() < 0.5;
    this.center.set(fromLeft ? -260 : 160, 16 + this.r() * 14, z + (this.r() - 0.5) * 60);
    this.vel.set(fromLeft ? 1 : -1, 0, (this.r() - 0.5) * 0.4).normalize().multiplyScalar(9 + this.r() * 3);
    this.timer = 0;
  }

  update(dt: number, t: number, camera: Camera) {
    this.timer += dt;
    this.center.addScaledVector(this.vel, dt);
    const cam = camera.position;
    if (this.timer > 55 || Math.abs(this.center.x - cam.x) > 420 || this.center.z - cam.z > 300) this.respawn(cam);
    const yaw = Math.atan2(-this.vel.z, this.vel.x);
    const fx = this.vel.x / this.vel.length();
    const fz = this.vel.z / this.vel.length();
    for (const b of this.flock) {
      // formation offsets are in the flight frame: x to the right, z forward
      const rx = -fz;
      const rz = fx;
      b.o.position.set(
        this.center.x + rx * b.off.x + fx * b.off.z,
        this.center.y + b.off.y + Math.sin(t * 1.4 + b.phase) * 0.4,
        this.center.z + rz * b.off.x + fz * b.off.z,
      );
      b.o.rotation.set(0, yaw, 0);
      const flap = Math.sin(t * 7.5 + b.phase);
      for (const w of b.wings) w.o.rotation.x = flap * 0.75 * w.side;
    }
  }
}

export function allMeshes(o: Object3D) {
  return meshesOf(o);
}
