"""Riverside house builders: rumah rakit (floating) and rumah panggung (stilts)."""
import math
import random

import bpy  # noqa: F401
import bmesh  # noqa: F401

import core
import orn
import tex
from mats import M


def wall_planks(x1, x2, y, z1, z2, mat, name, vertical=True, face="S", door=None, windows=(),
                out=None):
    """A plank wall in the XZ plane at depth y (or YZ plane if face is E/W).
    door/windows are (center, width, height, sill) tuples cut as gaps."""
    out = [] if out is None else out
    L = x2 - x1
    pw = 0.2
    n = max(int(L / pw), 1)
    holes = []
    if door:
        holes.append((door[0] - door[1] / 2, door[0] + door[1] / 2, z1, z1 + door[2]))
    for (c, w, h, sill) in windows:
        holes.append((c - w / 2, c + w / 2, z1 + sill, z1 + sill + h))
    bms = []
    for i in range(n):
        a = x1 + L * i / n
        b = x1 + L * (i + 1) / n
        mid = (a + b) / 2
        segs = [(z1, z2)]
        for (h1, h2, hz1, hz2) in holes:
            if h1 < mid < h2:
                new = []
                for (s1, s2) in segs:
                    if hz2 <= s1 or hz1 >= s2:
                        new.append((s1, s2))
                    else:
                        if hz1 > s1:
                            new.append((s1, hz1))
                        if hz2 < s2:
                            new.append((hz2, s2))
                segs = new
        for (s1, s2) in segs:
            if s2 - s1 < 0.02:
                continue
            bm = core.bm_box((b - a) * 0.96, 0.03, s2 - s1)
            core.bm_xform(bm, loc=(mid, 0, (s1 + s2) / 2))
            bms.append(bm)
    bm = core.bm_merge(*bms)
    core.uv_box(bm, 1.6, swap=True)
    rot = {"S": 0, "N": math.pi, "E": math.pi / 2, "W": -math.pi / 2}[face]
    core.bm_xform(bm, rot=(0, 0, rot))
    if face in ("S", "N"):
        core.bm_xform(bm, loc=(0, y, 0))
    else:
        core.bm_xform(bm, loc=(y, 0, 0))
    ob = core.obj(name, bm, mat, keep_uv=True)
    out.append(ob)
    return out


def frame_openings(cx, y, z, w, h, mat, face="S", shutters=None, glass=None):
    """Window/door frame with optional open shutters, oriented like wall_planks."""
    bms = []
    t = 0.07
    for (bx, bz, sx, sz) in ((cx, z + h / 2, t, h + t * 2), ):
        pass
    for dx in (-w / 2 - t / 2, w / 2 + t / 2):
        bm = core.bm_box(t, 0.1, h + 2 * t)
        core.bm_xform(bm, loc=(cx + dx, 0, z + h / 2))
        bms.append(bm)
    for dz in (z - t / 2, z + h + t / 2):
        bm = core.bm_box(w + 2 * t, 0.1, t)
        core.bm_xform(bm, loc=(cx, 0, dz))
        bms.append(bm)
    rot = {"S": 0, "N": math.pi, "E": math.pi / 2, "W": -math.pi / 2}[face]
    out = core.bm_merge(*bms)
    sh = None
    if shutters is not None:
        sb = []
        for side in (-1, 1):
            bm = core.bm_box(w / 2, 0.04, h)
            core.bm_xform(bm, loc=(side * w / 4, 0, 0))
            core.bm_xform(bm, rot=(0, 0, side * 1.9))
            core.bm_xform(bm, loc=(cx + side * w / 2, -0.06, z + h / 2))
            sb.append(bm)
        sh = core.bm_merge(*sb)
    res = []
    for b in (out, sh):
        if b is None:
            res.append(None)
            continue
        core.bm_xform(b, rot=(0, 0, rot))
        if face in ("S", "N"):
            core.bm_xform(b, loc=(0, y, 0))
        else:
            core.bm_xform(b, loc=(y, 0, 0))
        res.append(b)
    return res


def gable_roof(w, d, h, overhang=0.5, thick=0.08, tile=(0.32, 0.35)):
    """Pelana roof, ridge along x, footprint w x d centred, base z=0."""
    W, D = w / 2 + overhang, d / 2 + overhang
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    slope = math.hypot(D, h)
    for sy in (-1, 1):
        a = bm.verts.new((-W, sy * D, 0))
        b = bm.verts.new((W, sy * D, 0))
        c = bm.verts.new((W, 0, h))
        e = bm.verts.new((-W, 0, h))
        f = bm.faces.new((a, b, c, e) if sy < 0 else (b, a, e, c))
        for lp in f.loops:
            co = lp.vert.co
            lp[uvl].uv = (co.x / tile[0], 1 - (abs(co.y) - D) / -slope * slope / tile[1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thick)
    return bm


def gable_ends(w, d, h, y_inset=0.0):
    """Triangular gable infill planks at both x ends."""
    bms = []
    for sx in (-1, 1):
        pts = [(-d / 2, 0), (d / 2, 0), (0, h)]
        bm = core.bm_prism(pts, 0.04, center_z=True)
        core.bm_xform(bm, rot=(math.pi / 2, 0, math.pi / 2), loc=(sx * w / 2, 0, 0))
        bms.append(bm)
    return core.bm_merge(*bms)


def rumah_rakit(prefix, seed=0, roof="thatch", wall="wood_grey", paint=None, veranda=True,
                w=6.4, d=4.4, ver_d=3.0, roof_sep=True):
    """Floating house. Front (river side) faces -Y. Floor top at z=0.47."""
    rnd = random.Random(seed)
    parts = []
    bamboo = M("bamboo")
    beam = M("wood_beam")
    floor_m = M("wood_planks")
    walls_m = M(wall) if paint is None else M(paint)
    L = w + 1.4
    depth = d + (ver_d if veranda else 0) + 0.8
    y0 = -(ver_d if veranda else 0) - 0.4
    logs = []
    n = int(depth / 0.46)
    for i in range(n):
        y = y0 + 0.23 + i * 0.46
        bm = core.bm_cyl(0.21, 0.21, L, seg=10)
        core.bm_xform(bm, rot=(0, math.pi / 2, 0), loc=(0, y, 0.02))
        logs.append(bm)
    bm = core.bm_merge(*logs)
    core.uv_cyl(bm, 0.6, 3.0, axis="x")
    parts.append(core.obj(f"{prefix}_rakit", bm, bamboo, keep_uv=True, smooth=50))
    cross = []
    for x in [-L / 2 + 0.3 + k * (L - 0.6) / 4 for k in range(5)]:
        bm = core.bm_box(0.18, depth + 0.2, 0.16)
        core.bm_xform(bm, loc=(x, y0 + depth / 2, 0.3))
        cross.append(bm)
    parts.append(core.obj(f"{prefix}_balok", core.bm_merge(*cross), beam, uv=("box", 1.5, True)))
    bm = core.bm_box(L - 0.3, depth - 0.1, 0.06)
    core.bm_xform(bm, loc=(0, y0 + depth / 2, 0.44))
    parts.append(core.obj(f"{prefix}_lantai", bm, floor_m, uv=("box", 2.0)))
    fz = 0.47
    top = fz + 2.55
    # house walls (enclosed room from y=0 to y=d)
    wins = [(-w / 4, 0.9, 0.9, 0.85), (w / 4, 0.9, 0.9, 0.85)]
    wall_planks(-w / 2, w / 2, 0.0, fz, top, walls_m, f"{prefix}_dinding_depan", face="S",
                door=(0.0, 0.95, 2.0), windows=wins, out=parts)
    wall_planks(-w / 2, w / 2, d, fz, top, walls_m, f"{prefix}_dinding_belakang", face="S", out=parts)
    for sx in (-1, 1):
        wall_planks(0.0, d, sx * w / 2, fz, top, walls_m, f"{prefix}_dinding_samping{sx}", face="E",
                    windows=[(d / 2, 0.8, 0.85, 0.9)], out=parts)
        _ = sx
    # fix side walls orientation: built along x then rotated; shift into place
    for ob in parts[-2:]:
        ob.location = (0, 0, 0)
    frames = []
    for (c, ww, hh, sill) in wins:
        fr, sh = frame_openings(c, -0.02, fz + sill, ww, hh, beam, shutters=True)
        frames += [fr, sh]
    fr, _ = frame_openings(0.0, -0.02, fz, 0.95, 2.0, beam)
    frames.append(fr)
    parts.append(core.obj(f"{prefix}_kusen", core.bm_merge(*frames), M("wood_dark"), uv=("box", 1.0)))
    # dark interior box to stop see-through openings
    bm = core.bm_box(w - 0.1, d - 0.1, 2.5)
    core.bm_xform(bm, loc=(0, d / 2, fz + 1.25))
    for f in bm.faces:
        f.normal_flip()
    parts.append(core.obj(f"{prefix}_ruang", bm, core.flat("ruang_gelap", (0.06, 0.045, 0.035), 0.9)))
    posts = []
    if veranda:
        for x in (-w / 2 + 0.1, -w / 6, w / 6, w / 2 - 0.1):
            bm = core.bm_box(0.14, 0.14, top - fz + 0.2)
            core.bm_xform(bm, loc=(x, -ver_d + 0.15, fz + (top - fz + 0.2) / 2))
            posts.append(bm)
        for sx in (-1, 1):  # side rails of the veranda
            for z in (fz + 0.45, fz + 0.85):
                bm = core.bm_box(0.06, ver_d - 0.1, 0.07)
                core.bm_xform(bm, loc=(sx * (w / 2 - 0.1), -ver_d / 2, z))
                posts.append(bm)
            for k in range(5):
                bm = core.bm_box(0.05, 0.05, 0.85)
                core.bm_xform(bm, loc=(sx * (w / 2 - 0.1), -ver_d + 0.3 + k * (ver_d - 0.5) / 4, fz + 0.43))
                posts.append(bm)
        bm = core.bm_box(w, 0.16, 0.18)
        core.bm_xform(bm, loc=(0, -ver_d + 0.15, top + 0.05))
        posts.append(bm)
    parts.append(core.obj(f"{prefix}_tiang", core.bm_merge(*posts) if posts else core.bm_box(0.01, 0.01, 0.01),
                          beam, uv=("box", 1.2)))
    # roof over room + veranda
    rd = d + (ver_d if veranda else 0)
    rc = d / 2 - (ver_d if veranda else 0) / 2
    rmat = {"thatch": M("thatch"), "zinc": M("zinc"), "tile": M("roof_tile")}[roof]
    rf = gable_roof(w, rd, 1.6, overhang=0.55, thick=0.1)
    core.bm_xform(rf, loc=(0, rc, top))
    roof_obj = core.obj(f"{prefix}_atap", rf, rmat, keep_uv=True, props={"tm": "roof"} if roof_sep else None)
    parts.append(roof_obj)
    ge = gable_ends(w, rd, 1.6)
    core.bm_xform(ge, loc=(0, rc, top))
    parts.append(core.obj(f"{prefix}_tebeng", ge, walls_m, uv=("box", 1.6, True),
                          props={"tm": "roof"} if roof_sep else None))
    bm = core.bm_tube([(-w / 2 - 0.6, rc, top + 1.62), (w / 2 + 0.6, rc, top + 1.62)], 0.07, seg=6)
    parts.append(core.obj(f"{prefix}_bubung", bm, beam, props={"tm": "roof"} if roof_sep else None))
    # mooring poles
    poles = []
    for sx in (-1, 1):
        bm = core.bm_cyl(0.07, 0.06, 6.5, seg=8)
        core.bm_xform(bm, loc=(sx * (L / 2 + 0.25), y0 + depth - 0.4, 0.6), rot=(0, sx * 0.05, 0))
        poles.append(bm)
    parts.append(core.obj(f"{prefix}_tiang_tambat", core.bm_merge(*poles), bamboo, uv=("cyl", 0.4, 3.0)))
    # a couple of potted plants and a water jar on the veranda edge
    if veranda and rnd.random() < 0.9:
        pots, leaves = [], []
        for x in (-w / 2 + 0.45, w / 2 - 0.45):
            bm = core.bm_lathe([(0.0, 0.0), (0.14, 0.0), (0.2, 0.26), (0.22, 0.3), (0.19, 0.3), (0.0, 0.28)], seg=16)
            core.bm_xform(bm, loc=(x, -0.35, fz))
            pots.append(bm)
            for k in range(7):
                lb = core.bm_blob(0.05, 0.22, 0.02, seed=k + int(x * 10), amp=0.1, seg=8, rings=5)
                core.bm_xform(lb, loc=(0, 0.16, 0.12), rot=(0.9, 0, 0))
                core.bm_xform(lb, rot=(0, 0, k * math.tau / 7))
                core.bm_xform(lb, loc=(x, -0.35, fz + 0.3))
                leaves.append(lb)
        parts.append(core.obj(f"{prefix}_pot", core.bm_merge(*pots), core.flat("tanah_liat", (0.5, 0.26, 0.15), 0.8),
                              smooth=40))
        parts.append(core.obj(f"{prefix}_daun_pot", core.bm_merge(*leaves), core.flat("daun_pot", (0.16, 0.36, 0.12), 0.6),
                              smooth=60))
    return parts


def fix_side_walls(parts, prefix, w, d):
    """Side walls are built along X and rotated; place them on the house sides."""
    for ob in parts:
        if ob.name.startswith(f"{prefix}_dinding_samping"):
            pass


def rumah_panggung(prefix, seed=0, w=7.0, d=6.0, stilt=2.2, roof="zinc", paint="wood_grey",
                   limas=False, veranda=1.6):
    """Plain riverside stilt house, front (-Y) with a small veranda."""
    rnd = random.Random(seed)
    parts = []
    beam = M("wood_beam")
    walls_m = M(paint)
    st = []
    for i in range(4):
        for j in range(3):
            bm = core.bm_box(0.2, 0.2, stilt + 0.6)
            core.bm_xform(bm, loc=(-w / 2 + w * i / 3, -veranda + (d + veranda) * j / 2, (stilt + 0.6) / 2 - 0.6))
            st.append(bm)
    parts.append(core.obj(f"{prefix}_tiang", core.bm_merge(*st), beam, uv=("box", 1.5)))
    bm = core.bm_box(w + 0.3, d + veranda + 0.2, 0.18)
    core.bm_xform(bm, loc=(0, (d - veranda) / 2, stilt))
    parts.append(core.obj(f"{prefix}_lantai", bm, M("wood_planks"), uv=("box", 2.0)))
    top = stilt + 2.6
    wins = [(-w / 4, 0.9, 1.0, 0.8), (w / 4, 0.9, 1.0, 0.8)]
    wall_planks(-w / 2, w / 2, 0.0, stilt, top, walls_m, f"{prefix}_dinding_depan", face="S",
                door=(0.0, 0.9, 2.0), windows=wins, out=parts)
    wall_planks(-w / 2, w / 2, d, stilt, top, walls_m, f"{prefix}_dinding_belakang", face="S", out=parts)
    for sx in (-1, 1):
        wall_planks(0.0, d, sx * w / 2, stilt, top, walls_m, f"{prefix}_dinding_samping{sx}", face="E",
                    windows=[(d / 2, 0.8, 0.9, 0.9)], out=parts)
    bm = core.bm_box(w - 0.1, d - 0.1, 2.5)
    core.bm_xform(bm, loc=(0, d / 2, stilt + 1.25))
    for f in bm.faces:
        f.normal_flip()
    parts.append(core.obj(f"{prefix}_ruang", bm, core.flat("ruang_gelap", (0.06, 0.045, 0.035), 0.9)))
    frames = []
    for (c, ww, hh, sill) in wins:
        fr, sh = frame_openings(c, -0.02, stilt + sill, ww, hh, beam, shutters=True)
        frames += [fr, sh]
    fr, _ = frame_openings(0.0, -0.02, stilt, 0.9, 2.0, beam)
    frames.append(fr)
    parts.append(core.obj(f"{prefix}_kusen", core.bm_merge(*frames), M("wood_dark"), uv=("box", 1.0)))
    rails = []
    for x in (-w / 2 + 0.1, w / 2 - 0.1):
        bm = core.bm_box(0.12, 0.12, top - stilt)
        core.bm_xform(bm, loc=(x, -veranda + 0.1, stilt + (top - stilt) / 2))
        rails.append(bm)
    bm = core.bm_box(w, 0.07, 0.07)
    core.bm_xform(bm, loc=(0, -veranda + 0.1, stilt + 0.85))
    rails.append(bm)
    for k in range(14):
        x = -w / 2 + 0.2 + k * (w - 0.4) / 13
        if abs(x) < 0.6:
            continue
        bm = core.bm_box(0.05, 0.05, 0.85)
        core.bm_xform(bm, loc=(x, -veranda + 0.1, stilt + 0.43))
        rails.append(bm)
    parts.append(core.obj(f"{prefix}_pagar", core.bm_merge(*rails), beam, uv=("box", 1.2)))
    # steps down from the veranda
    stp = []
    n = int(stilt / 0.25)
    for i in range(n):
        bm = core.bm_box(1.0, 0.26, 0.05)
        core.bm_xform(bm, loc=(0, -veranda - 0.2 - (n - 1 - i) * 0.24, stilt * (i + 1) / n - 0.03))
        stp.append(bm)
    parts.append(core.obj(f"{prefix}_tangga", core.bm_merge(*stp), beam, uv=("box", 1.0)))
    rmat = {"thatch": M("thatch"), "zinc": M("zinc"), "tile": M("roof_tile"), "tile_dark": M("roof_tile_dark")}[roof]
    rd = d + veranda
    rc = (d - veranda) / 2
    if limas:
        rf = orn.hip_roof(w, rd, 2.2, overhang=0.6, concave=0.1, thick=0.1)
    else:
        rf = gable_roof(w, rd, 1.7, overhang=0.6, thick=0.08)
    core.bm_xform(rf, loc=(0, rc, top))
    parts.append(core.obj(f"{prefix}_atap", rf, rmat, keep_uv=True))
    if not limas:
        ge = gable_ends(w, rd, 1.7)
        core.bm_xform(ge, loc=(0, rc, top))
        parts.append(core.obj(f"{prefix}_tebeng", ge, walls_m, uv=("box", 1.6, True)))
    _ = rnd
    return parts
