"""Jembatan Ampera, built at real scale from the published span layout:
A1-P1 22.5 m, four 58.5 m spans, a 75 m centre span between the towers,
22 m deck, towers about 63 m, deck about 11.5 m above the water.
The centre span, its lift cables, the five light segments and the clock
hands are separate named objects so the site can animate them."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
import core  # noqa: E402
import tex  # noqa: E402
from core import V  # noqa: E402
from mats import M  # noqa: E402

DECK_Z = 11.5
HALF_W = 11.0
PIERS = [-154.5, -96.0, 96.0, 154.5]
TOWERS = [-37.5, 37.5]
END = 177.0
LEG_Y = 13.2
LEG_X, LEG_W = 4.6, 3.4
HEAD_Z0, HEAD_Z1 = 55.5, 63.0


def clock_dial():
    path = os.path.join(tex.TEX_DIR, "jam_ampera_c.png")
    if os.path.exists(path) and not os.environ.get("RETEX"):
        return {"c": path}
    s = 1024
    img = Image.new("RGB", (s, s), (240, 236, 222))
    d = ImageDraw.Draw(img)
    c = s / 2
    d.ellipse([8, 8, s - 8, s - 8], outline=(28, 26, 24), width=26)
    d.ellipse([60, 60, s - 60, s - 60], outline=(150, 40, 36), width=6)
    for i in range(60):
        a = math.radians(i * 6)
        big = i % 5 == 0
        r1 = c - 80
        r2 = c - (175 if big else 110)
        w = 22 if big else 7
        d.line([c + math.sin(a) * r1, c - math.cos(a) * r1, c + math.sin(a) * r2, c - math.cos(a) * r2],
               fill=(28, 26, 24), width=w)
    d.ellipse([c - 26, c - 26, c + 26, c + 26], fill=(28, 26, 24))
    img.save(path)
    return {"c": path}


def ibeam(x1, x2, y, ztop, depth, flange=0.6, web=0.05, tf=0.06):
    L = x2 - x1
    out = []
    for z, h, w in ((ztop - tf / 2, tf, flange), (ztop - depth + tf / 2, tf, flange),
                    (ztop - depth / 2, depth - 2 * tf, web)):
        bm = core.bm_box(L, w, h)
        core.bm_xform(bm, loc=((x1 + x2) / 2, y, z))
        out.append(bm)
    return core.bm_merge(*out)


def span_deck(x1, x2, name, parts, light_groups, lift=False):
    red = M("ampera_red")
    conc = M("concrete")
    asph = M("asphalt")
    paint = core.flat("cat_jalan", (0.86, 0.85, 0.8), rough=0.6)
    L = x2 - x1
    xc = (x1 + x2) / 2
    tag = {"tm": "lift"} if lift else {}
    # slab and road
    bm = core.bm_box(L, 2 * HALF_W, 0.45)
    core.bm_xform(bm, loc=(xc, 0, DECK_Z - 0.225))
    parts.append(core.obj(f"{name}_pelat", bm, conc, uv=("box", 6.0), props=tag))
    bm = core.bm_box(L, 14.0, 0.06)
    core.bm_xform(bm, loc=(xc, 0, DECK_Z + 0.03))
    parts.append(core.obj(f"{name}_aspal", bm, asph, uv=("box", 6.0), props=tag))
    for side in (-1, 1):
        bm = core.bm_box(L, 3.9, 0.28, bevel=0.03)
        core.bm_xform(bm, loc=(xc, side * 9.05, DECK_Z + 0.14))
        parts.append(core.obj(f"{name}_trotoar{side}", bm, conc, uv=("box", 3.0), props=tag))
    # lane markings
    dashes = []
    for ly in (-3.5, 0.0, 3.5):
        x = x1 + 1.5
        while x + 3 < x2:
            bm = core.bm_box(3.0, 0.15 if ly else 0.18, 0.012)
            core.bm_xform(bm, loc=(x + 1.5, ly, DECK_Z + 0.066))
            dashes.append(bm)
            x += 9.0 if ly else 6.0
    if dashes:
        parts.append(core.obj(f"{name}_marka", core.bm_merge(*dashes), paint, props=tag))
    # girders underneath (the view from a boat)
    gbms = []
    for gy in (-10.2, -6.1, -2.0, 2.0, 6.1, 10.2):
        gbms.append(ibeam(x1, x2, gy, DECK_Z - 0.45, 2.4 if not lift else 2.0))
    nx = max(int(L / 7.5), 1)
    for i in range(nx + 1):
        x = x1 + L * i / nx
        for k in range(5):
            ya = (-10.2, -6.1, -2.0, 2.0, 6.1)[k]
            yb = (-6.1, -2.0, 2.0, 6.1, 10.2)[k]
            gbms.append(core.bm_beam((x, ya, DECK_Z - 1.6), (x, yb, DECK_Z - 1.6), 0.25, 0.9))
    parts.append(core.obj(f"{name}_gelagar", core.bm_merge(*gbms), red, uv=("box", 4.0), props=tag))
    # fascia plates with railing
    rails = []
    for side in (-1, 1):
        bm = core.bm_box(L, 0.18, 1.2)
        core.bm_xform(bm, loc=(xc, side * (HALF_W + 0.09), DECK_Z - 0.2))
        rails.append(bm)
        n = max(int(L / 2.0), 1)
        for i in range(n + 1):
            bm = core.bm_box(0.1, 0.1, 1.1)
            core.bm_xform(bm, loc=(x1 + L * i / n, side * (HALF_W - 0.15), DECK_Z + 0.83))
            rails.append(bm)
        for rz in (0.75, 1.35):
            bm = core.bm_box(L, 0.08, 0.08)
            core.bm_xform(bm, loc=(xc, side * (HALF_W - 0.15), DECK_Z + rz))
            rails.append(bm)
    parts.append(core.obj(f"{name}_pagar", core.bm_merge(*rails), red, uv=("box", 2.0), props=tag))
    # street lamps
    lamps, heads = [], []
    n = max(int(L / 25.0), 1)
    for i in range(n):
        x = x1 + L * (i + 0.5) / n
        for side in (-1, 1):
            y = side * (HALF_W - 0.4)
            lamps.append(core.bm_tube([(x, y, DECK_Z + 0.28), (x, y, DECK_Z + 9.0),
                                       (x, y - side * 0.6, DECK_Z + 9.6), (x, y - side * 1.8, DECK_Z + 9.7)],
                                      0.09, seg=8))
            bm = core.bm_box(0.7, 0.35, 0.16, bevel=0.04)
            core.bm_xform(bm, loc=(x, y - side * 1.9, DECK_Z + 9.62))
            heads.append(bm)
    if lamps:
        parts.append(core.obj(f"{name}_tiang_lampu", core.bm_merge(*lamps), M("steel"), smooth=50, props=tag))
        parts.append(core.obj(f"{name}_kepala_lampu", core.bm_merge(*heads),
                              core.flat("lampu_jalan", (0.95, 0.9, 0.8), 0.3, emit=(1.0, 0.78, 0.5),
                                        emit_strength=0.0),
                              props={**tag, "tm_glow": "street"}))
    # LED strip along the fascia bottom: belongs to a light segment
    for side in (-1, 1):
        bm = core.bm_box(L, 0.08, 0.08)
        core.bm_xform(bm, loc=(xc, side * (HALF_W + 0.2), DECK_Z - 0.82))
        light_groups.setdefault(seg_for_x(xc), []).append(bm)


def seg_for_x(x):
    if x < -40:
        return 1
    if x < -34:
        return 2
    if x <= 34:
        return 3
    if x <= 40:
        return 4
    return 5


def pier(x, parts):
    conc = M("concrete")
    bms = []
    for y in (-7.0, 0.0, 7.0):
        bm = core.bm_box(2.4, 2.4, DECK_Z - 2.4 + 2.0, bevel=0.12)
        core.bm_xform(bm, loc=(x, y, (DECK_Z - 2.4 - 2.0) / 2))
        bms.append(bm)
    bm = core.bm_box(3.2, 23.0, 1.6, bevel=0.1)
    core.bm_xform(bm, loc=(x, 0, DECK_Z - 3.2))
    bms.append(bm)
    bm = core.bm_box(5.5, 20.0, 2.2, bevel=0.2)
    core.bm_xform(bm, loc=(x, 0, -0.4))
    bms.append(bm)
    parts.append(core.obj(f"pilar{x:+.0f}", core.bm_merge(*bms), conc, uv=("box", 4.0)))


def tower(x, parts, light_groups):
    red = M("ampera_red")
    conc = M("concrete")
    seg = 2 if x < 0 else 4
    # caisson
    bm = core.bm_box(14.0, 34.0, 4.5, bevel=0.4)
    core.bm_xform(bm, loc=(x, 0, -0.75))
    parts.append(core.obj(f"kaison{x:+.0f}", bm, conc, uv=("box", 4.0)))
    bms = []
    leds = []
    for sy in (-1, 1):
        y = sy * LEG_Y
        bm = core.bm_box(LEG_X, LEG_W, HEAD_Z0 - 1.5, bevel=0.18, segs=2)
        core.bm_xform(bm, loc=(x, y, 1.5 + (HEAD_Z0 - 1.5) / 2))
        bms.append(bm)
        # stiffener rings
        z = 6.0
        while z < HEAD_Z0 - 2:
            bm = core.bm_box(LEG_X + 0.35, LEG_W + 0.35, 0.45, bevel=0.06)
            core.bm_xform(bm, loc=(x, y, z))
            bms.append(bm)
            z += 6.5
        # recessed vertical panel faces (along the river view)
        for fx in (-1, 1):
            bm = core.bm_box(0.12, LEG_W * 0.55, HEAD_Z0 - 6.0)
            core.bm_xform(bm, loc=(x + fx * (LEG_X / 2 + 0.02), y, (HEAD_Z0 + 4.0) / 2))
            bms.append(bm)
        # machinery head with pyramid roof
        bm = core.bm_box(6.4, 4.6, HEAD_Z1 - HEAD_Z0, bevel=0.15)
        core.bm_xform(bm, loc=(x, y, (HEAD_Z0 + HEAD_Z1) / 2))
        bms.append(bm)
        bm = core.bm_box(7.0, 5.2, 0.5, bevel=0.08)
        core.bm_xform(bm, loc=(x, y, HEAD_Z1 + 0.25))
        bms.append(bm)
        roof = core.bm_cyl(4.6, 0.25, 3.2, seg=4)
        core.bm_xform(roof, rot=(0, 0, math.pi / 4), scale=(1.0, 0.75, 1.0))
        core.bm_xform(roof, loc=(x, y, HEAD_Z1 + 2.1))
        bms.append(roof)
        # LED outline: four vertical strips per leg + head ring
        for cx in (-1, 1):
            for cy in (-1, 1):
                bm = core.bm_box(0.12, 0.12, HEAD_Z0 - 13.0)
                core.bm_xform(bm, loc=(x + cx * (LEG_X / 2 + 0.06), y + cy * (LEG_W / 2 + 0.06),
                                       13.0 + (HEAD_Z0 - 13.0) / 2))
                leds.append(bm)
        for zz in (HEAD_Z0 + 0.1, HEAD_Z1 - 0.1):
            for (dx, dy, lx, ly) in ((0, -2.36, 6.5, 0.12), (0, 2.36, 6.5, 0.12),
                                     (-3.26, 0, 0.12, 4.7), (3.26, 0, 0.12, 4.7)):
                bm = core.bm_box(lx, ly, 0.12)
                core.bm_xform(bm, loc=(x + dx, y + dy, zz))
                leds.append(bm)
    # portal beam between the two legs below the heads
    bm = core.bm_box(2.4, 2 * LEG_Y, 2.6, bevel=0.1)
    core.bm_xform(bm, loc=(x, 0, HEAD_Z0 - 1.6))
    bms.append(bm)
    for k in range(-3, 4):  # portal stiffeners
        bm = core.bm_box(2.6, 0.25, 2.8)
        core.bm_xform(bm, loc=(x, k * 3.2, HEAD_Z0 - 1.6))
        bms.append(bm)
    parts.append(core.obj(f"menara{x:+.0f}", core.bm_merge(*bms), red, smooth=35, uv=("box", 5.0),
                          props={"tm": "tower"}))
    light_groups.setdefault(seg, []).extend(leds)


def truss(parts, light_groups):
    red = M("ampera_red")
    x1, x2 = TOWERS[0] + LEG_X / 2 + 1.6, TOWERS[1] - LEG_X / 2 - 1.6
    zt, zb = HEAD_Z0 - 0.6, HEAD_Z0 - 5.0
    bms, leds = [], []
    n = 10
    for sy in (-1, 1):
        y = sy * LEG_Y
        bms.append(core.bm_beam((x1, y, zt), (x2, y, zt), 0.9, 0.9))
        bms.append(core.bm_beam((x1, y, zb), (x2, y, zb), 0.9, 0.9))
        for i in range(n + 1):
            x = x1 + (x2 - x1) * i / n
            bms.append(core.bm_beam((x, y, zb), (x, y, zt), 0.55, 0.55))
            if i < n:
                xn = x1 + (x2 - x1) * (i + 1) / n
                a, b = ((x, y, zb), (xn, y, zt)) if i % 2 == 0 else ((x, y, zt), (xn, y, zb))
                bms.append(core.bm_beam(a, b, 0.45, 0.45))
        for zz in (zt + 0.5, zb - 0.5):
            bm = core.bm_box(x2 - x1, 0.12, 0.12)
            core.bm_xform(bm, loc=((x1 + x2) / 2, y + sy * 0.52, zz))
            leds.append(bm)
    for i in range(n):  # lateral X bracing at the top chord
        xa = x1 + (x2 - x1) * i / n
        xb = x1 + (x2 - x1) * (i + 1) / n
        bms.append(core.bm_beam((xa, -LEG_Y, zt), (xb, LEG_Y, zt), 0.3, 0.3))
        bms.append(core.bm_beam((xa, LEG_Y, zt), (xb, -LEG_Y, zt), 0.3, 0.3))
    parts.append(core.obj("rangka_atas", core.bm_merge(*bms), red, uv=("box", 4.0)))
    light_groups.setdefault(3, []).extend(leds)


def clocks(parts):
    dial = core.mat("jam_muka", clock_dial(), rough=0.5, emit=(1.0, 0.96, 0.86), emit_strength=0.0)
    black = core.flat("jarum_jam", (0.03, 0.03, 0.03), rough=0.4)
    zc = (HEAD_Z0 + HEAD_Z1) / 2 + 0.2
    for x in TOWERS:
        for sy in (-1, 1):
            y = sy * (LEG_Y + 2.3 + 0.08)
            bm = core.bm_cyl(2.75, 2.75, 0.1, seg=48)
            core.uv_planar(bm, 5.5)
            core.bm_xform(bm, rot=(math.pi / 2, 0, 0 if sy < 0 else math.pi), loc=(x, y, zc))
            parts.append(core.obj(f"jam{x:+.0f}{sy:+d}", bm, dial, keep_uv=True,
                                  props={"tm_glow": "clock"}))
            for kind, L, w in (("jam", 1.55, 0.26), ("menit", 2.35, 0.16)):
                bm = core.bm_box(w, 0.05, L, bevel=0.02)
                core.bm_xform(bm, loc=(0, 0, L / 2 - 0.25))
                hand = core.obj(f"jarum_{kind}{x:+.0f}{sy:+d}", bm, black,
                                props={"tm": f"hand_{kind}", "tm_face": sy})
                hand.location = (x, y + sy * (0.1 if kind == "jam" else 0.16), zc)


def lift_cables(parts):
    steel = M("steel")
    bms = []
    zt = HEAD_Z0 - 3.0
    for x in (TOWERS[0] + LEG_X / 2 + 0.6, TOWERS[1] - LEG_X / 2 - 0.6):
        for sy in (-1, 1):
            for k in range(4):
                y = sy * (LEG_Y - 0.9 + k * 0.25)
                bms.append(core.bm_tube([(x, y, DECK_Z + 0.2), (x, y, zt)], 0.07, seg=6))
    parts.append(core.obj("kabel_angkat", core.bm_merge(*bms), steel, props={"tm": "cables"}))


def approaches(parts):
    conc = M("concrete")
    asph = M("asphalt")
    red = M("ampera_red")
    for sx in (-1, 1):
        x0 = sx * END
        L = 300.0
        n = 20
        bms_s, bms_c, bms_r = [], [], []
        for i in range(n):
            xa = x0 + sx * L * i / n
            xb = x0 + sx * L * (i + 1) / n
            za = DECK_Z - (DECK_Z - 1.0) * (i / n) ** 1.15
            zb = DECK_Z - (DECK_Z - 1.0) * ((i + 1) / n) ** 1.15
            p1, p2 = V((xa, 0, za - 0.6)), V((xb, 0, zb - 0.6))
            bms_s.append(core.bm_beam(p1, p2, 2 * HALF_W, 1.2))
            bms_r.append(core.bm_beam(p1 + V((0, 0, 0.62)), p2 + V((0, 0, 0.62)), 14.0, 0.06))
            for side in (-1, 1):
                bms_r.append(core.bm_beam(p1 + V((0, side * (HALF_W - 0.15), 1.4)),
                                          p2 + V((0, side * (HALF_W - 0.15), 1.4)), 0.12, 0.12))
            if i % 1 == 0 and za > 2.5:
                for y in (-7, 7):
                    bm = core.bm_box(1.6, 1.6, za + 1.0)
                    core.bm_xform(bm, loc=(xa, y, (za - 1.0) / 2 - 0.6))
                    bms_c.append(bm)
        parts.append(core.obj(f"jalan_pendekat{sx:+d}", core.bm_merge(*bms_s), conc, uv=("box", 6.0)))
        parts.append(core.obj(f"aspal_pendekat{sx:+d}", core.bm_merge(*bms_r[0::3]), asph, uv=("box", 6.0)))
        parts.append(core.obj(f"pagar_pendekat{sx:+d}", core.bm_merge(*[b for i, b in enumerate(bms_r) if i % 3]),
                              red, uv=("box", 2.0)))
        if bms_c:
            parts.append(core.obj(f"tiang_pendekat{sx:+d}", core.bm_merge(*bms_c), conc, uv=("box", 4.0)))


def build():
    parts = []
    light_groups = {}
    spans = [(-END, PIERS[0]), (PIERS[0], PIERS[1]), (PIERS[1], TOWERS[0]),
             (TOWERS[1], PIERS[2]), (PIERS[2], PIERS[3]), (PIERS[3], END)]
    for a, b in spans:
        span_deck(a, b, f"bentang{a:+.0f}", parts, light_groups)
    # short deck stubs through the towers
    for x in TOWERS:
        span_deck(x - 1.5, x + 1.5, f"tumpu{x:+.0f}", parts, light_groups)
    lift_parts = []
    span_deck(TOWERS[0] + 1.5, TOWERS[1] - 1.5, "angkat", lift_parts, light_groups, lift=True)
    for x in PIERS:
        pier(x, parts)
    for x in TOWERS:
        tower(x, parts, light_groups)
    truss(parts, light_groups)
    clocks(parts)
    lift_cables(parts)
    approaches(parts)
    led = core.flat("ampera_led", (1.0, 0.86, 0.6), rough=0.4, emit=(1.0, 0.8, 0.5), emit_strength=0.0)
    for seg, bms in sorted(light_groups.items()):
        core.obj(f"lampu_seg{seg}", core.bm_merge(*bms), led, props={"tm": "led", "tm_seg": seg})
    # merge static pieces by material to cut draw calls
    sc = bpy.context.scene
    static = [o for o in sc.objects if o.type == "MESH" and not o.get("tm") and not o.get("tm_glow")
              and o not in lift_parts]
    by_mat = {}
    for o in static:
        by_mat.setdefault(o.data.materials[0].name if o.data.materials else "none", []).append(o)
    for k, objs in by_mat.items():
        core.merge_objects(objs, f"ampera_{k}")
    lift_static = [o for o in lift_parts if not o.get("tm_glow")]
    core.merge_objects(lift_static, "ampera_angkat", {"tm": "lift"})
    glow = [o for o in sc.objects if o.type == "MESH" and o.get("tm_glow") == "street"]
    core.merge_objects(glow, "ampera_lampu_jalan", {"tm_glow": "street"})


def main(render=True):
    core.reset()
    core.use_collection("ampera")
    build()
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    core.export_glb("ampera", objs)
    if render:
        core.setup_world(sun_elev=14, sun_rot=245)
        core.add_sun(elev=14, azim=245, energy=3.2, color=(1.0, 0.86, 0.7))
        core.add_camera((-120, -260, 14), (0, 0, 30), lens=40)
        water = core.flat("_air", (0.07, 0.055, 0.035), rough=0.1)
        core.render("ampera", 1100, 640, samples=32, ground_mat=water)


if __name__ == "__main__":
    main(render="--norender" not in sys.argv)
