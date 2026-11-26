// Entry point: smooth scroll, the ticket, the rail and clock, the map,
// reveals, the Kartu Sila, and (when WebGL is there) the river world.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { stations } from '../data/stations';
import { cardBlob, drawCard } from './ui/kartu';
import { progress } from './ui/progress';
import { sound } from './ui/sound';
import type { World } from './world/index';
import { dayPart } from './world/clock';
import type { Interaction } from './world/interact/base';

gsap.registerPlugin(ScrollTrigger, SplitText);
// never slow tweens down after a long frame (shader compiles, model decode):
// a camera blend left half-way is worse than a small jump
gsap.ticker.lagSmoothing(0);

const root = document.documentElement;
const reduced = root.classList.contains('is-reduced');
const webgl = root.classList.contains('has-webgl');
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel));

let world: World | null = null;
let lenis: Lenis | null = null;
let worldReady = false;
const readyStations = new Set<number>();

// ------------------------------------------------------------- scroll ----
if (!reduced) {
  lenis = new Lenis({ autoRaf: false, lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
}

function scrollToId(id: string, duration = 1.8) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration, easing: (t) => 1 - Math.pow(1 - t, 3) });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
  if (!a || a.id === 'sobek') return;
  const id = a.getAttribute('href')!.slice(1);
  if (!id || !document.getElementById(id)) return;
  e.preventDefault();
  const peta = $<HTMLDialogElement>('#peta');
  if (peta?.open) peta.close();
  scrollToId(id, 2.2);
  history.replaceState(null, '', `#${id}`);
});

// -------------------------------------------------------------- karcis ----
const nama = $<HTMLInputElement>('#nama');
if (nama) {
  nama.value = progress.state.name;
  let t = 0;
  nama.addEventListener('input', () => {
    clearTimeout(t);
    t = window.setTimeout(() => progress.setName(nama.value), 250);
  });
}

const karcis = $('#karcis');
const sobek = $<HTMLAnchorElement>('#sobek');
const sobekJudul = $('#sobek-judul');
const sobekStatus = $('#sobek-status');
const muat = $('.karcis-muat i');
let torn = false;

function setLoading(p: number) {
  if (!muat || !sobekStatus || !sobekJudul) return;
  muat.style.setProperty('--muat', p.toFixed(3));
  if (!worldReady) {
    sobekJudul.textContent = 'Menyiapkan ketek';
    sobekStatus.textContent = `${Math.round(p * 100)}% · boleh langsung berangkat`;
  }
}

function setTicketReady() {
  karcis?.classList.add('is-siap');
  if (sobekJudul) sobekJudul.textContent = matchMedia('(pointer: coarse)').matches ? 'Geser untuk berangkat' : 'Tarik untuk berangkat';
  if (sobekStatus) sobekStatus.textContent = 'atau ketuk sekali';
}

function tear(dx = 0) {
  if (torn || !sobek) return;
  torn = true;
  sound.play('tear');
  karcis?.classList.add('is-sobek');
  if (reduced) {
    sobek.style.visibility = 'hidden';
  } else {
    gsap.to(sobek, {
      x: Math.max(dx, 0) + 240,
      y: 160,
      rotation: 16,
      opacity: 0,
      duration: 0.85,
      ease: 'power2.in',
      onComplete: () => {
        sobek.style.visibility = 'hidden';
      },
    });
  }
  setTimeout(() => scrollToId('lintas-1', 3.2), reduced ? 0 : 250);
}

if (sobek) {
  if (webgl) setLoading(0);
  else setTicketReady();
  let start: { x: number; id: number } | null = null;
  let dx = 0;
  let moved = false;
  sobek.addEventListener('pointerdown', (e) => {
    if (torn) return;
    start = { x: e.clientX, id: e.pointerId };
    dx = 0;
    moved = false;
    sobek.setPointerCapture(e.pointerId);
  });
  sobek.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    dx = Math.max(0, Math.min(200, e.clientX - start.x));
    if (dx > 4) moved = true;
    gsap.set(sobek, { x: dx, rotation: dx * 0.045 });
    if (dx > 120) {
      start = null;
      tear(dx);
    }
  });
  const end = () => {
    if (!start) return;
    start = null;
    if (!torn) gsap.to(sobek, { x: 0, rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
  };
  sobek.addEventListener('pointerup', end);
  sobek.addEventListener('pointercancel', end);
  sobek.addEventListener('click', (e) => {
    e.preventDefault();
    if (moved && !torn) return;
    tear();
  });
}

// -------------------------------------------------------- rail & clock ----
const railLinks = $$<HTMLAnchorElement>('.rute a[data-rute]');
const railFill = $('.rute-isi');
const jamTeks = $('#jam-teks');
const jamSub = $('#jam-sub');
const ikonSiang = $('[data-ikon="siang"]');
const ikonMalam = $('[data-ikon="malam"]');
const petaKetek = document.getElementById('peta-ketek');
let lastClock = '';
let lastActive = -2;
let lastNight = -1;

function updateRail(active: number, p: number) {
  railFill?.style.setProperty('--p', p.toFixed(4));
  if (active === lastActive) return;
  lastActive = active;
  railLinks.forEach((a, i) => {
    a.classList.toggle('is-aktif', i === active);
    if (i === active) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  });
}

function updateClock(text: string, part: string, night: boolean) {
  if (text !== lastClock && jamTeks) {
    jamTeks.textContent = text;
    lastClock = text;
  }
  if (jamSub && jamSub.textContent !== part) jamSub.textContent = part;
  const n = night ? 1 : 0;
  if (n !== lastNight) {
    lastNight = n;
    if (ikonSiang) ikonSiang.hidden = night;
    if (ikonMalam) ikonMalam.hidden = !night;
  }
}

if (!webgl) {
  // without the 3D scene the clock simply follows the dermaga in view
  const clocks = ['05.20', ...stations.map((s) => s.clock)];
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target as HTMLElement;
        const i = Number(el.dataset.idx ?? 0);
        if (el.dataset.seg === 'stop') {
          const [hh, mm] = stations[i].clock.split('.').map(Number);
          const hour = hh + mm / 60;
          updateRail(i, 0);
          updateClock(stations[i].clock, dayPart(hour), hour >= 18.2);
        } else if (el.dataset.seg === 'hero') updateClock(clocks[0], 'Subuh', false);
      }
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  $$('[data-seg]').forEach((s) => io.observe(s));
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    railFill?.style.setProperty('--p', (scrollY / Math.max(1, max)).toFixed(4));
  };
  addEventListener('scroll', onScroll, { passive: true });
}

// ----------------------------------------------------------------- peta ----
const peta = $<HTMLDialogElement>('#peta');
$('#buka-peta')?.addEventListener('click', () => {
  sound.play('tok');
  peta?.showModal();
});
$('#tutup-peta')?.addEventListener('click', () => peta?.close());
peta?.addEventListener('click', (e) => {
  if (e.target === peta) peta.close();
});

function updateMapBoat(x: number, z: number) {
  if (!petaKetek) return;
  const z0 = Number(petaKetek.dataset.z0);
  const x0 = Number(petaKetek.dataset.x0);
  const sc = Number(petaKetek.dataset.sc);
  petaKetek.setAttribute('cx', ((z0 - z) * sc).toFixed(1));
  petaKetek.setAttribute('cy', ((x0 - x) * sc).toFixed(1));
}

// ---------------------------------------------------------------- sound ----
const suara = $<HTMLButtonElement>('#suara');
function setSoundUI(on: boolean) {
  if (!suara) return;
  suara.setAttribute('aria-pressed', String(on));
  const off = suara.querySelector<HTMLElement>('.suara-mati');
  const onI = suara.querySelector<HTMLElement>('.suara-nyala');
  if (off) off.hidden = on;
  if (onI) onI.hidden = !on;
}
suara?.addEventListener('click', async () => {
  const on = suara.getAttribute('aria-pressed') !== 'true';
  if (on) {
    try {
      await sound.enable();
    } catch {
      return;
    }
    sound.play('tok');
  } else sound.disable();
  progress.setSound(on);
  setSoundUI(on);
});
setSoundUI(false);

// -------------------------------------------------------------- reveals ----
function reveals() {
  if (reduced) return;
  const hero = $('.judul-utama');
  if (hero) {
    const split = SplitText.create(hero, { type: 'words', wordsClass: 'kata', aria: 'auto' });
    gsap.from(split.words, { yPercent: 110, opacity: 0, rotate: 3, duration: 1.1, ease: 'power4.out', stagger: 0.08, delay: 0.15 });
  }
  gsap.from('.sub-utama', { y: 24, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.5 });
  gsap.from('.karcis', { y: 60, rotate: 4, opacity: 0, duration: 1.3, ease: 'power3.out', delay: 0.35 });

  // on one-column layouts the panels rise instead of sliding in from a side
  const narrow = matchMedia('(max-width: 1023px)').matches;
  for (const sec of $$('.dermaga')) {
    const papan = sec.querySelector<HTMLElement>('.papan')!;
    const side = sec.classList.contains('dermaga--kiri') ? -1 : 1;
    const h2 = papan.querySelector<HTMLElement>('h2')!;
    const split = SplitText.create(h2, { type: 'words', wordsClass: 'kata', aria: 'auto' });
    const tl = gsap.timeline({ scrollTrigger: { trigger: papan, start: 'top 82%', once: true } });
    tl.from(papan, { x: narrow ? 0 : 70 * side, y: narrow ? 50 : 0, opacity: 0, duration: 1.1, ease: 'power3.out' })
      .from(papan.querySelector('.papan-kepala'), { opacity: 0, y: 10, duration: 0.6 }, '-=0.7')
      .from(split.words, { yPercent: 100, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06 }, '-=0.55')
      .from(papan.querySelector('.papan-sila'), { opacity: 0, y: 12, duration: 0.6 }, '-=0.5');
    gsap.from(papan.querySelectorAll('.cerita p, .catatan, .ajak, .renung'), {
      opacity: 0,
      y: 22,
      duration: 0.9,
      ease: 'power2.out',
      stagger: 0.12,
      scrollTrigger: { trigger: papan.querySelector('.cerita'), start: 'top 85%', once: true },
    });
  }
  for (const p of $$('.lintas p')) {
    const right = p.parentElement?.classList.contains('lintas--kanan');
    gsap.from(p, { x: narrow ? 0 : right ? 50 : -50, y: narrow ? 30 : 0, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: p, start: 'top 80%', once: true } });
  }
  const kartuH = $('#judul-kartu');
  if (kartuH) {
    const split = SplitText.create(kartuH, { type: 'words', wordsClass: 'kata', aria: 'auto' });
    gsap.from(split.words, { yPercent: 100, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: '#kartu', start: 'top 60%', once: true } });
    gsap.from('.kartu-pratinjau', { y: 60, rotate: -3, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '#kartu', start: 'top 55%', once: true } });
  }
}

// ---------------------------------------------------------- interactions ----
const ajakButtons = $$<HTMLButtonElement>('[data-interaksi]');
const interactions = new Map<number, Interaction>();
let busyOpen = false;

const modules: Record<number, (w: World) => Promise<Interaction>> = {
  0: async (w) => new (await import('./world/interact/akar')).Akar(w),
  1: async (w) => new (await import('./world/interact/ngobeng')).Ngobeng(w),
  2: async (w) => new (await import('./world/interact/kampung')).Kampung(w),
  3: async (w) => new (await import('./world/interact/kitab')).Kitab(w),
  4: async (w) => new (await import('./world/interact/jembatan')).Jembatan(w),
};

function setAjakState() {
  ajakButtons.forEach((b) => {
    const i = Number(b.dataset.interaksi);
    const label = b.querySelector('.ajak-label');
    b.closest('.ajak')?.removeAttribute('hidden');
    if (!webgl) {
      if (label) label.textContent = progress.state.done[i] ? 'Sudah singgah' : 'Tandai sudah singgah';
      b.setAttribute('aria-disabled', 'false');
      return;
    }
    const ok = readyStations.has(i);
    b.setAttribute('aria-disabled', String(!ok));
    if (label) label.textContent = ok ? stations[i].action : 'Memuat dermaga…';
  });
}

ajakButtons.forEach((b) => {
  b.addEventListener('click', async () => {
    const i = Number(b.dataset.interaksi);
    if (!webgl) {
      if (progress.complete(i)) sound.play('stamp');
      setAjakState();
      return;
    }
    if (!world || !readyStations.has(i) || busyOpen) return;
    busyOpen = true;
    try {
      let it = interactions.get(i);
      if (!it) {
        it = await modules[i](world);
        interactions.set(i, it);
      }
      lenis?.stop();
      sound.play('tok');
      it.open(() => {
        lenis?.start();
      });
    } catch (err) {
      console.error(err);
      lenis?.start();
    } finally {
      busyOpen = false;
    }
  });
});

// --------------------------------------------------------- progress & kartu ----
const kanvas = $<HTMLCanvasElement>('#kartu-kanvas');
let still: HTMLCanvasElement | null = null;
let stillWanted = false;

function redrawCard() {
  if (kanvas) drawCard(kanvas, still);
  const belum = $('#kartu-belum');
  if (!belum) return;
  const missing = stations.filter((_, i) => !progress.state.done[i]);
  if (!missing.length) {
    belum.replaceChildren();
    return;
  }
  const p = document.createElement('p');
  p.textContent = 'Dermaga yang belum disinggahi:';
  const ul = document.createElement('ul');
  for (const s of missing) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${s.id}`;
    a.textContent = `${s.roman}. ${s.title}`;
    li.append(a);
    ul.append(li);
  }
  belum.replaceChildren(p, ul);
}

progress.on((s) => {
  $$('.dermaga').forEach((sec, i) => sec.classList.toggle('is-singgah', !!s.done[i]));
  railLinks.forEach((a, i) => a.classList.toggle('is-singgah', !!s.done[i]));
  world?.setLeds(s.done);
  redrawCard();
  setAjakState();
});

function refreshStill() {
  if (!world || !worldReady) return;
  try {
    still = world.capture(1080, 560);
  } catch {
    still = null;
  }
  redrawCard();
}

if (kanvas) {
  new IntersectionObserver(
    (en) => {
      if (en.some((e) => e.isIntersecting)) {
        stillWanted = true;
        if (!still) refreshStill();
      }
    },
    { rootMargin: '200px 0px' },
  ).observe(kanvas);
}

$('#kartu-unduh')?.addEventListener('click', async () => {
  if (!kanvas) return;
  sound.play('tok');
  const blob = await cardBlob(kanvas);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kartu-sila-tepian-musi.png';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});

$('#kartu-bagikan')?.addEventListener('click', async () => {
  if (!kanvas) return;
  sound.play('tok');
  const blob = await cardBlob(kanvas);
  const text = `Kartu Sila dari perjalanan menyusuri Musi: ${progress.count} dari 5 dermaga.`;
  const btn = $('#kartu-bagikan')!;
  try {
    if (blob) {
      const file = new File([blob], 'kartu-sila.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Kartu Sila', text });
        return;
      }
    }
    if (navigator.share) {
      await navigator.share({ title: 'Sila di Tepian Musi', text, url: location.href });
      return;
    }
    await navigator.clipboard.writeText(location.href);
    btn.lastChild!.textContent = 'Tautan disalin';
    setTimeout(() => (btn.lastChild!.textContent = 'Bagikan'), 2200);
  } catch {
    /* the share sheet was dismissed */
  }
});

$('#kartu-ulang')?.addEventListener('click', () => {
  progress.reset();
  sound.play('tok');
  torn = false;
  if (sobek) {
    gsap.set(sobek, { clearProps: 'all' });
    sobek.style.visibility = '';
  }
  karcis?.classList.remove('is-sobek');
  scrollToId('berangkat', 2.8);
});

// keep section measurements honest when content changes height
function remeasure() {
  world?.journey.measure();
  ScrollTrigger.refresh();
}
$$('details').forEach((d) => d.addEventListener('toggle', () => requestAnimationFrame(remeasure)));
document.fonts?.ready.then(() => requestAnimationFrame(remeasure));
addEventListener('load', () => requestAnimationFrame(remeasure));

// ---------------------------------------------------------------- world ----
let drawn = false;
let lastSound = 0;
async function bootWorld() {
  const host = $('#dunia');
  if (!host) return;
  try {
    const { World: W } = await import('./world/index');
    world = new W(host, {
      progress: (p) => setLoading(p),
      ready: () => {
        worldReady = true;
        setTicketReady();
        root.classList.add('is-ready');
        world?.setLeds(progress.state.done);
        if (stillWanted) refreshStill();
      },
      stationReady: (i) => {
        readyStations.add(i);
        setAjakState();
      },
      frame: (f) => {
        if (!drawn) {
          drawn = true;
          root.classList.add('is-drawn');
        }
        updateRail(f.state.stop, f.state.progress);
        updateClock(f.clock, f.part, f.night > 0.5);
        updateMapBoat(f.boatX, f.boatZ);
        const now = performance.now();
        if (now - lastSound > 250) {
          lastSound = now;
          sound.setScene(world?.boat?.speed ?? 0, f.night, document.body.classList.contains('is-interaksi'));
        }
      },
      lost: () => {
        root.classList.add('is-lost');
      },
    }, reduced);
    world.panelSides = $$('.dermaga').map((d) => (d.classList.contains('dermaga--kiri') ? -1 : 1));
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __tm: World }).__tm = world;
    await world.start();
  } catch (err) {
    console.error('Dunia 3D gagal dimuat', err);
    root.classList.remove('has-webgl');
    root.classList.add('no-webgl');
    setTicketReady();
    setAjakState();
  }
}

reveals();
setAjakState();
redrawCard();
if (webgl) bootWorld();
