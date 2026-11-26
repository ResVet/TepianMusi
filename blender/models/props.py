"""Riverbank props for instancing: wooden pier with an enamel sign and lamp,
palms, nipah, shade trees, bushes, plain stilt houses, floating houses and an
egret. Each is its own GLB so the site can instance it many times."""
import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
import core  # noqa: E402
import houses  # noqa: E402
import tex  # noqa: E402
from core import V  # noqa: E402
from mats import M  # noqa: E402


def canopy_tex():
    c = tex.cached("daun_rimbun")
    if c:
        return c
    s = 512
    rng = np.random.default_rng(5)
    from PIL import Image, ImageDraw, ImageFilter
    img = Image.new("RGB", (s, s), (30, 52, 22))
    hmap = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(img)
    dh = ImageDraw.Draw(hmap)
    for _ in range(2600):
        x, y = rng.uniform(0, s, 2)
        a = rng.uniform(0, math.pi)
        L = rng.uniform(10, 22)
        w = L * 0.42
        g = rng.uniform(0.6, 1.25)
        col = (int(45 * g), int(88 * g), int(30 * g))
        pts = []
        for k in range(10):
            t = k / 9 * math.tau
            px = math.cos(t) * L / 2
            py = math.sin(t) * w / 2
            pts.append((x + px * math.cos(a) - py * math.sin(a), y + px * math.sin(a) + py * math.cos(a)))
        d.polygon(pts, fill=col)
        dh.polygon(pts, fill=int(120 + 120 * rng.random()))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    col = np.asarray(img).astype(np.float32) / 255
    h = np.asarray(hmap.filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32) / 255
    r = np.full((s, s), 0.7)
    return tex.save_set("daun_rimbun", col, r, tex.normal_from_height(h, 3.0))


def export_alone(name, builder):
    core.reset()
    core.use_collection(name)
    objs = builder()
    by = {}
    special = []
    for o in objs:
        if o.get("tm") or o.get("tm_glow"):
            special.append(o)
            continue
        by.setdefault(o.data.materials[0].name, []).append(o)
    final = [core.merge_objects(v, f"{name}_{k}") for k, v in by.items()] + special
    core.export_glb(name, final)
    return final


# --------------------------------------------------------------- pier ----
def pier():
    objs = []
    beam = M("wood_beam")
    deck = M("wood_grey")
    W, D, Z = 7.0, 3.6, 1.15
    piles = []
    for i in range(4):
        for j in range(2):
            bm = core.bm_cyl(0.13, 0.12, Z + 2.2, seg=10)
            core.bm_xform(bm, loc=(-W / 2 + 0.2 + i * (W - 0.4) / 3, -D / 2 + 0.2 + j * (D - 0.4), (Z + 2.2) / 2 - 2.2))
            piles.append(bm)
    bm = core.bm_merge(*piles)
    core.uv_cyl(bm, 0.5, 2.0)
    objs.append(core.obj("pier_tiang", bm, beam, keep_uv=True, smooth=45))
    planks = []
    for k in range(int(W / 0.22)):
        x = -W / 2 + 0.11 + k * 0.22
        bm = core.bm_box(0.2, D, 0.05, bevel=0.006)
        core.bm_xform(bm, loc=(x, 0, Z), rot=(0, 0, random.Random(k).uniform(-0.01, 0.01)))
        planks.append(bm)
    bm = core.bm_merge(*planks)
    core.uv_box(bm, 1.4, swap=True)
    objs.append(core.obj("pier_papan", bm, deck, keep_uv=True))
    for y in (-D / 2 + 0.05, D / 2 - 0.05):
        bm = core.bm_box(W, 0.14, 0.2)
        core.bm_xform(bm, loc=(0, y, Z - 0.12))
        objs.append(core.obj(f"pier_gelagar{y:+.1f}", bm, beam, uv=("box", 1.5)))
    # steps down to the water on the river side (-Y)
    stp = []
    for i in range(5):
        bm = core.bm_box(1.2, 0.3, 0.05)
        core.bm_xform(bm, loc=(W / 2 - 1.0, -D / 2 - 0.2 - i * 0.24, Z - 0.22 * (i + 1)))
        stp.append(bm)
    objs.append(core.obj("pier_tangga", core.bm_merge(*stp), deck, uv=("box", 1.0)))
    # bollards
    bol = []
    for x in (-W / 2 + 0.5, W / 2 - 2.2):
        bm = core.bm_cyl(0.11, 0.11, 0.5, seg=12)
        core.bm_xform(bm, loc=(x, -D / 2 + 0.25, Z + 0.25))
        bol.append(bm)
    objs.append(core.obj("pier_tonggak", core.bm_merge(*bol), M("engine"), smooth=45))
    # enamel sign on two posts, set back on the deck facing the river
    sx0, sy0 = -0.9, D / 2 - 0.35
    sp = []
    for x in (-1.25, 1.25):
        bm = core.bm_box(0.12, 0.12, 2.9)
        core.bm_xform(bm, loc=(sx0 + x, sy0, Z + 1.45))
        sp.append(bm)
    objs.append(core.obj("papan_tiang", core.bm_merge(*sp), M("wood_dark"), uv=("box", 1.0)))
    bm = core.bm_box(2.9, 0.08, 1.15, bevel=0.06, segs=3)
    core.bm_xform(bm, loc=(sx0, sy0 - 0.08, Z + 2.25))
    objs.append(core.obj("papan_pelat", bm, M("sign_plate"), smooth=30))
    face = bmesh.new()
    vs = [face.verts.new(p) for p in ((-1.36, 0, -0.5), (1.36, 0, -0.5), (1.36, 0, 0.5), (-1.36, 0, 0.5))]
    f = face.faces.new(vs)
    uvl = face.loops.layers.uv.verify()
    for lp, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uvl].uv = uv
    bmesh.ops.recalc_face_normals(face, faces=face.faces)
    for fc in face.faces:
        if fc.normal.y > 0:
            fc.normal_flip()
    core.bm_xform(face, loc=(sx0, sy0 - 0.125, Z + 2.25))
    objs.append(core.obj("papan_muka", face, M("sign_face"), keep_uv=True, props={"tm": "signface"}))
    # lamp post with lantern
    lx, ly = W / 2 - 0.4, D / 2 - 0.4
    bm = core.bm_tube([(lx, ly, Z), (lx, ly, Z + 3.0), (lx, ly - 0.35, Z + 3.25), (lx, ly - 0.55, Z + 3.2)], 0.05, seg=8)
    objs.append(core.obj("lampu_tiang", bm, M("engine"), smooth=50))
    bm = core.bm_lathe([(0.0, 0.0), (0.1, 0.0), (0.13, 0.08), (0.13, 0.26), (0.06, 0.34), (0.0, 0.36)], seg=8)
    core.bm_xform(bm, loc=(lx, ly - 0.55, Z + 2.86))
    objs.append(core.obj("lampu_kaca", bm, core.flat("kaca_lampu_dermaga", (0.95, 0.82, 0.55), 0.2,
                                                     emit=(1.0, 0.7, 0.35), emit_strength=0.0),
                         smooth=30, props={"tm_glow": "pierlamp"}))
    return objs


# ------------------------------------------------------------ vegetation ----
def frond_strip(base, direction, L, width, droop, twist=0.0, n=10):
    d = V(direction).normalized()
    side = d.cross(V((0, 0, 1))).normalized()
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    rows = []
    for i in range(n + 1):
        t = i / n
        p = V(base) + d * L * t + V((0, 0, L * (0.45 * math.sin(t * math.pi * 0.7) - droop * t * t)))
        w = width * math.sin(math.pi * min(t * 1.15, 1.0)) ** 0.6 + 0.02
        ang = twist * t
        s = side * math.cos(ang) + V((0, 0, 1)) * math.sin(ang) * 0.4
        rows.append([bm.verts.new(p - s * w / 2), bm.verts.new(p + s * w / 2)])
    for i in range(n):
        f = bm.faces.new((rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]))
        for lp, uv in zip(f.loops, ((i / n, 0), ((i + 1) / n, 0), ((i + 1) / n, 1), (i / n, 1))):
            lp[uvl].uv = uv
    return bm


def kelapa(seed=0, H=10.0, lean=1.6):
    rnd = random.Random(seed)
    objs = []
    pts, radii = [], []
    for i in range(18):
        t = i / 17
        pts.append((lean * t ** 1.8, 0.0, H * t))
        radii.append(0.2 - 0.07 * t)
    bm = core.bm_tube(pts, 0.2, seg=12, radii=radii)
    core.uv_cyl(bm, 0.7, 0.35)
    objs.append(core.obj("batang", bm, M("trunk"), keep_uv=True, smooth=50))
    top = V(pts[-1])
    fr = []
    for k in range(15):
        a = k * math.tau / 15 + rnd.uniform(-0.15, 0.15)
        up = rnd.uniform(-0.2, 0.5)
        d = (math.cos(a), math.sin(a), up)
        fr.append(frond_strip(top + V((0, 0, 0.1)), d, rnd.uniform(3.6, 4.6), rnd.uniform(1.6, 2.1),
                              droop=rnd.uniform(0.75, 1.15), twist=rnd.uniform(-0.4, 0.4)))
    objs.append(core.obj("pelepah", core.bm_merge(*fr), M("frond"), keep_uv=True, smooth=60))
    nuts = []
    for k in range(6):
        a = k * math.tau / 6 + rnd.random()
        bm = core.bm_sphere(0.13, 10, 8)
        core.bm_xform(bm, scale=(1, 1, 1.15), loc=(top.x + math.cos(a) * 0.28, top.y + math.sin(a) * 0.28, top.z - 0.32))
        nuts.append(bm)
    objs.append(core.obj("buah_kelapa", core.bm_merge(*nuts), core.flat("kelapa_muda", (0.36, 0.42, 0.12), 0.5),
                         smooth=60))
    return objs


def nipah(seed=0):
    rnd = random.Random(seed)
    fr = []
    for k in range(13):
        a = k * math.tau / 13 + rnd.uniform(-0.2, 0.2)
        d = (math.cos(a) * 0.55, math.sin(a) * 0.55, 1.0)
        fr.append(frond_strip((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), 0.0), d, rnd.uniform(4.0, 5.6),
                              rnd.uniform(1.3, 1.8), droop=rnd.uniform(0.25, 0.6), twist=rnd.uniform(-0.5, 0.5)))
    return [core.obj("pelepah_nipah", core.bm_merge(*fr), M("frond_nipa"), keep_uv=True, smooth=60)]


def pohon(seed=0, H=7.0):
    rnd = random.Random(seed)
    objs = []
    bark = core.mat("kulit_kayu", tex.wood("kulit_kayu", seed=91, base=(0.33, 0.28, 0.22), dark=(0.17, 0.14, 0.11),
                                         weather=0.5), rough=0.9)
    trunk = core.bm_tube([(0, 0, 0), (0.2, 0.1, H * 0.35), (0.1, -0.1, H * 0.6)], 0.32, seg=10,
                         radii=[0.34, 0.26, 0.2])
    br = [trunk]
    tips = []
    for k in range(4):
        a = k * math.tau / 4 + rnd.uniform(-0.3, 0.3)
        tip = (math.cos(a) * 2.2, math.sin(a) * 2.2, H * 0.78 + rnd.uniform(-0.5, 0.5))
        br.append(core.bm_tube([(0.1, -0.1, H * 0.55), tip], 0.14, seg=8, radii=[0.16, 0.07]))
        tips.append(tip)
    bm = core.bm_merge(*br)
    core.uv_cyl(bm, 0.9, 1.2)
    objs.append(core.obj("batang_pohon", bm, bark, keep_uv=True, smooth=50))
    leaf = core.mat("daun_rimbun", canopy_tex(), rough=0.75)
    blobs = []
    for i, tip in enumerate(tips + [(0, 0, H * 0.95)]):
        for j in range(2):
            r = rnd.uniform(1.6, 2.3)
            bm = core.bm_blob(r, r * rnd.uniform(0.85, 1.1), r * 0.75, seed=seed * 10 + i * 3 + j, amp=0.22, seg=16, rings=10)
            core.bm_xform(bm, loc=(tip[0] + rnd.uniform(-0.6, 0.6), tip[1] + rnd.uniform(-0.6, 0.6),
                                   tip[2] + rnd.uniform(0.0, 0.8)))
            blobs.append(bm)
    bm = core.bm_merge(*blobs)
    core.uv_box(bm, 2.5)
    objs.append(core.obj("tajuk", bm, leaf, keep_uv=True, smooth=60))
    return objs


def semak(seed=0):
    rnd = random.Random(seed)
    leaf = core.mat("daun_rimbun", canopy_tex(), rough=0.75)
    blobs = []
    for i in range(5):
        r = rnd.uniform(0.6, 1.0)
        bm = core.bm_blob(r, r, r * 0.7, seed=seed * 7 + i, amp=0.2, seg=12, rings=8)
        core.bm_xform(bm, loc=(rnd.uniform(-0.9, 0.9), rnd.uniform(-0.9, 0.9), r * 0.45))
        blobs.append(bm)
    bm = core.bm_merge(*blobs)
    core.uv_box(bm, 1.5)
    return [core.obj("semak", bm, leaf, keep_uv=True, smooth=60)]


# ----------------------------------------------------------------- bird ----
def kuntul():
    white = core.flat("bulu_putih", (0.93, 0.92, 0.88), 0.7)
    yellow = core.flat("paruh", (0.85, 0.62, 0.12), 0.4)
    dark = core.flat("kaki", (0.08, 0.08, 0.08), 0.5)
    objs = []
    body = core.bm_blob(0.22, 0.09, 0.1, seed=3, amp=0.05)
    neck = core.bm_tube([(0.16, 0, 0.04), (0.24, 0, 0.12), (0.22, 0, 0.22), (0.3, 0, 0.27)], 0.03, seg=8,
                        radii=[0.045, 0.03, 0.028, 0.026])
    head = core.bm_sphere(0.04, 10, 8)
    core.bm_xform(head, loc=(0.31, 0, 0.28))
    objs.append(core.obj("kuntul_badan", core.bm_merge(body, neck, head), white, smooth=60))
    beak = core.bm_cyl(0.014, 0.001, 0.13, seg=8)
    core.bm_xform(beak, rot=(0, math.pi / 2, 0), loc=(0.39, 0, 0.275))
    objs.append(core.obj("kuntul_paruh", beak, yellow, smooth=50))
    legs = [core.bm_tube([(-0.05, s * 0.03, -0.05), (-0.25, s * 0.03, -0.12), (-0.42, s * 0.03, -0.13)], 0.008, seg=5)
            for s in (-1, 1)]
    objs.append(core.obj("kuntul_kaki", core.bm_merge(*legs), dark))
    for side, nm in ((1, "kiri"), (-1, "kanan")):
        pts = [(0.12, 0.0), (0.06, 0.55), (-0.04, 0.62), (-0.12, 0.3), (-0.15, 0.0)]
        bm = core.bm_prism([(x, side * y) for x, y in (pts if side > 0 else list(reversed(pts)))], 0.012, center_z=True)
        w = core.obj(f"kuntul_sayap_{nm}", bm, white, props={"tm": "wing", "tm_side": side})
        w.location = (0.02, side * 0.06, 0.06)
        objs.append(w)
    return objs


def main(render=True):
    export_alone("dermaga_kayu", pier)
    export_alone("kelapa_a", lambda: kelapa(1, 10.5, 1.8))
    export_alone("kelapa_b", lambda: kelapa(2, 8.0, -1.0))
    export_alone("nipah", lambda: nipah(3))
    export_alone("pohon", lambda: pohon(4))
    export_alone("semak", lambda: semak(5))
    export_alone("kuntul", kuntul)
    variants = [
        ("rumah_a", dict(seed=1, w=7.0, d=6.0, stilt=2.3, roof="zinc", paint="hull_white")),
        ("rumah_b", dict(seed=2, w=6.0, d=5.5, stilt=2.0, roof="tile", paint="jukung_green")),
        ("rumah_c", dict(seed=3, w=8.0, d=6.5, stilt=2.6, roof="tile_dark", paint="wood_grey", limas=True)),
        ("rumah_d", dict(seed=4, w=6.5, d=5.0, stilt=2.1, roof="zinc", paint="hull_yellow")),
    ]
    for name, kw in variants:
        export_alone(name, lambda kw=kw, name=name: houses.rumah_panggung(name, **kw))
    for name, kw in (("rakit_a", dict(seed=5, roof="zinc", wall="wood_grey", paint="jukung_blue", veranda=True,
                                      w=5.6, d=4.0, ver_d=1.6, roof_sep=False)),
                     ("rakit_b", dict(seed=6, roof="thatch", wall="wood_grey", veranda=True, w=5.0, d=3.6, ver_d=1.4,
                                      roof_sep=False))):
        export_alone(name, lambda kw=kw, name=name: houses.rumah_rakit(name, **kw))
    if not render:
        return
    # one preview sheet of the vegetation and houses
    core.reset()
    core.use_collection("preview")
    parts = []
    for i, (fn, off) in enumerate(((lambda: kelapa(1, 10.5, 1.8), (-14, 6)), (lambda: nipah(3), (-6, 2)),
                                   (lambda: pohon(4), (3, 8)), (lambda: semak(5), (-2, -2)),
                                   (lambda: houses.rumah_panggung("pv", seed=1, w=7.0, d=6.0, stilt=2.3,
                                                                  roof="zinc", paint="hull_white"), (12, 0)),
                                   (lambda: pier(), (0, -8)))):
        objs = fn()
        for o in objs:
            o.location.x += off[0]
            o.location.y += off[1]
        parts += objs
    core.setup_world(sun_elev=35, sun_rot=150)
    core.add_sun(elev=35, azim=150, energy=3.2)
    core.add_camera((-6, -36, 11), (0, 2, 3), lens=34)
    core.render("props", 1100, 620, samples=28)


if __name__ == "__main__":
    main(render="--norender" not in sys.argv)
