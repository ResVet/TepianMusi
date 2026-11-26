"""Dermaga II: a rumah rakit with a ngobeng (idangan) spread on its veranda.

Layout follows the descriptions in Rohmadi et al. (2025): eight diners around
a sepra, nasi minyak on a dulang in the centre, paired lauk (iwak) on larger
plates, pulur on small plates, a plate and glass for each diner, a kettle and
basin for washing hands. The eight iwak dishes are separate objects with their
origin at the dish centre so the site can move them into the slots."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import bmesh  # noqa: E402
import core  # noqa: E402
import houses  # noqa: E402
import tex  # noqa: E402
from core import V  # noqa: E402
from mats import M  # noqa: E402

FZ = 0.47          # veranda floor height in the raft
CX, CY = 0.0, -1.55  # sepra centre
SEPRA = 2.15


def F(name, base, **kw):
    return core.mat(name, tex.food(name, base, **kw), rough=0.4)


def foods():
    return {
        "malbi_kuah": F("malbi_kuah", (0.2, 0.08, 0.035), spec=0.12, oil=0.8, seed=101),
        "daging": F("daging", (0.32, 0.14, 0.07), spec=0.3, bumps=0.8, seed=103, oil=0.4),
        "gulai_kuah": F("gulai_kuah", (0.86, 0.52, 0.1), spec=0.12, oil=0.9, seed=105),
        "ayam": F("ayam", (0.82, 0.56, 0.24), spec=0.3, bumps=0.6, seed=107, oil=0.4),
        "pindang_kuah": F("pindang_kuah", (0.62, 0.27, 0.1), spec=0.08, oil=0.5, seed=109),
        "ikan": F("ikan_daging", (0.88, 0.83, 0.72), spec=0.35, bumps=0.4, seed=111),
        "nanas": F("nanas", (0.94, 0.74, 0.22), spec=0.3, bumps=0.5, seed=113, grains=10,
                   grain_col=(0.98, 0.84, 0.35)),
        "kemangi": core.flat("kemangi", (0.14, 0.34, 0.09), 0.5),
        "sate": F("sate", (0.36, 0.16, 0.06), spec=0.35, bumps=0.9, seed=115, char=0.55, oil=0.4),
        "lidi": core.flat("lidi", (0.72, 0.6, 0.38), 0.7),
        "nasi": F("nasi_minyak", (0.84, 0.66, 0.36), spec=0.45, bumps=0.3, seed=117, grains=48,
                  grain_col=(0.95, 0.83, 0.56)),
        "bawang": F("bawang_goreng", (0.56, 0.3, 0.1), spec=0.4, bumps=0.8, seed=119, char=0.3),
        "kismis": core.flat("kismis", (0.16, 0.06, 0.08), 0.35),
        "sambal": F("sambal_nanas", (0.74, 0.14, 0.05), spec=0.2, bumps=0.8, seed=121, oil=0.6,
                    grains=14, grain_col=(0.95, 0.7, 0.2)),
        "acar_cair": core.flat("acar_cair", (0.92, 0.85, 0.55), 0.08, alpha=0.75),
        "timun": F("timun", (0.72, 0.8, 0.5), spec=0.25, bumps=0.3, seed=123),
        "wortel": core.flat("wortel", (0.9, 0.42, 0.08), 0.35),
        "bawang_merah": core.flat("bawang_merah", (0.68, 0.32, 0.42), 0.3),
        "semangka_isi": F("semangka_isi", (0.84, 0.14, 0.17), spec=0.25, bumps=0.3, seed=125),
        "semangka_kulit": core.flat("semangka_kulit", (0.2, 0.4, 0.13), 0.4),
        "air": core.flat("air_minum", (0.75, 0.85, 0.88), 0.03, alpha=0.4),
    }


def plate_profile(r, depth=0.025, rim=0.018):
    return [(0.0, 0.0), (r * 0.55, 0.0), (r * 0.62, 0.006), (r * 0.9, depth * 0.75), (r, depth),
            (r - rim * 0.3, depth + 0.003), (r * 0.88, depth * 0.82), (r * 0.6, 0.009), (0.0, 0.008)]


def bowl_profile(r, h):
    return [(0.0, 0.0), (r * 0.45, 0.0), (r * 0.5, 0.012), (r * 0.82, h * 0.55), (r, h),
            (r - 0.006, h + 0.004), (r * 0.8, h * 0.6), (r * 0.42, 0.016), (0.0, 0.015)]


def lathe_obj(name, prof, mat, loc=(0, 0, 0), seg=40, uv_size=None, scale=None, props=None):
    bm = core.bm_lathe(prof, seg=seg)
    size = uv_size or max(p[0] for p in prof) * 2
    core.uv_planar(bm, size)
    if scale:
        core.bm_xform(bm, scale=scale)
    core.bm_xform(bm, loc=loc)
    return core.obj(name, bm, mat, smooth=55, keep_uv=True, props=props)


def disc(name, r, z, mat, loc=(0, 0), seg=32, scale=None):
    bm = core.bm_cyl(r, r, 0.004, seg=seg)
    core.uv_planar(bm, r * 2)
    if scale:
        core.bm_xform(bm, scale=scale)
    core.bm_xform(bm, loc=(loc[0], loc[1], z))
    return core.obj(name, bm, mat, keep_uv=True)


def blobs(name, mat, n, spread, size, z, seed, flat=0.6, loc=(0, 0)):
    import random
    rnd = random.Random(seed)
    bms = []
    for i in range(n):
        a = rnd.uniform(0, math.tau)
        rr = spread * math.sqrt(rnd.random())
        s = size * rnd.uniform(0.75, 1.2)
        bm = core.bm_blob(s * rnd.uniform(0.9, 1.4), s, s * flat, seed=seed + i, amp=0.22, seg=10, rings=7)
        core.bm_xform(bm, rot=(rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(0, math.tau)),
                      loc=(loc[0] + math.cos(a) * rr, loc[1] + math.sin(a) * rr, z + s * flat * 0.6))
        bms.append(bm)
    bm = core.bm_merge(*bms)
    core.uv_box(bm, 0.12)
    return core.obj(name, bm, mat, smooth=60, keep_uv=True)


def dish(kind, tag, f):
    """Build one iwak dish centred at the origin; returns merged object."""
    plate = M("ceramic")
    parts = []
    if kind == "malbi":
        parts.append(lathe_obj("p", bowl_profile(0.115, 0.045), plate))
        parts.append(disc("k", 0.098, 0.034, f["malbi_kuah"]))
        parts.append(blobs("d", f["daging"], 9, 0.06, 0.024, 0.028, 11))
    elif kind == "gulai":
        parts.append(lathe_obj("p", bowl_profile(0.11, 0.05), plate))
        parts.append(disc("k", 0.094, 0.038, f["gulai_kuah"]))
        parts.append(blobs("a", f["ayam"], 4, 0.045, 0.035, 0.03, 21, flat=0.55))
    elif kind == "pindang":
        parts.append(lathe_obj("p", bowl_profile(0.118, 0.055), plate))
        parts.append(disc("k", 0.1, 0.042, f["pindang_kuah"]))
        parts.append(blobs("i", f["ikan"], 3, 0.04, 0.04, 0.036, 31, flat=0.35))
        bms = []
        for k in range(3):
            bm = core.bm_box(0.05, 0.022, 0.008, bevel=0.003)
            core.bm_xform(bm, rot=(0, 0, k * 2.1), loc=(math.cos(k * 2.1) * 0.06, math.sin(k * 2.1) * 0.06, 0.046))
            bms.append(bm)
        parts.append(core.obj("n", core.bm_merge(*bms), f["nanas"], uv=("box", 0.08)))
        parts.append(blobs("km", f["kemangi"], 6, 0.07, 0.012, 0.045, 33, flat=0.15))
    elif kind == "sate":
        parts.append(lathe_obj("p", plate_profile(0.13), plate, scale=(1.25, 0.82, 1.0)))
        sk, mt = [], []
        for k in range(6):
            y = -0.06 + k * 0.024
            a = 0.12 * math.sin(k * 1.7)
            bm = core.bm_cyl(0.0022, 0.0022, 0.24, seg=5)
            core.bm_xform(bm, rot=(0, math.pi / 2, a), loc=(0.0, y, 0.024))
            sk.append(bm)
            for j in range(4):
                bm = core.bm_blob(0.014, 0.011, 0.01, seed=k * 10 + j, amp=0.25, seg=8, rings=6)
                xx = -0.045 + j * 0.03
                core.bm_xform(bm, loc=(xx * math.cos(a), y + xx * math.sin(a), 0.026))
                mt.append(bm)
        parts.append(core.obj("lidi", core.bm_merge(*sk), f["lidi"]))
        bm = core.bm_merge(*mt)
        core.uv_box(bm, 0.06)
        parts.append(core.obj("sate", bm, f["sate"], smooth=60, keep_uv=True))
    ob = core.merge_objects(parts, f"iwak_{kind}_{tag}", {"tm": "iwak", "tm_kind": kind})
    return ob


def ngobeng(f):
    objs = []
    # tikar under the sepra
    objs += core.tikar_mesh("tikar", 3.1, 2.8, FZ, loc=(CX, CY - 0.05))
    # sepra with a soft wrinkle
    def cloth(u, v):
        x = (u - 0.5) * SEPRA
        y = (v - 0.5) * SEPRA
        z = FZ + 0.012 + 0.004 * math.sin(u * 9.3 + v * 3.1) * math.sin(v * 7.7)
        return (CX + x, CY + y, z)
    bm = core.bm_grid(24, 24, cloth)
    core.uv_planar(bm, 0.55, center=(CX, CY))
    objs.append(core.obj("sepra", bm, M("sepra"), smooth=40, keep_uv=True))
    z0 = FZ + 0.018
    # dulang with nasi minyak
    objs.append(lathe_obj("dulang", [(0.0, 0.0), (0.27, 0.0), (0.29, 0.03), (0.3, 0.035), (0.285, 0.036),
                                      (0.27, 0.008), (0.0, 0.006)], M("brass"), loc=(CX, CY, z0)))
    objs.append(lathe_obj("piring_nasi", plate_profile(0.21, 0.03), M("ceramic"), loc=(CX, CY, z0 + 0.008)))
    bm = core.bm_lathe([(0.0, 0.0), (0.17, 0.0), (0.165, 0.03), (0.14, 0.075), (0.09, 0.11), (0.04, 0.125),
                        (0.0, 0.128)], seg=36)
    for v in bm.verts:
        d = math.hypot(v.co.x, v.co.y)
        v.co.z += 0.006 * math.sin(v.co.x * 90) * math.sin(v.co.y * 70) * (d > 0.02)
    core.uv_box(bm, 0.16)
    core.bm_xform(bm, loc=(CX, CY, z0 + 0.018))
    objs.append(core.obj("nasi_minyak", bm, f["nasi"], smooth=50, keep_uv=True))
    objs.append(blobs("bawang_goreng", f["bawang"], 40, 0.11, 0.006, z0 + 0.1, 41, flat=0.3, loc=(CX, CY)))
    objs.append(blobs("kismis", f["kismis"], 10, 0.1, 0.006, z0 + 0.09, 43, flat=0.6, loc=(CX, CY)))
    # pulur on small plates at the diagonals
    pulur = [("sambal", 45), ("acar", 135), ("semangka", 225), ("sambal2", 315)]
    for name, ang in pulur:
        a = math.radians(ang + 22.5)
        px, py = CX + math.cos(a) * 0.37, CY + math.sin(a) * 0.37
        objs.append(lathe_obj(f"piring_{name}", plate_profile(0.07, 0.016), M("ceramic"), loc=(px, py, z0)))
        if name.startswith("sambal"):
            objs.append(blobs(f"isi_{name}", f["sambal"], 5, 0.02, 0.018, z0 + 0.012, 51 + ang, flat=0.5,
                              loc=(px, py)))
        elif name == "acar":
            objs.append(disc("acar_kuah", 0.05, z0 + 0.016, f["acar_cair"], loc=(px, py)))
            cubes = []
            import random
            rnd = random.Random(7)
            for k in range(14):
                s = 0.011
                bm = core.bm_box(s, s, s, bevel=0.002)
                core.bm_xform(bm, rot=(rnd.random(), rnd.random(), rnd.random()),
                              loc=(px + rnd.uniform(-0.035, 0.035), py + rnd.uniform(-0.035, 0.035), z0 + 0.02))
                cubes.append((k % 3, bm))
            for idx, mname in enumerate(("timun", "wortel", "bawang_merah")):
                b = core.bm_merge(*[bm for (kk, bm) in cubes if kk == idx])
                core.uv_box(b, 0.05)
                objs.append(core.obj(f"acar_{mname}", b, f[mname], keep_uv=True))
        else:
            wedges_i, wedges_k = [], []
            for k in range(3):
                pts = [(0.0, 0.0), (0.05, -0.022), (0.05, 0.022)]
                bm = core.bm_prism(pts, 0.022)
                core.bm_xform(bm, rot=(0, 0, k * 2.09 + 0.3), loc=(px, py, z0 + 0.01))
                wedges_i.append(bm)
                bm = core.bm_box(0.006, 0.046, 0.022)
                core.bm_xform(bm, loc=(0.052, 0, 0.011))
                core.bm_xform(bm, rot=(0, 0, k * 2.09 + 0.3), loc=(px, py, z0 + 0.01))
                wedges_k.append(bm)
            objs.append(core.obj("semangka_isi", core.bm_merge(*wedges_i), f["semangka_isi"], uv=("box", 0.06)))
            objs.append(core.obj("semangka_kulit", core.bm_merge(*wedges_k), f["semangka_kulit"]))
    # place settings for eight diners
    plates, glasses, waters = [], [], []
    for i in range(8):
        a = math.radians(22.5 + 45 * i)
        r = 0.98
        sx, sy = math.cos(a), math.sin(a)
        # snap to the square cloth: two diners per side
        px, py = CX + sx * r, CY + sy * r
        plates.append(lathe_obj(f"piring_makan{i}", plate_profile(0.11, 0.022), M("ceramic"), loc=(px, py, z0)))
        gx, gy = px + (-sy) * 0.16, py + sx * 0.16
        glasses.append(lathe_obj(f"gelas{i}", [(0.0, 0.0), (0.03, 0.0), (0.036, 0.1), (0.034, 0.1), (0.028, 0.006),
                                               (0.0, 0.006)], M("glass"), loc=(gx, gy, z0)))
        bm = core.bm_cyl(0.029, 0.033, 0.07, seg=16)
        core.bm_xform(bm, loc=(gx, gy, z0 + 0.042))
        waters.append(core.obj(f"air{i}", bm, f["air"]))
    objs += plates + glasses + waters
    # kettle and basin for washing hands (obeng's corner)
    kx, ky = CX + 1.32, CY + 0.95
    objs.append(lathe_obj("baskom", [(0.0, 0.0), (0.13, 0.0), (0.2, 0.07), (0.215, 0.08), (0.2, 0.078),
                                     (0.12, 0.006), (0.0, 0.005)], M("brass"), loc=(kx, ky, FZ)))
    ket = [lathe_obj("ceret_badan", [(0.0, 0.0), (0.08, 0.0), (0.11, 0.06), (0.105, 0.14), (0.06, 0.2),
                                     (0.045, 0.23), (0.05, 0.24), (0.0, 0.245)], M("brass"))]
    bm = core.bm_tube([(0.09, 0, 0.05), (0.16, 0, 0.12), (0.2, 0, 0.2), (0.22, 0, 0.22)], 0.012, seg=8,
                      radii=[0.016, 0.013, 0.01, 0.009])
    ket.append(core.obj("ceret_cerat", bm, M("brass"), smooth=50))
    bm = core.bm_tube([(-0.06, 0, 0.21), (-0.15, 0, 0.18), (-0.15, 0, 0.08), (-0.1, 0, 0.05)], 0.01, seg=6)
    ket.append(core.obj("ceret_gagang", bm, M("brass"), smooth=50))
    kettle = core.merge_objects(ket, "ceret", {"tm": "ceret"})
    kettle.location = (kx - 0.32, ky + 0.05, FZ)
    objs.append(kettle)
    # obeng's tray holding the eight iwak dishes at the start
    tx, ty = CX - 1.75, CY - 0.1
    bm = core.bm_box(0.62, 1.12, 0.03, bevel=0.01)
    core.bm_xform(bm, loc=(tx, ty, FZ + 0.015))
    objs.append(core.obj("nampan", bm, M("wood_dark"), uv=("box", 0.8)))
    dishes = []
    order = ["malbi", "gulai", "pindang", "sate"]
    for i, kind in enumerate(order):
        for j, tag in enumerate(("a", "b")):
            ob = dish(kind, tag, f)
            ob.location = (tx - 0.14 + j * 0.28, ty - 0.405 + i * 0.27, FZ + 0.03)
            dishes.append(ob)
    return objs, dishes


def main(render=True):
    core.reset()
    core.use_collection("dermaga2")
    f = foods()
    house = houses.rumah_rakit("rakit_ngobeng", seed=3, roof="thatch", wall="wood_grey", w=6.6, d=4.4,
                               ver_d=3.4)
    objs, dishes = ngobeng(f)
    # merge static pieces by material, keep tagged ones separate
    sc = bpy.context.scene
    keep = {o.name for o in dishes}
    tagged = [o for o in sc.objects if o.type == "MESH" and (o.get("tm") or o.name in keep)]
    static = [o for o in sc.objects if o.type == "MESH" and o not in tagged]
    by = {}
    for o in static:
        by.setdefault(o.data.materials[0].name if o.data.materials else "x", []).append(o)
    final = [core.merge_objects(v, f"d2_{k}") for k, v in by.items()]
    roof = [o for o in tagged if o.get("tm") == "roof"]
    rest = [o for o in tagged if o.get("tm") != "roof"]
    final.append(core.merge_objects(roof, "rakit_atap", {"tm": "roof"}))
    final += rest
    _ = house
    core.export_glb("dermaga2", [o for o in final if o])
    if render:
        core.setup_world(sun_elev=40, sun_rot=160)
        core.add_sun(elev=40, azim=160, energy=3.2)
        for o in sc.objects:
            if o.get("tm") == "roof":
                o.hide_render = True
        core.add_camera((CX + 0.4, CY - 2.6, FZ + 2.2), (CX, CY - 0.1, FZ), lens=32)
        core.render("ngobeng", 1000, 700, samples=40,
                    ground_mat=core.flat("_air", (0.07, 0.055, 0.035), 0.12))
        for o in sc.objects:
            o.hide_render = False
        sc.camera = None
        core.add_camera((-9, -14, 5), (0, 0, 1.6), lens=40)
        core.render("rumahrakit", 900, 600, samples=32,
                    ground_mat=core.flat("_air2", (0.07, 0.055, 0.035), 0.12))


if __name__ == "__main__":
    main(render="--norender" not in sys.argv)
