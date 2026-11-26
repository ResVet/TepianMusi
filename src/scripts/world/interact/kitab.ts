// Dermaga IV: open the Simbur Cahaya on the low table, settle a boundary
// dispute between two families, then leaf through the kitab's five bab.
import { gsap } from 'gsap';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DynamicDrawUsage,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
  type Box3,
  type Object3D,
  type Texture,
} from 'three';
import { sengketa, stations } from '../../../data/stations';
import { hud, h, type Anchor } from '../../ui/hud';
import { sound } from '../../ui/sound';
import type { World } from '../index';
import { ensurePlanarUV } from '../stations';
import { Interaction } from './base';

const THICK = 0.054;

function pageCanvas(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 692;
  const g = c.getContext('2d')!;
  // aged paper
  g.fillStyle = '#e6d8b8';
  g.fillRect(0, 0, c.width, c.height);
  const grad = g.createRadialGradient(256, 346, 120, 256, 346, 470);
  grad.addColorStop(0, 'rgba(255,248,230,0.35)');
  grad.addColorStop(1, 'rgba(120,85,40,0.32)');
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(110,80,40,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 512, Math.random() * 692, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  g.fillStyle = '#3a2716';
  g.textAlign = 'center';
  draw(g, c.width, c.height);
  return c;
}

function scribble(g: CanvasRenderingContext2D, y0: number, y1: number, seed: number) {
  // illegible manuscript lines as page texture
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  g.strokeStyle = 'rgba(58,39,22,0.55)';
  g.lineWidth = 2.2;
  for (let y = y0; y < y1; y += 26) {
    let x = 58;
    const end = 454 - r() * 60;
    g.beginPath();
    g.moveTo(x, y);
    while (x < end) {
      const w = 14 + r() * 40;
      for (let k = 0; k < w; k += 4) g.lineTo(x + k, y + Math.sin((x + k) * 0.9 + r()) * 2.4);
      x += w + 8 + r() * 6;
      g.moveTo(x, y);
    }
    g.stroke();
  }
}

const SEG = 28;

/**
 * One sheet that bends while it turns over the spine. Its front shows the
 * right page being turned and its back the next left page. Both faces use
 * front-side materials (the back has reversed winding and normals), so they
 * share the shader the static pages already compiled.
 */
class TurningPage {
  readonly group = new Group();
  readonly front = new MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  readonly back = new MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  private pos = new BufferAttribute(new Float32Array((SEG + 1) * 6), 3);
  private nf = new BufferAttribute(new Float32Array((SEG + 1) * 6), 3);
  private nb = new BufferAttribute(new Float32Array((SEG + 1) * 6), 3);
  private x0: number;
  private w: number;
  private h: number;
  private zNear: number;
  private zFar: number;

  /** `gltfUV`: the page textures follow the glTF layout (v = 0 on the far edge). */
  constructor(box: Box3, gltfUV: boolean) {
    this.x0 = box.min.x;
    this.w = box.max.x - box.min.x;
    this.h = box.max.y + 0.0012;
    this.zNear = box.max.z;
    this.zFar = box.min.z;
    for (const a of [this.pos, this.nf, this.nb]) a.setUsage(DynamicDrawUsage);
    const up: number[] = [];
    const down: number[] = [];
    for (let i = 0; i < SEG; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      up.push(a, c, b, c, d, b);
      down.push(a, b, c, c, b, d);
    }
    const geo = (isBack: boolean) => {
      const g = new BufferGeometry();
      const uv = new Float32Array((SEG + 1) * 4);
      // same layout as the static pages, so the same textures fit
      const near = gltfUV ? 1 : 0;
      for (let i = 0; i <= SEG; i++) {
        const u = isBack ? 1 - i / SEG : i / SEG;
        uv.set([u, near, u, 1 - near], i * 4);
      }
      g.setAttribute('position', this.pos);
      g.setAttribute('normal', isBack ? this.nb : this.nf);
      g.setAttribute('uv', new BufferAttribute(uv, 2));
      g.setIndex(isBack ? down : up);
      return g;
    };
    for (const [g, m] of [
      [geo(false), this.front],
      [geo(true), this.back],
    ] as const) {
      const mesh = new Mesh(g, m);
      mesh.layers.set(1);
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    this.group.visible = false;
    this.set(0);
  }

  /** 0 = lying on the right, 1 = lying on the left. */
  set(a: number) {
    const base = Math.PI * a;
    // the free edge leads while the page lifts and trails as it falls
    const curl = 0.85 * Math.sin(2 * Math.PI * a);
    const len = this.x0 + this.w;
    const phi = (s: number) => MathUtils.clamp(base + curl * Math.pow(s / len, 1.6), 0, Math.PI);
    const p = this.pos.array as Float32Array;
    const nf = this.nf.array as Float32Array;
    const nb = this.nb.array as Float32Array;
    const ds = this.w / SEG;
    const f0 = phi(this.x0 * 0.5);
    let x = Math.cos(f0) * this.x0;
    let y = Math.sin(f0) * this.x0;
    for (let i = 0; i <= SEG; i++) {
      const s = this.x0 + i * ds;
      const f = phi(s);
      const nx = -Math.sin(f);
      const ny = Math.cos(f);
      const k = i * 6;
      p[k] = p[k + 3] = x;
      p[k + 1] = p[k + 4] = this.h + y;
      p[k + 2] = this.zNear;
      p[k + 5] = this.zFar;
      nf[k] = nf[k + 3] = nx;
      nf[k + 1] = nf[k + 4] = ny;
      nf[k + 2] = nf[k + 5] = 0;
      nb[k] = nb[k + 3] = -nx;
      nb[k + 1] = nb[k + 4] = -ny;
      nb[k + 2] = nb[k + 5] = 0;
      if (i < SEG) {
        const m = phi(s + ds * 0.5);
        x += Math.cos(m) * ds;
        y += Math.sin(m) * ds;
      }
    }
    this.pos.needsUpdate = true;
    this.nf.needsUpdate = true;
    this.nb.needsUpdate = true;
  }
}

export class Kitab extends Interaction {
  readonly index = 3;
  readonly title = stations[3].title;
  private parts: Record<string, Object3D> = {};
  private isOpen = false;
  private pageL!: MeshStandardMaterial;
  private pageR!: MeshStandardMaterial;
  private sheet: TurningPage | null = null;
  private turn: gsap.core.Tween | null = null;
  private body!: HTMLElement;
  private bookAnchor: Anchor | null = null;
  private bab = -1;
  private settled = false;
  private gltfUV = true;

  constructor(world: World) {
    super(world, `Dermaga IV · ${stations[3].silaShort}`);
  }

  private find() {
    if (this.parts.kitab_kiri) return;
    const g = this.world.stations.groups[3];
    for (const n of ['kitab_kiri', 'kitab_kanan', 'kitab_halaman_kiri', 'kitab_halaman_kanan', 'api_pelita', 'lentera_gantung', 'balai_atap', 'balai_bubungan', 'balai_simbar']) {
      const o = g.getObjectByName(n);
      if (o) this.parts[n] = o;
    }
    // Pages keep the UVs from Blender (glTF convention, v = 0 at the top of
    // the image). If an export ever loses them, lay out planar ones the
    // other way round: u across (+X), text top away from the reader (-Z).
    for (const n of ['kitab_halaman_kiri', 'kitab_halaman_kanan']) {
      const m = this.parts[n] as Mesh | undefined;
      if (m && !m.geometry.attributes.uv) {
        ensurePlanarUV(m, 'x', 'z', true);
        this.gltfUV = false;
      }
    }
    const mk = () => new MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
    this.pageL = mk();
    this.pageR = mk();
    (this.parts.kitab_halaman_kiri as Mesh).material = this.pageL;
    (this.parts.kitab_halaman_kanan as Mesh).material = this.pageR;
    this.drawSpread(-1);
  }

  private tex(c: HTMLCanvasElement) {
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    t.flipY = !this.gltfUV;
    return t;
  }

  /** Left page of a spread: -1 = title, 0..4 = bab. */
  private leftCanvas(k: number) {
    if (k < 0) {
      return pageCanvas((g) => {
        g.font = '600 30px "Newsreader Variable", Georgia, serif';
        g.fillText('UNDANG-UNDANG', 256, 250);
        g.font = '600 52px "Newsreader Variable", Georgia, serif';
        g.fillText('Simbur Cahaya', 256, 318);
        g.font = 'italic 24px "Newsreader Variable", Georgia, serif';
        g.fillText('percikan sinar', 256, 372);
        g.fillRect(186, 410, 140, 2);
        g.font = '22px "Newsreader Variable", Georgia, serif';
        g.fillText('lima bab', 256, 452);
      });
    }
    const [name, count] = sengketa.bab[k];
    const roman = ['I', 'II', 'III', 'IV', 'V'][k];
    return pageCanvas((g) => {
      g.font = '600 34px "Newsreader Variable", Georgia, serif';
      g.fillText(`Bab ${roman}`, 256, 150);
      g.font = '600 38px "Newsreader Variable", Georgia, serif';
      const words = name.split(' ');
      let line = '';
      let y = 230;
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (g.measureText(test).width > 380) {
          g.fillText(line, 256, y);
          line = w;
          y += 48;
        } else line = test;
      }
      g.fillText(line, 256, y);
      g.font = 'italic 26px "Newsreader Variable", Georgia, serif';
      g.fillText(count, 256, y + 60);
      scribble(g, y + 130, 640, 11 + k);
    });
  }

  private rightCanvas(k: number) {
    return k < 0 ? pageCanvas((g) => scribble(g, 90, 620, 7)) : pageCanvas((g) => scribble(g, 80, 630, 23 + k));
  }

  /** Swap a page's texture. Pass keep = true when another mesh still shows the old one. */
  private setPage(m: MeshStandardMaterial, t: Texture, keep = false) {
    const old = m.map;
    m.map = t;
    if (!old) m.needsUpdate = true;
    else if (!keep) old.dispose();
  }

  private drawSpread(k: number) {
    this.setPage(this.pageL, this.tex(this.leftCanvas(k)));
    this.setPage(this.pageR, this.tex(this.rightCanvas(k)));
  }

  private setClosed(closed: boolean, animate: boolean) {
    const L = this.parts.kitab_kiri;
    const PL = this.parts.kitab_halaman_kiri;
    const base = this.parts.kitab_kanan.position.y;
    const to = { rz: closed ? -Math.PI : 0, y: closed ? base + THICK : base };
    for (const o of [L, PL]) {
      gsap.killTweensOf(o.rotation);
      gsap.killTweensOf(o.position);
      if (animate) {
        gsap.to(o.rotation, { z: to.rz, duration: 1.2, ease: 'power3.inOut' });
        gsap.to(o.position, { y: to.y, duration: 1.2, ease: 'power3.inOut' });
      } else {
        o.rotation.z = to.rz;
        o.position.y = to.y;
      }
    }
    this.isOpen = !closed;
  }

  protected setup() {
    this.find();
    const g = this.world.stations.groups[3];
    g.updateMatrixWorld(true);
    const book = this.parts.kitab_kanan;
    this.worldOf(g, [0, book.position.y + 0.02, book.position.z], this.orbit.pivot);
    Object.assign(this.orbit, { yaw: 0.02, pitch: 0.78, dist: 1.05, fov: 40 });
    this.setLimits({ yawMin: -1.0, yawMax: 1.0, pitchMin: 0.35, pitchMax: 1.3, distMin: 0.6, distMax: 3.2 });
    for (const n of ['balai_atap', 'balai_bubungan', 'balai_simbar']) if (this.parts[n]) this.parts[n].visible = false;

    // warm light from the pelita onto the pages (a light that always exists,
    // so switching it on does not recompile every material)
    const flame = this.parts.api_pelita;
    if (flame) {
      flame.updateWorldMatrix(true, false);
      flame.getWorldPosition(this.world.accent.position).add(new Vector3(0, 0.1, 0));
      this.world.accent.color.set('#ffb064');
      this.world.accent.distance = 3.5;
      gsap.to(this.world.accent, { intensity: 0.9, duration: 1.2 });
    }
    if (!this.settled) {
      this.setClosed(true, false);
      this.bab = -1;
      this.drawSpread(-1);
    }
    this.body = h('div');
    hud.setSheet(h('p', { class: 'hud-petunjuk' }, stations[3].actionHint), this.body);
    if (this.settled) this.showBab();
    else this.showClosed();
  }

  protected tick(_dt: number, t: number) {
    const a = this.world.accent;
    if (!gsap.isTweening(a)) a.intensity = (this.settled ? 1.15 : 0.85) + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.1) * 0.07;
    if (this.bookAnchor) {
      this.parts.kitab_kanan.getWorldPosition(this.bookAnchor.world);
      this.bookAnchor.world.y += 0.08;
    }
  }

  private showClosed() {
    const b = h('button', { class: 'tombol tombol--emas', type: 'button' }, 'Buka kitab');
    b.addEventListener('click', () => this.openBook());
    this.body.replaceChildren(h('p', { class: 'hud-umpan' }, 'Kitab Simbur Cahaya tergeletak di meja balai, di samping pelita.'), b);
    this.bookAnchor = hud.addAnchor({ label: 'Buka kitab', text: 'Buka', cls: 'is-pilih', onClick: () => this.openBook() });
    this.bookAnchor.el.style.width = 'auto';
    this.bookAnchor.el.style.padding = '0 0.8rem';
  }

  private openBook() {
    if (this.isOpen) return;
    sound.play('page');
    this.setClosed(false, true);
    if (this.bookAnchor) hud.removeAnchor(this.bookAnchor);
    this.bookAnchor = null;
    this.showDispute();
  }

  private showDispute() {
    const list = h('div', { class: 'pilihan pilihan--kolom', role: 'group', 'aria-label': 'Cara menyelesaikan sengketa' });
    const result = h('p', { class: 'hud-umpan' });
    for (const c of sengketa.choices) {
      const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false' }, c.label);
      b.addEventListener('click', () => {
        for (const x of list.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
        result.textContent = c.result;
        result.classList.toggle('is-baik', c.good);
        if (c.good) this.settle();
        else sound.play('wrong');
      });
      list.append(b);
    }
    this.body.replaceChildren(h('p', { class: 'hud-umpan' }, sengketa.intro), list, result);
  }

  private settle() {
    if (this.settled) return;
    this.settled = true;
    gsap.to(this.world.accent, { distance: 5, duration: 1 });
    const msg = 'Keputusan diambil bersama setelah kedua keluarga didengar. Cara seperti ini yang diminta sila keempat.';
    const after = h('div');
    this.body.append(this.done ? this.backBox(msg) : this.complete(msg), after);
    this.bab = -1;
    this.babTools(after);
  }

  private showBab() {
    const after = h('div');
    this.body.replaceChildren(h('p', { class: 'hud-umpan is-baik' }, 'Sengketa sudah selesai lewat musyawarah.'), this.backBox('Kitab masih terbuka di meja balai.'), after);
    this.babTools(after);
  }

  private babTools(host: HTMLElement) {
    const btn = h('button', { class: 'tombol tombol--hantu', type: 'button' }, 'Balik halaman');
    const where = h('p', { class: 'hud-petunjuk' }, 'Kitab ini terdiri atas lima bab. Balik halamannya untuk melihat isinya.');
    const ol = h('ol', { class: 'hud-petunjuk' });
    sengketa.bab.forEach(([n, c], i) => {
      const li = h('li', {}, `${n} (${c})`);
      li.dataset.i = String(i);
      ol.append(li);
    });
    btn.addEventListener('click', () => {
      if (this.turn) return;
      const k = (this.bab + 1) % sengketa.bab.length;
      this.turnPage(k);
      where.textContent = `Bab ${['I', 'II', 'III', 'IV', 'V'][k]}: ${sengketa.bab[k][0]}, ${sengketa.bab[k][1]}.`;
      for (const li of ol.querySelectorAll('li')) li.style.color = li.dataset.i === String(k) ? 'var(--emas-2)' : '';
    });
    host.replaceChildren(where, btn, ol);
  }

  /** Turn the right page over the spine to open bab `next`. */
  private turnPage(next: number) {
    const src = this.parts.kitab_halaman_kanan as Mesh;
    sound.play('page');
    if (!this.sheet) {
      src.geometry.computeBoundingBox();
      this.sheet = new TurningPage(src.geometry.boundingBox!, this.gltfUV);
      src.parent!.add(this.sheet.group);
    }
    const s = this.sheet;
    s.group.position.copy(src.position);
    s.group.quaternion.copy(src.quaternion);
    s.group.scale.copy(src.scale);
    // the sheet carries the current right page away and shows the next
    // left page on its back; the next right page is already underneath
    s.front.map = this.pageR.map;
    s.back.map = this.tex(this.leftCanvas(next));
    this.setPage(this.pageR, this.tex(this.rightCanvas(next)), true);
    s.set(0);
    s.group.visible = true;
    const st = { a: 0 };
    this.turn = gsap.to(st, {
      a: 1,
      duration: 1.15,
      ease: 'power1.inOut',
      onUpdate: () => s.set(st.a),
      onComplete: () => {
        this.setPage(this.pageL, s.back.map!);
        s.front.map?.dispose();
        s.group.visible = false;
        this.bab = next;
        this.turn = null;
      },
    });
  }

  protected teardown() {
    this.turn?.progress(1);
    for (const n of ['balai_atap', 'balai_bubungan', 'balai_simbar']) if (this.parts[n]) this.parts[n].visible = true;
    gsap.killTweensOf(this.world.accent);
    gsap.to(this.world.accent, { intensity: 0, duration: 0.8 });
    this.bookAnchor = null;
  }
}
