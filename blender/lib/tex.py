"""Procedural, tileable PBR textures for the Tepian Musi models.

Every map is generated here with numpy (and Pillow for a few drawn motifs),
so no third-party imagery ends up in the models. Each generator writes
<name>_c.png (base color, sRGB), <name>_r.png (roughness in G, metal in B,
linear) and <name>_n.png (OpenGL normal map) into blender/textures/.
"""
from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX_DIR = os.path.join(ROOT, "textures")
os.makedirs(TEX_DIR, exist_ok=True)


# ----------------------------------------------------------------- noise ----
def _freq(h, w):
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    return fx, fy


def blur(a, sx, sy=None):
    """Periodic gaussian blur (keeps textures tileable)."""
    sy = sx if sy is None else sy
    h, w = a.shape
    fx, fy = _freq(h, w)
    g = np.exp(-2 * math.pi**2 * ((sx * fx) ** 2 + (sy * fy) ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def norm(a):
    lo, hi = float(a.min()), float(a.max())
    return (a - lo) / (hi - lo + 1e-9)


def noise(size, sx, seed, sy=None, w=None):
    w = size if w is None else w
    r = np.random.default_rng(seed).standard_normal((size, w))
    return norm(blur(r, sx, sy))


def fbm(size, seed, sigmas=(96, 48, 24, 12, 6, 3), gain=0.55, w=None):
    acc = 0.0
    amp = 1.0
    tot = 0.0
    for i, s in enumerate(sigmas):
        acc = acc + amp * (noise(size, s, seed * 31 + i, w=w) - 0.5)
        tot += amp
        amp *= gain
    return norm(acc / tot)


def normal_from_height(h, strength=4.0):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, 1, 0) - np.roll(h, -1, 0)) * 0.5 * strength
    n = np.stack([-dx, -dy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def srgb(c):
    return np.array(c, dtype=np.float32)


def mix(a, b, t):
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    t = np.asarray(t, dtype=np.float32)

    def colorlike(x):
        return (x.ndim == 1 and x.shape[0] in (3, 4)) or x.ndim == 3
    if t.ndim == 2 and (colorlike(a) or colorlike(b)):
        t = t[..., None]
    return a * (1 - t) + b * t


# ------------------------------------------------------------------ io ------
def _save(arr, path, mode="RGB"):
    arr = np.clip(arr, 0, 1)
    if arr.ndim == 2:
        Image.fromarray((arr * 255 + 0.5).astype(np.uint8), "L").save(path)
    else:
        Image.fromarray((arr * 255 + 0.5).astype(np.uint8), mode).save(path)


def save_set(name, color, rough, normal=None, metal=None, alpha=None):
    """Write the map set and return a dict of absolute paths."""
    paths = {}
    if alpha is not None:
        rgba = np.concatenate([np.clip(color, 0, 1), alpha[..., None]], -1)
        p = os.path.join(TEX_DIR, f"{name}_c.png")
        _save(rgba, p, "RGBA")
    else:
        p = os.path.join(TEX_DIR, f"{name}_c.png")
        _save(color, p)
    paths["c"] = p
    m = np.zeros_like(rough) if metal is None else metal
    rm = np.stack([np.ones_like(rough), rough, m], -1)
    p = os.path.join(TEX_DIR, f"{name}_r.png")
    _save(rm, p)
    paths["r"] = p
    if normal is not None:
        p = os.path.join(TEX_DIR, f"{name}_n.png")
        _save(normal, p)
        paths["n"] = p
    return paths


def cached(name, keys=("c", "r", "n")):
    ps = {k: os.path.join(TEX_DIR, f"{name}_{k}.png") for k in keys}
    if all(os.path.exists(p) for p in ps.values()) and not os.environ.get("RETEX"):
        return ps
    return None


# ------------------------------------------------------------- materials ----
def wood(name, base=(0.45, 0.29, 0.16), dark=(0.24, 0.14, 0.07), size=1024,
         seed=1, planks=0, gap=0.004, rough=(0.62, 0.82), paint=None,
         paint_wear=0.35, weather=0.4):
    """Wood with grain along U. planks>0 draws that many boards across V."""
    c = cached(name)
    if c:
        return c
    s = size
    grain = noise(s, 90, seed, sy=1.4)            # long streaks along u
    fine = noise(s, 30, seed + 5, sy=0.6)
    rings = np.sin((grain * 22 + fine * 3) * math.pi) * 0.5 + 0.5
    blot = fbm(s, seed + 9, sigmas=(120, 60, 30))
    h = 0.55 * rings + 0.3 * fine + 0.15 * blot
    v = np.linspace(0, 1, s, endpoint=False)[:, None] * np.ones((1, s))
    u = np.ones((s, 1)) * np.linspace(0, 1, s, endpoint=False)[None, :]
    board_tint = np.zeros((s, s))
    seams = np.zeros((s, s))
    if planks:
        idx = np.floor(v * planks).astype(int)
        rng = np.random.default_rng(seed + 77)
        tints = rng.uniform(-0.12, 0.12, planks + 1)
        offs = rng.uniform(0, 1, planks + 1)
        board_tint = tints[idx]
        fv = (v * planks) % 1.0
        seams = np.clip(1 - np.minimum(fv, 1 - fv) / (gap * planks), 0, 1) ** 2
        # butt joints along u, staggered per board
        bu = (u + offs[idx]) % 1.0
        joint = np.clip(1 - np.minimum(bu, 1 - bu) / (gap * 1.2), 0, 1) ** 2
        seams = np.maximum(seams, joint * 0.9)
    knots = np.clip((noise(s, 14, seed + 13) - 0.86) * 8, 0, 1)
    col = mix(srgb(base), srgb(dark), np.clip(h * 0.9 + knots * 0.8, 0, 1))
    col = col * (1 + board_tint[..., None])
    if weather:
        grey = col.mean(-1, keepdims=True) * np.array([1.02, 1.0, 0.96])
        w = np.clip((fbm(s, seed + 21) - 0.45) * 2.2, 0, 1) * weather
        col = mix(col, grey * 1.15, w)
    if paint is not None:
        chips = np.clip((fbm(s, seed + 33, sigmas=(40, 20, 10, 5, 2)) - (1 - paint_wear)) * 9, 0, 1)
        pc = srgb(paint) * (0.92 + 0.12 * fbm(s, seed + 41, sigmas=(80, 30, 8))[..., None])
        pc = pc * (1 - 0.18 * grain[..., None] * 0.4)
        col = mix(pc, col, chips)
        r = np.where(chips > 0.5, rough[1], rough[0] * 0.8) + 0.08 * fine
        hh = h * 0.25 + (1 - chips) * 0.6
    else:
        r = rough[0] + (rough[1] - rough[0]) * (0.5 * h + 0.5 * fine)
        hh = h
    col = col * (1 - 0.65 * seams[..., None])
    r = np.clip(r + 0.15 * seams, 0, 1)
    hh = hh - 1.2 * seams
    return save_set(name, col, r, normal_from_height(hh, 3.5))


def painted(name, color, size=512, seed=3, rough=0.5, wear=0.08, streaks=0.25,
            under=(0.3, 0.28, 0.26), metal=0.0, panel=0):
    c = cached(name)
    if c:
        return c
    s = size
    n1 = fbm(s, seed, sigmas=(64, 32, 16, 8, 4))
    st = noise(s, 3, seed + 7, sy=70)              # vertical drips
    col = srgb(color) * (0.9 + 0.16 * n1[..., None]) * (1 - streaks * 0.25 * st[..., None])
    chips = np.clip((fbm(s, seed + 11, sigmas=(30, 15, 7, 3)) - (1 - wear)) * 10, 0, 1)
    col = mix(col, srgb(under), chips)
    h = n1 * 0.2 - chips * 0.5
    if panel:
        u = np.linspace(0, 1, s, endpoint=False)
        pu = np.abs(((u * panel) % 1.0) - 0.5)
        line = np.clip((pu - 0.485) * 70, 0, 1)
        h = h - line[None, :] * 0.8
        col = col * (1 - 0.25 * line[None, :, None])
    r = np.clip(rough + 0.12 * (n1 - 0.5) + 0.25 * chips + 0.1 * st, 0.05, 1)
    m = np.full((s, s), metal) * (1 - chips)
    return save_set(name, col, r, normal_from_height(h, 2.0), metal=m)


def tiles(name, color=(0.63, 0.29, 0.17), rows=10, cols=7, size=1024, seed=5,
          curved=True):
    """Terracotta roof tiles (genteng). Rows run along V (downhill)."""
    c = cached(name)
    if c:
        return c
    s = size
    v = np.linspace(0, 1, s, endpoint=False)[:, None] * np.ones((1, s))
    u = np.ones((s, 1)) * np.linspace(0, 1, s, endpoint=False)[None, :]
    row = np.floor(v * rows)
    shift = (row % 2) * 0.5
    fu = (u * cols + shift) % 1.0
    fv = (v * rows) % 1.0
    profile = np.sin(fu * math.pi) if curved else np.ones_like(fu)
    lap = fv ** 0.6                          # each tile thickens toward its lower lip
    h = 0.55 * profile + 0.45 * lap
    edge = np.clip(1 - fv / 0.06, 0, 1)      # shadowed overlap line
    h = h - edge * 0.9
    idx = (row * 97 + np.floor(u * cols + shift)).astype(int)
    rng = np.random.default_rng(seed)
    tint = rng.uniform(-0.14, 0.12, idx.max() + 1)[idx]
    dirt = fbm(s, seed + 4, sigmas=(120, 60, 20, 8))
    lich = np.clip((fbm(s, seed + 8, sigmas=(30, 12, 5)) - 0.72) * 5, 0, 1)
    col = srgb(color) * (1 + tint[..., None]) * (0.82 + 0.3 * h[..., None])
    col = mix(col, srgb((0.18, 0.13, 0.1)), np.clip(edge * 0.8 + dirt * 0.25, 0, 1))
    col = mix(col, srgb((0.42, 0.44, 0.33)), lich * 0.55)
    r = np.clip(0.7 + 0.2 * dirt - 0.1 * profile, 0, 1)
    return save_set(name, col, r, normal_from_height(h, 7.0))


def plaster(name, color=(0.86, 0.84, 0.78), size=512, seed=7, stains=0.35, rough=0.85):
    c = cached(name)
    if c:
        return c
    s = size
    n = fbm(s, seed, sigmas=(80, 40, 20, 10, 5, 2))
    st = noise(s, 4, seed + 3, sy=60) * fbm(s, seed + 9, sigmas=(150, 60))
    col = srgb(color) * (0.93 + 0.1 * n[..., None])
    col = mix(col, srgb(color) * 0.55, np.clip(st * stains * 1.4, 0, 1))
    r = np.clip(rough + 0.08 * (n - 0.5), 0, 1)
    return save_set(name, col, r, normal_from_height(n * 0.6, 1.5))


def concrete(name, color=(0.58, 0.57, 0.54), size=512, seed=9):
    c = cached(name)
    if c:
        return c
    s = size
    n = fbm(s, seed, sigmas=(90, 40, 16, 6, 2))
    pores = np.clip((noise(s, 1.2, seed + 2) - 0.8) * 6, 0, 1)
    wet = np.clip((noise(s, 2.5, seed + 5, sy=90) - 0.4) * 1.6, 0, 1)
    col = srgb(color) * (0.85 + 0.25 * n[..., None]) * (1 - 0.35 * pores[..., None])
    col = col * (1 - 0.3 * wet[..., None] * fbm(s, seed + 6, sigmas=(100, 50))[..., None])
    r = np.clip(0.88 - 0.2 * wet, 0, 1)
    return save_set(name, col, r, normal_from_height(n * 0.5 - pores * 0.3, 2.0))


def metal(name, color=(0.78, 0.6, 0.3), size=512, seed=11, rough=0.32, tarnish=0.35):
    c = cached(name)
    if c:
        return c
    s = size
    n = fbm(s, seed, sigmas=(70, 30, 12, 4))
    scratches = np.clip((noise(s, 0.6, seed + 2, sy=40) - 0.75) * 6, 0, 1)
    col = srgb(color) * (0.88 + 0.22 * n[..., None])
    col = mix(col, srgb(color) * 0.45, np.clip((fbm(s, seed + 5) - 0.6) * 2, 0, 1) * tarnish)
    r = np.clip(rough + 0.25 * (n - 0.5) + 0.2 * scratches, 0.05, 1)
    return save_set(name, col, r, normal_from_height(n * 0.15 + scratches * 0.1, 1.0),
                    metal=np.ones((s, s)) * 0.95)


def ground(name, size=1024, seed=13, grass=(0.27, 0.36, 0.15), mud=(0.33, 0.25, 0.17)):
    c = cached(name)
    if c:
        return c
    s = size
    m = fbm(s, seed, sigmas=(160, 80, 40, 20))
    blades = noise(s, 0.7, seed + 1, sy=2.2)
    t = np.clip((m - 0.42) * 3.5, 0, 1)
    col = mix(srgb(mud) * (0.8 + 0.3 * blades[..., None]),
              srgb(grass) * (0.7 + 0.6 * blades[..., None]), t)
    col = col * (0.85 + 0.25 * fbm(s, seed + 7, sigmas=(60, 20, 6))[..., None])
    r = np.clip(0.9 - 0.15 * (1 - t), 0, 1)
    return save_set(name, col, r, normal_from_height(blades * t + m * 0.4, 3.0))


def cloth_floral(name, base=(0.18, 0.09, 0.12), petal=(0.72, 0.36, 0.22),
                 leaf=(0.24, 0.36, 0.22), dot=(0.85, 0.72, 0.42), size=1024, seed=17,
                 rep=4):
    """Sepra: a dark cotton cloth printed with a repeating flower motif."""
    c = cached(name)
    if c:
        return c
    s = size
    tile = s // rep
    img = Image.new("RGB", (tile, tile), tuple(int(x * 255) for x in base))
    d = ImageDraw.Draw(img)
    cx = cy = tile / 2

    def flower(x, y, r, col, n=6, rot=0.0):
        for k in range(n):
            a = rot + k * 2 * math.pi / n
            px, py = x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55
            d.ellipse([px - r * 0.42, py - r * 0.42, px + r * 0.42, py + r * 0.42],
                      fill=tuple(int(c * 255) for c in col))
        d.ellipse([x - r * 0.25, y - r * 0.25, x + r * 0.25, y + r * 0.25],
                  fill=tuple(int(c * 255) for c in dot))

    for (x, y, sc) in [(cx, cy, 1.0), (0, 0, 0.7), (tile, 0, 0.7), (0, tile, 0.7), (tile, tile, 0.7)]:
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            lx, ly = x + math.cos(a) * tile * 0.17 * sc, y + math.sin(a) * tile * 0.17 * sc
            d.ellipse([lx - tile * 0.07 * sc, ly - tile * 0.03 * sc, lx + tile * 0.07 * sc,
                       ly + tile * 0.03 * sc], fill=tuple(int(c * 255) for c in leaf))
        flower(x, y, tile * 0.16 * sc, petal, 6, 0.3)
    for (x, y) in [(cx, 0), (0, cy), (tile, cy), (cx, tile)]:
        flower(x, y, tile * 0.07, dot, 5, 0)
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    arr = np.asarray(img).astype(np.float32) / 255.0
    col = np.tile(arr, (rep, rep, 1))[:s, :s]
    weave = (np.sin(np.arange(s) * math.pi * 0.9)[None, :] * np.sin(np.arange(s) * math.pi * 0.9)[:, None])
    fade = fbm(s, seed, sigmas=(100, 40, 10))
    col = col * (0.88 + 0.08 * weave[..., None] + 0.1 * fade[..., None])
    r = np.clip(0.88 + 0.05 * weave, 0, 1)
    return save_set(name, col, r, normal_from_height(weave * 0.3 + fade * 0.4, 1.2))


def songket(name, base=(0.47, 0.03, 0.09), gold=(0.86, 0.66, 0.25), size=1024, seed=19, rep=4):
    """Songket-inspired weave: gold supplementary weft in diamond lattice on red."""
    c = cached(name)
    if c:
        return c
    s = size
    t = s // rep
    y, x = np.mgrid[0:t, 0:t] / t
    # diamond lattice + inner star (bunga) motif, original arrangement
    dx, dy = np.abs(x - 0.5), np.abs(y - 0.5)
    diamond = np.abs(dx + dy - 0.42) < 0.035
    inner = (dx + dy) < 0.14
    star = (np.minimum(dx, dy) < 0.022) & ((dx + dy) < 0.3)
    corner = ((x < 0.09) | (x > 0.91)) & ((y < 0.09) | (y > 0.91))
    band = (np.abs(y - 0.5) > 0.47)
    motif = diamond | inner | star | corner | band
    m = np.tile(motif, (rep, rep)).astype(np.float32)
    # weft float texture (horizontal threads)
    thread = 0.5 + 0.5 * np.sin(np.arange(s) * math.pi * 0.66)[:, None] * np.ones((1, s))
    col = mix(srgb(base) * (0.8 + 0.25 * thread[..., None]), srgb(gold) * (0.75 + 0.35 * thread[..., None]), m)
    metal = m * 0.85
    r = np.clip(0.75 - m * 0.4 + 0.08 * thread, 0, 1)
    h = m * 0.6 + thread * 0.25
    return save_set(name, col, r, normal_from_height(blur(h, 0.6), 3.0), metal=metal)


def ceramic(name, glaze=(0.93, 0.92, 0.88), ink=(0.16, 0.25, 0.52), size=1024, seed=23,
            rim=True):
    """Plate texture for planar top projection: centre at UV (0.5,0.5)."""
    c = cached(name)
    if c:
        return c
    s = size
    y, x = np.mgrid[0:s, 0:s] / s - 0.5
    rr = np.sqrt(x * x + y * y) * 2  # 0 centre .. 1 edge
    ang = np.arctan2(y, x)
    col = np.ones((s, s, 3)) * srgb(glaze)
    if rim:
        band = (rr > 0.78) & (rr < 0.93)
        wave = (np.sin(ang * 24) * 0.035 + 0.855)
        vine = np.abs(rr - wave) < 0.012
        petals = (np.abs(rr - 0.855) < 0.05) & (np.cos(ang * 24) > 0.86)
        line = (np.abs(rr - 0.765) < 0.006) | (np.abs(rr - 0.945) < 0.006)
        m = (vine | petals | line).astype(np.float32)
        m = blur(m, 0.8)
        col = mix(col, srgb(ink), np.clip(m * 1.4, 0, 1))
        _ = band
    n = fbm(s, seed, sigmas=(60, 20, 6))
    col = col * (0.97 + 0.04 * n[..., None])
    r = np.clip(0.12 + 0.06 * n, 0, 1)
    return save_set(name, col, r, normal_from_height(n * 0.05, 1.0))


def food(name, base, spec=0.35, size=512, seed=29, grains=0, grain_col=None,
         bumps=0.4, oil=0.0, char=0.0):
    """Generic food surface: sauces, rice, fried dough, meat."""
    c = cached(name)
    if c:
        return c
    s = size
    n = fbm(s, seed, sigmas=(40, 20, 10, 5, 2))
    col = srgb(base) * (0.8 + 0.35 * n[..., None])
    h = n * bumps
    if grains:
        rng = np.random.default_rng(seed)
        img = Image.new("L", (s, s), 0)
        d = ImageDraw.Draw(img)
        gl = s / grains
        for _ in range(grains * grains * 3):
            x, y = rng.uniform(0, s, 2)
            a = rng.uniform(0, math.pi)
            dx, dy = math.cos(a) * gl * 0.55, math.sin(a) * gl * 0.55
            d.line([x - dx, y - dy, x + dx, y + dy], fill=int(rng.uniform(140, 255)),
                   width=max(2, int(gl * 0.36)))
        g = np.asarray(img.filter(ImageFilter.GaussianBlur(gl * 0.12))).astype(np.float32) / 255
        gc = srgb(grain_col if grain_col else base)
        col = mix(col * 0.75, gc * (0.85 + 0.25 * n[..., None]), g)
        h = h + g * 0.9
    if char:
        ch = np.clip((fbm(s, seed + 3, sigmas=(20, 8, 3)) - (1 - char)) * 4, 0, 1)
        col = mix(col, col * 0.45, ch)
    if oil:
        sp = np.clip((noise(s, 2.0, seed + 9) - 0.62) * 6, 0, 1) * oil
        col = col * (1 + 0.25 * sp[..., None])
    r = np.clip(spec + 0.25 * (1 - n) - oil * 0.2, 0.04, 1)
    return save_set(name, col, r, normal_from_height(h, 3.0))


def frond(name, size=512, seed=31, color=(0.3, 0.45, 0.16), dry=(0.55, 0.47, 0.25)):
    """Palm leaflet card with alpha: a pinnate leaf seen flat (u along rachis)."""
    c = cached(name, keys=("c", "r", "n"))
    if c:
        return c
    s = size
    y, x = np.mgrid[0:s, 0:s] / s
    rng = np.random.default_rng(seed)
    alpha = np.zeros((s, s), np.float32)
    col = np.zeros((s, s, 3), np.float32)
    n_leaf = 32
    for i in range(n_leaf):
        t = (i + 0.5) / n_leaf
        for side in (-1, 1):
            # leaflet as a thin ellipse angled away from the midrib (y=0.5)
            ang = math.radians(rng.uniform(38, 55)) * side
            L = 0.42 * (1 - abs(t - 0.45) * 0.9) * rng.uniform(0.85, 1.05)
            W = 0.03 * (1 - t * 0.4)
            cxl, cyl = t + math.sin(ang) * L * 0.0, 0.5 + side * L * 0.5 * math.cos(abs(ang))
            ux = (x - (t + side * 0 + L * 0.5 * math.sin(abs(ang)) * 0.6))
            uy = (y - cyl)
            ca, sa = math.cos(ang), math.sin(ang)
            px = ux * ca + uy * sa
            py = -ux * sa + uy * ca
            e = (px / W) ** 2 + (py / (L * 0.5)) ** 2
            m = np.clip((1 - e) * 4, 0, 1)
            alpha = np.maximum(alpha, m)
            tint = rng.uniform(0.85, 1.1)
            dd = np.clip((abs(t - 0.9) < 0.1) * rng.uniform(0, 1) * 0.0, 0, 1)
            lc = srgb(color) * tint * (0.8 + 0.4 * np.clip(0.5 + px / W * 0.5, 0, 1))[..., None]
            col = np.where(m[..., None] > 0.01, mix(lc, srgb(dry), dd), col)
    rib = np.clip(1 - np.abs(y - 0.5) / 0.012, 0, 1)
    alpha = np.maximum(alpha, rib * (x < 0.98))
    col = mix(col, srgb((0.52, 0.5, 0.3)), rib)
    r = np.full((s, s), 0.55)
    return save_set(name, col, r, normal_from_height(alpha * 0.3, 2.0), alpha=alpha)


def thatch(name, color=(0.58, 0.47, 0.3), size=512, seed=37, rows=8):
    """Atap nipah/rumbia: overlapping rows of dried palm leaves."""
    c = cached(name)
    if c:
        return c
    s = size
    v = np.linspace(0, 1, s, endpoint=False)[:, None] * np.ones((1, s))
    strands = noise(s, 0.5, seed, sy=18)
    fv = (v * rows) % 1.0
    lap = fv ** 0.8
    h = strands * 0.6 + lap * 0.6 - np.clip(1 - fv / 0.05, 0, 1)
    dark = fbm(s, seed + 3, sigmas=(90, 40, 12))
    col = srgb(color) * (0.65 + 0.5 * strands[..., None]) * (0.75 + 0.35 * lap[..., None])
    col = mix(col, srgb((0.3, 0.26, 0.2)), np.clip(dark - 0.45, 0, 1) * 1.2)
    r = np.full((s, s), 0.9)
    return save_set(name, col, r, normal_from_height(h, 4.0))


def bamboo(name, size=512, seed=41, color=(0.68, 0.6, 0.33)):
    c = cached(name)
    if c:
        return c
    s = size
    u = np.ones((s, 1)) * np.linspace(0, 1, s, endpoint=False)[None, :]
    fib = noise(s, 40, seed, sy=0.6)
    node = np.clip(1 - np.abs(((u * 3) % 1.0) - 0.5) / 0.02, 0, 1)
    col = srgb(color) * (0.85 + 0.25 * fib[..., None])
    col = mix(col, srgb((0.45, 0.38, 0.2)), node)
    r = np.clip(0.45 + 0.2 * fib + 0.2 * node, 0, 1)
    return save_set(name, col, r, normal_from_height(fib * 0.2 + node * 0.8, 3.0))


def paper(name, color=(0.86, 0.79, 0.62), size=512, seed=43):
    c = cached(name)
    if c:
        return c
    s = size
    n = fbm(s, seed, sigmas=(120, 50, 20, 6, 2))
    fibers = noise(s, 0.6, seed + 2, sy=3)
    col = srgb(color) * (0.9 + 0.12 * n[..., None]) - 0.05 * fibers[..., None]
    edge = fbm(s, seed + 4, sigmas=(30, 10))
    col = mix(col, srgb((0.55, 0.42, 0.25)), np.clip((edge - 0.7) * 1.5, 0, 1) * 0.6)
    r = np.full((s, s), 0.92)
    return save_set(name, col, r, normal_from_height(n * 0.2 + fibers * 0.1, 1.0))


def leather(name, color=(0.33, 0.13, 0.08), size=512, seed=47):
    c = cached(name)
    if c:
        return c
    s = size
    cells = noise(s, 2.2, seed)
    n = fbm(s, seed + 1, sigmas=(80, 30, 10))
    grain = np.abs(cells - 0.5) * 2
    col = srgb(color) * (0.75 + 0.35 * n[..., None]) * (0.85 + 0.2 * grain[..., None])
    r = np.clip(0.55 + 0.2 * grain, 0, 1)
    return save_set(name, col, r, normal_from_height(grain * 0.4, 2.5))


def fish_skin(name, size=512, seed=53, back=(0.28, 0.33, 0.36), belly=(0.82, 0.83, 0.8)):
    """Side of a fish, u along body, v from back (1) to belly (0)."""
    c = cached(name)
    if c:
        return c
    s = size
    y, x = np.mgrid[0:s, 0:s] / s
    vb = 1 - y
    scales_u = (x * 40) % 1.0
    scales_v = (y * 18 + (np.floor(x * 40) % 2) * 0.5) % 1.0
    sc = np.sqrt((scales_u - 0.5) ** 2 + (scales_v - 0.5) ** 2)
    h = np.clip(1 - sc * 2, 0, 1)
    t = np.clip((vb - 0.35) * 2.4, 0, 1)
    col = mix(srgb(belly), srgb(back), t) * (0.8 + 0.3 * h[..., None])
    r = np.clip(0.25 + 0.2 * (1 - h), 0, 1)
    return save_set(name, col, r, normal_from_height(h * 0.4, 2.0), metal=np.full((s, s), 0.25))


def asphalt(name, size=512, seed=59):
    c = cached(name)
    if c:
        return c
    s = size
    n = fbm(s, seed, sigmas=(60, 20, 5, 1.5))
    agg = np.clip((noise(s, 0.9, seed + 1) - 0.6) * 4, 0, 1)
    col = np.ones((s, s, 3)) * (0.13 + 0.08 * n[..., None] + 0.08 * agg[..., None])
    r = np.clip(0.85 - 0.15 * agg, 0, 1)
    return save_set(name, col, r, normal_from_height(n * 0.3 + agg * 0.3, 2.0))


def stucco_trim(name, color, size=256, seed=61):
    """Plain painted trim with a subtle brush texture (gold, green, white)."""
    return painted(name, color, size=size, seed=seed, rough=0.45, wear=0.04, streaks=0.1)


def woven(name, a=(0.72, 0.6, 0.38), b=(0.55, 0.42, 0.24), size=512, seed=67, strips=16,
          border=None):
    """Tikar: pandan strips woven over-under at 45 degrees."""
    c = cached(name)
    if c:
        return c
    s = size
    y, x = np.mgrid[0:s, 0:s] / s
    u = (x + y) * strips / 2
    v = (x - y) * strips / 2
    iu, iv = np.floor(u), np.floor(v)
    over = ((iu + iv) % 2 == 0)
    fu, fv = u % 1.0, v % 1.0
    ridge = np.where(over, np.sin(fu * math.pi), np.sin(fv * math.pi))
    col = np.where(over[..., None], srgb(a), srgb(b)) * (0.75 + 0.35 * ridge[..., None])
    n = fbm(s, seed, sigmas=(60, 20, 6))
    col = col * (0.9 + 0.15 * n[..., None])
    if border is not None:
        bb = (np.minimum(np.minimum(x, 1 - x), np.minimum(y, 1 - y)) < 0.04)
        col = np.where(bb[..., None], srgb(border) * (0.8 + 0.3 * ridge[..., None]), col)
    r = np.clip(0.75 + 0.1 * ridge, 0, 1)
    return save_set(name, col, r, normal_from_height(ridge * 0.6 + n * 0.2, 2.5))
