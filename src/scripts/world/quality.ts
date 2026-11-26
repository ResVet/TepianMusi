// Quality tiers. Start from a guess based on the device, then step down if
// the frame rate cannot keep up. Never steps back up, so the page does not
// oscillate between looks.

export type Tier = 'high' | 'mid' | 'low';

export interface TierSettings {
  dpr: number;
  shadows: number; // shadow map size, 0 = off
  reflection: number; // mirror resolution scale, 0 = off
  ao: boolean;
  smaa: boolean;
  density: number; // scattered props multiplier
  bloomLevels: number;
}

export const SETTINGS: Record<Tier, TierSettings> = {
  high: { dpr: 1.75, shadows: 2048, reflection: 0.5, ao: true, smaa: true, density: 1, bloomLevels: 7 },
  mid: { dpr: 1.35, shadows: 1024, reflection: 0.36, ao: false, smaa: false, density: 0.7, bloomLevels: 5 },
  low: { dpr: 1, shadows: 0, reflection: 0, ao: false, smaa: false, density: 0.45, bloomLevels: 4 },
};

export function guessTier(gl: WebGLRenderingContext | WebGL2RenderingContext): Tier {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 4;
  let renderer = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  } catch {
    /* some browsers hide it */
  }
  const r = renderer.toLowerCase();
  if (/swiftshader|llvmpipe|software|basic render/.test(r)) return 'low';
  if (mem <= 3 || cores <= 4) return coarse ? 'low' : 'mid';
  if (coarse) {
    // Recent Apple and flagship Android GPUs handle the mid tier comfortably.
    if (/apple|adreno \(tm\) (7[3-9]\d|8\d\d)|mali-g7[1-9]|mali-g[89]\d|immortalis/.test(r) || r === '') return 'mid';
    return 'low';
  }
  if (/intel/.test(r) && !/arc|iris xe|iris\(r\) xe/.test(r)) return 'mid';
  return 'high';
}

export function nextTier(t: Tier): Tier | null {
  return t === 'high' ? 'mid' : t === 'mid' ? 'low' : null;
}

/** Watches frame times and asks for a lower tier when they stay slow. */
export class Governor {
  private samples: number[] = [];
  private cooldown = 4; // seconds before judging
  private hidden = false;

  constructor(private onDrop: () => void) {
    document.addEventListener('visibilitychange', () => {
      this.hidden = document.hidden;
      this.samples.length = 0;
      this.cooldown = 3;
    });
  }

  reset(cooldown = 3) {
    this.samples.length = 0;
    this.cooldown = cooldown;
  }

  tick(dt: number) {
    if (this.hidden || dt <= 0 || dt > 0.5) return;
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      return;
    }
    this.samples.push(dt);
    if (this.samples.length < 90) return;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    this.samples.length = 0;
    if (median > 1 / 40) {
      this.cooldown = 4;
      this.onDrop();
    }
  }
}
