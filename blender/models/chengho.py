"""Masjid Al-Islam Muhammad Cheng Ho Sriwijaya, Jakabaring (interpretive model).

Built from published descriptions: a square two-storey hall of about 20 x 20 m
with red pillars, arched openings and a green dome with crescent and star;
limas roofs on the four corners; twin red octagonal five-tier pagoda
minarets of about 17 m topped by a watermelon finial, with tanduk kambing
ornaments; a klenteng-like gate. Each part is tagged with the cultural root
it is usually attributed to (tm_layer) for the site's "tiga akar" view."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
import core  # noqa: E402
import orn  # noqa: E402
import tex  # noqa: E402
from core import V  # noqa: E402
from mats import M  # noqa: E402

T, A, P, B = "tionghoa", "arab", "palembang", "dasar"
OBJS = []


def put(name, bm, material, layer, uv=None, smooth=None, keep_uv=False, **props):
    ob = core.obj(name, bm, material, smooth=smooth, uv=uv, keep_uv=keep_uv,
                  props={"tm_layer": layer, **props})
    OBJS.append(ob)
    return ob


def mats():
    return {
        "wall": M("plaster_pink"), "white": M("plaster_white"), "red": M("red_lacquer"),
        "jade": M("jade"), "gold": M("gold"), "dome": M("green_dome"), "dark": M("glass_dark"),
        "green_tile": M("roof_green"), "terracotta": M("roof_tile"), "stone": core.mat(
            "batu_lantai", tex.tiles("batu_lantai", color=(0.62, 0.6, 0.55), rows=8, cols=8,
                                     curved=False, seed=71), rough=0.7),
        "orn": core.mat("ornamen_hijau", tex.songket("ornamen_hijau", base=(0.06, 0.3, 0.2),
                                                     gold=(0.86, 0.66, 0.25), seed=73), rough=0.5),
        "melon": core.mat("semangka", melon_tex(), rough=0.35),
    }


def melon_tex():
    c = tex.cached("semangka")
    if c:
        return c
    s = 512
    u = np.linspace(0, 1, s, endpoint=False)[None, :] * np.ones((s, 1))
    wob = tex.noise(s, 6, 3, sy=20) * 0.08
    stripe = (np.sin((u + wob) * math.tau * 10) > 0.25).astype(np.float32)
    col = tex.mix(tex.srgb((0.36, 0.6, 0.22)), tex.srgb((0.08, 0.28, 0.1)), tex.blur(stripe, 2))
    r = np.full((s, s), 0.35)
    return tex.save_set("semangka", col, r, tex.normal_from_height(tex.blur(stripe, 3) * 0.3, 2.0))


def plinth(m):
    bm = core.bm_box(27.0, 30.0, 1.2, bevel=0.06)
    core.bm_xform(bm, loc=(0, -2.5, 0.6))
    put("lantai_dasar", bm, m["white"], B, uv=("box", 3.0))
    for i in range(4):
        bm = core.bm_box(9.0, 0.45, 0.3 * (4 - i))
        core.bm_xform(bm, loc=(0, -17.5 - 0.45 * i + 0.25, 0.15 * (4 - i)))
        put(f"tangga{i}", bm, m["white"], B, uv=("box", 2.0))
    bm = core.bm_box(40.0, 52.0, 0.12)
    core.bm_xform(bm, loc=(0, -10, 0.06))
    put("halaman", bm, m["stone"], B, uv=("box", 3.0))


def walls(m):
    for (z0, z1) in ((1.2, 6.2), (6.8, 11.2)):
        bm = core.bm_box(20.0, 20.0, z1 - z0)
        core.bm_xform(bm, loc=(0, 0, (z0 + z1) / 2))
        put(f"dinding{z0:.0f}", bm, m["wall"], B, uv=("box", 4.0))
    bm = core.bm_box(20.6, 20.6, 0.6, bevel=0.05)
    core.bm_xform(bm, loc=(0, 0, 6.5))
    put("lis_tengah", bm, m["white"], B, uv=("box", 2.0))
    # roof slab and parapet
    bm = core.bm_box(20.8, 20.8, 0.5, bevel=0.05)
    core.bm_xform(bm, loc=(0, 0, 11.45))
    put("atap_datar", bm, m["white"], B, uv=("box", 3.0))
    par = []
    for s in (-1, 1):
        for horiz in (True, False):
            bm = core.bm_box(20.8 if horiz else 0.3, 0.3 if horiz else 20.8, 0.9)
            core.bm_xform(bm, loc=(0, s * 10.25, 12.15) if horiz else (s * 10.25, 0, 12.15))
            par.append(bm)
    put("pagar_atap", core.bm_merge(*par), m["wall"], B, uv=("box", 2.0))
    # red pillars (corners + front pilasters) with gold capitals
    pil, cap = [], []
    for x, y, w in [(-10, -10, 1.1), (10, -10, 1.1), (-10, 10, 1.1), (10, 10, 1.1),
                    (-5, -10.25, 0.7), (5, -10.25, 0.7), (-10.25, 0, 0.7), (10.25, 0, 0.7),
                    (-5, 10.25, 0.7), (5, 10.25, 0.7), (0, 10.25, 0.7)]:
        bm = core.bm_box(w, w, 11.4, bevel=0.04)
        core.bm_xform(bm, loc=(x, y, 1.2 + 5.7))
        pil.append(bm)
        for z in (6.05, 11.05):
            bm = core.bm_box(w + 0.25, w + 0.25, 0.3, bevel=0.04)
            core.bm_xform(bm, loc=(x, y, z))
            cap.append(bm)
    put("pilar_merah", core.bm_merge(*pil), m["red"], T, uv=("box", 2.0), part="pilar")
    put("kepala_pilar", core.bm_merge(*cap), m["gold"], T, uv=("box", 1.0), part="pilar")


def windows(m):
    recs, frames = [], []

    def add(x, y, z, w, h, face):
        rec, fr = orn.arch_window(w, h, depth=0.1, frame=0.16)
        rot = {"S": 0, "N": math.pi, "E": math.pi / 2, "W": -math.pi / 2}[face]
        for b in (rec, fr):
            core.bm_xform(b, rot=(0, 0, rot), loc=(x, y, z))
        recs.append(rec)
        frames.append(fr)
    for face, (ax, sgn) in {"S": ("x", -1), "N": ("x", 1), "E": ("y", 1), "W": ("y", -1)}.items():
        off = 10.06
        for along in (-7.5, -2.5, 2.5, 7.5):
            if face == "S" and abs(along) < 3:
                continue
            for (z, w, h) in ((2.0, 1.6, 3.1), (7.4, 1.5, 2.7)):
                if ax == "x":
                    add(along, sgn * off, z, w, h, face)
                else:
                    add(sgn * off, along, z, w, h, face)
    # main door and upper central window on the front
    add(0, -10.08, 1.2, 3.2, 4.2, "S")
    add(0, -10.06, 7.4, 2.0, 2.9, "S")
    put("lengkung_gelap", core.bm_merge(*recs), m["dark"], A, part="lengkung")
    put("bingkai_lengkung", core.bm_merge(*frames), m["white"], A, uv=("box", 1.0), part="lengkung")
    # geometric ornament panel above the door
    bm = core.bm_box(6.6, 0.12, 0.85)
    core.uv_planar(bm, 3.3, axis="y")
    core.bm_xform(bm, loc=(0, -10.12, 10.55))
    put("panel_ornamen", bm, m["orn"], A, keep_uv=True, part="ornamen")


def skirt(m):
    r_in = 10.3 * math.sqrt(2)
    r_out = 12.4 * math.sqrt(2)
    bm = orn.eave_roof(r_in, r_out, 1.1, sides=4, curve=1.5, upturn=0.75, thick=0.14, nr=8)
    core.bm_xform(bm, loc=(0, 0, 6.05))
    put("atap_selendang", bm, m["green_tile"], T, keep_uv=True, smooth=40, part="atap")
    bm = orn.eave_ridges(r_in, r_out, 1.1, sides=4, curve=1.5, upturn=0.75, radius=0.09)
    core.bm_xform(bm, loc=(0, 0, 6.05))
    put("bubungan_selendang", bm, m["gold"], T, smooth=50, part="atap")


def dome(m):
    # octagonal drum
    bm = core.bm_cyl(4.4, 4.4, 2.0, seg=8)
    core.bm_xform(bm, rot=(0, 0, math.pi / 8), loc=(0, 0, 12.7))
    put("tambur_kubah", bm, m["jade"], A, uv=("box", 2.0), part="kubah")
    rec, fr = [], []
    for k in range(8):
        a = k * math.tau / 8
        r, f = orn.arch_window(0.9, 1.3, depth=0.08, frame=0.1, sill=False)
        for b in (r, f):
            core.bm_xform(b, loc=(0, -4.07, 12.05))
            core.bm_xform(b, rot=(0, 0, a))
        rec.append(r)
        fr.append(f)
    put("jendela_tambur", core.bm_merge(*rec), m["dark"], A, part="kubah")
    put("bingkai_tambur", core.bm_merge(*fr), m["gold"], A, part="kubah")
    prof = [(4.25, 0.0), (4.35, 0.5), (4.2, 1.5), (3.7, 2.5), (2.8, 3.4), (1.7, 4.05), (0.7, 4.45),
            (0.15, 4.62), (0.0, 4.66)]
    bm = core.bm_lathe(prof, seg=48)
    core.uv_cyl(bm, 1.7, 4.6)
    core.bm_xform(bm, loc=(0, 0, 13.7))
    put("kubah", bm, m["dome"], A, smooth=60, keep_uv=True, part="kubah")
    bm = core.bm_cyl(4.45, 4.45, 0.35, seg=48)
    core.bm_xform(bm, loc=(0, 0, 13.8))
    put("cincin_kubah", bm, m["gold"], A, smooth=40, part="kubah")
    # finial: rod, bulbs, crescent and star
    fin = [core.bm_xform(core.bm_cyl(0.07, 0.05, 2.2, 12), loc=(0, 0, 19.3))]
    for z, r in ((18.55, 0.32), (19.35, 0.2)):
        fin.append(core.bm_xform(core.bm_sphere(r, 16, 10), loc=(0, 0, z)))
    cres = []
    for i in range(23):
        a = math.radians(-125 + 250 * i / 22)
        cres.append((0, math.cos(a) * 0.62, 20.6 + math.sin(a) * 0.62))
    fin.append(core.bm_tube(cres, 0.09, seg=8, radii=[0.03 + 0.09 * math.sin(math.pi * i / 22) for i in range(23)]))
    star = []
    for k in range(10):
        a = math.pi / 2 + k * math.pi / 5
        r = 0.3 if k % 2 == 0 else 0.13
        star.append((math.cos(a) * r, math.sin(a) * r))
    st = core.bm_prism(star, 0.06, center_z=True)
    core.bm_xform(st, rot=(math.pi / 2, 0, math.pi / 2), loc=(0, 0.1, 20.6))
    fin.append(st)
    put("mustaka_bulan_bintang", core.bm_merge(*fin), m["gold"], A, smooth=45, part="kubah")


def corner_pavilions(m):
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * 7.7, sy * 7.7
            bm = core.bm_box(3.6, 3.6, 2.2)
            core.bm_xform(bm, loc=(x, y, 11.7 + 1.1))
            put(f"bilik{sx}{sy}", bm, m["wall"], P, uv=("box", 2.0), part="limas")
            rf = orn.hip_roof(3.6, 3.6, 2.5, overhang=0.55, concave=0.25, thick=0.1, flat_top=0.0)
            core.bm_xform(rf, loc=(x, y, 13.8))
            put(f"atap_limas{sx}{sy}", rf, m["terracotta"], P, keep_uv=True, smooth=35, part="limas")
            rd = orn.hip_ridges(3.6, 3.6, 2.5, overhang=0.55, radius=0.05)
            core.bm_xform(rd, loc=(x, y, 13.8))
            put(f"bubungan_limas{sx}{sy}", rd, m["gold"], P, smooth=50, part="limas")
            sb = orn.simbar(0.75, 0.28, 0.045)
            core.bm_xform(sb, rot=(0, 0, math.atan2(y, x) + math.pi / 2), loc=(x, y, 16.25))
            put(f"simbar{sx}{sy}", sb, m["gold"], P, smooth=50, part="tanduk")


def minaret(m, x, y, tag):
    apothems = [1.6, 1.45, 1.3, 1.15, 1.0]
    heights = [4.0, 3.1, 2.7, 2.4, 2.1]
    z = 1.2
    bm = core.bm_cyl(2.2 / math.cos(math.pi / 8), 2.2 / math.cos(math.pi / 8), 0.8, seg=8)
    core.bm_xform(bm, rot=(0, 0, math.pi / 8), loc=(x, y, z + 0.4))
    put(f"alas_menara{tag}", bm, m["white"], T, uv=("box", 2.0), part="menara")
    z += 0.8
    shafts, eaves, ridges, gold, wins = [], [], [], [], []
    for i, (ap, h) in enumerate(zip(apothems, heights)):
        R = ap / math.cos(math.pi / 8)
        bm = core.bm_cyl(R, R, h, seg=8)
        core.bm_xform(bm, rot=(0, 0, math.pi / 8), loc=(x, y, z + h / 2))
        shafts.append(bm)
        bm = core.bm_cyl(R + 0.08, R + 0.08, 0.22, seg=8)
        core.bm_xform(bm, rot=(0, 0, math.pi / 8), loc=(x, y, z + h - 0.2))
        gold.append(bm)
        for k in range(4):
            a = k * math.pi / 2 + (math.pi / 4 if i % 2 else 0)
            rec, fr = orn.arch_window(0.5, 0.95, depth=0.06, frame=0.08, sill=False)
            for b in (rec, fr):
                core.bm_xform(b, loc=(0, -ap - 0.02, z + h * 0.3))
                core.bm_xform(b, rot=(0, 0, a))
                core.bm_xform(b, loc=(x, y, 0))
            wins.append(rec)
            gold.append(fr)
        r_in, r_out = R * 0.98, R + 0.95 - i * 0.08
        hh = 0.75 - i * 0.05
        ev = orn.eave_roof(r_in, r_out, hh, sides=8, curve=1.6, upturn=0.42, thick=0.09, nr=6)
        core.bm_xform(ev, loc=(x, y, z + h - 0.05))
        eaves.append(ev)
        rd = orn.eave_ridges(r_in, r_out, hh, sides=8, curve=1.6, upturn=0.42, radius=0.05, lift=0.06)
        core.bm_xform(rd, loc=(x, y, z + h - 0.05))
        ridges.append(rd)
        if i == 0:  # tanduk kambing on the outer corners of the first eave
            horns = []
            for k in range(8):
                th = math.pi / 8 + k * math.tau / 8
                rr = r_out + 0.25
                sb = orn.simbar(0.55, 0.16, 0.035)
                core.bm_xform(sb, rot=(0, 0, th + math.pi / 2),
                              loc=(x + math.cos(th) * rr, y + math.sin(th) * rr, z + h + 0.38))
                horns.append(sb)
            put(f"tanduk_menara{tag}", core.bm_merge(*horns), m["gold"], P, smooth=50, part="tanduk")
        z += h
    put(f"menara{tag}", core.bm_merge(*shafts), m["red"], T, uv=("box", 2.0), part="menara")
    put(f"atap_menara{tag}", core.bm_merge(*eaves), m["green_tile"], T, keep_uv=True, smooth=40, part="menara")
    put(f"bubungan_menara{tag}", core.bm_merge(*ridges), m["gold"], T, smooth=50, part="menara")
    put(f"emas_menara{tag}", core.bm_merge(*gold), m["gold"], T, uv=("box", 1.0), part="menara")
    put(f"jendela_menara{tag}", core.bm_merge(*wins), m["dark"], T, part="menara")
    bm = core.bm_sphere(0.62, 24, 14)
    core.uv_cyl(bm, 0.4, 1.2)
    core.bm_xform(bm, scale=(1, 1, 0.9), loc=(x, y, z + 0.75))
    put(f"semangka{tag}", bm, m["melon"], T, keep_uv=True, smooth=60, part="menara")
    bm = core.bm_cyl(0.08, 0.01, 1.4, 10)
    core.bm_xform(bm, loc=(x, y, z + 1.9))
    put(f"puncak_menara{tag}", bm, m["gold"], T, smooth=45, part="menara")
    return z


def gate(m):
    y = -24.0
    pil, gold = [], []
    for x in (-5.4, -2.5, 2.5, 5.4):
        bm = core.bm_box(0.7, 0.7, 5.0, bevel=0.05)
        core.bm_xform(bm, loc=(x, y, 2.6))
        pil.append(bm)
        bm = core.bm_box(1.0, 1.0, 0.5, bevel=0.05)
        core.bm_xform(bm, loc=(x, y, 0.35))
        gold.append(bm)
    bm = core.bm_box(12.0, 0.9, 0.7, bevel=0.05)
    core.bm_xform(bm, loc=(0, y, 5.3))
    pil.append(bm)
    bm = core.bm_box(3.0, 0.12, 1.0)
    core.bm_xform(bm, loc=(0, y - 0.5, 4.35))
    gold.append(bm)
    put("tiang_gapura", core.bm_merge(*pil), m["red"], T, uv=("box", 2.0), part="gapura")
    put("emas_gapura", core.bm_merge(*gold), m["gold"], T, uv=("box", 1.0), part="gapura")
    for (zz, w, d, h, up) in ((5.55, 13.5, 3.2, 1.2, 0.7), (7.2, 7.2, 2.6, 1.15, 0.6)):
        if zz > 6:
            bm = core.bm_box(5.4, 1.2, 1.2)
            core.bm_xform(bm, loc=(0, y, zz - 0.5))
            put("leher_gapura", bm, m["red"], T, uv=("box", 2.0), part="gapura")
        sxf = w / d
        r_in = 0.35 * math.sqrt(2)
        r_out = (d / 2) * math.sqrt(2)
        ev = orn.eave_roof(r_in, r_out, h, sides=4, curve=1.4, upturn=up, thick=0.1, nr=8,
                           sx=sxf, sy=1.0)
        core.bm_xform(ev, loc=(0, y, zz))
        put(f"atap_gapura{zz:.0f}", ev, m["green_tile"], T, keep_uv=True, smooth=40, part="gapura")
        rd = orn.eave_ridges(r_in, r_out, h, sides=4, curve=1.4, upturn=up, sx=sxf, radius=0.07)
        core.bm_xform(rd, loc=(0, y, zz))
        put(f"bubungan_gapura{zz:.0f}", rd, m["gold"], T, smooth=50, part="gapura")
        bm = core.bm_tube([(-w / 2 * 0.62, y, zz + h + 0.05), (w / 2 * 0.62, y, zz + h + 0.05)], 0.12, seg=8)
        put(f"bubung_gapura{zz:.0f}", bm, m["gold"], T, smooth=50, part="gapura")


def main(render=True):
    core.reset()
    core.use_collection("chengho")
    m = mats()
    plinth(m)
    walls(m)
    windows(m)
    skirt(m)
    dome(m)
    corner_pavilions(m)
    for sx in (-1, 1):
        minaret(m, sx * 12.2, -13.2, "kanan" if sx > 0 else "kiri")
    gate(m)
    # merge by (layer, part, material)
    groups = {}
    for o in OBJS:
        key = (o.get("tm_layer"), o.get("part", ""), o.data.materials[0].name)
        groups.setdefault(key, []).append(o)
    final = []
    for (layer, part, mname), objs in groups.items():
        props = {"tm_layer": layer}
        if part:
            props["tm_part"] = part
        final.append(core.merge_objects(objs, f"chengho_{layer}_{part or 'x'}_{mname}", props))
    core.export_glb("chengho", final)
    if render:
        core.setup_world(sun_elev=32, sun_rot=200)
        core.add_sun(elev=32, azim=200, energy=3.4)
        core.add_camera((-34, -62, 16), (0, -6, 8), lens=42)
        core.render("chengho", 1100, 700, samples=40,
                    ground_mat=core.flat("_rumput", (0.2, 0.28, 0.1), 0.9))


if __name__ == "__main__":
    main(render="--norender" not in sys.argv)
