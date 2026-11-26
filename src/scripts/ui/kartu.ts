// Kartu Sila: a keepsake card drawn on a canvas from the passenger's
// progress, with a still of Ampera at night rendered by the 3D scene.
import { stations } from '../../data/stations';
import { progress } from './progress';

const W = 1080;
const H = 1350;
const SERIF = '"Newsreader Variable", Georgia, serif';
const SANS = '"Plus Jakarta Sans Variable", "Segoe UI", sans-serif';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function tanggal(d = new Date()) {
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** Diamond chain along a line, after the gold-thread borders of songket. */
function songketBand(g: CanvasRenderingContext2D, x: number, y: number, w: number) {
  g.save();
  g.fillStyle = '#8f1126';
  g.fillRect(x, y, w, 30);
  g.strokeStyle = '#d8a33e';
  g.lineWidth = 2;
  g.strokeRect(x + 3, y + 3, w - 6, 24);
  const step = 26;
  for (let cx = x + 16; cx < x + w - 10; cx += step) {
    g.beginPath();
    g.moveTo(cx, y + 6);
    g.lineTo(cx + 8, y + 15);
    g.lineTo(cx, y + 24);
    g.lineTo(cx - 8, y + 15);
    g.closePath();
    g.fillStyle = '#e2b356';
    g.fill();
    g.fillStyle = '#8f1126';
    g.fillRect(cx - 2, y + 13, 4, 4);
  }
  g.restore();
}

function stamp(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, roman: string, done: boolean) {
  g.save();
  g.translate(cx, cy);
  if (done) {
    g.rotate(-0.22);
    g.fillStyle = 'rgba(143,17,38,0.95)';
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(241,217,192,0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, r - 6, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#f1d9c0';
  } else {
    g.strokeStyle = 'rgba(232,237,227,0.35)';
    g.setLineDash([5, 6]);
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(232,237,227,0.45)';
  }
  g.font = `700 ${Math.round(r * 0.78)}px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(roman, 0, 2);
  g.restore();
}

export function drawCard(canvas: HTMLCanvasElement, still: HTMLCanvasElement | null) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const s = progress.state;
  g.clearRect(0, 0, W, H);
  // plate
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#173f35');
  bg.addColorStop(1, '#0d241e');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // the night still of Ampera
  const imgH = 520;
  if (still) {
    const sw = still.width;
    const sh = still.height;
    const scale = Math.max(W / sw, imgH / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    g.drawImage(still, (W - dw) / 2, (imgH - dh) / 2, dw, dh);
  } else {
    const sky = g.createLinearGradient(0, 0, 0, imgH);
    sky.addColorStop(0, '#0b1426');
    sky.addColorStop(0.7, '#2a2638');
    sky.addColorStop(1, '#3a2c2a');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, imgH);
  }
  // fade the still into the plate colour at exactly that height
  const k = imgH / H;
  const r = Math.round(0x17 + (0x0d - 0x17) * k);
  const gg = Math.round(0x3f + (0x24 - 0x3f) * k);
  const b = Math.round(0x35 + (0x1e - 0x35) * k);
  const fade = g.createLinearGradient(0, imgH - 240, 0, imgH);
  fade.addColorStop(0, `rgba(${r},${gg},${b},0)`);
  fade.addColorStop(1, `rgba(${r},${gg},${b},1)`);
  g.fillStyle = fade;
  g.fillRect(0, imgH - 220, W, 220);

  // frame
  g.strokeStyle = '#d8a33e';
  g.lineWidth = 3;
  g.strokeRect(28, 28, W - 56, H - 56);
  songketBand(g, 28, H - 86, W - 56);

  // title block
  g.fillStyle = '#e8ede3';
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = `600 96px ${SERIF}`;
  g.fillText('Kartu Sila', 76, imgH + 20);
  g.font = `600 30px ${SANS}`;
  g.fillStyle = '#f0cb76';
  g.fillText('Sila di Tepian Musi', 80, imgH + 70);
  g.fillStyle = 'rgba(232,237,227,0.75)';
  g.font = `500 28px ${SANS}`;
  const name = s.name || 'Penumpang ketek';
  g.fillText(`${name} · ${tanggal()}`, 80, imgH + 114);

  // five rows
  const top = imgH + 156;
  const rowH = 100;
  stations.forEach((st, i) => {
    const y = top + i * rowH;
    const done = s.done[i];
    stamp(g, 128, y + 40, 40, st.roman, done);
    g.textAlign = 'left';
    g.fillStyle = done ? '#e8ede3' : 'rgba(232,237,227,0.5)';
    g.font = `600 38px ${SERIF}`;
    g.fillText(st.title, 196, y + 34);
    g.font = `italic 500 28px ${SERIF}`;
    g.fillStyle = done ? '#f0cb76' : 'rgba(240,203,118,0.45)';
    g.fillText(done ? st.value : 'Belum disinggahi', 196, y + 74);
    g.textAlign = 'right';
    g.font = `600 22px ${SANS}`;
    g.fillStyle = 'rgba(232,237,227,0.55)';
    g.fillText(st.silaShort, W - 80, y + 34);
    if (i < 4) {
      g.fillStyle = 'rgba(232,237,227,0.12)';
      g.fillRect(196, y + rowH - 6, W - 276, 1);
    }
  });
  g.textAlign = 'left';
  g.font = `600 24px ${SANS}`;
  g.fillStyle = 'rgba(232,237,227,0.7)';
  const n = progress.count;
  g.fillText(n === 5 ? 'Kelima dermaga sudah disinggahi.' : `${n} dari 5 dermaga sudah disinggahi.`, 80, H - 118);
  g.textAlign = 'right';
  g.fillText(location.host || 'tepian-musi', W - 80, H - 118);
}

export async function cardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
}
