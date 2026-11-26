// Dermaga V: a time slider from 1906 to 2026. The bridge rises from its
// piers, the lift span works until 1970, the counterweights go in 1990, the
// clocks arrive in 2018, and finally the lights come on, one segment for
// every dermaga already visited.
import { gsap } from 'gsap';
import { MathUtils, Vector3 } from 'three';
import { stations, timeline } from '../../../data/stations';
import { hud, h } from '../../ui/hud';
import { progress } from '../../ui/progress';
import { sound } from '../../ui/sound';
import { AMPERA_X, AMPERA_Z } from '../layout';
import type { World } from '../index';
import { Interaction, chip } from './base';

const Y0 = 1906;
const Y1 = 2026;
const sm = (a: number, b: number, x: number) => MathUtils.smoothstep(x, a, b);

export class Jembatan extends Interaction {
  readonly index = 4;
  readonly title = stations[4].title;
  private year = Y1;
  private yearF = Y1;
  private yearEl!: HTMLElement;
  private textEl!: HTMLElement;
  private range!: HTMLInputElement;
  private lightBtn!: HTMLButtonElement;
  private litNote!: HTMLElement;
  private visited = new Set<number>();
  private lit = false;

  constructor(world: World) {
    super(world, `Dermaga V · ${stations[4].silaShort}`);
  }

  protected setup() {
    const pivot = new Vector3(AMPERA_X - 8, 17, AMPERA_Z);
    this.orbit.pivot.copy(pivot);
    // start roughly where the station view already looks at the bridge
    // (south-east of it, on the Seberang Ulu side of the river)
    Object.assign(this.orbit, { yaw: -2.02, pitch: 0.05, dist: 270, fov: 38 });
    this.setLimits({ yawMin: -2.75, yawMax: -1.3, pitchMin: 0.02, pitchMax: 0.55, distMin: 140, distMax: 420 });

    this.yearEl = h('b', {}, String(this.year));
    this.textEl = h('p', {}, '');
    const read = h('div', { class: 'tahun-baca', 'aria-live': 'polite' }, this.yearEl, this.textEl);
    this.range = h('input', {
      class: 'tahun',
      type: 'range',
      min: String(Y0),
      max: String(Y1),
      step: '1',
      value: String(this.year),
      'aria-label': 'Tahun',
    }) as HTMLInputElement;
    this.range.addEventListener('input', () => this.setYear(Number(this.range.value), false));
    const scale = h('div', { class: 'tahun-skala', 'aria-hidden': 'true' }, h('span', {}, String(Y0)), h('span', {}, '1965'), h('span', {}, String(Y1)));
    const jumps = h('div', { class: 'pilihan', role: 'group', 'aria-label': 'Peristiwa' });
    for (const e of timeline) {
      const b = chip(String(e.year));
      b.addEventListener('click', () => this.setYear(e.year, true));
      jumps.append(b);
    }
    this.lightBtn = h('button', { class: 'tombol tombol--emas', type: 'button' }, 'Nyalakan Ampera') as HTMLButtonElement;
    this.lightBtn.addEventListener('click', () => this.lightUp());
    this.litNote = h('p', { class: 'hud-petunjuk' });
    hud.setSheet(h('p', { class: 'hud-petunjuk' }, stations[4].actionHint), read, this.range, scale, jumps, this.lightBtn, this.litNote);
    this.setYear(this.lit ? Y1 : 1906, true);
  }

  private setYear(y: number, jump: boolean) {
    const prev = this.year;
    this.year = MathUtils.clamp(Math.round(y), Y0, Y1);
    this.range.value = String(this.year);
    this.yearEl.textContent = String(this.year);
    let ev: (typeof timeline)[number] = timeline[0];
    for (const e of timeline) if (e.year <= this.year) ev = e;
    this.textEl.textContent = ev.text;
    this.visited.add(ev.year);
    if (jump || Math.abs(prev - this.year) > 3) gsap.to(this, { yearF: this.year, duration: 1.6, ease: 'power2.inOut' });
    else gsap.to(this, { yearF: this.year, duration: 0.5, ease: 'power1.out' });
    if (prev !== this.year) sound.play('tok');
    const ready = this.year === Y1;
    this.lightBtn.disabled = !ready;
    this.lightBtn.setAttribute('aria-disabled', String(!ready));
    this.litNote.textContent = ready ? '' : 'Geser sampai 2026 untuk menyalakan lampunya.';
  }

  protected tick(_dt: number, t: number) {
    const a = this.world.stations.ampera;
    if (!a) return;
    const y = this.yearF;
    if (y < 1965) {
      const p = MathUtils.clamp((y - 1962) / 3, 0, 1);
      a.setBuild({ on: 1, pier: sm(0, 0.35, p), tower: sm(0.25, 0.7, p), deck: sm(0.45, 0.9, p), lift: sm(0.82, 1, p) });
    } else a.setBuild({ on: 0, pier: 1, tower: 1, deck: 1, lift: 1 });
    // the lift span worked between 1965 and 1970
    const working = y >= 1965 && y < 1970;
    a.setLift(working ? (0.5 - 0.5 * Math.cos(t * 0.7)) * 9.5 : 0);
    a.setCables(y >= 1962 && y < 1990);
    a.setClocksVisible(y >= 2018);
    if (!this.lit) a.setLedTargets([false, false, false, false, false]);
  }

  private lightUp() {
    if (this.year !== Y1) return;
    const first = !progress.state.done[4];
    if (first) progress.complete(4);
    this.lit = true;
    const done = progress.state.done;
    const a = this.world.stations.ampera;
    // light the segments one after another
    done.forEach((on, i) => {
      setTimeout(() => {
        if (!a) return;
        const t = done.map((d, j) => d && j <= i);
        a.setLedTargets(t);
        if (on) sound.play('pop');
      }, 350 * i);
    });
    const n = done.filter(Boolean).length;
    sound.play('chime');
    if (first) setTimeout(() => sound.play('stamp'), 700);
    this.done = true;
    this.litNote.textContent = n === 5
      ? 'Kelima segmen menyala: kamu sudah singgah di semua dermaga.'
      : `${n} dari 5 segmen menyala, satu untuk tiap dermaga yang sudah kamu selesaikan. Segmen lainnya menyala setelah dermaga itu kamu singgahi.`;
    if (!hud.sheet.querySelector('.selesai')) {
      hud.sheet.append(this.backBox('Ampera dibangun supaya kedua tepi Musi terhubung dan sama-sama maju. Namanya, Amanat Penderitaan Rakyat, mengingatkan untuk siapa jembatan itu dibangun.'));
    }
  }

  protected teardown() {
    const a = this.world.stations.ampera;
    gsap.killTweensOf(this);
    if (a) {
      a.setBuild({ on: 0, pier: 1, tower: 1, deck: 1, lift: 1 });
      a.setLift(0);
      a.setCables(false);
      a.setClocksVisible(true);
      a.setLedTargets(progress.state.done);
    }
  }
}
