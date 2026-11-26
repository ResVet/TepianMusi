// Dermaga III: walk around Kampung Al-Munawar and Kampung Kapitan, then
// cook pempek kapal selam on the table in Kapitan's yard, from fish to cuko.
import { gsap } from 'gsap';
import { Vector3, type MeshStandardMaterial, type Object3D } from 'three';
import { dapur, stations } from '../../../data/stations';
import { hud, h, type Anchor } from '../../ui/hud';
import { sound } from '../../ui/sound';
import { meshesOf } from '../assets';
import type { World } from '../index';
import { Interaction, chip, grow, hop } from './base';

type Tab = 'munawar' | 'kapitan' | 'dapur';

const FEATURES: Record<'munawar' | 'kapitan', { at: [number, number, number]; label: string; text: string }[]> = {
  munawar: [
    { at: [0, 5.2, 4.8], label: 'Rumah Tinggi', text: 'Rumah Tinggi: rumah panggung kayu beratap limas, salah satu bentuk rumah lama di kampung ini.' },
    { at: [0, 9.7, 0], label: 'Simbar', text: 'Simbar, hiasan di ujung bubungan rumah limas.' },
    { at: [10.5, 6.8, 4.5], label: 'Jendela krepyak', text: 'Lantai atas rumah sebelah berjendela krepyak, yaitu daun jendela dari bilah-bilah kayu.' },
    { at: [12.5, 2.4, 4.9], label: 'Lantai tembok', text: 'Lantai bawahnya berdinding tembok dengan pintu-pintu tinggi. Dalam satu kampung ada beberapa bentuk rumah.' },
  ],
  kapitan: [
    { at: [0, 5.2, 5.2], label: 'Rumah Kapitan', text: 'Rumah Kapitan memadukan gaya lokal, Tionghoa, dan kolonial dalam satu bangunan.' },
    { at: [7.65, 3.9, 3.7], label: 'Jendela tinggi', text: 'Jendela tinggi berkrepyak dan dinding tembok bergaya kolonial.' },
    { at: [19, 3.6, 2.8], label: 'Lampion', text: 'Pada model ini, lampion merah tergantung di serambi rumah bergaya Tionghoa.' },
    { at: [19, 7.4, -2], label: 'Bubungan melengkung', text: 'Bubungan melengkung dengan ujung meruncing, ciri rumah Tionghoa.' },
  ],
};

export class Kampung extends Interaction {
  readonly index = 2;
  readonly title = stations[2].title;
  private tab: Tab = 'munawar';
  private visited = new Set<Tab>();
  private tabs = new Map<Tab, HTMLButtonElement>();
  private body!: HTMLElement;
  private anchors: Anchor[] = [];
  // kitchen
  private p: Record<string, Object3D> = {};
  private homes = new Map<Object3D, Vector3>();
  private step = 0;
  private cooked = false;
  private drag: { o: Object3D; id: number; x: number; y: number; moved: boolean } | null = null;
  private dragEnded = 0;
  private target: Object3D | null = null;
  private hold = 0;
  private holding = false;
  private bar: HTMLElement | null = null;

  constructor(world: World) {
    super(world, `Dermaga III · ${stations[2].silaShort}`);
  }

  private findKitchen() {
    if (Object.keys(this.p).length) return;
    const root = this.world.stations.pempek!;
    const names = ['baskom', 'isi_ikan', 'isi_sagu', 'adonan', 'talenan', 'ikan', 'mangkuk_sagu', 'sagu_tumpuk', 'mangkuk_telur',
      'telur0', 'telur1', 'telur2', 'piring_mentah', 'kapal_selam_mentah', 'wajan', 'minyak', 'kapal_selam_goreng', 'piring_saji',
      'potongan_pempek', 'kuning_potongan', 'mangkuk_cuko', 'cuko', 'timun_cuko'];
    for (const n of names) {
      const o = root.getObjectByName(n);
      if (o) {
        this.p[n] = o;
        this.homes.set(o, o.position.clone());
      }
    }
  }

  /** Put the table back to "nothing cooked yet", or to the served dish. */
  private setKitchen(served: boolean) {
    const P = this.p;
    for (const [o, home] of this.homes) {
      gsap.killTweensOf(o.position);
      gsap.killTweensOf(o.rotation);
      gsap.killTweensOf(o.scale);
      o.position.copy(home);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      o.visible = true;
    }
    const hideAlways = ['isi_ikan', 'isi_sagu', 'adonan', 'kapal_selam_mentah', 'kapal_selam_goreng'];
    const hideUntilServed = ['potongan_pempek', 'kuning_potongan', 'cuko', 'timun_cuko'];
    for (const n of hideAlways) if (P[n]) P[n].visible = false;
    for (const n of hideUntilServed) if (P[n]) P[n].visible = served;
    if (served) {
      for (const n of ['ikan', 'sagu_tumpuk', 'telur0', 'telur1', 'telur2']) if (P[n]) P[n].visible = false;
    }
    this.step = served ? 6 : 0;
    this.cooked = served;
  }

  protected setup() {
    this.findKitchen();
    if (!this.cooked) this.setKitchen(this.done);
    Object.assign(this.orbit, { fov: 40 });
    const row = h('div', { class: 'pilihan', role: 'tablist', 'aria-label': 'Bagian dermaga' });
    const tabs: [Tab, string][] = [['munawar', 'Kampung Al-Munawar'], ['kapitan', 'Kampung Kapitan'], ['dapur', 'Dapur pempek']];
    for (const [id, label] of tabs) {
      const b = chip(label) as HTMLButtonElement;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => this.show(id));
      this.tabs.set(id, b);
      row.append(b);
    }
    this.body = h('div');
    hud.setSheet(row, this.body);
    window.addEventListener('pointermove', this.onDragMove);
    window.addEventListener('pointerup', this.onDragEnd);
    this.show(this.tab, true);
  }

  private clear() {
    for (const a of this.anchors) hud.removeAnchor(a);
    this.anchors = [];
    this.target = null;
  }

  private show(tab: Tab, instant = false) {
    if (!instant) sound.play('tok');
    this.tab = tab;
    this.visited.add(tab);
    for (const [id, b] of this.tabs) {
      b.setAttribute('aria-selected', String(id === tab));
      b.setAttribute('aria-pressed', String(id === tab));
      b.classList.toggle('is-selesai', this.visited.has(id) && id !== 'dapur' ? true : id === 'dapur' && this.cooked);
    }
    this.clear();
    if (tab === 'dapur') return this.showKitchen(instant);
    const model = tab === 'munawar' ? this.world.stations.munawar! : this.world.stations.kapitan!;
    model.updateMatrixWorld(true);
    const pivot = this.worldOf(model, [8, 4.2, 0]);
    this.setLimits({ yawMin: -1.1, yawMax: 1.1, pitchMin: 0.05, pitchMax: 0.9, distMin: 18, distMax: 70 });
    if (instant) {
      this.orbit.pivot.copy(pivot);
      Object.assign(this.orbit, { yaw: 0.35, pitch: 0.2, dist: 44 });
    }
    this.focusOn(pivot, 44, 0.35, 0.2);
    const text = h('p', { class: 'hud-umpan' }, tab === 'munawar'
      ? 'Kampung Al-Munawar di 13 Ulu dihuni keturunan Arab. Ketuk titik pada bangunan untuk melihat cirinya.'
      : 'Kampung Kapitan di 7 Ulu menjadi permukiman warga Tionghoa. Ketuk titik pada bangunan untuk melihat cirinya.');
    const note = tab === 'kapitan' ? h('p', { class: 'hud-petunjuk' }, 'Di sini warga mengenal ungkapan wong Cino wong kito: orang Tionghoa juga orang kita.') : null;
    this.body.replaceChildren(text, ...(note ? [note] : []), this.progressLine());
    FEATURES[tab].forEach((f, i) => {
      const a = hud.addAnchor({
        label: f.label,
        text: String(i + 1),
        onClick: () => {
          sound.play('pop');
          text.textContent = f.text;
          this.focusOn(this.worldOf(model, f.at), 26);
        },
      });
      this.worldOf(model, f.at, a.world);
      this.anchors.push(a);
    });
    this.maybeFinish();
  }

  private progressLine() {
    const k = ['munawar', 'kapitan'].filter((t) => this.visited.has(t as Tab)).length;
    return h('p', { class: 'hud-petunjuk' }, `Kampung dikunjungi: ${k} dari 2. Pempek: ${this.cooked ? 'sudah matang' : 'belum dimasak'}.`);
  }

  // ----------------------------------------------------------- dapur ----
  private showKitchen(instant: boolean) {
    const root = this.world.stations.pempek!;
    root.updateMatrixWorld(true);
    const pivot = this.worldOf(root, [0, 0.86, 0]);
    this.setLimits({ yawMin: -0.9, yawMax: 0.9, pitchMin: 0.35, pitchMax: 1.2, distMin: 0.9, distMax: 2.6 });
    if (instant) {
      this.orbit.pivot.copy(pivot);
      Object.assign(this.orbit, { yaw: 0.12, pitch: 0.6, dist: 1.75 });
    }
    // low enough that Kapitan's veranda shows behind the table
    this.focusOn(pivot, 1.75, 0.12, 0.6);
    this.renderStep();
  }

  private renderStep() {
    this.clear();
    const bar = h('div', { class: 'langkah', 'aria-hidden': 'true' });
    for (let i = 0; i < dapur.length; i++) bar.append(h('i', { class: i < this.step ? 'is-selesai' : '' }));
    if (this.step >= dapur.length) {
      this.body.replaceChildren(
        bar,
        h('p', { class: 'hud-umpan is-baik' }, 'Pempek kapal selam siap disantap dengan cuko dan timun.'),
        this.progressLine(),
      );
      this.maybeFinish();
      return;
    }
    const s = dapur[this.step];
    const act = h('button', { class: 'tombol tombol--emas', type: 'button' }, this.buttonLabel());
    act.addEventListener('click', () => this.perform());
    const parts: (Node | string)[] = [bar, h('p', { class: 'hud-umpan' }, h('b', {}, `${this.step + 1}. ${s.label}. `), s.text)];
    if (s.id === 'uleni') {
      this.bar = h('span', { class: 'karcis-muat', style: 'position:static;display:block;margin:0.6rem 0 0.8rem' }, h('i', {}));
      act.textContent = 'Tahan untuk menguleni';
      act.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.holding = true;
      });
      act.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.kneadBy(0.25);
        }
      });
      const stop = () => (this.holding = false);
      act.addEventListener('pointerup', stop);
      act.addEventListener('pointerleave', stop);
      parts.push(this.bar);
    } else {
      parts.push(h('p', { class: 'hud-petunjuk' }, 'Seret benda yang bertanda ke tujuannya, atau pakai tombol di bawah.'));
    }
    parts.push(act);
    this.body.replaceChildren(...parts);
    this.setupStepAnchors();
  }

  private buttonLabel() {
    return ['Masukkan ikan', 'Tuang sagu', 'Uleni', 'Isi dengan telur', 'Goreng', 'Siram cuko'][this.step] ?? 'Lanjut';
  }

  private setupStepAnchors() {
    const P = this.p;
    const s = dapur[this.step];
    const item: Record<string, string | null> = { ikan: 'ikan', sagu: 'mangkuk_sagu', uleni: null, telur: 'mangkuk_telur', goreng: 'kapal_selam_mentah', cuko: 'mangkuk_cuko' };
    const goal: Record<string, string> = { ikan: 'baskom', sagu: 'baskom', uleni: 'baskom', telur: 'baskom', goreng: 'wajan', cuko: 'piring_saji' };
    const it = item[s.id] ? P[item[s.id]!] : null;
    const gl = P[goal[s.id]];
    this.target = gl;
    if (gl) {
      const a = hud.addAnchor({ label: `Tujuan: ${gl.name.replace(/_/g, ' ')}`, kind: 'slot', cls: 'is-target', onClick: () => this.perform() });
      (a as Anchor & { follow: Object3D; dy: number }).follow = gl;
      (a as Anchor & { follow: Object3D; dy: number }).dy = 0.08;
      this.anchors.push(a);
    }
    if (it) {
      const a = hud.addAnchor({
        label: `Seret ${it.name.replace(/_/g, ' ')}`,
        text: String(this.step + 1),
        cls: 'is-pilih',
        onPointerDown: (e) => {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          this.drag = { o: it, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
        },
        onClick: () => {
          if (!this.drag?.moved && performance.now() - this.dragEnded > 300) this.perform();
        },
      });
      (a as Anchor & { follow: Object3D; dy: number }).follow = it;
      (a as Anchor & { follow: Object3D; dy: number }).dy = 0.09;
      this.anchors.push(a);
    }
  }

  private hit = new Vector3();
  private onDragMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 7) return;
    d.moved = true;
    const root = this.world.stations.pempek!;
    const y = this.worldOf(root, [0, 0.92, 0]).y;
    if (!this.pickPlane(e.clientX, e.clientY, y, this.hit)) return;
    root.worldToLocal(this.hit);
    d.o.position.set(this.hit.x, 0.92, this.hit.z);
  };

  private onDragEnd = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    if (!d.moved) return;
    this.dragEnded = performance.now();
    const t = this.target;
    if (t && Math.hypot(d.o.position.x - t.position.x, d.o.position.z - t.position.z) < 0.2) this.perform(true);
    else hop(d.o, this.homes.get(d.o)!, 0.05, 0.4);
  };

  private kneadBy(k: number) {
    if (this.step !== 2) return;
    this.hold = Math.min(1, this.hold + k);
    sound.play('knead');
    this.applyKnead();
  }

  private applyKnead() {
    const P = this.p;
    const k = this.hold;
    if (P.adonan) {
      P.adonan.visible = k > 0.02;
      P.adonan.scale.setScalar(Math.max(0.001, k));
    }
    if (P.isi_ikan) P.isi_ikan.scale.setScalar(Math.max(0.001, 1 - k));
    if (P.isi_sagu) P.isi_sagu.scale.setScalar(Math.max(0.001, 1 - k));
    if (P.baskom) P.baskom.rotation.y = Math.sin(k * 30) * 0.05;
    if (this.bar) (this.bar.firstElementChild as HTMLElement).style.transform = `scaleX(${k})`;
    if (k >= 1) {
      this.holding = false;
      if (P.isi_ikan) P.isi_ikan.visible = false;
      if (P.isi_sagu) P.isi_sagu.visible = false;
      if (P.baskom) P.baskom.rotation.y = 0;
      this.next();
    }
  }

  protected tick(dt: number) {
    for (const a of this.anchors) {
      const f = (a as Anchor & { follow?: Object3D; dy?: number }).follow;
      if (f) {
        f.getWorldPosition(a.world);
        a.world.y += (a as Anchor & { dy: number }).dy ?? 0;
      }
    }
    if (this.holding && this.step === 2) {
      this.hold = Math.min(1, this.hold + dt / 1.8);
      if (Math.random() < dt * 4) sound.play('knead');
      this.applyKnead();
    }
  }

  private perform(fromDrag = false) {
    if (this.busy || this.step >= dapur.length) return;
    const P = this.p;
    const id = dapur[this.step].id;
    const basin = new Vector3(0, 0.95, 0);
    this.busy = true;
    const finish = () => {
      this.busy = false;
      this.next();
    };
    switch (id) {
      case 'ikan': {
        sound.play('pop');
        hop(P.ikan, basin, 0.12, fromDrag ? 0.35 : 0.7).then(() => {
          grow(P.ikan, false, 0.35);
          grow(P.isi_ikan, true, 0.6).then(finish);
        });
        break;
      }
      case 'sagu': {
        const bowl = P.mangkuk_sagu;
        hop(bowl, new Vector3(-0.16, 1.02, 0), 0.1, fromDrag ? 0.3 : 0.6).then(() => {
          sound.play('pour');
          gsap.to(bowl.rotation, { z: -1.2, duration: 0.45, ease: 'power2.out' });
          grow(P.sagu_tumpuk, false, 0.5);
          grow(P.isi_sagu, true, 0.7).then(() => {
            gsap.to(bowl.rotation, { z: 0, duration: 0.35 });
            hop(bowl, this.homes.get(bowl)!, 0.08, 0.5).then(finish);
          });
        });
        break;
      }
      case 'uleni':
        this.busy = false;
        this.kneadBy(0.25);
        return;
      case 'telur': {
        const bowl = P.mangkuk_telur;
        hop(bowl, new Vector3(0.05, 1.02, -0.12), 0.1, fromDrag ? 0.3 : 0.6).then(() => {
          sound.play('pop');
          ['telur0', 'telur1', 'telur2'].forEach((n, i) => setTimeout(() => P[n] && grow(P[n], false, 0.25), 150 + i * 220));
          setTimeout(() => {
            grow(P.adonan, false, 0.5);
            hop(bowl, this.homes.get(bowl)!, 0.08, 0.5);
            grow(P.kapal_selam_mentah, true, 0.7).then(finish);
          }, 900);
        });
        break;
      }
      case 'goreng': {
        const raw = P.kapal_selam_mentah;
        const wok = this.p.wajan;
        hop(raw, new Vector3(wok.position.x, 1.02, wok.position.z), 0.14, fromDrag ? 0.3 : 0.6).then(() => {
          grow(raw, false, 0.2);
          sound.play('sizzle');
          this.fry();
          grow(P.kapal_selam_goreng, true, 0.5);
          setTimeout(finish, 1900);
        });
        break;
      }
      case 'cuko': {
        sound.play('pour');
        grow(P.kapal_selam_goreng, false, 0.4);
        setTimeout(() => grow(P.potongan_pempek, true, 0.5), 300);
        setTimeout(() => grow(P.kuning_potongan, true, 0.5), 450);
        setTimeout(() => grow(P.cuko, true, 0.7), 500);
        setTimeout(() => grow(P.timun_cuko, true, 0.5).then(finish), 900);
        break;
      }
    }
  }

  /** Oil shimmer and the dough browning while it fries. */
  private fry() {
    const oil = this.p.minyak ? (meshesOf(this.p.minyak)[0].material as MeshStandardMaterial) : null;
    if (oil) {
      const st = { k: 0 };
      gsap.to(st, {
        k: 1,
        duration: 1.8,
        onUpdate: () => {
          oil.emissive.set('#ffb35c');
          oil.emissiveIntensity = Math.sin(st.k * Math.PI) * (0.6 + Math.random() * 0.4);
        },
        onComplete: () => {
          oil.emissiveIntensity = 0;
        },
      });
    }
    const fried = this.p.kapal_selam_goreng;
    if (fried) gsap.fromTo(fried.position, { y: fried.position.y - 0.01 }, { y: fried.position.y, duration: 0.15, repeat: 10, yoyo: true });
  }

  private next() {
    this.step++;
    sound.play('tok');
    if (this.step >= dapur.length) this.cooked = true;
    this.hold = 0;
    if (this.tab === 'dapur') this.renderStep();
  }

  private maybeFinish() {
    if (!(this.visited.has('munawar') && this.visited.has('kapitan') && this.cooked)) return;
    if (hud.sheet.querySelector('.selesai')) return;
    const msg = 'Kedua kampung tetap punya ciri sendiri, dan pempek lahir dari pertemuan keduanya.';
    hud.sheet.append(this.done ? this.backBox(msg) : this.complete(msg));
  }

  protected teardown() {
    window.removeEventListener('pointermove', this.onDragMove);
    window.removeEventListener('pointerup', this.onDragEnd);
    this.holding = false;
    this.drag = null;
    this.anchors = [];
    this.tabs.clear();
    if (!this.cooked) {
      this.step = 0;
      this.hold = 0;
    }
  }
}
