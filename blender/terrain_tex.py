"""Tileable maps for the web scene: river banks, water ripples and foam.

Pure numpy (no Blender needed). Writes PNGs into blender/textures with the
same naming as lib/tex.py, then scripts/web-textures.mjs converts them to
WebP for public/textures.
"""
from __future__ import annotations

import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import tex  # noqa: E402
from tex import blur, fbm, mix, noise, norm, normal_from_height, save_set, srgb  # noqa: E402


def rumput(size=1024, seed=211):
    """Short riverside grass with a few worn dirt patches."""
    s = size
    patches = fbm(s, seed, sigmas=(200, 100, 50, 25))
    tufts = fbm(s, seed + 6, sigmas=(10, 5, 2.5))
    blades = noise(s, 0.55, seed + 1, sy=2.8)
    blades2 = noise(s, 0.8, seed + 2, sy=0.45)
    dry = fbm(s, seed + 3, sigmas=(140, 70, 35))
    t = np.clip((patches - 0.1) * 4.5, 0, 1)  # 1 = grass, 0 = dirt (rare)
    green = mix(srgb((0.24, 0.33, 0.1)), srgb((0.47, 0.5, 0.19)), dry * 0.8 + tufts * 0.2)
    shade = 0.45 + 0.75 * (0.45 * blades + 0.25 * blades2 + 0.3 * tufts)
    green = green * shade[..., None]
    dirt = srgb((0.35, 0.28, 0.19)) * (0.75 + 0.4 * fbm(s, seed + 4, sigmas=(24, 8, 3))[..., None])
    col = mix(dirt, green, t)
    col = col * (0.93 + 0.12 * fbm(s, seed + 7, sigmas=(70, 20, 6))[..., None])
    rough = np.clip(0.84 + 0.1 * blades - 0.04 * (1 - t), 0, 1)
    h = (blades * 0.7 + tufts * 0.6) * t + (1 - t) * fbm(s, seed + 5, sigmas=(6, 3, 1.5)) * 0.5
    return save_set("rumput", col, rough, normal_from_height(h, 7.0))


def lumpur(size=1024, seed=223):
    """Wet river mud: dark where it stays wet, pale cracked crust higher up."""
    s = size
    base = fbm(s, seed, sigmas=(150, 70, 35, 16, 8))
    crust = fbm(s, seed + 1, sigmas=(40, 20, 10, 5))
    cracks = np.abs(noise(s, 9, seed + 2) - 0.5) < 0.018
    cracks = blur(cracks.astype(np.float32), 0.8)
    peb = noise(s, 1.6, seed + 3)
    pebbles = np.clip((peb - 0.83) * 9.0, 0, 1)
    wet = np.clip((base - 0.38) * 2.5, 0, 1)
    dark = srgb((0.17, 0.14, 0.11))
    pale = srgb((0.42, 0.35, 0.26))
    col = mix(pale * (0.85 + 0.3 * crust[..., None]), dark * (0.9 + 0.2 * crust[..., None]), wet)
    col = col * (1 - 0.35 * cracks[..., None] * (1 - wet[..., None]))
    col = mix(col, srgb((0.48, 0.44, 0.38)), pebbles * 0.8)
    rough = np.clip(0.88 - 0.62 * wet + 0.1 * pebbles, 0.12, 1)
    h = crust * 0.5 - cracks * 0.6 * (1 - wet) + pebbles * 0.9 + base * 0.3
    return save_set("lumpur", col, rough, normal_from_height(h, 3.6))


def air(size=512, seed=229):
    """Ripple normal map from an integer-wavenumber spectrum, so it tiles."""
    s = size
    rng = np.random.default_rng(seed)
    u = np.arange(s)[None, :] / s
    v = np.arange(s)[:, None] / s
    dhdu = np.zeros((s, s), np.float64)
    dhdv = np.zeros((s, s), np.float64)
    count = 0
    for kx in range(-14, 15):
        for ky in range(-14, 15):
            k = math.hypot(kx, ky)
            if k < 1.5:
                continue
            # wind roughly along +u: favour waves aligned with it
            align = abs(kx) / k
            amp = (k ** -1.9) * (0.35 + 0.65 * align ** 2) * rng.uniform(0.6, 1.4)
            ph = rng.uniform(0, 2 * math.pi)
            arg = 2 * math.pi * (kx * u + ky * v) + ph
            sn = np.sin(arg)
            dhdu += -amp * 2 * math.pi * kx * sn
            dhdv += -amp * 2 * math.pi * ky * sn
            count += 1
    fine = fbm(s, seed + 1, sigmas=(3, 1.6, 0.8))
    fx = (np.roll(fine, -1, 1) - np.roll(fine, 1, 1)) * s * 0.02
    fy = (np.roll(fine, 1, 0) - np.roll(fine, -1, 0)) * s * 0.02
    sc = 0.06
    n = np.stack([-(dhdu * sc + fx), -(dhdv * sc + fy), np.ones((s, s))], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    path = os.path.join(tex.TEX_DIR, "air_n.png")
    tex._save((n * 0.5 + 0.5).astype(np.float32), path)
    print("air", count, "waves")
    return path


def busa(size=256, seed=233):
    """Foam: R = clumpy foam cells, G = soft streak noise, B = fine speckle."""
    s = size
    a = noise(s, 2.2, seed)
    b = noise(s, 5.0, seed + 1)
    cells = np.clip((np.maximum(a, b) - 0.55) * 3.0, 0, 1)
    streak = noise(s, 1.2, seed + 2, sy=9.0)
    speck = np.clip((noise(s, 0.7, seed + 3) - 0.62) * 4.0, 0, 1)
    rgb = np.stack([norm(cells), streak, speck], -1).astype(np.float32)
    path = os.path.join(tex.TEX_DIR, "busa_c.png")
    tex._save(rgb, path)
    return path


if __name__ == "__main__":
    rumput()
    lumpur()
    air()
    busa()
    print("ok")
