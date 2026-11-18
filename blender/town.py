# 住宅街の部品：塀、ポスト、カーブミラー、火の見やぐら、掲示板、軽トラ、家の種類など。
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
KOGA = ('koga-stone', '#cfcdc4'); CON = ('concrete', '#bdbab0'); WOOD = ('wood', '#8a6a48'); MT = ('metal', '#9aa0a4')
def one(name, fn, limit=300, **kw):
    reset(); m = MB(); fn(m); m.build(name, smooth=kw.pop('smooth', False)); export(name, limit, **kw)
def base(m, sx, sy, d=1.4): m.box((0, 0, -d / 2 + 0.15), (sx, sy, d + 0.3), CON, tile=(3, 3), faces='fblrt')

def wall(m):   # コーガ石の塀（長さ4m）。片端に門柱
    m.box((0, 0, 0.35), (4.0, 0.32, 1.9), KOGA, tile=(1.4, 1.4), faces='fblr'); m.box((0, 0, 1.33), (4.1, 0.42, 0.1), KOGA, tile=(1.4, 1.4))
    m.box((2.0, 0, 0.5), (0.5, 0.5, 2.2), KOGA, tile=(1.4, 1.4), faces='fblr'); m.box((2.0, 0, 1.64), (0.62, 0.62, 0.12), KOGA, tile=(1.4, 1.4))
one('wall', wall, 60)
def hedge(m):  # 生け垣（長さ4m）
    m.box((0, 0, 0.45), (4.0, 0.7, 1.7), ('hedge', '#3f7038'), faces='fblrt'); m.card((0, -0.36, -0.1), 4.0, 1.5, ('leaves', '#4f8a45')); m.card((0, 0.36, -0.1), 4.0, 1.5, ('leaves', '#4f8a45'))
one('hedge', hedge, 40)
def postbox(m):  # 丸い郵便ポスト
    R = ('post-red', '#c8372d'); m.cyl((0, 0, -0.2), 0.24, 0.5, 8, CON); m.loft([(0, 0, 0.3, 0.2, 0.2), (0, 0, 1.15, 0.2, 0.2), (0, 0, 1.25, 0.25, 0.25), (0, 0, 1.33, 0.22, 0.22), (0, 0, 1.42, 0.06, 0.06)], 8, R)
    m.box((0, -0.2, 0.98), (0.2, 0.04, 0.04), ('post-dark', '#3a1d1a'))
one('postbox', postbox, 100, smooth=False)
def mirror(m):   # カーブミラー
    O = ('mirror-orange', '#e8862e'); m.cyl((0, 0, -0.3), 0.045, 3.2, 6, O); m.at((0, -0.12, 2.75), rx=math.pi / 2 - 0.25).cyl((0, 0, 0), 0.42, 0.05, 10, O); m.home()
    m.at((0, -0.15, 2.74), rx=math.pi / 2 - 0.25).cyl((0, 0, 0.03), 0.36, 0.03, 10, ('mirror-glass', '#bcd9e8')); m.home()
one('mirror', mirror, 120)
def firetower(m):  # 火の見やぐら（集落の目印）
    R = ('tower-red', '#b5382c'); H = 11.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.loft([(sx * 1.2, sy * 1.2, -0.4, 0.07, 0.07), (sx * 0.55, sy * 0.55, H, 0.06, 0.06)], 4, R, a0=math.pi / 4)
    for i in range(1, 6):
        z = i * H / 6; w = 1.2 - (1.2 - 0.55) * z / H
        for (a, b) in [((-w, -w), (w, -w)), ((w, -w), (w, w)), ((w, w), (-w, w)), ((-w, w), (-w, -w))]:
            cx, cy = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            m.box((cx, cy, z), (abs(b[0] - a[0]) + 0.06 if a[1] == b[1] else 0.06, 0.06 if a[1] == b[1] else abs(b[1] - a[1]) + 0.06, 0.06), R)
    m.box((0, 0, H + 0.05), (1.9, 1.9, 0.1), ('tower-deck', '#6f6a62'))
    for (x, y, sx, sy) in [(0, -0.92, 1.9, 0.05), (0, 0.92, 1.9, 0.05), (-0.92, 0, 0.05, 1.9), (0.92, 0, 0.05, 1.9)]: m.box((x, y, H + 0.95), (sx, sy, 0.06), R)
    for sx in (-1, 1):
        for sy in (-1, 1): m.box((sx * 0.9, sy * 0.9, H + 1.15), (0.06, 0.06, 2.2), R)
    P = [(-1.25, -1.25), (1.25, -1.25), (1.25, 1.25), (-1.25, 1.25)]
    i0 = len(m.f)
    for i in range(4):
        a, b = P[i], P[(i + 1) % 4]; m.face([(a[0], a[1], H + 2.25), (b[0], b[1], H + 2.25), (0, 0, H + 3.2)], [(0, 0), (1, 0), (0.5, 1)], ('tin-roof', '#8a4a3a'))
    m.underside(i0)
    m.loft([(0.4, 0, H + 1.5, 0.12, 0.12), (0.4, 0, H + 1.75, 0.2, 0.2), (0.4, 0, H + 1.95, 0.05, 0.05)], 6, ('bell', '#b9a05a'))
    m.box((0, -1.24, 2.0), (0.05, 0.05, 4.4), MT)
one('firetower', firetower, 400)
def noticeboard(m):
    for x in (-0.8, 0.8): m.box((x, 0, 0.9), (0.08, 0.08, 2.2), WOOD, faces='fblr')
    m.box((0, 0, 1.35), (1.7, 0.08, 1.0), WOOD, mats={'f': ('noticeboard', '#5a7a5a')}); m.gable((0, 0, 1.92), 2.0, 0.5, 0.18, ('tin-roof', '#8a4a3a'))
one('noticeboard', noticeboard, 60)
def planter(m):
    m.box((0, 0, 0.13), (0.9, 0.3, 0.26), ('planter', '#b9825a')); m.card((0, 0, 0.2), 0.95, 0.6, ('garden-flowers', '#c8463c')); m.card((0, 0, 0.2), 0.4, 0.6, ('garden-flowers', '#c8463c'), rz=math.pi / 2)
one('planter', planter, 30)
def hibiscus(m):
    for i in range(3): m.card((0, 0, -0.1), 2.0, 1.7, ('garden-flowers', '#c8463c'), rz=i * math.pi / 3)
one('hibiscus', hibiscus, 10)
def stopsign(m):
    m.cyl((0, 0, -0.3), 0.035, 2.8, 5, MT); z = 2.3
    m.face([(-0.4, -0.04, z + 0.35), (0.4, -0.04, z + 0.35), (0, -0.04, z - 0.35)], [(0, 1), (1, 1), (0.5, 0)], ('stop-red', '#c8372d'))
    m.face([(-0.24, -0.05, z + 0.25), (0.24, -0.05, z + 0.25), (0, -0.05, z - 0.17)], [(0, 1), (1, 1), (0.5, 0)], ('stop-white', '#f1f0ea'))
    m.face([(-0.16, -0.06, z + 0.2), (0.16, -0.06, z + 0.2), (0, -0.06, z - 0.08)], [(0, 1), (1, 1), (0.5, 0)], ('stop-red', '#c8372d'))
one('stopsign', stopsign, 40)
def keitruck(m):  # 軽トラ
    W = ('truck-white', '#eef0ee'); D = ('tire', '#2a2a2a')
    m.box((0, 0.55, 0.62), (1.4, 1.95, 0.12), W); 
    for (x, y, sx, sy) in [(-0.68, 0.55, 0.05, 1.95), (0.68, 0.55, 0.05, 1.95), (0, 1.5, 1.4, 0.05)]: m.box((x, y, 0.83), (sx, sy, 0.3), W)
    m.box((0, -1.0, 0.75), (1.4, 1.1, 0.5), W); m.box((0, -0.92, 1.3), (1.34, 0.9, 0.62), W, mats={'f': ('window-glass', '#8fb4c8'), 'l': ('window-glass', '#8fb4c8'), 'r': ('window-glass', '#8fb4c8')})
    m.box((0, -0.92, 1.63), (1.38, 0.95, 0.05), W); m.box((0, -1.56, 0.62), (1.2, 0.03, 0.12), ('truck-dark', '#3a3a3a'))
    for x in (-0.45, 0.45): m.box((x, -1.57, 0.8), (0.2, 0.02, 0.12), ('lh-lamp', '#f6eeb0'))
    for (x, y) in [(-0.62, -1.0), (0.62, -1.0), (-0.62, 0.95), (0.62, 0.95)]: m.at((x, y, 0.28), ry=math.pi / 2).loft([(0, 0, -0.08, 0.28, 0.28), (0, 0, 0.08, 0.28, 0.28)], 8, D); m.home()
    m.box((0, 0, 0.42), (1.3, 3.0, 0.22), ('truck-dark', '#3a3a3a'))
one('keitruck', keitruck, 300)
def house3(m):  # トタン屋根のL字の家
    base(m, 10.6, 8.6); W = ('plaster', '#ece8dc'); T = ('tin-roof', '#8a4a3a')
    m.box((-1.5, 0.5, 0.3 + 1.35), (7.0, 7.0, 2.7), W, tile=(2.5, 2.5), faces='fblr'); m.box((3.5, -1.5, 0.3 + 1.35), (3.4, 4.6, 2.7), W, tile=(2.5, 2.5), faces='fblr')
    m.quad((-3.9, -3.03, 0.3), (0.9, -3.03, 0.3), (0.9, -3.03, 3.0), (-3.9, -3.03, 3.0), ('house-front2', '#d9d3c4'))
    m.quad((2.4, -3.83, 1.2), (4.6, -3.83, 1.2), (4.6, -3.83, 2.4), (2.4, -3.83, 2.4), ('window-glass', '#8fb4c8'))
    m.gable((-1.5, 0.5, 3.0), 8.2, 8.2, 1.7, T, wall=W, tile=(2, 2), wx=7.0, wy=7.0); m.gable((3.5, -1.5, 3.0), 4.4, 5.6, 1.2, T, wall=W, tile=(2, 2), along='y', wx=3.4, wy=4.6)
    for i in range(2): m.cyl((5.45, 0.2 + i * 0.5, 0.3), 0.18, 1.2, 6, ('gas', '#b8bcc0'))     # プロパンガス
    m.box((-5.2, 1.5, 0.75), (0.5, 0.9, 0.7), ('metal', '#b9bdb8'))
one('house3', house3, 400)
def house4(m):  # 2階建ての民宿
    base(m, 11.6, 8.1); W = ('wood-wall', '#6f5540'); P = ('plaster', '#ece8dc')
    m.box((0, 0, 0.3 + 1.4), (11, 7.5, 2.8), W, tile=(2.5, 2.5), faces='fblr'); m.box((0, 0.6, 3.1 + 1.3), (9.6, 6.0, 2.6), P, tile=(2.5, 2.5), faces='fblr')
    m.quad((-2.5, -3.78, 0.3), (2.5, -3.78, 0.3), (2.5, -3.78, 3.0), (-2.5, -3.78, 3.0), ('house-front', '#8a7358'))
    for x in (-3.2, 0, 3.2): m.quad((x - 1.1, -2.43, 3.9), (x + 1.1, -2.43, 3.9), (x + 1.1, -2.43, 5.2), (x - 1.1, -2.43, 5.2), ('window-glass', '#8fb4c8'))
    R = ('roof-tile', '#4d5868'); i0 = len(m.f); m.quad((-5.9, -4.6, 2.9), (5.9, -4.6, 2.9), (5.9, -2.4, 3.5), (-5.9, -2.4, 3.5), R, (0, 0, 6, 1.2)); m.underside(i0)
    top = m.gable((0, 0.6, 5.7), 11.0, 7.4, 1.9, R, wall=P, tile=(2, 2), wx=9.6, wy=6.0); m.box((0, 0.6, top), (11.0, 0.3, 0.2), ('roof-ridge', '#3f4856'))
    m.box((3.6, -4.0, 2.2), (0.12, 0.5, 1.5), ('inn-sign', '#f1ead6'))
one('house4', house4, 400)
def shed(m):   # 物置と小舟
    base(m, 5.2, 4.2, d=1.0); T = ('tin-roof', '#8a4a3a')
    m.box((0, 0, 0.3 + 1.2), (4.8, 3.8, 2.4), ('tin', '#8fa3a8'), tile=(2, 2), faces='blr'); m.quad((-2.4, -1.9, 2.7), (2.4, -1.9, 2.7), (2.4, 1.9, 3.1), (-2.4, 1.9, 3.1), T, (0, 0, 2.4, 2)); 
    m.quad((2.6, -2.2, 2.62), (-2.6, -2.2, 2.62), (-2.6, 2.2, 3.12), (2.6, 2.2, 3.12), T, (0, 0, 2.6, 2.2))
    # 屋根は奥ほど高い（2.7→3.1）ので、横の壁の上に三角、奥の壁の上に帯を足して、屋根とのすき間をふさぐ
    TN = ('tin', '#8fa3a8')
    for x in (-2.4, 2.4): m.face([(x, -1.9, 2.7), (x, 1.9, 2.7), (x, 1.9, 3.12)], [(0, 0), (1, 0), (1, 0.2)], TN)
    m.quad((-2.4, 1.9, 2.7), (2.4, 1.9, 2.7), (2.4, 1.9, 3.12), (-2.4, 1.9, 3.12), TN, (0, 0, 2, 0.2))
    m.box((-1.2, 0.4, 0.75), (1.6, 2.0, 0.9), ('wood', '#8a6a48')); m.cyl((1.4, 0.6, 0.3), 0.35, 0.9, 7, ('drum-blue', '#3f7fb0'))
one('shed', shed, 150)
def gomi(m):   # ごみ集積所のネット箱
    for x in (-0.9, 0.9):
        for y in (-0.5, 0.5): m.box((x, y, 0.5), (0.05, 0.05, 1.0), ('fence-post', '#6f8a76'))
    m.box((0, 0, 0.5), (1.8, 1.0, 0.96), ('chainlink', '#7f9a86'), faces='fblrt', tile=(1, 1))
one('gomi', gomi, 60)
print('DONE', REPORT)

# ---- 2回目の追加：猫、干物棚 ----
def cat_model(fur, spot):
    def fn(m):
        F = ('cat-fur', fur); S = ('cat-spot', spot)
        m.loft([(0, 0.02, 0.0, 0.1, 0.13), (0, 0.03, 0.12, 0.11, 0.14), (0, -0.02, 0.26, 0.075, 0.09), (0, -0.05, 0.32, 0.05, 0.05)], 7, F)       # 座った胴
        m.loft([(0, -0.08, 0.3, 0.055, 0.06), (0, -0.09, 0.36, 0.075, 0.075), (0, -0.09, 0.42, 0.06, 0.065), (0, -0.08, 0.45, 0.02, 0.02)], 7, S)  # 頭
        for sx in (-1, 1): m.face([(sx * 0.07, -0.08, 0.42), (sx * 0.02, -0.08, 0.44), (sx * 0.055, -0.07, 0.5)], [(0, 0), (1, 0), (0.5, 1)], ('cat-ear-ds', spot))
        for sx in (-1, 1): m.loft([(sx * 0.05, -0.1, 0.0, 0.025, 0.03), (sx * 0.05, -0.09, 0.2, 0.025, 0.03)], 5, F)
        m.loft([(0.1, 0.12, 0.02, 0.022, 0.022), (0.17, 0.05, 0.03, 0.022, 0.022), (0.17, -0.06, 0.035, 0.015, 0.015)], 5, S, cap_bot=True)
    return fn
one('cat', cat_model('#e0a25a', '#c98843'), 120, smooth=True)
one('cat2', cat_model('#f0eee8', '#3a3838'), 120, smooth=True)
def fishrack(m):   # 干物棚（島の名物の干物）
    for x in (-1.4, 1.4):
        for y in (-0.45, 0.45): m.box((x, y, 0.55), (0.06, 0.06, 1.3), WOOD, faces='fblr')
    for z in (0.75, 1.15):
        m.box((0, 0, z), (3.0, 1.0, 0.04), ('rack-net', '#9a9684'))
        for i in range(7):
            for y in (-0.22, 0.22): m.quad((-1.25 + i * 0.4, y - 0.14, z + 0.03), (-1.0 + i * 0.4, y - 0.14, z + 0.03), (-1.0 + i * 0.4, y + 0.14, z + 0.03), (-1.25 + i * 0.4, y + 0.14, z + 0.03), ('fish', '#b9a58a'))
one('fishrack', fishrack, 250)
print('DONE2', REPORT)
