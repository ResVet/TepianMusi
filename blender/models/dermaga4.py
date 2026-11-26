"""Dermaga IV: a timber balai on stilts where a dispute is settled by
musyawarah, with the kitab Simbur Cahaya on a low table and an oil lamp.
The book is exported open; its right half pivots on the spine so the site
can close and open it. Pages are separate meshes for runtime text."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import bmesh  # noqa: E402
import core  # noqa: E402
import orn  # noqa: E402
import tex  # noqa: E402
from core import V  # noqa: E402
from mats import M  # noqa: E402

FZ = 1.6        # balai floor height
TX, TY = 0.0, -0.4   # table centre on the floor


def balai():
    W, D = 9.0, 7.0
    top = FZ + 3.0
    beam = M("wood_beam")
    wood = M("wood_dark")
    parts = []
    st = []
    for i in range(4):
        for j in range(3):
            bm = core.bm_box(0.3, 0.3, FZ + 0.5)
            core.bm_xform(bm, loc=(-W / 2 + W * i / 3, -D / 2 + D * j / 2, (FZ + 0.5) / 2 - 0.5))
            st.append(bm)
    for i in range(4):  # posts up to the roof
        for j in range(3):
            if j == 1 and i in (1, 2):
                continue
            bm = core.bm_box(0.22, 0.22, top - FZ)
            core.bm_xform(bm, loc=(-W / 2 + W * i / 3, -D / 2 + D * j / 2, FZ + (top - FZ) / 2))
            st.append(bm)
    parts.append(core.obj("balai_tiang", core.bm_merge(*st), beam, uv=("box", 1.5)))
    bm = core.bm_box(W + 0.4, D + 0.4, 0.2)
    core.bm_xform(bm, loc=(0, 0, FZ - 0.1))
    parts.append(core.obj("balai_lantai", bm, M("wood_planks"), uv=("box", 2.0)))
    # back wall, low side walls, carved railing at the front
    bm = core.bm_box(W, 0.12, top - FZ)
    core.bm_xform(bm, loc=(0, D / 2, FZ + (top - FZ) / 2))
    parts.append(core.obj("balai_dinding", bm, wood, uv=("box", 2.0, True)))
    rail = []
    for sx in (-1, 1):
        bm = core.bm_box(0.1, D, 1.0)
        core.bm_xform(bm, loc=(sx * W / 2, 0, FZ + 0.5))
        rail.append(bm)
    for x in (-W / 2, W / 2):
        pass
    for i in range(26):
        x = -W / 2 + 0.2 + i * (W - 0.4) / 25
        if abs(x) < 1.0:
            continue
        bm = core.bm_box(0.06, 0.06, 0.75)
        core.bm_xform(bm, loc=(x, -D / 2, FZ + 0.38))
        rail.append(bm)
    for zz in (FZ + 0.8,):
        for sx in (-1, 1):
            bm = core.bm_box(W / 2 - 1.0, 0.1, 0.1)
            core.bm_xform(bm, loc=(sx * (W / 4 + 0.5), -D / 2, zz))
            rail.append(bm)
    parts.append(core.obj("balai_pagar", core.bm_merge(*rail), wood, uv=("box", 1.5)))
    # stairs at the front centre
    stp = []
    n = 8
    for i in range(n):
        zz = FZ * (i + 1) / n
        bm = core.bm_box(1.6, 0.28, 0.05)
        core.bm_xform(bm, loc=(0, -D / 2 - 0.15 - (n - 1 - i) * 0.25, zz - 0.03))
        stp.append(bm)
    for sx in (-1, 1):
        stp.append(core.bm_beam((sx * 0.8, -D / 2 - 0.25 - n * 0.25, 0.0), (sx * 0.8, -D / 2 - 0.1, FZ), 0.07, 0.2))
    parts.append(core.obj("balai_tangga", core.bm_merge(*stp), beam, uv=("box", 1.2)))
    rf = orn.hip_roof(W, D, 2.8, overhang=1.2, concave=0.18, thick=0.12)
    core.bm_xform(rf, loc=(0, 0, top))
    parts.append(core.obj("balai_atap", rf, M("thatch"), keep_uv=True, smooth=30, props={"tm": "roof"}))
    rd = orn.hip_ridges(W, D, 2.8, overhang=1.2, radius=0.08)
    core.bm_xform(rd, loc=(0, 0, top))
    parts.append(core.obj("balai_bubungan", rd, beam, smooth=50, props={"tm": "roof"}))
    R = (W - D) / 2
    sb = []
    for sx in (-1, 1):
        s = orn.simbar(0.8, 0.28, 0.055)
        core.bm_xform(s, rot=(0, 0, math.pi / 2), loc=(sx * R, 0, top + 2.85))
        sb.append(s)
    parts.append(core.obj("balai_simbar", core.bm_merge(*sb), wood, smooth=50, props={"tm": "roof"}))
    # tikar for the gathering
    parts += core.tikar_mesh("balai_tikar", 5.0, 3.4, FZ, loc=(0.0, 0.2))
    return parts


def book():
    """Open book lying on the table, spine along Y at x = TX."""
    leather = M("leather")
    paper = M("paper")
    pw, ph = 0.24, 0.32
    z0 = FZ + 0.36
    objs = []
    for side, nm in ((-1, "kiri"), (1, "kanan")):
        cov = core.bm_box(pw + 0.012, ph + 0.02, 0.008, bevel=0.002)
        core.bm_xform(cov, loc=(side * (pw / 2 + 0.006), 0, 0.004))
        blk = core.bm_box(pw - 0.008, ph - 0.006, 0.018)
        core.bm_xform(blk, loc=(side * pw / 2, 0, 0.008 + 0.009))
        core.uv_box(cov, 0.2)
        core.uv_box(blk, 0.1)
        c = core.obj(f"kitab_sampul_{nm}", cov, leather, keep_uv=True)
        b = core.obj(f"kitab_blok_{nm}", blk, paper, keep_uv=True)
        pg = core.bm_box(pw - 0.012, ph - 0.012, 0.001)
        uvl = pg.loops.layers.uv.verify()
        for f in pg.faces:
            for lp in f.loops:
                co = lp.vert.co
                lp[uvl].uv = (co.x / (pw - 0.012) + 0.5, co.y / (ph - 0.012) + 0.5)
        core.bm_xform(pg, loc=(side * pw / 2, 0, 0.027))
        p = core.obj(f"kitab_halaman_{nm}", pg, core.mat(f"halaman_{nm}", tex.paper("kertas_tua"), rough=0.95),
                     keep_uv=True)
        half = core.merge_objects([c, b], f"kitab_{nm}", {"tm": "book", "tm_side": side})
        half.location = (TX, TY, z0)
        p["tm"] = "page"
        p["tm_side"] = side
        p.location = (TX, TY, z0)
        objs += [half, p]
    spine = core.bm_cyl(0.012, 0.012, ph + 0.02, seg=10)
    core.bm_xform(spine, rot=(math.pi / 2, 0, 0), loc=(0, 0, 0.012))
    sp = core.obj("kitab_punggung", spine, leather, smooth=50)
    sp.location = (TX, TY, z0)
    objs.append(sp)
    return objs


def table_and_lamp():
    objs = []
    wood = M("wood_dark")
    t = [core.bm_xform(core.bm_box(0.9, 0.6, 0.04, bevel=0.01), loc=(0, 0, 0.34))]
    for sx in (-1, 1):
        t.append(core.bm_xform(core.bm_box(0.06, 0.5, 0.32), loc=(sx * 0.38, 0, 0.16)))
    bm = core.bm_merge(*t)
    core.uv_box(bm, 0.6, True)
    ob = core.obj("meja_rendah", bm, wood, keep_uv=True)
    ob.location = (TX, TY, FZ)
    objs.append(ob)
    clay = core.flat("tanah_liat_pelita", (0.46, 0.26, 0.15), 0.7)
    bm = core.bm_lathe([(0.0, 0.0), (0.05, 0.0), (0.055, 0.02), (0.04, 0.05), (0.02, 0.06), (0.022, 0.075),
                        (0.0, 0.075)], seg=24)
    lamp = core.obj("pelita", bm, clay, smooth=50)
    lamp.location = (TX + 0.33, TY + 0.18, FZ + 0.36)
    objs.append(lamp)
    bm = core.bm_sphere(0.018, 12, 8)
    core.bm_xform(bm, scale=(1, 1, 2.2), loc=(0, 0, 0.03))
    fl = core.obj("api_pelita", bm, M("lamp_glow"), smooth=60, props={"tm": "flame"})
    fl.location = (TX + 0.33, TY + 0.18, FZ + 0.36 + 0.075)
    objs.append(fl)
    # hanging lantern under the roof
    bm = core.bm_lathe([(0.0, 0.0), (0.08, 0.0), (0.1, 0.06), (0.1, 0.2), (0.06, 0.26), (0.0, 0.27)], seg=16)
    lan = core.obj("lentera_gantung", bm, core.flat("kaca_lentera", (0.95, 0.75, 0.45), 0.3, emit=(1.0, 0.65, 0.3),
                                                      emit_strength=0.0), smooth=40, props={"tm_glow": "lantern"})
    lan.location = (0, 0.4, FZ + 2.2)
    objs.append(lan)
    bm = core.bm_tube([(0, 0.4, FZ + 2.47), (0, 0.4, FZ + 3.0)], 0.006, seg=4)
    objs.append(core.obj("tali_lentera", bm, M("rope")))
    # sandals of the two families at the foot of the stairs
    sand = []
    import random
    rnd = random.Random(9)
    for k in range(4):
        for s in (-1, 1):
            bm = core.bm_box(0.11, 0.27, 0.02, bevel=0.008)
            x = -1.6 + k * 0.42 + s * 0.06 + (0.9 if k > 1 else 0)
            core.bm_xform(bm, rot=(0, 0, rnd.uniform(-0.3, 0.3)), loc=(x, -3.5 - 2.3 - rnd.uniform(0, 0.3), 0.01))
            sand.append(bm)
    objs.append(core.obj("sandal", core.bm_merge(*sand), core.flat("sandal_karet", (0.24, 0.2, 0.16), 0.8)))
    return objs


def main(render=True):
    core.reset()
    core.use_collection("dermaga4")
    parts = balai()
    objs = table_and_lamp() + book()
    sc = bpy.context.scene
    keep = [o for o in sc.objects if o.type == "MESH" and (o.get("tm") or o.get("tm_glow"))]
    static = [o for o in sc.objects if o.type == "MESH" and o not in keep]
    by = {}
    for o in static:
        by.setdefault(o.data.materials[0].name, []).append(o)
    final = [core.merge_objects(v, f"d4_{k}") for k, v in by.items()]
    roof = [o for o in keep if o.get("tm") == "roof"]
    rest = [o for o in keep if o.get("tm") != "roof"]
    final.append(core.merge_objects(roof, "balai_atap", {"tm": "roof"}))
    core.export_glb("dermaga4", final + rest)
    _ = (parts, objs)
    if render:
        core.setup_world(sun_elev=18, sun_rot=230)
        core.add_sun(elev=18, azim=230, energy=3.0, color=(1.0, 0.82, 0.6))
        core.add_camera((-8, -14, 5.5), (0, 0, 2.6), lens=38)
        core.render("dermaga4", 1000, 640, samples=32)
        for o in sc.objects:
            if o.get("tm") == "roof":
                o.hide_render = True
        core.add_camera((TX + 0.05, TY - 0.75, FZ + 1.05), (TX, TY, FZ + 0.36), lens=38)
        core.render("kitab", 900, 600, samples=32)


if __name__ == "__main__":
    main(render="--norender" not in sys.argv)
