// Dermaga I: pick one of the mosque's three cultural roots and the parts
// that came from it light up while the rest of the building greys out.
import { gsap } from 'gsap';
import { MathUtils, type Mesh, type MeshStandardMaterial } from 'three';
import { roots, stations } from '../../../data/stations';
import { hud, h, type Anchor } from '../../ui/hud';
import { sound } from '../../ui/sound';
import { meshesOf } from '../assets';
import type { World } from '../index';
import { Interaction, chip } from './base';

type Root = (typeof roots)[number]['id'];

// Points on the model (glTF local metres, front of the mosque toward +Z).
const PARTS: Record<Root, { part: string; label: string; at: [number, number, number] }[]> = {
  tionghoa: [
    { part: 'menara', label: 'Menara segi delapan bersusun lima', at: [12.2, 12.5, 13.2] },
    { part: 'gapura', label: 'Gapura bergaya kelenteng', at: [0, 6.4, 24] },
    { part: 'atap', label: 'Atap hijau berujung melengkung', at: [-10.5, 6.9, 10.5] },
    { part: 'pilar', label: 'Pilar merah', at: [5, 3.6, 10.5] },
  ],
  arab: [
    { part: 'kubah', label: 'Kubah dengan bulan sabit dan bintang', at: [0, 17.2, 0] },
    { part: 'lengkung', label: 'Pintu dan jendela lengkung', at: [-7.5, 3.6, 10.3] },
    { part: 'ornamen', label: 'Panel ornamen geometris', at: [0, 10.55, 10.4] },
  ],
  palembang: [
    { part: 'limas', label: 'Atap limas di empat sudut', at: [7.7, 15.2, 7.7] },
    { part: 'tanduk', label: 'Ornamen tanduk kambing', at: [-7.7, 16.4, 7.7] },
  ],
};

interface Lit {
  mesh: Mesh;
  layer: string;
  u: { glow: { value: number }; dim: { value: number } };
}

export class Akar extends Interaction {
  readonly index = 0;
  readonly title = stations[0].title;
  private lit: Lit[] = [];
  private seen = new Set<Root>();
  private current: Root | null = null;
  private anchors: Anchor[] = [];
  private desc!: HTMLElement;
  private count!: HTMLElement;
  private chips = new Map<Root, HTMLButtonElement>();

  constructor(world: World) {
    super(world, `Dermaga I · ${stations[0].silaShort}`);
  }

  private prepare() {
    if (this.lit.length) return;
    const g = this.world.stations.groups[0];
    g.traverse((o) => {
      const layer = o.userData.tm_layer as string | undefined;
      if (!layer) return;
      for (const mesh of meshesOf(o)) {
        const u = { glow: { value: 0 }, dim: { value: 0 } };
        const base = mesh.material as MeshStandardMaterial;
        const mat = base.clone();
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uGlowK = u.glow;
          sh.uniforms.uDimK = u.dim;
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uGlowK;\nuniform float uDimK;')
            .replace(
              '#include <opaque_fragment>',
              `#include <opaque_fragment>
{
  float fr = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.2);
  vec3 grey = vec3(dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, grey * 0.5, uDimK);
  gl_FragColor.rgb += vec3(1.0, 0.7, 0.28) * (fr * 1.4 + 0.06) * uGlowK;
}`,
            );
        };
        mat.customProgramCacheKey = () => `akar_${base.name}`;
        mesh.material = mat;
        this.lit.push({ mesh, layer, u });
      }
    });
  }

  protected setup() {
    this.prepare();
    const g = this.world.stations.groups[0];
    g.updateMatrixWorld(true);
    this.worldOf(g, [0, 9.5, 8], this.orbit.pivot);
    Object.assign(this.orbit, { yaw: -0.5, pitch: 0.12, dist: 70, fov: 40 });
    this.setLimits({ yawMin: -1.2, yawMax: 1.0, pitchMin: 0.04, pitchMax: 0.8, distMin: 26, distMax: 95 });

    const st = stations[0];
    const hint = h('p', { class: 'hud-petunjuk' }, st.actionHint);
    const row = h('div', { class: 'pilihan', role: 'group', 'aria-label': 'Akar budaya' });
    for (const r of roots) {
      const b = chip(r.label, { pressed: false }) as HTMLButtonElement;
      if (this.seen.has(r.id)) b.classList.add('is-selesai');
      b.addEventListener('click', () => this.pick(r.id));
      this.chips.set(r.id, b);
      row.append(b);
    }
    this.desc = h('p', { class: 'hud-umpan' }, 'Belum ada akar yang dipilih.');
    this.count = h('p', { class: 'hud-petunjuk' }, '');
    hud.setSheet(hint, row, this.desc, this.count);
    this.updateCount(false);
  }

  private pick(id: Root) {
    if (this.current === id) return;
    sound.play('tok');
    this.current = id;
    this.seen.add(id);
    for (const [k, b] of this.chips) {
      b.setAttribute('aria-pressed', String(k === id));
      b.classList.toggle('is-selesai', this.seen.has(k));
    }
    for (const l of this.lit) {
      const on = l.layer === id;
      gsap.to(l.u.glow, { value: on ? 1 : 0, duration: 0.7, ease: 'power2.out' });
      gsap.to(l.u.dim, { value: on || l.layer === 'dasar' ? (on ? 0 : 0.35) : 0.82, duration: 0.7, ease: 'power2.out' });
    }
    const r = roots.find((x) => x.id === id)!;
    this.desc.textContent = r.text;
    // anchors for the parts of this root
    for (const a of this.anchors) hud.removeAnchor(a);
    this.anchors = [];
    const g = this.world.stations.groups[0];
    PARTS[id].forEach((p, i) => {
      const a = hud.addAnchor({
        label: p.label,
        text: String(i + 1),
        onClick: () => {
          sound.play('pop');
          this.desc.textContent = `${p.label}. ${r.text}`;
          const w = this.worldOf(g, p.at);
          this.focusOn(w, MathUtils.clamp(this.orbit.dist * 0.7, 26, 60));
        },
      });
      this.worldOf(g, p.at, a.world);
      this.anchors.push(a);
    });
    const pv = this.worldOf(g, [0, 9.5, 8]);
    this.focusOn(pv, 66);
    this.updateCount();
  }

  private updateCount(announce = true) {
    const n = this.seen.size;
    this.count.textContent = n < 3 ? `${n} dari 3 akar sudah ditelusuri.` : '';
    if (n < 3 || hud.sheet.querySelector('.selesai')) return;
    if (announce) {
      hud.sheet.append(this.complete('Ketiga akar sudah kamu telusuri. Masjid ini memakai semuanya sekaligus, tanpa satu pun harus mengalah.'));
    } else {
      hud.sheet.append(this.backBox('Ketiga akar sudah kamu telusuri.'));
    }
  }

  protected teardown() {
    for (const l of this.lit) {
      gsap.killTweensOf(l.u.glow);
      gsap.killTweensOf(l.u.dim);
      gsap.to(l.u.glow, { value: 0, duration: 0.6 });
      gsap.to(l.u.dim, { value: 0, duration: 0.6 });
    }
    this.anchors = [];
    this.current = null;
    this.chips.clear();
  }
}
