// The interaction overlay: a top bar with a way back, a bottom sheet for
// controls and text, and real buttons pinned over points in the 3D scene.
import { Vector3, type Camera } from 'three';

export interface AnchorOpts {
  label: string;
  text?: string;
  kind?: 'titik' | 'slot' | 'label';
  cls?: string;
  onClick?: () => void;
  onPointerDown?: (e: PointerEvent) => void;
}

export class Anchor {
  el: HTMLElement;
  world = new Vector3();
  hidden = false;
  constructor(el: HTMLElement) {
    this.el = el;
  }
  at(v: Vector3) {
    this.world.copy(v);
    return this;
  }
  setText(t: string) {
    this.el.textContent = t;
    return this;
  }
  set(cls: string, on: boolean) {
    this.el.classList.toggle(cls, on);
    return this;
  }
  hide(h: boolean) {
    this.hidden = h;
    return this;
  }
}

const tmp = new Vector3();

class Hud {
  private root = document.getElementById('hud') as HTMLElement;
  private title = document.getElementById('hud-title') as HTMLElement;
  private sub = document.getElementById('hud-sub') as HTMLElement;
  readonly sheet = document.getElementById('hud-lembar') as HTMLElement;
  private layer = document.getElementById('hud-jangkar') as HTMLElement;
  private closeBtn = document.getElementById('hud-tutup') as HTMLButtonElement;
  private anchors: Anchor[] = [];
  private onClose: (() => void) | null = null;
  private lastFocus: HTMLElement | null = null;
  open = false;

  constructor() {
    this.closeBtn?.addEventListener('click', () => this.requestClose());
    document.addEventListener('keydown', (e) => {
      if (this.open && e.key === 'Escape') {
        e.preventDefault();
        this.requestClose();
      }
    });
  }

  show(title: string, sub: string, onClose: () => void) {
    this.lastFocus = document.activeElement as HTMLElement | null;
    this.title.textContent = title;
    this.sub.textContent = sub;
    this.onClose = onClose;
    this.root.removeAttribute('inert');
    this.root.classList.add('is-buka');
    document.body.classList.add('is-interaksi');
    for (const el of this.behind()) el.setAttribute('inert', '');
    this.open = true;
    requestAnimationFrame(() => this.closeBtn.focus({ preventScroll: true }));
  }

  requestClose() {
    this.onClose?.();
  }

  hide() {
    this.open = false;
    this.root.classList.remove('is-buka');
    this.root.setAttribute('inert', '');
    document.body.classList.remove('is-interaksi');
    for (const el of this.behind()) el.removeAttribute('inert');
    this.clearAnchors();
    // the sheet keeps its content while it fades out; the next open replaces it
    this.onClose = null;
    this.lastFocus?.focus({ preventScroll: true });
  }

  /** Everything that sits behind the HUD while a dermaga is open. */
  private behind() {
    return document.querySelectorAll('#isi, .rute, .topbar');
  }

  setSheet(...nodes: (Node | string)[]) {
    this.sheet.replaceChildren(...nodes);
    this.sheet.scrollTop = 0;
  }

  addAnchor(o: AnchorOpts): Anchor {
    const wrap = document.createElement('div');
    wrap.className = 'jangkar';
    let inner: HTMLElement;
    if (o.kind === 'label') {
      inner = document.createElement('span');
      inner.className = `label-3d ${o.cls ?? ''}`;
      inner.textContent = o.text ?? o.label;
      inner.setAttribute('aria-hidden', 'true');
      wrap.style.pointerEvents = 'none';
    } else {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `titik ${o.kind === 'slot' ? 'titik--slot' : ''} ${o.cls ?? ''}`;
      b.setAttribute('aria-label', o.label);
      b.textContent = o.text ?? '';
      if (o.onClick) b.addEventListener('click', o.onClick);
      if (o.onPointerDown) b.addEventListener('pointerdown', o.onPointerDown);
      inner = b;
    }
    wrap.append(inner);
    this.layer.append(wrap);
    const a = new Anchor(inner);
    (a as Anchor & { wrap: HTMLElement }).wrap = wrap;
    this.anchors.push(a);
    return a;
  }

  removeAnchor(a: Anchor) {
    (a as Anchor & { wrap: HTMLElement }).wrap.remove();
    this.anchors = this.anchors.filter((x) => x !== a);
  }

  clearAnchors() {
    for (const a of this.anchors) (a as Anchor & { wrap: HTMLElement }).wrap.remove();
    this.anchors = [];
  }

  /** Position anchors over their 3D points. */
  project(camera: Camera, w: number, h: number) {
    for (const a of this.anchors) {
      const wrap = (a as Anchor & { wrap: HTMLElement }).wrap;
      tmp.copy(a.world).project(camera);
      const off = tmp.z > 1 || tmp.z < -1 || a.hidden || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1;
      if (off) {
        wrap.style.visibility = 'hidden';
        continue;
      }
      wrap.style.visibility = '';
      const x = (tmp.x * 0.5 + 0.5) * w;
      const y = (-tmp.y * 0.5 + 0.5) * h;
      wrap.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    }
  }
}

export const hud = new Hud();

/** Small DOM helper. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null | false)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const k of kids) if (k) el.append(k);
  return el;
}
