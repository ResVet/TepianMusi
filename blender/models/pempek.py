"""Dapur akulturasi: a work table with everything needed to make pempek
kapal selam, staged so the site can reveal each step (fish and sago into the
basin, kneading, egg filling, frying, serving with cuko)."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import bmesh  # noqa: E402
import core  # noqa: E402
import tex  # noqa: E402
from core import V  # noqa: E402
from mats import M  # noqa: E402

TZ = 0.78  # table top height


def F(name, base, **kw):
    return core.mat(name, tex.food(name, base, **kw), rough=0.45)


def lathe(name, prof, mat, loc=(0, 0, 0), seg=40, props=None, scale=None):
    bm = core.bm_lathe(prof, seg=seg)
    core.uv_planar(bm, max(p[0] for p in prof) * 2)
    if scale:
        core.bm_xform(bm, scale=scale)
    ob = core.obj(name, bm, mat, smooth=55, keep_uv=True, props=props)
    ob.location = loc
    return ob


def at(ob, loc, props=None):
    ob.location = loc
    for k, v in (props or {}).items():
        ob[k] = v
    return ob


def fish(name):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    nx, nr = 28, 16
    L = 0.52
    rings = []
    for i in range(nx + 1):
        t = i / nx
        r = 0.058 * math.sin(math.pi * min(t * 1.08, 1.0) ** 0.75) ** 0.85 + 0.004
        x = -L / 2 + L * t
        ring = []
        for j in range(nr):
            a = math.tau * j / nr
            ring.append(bm.verts.new((x, math.cos(a) * r * 0.55, math.sin(a) * r)))
        rings.append(ring)
    for i in range(nx):
        for j in range(nr):
            f = bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][(j + 1) % nr], rings[i][(j + 1) % nr]))
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                a = math.tau * jj / nr
                lp[uvl].uv = (ii / nx, 0.5 + 0.5 * math.sin(a))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    body = core.obj(f"{name}_badan", bm, core.mat("kulit_ikan", tex.fish_skin("kulit_ikan"), rough=0.3),
                    smooth=50, keep_uv=True)
    fin = core.flat("sirip", (0.42, 0.45, 0.42), rough=0.4, double=True)
    parts = [body]
    tail = core.bm_prism([(0.0, 0.0), (-0.09, 0.07), (-0.07, 0.0), (-0.09, -0.07)], 0.004, center_z=True)
    core.bm_xform(tail, rot=(math.pi / 2, 0, 0), loc=(-L / 2 + 0.01, 0, 0))
    parts.append(core.obj(f"{name}_ekor", tail, fin))
    for (x, s) in ((-0.02, 1.0), (-0.14, 0.6)):
        d = core.bm_prism([(-0.05 * s, 0.0), (0.05 * s, 0.0), (-0.03 * s, 0.045 * s)], 0.003, center_z=True)
        core.bm_xform(d, rot=(math.pi / 2, 0, 0), loc=(x, 0, 0.05))
        parts.append(core.obj(f"{name}_sirip{x:+.2f}", d, fin))
    eye = core.bm_sphere(0.009, 10, 6)
    core.bm_xform(eye, loc=(L / 2 - 0.06, 0.02, 0.012))
    eye2 = core.bm_sphere(0.009, 10, 6)
    core.bm_xform(eye2, loc=(L / 2 - 0.06, -0.02, 0.012))
    parts.append(core.obj(f"{name}_mata", core.bm_merge(eye, eye2), core.flat("mata_ikan", (0.02, 0.02, 0.02), 0.1)))
    return core.merge_objects(parts, name)


def kapal_selam(name, mat, scale=1.0):
    """Half-moon pouch with a crimped seam on top."""
    bm = bmesh.new()
    nx, nr = 26, 14
    L, R = 0.2 * scale, 0.055 * scale
    rings = []
    for i in range(nx + 1):
        t = i / nx
        x = -L / 2 + L * t
        prof = math.sin(math.pi * t) ** 0.6
        r = R * prof + 0.002
        ring = []
        for j in range(nr + 1):
            a = math.pi * j / nr
            y = math.cos(a) * r
            z = math.sin(a) * r * 1.05 * (1 + 0.04 * math.sin(t * 30) * (j > nr * 0.8))
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    for i in range(nx):
        for j in range(nr):
            bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]))
    # flat underside
    for i in range(nx):
        bm.faces.new((rings[i][nr], rings[i + 1][nr], rings[i + 1][0], rings[i][0]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    core.uv_box(bm, 0.12)
    return core.obj(name, bm, mat, smooth=50, keep_uv=True)


def main(render=True):
    core.reset()
    core.use_collection("pempek")
    food = {
        "pasta_ikan": F("pasta_ikan", (0.86, 0.78, 0.72), spec=0.4, bumps=0.5, seed=201),
        "sagu": F("sagu", (0.95, 0.95, 0.93), spec=0.85, bumps=0.6, seed=203),
        "adonan": F("adonan", (0.84, 0.8, 0.74), spec=0.5, bumps=0.25, seed=205),
        "goreng": F("pempek_goreng", (0.78, 0.5, 0.2), spec=0.45, bumps=0.5, seed=207, char=0.25, oil=0.6),
        "kuning": core.flat("kuning_telur", (0.96, 0.62, 0.08), 0.35),
        "putih": core.flat("putih_telur", (0.95, 0.94, 0.9), 0.3),
        "cangkang": F("cangkang", (0.82, 0.66, 0.5), spec=0.55, bumps=0.15, seed=209),
        "cuko": core.flat("cuko", (0.14, 0.06, 0.025), 0.08),
        "timun": F("timun_dadu", (0.72, 0.8, 0.5), spec=0.25, seed=211),
        "ebi": F("ebi", (0.85, 0.5, 0.3), spec=0.6, bumps=0.8, seed=213),
        "minyak": core.flat("minyak", (0.62, 0.45, 0.12), 0.04, alpha=0.85),
        "enamel": core.mat("enamel", tex.ceramic("enamel", glaze=(0.94, 0.94, 0.92), ink=(0.12, 0.25, 0.5)),
                           rough=0.15),
    }
    objs = []
    wood = M("wood_beam")
    # table
    t = [core.bm_xform(core.bm_box(1.7, 0.9, 0.05, bevel=0.01), loc=(0, 0, TZ - 0.025))]
    for sx in (-1, 1):
        for sy in (-1, 1):
            t.append(core.bm_xform(core.bm_box(0.07, 0.07, TZ - 0.05), loc=(sx * 0.75, sy * 0.36, (TZ - 0.05) / 2)))
    bm = core.bm_merge(*t)
    core.uv_box(bm, 1.0, True)
    objs.append(core.obj("meja_dapur", bm, M("wood_planks"), keep_uv=True))
    # basin with fillings (hidden in turn by the site)
    objs.append(lathe("baskom", [(0.0, 0.0), (0.11, 0.0), (0.17, 0.1), (0.185, 0.115), (0.175, 0.112),
                                 (0.105, 0.008), (0.0, 0.007)], food["enamel"], loc=(0, 0, TZ),
                      props={"tm": "basin"}))
    for nm, mat, (rx, rz), dz in (("isi_ikan", food["pasta_ikan"], (0.09, 0.035), 0.0),
                                  ("isi_sagu", food["sagu"], (0.075, 0.03), 0.02),
                                  ("adonan", food["adonan"], (0.1, 0.045), 0.0)):
        bm = core.bm_blob(rx, rx * 0.9, rz, seed=hash(nm) % 97, amp=0.12 if nm != "adonan" else 0.05)
        core.uv_box(bm, 0.1)
        ob = core.obj(nm, bm, mat, smooth=60, keep_uv=True, props={"tm": "step"})
        ob.location = (0.0 + (0.025 if nm == "isi_sagu" else 0), 0.0, TZ + 0.03 + dz)
        objs.append(ob)
    # cutting board and fish
    bm = core.bm_box(0.58, 0.24, 0.025, bevel=0.006)
    core.bm_xform(bm, loc=(-0.52, -0.18, TZ + 0.0125))
    objs.append(core.obj("talenan", bm, M("wood_beam"), uv=("box", 0.5, True)))
    objs.append(at(fish("ikan"), (-0.52, -0.18, TZ + 0.06), {"tm": "drag", "tm_step": 1}))
    # sago bowl
    objs.append(at(lathe("mangkuk_sagu", [(0.0, 0.0), (0.05, 0.0), (0.09, 0.06), (0.095, 0.065), (0.088, 0.064),
                                          (0.048, 0.006), (0.0, 0.005)], M("ceramic_plain")),
                   (-0.52, 0.2, TZ), {"tm": "drag", "tm_step": 2}))
    bm = core.bm_blob(0.07, 0.07, 0.035, seed=5, amp=0.1)
    core.uv_box(bm, 0.1)
    s = core.obj("sagu_tumpuk", bm, food["sagu"], smooth=60, keep_uv=True)
    s.location = (-0.52, 0.2, TZ + 0.045)
    objs.append(s)
    # eggs
    objs.append(at(lathe("mangkuk_telur", [(0.0, 0.0), (0.04, 0.0), (0.075, 0.05), (0.08, 0.055), (0.074, 0.054),
                                           (0.038, 0.006), (0.0, 0.005)], M("ceramic_plain")),
                   (0.0, 0.3, TZ), {"tm": "drag", "tm_step": 4}))
    for k in range(3):
        a = k * math.tau / 3
        bm = core.bm_sphere(0.022, 14, 10)
        core.bm_xform(bm, scale=(1, 1, 1.3))
        core.uv_box(bm, 0.05)
        e = core.obj(f"telur{k}", bm, food["cangkang"], smooth=60, keep_uv=True)
        e.location = (math.cos(a) * 0.028, 0.3 + math.sin(a) * 0.028, TZ + 0.035)
        objs.append(e)
    # kapal selam: raw on a plate, fried version (hidden at start)
    objs.append(lathe("piring_mentah", [(0.0, 0.0), (0.09, 0.0), (0.12, 0.015), (0.115, 0.017), (0.0, 0.006)],
                      M("ceramic_plain"), loc=(0.48, 0.24, TZ)))
    objs.append(at(kapal_selam("kapal_selam_mentah", food["adonan"]), (0.48, 0.24, TZ + 0.008),
                   {"tm": "drag", "tm_step": 5}))
    # stove and wok
    st = [core.bm_xform(core.bm_box(0.36, 0.3, 0.1, bevel=0.01), loc=(0, 0, 0.05))]
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        st.append(core.bm_xform(core.bm_box(0.06, 0.015, 0.02), loc=(math.cos(a) * 0.09, math.sin(a) * 0.09, 0.11),
                                rot=(0, 0, a)))
    bm = core.bm_merge(*st)
    core.uv_box(bm, 0.3)
    stove = core.obj("kompor", bm, M("engine"), keep_uv=True)
    stove.location = (0.55, -0.15, TZ)
    objs.append(stove)
    objs.append(lathe("wajan", [(0.0, 0.0), (0.06, 0.0), (0.15, 0.05), (0.2, 0.1), (0.205, 0.105), (0.195, 0.104),
                                (0.145, 0.055), (0.058, 0.006), (0.0, 0.005)], M("steel"), loc=(0.55, -0.15, TZ + 0.12)))
    bm = core.bm_cyl(0.165, 0.165, 0.004, seg=40)
    ob = core.obj("minyak", bm, food["minyak"], props={"tm": "oil"})
    ob.location = (0.55, -0.15, TZ + 0.2)
    objs.append(ob)
    for sx in (-1, 1):
        bm = core.bm_tube([(sx * 0.2, 0, 0.1), (sx * 0.27, 0, 0.12)], 0.012, seg=6)
        ob = core.obj(f"gagang_wajan{sx}", bm, M("wood_dark"))
        ob.location = (0.55, -0.15, TZ + 0.12)
        objs.append(ob)
    objs.append(at(kapal_selam("kapal_selam_goreng", food["goreng"]), (0.55, -0.15, TZ + 0.17),
                   {"tm": "step"}))
    # serving: plate with cut kapal selam (showing the yolk) and a bowl of cuko
    objs.append(lathe("piring_saji", [(0.0, 0.0), (0.1, 0.0), (0.135, 0.016), (0.13, 0.018), (0.0, 0.006)],
                      M("ceramic"), loc=(0.0, -0.3, TZ)))
    cut = []
    for k in range(4):
        bm = core.bm_box(0.045, 0.05, 0.05, bevel=0.012)
        core.bm_xform(bm, loc=(-0.06 + k * 0.042, 0, 0.03), rot=(0, 0, 0.15 * (k - 1.5)))
        cut.append(bm)
    bm = core.bm_merge(*cut)
    core.uv_box(bm, 0.08)
    ob = core.obj("potongan_pempek", bm, food["goreng"], smooth=40, keep_uv=True, props={"tm": "step"})
    ob.location = (0.0, -0.3, TZ + 0.008)
    objs.append(ob)
    yolk = []
    for k in range(2):
        bm = core.bm_sphere(0.014, 10, 8)
        core.bm_xform(bm, scale=(0.4, 1, 1), loc=(-0.04 + k * 0.042 + 0.0235, 0, 0.032))
        yolk.append(bm)
    ob = core.obj("kuning_potongan", core.bm_merge(*yolk), food["kuning"], smooth=50, props={"tm": "step"})
    ob.location = (0.0, -0.3, TZ + 0.008)
    objs.append(ob)
    objs.append(lathe("mangkuk_cuko", [(0.0, 0.0), (0.035, 0.0), (0.06, 0.045), (0.064, 0.05), (0.059, 0.049),
                                       (0.033, 0.006), (0.0, 0.005)], M("ceramic"), loc=(0.2, -0.32, TZ)))
    bm = core.bm_cyl(0.052, 0.052, 0.003, seg=28)
    ob = core.obj("cuko", bm, food["cuko"], props={"tm": "step"})
    ob.location = (0.2, -0.32, TZ + 0.038)
    objs.append(ob)
    cubes = []
    import random
    rnd = random.Random(3)
    for k in range(9):
        bm = core.bm_box(0.009, 0.009, 0.009, bevel=0.0015)
        core.bm_xform(bm, rot=(rnd.random(), rnd.random(), rnd.random()),
                      loc=(rnd.uniform(-0.03, 0.03), rnd.uniform(-0.03, 0.03), 0.004))
        cubes.append(bm)
    bm = core.bm_merge(*cubes)
    core.uv_box(bm, 0.04)
    ob = core.obj("timun_cuko", bm, food["timun"], keep_uv=True, props={"tm": "step"})
    ob.location = (0.2, -0.32, TZ + 0.038)
    objs.append(ob)
    core.export_glb("pempek", objs)
    if render:
        core.setup_world(sun_elev=45, sun_rot=170)
        core.add_sun(elev=45, azim=170, energy=3.0)
        core.add_camera((0.1, -1.55, TZ + 0.95), (0, 0, TZ), lens=40)
        core.render("pempek", 1000, 640, samples=40)


if __name__ == "__main__":
    main(render="--norender" not in sys.argv)
