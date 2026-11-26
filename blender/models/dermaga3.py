"""Dermaga III: Kampung Kapitan (7 Ulu) and Kampung Al-Munawar (13 Ulu).

Interpretive models from published descriptions:
- Rumah Kapitan: a large timber house raised over an arcaded lower level,
  blending local (limas roof), Chinese and colonial elements; beside it a
  smaller Chinese house with a curved roof and flame-like roof-end ornaments.
- Al-Munawar: Rumah Tinggi, a timber stilt house with a truncated limas roof
  and simbar/tanduk kambing on the ridge; Rumah Batu, a two-storey house with a
  hip roof, wide eaves, tall panel doors, louvred windows and arched vents.
The two kampung are exported as separate GLBs (kapitan.glb, munawar.glb)."""
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


def louvre_tex():
    c = tex.cached("jalusi")
    if c:
        return c
    import numpy as np
    s = 256
    y = np.linspace(0, 1, s, endpoint=False)[:, None] * np.ones((1, s))
    slat = (y * 14) % 1.0
    h = np.clip(slat * 1.2, 0, 1)
    shade = 0.55 + 0.45 * slat
    base = tex.srgb((0.2, 0.33, 0.27))
    col = base[None, None, :] * shade[..., None]
    frame = np.zeros((s, s))
    frame[:, :10] = 1
    frame[:, -10:] = 1
    frame[:10, :] = 1
    frame[-10:, :] = 1
    col = tex.mix(col, tex.srgb((0.16, 0.26, 0.21)), frame)
    r = np.full((s, s), 0.5)
    return tex.save_set("jalusi", col, r, tex.normal_from_height(h - frame, 3.0))


def panel_door_tex(name="pintu_panel", base=(0.42, 0.12, 0.08)):
    c = tex.cached(name)
    if c:
        return c
    import numpy as np
    s = 256
    y, x = np.mgrid[0:s, 0:s] / s
    h = np.zeros((s, s))
    for (x1, x2, y1, y2) in ((0.12, 0.45, 0.08, 0.42), (0.55, 0.88, 0.08, 0.42),
                             (0.12, 0.45, 0.52, 0.92), (0.55, 0.88, 0.52, 0.92)):
        m = (x > x1) & (x < x2) & (y > y1) & (y < y2)
        h = np.where(m, 0.6, h)
        edge = m & ((np.abs(x - x1) < 0.025) | (np.abs(x - x2) < 0.025) | (np.abs(y - y1) < 0.025) |
                    (np.abs(y - y2) < 0.025))
        h = np.where(edge, 0.3, h)
    n = tex.fbm(s, 3, sigmas=(40, 12, 4))
    col = tex.srgb(base)[None, None, :] * (0.75 + 0.35 * h[..., None] + 0.15 * n[..., None])
    r = np.clip(0.45 + 0.2 * n, 0, 1)
    return tex.save_set(name, col, r, tex.normal_from_height(tex.blur(h, 1.0), 4.0))


def vent_tex():
    """Arched vent grille with a plant motif (krawangan)."""
    c = tex.cached("ventilasi")
    if c:
        return c
    import numpy as np
    from PIL import Image, ImageDraw
    s = 256
    img = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(img)
    for k in range(9):
        a = math.pi * (k + 0.5) / 9
        x2, y2 = s / 2 + math.cos(a) * s * 0.42, s - math.sin(a) * s * 0.85
        d.line([s / 2, s - 4, x2, y2], fill=255, width=7)
        d.ellipse([x2 - 12, y2 - 12, x2 + 12, y2 + 12], outline=255, width=6)
    d.arc([10, 20, s - 10, 2 * s - 20], 180, 360, fill=255, width=10)
    m = np.asarray(img).astype(np.float32) / 255
    col = tex.mix(tex.srgb((0.05, 0.04, 0.03)), tex.srgb((0.88, 0.85, 0.78)), m)
    r = np.full((s, s), 0.6)
    return tex.save_set("ventilasi", col, r, tex.normal_from_height(tex.blur(m, 1.0), 3.0))


def box(name, sx, sy, sz, loc, m, uv=1.5, bevel=0.0, swap=False, props=None):
    bm = core.bm_box(sx, sy, sz, bevel=bevel)
    core.bm_xform(bm, loc=loc)
    return core.obj(name, bm, m, uv=("box", uv, swap), props=props)


def facade_panel(name, w, h, loc, rotz, m, uv_size=None):
    """A flat textured rectangle (door, louvre, vent) facing -Y before rotation."""
    bm = core.bm_box(w, 0.05, h)
    core.uv_planar(bm, 1.0, axis="y")
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for lp in f.loops:
            co = lp.vert.co
            lp[uvl].uv = (co.x / w + 0.5, co.z / h + 0.5)
    core.bm_xform(bm, rot=(0, 0, rotz), loc=loc)
    return core.obj(name, bm, m, keep_uv=True)


def stairs(name, x, y, z_top, width, m, steps=None, dir_y=-1):
    steps = steps or max(int(z_top / 0.2), 3)
    bms = []
    for i in range(steps):
        zz = z_top * (i + 1) / steps
        bm = core.bm_box(width, 0.3, 0.06)
        core.bm_xform(bm, loc=(x, y + dir_y * (steps - i) * 0.26, zz - 0.03))
        bms.append(bm)
    for sx in (-1, 1):
        bms.append(core.bm_beam((x + sx * width / 2, y + dir_y * steps * 0.26 - dir_y * 0.1, 0.0),
                                (x + sx * width / 2, y, z_top), 0.08, 0.22))
        bms.append(core.bm_beam((x + sx * width / 2, y + dir_y * steps * 0.26, 0.9),
                                (x + sx * width / 2, y, z_top + 0.9), 0.06, 0.06))
    return core.obj(name, core.bm_merge(*bms), m, uv=("box", 1.2))


# ------------------------------------------------------------- kapitan ----
def rumah_kapitan(ox=0.0, oy=0.0):
    W, D = 18.0, 13.0
    z_up = 2.9
    top = z_up + 3.6
    plaster = M("plaster_white")
    wood = M("wood_dark")
    beam = M("wood_beam")
    parts = []
    # arcaded lower level: piers with arches between, facing the river (-Y)
    piers = []
    n = 7
    for i in range(n + 1):
        x = -W / 2 + W * i / n
        for y in (-D / 2, D / 2):
            bm = core.bm_box(0.6, 0.6, z_up)
            core.bm_xform(bm, loc=(ox + x, oy + y, z_up / 2))
            piers.append(bm)
    for k in range(1, 4):
        for x in (-W / 2, W / 2):
            bm = core.bm_box(0.6, 0.6, z_up)
            core.bm_xform(bm, loc=(ox + x, oy - D / 2 + D * k / 4, z_up / 2))
            piers.append(bm)
    # arch spandrels along the front and back
    for y in (-D / 2, D / 2):
        for i in range(n):
            x1 = -W / 2 + W * i / n + 0.3
            x2 = -W / 2 + W * (i + 1) / n - 0.3
            w = x2 - x1
            r = w / 2
            pts = [(-r, 0.0)]
            for k in range(13):
                a = math.pi - math.pi * k / 12
                pts.append((math.cos(a) * r, math.sin(a) * r * 0.8))
            pts += [(r, 0.0), (r, r * 0.8 + 0.45), (-r, r * 0.8 + 0.45)]
            bm = core.bm_prism(list(reversed(pts)), 0.5)
            core.bm_xform(bm, rot=(math.pi / 2, 0, 0), loc=(ox + (x1 + x2) / 2, oy + y + 0.25, z_up - r * 0.8 - 0.45))
            piers.append(bm)
    parts.append(core.obj("kapitan_arkade", core.bm_merge(*piers), plaster, uv=("box", 2.0)))
    bm = core.bm_box(W + 0.4, D + 0.4, 0.35)
    core.bm_xform(bm, loc=(ox, oy, z_up + 0.17))
    parts.append(core.obj("kapitan_lantai", bm, beam, uv=("box", 2.0)))
    # dark interior under the arcade
    bm = core.bm_box(W - 1.0, D - 1.0, z_up - 0.1)
    core.bm_xform(bm, loc=(ox, oy, z_up / 2))
    parts.append(core.obj("kapitan_kolong", bm, core.flat("kolong_gelap", (0.09, 0.08, 0.07), 0.9)))
    # upper timber walls with tall louvred windows and a central double door
    bm = core.bm_box(W - 2.4, D - 2.0, top - z_up - 0.35)
    core.bm_xform(bm, loc=(ox, oy + 0.6, z_up + 0.35 + (top - z_up - 0.35) / 2))
    parts.append(core.obj("kapitan_dinding", bm, wood, uv=("box", 2.4, True)))
    jal = core.mat("jalusi", louvre_tex(), rough=0.5)
    door = core.mat("pintu_panel", panel_door_tex(), rough=0.5)
    fy = oy - D / 2 + 1.0 + 0.6 - 0.03
    for i in range(6):
        x = -W / 2 + 2.0 + i * (W - 4.0) / 5
        if abs(x) < 1.2:
            continue
        parts.append(facade_panel(f"kapitan_jendela{i}", 1.1, 2.3, (ox + x, fy, z_up + 1.6), 0, jal))
    parts.append(facade_panel("kapitan_pintu", 2.0, 2.7, (ox, fy, z_up + 1.7), 0, door))
    # front veranda with railing and posts
    rail = []
    for i in range(10):
        x = -W / 2 + 0.3 + i * (W - 0.6) / 9
        bm = core.bm_box(0.22, 0.22, top - z_up + 0.2)
        core.bm_xform(bm, loc=(ox + x, oy - D / 2 + 0.25, z_up + (top - z_up) / 2 + 0.2))
        rail.append(bm)
    for zz in (z_up + 0.7, z_up + 1.05):
        bm = core.bm_box(W, 0.08, 0.08)
        core.bm_xform(bm, loc=(ox, oy - D / 2 + 0.25, zz))
        rail.append(bm)
    for i in range(60):
        x = -W / 2 + 0.3 + i * (W - 0.6) / 59
        bm = core.bm_box(0.05, 0.05, 0.7)
        core.bm_xform(bm, loc=(ox + x, oy - D / 2 + 0.25, z_up + 0.7))
        rail.append(bm)
    parts.append(core.obj("kapitan_pagar", core.bm_merge(*rail), beam, uv=("box", 1.0)))
    parts.append(stairs("kapitan_tangga", ox, oy - D / 2 + 0.1, z_up + 0.35, 2.6, beam))
    # big limas roof with dark tiles, simbar at the ridge ends
    rf = orn.hip_roof(W - 1.0, D - 1.0, 4.4, overhang=1.4, concave=0.12, thick=0.14)
    core.bm_xform(rf, loc=(ox, oy, top + 0.2))
    parts.append(core.obj("kapitan_atap", rf, M("roof_tile_dark"), keep_uv=True, smooth=30))
    rd = orn.hip_ridges(W - 1.0, D - 1.0, 4.4, overhang=1.4, radius=0.09)
    core.bm_xform(rd, loc=(ox, oy, top + 0.2))
    parts.append(core.obj("kapitan_bubungan", rd, M("roof_tile_dark"), smooth=50))
    R = (W - D) / 2
    sb = []
    for sx in (-1, 1):
        s = orn.simbar(0.9, 0.3, 0.06)
        core.bm_xform(s, rot=(0, 0, math.pi / 2), loc=(ox + sx * R, oy, top + 4.65))
        sb.append(s)
    parts.append(core.obj("kapitan_simbar", core.bm_merge(*sb), M("wood_dark"), smooth=50))
    # plaster cornice band at the floor line (colonial touch)
    bm = core.bm_box(W + 0.7, D + 0.7, 0.18)
    core.bm_xform(bm, loc=(ox, oy, z_up - 0.05))
    parts.append(core.obj("kapitan_lis", bm, plaster, uv=("box", 2.0)))
    return parts


def chinese_house(ox, oy):
    W, D = 10.0, 8.0
    parts = []
    plaster = M("plaster_white")
    red = M("red_lacquer")
    bm = core.bm_box(W + 1.2, D + 1.4, 0.6, bevel=0.04)
    core.bm_xform(bm, loc=(ox, oy, 0.3))
    parts.append(core.obj("tionghoa_alas", bm, core.mat("batu_alas", tex.concrete("batu_alas", (0.55, 0.53, 0.5), seed=81)),
                          uv=("box", 2.0)))
    bm = core.bm_box(W, D, 3.4)
    core.bm_xform(bm, loc=(ox, oy, 0.6 + 1.7))
    parts.append(core.obj("tionghoa_dinding", bm, plaster, uv=("box", 3.0)))
    cols = []
    for x in (-W / 2 - 0.1, -1.6, 1.6, W / 2 + 0.1):
        bm = core.bm_cyl(0.22, 0.22, 3.4, seg=14)
        core.bm_xform(bm, loc=(ox + x, oy - D / 2 - 0.55, 0.6 + 1.7))
        cols.append(bm)
    parts.append(core.obj("tionghoa_tiang", core.bm_merge(*cols), red, smooth=45))
    door = core.mat("pintu_merah", panel_door_tex("pintu_merah", (0.5, 0.05, 0.05)), rough=0.4)
    parts.append(facade_panel("tionghoa_pintu", 2.2, 2.7, (ox, oy - D / 2 - 0.03, 0.6 + 1.35), 0, door))
    for x in (-3.3, 3.3):
        parts.append(facade_panel(f"tionghoa_jendela{x:+.0f}", 1.1, 1.3, (ox + x, oy - D / 2 - 0.03, 0.6 + 1.9), 0,
                                  core.mat("jalusi", louvre_tex(), rough=0.5)))
    # curved saddle roof (atap lengkung): ridge along x rising at the ends
    Wr, Dr = W / 2 + 1.1, D / 2 + 1.6

    def roof_fn(u, v):
        x = -Wr + 2 * Wr * u
        y = -Dr + 2 * Dr * v
        t = abs(y) / Dr
        z = 2.4 * (1 - t) ** 1.6 + 0.35 * (abs(x) / Wr) ** 4 + 0.12 * t ** 3
        return (ox + x, oy + y, 0.6 + 3.4 + z)
    bm = core.bm_grid(30, 24, roof_fn)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for lp in f.loops:
            co = lp.vert.co
            lp[uvl].uv = ((co.x - ox) / 0.32, (co.y - oy) / 0.35)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    core.solidify_bm(bm, 0.12)
    parts.append(core.obj("tionghoa_atap", bm, M("roof_tile_dark"), smooth=40, keep_uv=True))
    # ridge with flame-like curled ends
    pts = [(ox - Wr + 0.4 + 2 * (Wr - 0.4) * k / 20, oy,
            0.6 + 3.4 + 2.55 + 0.35 * ((abs(-Wr + 0.4 + 2 * (Wr - 0.4) * k / 20)) / Wr) ** 4) for k in range(21)]
    rid = [core.bm_tube(pts, 0.16, seg=8)]
    for sx in (-1, 1):
        flame = []
        base = V(pts[0] if sx < 0 else pts[-1])
        for k in range(10):
            a = k / 9 * math.pi * 1.1
            flame.append(tuple(base + V((sx * (0.2 + math.sin(a) * 0.55), 0, (1 - math.cos(a)) * 0.6))))
        rid.append(core.bm_tube(flame, 0.13, seg=8, radii=[0.15 - 0.012 * k for k in range(10)]))
    parts.append(core.obj("tionghoa_bubung", core.bm_merge(*rid), core.flat("bubung_gelap", (0.16, 0.14, 0.13), 0.6),
                          smooth=50))
    # red lantern pair (lampion) at the entrance
    lan = []
    for x in (-1.6, 1.6):
        bm = core.bm_sphere(0.28, 16, 10)
        core.bm_xform(bm, scale=(1, 1, 1.2), loc=(ox + x, oy - D / 2 - 0.55, 3.45))
        lan.append(bm)
    parts.append(core.obj("tionghoa_lampion", core.bm_merge(*lan),
                          core.flat("lampion", (0.75, 0.06, 0.05), 0.5, emit=(1.0, 0.25, 0.12), emit_strength=0.0),
                          smooth=50, props={"tm_glow": "lantern"}))
    return parts


# ------------------------------------------------------------- munawar ----
def rumah_tinggi(ox, oy):
    W, D = 11.0, 9.0
    z_up = 2.3
    top = z_up + 3.3
    wood = M("wood_planks")
    beam = M("wood_beam")
    parts = []
    stilts = []
    for i in range(5):
        for j in range(4):
            bm = core.bm_box(0.26, 0.26, z_up + 0.2)
            core.bm_xform(bm, loc=(ox - W / 2 + W * i / 4, oy - D / 2 + D * j / 3, (z_up + 0.2) / 2 - 0.2))
            stilts.append(bm)
    parts.append(core.obj("tinggi_tiang", core.bm_merge(*stilts), beam, uv=("box", 1.5)))
    bm = core.bm_box(W + 0.3, D + 0.3, 0.25)
    core.bm_xform(bm, loc=(ox, oy, z_up))
    parts.append(core.obj("tinggi_lantai", bm, beam, uv=("box", 2.0)))
    bm = core.bm_box(W, D, top - z_up)
    core.bm_xform(bm, loc=(ox, oy, z_up + (top - z_up) / 2))
    parts.append(core.obj("tinggi_dinding", bm, M("wood_grey"), uv=("box", 2.0, True)))
    door = core.mat("pintu_coklat", panel_door_tex("pintu_coklat", (0.33, 0.2, 0.1)), rough=0.5)
    vent = core.mat("ventilasi", vent_tex(), rough=0.6)
    for x in (-3.2, 0.0, 3.2):
        w = 1.6 if x == 0 else 1.0
        h = 2.3 if x == 0 else 1.7
        parts.append(facade_panel(f"tinggi_buka{x:+.0f}", w, h, (ox + x, oy - D / 2 - 0.03, z_up + 0.2 + h / 2 + (0 if x == 0 else 0.5)),
                                  0, door if x == 0 else core.mat("jalusi", louvre_tex(), rough=0.5)))
        parts.append(facade_panel(f"tinggi_vent{x:+.0f}", w, 0.45, (ox + x, oy - D / 2 - 0.03, z_up + 0.2 + 2.65), 0, vent))
    parts.append(stairs("tinggi_tangga", ox, oy - D / 2, z_up + 0.12, 1.8, beam))
    # limas terpenggal: truncated hip with a short flat ridge band
    rf = orn.hip_roof(W, D, 3.4, overhang=1.0, concave=0.1, thick=0.12, flat_top=0.35)
    core.bm_xform(rf, loc=(ox, oy, top))
    parts.append(core.obj("tinggi_atap", rf, M("roof_tile"), keep_uv=True, smooth=30))
    rd = orn.hip_ridges(W, D, 3.4, overhang=1.0, flat_top=0.35, radius=0.07)
    core.bm_xform(rd, loc=(ox, oy, top))
    parts.append(core.obj("tinggi_bubungan", rd, M("roof_tile_dark"), smooth=50))
    R = (W - D) / 2
    sb = []
    for sx in (-1, 1):
        s = orn.simbar(0.8, 0.28, 0.055)
        core.bm_xform(s, rot=(0, 0, math.pi / 2), loc=(ox + sx * R, oy, top + 3.45))
        sb.append(s)
    parts.append(core.obj("tinggi_simbar", core.bm_merge(*sb), M("gold"), smooth=50,
                          props={"tm_part": "simbar"}))
    return parts


def rumah_batu(ox, oy):
    W, D = 12.0, 10.0
    parts = []
    plaster = M("plaster_white")
    wood = M("wood_planks")
    jal = core.mat("jalusi", louvre_tex(), rough=0.5)
    door = core.mat("pintu_hijau", panel_door_tex("pintu_hijau", (0.16, 0.3, 0.24)), rough=0.5)
    vent = core.mat("ventilasi", vent_tex(), rough=0.6)
    bm = core.bm_box(W + 1.0, D + 2.4, 0.5)
    core.bm_xform(bm, loc=(ox, oy - 0.7, 0.25))
    parts.append(core.obj("batu_alas", bm, M("concrete"), uv=("box", 2.0)))
    bm = core.bm_box(W, D, 4.6)
    core.bm_xform(bm, loc=(ox, oy, 0.5 + 2.3))
    parts.append(core.obj("batu_lantai1", bm, plaster, uv=("box", 3.0)))
    bm = core.bm_box(W + 0.4, D + 0.4, 0.3)
    core.bm_xform(bm, loc=(ox, oy, 5.25))
    parts.append(core.obj("batu_lis", bm, plaster, uv=("box", 2.0)))
    bm = core.bm_box(W, D, 3.6)
    core.bm_xform(bm, loc=(ox, oy, 5.4 + 1.8))
    parts.append(core.obj("batu_lantai2", bm, M("wood_grey"), uv=("box", 2.0, True)))
    for x in (-4.2, -1.4, 1.4, 4.2):
        parts.append(facade_panel(f"batu_pintu{x:+.0f}", 1.3, 3.4, (ox + x, oy - D / 2 - 0.03, 0.5 + 1.7), 0, door))
        parts.append(facade_panel(f"batu_vent{x:+.0f}", 1.3, 0.65, (ox + x, oy - D / 2 - 0.03, 0.5 + 3.75), 0, vent))
        parts.append(facade_panel(f"batu_jalusi{x:+.0f}", 1.1, 1.9, (ox + x, oy - D / 2 - 0.03, 5.4 + 1.6), 0, jal))
    # front terrace roof on slim posts (jengki louvres hinted by the posts)
    posts = []
    for x in (-W / 2 + 0.3, -2.8, 0.0, 2.8, W / 2 - 0.3):
        bm = core.bm_box(0.3, 0.3, 4.4)
        core.bm_xform(bm, loc=(ox + x, oy - D / 2 - 2.0, 0.5 + 2.2))
        posts.append(bm)
    parts.append(core.obj("batu_tiang", core.bm_merge(*posts), plaster, uv=("box", 2.0)))
    bm = core.bm_box(W + 0.6, 2.6, 0.25)
    core.bm_xform(bm, loc=(ox, oy - D / 2 - 1.3, 5.0))
    parts.append(core.obj("batu_teras", bm, plaster, uv=("box", 2.0)))
    rf = orn.hip_roof(W, D, 3.0, overhang=1.5, concave=0.05, thick=0.12)
    core.bm_xform(rf, loc=(ox, oy, 9.0))
    parts.append(core.obj("batu_atap", rf, M("roof_tile_dark"), keep_uv=True, smooth=30))
    rd = orn.hip_ridges(W, D, 3.0, overhang=1.5, radius=0.07)
    core.bm_xform(rd, loc=(ox, oy, 9.0))
    parts.append(core.obj("batu_bubungan", rd, M("roof_tile_dark"), smooth=50))
    return parts


def ground_patch(name, w, d, loc):
    bm = core.bm_box(w, d, 0.3)
    core.bm_xform(bm, loc=(loc[0], loc[1], -0.1))
    return core.obj(name, bm, M("ground"), uv=("box", 6.0))


def export_group(name, parts):
    by = {}
    special = []
    for o in parts:
        if o.get("tm_glow") or o.get("tm_part"):
            special.append(o)
            continue
        by.setdefault(o.data.materials[0].name, []).append(o)
    final = [core.merge_objects(v, f"{name}_{k}") for k, v in by.items()] + special
    core.export_glb(name, final)
    return final


def main(render=True):
    core.reset()
    core.use_collection("kapitan")
    p = rumah_kapitan(0, 0)
    p += chinese_house(19.0, 2.0)
    p.append(ground_patch("kapitan_tanah", 44, 30, (6, 4)))
    k_final = export_group("kapitan", p)
    if render:
        core.setup_world(sun_elev=50, sun_rot=150)
        core.add_sun(elev=50, azim=150, energy=3.4)
        core.add_camera((-18, -42, 14), (6, 0, 4), lens=40)
        core.render("kapitan", 1000, 620, samples=32)
    core.reset()
    core.use_collection("munawar")
    p = rumah_tinggi(0, 0)
    p += rumah_batu(17.0, 1.0)
    p.append(ground_patch("munawar_tanah", 44, 30, (8, 4)))
    export_group("munawar", p)
    if render:
        core.setup_world(sun_elev=50, sun_rot=150)
        core.add_sun(elev=50, azim=150, energy=3.4)
        core.add_camera((-14, -40, 13), (8, 0, 4), lens=40)
        core.render("munawar", 1000, 620, samples=32)
    _ = k_final


if __name__ == "__main__":
    main(render="--norender" not in sys.argv)
