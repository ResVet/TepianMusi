"""Perahu ketek: a motorised jukung with a light canopy, as used for river
crossings on the Musi. Also builds two plain jukung variants for ambience."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402,F401
import bmesh  # noqa: E402
import core  # noqa: E402
from core import V  # noqa: E402
from mats import M  # noqa: E402


class Hull:
    def __init__(self, L=9.0, B=1.55, D=0.32, sheer=0.42, bow=0.95, stern=0.62):
        self.L, self.B, self.D = L, B, D
        self.sheer, self.bow, self.stern = sheer, bow, stern

    def b(self, s):
        return max(self.B / 2 * (1 - abs(s) ** 2.3) ** 0.72, 0.012)

    def k(self, s):
        lift = 0.18 * max(s - 0.6, 0) / 0.4 + 0.1 * max(-s - 0.7, 0) / 0.3
        return -self.D * (1 - abs(s) ** 3.2) ** 0.5 + lift * self.D

    def sh(self, s):
        return (self.sheer + (self.bow - self.sheer) * max(s, 0) ** 3.2
                + (self.stern - self.sheer) * max(-s, 0) ** 3.4)

    def point(self, s, t, inset=0.0):
        """s in [-1,1] stern..bow, t in [-1,1] port..starboard."""
        b = max(self.b(s) - inset, 0.004)
        k = self.k(s) + inset
        sh = self.sh(s)
        phi = abs(t) * math.pi / 2
        y = math.copysign(b * math.sin(phi), t)
        z = k + (sh - k) * (1 - math.cos(phi))
        return V((s * self.L / 2, y, z))

    def y_at(self, s, z, inset=0.0):
        b = max(self.b(s) - inset, 0.004)
        k = self.k(s) + inset
        sh = self.sh(s)
        f = min(max((z - k) / max(sh - k, 1e-4), 0), 1)
        phi = math.acos(1 - f)
        return b * math.sin(phi)


def build_hull(h: Hull, name, m_low, m_mid, m_band, m_rim, m_in, nx=64, nt=16, thick=0.035,
               band=(0.70, 0.86)):
    bm = bmesh.new()
    xs = [-1 + 2 * i / nx for i in range(nx + 1)]
    ts = [-1 + 2 * j / nt for j in range(nt + 1)]
    outer = [[bm.verts.new(h.point(s, t)) for t in ts] for s in xs]
    inner = [[bm.verts.new(h.point(s, t, thick)) for t in ts] for s in xs]
    mats = [m_low, m_mid, m_band, m_rim, m_in]
    for i in range(nx):
        for j in range(nt):
            tc = abs((ts[j] + ts[j + 1]) / 2)
            f = bm.faces.new((outer[i][j], outer[i + 1][j], outer[i + 1][j + 1], outer[i][j + 1]))
            zc = (outer[i][j].co.z + outer[i + 1][j + 1].co.z) / 2
            if tc > band[1]:
                f.material_index = 3
            elif tc > band[0]:
                f.material_index = 2
            elif zc < 0.02:
                f.material_index = 0
            else:
                f.material_index = 1
            g = bm.faces.new((inner[i][j + 1], inner[i + 1][j + 1], inner[i + 1][j], inner[i][j]))
            g.material_index = 4
    # rim along both sheers
    for i in range(nx):
        for j in (0, nt):
            a, b2 = outer[i][j], outer[i + 1][j]
            c, d = inner[i + 1][j], inner[i][j]
            f = bm.faces.new((a, d, c, b2) if j == 0 else (a, b2, c, d))
            f.material_index = 3
    # close the stem/stern posts
    for i in (0, nx):
        for j in range(nt):
            try:
                f = bm.faces.new((outer[i][j], outer[i][j + 1], inner[i][j + 1], inner[i][j]))
                f.material_index = 3
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    core.uv_box(bm, 2.2)
    ob = core.obj(name, bm, None, smooth=40, keep_uv=True)
    for m in mats:
        ob.data.materials.append(m)
    return ob


def build_ketek(prefix="ketek", canopy=True, colors=("hull", "hull_white", "hull_red"), L=9.0, x0=0.0):
    h = Hull(L=L, B=1.55 if canopy else 1.2, bow=0.95 if canopy else 0.78)
    parts = []
    m_low = core.flat("cat_bawah", (0.12, 0.08, 0.07), rough=0.7)
    hull = build_hull(h, f"{prefix}_lambung", m_low, M(colors[0]), M(colors[1]), M(colors[2]),
                      M("wood_planks"))
    parts.append(hull)
    wood = M("wood_planks")
    beam = M("wood_beam")
    # floorboards
    fz = h.k(0) + 0.17
    for k in range(-3, 4):
        y = k * 0.11
        s_end = 0.72 if abs(k) < 2 else 0.6
        x1, x2 = -s_end * h.L / 2, s_end * h.L / 2
        bm = core.bm_box(x2 - x1, 0.1, 0.022, bevel=0.004)
        core.bm_xform(bm, loc=((x1 + x2) / 2, y, fz))
        parts.append(core.obj(f"{prefix}_lantai{k+3}", bm, wood, uv=("box", 1.3)))
    # thwarts / benches
    for xb in ([-2.7, -1.45, -0.2, 1.05, 2.3] if canopy else [-1.6, 0.4, 1.9]):
        s = xb / (h.L / 2)
        z = 0.26 if canopy else 0.22
        w = 2 * h.y_at(s, z, 0.035) - 0.01
        bm = core.bm_box(0.26, w, 0.035, bevel=0.006)
        core.bm_xform(bm, loc=(xb, 0, z))
        parts.append(core.obj(f"{prefix}_bangku{xb:+.1f}", bm, beam, uv=("box", 1.0, True)))
        for side in (-1, 1):  # bench cleats
            bm = core.bm_box(0.22, 0.05, 0.12)
            core.bm_xform(bm, loc=(xb, side * (w / 2 - 0.03), z - 0.07))
            parts.append(core.obj(f"{prefix}_klem{xb:+.1f}{side}", bm, beam))
    # gunwale rub rails
    for side in (-1, 1):
        pts = []
        for i in range(41):
            s = -0.97 + 1.94 * i / 40
            p = h.point(s, side * 0.985)
            pts.append(p + V((0, side * 0.012, -0.03)))
        bm = core.bm_tube(pts, 0.028, seg=6)
        parts.append(core.obj(f"{prefix}_bibir{side}", bm, M(colors[2]), smooth=50, uv=("box", 1.0)))
    if canopy:
        # posts and roof
        post_x = [-2.95, -0.8, 1.35]
        for xp in post_x:
            s = xp / (h.L / 2)
            zt = h.sh(s)
            yp = h.y_at(s, zt - 0.02) - 0.06
            for side in (-1, 1):
                bm = core.bm_box(0.06, 0.06, 1.62 - zt + 0.4, bevel=0.008)
                core.bm_xform(bm, loc=(xp, side * yp, zt + (1.62 - zt + 0.4) / 2 - 0.02))
                parts.append(core.obj(f"{prefix}_tiang{xp:+.1f}{side}", bm, M(colors[1]), uv=("box", 1.0)))
        rx1, rx2, rw = -3.35, 1.75, 0.9

        def roof_fn(u, v):
            x = rx1 + (rx2 - rx1) * u
            y = -rw + 2 * rw * v
            z = 2.02 + 0.13 * (1 - (y / rw) ** 2) + 0.011 * math.sin(x * math.tau / 0.076)
            return (x, y, z)
        bm = core.bm_grid(540, 10, roof_fn)
        core.solidify_bm(bm, 0.035)
        parts.append(core.obj(f"{prefix}_atap", bm, M("zinc"), smooth=30, uv=("box", 2.0)))
        for side in (-1, 1):  # fascia boards
            bm = core.bm_box(rx2 - rx1 + 0.04, 0.025, 0.12, bevel=0.005)
            core.bm_xform(bm, loc=((rx1 + rx2) / 2, side * (rw + 0.01), 1.97))
            parts.append(core.obj(f"{prefix}_lisplang{side}", bm, M(colors[2]), uv=("box", 1.0)))
        for xe in (rx1, rx2):
            pts = [(xe, -rw, 1.99 + 0.0), (xe, -rw / 2, 2.09), (xe, 0, 2.13), (xe, rw / 2, 2.09), (xe, rw, 1.99)]
            bm = core.bm_tube(pts, 0.03, seg=6)
            parts.append(core.obj(f"{prefix}_lisujung{xe:+.1f}", bm, M(colors[2]), smooth=50))
        for xp in post_x:  # roof cross beams
            bm = core.bm_box(0.05, 2 * rw - 0.1, 0.06)
            core.bm_xform(bm, loc=(xp, 0, 1.99))
            parts.append(core.obj(f"{prefix}_balokatap{xp:+.1f}", bm, M(colors[1])))
    # engine on the stern platform
    sx = -0.78 * h.L / 2
    deck_z = h.sh(sx / (h.L / 2)) - 0.05
    bm = core.bm_box(0.9, 2 * h.y_at(sx / (h.L / 2), deck_z, 0.03), 0.04, bevel=0.005)
    core.bm_xform(bm, loc=(sx - 0.05, 0, deck_z))
    parts.append(core.obj(f"{prefix}_geladakbelakang", bm, beam, uv=("box", 1.0, True)))
    eng = M("engine")
    bm = core.bm_box(0.52, 0.36, 0.32, bevel=0.03, segs=2)
    core.bm_xform(bm, loc=(sx - 0.05, 0, deck_z + 0.2))
    parts.append(core.obj(f"{prefix}_mesin", bm, eng, smooth=40, uv=("box", 0.6)))
    bm = core.bm_cyl(0.11, 0.11, 0.3, seg=16)
    core.bm_xform(bm, loc=(sx - 0.02, 0.0, deck_z + 0.42), rot=(math.pi / 2, 0, 0))
    parts.append(core.obj(f"{prefix}_tangki", bm, M("hull_red"), smooth=40, uv=("box", 0.5)))
    shaft_a = V((sx - 0.3, 0, deck_z + 0.18))
    shaft_b = V((sx - 2.6, 0, -0.42))
    bm = core.bm_tube([shaft_a, shaft_b], 0.022, seg=8)
    parts.append(core.obj(f"{prefix}_as", bm, M("steel"), smooth=50))
    for k in range(3):  # propeller
        a = k * math.tau / 3
        bm = core.bm_box(0.02, 0.1, 0.2, bevel=0.01)
        core.bm_xform(bm, loc=(0, 0, 0.1), rot=(0, 0.35, 0))
        core.bm_xform(bm, rot=(a, 0, 0))
        core.bm_xform(bm, loc=tuple(shaft_b))
        parts.append(core.obj(f"{prefix}_baling{k}", bm, M("steel"), props={"tm": "prop"}))
    bm = core.bm_tube([(sx + 0.15, 0.05, deck_z + 0.32), (sx + 0.75, 0.16, deck_z + 0.55)], 0.016, seg=6)
    parts.append(core.obj(f"{prefix}_kemudi", bm, M("steel"), smooth=50))
    # tyre fenders
    for xf in (-1.4, 1.2):
        for side in (-1, 1):
            s = xf / (h.L / 2)
            yb = h.y_at(s, 0.25) + 0.08
            bm = bmesh.new()
            bmesh.ops.create_circle(bm, cap_ends=False, segments=1, radius=0.1)
            bm.free()
            bm = torus(0.2, 0.075, 18, 8)
            core.bm_xform(bm, rot=(math.pi / 2, 0, 0), loc=(xf, side * yb, 0.2))
            parts.append(core.obj(f"{prefix}_ban{xf:+.1f}{side}", bm, M("rubber"), smooth=60))
    # rope coil on the bow deck
    bx = 0.82 * h.L / 2
    bm = core.bm_box(0.75, 2 * h.y_at(bx / (h.L / 2), h.sh(bx / (h.L / 2)) - 0.08, 0.03), 0.035)
    core.bm_xform(bm, loc=(bx, 0, h.sh(bx / (h.L / 2)) - 0.08))
    parts.append(core.obj(f"{prefix}_geladakdepan", bm, beam, uv=("box", 1.0, True)))
    for r in range(3):
        bm = torus(0.13 - r * 0.025, 0.018, 20, 6)
        core.bm_xform(bm, loc=(bx - 0.1, 0.05, h.sh(bx / (h.L / 2)) - 0.04 + r * 0.03))
        parts.append(core.obj(f"{prefix}_tali{r}", bm, M("rope"), smooth=60, uv=("box", 0.3)))
    for p in parts:
        p.location.x += x0
    return parts


def torus(R, r, seg, rseg):
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = math.tau * i / seg
        c = V((math.cos(a) * R, math.sin(a) * R, 0))
        out = V((math.cos(a), math.sin(a), 0))
        ring = []
        for j in range(rseg):
            b = math.tau * j / rseg
            ring.append(bm.verts.new(c + out * math.cos(b) * r + V((0, 0, math.sin(b) * r))))
        rings.append(ring)
    for i in range(seg):
        for j in range(rseg):
            a1, a2 = rings[i][j], rings[i][(j + 1) % rseg]
            b1, b2 = rings[(i + 1) % seg][j], rings[(i + 1) % seg][(j + 1) % rseg]
            bm.faces.new((a1, b1, b2, a2))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def main(render=True):
    core.reset()
    core.use_collection("ketek")
    parts = build_ketek()
    body = [p for p in parts if not p.get("tm")]
    props = [p for p in parts if p.get("tm")]
    merged = core.merge_objects(body, "ketek_badan")
    prop = core.merge_objects(props, "ketek_baling", {"tm": "prop"})
    core.export_glb("ketek", [merged, prop])
    if render:
        core.setup_world(sun_elev=24, sun_rot=210)
        core.add_sun(elev=24, azim=210, energy=3.0)
        core.frame_camera([merged], yaw=-58, pitch=17, lens=55, pad=0.95)
        water = core.flat("_air", (0.06, 0.05, 0.035), rough=0.12)
        core.render("ketek", 960, 600, samples=40, ground_mat=water)

    # plain jukung variants for river traffic
    for name, cols in (("jukung_hijau", ("jukung_green", "hull_white", "hull_yellow")),
                       ("jukung_biru", ("jukung_blue", "hull_white", "hull_red"))):
        core.reset()
        core.use_collection(name)
        parts = build_ketek(prefix=name, canopy=False, colors=cols, L=6.6)
        body = [p for p in parts if not p.get("tm")]
        props = [p for p in parts if p.get("tm")]
        ob = core.merge_objects(body, f"{name}_badan")
        pr = core.merge_objects(props, f"{name}_baling", {"tm": "prop"})
        core.export_glb(name, [ob, pr])


if __name__ == "__main__":
    main(render="--norender" not in sys.argv)
