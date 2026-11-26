"""Roof and ornament generators shared by the building models."""
import math

import bpy  # noqa: F401
import bmesh

import core
from core import V


def _poly_r(theta, sides):
    """Distance factor to a regular polygon edge (1 at corners)."""
    seg = math.tau / sides
    a = (theta % seg) - seg / 2
    return math.cos(a) / math.cos(seg / 2)


def eave_roof(r_in, r_out, h, sides=8, curve=1.7, upturn=0.6, thick=0.12, nt=None, nr=10,
              sx=1.0, sy=1.0, rot=None, tile=(0.32, 0.35)):
    """Chinese-style polygonal roof skirt with concave slope and lifted corners.
    sx/sy stretch it into a rectangle (use sides=4). Returns a bmesh with UVs
    (u along the eave, v down the slope) suited to tex.tiles."""
    nt = nt or sides * 12
    rot = (math.pi / sides) if rot is None else rot
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    grid = []
    for i in range(nt + 1):
        th = math.tau * i / nt
        pf = _poly_r(th - rot, sides)
        corner = abs(math.cos(sides * (th - rot) / 2)) ** 6
        row = []
        for j in range(nr + 1):
            rho = j / nr
            r = (r_in + (r_out - r_in) * rho) / pf
            z = h * (1 - rho) ** curve + upturn * corner * rho ** 3
            row.append(bm.verts.new((math.cos(th) * r * sx, math.sin(th) * r * sy, z)))
        grid.append(row)
    perim = math.tau * r_out
    slope = math.hypot(r_out - r_in, h)
    for i in range(nt):
        for j in range(nr):
            f = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (ii / nt * perim / tile[0], 1 - jj / nr * slope / tile[1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:  # make sure normals face up
        if f.normal.z < 0:
            f.normal_flip()
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thick)
    return bm


def eave_ridges(r_in, r_out, h, sides=8, curve=1.7, upturn=0.6, rot=None, sx=1.0, sy=1.0,
                radius=0.07, lift=0.08):
    """Rounded ridge beads along the roof hips, ending in a curl."""
    rot = (math.pi / sides) if rot is None else rot
    bms = []
    for k in range(sides):
        th = rot + math.tau * k / sides
        pts = []
        for j in range(13):
            rho = j / 12
            pf = _poly_r(th - rot + 1e-6, sides)
            r = (r_in + (r_out - r_in) * rho) / pf
            z = h * (1 - rho) ** curve + upturn * rho ** 3 + lift
            pts.append((math.cos(th) * r * sx, math.sin(th) * r * sy, z))
        # curl at the tip
        last = V(pts[-1])
        out = V((math.cos(th) * sx, math.sin(th) * sy, 0)).normalized()
        for c in range(1, 5):
            a = c / 4 * math.pi * 0.9
            pts.append(tuple(last + out * math.sin(a) * 0.22 + V((0, 0, (1 - math.cos(a)) * 0.22))))
        bms.append(core.bm_tube(pts, radius, seg=6))
    return core.bm_merge(*bms)


def hip_roof(w, d, h, overhang=0.6, ridge=None, concave=0.0, thick=0.1, flat_top=0.0, n=8,
             tile=(0.32, 0.35)):
    """Limas (hip) roof over a w x d footprint centred at origin, base z=0.
    ridge: ridge length along x (defaults to w-d for a classic hip).
    flat_top: >0 truncates the apex into a small flat (limas terpenggal)."""
    W, D = w / 2 + overhang, d / 2 + overhang
    R = (max(w - d, 0) / 2) if ridge is None else ridge / 2
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    # four slopes as grids between eave edge and ridge line
    sides = [
        ((-W, -D), (W, -D), (-R, -flat_top), (R, -flat_top)),
        ((W, D), (-W, D), (R, flat_top), (-R, flat_top)),
        ((W, -D), (W, D), (R, -flat_top), (R, flat_top)),
        ((-W, D), (-W, -D), (-R, flat_top), (-R, -flat_top)),
    ]
    for (a, b, ra, rb) in sides:
        verts = []
        for j in range(n + 1):
            t = j / n
            z = h * (t - concave * math.sin(t * math.pi) * 0.5)
            p0 = (a[0] + (ra[0] - a[0]) * t, a[1] + (ra[1] - a[1]) * t)
            p1 = (b[0] + (rb[0] - b[0]) * t, b[1] + (rb[1] - b[1]) * t)
            verts.append((bm.verts.new((*p0, z)), bm.verts.new((*p1, z))))
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        slope = math.hypot(math.hypot(ra[0] - a[0], ra[1] - a[1]), h)
        for j in range(n):
            (v0, v1), (v2, v3) = verts[j], verts[j + 1]
            try:
                f = bm.faces.new((v0, v1, v3, v2))
            except ValueError:
                continue
            for lp, (uu, vv) in zip(f.loops, ((0, j), (1, j), (1, j + 1), (0, j + 1))):
                lp[uvl].uv = (uu * L / tile[0], 1 - vv / n * slope / tile[1])
    if flat_top > 0:
        top = [bm.verts.new((-R, -flat_top, h)), bm.verts.new((R, -flat_top, h)),
               bm.verts.new((R, flat_top, h)), bm.verts.new((-R, flat_top, h))]
        bm.faces.new(top)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thick)
    return bm


def hip_ridges(w, d, h, overhang=0.6, ridge=None, flat_top=0.0, radius=0.06, lift=0.05):
    W, D = w / 2 + overhang, d / 2 + overhang
    R = (max(w - d, 0) / 2) if ridge is None else ridge / 2
    bms = []
    for (cx, cy, rx, ry) in ((-W, -D, -R, -flat_top), (W, -D, R, -flat_top), (W, D, R, flat_top),
                             (-W, D, -R, flat_top)):
        bms.append(core.bm_tube([(cx, cy, lift), (rx, ry, h + lift)], radius, seg=6))
    if R > 0.01:
        bms.append(core.bm_tube([(-R, 0, h + lift), (R, 0, h + lift)], radius * 1.3, seg=6))
    return core.bm_merge(*bms)


def simbar(height=0.9, spread=0.35, radius=0.05):
    """Tanduk kambing / simbar: a pair of upswept horn curls for a ridge end."""
    bms = []
    for side in (-1, 1):
        pts = []
        for i in range(14):
            t = i / 13
            a = t * math.pi * 1.25
            x = side * (spread * math.sin(a * 0.8) + 0.04)
            z = height * (1 - (1 - t) ** 2) - (0.25 * height * max(t - 0.7, 0) / 0.3)
            pts.append((x, 0.0, z))
        radii = [radius * (1 - i / 16) for i in range(14)]
        bms.append(core.bm_tube(pts, radius, seg=6, radii=radii))
    return core.bm_merge(*bms)


def arch_outline(w, h, segs=12):
    """Points of a round-headed arch, base at y=0, width w, total height h."""
    r = w / 2
    pts = [(-r, 0.0), (-r, h - r)]
    for i in range(1, segs):
        a = math.pi - math.pi * i / segs
        pts.append((math.cos(a) * r, h - r + math.sin(a) * r))
    pts += [(r, h - r), (r, 0.0)]
    return pts


def arch_window(w, h, depth=0.12, frame=0.12, sill=True):
    """Returns (dark recess bmesh, frame bmesh) in the XZ plane facing -Y."""
    pts = arch_outline(w, h)
    rec = core.bm_prism(list(reversed(pts)), depth)
    core.bm_xform(rec, rot=(math.pi / 2, 0, 0))
    fr_pts = [(x, 0.0, z) for x, z in arch_outline(w + frame, h + frame / 2)]
    fr = core.bm_tube(fr_pts, frame / 2, seg=4)
    out = [fr]
    if sill:
        bm = core.bm_box(w + frame * 3, depth + 0.12, frame * 0.9)
        core.bm_xform(bm, loc=(0, -0.06, -frame * 0.3))
        out.append(bm)
    return rec, core.bm_merge(*out)
