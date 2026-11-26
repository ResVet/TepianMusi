"""Procedural modeling helpers for Blender 5 (bpy as a Python module).

Everything is built with bmesh so the scripts run headless. Units are metres,
Blender Z-up (the glTF exporter converts to Y-up for three.js).
"""
from __future__ import annotations

import math
import os
import sys
import time

import bpy  # must come before bmesh
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER_DIR = os.path.dirname(HERE)
REPO = os.path.dirname(BLENDER_DIR)
RAW_DIR = os.path.join(BLENDER_DIR, "out")
PREVIEW_DIR = os.path.join(BLENDER_DIR, "previews")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

sys.path.insert(0, HERE)
import tex  # noqa: E402

V = Vector
TAU = math.tau


# ------------------------------------------------------------ scene setup ----
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    _MATS.clear()
    return sc


def coll(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


_ACTIVE = {"coll": None}


def use_collection(name):
    _ACTIVE["coll"] = coll(name)
    return _ACTIVE["coll"]


def _link(ob):
    c = _ACTIVE["coll"] or bpy.context.scene.collection
    c.objects.link(ob)


# --------------------------------------------------------------- materials ---
_MATS: dict[str, bpy.types.Material] = {}


def _img(path, noncolor=False):
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = "Non-Color" if noncolor else "sRGB"
    return img


def mat(name, maps=None, color=(0.8, 0.8, 0.8), rough=0.6, metal=0.0,
        normal=1.0, emit=None, emit_strength=1.0, clip=False, blend=False,
        alpha=1.0, double=False, rough_from_map=True):
    """PBR material. maps is the dict returned by a tex.* generator."""
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    n = nt.nodes
    bsdf = n.get("Principled BSDF")
    out = n.get("Material Output")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    if maps:
        tc = n.new("ShaderNodeTexImage")
        tc.image = _img(maps["c"])
        tc.location = (-600, 300)
        nt.links.new(tc.outputs["Color"], bsdf.inputs["Base Color"])
        if clip or blend:
            if clip:
                rnd = n.new("ShaderNodeMath")
                rnd.operation = "ROUND"
                nt.links.new(tc.outputs["Alpha"], rnd.inputs[0])
                nt.links.new(rnd.outputs[0], bsdf.inputs["Alpha"])
            else:
                nt.links.new(tc.outputs["Alpha"], bsdf.inputs["Alpha"])
        if rough_from_map and "r" in maps:
            tr = n.new("ShaderNodeTexImage")
            tr.image = _img(maps["r"], True)
            tr.location = (-600, 0)
            sep = n.new("ShaderNodeSeparateColor")
            sep.location = (-300, 0)
            nt.links.new(tr.outputs["Color"], sep.inputs["Color"])
            nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
            nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
        if "n" in maps and normal > 0:
            tn = n.new("ShaderNodeTexImage")
            tn.image = _img(maps["n"], True)
            tn.location = (-600, -300)
            nm = n.new("ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = normal
            nm.location = (-300, -300)
            nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1.0 and not maps:
        bsdf.inputs["Alpha"].default_value = alpha
    m.use_backface_culling = not double
    _ = out
    _MATS[name] = m
    return m


def flat(name, color, rough=0.6, metal=0.0, **kw):
    return mat(name, None, color=color, rough=rough, metal=metal, **kw)


# ------------------------------------------------------------ uv helpers -----
def uv_box(bm, scale=1.0, swap=False, offset=(0.0, 0.0), jitter=0.0, seed=0):
    """World-size box projection. scale = metres per texture repeat."""
    bm.normal_update()
    uvl = bm.loops.layers.uv.verify()
    import random
    rnd = random.Random(seed)
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        ox, oy = offset
        if jitter:
            ox += rnd.random() * jitter
            oy += rnd.random() * jitter
        for lp in f.loops:
            co = lp.vert.co
            if ax == 2:
                u, v = co.x, co.y
            elif ax == 0:
                u, v = co.y, co.z
            else:
                u, v = co.x, co.z
            if swap:
                u, v = v, u
            lp[uvl].uv = (u / scale + ox, v / scale + oy)


def uv_planar(bm, size, center=(0.0, 0.0), axis="z"):
    """Planar projection fitting `size` metres to the 0..1 square."""
    uvl = bm.loops.layers.uv.verify()
    cx, cy = center
    for f in bm.faces:
        for lp in f.loops:
            co = lp.vert.co
            if axis == "z":
                a, b = co.x, co.y
            elif axis == "y":
                a, b = co.x, co.z
            else:
                a, b = co.y, co.z
            lp[uvl].uv = ((a - cx) / size + 0.5, (b - cy) / size + 0.5)


def uv_cyl(bm, circ=1.0, height=1.0, axis="z"):
    """Cylindrical projection: u around the axis (circ metres per repeat)."""
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        cen = f.calc_center_median()
        for lp in f.loops:
            co = lp.vert.co
            if axis == "z":
                a = math.atan2(co.y, co.x)
                ca = math.atan2(cen.y, cen.x)
                h = co.z
                r = math.hypot(co.x, co.y)
            else:
                a = math.atan2(co.z, co.y)
                ca = math.atan2(cen.z, cen.y)
                h = co.x
                r = math.hypot(co.y, co.z)
            if a - ca > math.pi:
                a -= TAU
            if ca - a > math.pi:
                a += TAU
            lp[uvl].uv = (a * max(r, 0.05) / circ, h / height)


# ----------------------------------------------------------- bmesh shapes ----
def bm_box(sx, sy, sz, bevel=0.0, segs=1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(sx, sy, sz) * 0.45),
                        segments=segs, profile=0.5, affect="EDGES", clamp_overlap=True)
    return bm


def bm_cyl(r1, r2, h, seg=24, caps=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=seg,
                          radius1=r1, radius2=r2, depth=h)
    return bm


def bm_sphere(r, seg=24, rings=12):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    return bm


def bm_lathe(profile, seg=48, closed_top=False):
    """Revolve [(r, z), ...] around Z. Points with r==0 collapse to the axis."""
    bm = bmesh.new()
    verts = [bm.verts.new((max(r, 0.0), 0.0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1),
                   angle=TAU, steps=seg, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    # make normals point outward
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_prism(pts, depth, center_z=False):
    """Extrude a 2D polygon (x, y list, CCW) along +Z."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0.0)) for x, y in pts]
    f = bm.faces.new(vs)
    res = bmesh.ops.extrude_face_region(bm, geom=[f])
    nv = [g for g in res["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, depth), verts=nv)
    if center_z:
        bmesh.ops.translate(bm, vec=(0, 0, -depth / 2), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_tube(points, radius, seg=8, closed=False, radii=None, caps=True):
    """Sweep a circle along a polyline with parallel-transport frames."""
    bm = bmesh.new()
    pts = [V(p) for p in points]
    n = len(pts)
    tangents = []
    for i in range(n):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, n - 1)]
        tangents.append((b - a).normalized())
    up = V((0, 0, 1)) if abs(tangents[0].z) < 0.9 else V((1, 0, 0))
    normal = tangents[0].cross(up).normalized()
    rings = []
    for i in range(n):
        t = tangents[i]
        if i > 0:
            prev = tangents[i - 1]
            axis = prev.cross(t)
            if axis.length > 1e-6:
                ang = math.acos(max(-1, min(1, prev.dot(t))))
                normal = (Matrix.Rotation(ang, 3, axis.normalized()) @ normal).normalized()
        binorm = t.cross(normal).normalized()
        r = radii[i] if radii else radius
        ring = []
        for k in range(seg):
            a = TAU * k / seg
            off = normal * math.cos(a) * r + binorm * math.sin(a) * r
            ring.append(bm.verts.new(pts[i] + off))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(seg):
            a, b = rings[i][k], rings[i][(k + 1) % seg]
            c, d = rings[i + 1][(k + 1) % seg], rings[i + 1][k]
            bm.faces.new((a, b, c, d))
    if caps and not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_grid(nx, ny, fn):
    """Parametric surface: fn(u, v) -> (x, y, z), u,v in [0,1]."""
    bm = bmesh.new()
    vs = [[bm.verts.new(fn(i / nx, j / ny)) for j in range(ny + 1)] for i in range(nx + 1)]
    for i in range(nx):
        for j in range(ny):
            bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
    return bm


def bm_xform(bm, loc=(0, 0, 0), rot=(0, 0, 0), scale=None):
    if scale is not None:
        bmesh.ops.scale(bm, vec=scale if hasattr(scale, "__len__") else (scale,) * 3, verts=bm.verts)
    if any(rot):
        m = (Matrix.Rotation(rot[2], 4, "Z") @ Matrix.Rotation(rot[1], 4, "Y")
             @ Matrix.Rotation(rot[0], 4, "X"))
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    if any(loc):
        bmesh.ops.translate(bm, vec=loc, verts=bm.verts)
    return bm


def bm_beam(p1, p2, w, h, up=(0, 0, 1), bevel=0.0):
    p1, p2 = V(p1), V(p2)
    d = p2 - p1
    L = d.length
    bm = bm_box(L, w, h, bevel=bevel)
    bmesh.ops.translate(bm, vec=(L / 2, 0, 0), verts=bm.verts)
    x = d.normalized()
    upv = V(up)
    if abs(x.dot(upv)) > 0.99:
        upv = V((1, 0, 0)) if abs(x.x) < 0.9 else V((0, 1, 0))
    y = upv.cross(x).normalized()
    z = x.cross(y).normalized()
    m = Matrix((
        (x.x, y.x, z.x, p1.x),
        (x.y, y.y, z.y, p1.y),
        (x.z, y.z, z.z, p1.z),
        (0, 0, 0, 1),
    ))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return bm


def bm_merge(*bms):
    out = bmesh.new()
    for b in bms:
        tmp = bpy.data.meshes.new("_tmp")
        b.to_mesh(tmp)
        out.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        b.free()
    return out


def solidify_bm(bm, thick):
    """Give an open surface thickness (inward along normals)."""
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thick)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


# --------------------------------------------------------- object creation ---
def obj(name, bm, material=None, smooth=None, uv=None, props=None, loc=(0, 0, 0),
        rot=(0, 0, 0), keep_uv=False):
    """Create an object from a bmesh. uv: ('box', scale) / ('planar', size) /
    ('cyl', circ, height) / callable(bm)."""
    if uv is not None and not keep_uv:
        if callable(uv):
            uv(bm)
        elif uv[0] == "box":
            uv_box(bm, *uv[1:])
        elif uv[0] == "planar":
            uv_planar(bm, *uv[1:])
        elif uv[0] == "cyl":
            uv_cyl(bm, *uv[1:])
    elif not keep_uv:
        uv_box(bm, 1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    _link(ob)
    if material is not None:
        me.materials.append(material)
    if smooth is not None:
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(smooth))
    ob.location = loc
    ob.rotation_euler = rot
    if props:
        for k, v in props.items():
            ob[k] = v
    return ob


def linked(src, name, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), props=None):
    """Linked duplicate (shares mesh data, exported once in glTF)."""
    ob = bpy.data.objects.new(name, src.data)
    _link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    ob.scale = scale
    for k, v in (props or {}).items():
        ob[k] = v
    return ob


def bake_transform(ob):
    """Apply object transform into mesh data (for merging)."""
    ob.data.transform(ob.matrix_basis)
    ob.matrix_basis = Matrix.Identity(4)


def merge_objects(objs, name, props=None):
    """Join objects into one mesh, preserving materials. Applies transforms.
    Linked duplicates are copied first so shared data is not modified."""
    objs = [o for o in objs if o is not None]
    if not objs:
        return None
    bpy.context.view_layer.update()
    bm = bmesh.new()
    mats = []
    for o in objs:
        me = o.data.copy()
        me.transform(o.matrix_world)
        slot_map = []
        for m in me.materials:
            if m not in mats:
                mats.append(m)
            slot_map.append(mats.index(m))
        for p in me.polygons:
            if slot_map:
                p.material_index = slot_map[p.material_index]
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    _link(ob)
    for k, v in (props or {}).items():
        ob[k] = v
    return ob


def bounds(objs):
    mn = V((1e9, 1e9, 1e9))
    mx = V((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            w = o.matrix_world @ V(c)
            mn = V((min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)))
            mx = V((max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)))
    return mn, mx


def stats(objs=None):
    objs = objs or [o for o in bpy.context.scene.objects if o.type == "MESH"]
    tris = 0
    for o in objs:
        tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return {"objects": len(objs), "tris": tris}


# ------------------------------------------------------------------ export ---
def export_glb(name, objs=None, extras=True):
    sc = bpy.context.scene
    objs = objs or [o for o in sc.objects if o.type == "MESH"]
    for o in sc.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    path = os.path.join(RAW_DIR, f"{name}.glb")
    t = time.time()
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True,
        export_yup=True, export_extras=extras, export_cameras=False, export_lights=False,
        export_image_format="AUTO", export_texcoords=True, export_normals=True,
        export_materials="EXPORT", export_animations=False,
    )
    print(f"[export] {name}.glb {os.path.getsize(path)/1e6:.2f} MB in {time.time()-t:.1f}s {stats(objs)}")
    return path


# ------------------------------------------------------------------ render ---
def setup_world(sun_elev=28.0, sun_rot=150.0, strength=0.18, kind="MULTIPLE_SCATTERING"):
    sc = bpy.context.scene
    w = bpy.data.worlds.new("sky")
    sc.world = w
    nt = w.node_tree
    bg = nt.nodes.get("Background")
    sky = nt.nodes.new("ShaderNodeTexSky")
    try:
        sky.sky_type = kind
        sky.sun_elevation = math.radians(sun_elev)
        sky.sun_rotation = math.radians(sun_rot)
        sky.sun_disc = False
        sky.altitude = 30
        sky.air_density = 1.2
        sky.aerosol_density = 1.6
    except Exception as e:  # pragma: no cover
        print("sky fallback", e)
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    return w


def add_sun(elev=35, azim=150, energy=4.0, color=(1.0, 0.95, 0.88), angle=1.2):
    ld = bpy.data.lights.new("sun", "SUN")
    ld.energy = energy
    ld.color = color
    ld.angle = math.radians(angle)
    lo = bpy.data.objects.new("sun", ld)
    bpy.context.scene.collection.objects.link(lo)
    lo.rotation_euler = (math.radians(90 - elev), 0, math.radians(azim))
    return lo


def add_camera(loc, target, lens=50):
    cd = bpy.data.cameras.new("cam")
    cd.lens = lens
    cd.clip_end = 5000
    cam = bpy.data.objects.new("cam", cd)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = loc
    d = V(target) - V(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return cam


def frame_camera(objs, yaw=35.0, pitch=18.0, lens=50, pad=1.15, aspect=1.5):
    mn, mx = bounds(objs)
    c = (mn + mx) / 2
    size = (mx - mn).length / 2
    fov = 2 * math.atan(18 / lens)
    dist = size * pad / math.tan(fov / 2) * (1.0 if aspect >= 1 else 1 / aspect)
    yr, pr = math.radians(yaw), math.radians(pitch)
    loc = c + V((math.sin(yr) * math.cos(pr), -math.cos(yr) * math.cos(pr), math.sin(pr))) * dist
    return add_camera(loc, c, lens)


def render(name, w=960, h=640, samples=32, transparent=False, ground=True, ground_mat=None,
           exposure=0.0):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.film_transparent = transparent
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = exposure
    g = None
    if ground and not transparent:
        bm = bm_box(4000, 4000, 0.1)
        bm_xform(bm, loc=(0, 0, -0.05))
        g = obj("_ground", bm, ground_mat or flat("_groundmat", (0.42, 0.4, 0.36), 0.9))
    path = os.path.join(PREVIEW_DIR, f"{name}.png")
    sc.render.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"[render] {name}.png in {time.time()-t:.1f}s")
    if g is not None:
        bpy.data.objects.remove(g, do_unlink=True)
    return path


def bm_blob(rx, ry, rz, seed=0, amp=0.15, seg=14, rings=9):
    """Organic lump (meat, chicken, dough): a sphere with smooth radial noise."""
    import random
    rnd = random.Random(seed)
    waves = [(V((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized() * rnd.uniform(1.5, 4.0),
              rnd.uniform(0, TAU), rnd.uniform(0.4, 1.0)) for _ in range(6)]
    bm = bm_sphere(1.0, seg, rings)
    for v in bm.verts:
        d = v.co.normalized()
        n = sum(w * math.sin(k.dot(d) + ph) for k, ph, w in waves) / 3.5
        r = 1.0 + amp * n
        v.co = V((d.x * rx * r, d.y * ry * r, d.z * rz * r))
    return bm


def tikar_mesh(name, w, d, z, loc=(0.0, 0.0), tile=0.8):
    """Pandan mat: tiled weave plus a red woven border frame."""
    import tex
    weave = mat("tikar_anyam", tex.woven("tikar_anyam", strips=40, size=1024), rough=0.8)
    edge = mat("tikar_tepi", tex.woven("tikar_tepi", a=(0.55, 0.12, 0.1), b=(0.38, 0.07, 0.07),
                                        strips=40, size=512, seed=69), rough=0.8)
    bm = bm_box(w, d, 0.008)
    uv_box(bm, tile)
    bm_xform(bm, loc=(loc[0], loc[1], z + 0.004))
    a = obj(f"{name}_anyam", bm, weave, keep_uv=True)
    fr = []
    b = 0.09
    for (sx, sy, cx, cy) in ((w + 2 * b, b, 0, -d / 2 - b / 2), (w + 2 * b, b, 0, d / 2 + b / 2),
                             (b, d, -w / 2 - b / 2, 0), (b, d, w / 2 + b / 2, 0)):
        bb = bm_box(sx, sy, 0.01)
        bm_xform(bb, loc=(loc[0] + cx, loc[1] + cy, z + 0.005))
        fr.append(bb)
    bm = bm_merge(*fr)
    uv_box(bm, tile)
    e = obj(f"{name}_tepi", bm, edge, keep_uv=True)
    return [a, e]
