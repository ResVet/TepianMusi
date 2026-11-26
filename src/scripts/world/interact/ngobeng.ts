// Dermaga II: lay out the idangan. Eight guests sit around the sepra and
// each can reach the four lauk nearest to them; arrange the eight plates
// so nobody has to stretch across a neighbour.
import { gsap } from 'gsap';
import { Vector3, type Object3D } from 'three';
import { iwak, stations } from '../../../data/stations';
import { hud, h, type Anchor } from '../../ui/hud';
import { sound } from '../../ui/sound';
import type { World } from '../index';
import { Interaction, chip, hop } from './base';

const CENTER = { x: 0, z: 1.55 };
const PLATE_Y = 0.5;
const R_SLOT = 0.62;
const R_GUEST = 1.22;

const slotPos = (i: number) => {
  const a = (i * Math.PI) / 4;
  return new Vector3(CENTER.x + Math.cos(a) * R_SLOT, PLATE_Y, CENTER.z + Math.sin(a) * R_SLOT);
};
const guestPos = (g: number) => {
  const a = ((g + 0.5) * Math.PI) / 4;
  return new Vector3(CENTER.x + Math.cos(a) * R_GUEST, 0.98, CENTER.z + Math.sin(a) * R_GUEST);
};
/** Slots a guest can reach: the two either side and the next two out. */
const reach = (g: number) => [g - 1, g, g + 1, g + 2].map((i) => ((i % 8) + 8) % 8);

interface Plate {
  o: Object3D;
  kind: string;
  home: Vector3;
  slot: number; // -1 = still on the nampan
  anchor?: Anchor;
}

export class Ngobeng extends Interaction {
  readonly index = 1;
  readonly title = stations[1].title;
  private model: Object3D | null = null;
  private plates: Plate[] = [];
  private slots: (Plate | null)[] = new Array(8).fill(null);
  private slotAnchors: Anchor[] = [];
  private guestLabels: Anchor[] = [];
  private picked: Plate | null = null;
  private status!: HTMLElement;
  private feedback!: HTMLElement;
  private roof: Object3D | null = null;
  private drag: { plate: Plate; id: number; x: number; y: number; moved: boolean } | null = null;
  private dragEnded = 0;
  private solved = false;

  constructor(world: World) {
    super(world, `Dermaga II · ${stations[1].silaShort}`);
  }

  private find() {
    if (this.model) return;
    const g = this.world.stations.groups[1];
    const first = g.getObjectByName('iwak_malbi_a');
    if (!first || !first.parent) throw new Error('model ngobeng belum siap');
    this.model = first.parent;
    for (const k of iwak) {
      for (const s of ['a', 'b']) {
        const o = this.model.getObjectByName(`iwak_${k.id}_${s}`)!;
        this.plates.push({ o, kind: k.id, home: o.position.clone(), slot: -1 });
      }
    }
    this.roof = this.model.getObjectByName('rakit_atap') ?? null;
  }

  protected setup() {
    this.find();
    const g = this.world.stations.groups[1];
    g.updateMatrixWorld(true);
    // High and steep: the veranda's front beam sits between a low camera and
    // the sepra. On a wide screen the tray sits to the left of the sepra; on a
    // phone held upright, look down the tray-to-sepra line instead so both
    // fit above the sheet.
    if (this.world.width >= this.world.height) {
      this.worldOf(this.model!, [CENTER.x - 0.45, 0.5, CENTER.z], this.orbit.pivot);
      Object.assign(this.orbit, { yaw: 0.05, pitch: 1.2, dist: 3.7, fov: 44 });
      this.setLimits({ yawMin: -0.9, yawMax: 0.9, pitchMin: 0.85, pitchMax: 1.42, distMin: 2.4, distMax: 5.2 });
    } else {
      const o = this.worldOf(this.model!, [CENTER.x, 0.5, CENTER.z]);
      const along = this.worldOf(this.model!, [CENTER.x + 1, 0.5, CENTER.z]).sub(o);
      const yaw = Math.atan2(-along.z, along.x);
      this.worldOf(this.model!, [CENTER.x - 0.92, 0.5, CENTER.z], this.orbit.pivot);
      Object.assign(this.orbit, { yaw, pitch: 1.25, dist: 3.3, fov: 44 });
      this.setLimits({ yawMin: yaw - 0.9, yawMax: yaw + 0.9, pitchMin: 0.85, pitchMax: 1.42, distMin: 2.2, distMax: 4.6 });
    }
    if (this.roof) this.roof.visible = false;

    const st = stations[1];
    const legend = h('div', { class: 'pilihan', 'aria-label': 'Empat jenis lauk' });
    for (const k of iwak) legend.append(h('span', { class: 'chip', title: k.desc }, `${k.label[0]} · ${k.label}`));
    this.status = h('p', { class: 'hud-petunjuk' });
    this.feedback = h('p', { class: 'hud-umpan' });
    const hint = chip('Petunjuk');
    const hintText = h('p', { class: 'hud-petunjuk', hidden: '' }, 'Lauk yang sama diletakkan berhadapan, menyilang di atas sepra. Dengan begitu setiap tamu bisa menjangkau keempat lauk.');
    hint.addEventListener('click', () => {
      hintText.hidden = !hintText.hidden;
      hint.setAttribute('aria-expanded', String(!hintText.hidden));
    });
    hint.setAttribute('aria-expanded', 'false');
    const reset = chip('Atur ulang');
    reset.addEventListener('click', () => this.reset());
    const tools = h('div', { class: 'pilihan' }, hint, reset);
    hud.setSheet(
      h('p', { class: 'hud-petunjuk' }, st.actionHint, ' Ketuk piring lalu ketuk tempatnya, atau seret langsung.'),
      legend,
      this.status,
      this.feedback,
      tools,
      hintText,
    );

    // anchors on the plates and the eight places around the sepra
    this.plates.forEach((p, i) => {
      const k = iwak.find((x) => x.id === p.kind)!;
      p.anchor = hud.addAnchor({
        label: `${k.label}, piring ${i % 2 ? 'kedua' : 'pertama'}`,
        text: k.label[0],
        onClick: () => this.tapPlate(p),
        onPointerDown: (e) => this.startDrag(p, e),
      });
    });
    for (let i = 0; i < 8; i++) {
      const a = hud.addAnchor({ label: `Tempat lauk ${i + 1}`, kind: 'slot', onClick: () => this.tapSlot(i) });
      this.slotAnchors.push(a);
    }
    window.addEventListener('pointermove', this.onDragMove);
    window.addEventListener('pointerup', this.onDragEnd);
    this.refresh();
    if (this.done && this.solved) hud.sheet.append(this.backBox('Idangan sudah tertata.'));
  }

  protected tick() {
    const m = this.model!;
    for (const p of this.plates) if (p.anchor) this.worldOf(m, [p.o.position.x, p.o.position.y + 0.07, p.o.position.z], p.anchor.world);
    this.slotAnchors.forEach((a, i) => {
      this.worldOf(m, slotPos(i), a.world);
      a.hide(!!this.slots[i] && this.picked === null);
    });
    this.guestLabels.forEach((a) => this.worldOf(m, (a as Anchor & { g: Vector3 }).g, a.world));
  }

  private tapPlate(p: Plate) {
    if (this.busy || this.drag?.moved || performance.now() - this.dragEnded < 300) return;
    sound.play('tok');
    this.picked = this.picked === p ? null : p;
    this.refresh();
  }

  private tapSlot(i: number) {
    if (this.busy || !this.picked) return;
    this.move(this.picked, i);
    this.picked = null;
    this.refresh();
  }

  private move(p: Plate, slot: number) {
    const occupant = this.slots[slot];
    if (occupant === p) return;
    const from = p.slot;
    if (from >= 0) this.slots[from] = null;
    if (occupant) {
      // swap: the plate already there goes where this one came from
      if (from >= 0) {
        this.slots[from] = occupant;
        occupant.slot = from;
        hop(occupant.o, slotPos(from));
      } else {
        occupant.slot = -1;
        hop(occupant.o, occupant.home);
      }
    }
    this.slots[slot] = p;
    p.slot = slot;
    hop(p.o, slotPos(slot));
    sound.play('pop');
    this.clearGuests();
    if (this.slots.every(Boolean)) setTimeout(() => this.check(), 750);
  }

  private startDrag(p: Plate, e: PointerEvent) {
    if (this.busy) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.drag = { plate: p, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  }

  private hit = new Vector3();
  private onDragMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 7) return;
    d.moved = true;
    const m = this.model!;
    const yWorld = this.worldOf(m, [0, PLATE_Y, CENTER.z]).y;
    if (!this.pickPlane(e.clientX, e.clientY, yWorld, this.hit)) return;
    m.worldToLocal(this.hit);
    gsap.killTweensOf(d.plate.o.position);
    d.plate.o.position.set(this.hit.x, PLATE_Y + 0.06, this.hit.z);
    this.picked = d.plate;
    this.refresh();
  };

  private onDragEnd = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    if (!d.moved) return; // the click handler deals with taps
    this.dragEnded = performance.now();
    const pos = d.plate.o.position;
    let best = -1;
    let bestD = 0.22;
    for (let i = 0; i < 8; i++) {
      const dd = Math.hypot(pos.x - slotPos(i).x, pos.z - slotPos(i).z);
      if (dd < bestD) {
        best = i;
        bestD = dd;
      }
    }
    if (best >= 0) this.move(d.plate, best);
    else hop(d.plate.o, d.plate.slot >= 0 ? slotPos(d.plate.slot) : d.plate.home, 0.05, 0.4);
    this.picked = null;
    this.refresh();
  };

  private refresh() {
    const placed = this.slots.filter(Boolean).length;
    this.status.textContent = `${placed} dari 8 piring sudah di atas sepra.`;
    for (const p of this.plates) p.anchor?.set('is-pilih', this.picked === p);
    this.slotAnchors.forEach((a, i) => a.set('is-target', !!this.picked && this.slots[i] !== this.picked));
  }

  private check() {
    if (!this.slots.every(Boolean)) return;
    const bad: { g: number; missing: string[] }[] = [];
    for (let g = 0; g < 8; g++) {
      const kinds = new Set(reach(g).map((i) => this.slots[i]!.kind));
      if (kinds.size < 4) bad.push({ g, missing: iwak.filter((k) => !kinds.has(k.id)).map((k) => k.label.toLowerCase()) });
    }
    this.clearGuests();
    if (bad.length) {
      sound.play('wrong');
      for (const b of bad) {
        const a = hud.addAnchor({ label: 'Tamu harus melintas', kind: 'label', text: `Melintas untuk ${b.missing[0]}`, cls: 'is-pamali' });
        (a as Anchor & { g: Vector3 }).g = guestPos(b.g);
        this.guestLabels.push(a);
      }
      this.feedback.classList.remove('is-baik');
      this.feedback.textContent = `${bad.length} dari 8 tamu harus menjulurkan tangan melewati tamu lain untuk mengambil lauk, dan itu pamali. Tukar posisi piringnya, lalu coba lagi.`;
      return;
    }
    this.solved = true;
    for (let g = 0; g < 8; g++) {
      const a = hud.addAnchor({ label: 'Tamu bisa mengambil semua lauk', kind: 'label', text: 'Lengkap', cls: 'is-ok' });
      (a as Anchor & { g: Vector3 }).g = guestPos(g);
      this.guestLabels.push(a);
    }
    this.feedback.textContent = '';
    this.pour();
    this.plates.forEach((p, i) => {
      gsap.to(p.o.position, { y: PLATE_Y + 0.05, duration: 0.18, delay: i * 0.06, yoyo: true, repeat: 1, ease: 'power1.out' });
    });
    hud.sheet.append(
      this.complete('Setiap tamu bisa mengambil keempat lauk tanpa tangannya melintas. Yang paling tua dipersilakan mengambil lebih dulu, lalu makan bersama dimulai.'),
    );
  }

  private pour() {
    const ceret = this.model?.getObjectByName('ceret');
    if (!ceret) return;
    sound.play('pour');
    gsap.to(ceret.rotation, { x: 0.55, duration: 0.6, ease: 'power2.out', yoyo: true, repeat: 1, repeatDelay: 0.8 });
  }

  private clearGuests() {
    for (const a of this.guestLabels) hud.removeAnchor(a);
    this.guestLabels = [];
  }

  private reset() {
    sound.play('tok');
    this.slots.fill(null);
    for (const p of this.plates) {
      p.slot = -1;
      hop(p.o, p.home, 0.1, 0.5);
    }
    this.picked = null;
    this.solved = false;
    this.clearGuests();
    this.feedback.textContent = '';
    this.refresh();
  }

  protected teardown() {
    window.removeEventListener('pointermove', this.onDragMove);
    window.removeEventListener('pointerup', this.onDragEnd);
    if (this.roof) this.roof.visible = true;
    this.slotAnchors = [];
    this.guestLabels = [];
    this.picked = null;
    for (const p of this.plates) p.anchor = undefined;
  }
}
