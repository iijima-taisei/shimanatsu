# 建物を4方向から、マゼンタの背景で描いて、すき間（向こうが透ける所）を見つける
import bpy, sys, os, math
from mathutils import Vector
names = sys.argv[sys.argv.index('--') + 1].split(','); root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models') + '/'; out = os.environ['OUT']
for name in names:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    for k in range(4):
        before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=root + name + '.glb'); new = [o for o in bpy.data.objects if o not in before]
        tops = [o for o in new if o.parent is None]
        for o in tops: o.rotation_mode = 'XYZ'; o.rotation_euler[2] = k * math.pi / 2; o.location.x += k * 0  # 位置はあとで
    # 4つを横に並べる
    bpy.context.view_layer.update()
    tops = [o for o in bpy.data.objects if o.parent is None]
    groups = [tops[i::1] for i in range(1)]
    lo = Vector((1e9,)*3); hi = Vector((-1e9,)*3)
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3): lo[i] = min(lo[i], w[i]); hi[i] = max(hi[i], w[i])
    size = max(hi.x - lo.x, hi.y - lo.y); n = len(tops)//4 or 1
    for i, o in enumerate(tops): o.location.x += (i // n) * size * 1.3
    bpy.context.view_layer.update()
    lo = Vector((1e9,)*3); hi = Vector((-1e9,)*3)
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3): lo[i] = min(lo[i], w[i]); hi[i] = max(hi[i], w[i])
    cen = (lo + hi)/2; span = hi - lo
    cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = span.x * 1.05
    el = math.radians(float(os.environ.get('EL', '0'))); D = max(span.x, 30); cam.location = cen + Vector((0, -D*math.cos(el), D*math.sin(el))); cam.rotation_euler = (math.radians(90) - el, 0, 0); cam.data.clip_end = 1000
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_backface_culling = False
    if not sc.world: sc.world = bpy.data.worlds.new('W')
    sc.world.color = (1, 0, 1)
    sc.render.resolution_x = 1400; sc.render.resolution_y = max(200, int(1400 * (span.z * 1.15 + span.y * float(os.environ.get('EL','0'))/90) / (span.x * 1.05)))
    sc.render.filepath = os.path.join(out, name + os.environ.get('SUF','') + '.png'); bpy.ops.render.render(write_still=True)
