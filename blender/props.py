# 木と小物。原点は地面の中心。
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
BARK = ('bark', '#6b523c'); LV = ('leaves', '#4f8a45'); KOGA = ('koga-stone', '#cfcdc4'); CON = ('concrete', '#bdbab0'); WOOD = ('wood', '#8a6a48'); MT = ('metal', '#9aa0a4')
def one(name, fn, limit=300, **kw):
    reset(); m = MB(); fn(m); m.build(name, smooth=kw.pop('smooth', False)); export(name, limit, **kw)

def tree_round(m):
    m.loft([(0, 0, -0.4, 0.34, 0.34), (0.05, 0, 1.4, 0.24, 0.24), (0.1, 0.05, 3.0, 0.16, 0.16)], 6, BARK, tile=(1, 1.5), cap_bot=False)
    m.loft([(0.1, 0, 2.3, 0.9, 0.9), (0.1, 0, 3.3, 2.0, 2.0), (0.1, 0, 4.6, 1.9, 1.9), (0.1, 0, 5.6, 0.8, 0.8)], 7, ('foliage', '#3f7038'))
    for i in range(3): m.card((0.1, 0, 1.9), 5.6, 4.6, LV, rz=i * math.pi / 3)
one('tree-round', tree_round, 300)
def tree_pine(m):
    m.loft([(0, 0, -0.4, 0.3, 0.3), (0.3, 0, 2.0, 0.22, 0.22), (0.1, 0.2, 4.2, 0.16, 0.16), (0.5, 0.1, 6.2, 0.08, 0.08)], 6, BARK, tile=(1, 1.5), cap_bot=False)
    PB = ('pine-branch', '#3d6b3f')
    for (x, y, z, w, rz) in [(0.6, 0, 3.2, 4.2, 0.2), (-0.3, 0.3, 4.4, 3.8, 1.4), (0.5, 0.1, 5.5, 3.2, 2.5), (0.5, 0.1, 6.3, 2.2, 0.9)]:
        m.card((x, y, z - 0.5), w, w * 0.5, PB, rz=rz); m.card((x, y, z - 0.5), w, w * 0.5, PB, rz=rz + math.pi / 2)
        c, s = math.cos(rz) * w / 2, math.sin(rz) * w / 2
        m.quad((x - c + s * 0.6, y - s - c * 0.6, z), (x + c + s * 0.6, y + s - c * 0.6, z), (x + c - s * 0.6, y + s + c * 0.6, z), (x - c - s * 0.6, y - s + c * 0.6, z), PB)
one('tree-pine', tree_pine, 300)
def tree_palm(m):
    m.loft([(0, 0, -0.4, 0.3, 0.3), (0.15, 0, 2.5, 0.2, 0.2), (0.45, 0, 5.0, 0.18, 0.18), (0.9, 0, 7.0, 0.2, 0.2)], 6, ('palm-bark', '#7a6a55'), tile=(1, 1), cap_bot=False)
    PL = ('palm-leaf', '#4c8a4a')
    for i in range(9):
        a = i * 2 * math.pi / 9 + 0.2; c, s = math.cos(a), math.sin(a); L = 3.1; w = 0.75
        p0 = (0.9, 0, 7.0); p1 = (0.9 + c * L * 0.55, s * L * 0.55, 7.7 - (i % 3) * 0.25); p2 = (0.9 + c * L, s * L, 6.6 - (i % 3) * 0.35)
        m.quad((p0[0] + s * w * 0.3, p0[1] - c * w * 0.3, p0[2]), (p1[0] + s * w, p1[1] - c * w, p1[2] - 0.25), (p1[0] - s * w, p1[1] + c * w, p1[2] - 0.25), (p0[0] - s * w * 0.3, p0[1] + c * w * 0.3, p0[2]), PL, (0, 0, 0.55, 1))
        m.quad((p1[0] + s * w, p1[1] - c * w, p1[2] - 0.25), (p2[0] + s * w * 0.5, p2[1] - c * w * 0.5, p2[2]), (p2[0] - s * w * 0.5, p2[1] + c * w * 0.5, p2[2]), (p1[0] - s * w, p1[1] + c * w, p1[2] - 0.25), PL, (0.55, 0, 1, 1))
one('tree-palm', tree_palm, 300)
def bush(m):
    for i in range(3): m.card((0, 0, -0.2), 2.4, 1.7, LV, rz=i * math.pi / 3)
one('bush', bush, 50)
def pole(m):
    m.cyl((0, 0, -0.5), 0.15, 9.0, 6, ('pole', '#8f8a80'), tile=(1, 2)); m.box((0, 0, 7.9), (2.2, 0.12, 0.12), ('pole', '#8f8a80')); m.box((0, 0, 7.2), (1.5, 0.1, 0.1), ('pole', '#8f8a80'))
    for x in (-0.95, 0, 0.95): m.cyl((x, 0, 7.96), 0.06, 0.2, 5, ('insulator', '#e9e9e4'))
    m.cyl((0.32, 0, 6.2), 0.26, 0.75, 7, ('transformer', '#a9b0b0')); m.box((0, -0.17, 2.4), (0.25, 0.03, 0.5), ('pole-plate', '#e6d27a'))
one('pole', pole, 200)
def statue(m):   # 島の石（コーガ石）を彫った石像。オリジナルの形
    m.loft([(0, 0, -0.3, 0.75, 0.6), (0, 0, 0.5, 0.7, 0.55), (0, -0.03, 0.9, 0.5, 0.45), (0, -0.05, 1.3, 0.62, 0.56), (0, -0.03, 2.1, 0.66, 0.6), (0, 0.02, 2.6, 0.5, 0.48), (0, 0.04, 2.8, 0.25, 0.25)], 8, KOGA, tile=(1.4, 1.4), a0=math.pi / 8)
    m.box((0, -0.62, 1.75), (0.22, 0.22, 0.6), KOGA, tile=(1.4, 1.4)); m.box((0, -0.6, 2.15), (0.95, 0.16, 0.14), KOGA, tile=(1.4, 1.4)); m.box((0, -0.6, 1.33), (0.5, 0.1, 0.07), ('koga-dark', '#9a978c'))
    for x in (-0.25, 0.25): m.box((x, -0.6, 2.0), (0.22, 0.08, 0.08), ('koga-dark', '#9a978c'))
one('statue', statue, 300, smooth=False)
def torii(m):
    RED = ('torii-red', '#b5382c')
    for x in (-1.9, 1.9): m.loft([(x, 0, -0.4, 0.2, 0.2), (x * 0.96, 0, 4.4, 0.17, 0.17)], 8, RED); m.cyl((x, 0, -0.4), 0.3, 0.7, 8, ('torii-base', '#3a3a3a'))
    m.box((0, 0, 4.55), (5.6, 0.34, 0.3), RED); m.box((0, 0, 4.8), (6.0, 0.42, 0.2), ('torii-black', '#2b2b2b')); m.box((0, 0, 3.6), (4.4, 0.2, 0.28), RED); m.box((0, 0, 4.07), (0.3, 0.1, 0.62), RED)
one('torii', torii, 200)
def shrine(m):
    m.box((0, 0, 0.3), (4.6, 4.6, 1.2), KOGA, tile=(1.4, 1.4), faces='fblrt')
    for i in range(3): m.box((0, -2.5 - i * 0.35, 0.75 - i * 0.3), (2.2, 0.36, 0.3), KOGA, tile=(1.4, 1.4), faces='flrt')
    m.box((0, 0.3, 2.1), (2.6, 2.4, 2.4), ('wood-wall', '#6f5540'), tile=(2.5, 2.5), faces='fblr'); m.quad((-0.7, -0.93, 1.0), (0.7, -0.93, 1.0), (0.7, -0.93, 2.7), (-0.7, -0.93, 2.7), ('shrine-door', '#4a3626'))
    top = m.gable((0, 0.3, 3.3), 4.0, 4.4, 1.5, ('roof-copper', '#5f8f80'), wall=('plaster', '#ece8dc'), tile=(2, 2), wx=2.6, wy=2.4); m.box((0, 0.3, top), (4.2, 0.25, 0.2), ('roof-copper', '#5f8f80'))
    m.box((0, -1.5, 1.15), (0.9, 0.5, 0.5), WOOD)
    for x in (-1.5, 1.5): m.box((x, -1.7, 0.9 + 0.8), (0.3, 0.3, 1.6), KOGA, tile=(1.4, 1.4)); m.box((x, -1.7, 2.6), (0.55, 0.55, 0.5), KOGA, tile=(1.4, 1.4))
one('shrine', shrine, 300)
def onsen(m):   # 海辺の露天風呂：石の柱が並ぶ
    m.cyl((0, 0, -1.2), 7.5, 1.6, 12, KOGA, tile=(1.4, 1.4)); 
    for j in range(10):
        a = j * 2 * math.pi / 10; m.at((math.cos(a) * 4.2, math.sin(a) * 4.2, 0.4), rz=a).box((0, 0, 0.25), (0.7, 2.9, 0.5), KOGA, tile=(1.4, 1.4)); m.home()
    m.cyl((0, 0, 0.4), 3.9, 0.22, 10, ('water', '#57b7c4'), cap_bot=False)
    cols = [(-5.6, 3), (-5.6, 0), (-5.6, -3), (-2.8, 5.4), (0, 5.4), (2.8, 5.4), (5.6, 3)]
    for i, (x, y) in enumerate(cols):
        hh = 4.6 if i != 6 else 2.2
        m.cyl((x, y, 0.4), 0.52, 0.3, 8, KOGA, tile=(1.4, 1.4)); m.loft([(x, y, 0.7, 0.4, 0.4), (x, y, 0.7 + hh, 0.34, 0.34)], 8, ('column', '#e3dfd2'), tile=(0.5, 2)); 
        if i != 6: m.box((x, y, 0.7 + hh + 0.15), (1.05, 1.05, 0.3), ('column', '#e3dfd2'))
    m.box((-5.6, 0, 5.9), (1.0, 7.2, 0.6), ('column', '#e3dfd2'), tile=(2, 2)); m.box((0, 5.4, 5.9), (6.8, 1.0, 0.6), ('column', '#e3dfd2'), tile=(2, 2))
one('onsen', onsen, 600)
def lookout(m):
    m.box((0, 0, 0.1), (5.4, 5.4, 0.5), WOOD, tile=(1, 1), faces='fblrt')
    for x in (-2.3, 2.3):
        for y in (-2.3, 2.3): m.box((x, y, 1.75), (0.2, 0.2, 2.9), WOOD, faces='fblr')
    for (a, b) in [((-2.3, 2.3), (2.3, 2.3)), ((-2.3, -2.3), (-2.3, 2.3)), ((2.3, -2.3), (2.3, 2.3))]:
        cx, cy = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2; m.box((cx, cy, 1.25), (abs(b[0] - a[0]) + 0.1 or 0.1, abs(b[1] - a[1]) + 0.1 or 0.1, 0.1) if a[1] == b[1] else (0.1, abs(b[1] - a[1]), 0.1), WOOD)
    R = ('roof-tile', '#4d5868'); P = [(-3.2, -3.2), (3.2, -3.2), (3.2, 3.2), (-3.2, 3.2)]
    i0 = len(m.f)
    for i in range(4):
        a, b = P[i], P[(i + 1) % 4]; m.face([(a[0], a[1], 3.2), (b[0], b[1], 3.2), (0, 0, 4.9)], [(0, 0), (3, 0), (1.5, 2)], R)
    m.underside(i0)
    m.box((0, 1.7, 0.8), (3.2, 0.5, 0.1), WOOD); 
    for x in (-1.4, 1.4): m.box((x, 1.7, 0.55), (0.1, 0.45, 0.45), WOOD)
one('lookout', lookout, 300)
def pier(m):
    m.box((0, 0, -1.2), (46, 6, 4.4), CON, tile=(3, 3), faces='fblrt')
    for i in range(6): m.cyl((-20 + i * 8, -2.4, 1.0), 0.22, 0.5, 6, ('bollard', '#b8703a')); 
    m.box((0, 2.9, 1.5), (46, 0.5, 1.0), CON, tile=(3, 3))
one('pier', pier, 200)
def boat(m):
    W = ('boat-white', '#eef0ee'); pts = [(-2.6, 0.85), (1.6, 0.9), (3.2, 0.0), (1.6, -0.9), (-2.6, -0.85)]
    n = len(pts)
    for i in range(n):
        (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % n]
        m.quad((xa * 0.85, ya * 0.6, -0.3), (xb * 0.85, yb * 0.6, -0.3), (xb, yb, 0.75), (xa, ya, 0.75), W)
        m.quad((xa, ya, 0.75), (xb, yb, 0.75), (xb, yb, 0.9), (xa, ya, 0.9), ('boat-blue', '#3f7fb0'))
    m.face([(x, y, 0.55) for (x, y) in pts], [(0, 0)] * n, ('boat-deck', '#c9c2ae'))
    m.box((-1.2, 0, 1.3), (1.5, 1.2, 1.3), W, mats={'f': W}); m.box((-0.44, 0, 1.55), (0.04, 1.0, 0.5), ('window-glass', '#8fb4c8')); m.box((-1.2, 0, 1.98), (1.8, 1.4, 0.08), ('boat-blue', '#3f7fb0'))
    m.cyl((0.6, 0, 0.55), 0.04, 2.6, 5, MT)
one('boat', boat, 200)
from bicycle import build_bicycle
build_bicycle()
def bench(m):
    B = ('bench-blue', '#5b87a8'); m.box((0, 0, 0.42), (1.8, 0.42, 0.06), B); m.box((0, 0.2, 0.72), (1.8, 0.06, 0.3), B)
    for x in (-0.75, 0.75): m.box((x, 0, 0.2), (0.07, 0.4, 0.4), MT); m.box((x, 0.2, 0.6), (0.07, 0.06, 0.5), MT)
one('bench', bench, 100)
def vending(m):
    m.box((0, 0, 0.93), (1.0, 0.72, 1.86), ('vending-body', '#e9eef2'), mats={'f': ('vending', '#dfe8ee')})
one('vending', vending, 20)
def busstop(m):
    m.cyl((0, 0, 0), 0.25, 0.12, 8, CON); m.cyl((0, 0, 0), 0.035, 2.3, 5, MT)
    m.at((0, -0.04, 2.3), rx=math.pi / 2).cyl((0, 0, 0), 0.3, 0.04, 10, ('bus-sign', '#e8a23c')); m.home(); m.box((0, -0.03, 1.6), (0.36, 0.03, 0.5), ('bus-time', '#f4f1e6'))
    m.box((2.2, 0.8, 1.1), (3.0, 0.08, 2.2), ('tin', '#8fa3a8')); m.box((2.2, 0.1, 2.25), (3.3, 1.7, 0.08), ('tin', '#8fa3a8'))
    for x in (0.75, 3.65): m.box((x, -0.6, 1.1), (0.07, 0.07, 2.2), MT)
    m.box((2.2, 0.5, 0.42), (2.2, 0.4, 0.06), ('bench-blue', '#5b87a8'))
    for x in (1.3, 3.1): m.box((x, 0.5, 0.2), (0.07, 0.38, 0.4), MT)
one('busstop', busstop, 200)
def lighthouse(m):
    m.cyl((0, 0, -1.5), 1.9, 1.9, 8, CON, tile=(3, 3))
    m.loft([(0, 0, 0.4, 1.25, 1.25), (0, 0, 7.5, 0.85, 0.85)], 8, ('lh-white', '#f1f0ea')); m.cyl((0, 0, 7.5), 1.2, 0.18, 8, ('lh-red', '#c8463c'))
    m.cyl((0, 0, 7.68), 0.6, 1.1, 8, ('lh-lamp', '#f6eeb0')); m.loft([(0, 0, 8.78, 0.8, 0.8), (0, 0, 9.5, 0.05, 0.05)], 8, ('lh-red', '#c8463c'))
one('lighthouse', lighthouse, 200)
def fence(m):
    m.quad((-2, 0, 0), (2, 0, 0), (2, 0, 1.8), (-2, 0, 1.8), ('chainlink', '#7f9a86'), (0, 0, 4, 1.8))
    for x in (-2, 2): m.cyl((x, 0, -0.3), 0.04, 2.2, 5, ('fence-post', '#6f8a76'))
    m.box((0, 0, 1.82), (4, 0.05, 0.05), ('fence-post', '#6f8a76'))
one('fence', fence, 50)
def gate(m):
    for x in (-3.2, 3.2):
        m.box((x, 0, 0.8), (1.0, 1.0, 2.6), KOGA, tile=(1.4, 1.4), faces='fblr'); m.box((x, 0, 2.2), (1.2, 1.2, 0.25), KOGA, tile=(1.4, 1.4))
        m.box((x + (4.2 if x > 0 else -4.2), 0, 0.3), (7.4, 0.5, 1.6), KOGA, tile=(1.4, 1.4), faces='fblrt')
    m.box((-3.2, -0.52, 1.35), (0.42, 0.04, 1.2), ('nameplate', '#3d3a34'))
one('gate', gate, 100)
def surfboard(m):
    m.loft([(0, 0, 0, 0.02, 0.02), (0, 0, 0.25, 0.2, 0.03), (0, 0, 1.0, 0.27, 0.035), (0, 0, 1.7, 0.2, 0.03), (0, 0, 1.95, 0.02, 0.02)], 8, ('surf', '#f2ecd8'))
    m.box((0, -0.035, 1.0), (0.05, 0.01, 1.6), ('surf-stripe', '#e8734a'))
one('surfboard', surfboard, 100, smooth=True)
def goal(m):
    W = ('goal-white', '#f1f0ea')
    for x in (-3.6, 3.6): m.cyl((x, 0, 0), 0.06, 2.4, 6, W); m.at((x, 0.8, 1.2), rx=-0.6).cyl((0, 0, -1.4), 0.04, 2.8, 4, W); m.home()
    m.at((0, 0, 2.4), ry=math.pi / 2).cyl((0, 0, -3.6), 0.06, 7.2, 6, W); m.home()
    m.quad((-3.6, 1.6, 0), (3.6, 1.6, 0), (3.6, 0, 2.4), (-3.6, 0, 2.4), ('net-alpha', '#e8e8e8'))
one('goal', goal, 120)
def tetrapod(m):
    T = ('concrete', '#bdbab0')
    for (rx, rz) in [(0, 0), (1.91, 0), (1.91, 2.094), (1.91, 4.189)]:
        m.at((0, 0, 0.75), rz=rz, rx=rx).loft([(0, 0, 0, 0.42, 0.42), (0, 0, 1.25, 0.3, 0.3)], 6, T, tile=(2, 2)); m.home()
one('tetrapod', tetrapod, 100)
def laundry(m):
    for x in (-1.6, 1.6): m.cyl((x, 0, 0), 0.04, 2.0, 5, MT)
    m.at((0, 0, 1.9), ry=math.pi / 2).cyl((0, 0, -1.7), 0.02, 3.4, 4, MT); m.home()
    for i, c in enumerate(['#f4f4f0', '#8fb4d8', '#f4f4f0', '#e8b0a0']): m.quad((-1.3 + i * 0.72, 0, 1.1), (-0.75 + i * 0.72, 0, 1.1), (-0.75 + i * 0.72, 0, 1.88), (-1.3 + i * 0.72, 0, 1.88), ('laundry%d-ds' % i, c))
one('laundry', laundry, 80)
def shell(m):
    m.loft([(0, 0, 0, 0.16, 0.12), (0, 0.02, 0.07, 0.11, 0.08), (0, 0.05, 0.11, 0.03, 0.03)], 7, ('shell', '#f4e6d8'))
one('shell', shell, 40, smooth=True)
def ramune(m):
    m.loft([(0, 0, 0, 0.035, 0.035), (0, 0, 0.12, 0.035, 0.035), (0, 0, 0.14, 0.022, 0.022), (0, 0, 0.17, 0.03, 0.03), (0, 0, 0.21, 0.02, 0.02)], 7, ('ramune', '#8fd4d8'))
one('ramune', ramune, 60, smooth=True)
print('DONE', REPORT)
