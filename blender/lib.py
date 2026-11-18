# Blenderでローポリモデルを作るための共通部品。 Blender -b -P <script> で実行する。
import bpy, math, os
from mathutils import Vector, Matrix
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(ROOT, 'textures'); OUT = os.path.join(ROOT, 'models'); PRE = os.path.join(ROOT, 'blender', 'preview')
REPORT = []

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def lin(c):
    return ((c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)

def hexc(h):
    h = h.lstrip('#'); return tuple(lin(int(h[i:i+2], 16) / 255) for i in (0, 2, 4))

def material(name, color='#cccccc'):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    col = hexc(color) if isinstance(color, str) else color
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = 1.0
    p = os.path.join(TEX, name + '.png')
    if os.path.exists(p):
        t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(p, check_existing=True)
        m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    m.diffuse_color = (*col, 1)
    return m

class MB:
    """面を積んでいくメッシュビルダー。mat は 'name' か ('name', '#rrggbb')。"""
    def __init__(self):
        self.v = []; self.f = []; self.uv = []; self.mi = []; self.mats = []; self.T = Matrix.Identity(4)
    def at(self, loc=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0):
        self.T = Matrix.Translation(loc) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X'); return self
    def home(self): self.T = Matrix.Identity(4); return self
    def _m(self, mat):
        if isinstance(mat, str): mat = (mat, '#cccccc')
        for i, m in enumerate(self.mats):
            if m[0] == mat[0]: return i
        self.mats.append(mat); return len(self.mats) - 1
    def face(self, pts, uvs, mat):
        i0 = len(self.v)
        for p in pts: self.v.append(tuple(self.T @ Vector(p)))
        self.f.append(list(range(i0, i0 + len(pts)))); self.uv.append(list(uvs)); self.mi.append(self._m(mat))
    def quad(self, p0, p1, p2, p3, mat, uv=(0, 0, 1, 1)):
        u0, v0, u1, v1 = uv; self.face([p0, p1, p2, p3], [(u0, v0), (u1, v0), (u1, v1), (u0, v1)], mat)
    def box(self, c, s, mat, tile=None, faces='fblrtd', mats=None, uvs=None):
        x0, x1 = c[0] - s[0] / 2, c[0] + s[0] / 2; y0, y1 = c[1] - s[1] / 2, c[1] + s[1] / 2; z0, z1 = c[2] - s[2] / 2, c[2] + s[2] / 2
        F = {'f': ([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], s[0], s[2]),
             'b': ([(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)], s[0], s[2]),
             'r': ([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], s[1], s[2]),
             'l': ([(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)], s[1], s[2]),
             't': ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], s[0], s[1]),
             'd': ([(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], s[0], s[1])}
        for k in faces:
            pts, L, H = F[k]; m = (mats or {}).get(k, mat); t = tile
            if isinstance(tile, dict): t = tile.get(k, tile.get('*'))
            if uvs and k in uvs: u0, v0, u1, v1 = uvs[k]
            elif t: u0, v0, u1, v1 = 0, 0, L / t[0], H / t[1]
            else: u0, v0, u1, v1 = 0, 0, 1, 1
            self.face(pts, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)], m)
    def loft(self, rings, n, mat, uvfn=None, cap_top=True, cap_bot=True, tile=(1, 1), a0=0.0):
        """rings: [(cx, cy, z, rx, ry)] 下から上へ。uvfn(x,y,z)->(u,v) がなければ円筒UV。"""
        P = [[(cx + rx * math.cos(a0 + 2 * math.pi * j / n), cy + ry * math.sin(a0 + 2 * math.pi * j / n), z) for j in range(n)] for (cx, cy, z, rx, ry) in rings]
        hh = [0.0]
        for i in range(1, len(rings)): hh.append(hh[-1] + abs(rings[i][2] - rings[i - 1][2]) + abs(rings[i][3] - rings[i - 1][3]) * 0.5)
        per = 2 * math.pi * max(r[3] for r in rings)
        for i in range(len(rings) - 1):
            for j in range(n):
                k = (j + 1) % n; pts = [P[i][j], P[i][k], P[i + 1][k], P[i + 1][j]]
                if uvfn: uv = [uvfn(*p) for p in pts]
                else:
                    ua, ub = j / n * per / tile[0], (j + 1) / n * per / tile[0]; va, vb = hh[i] / tile[1], hh[i + 1] / tile[1]
                    uv = [(ua, va), (ub, va), (ub, vb), (ua, vb)]
                self.face(pts, uv, mat)
        def cap(ring, flip):
            pts = list(reversed(ring)) if flip else list(ring)
            uv = [uvfn(*p) for p in pts] if uvfn else [(0.5 + 0.5 * math.cos(2 * math.pi * j / n), 0.5 + 0.5 * math.sin(2 * math.pi * j / n)) for j in range(n)]
            self.face(pts, uv, mat)
        if cap_top: cap(P[-1], False)
        if cap_bot: cap(P[0], True)
    def cyl(self, c, r, h, n, mat, **kw):
        self.loft([(c[0], c[1], c[2], r, r), (c[0], c[1], c[2] + h, r, r)], n, mat, **kw)
    def underside(self, start, mat=('eave', '#4a3a2c'), dz=0.04):
        """start 番目以降に積んだ面の裏側を張る（屋根を下から見上げたときに抜けないように）。"""
        for i in range(start, len(self.f)):
            pts = [self.v[j] for j in self.f[i]]; uvs = self.uv[i]
            i0 = len(self.v)
            for p in reversed(pts): self.v.append((p[0], p[1], p[2] - dz))
            self.f.append(list(range(i0, i0 + len(pts)))); self.uv.append(list(reversed(uvs))); self.mi.append(self._m(mat))
    def gable(self, c, sx, sy, h, mat, wall=None, tile=(1, 1), along='x', wx=None, wy=None):
        """切妻屋根。c は壁の上端の高さの中心、sx・sy は軒の出を含む屋根の大きさ、along は棟の向き。
        wx・wy に建物本体の大きさを渡すと、屋根が壁の上端にぴったり載り（軒先は壁より下がる）、妻壁も本体の面に立つ。棟の高さを返す。"""
        hx, hy = sx / 2, sy / 2; x, y, z0 = c; start = len(self.f)
        if along == 'x':
            bw = (wy / 2) if wy else hy; z = z0 - h * (1 - bw / hy); gx = (wx / 2) if wx else hx
            sl = math.hypot(hy, h)
            self.quad((x - hx, y - hy, z), (x + hx, y - hy, z), (x + hx, y, z + h), (x - hx, y, z + h), mat, (0, 0, sx / tile[0], sl / tile[1]))
            self.quad((x + hx, y + hy, z), (x - hx, y + hy, z), (x - hx, y, z + h), (x + hx, y, z + h), mat, (0, 0, sx / tile[0], sl / tile[1]))
            self.underside(start)
            if wall:
                self.face([(x + gx, y - bw, z0), (x + gx, y + bw, z0), (x + gx, y, z + h)], [(0, 0), (bw, 0), (bw / 2, h / 2)], wall)
                self.face([(x - gx, y + bw, z0), (x - gx, y - bw, z0), (x - gx, y, z + h)], [(0, 0), (bw, 0), (bw / 2, h / 2)], wall)
        else:
            bw = (wx / 2) if wx else hx; z = z0 - h * (1 - bw / hx); gy = (wy / 2) if wy else hy
            sl = math.hypot(hx, h)
            self.quad((x + hx, y - hy, z), (x + hx, y + hy, z), (x, y + hy, z + h), (x, y - hy, z + h), mat, (0, 0, sy / tile[0], sl / tile[1]))
            self.quad((x - hx, y + hy, z), (x - hx, y - hy, z), (x, y - hy, z + h), (x, y + hy, z + h), mat, (0, 0, sy / tile[0], sl / tile[1]))
            self.underside(start)
            if wall:
                self.face([(x - bw, y - gy, z0), (x + bw, y - gy, z0), (x, y - gy, z + h)], [(0, 0), (bw, 0), (bw / 2, h / 2)], wall)
                self.face([(x + bw, y + gy, z0), (x - bw, y + gy, z0), (x, y + gy, z + h)], [(0, 0), (bw, 0), (bw / 2, h / 2)], wall)
        return z + h
    def card(self, c, w, h, mat, rz=0.0, tilt=0.0, uv=(0, 0, 1, 1)):
        """地面に立つ板（中心下端が c）。"""
        dx, dy = math.cos(rz) * w / 2, math.sin(rz) * w / 2; ox, oy = -math.sin(rz) * math.sin(tilt) * h, math.cos(rz) * math.sin(tilt) * h; hz = math.cos(tilt) * h
        self.quad((c[0] - dx, c[1] - dy, c[2]), (c[0] + dx, c[1] + dy, c[2]), (c[0] + dx + ox, c[1] + dy + oy, c[2] + hz), (c[0] - dx + ox, c[1] - dy + oy, c[2] + hz), mat, uv)
    def build(self, name, loc=(0, 0, 0), parent=None, smooth=False, merge=True):
        me = bpy.data.meshes.new(name); me.from_pydata(self.v, [], self.f); me.update()
        uvl = me.uv_layers.new(name='UVMap'); k = 0
        for fi, poly in enumerate(me.polygons):
            poly.material_index = self.mi[fi]
            for li in poly.loop_indices: uvl.data[li].uv = self.uv[fi][li - poly.loop_start]
        for (n, c) in self.mats: me.materials.append(material(n, c))
        ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
        if merge:
            import bmesh
            bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005); bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = smooth
        ob.location = loc
        if parent: ob.parent = parent
        return ob

def empty(name, loc=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(ob); ob.location = loc
    if parent: ob.parent = parent
    return ob

def tris():
    n = 0
    for ob in bpy.context.scene.objects:
        if ob.type == 'MESH': ob.data.calc_loop_triangles(); n += len(ob.data.loop_triangles)
    return n

def preview(name, view=(-1.0, -1.5, 0.75)):
    sc = bpy.context.scene; bpy.context.view_layer.update()
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for ob in sc.objects:
        if ob.type != 'MESH': continue
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            for i in range(3): lo[i] = min(lo[i], w[i]); hi[i] = max(hi[i], w[i])
    cen = (lo + hi) / 2; size = (hi - lo).length
    cam = bpy.data.objects.new('PreviewCam', bpy.data.cameras.new('PreviewCam')); sc.collection.objects.link(cam)
    d = Vector(view).normalized(); cam.location = cen + d * size * 1.45; cam.data.lens = 40; cam.data.clip_end = 5000
    cam.rotation_euler = (cen - cam.location).to_track_quat('-Z', 'Y').to_euler(); sc.camera = cam
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x = 560; sc.render.resolution_y = 420; sc.render.film_transparent = False
    if not sc.world: sc.world = bpy.data.worlds.new('W')
    sc.world.color = (0.45, 0.6, 0.75)
    sc.render.filepath = os.path.join(PRE, name + '.png'); os.makedirs(PRE, exist_ok=True)
    try: bpy.ops.render.render(write_still=True)
    except Exception as e: print('PREVIEW_FAIL', name, e)
    bpy.data.objects.remove(cam)

def export(name, limit=None, view=(-1.0, -1.5, 0.75), do_preview=True):
    n = tris(); flag = '' if (limit is None or n <= limit) else '  !!OVER %d' % limit
    print('MODEL %-16s tris=%d%s' % (name, n, flag)); REPORT.append((name, n))
    if do_preview: preview(name, view)
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '.glb'), export_format='GLB', export_image_format='NONE', export_apply=True, export_yup=True, export_animations=False)
