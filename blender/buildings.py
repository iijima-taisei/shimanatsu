# 建物：校舎、体育館、教室の中、民家、商店など。正面は -Y。原点は地面の中心。
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
CON = ('concrete', '#bdbab0'); WALL = ('school-wall', '#e6e1d2'); WIN = ('school-windows', '#d8dde0')
def base(m, sx, sy, mat=CON, d=1.6):  # 地面のでこぼこを隠す基礎
    m.box((0, 0, -d / 2 + 0.15), (sx, sy, d + 0.3), mat, tile=(3, 3), faces='fblrt')

# ---- 校舎 ----
reset(); m = MB(); W, D, FH = 44.0, 9.0, 3.6; H = FH * 3
m.box((0, 0, -0.6), (W + 1.2, D + 1.2, 1.3), CON, tile=(3, 3), faces='fblrt')   # 土台。上面は中の1階の床より下（中が見えるので）
# 外壁は、校舎の中のモデル（school_in.py）の外壁がそのまま外観になる（窓から中が見え、昇降口から中へそのまま入れる）。ここは屋上だけ
m.box((0, 0, 0.3 + H / 2), (W, D, H), WALL, mats={'t': CON}, faces='t')
for y in (-D / 2 + 0.15, D / 2 - 0.15): m.box((0, y, 0.3 + H + 0.35), (W, 0.3, 0.7), CON, tile=(3, 3))
for x in (-W / 2 + 0.15, W / 2 - 0.15): m.box((x, 0, 0.3 + H + 0.35), (0.3, D, 0.7), CON, tile=(3, 3))
# 階段塔と時計
tx = -W / 2 + 7
# 屋上の階段室と時計
m.box((tx, 0, 0.3 + H + 1.3), (7, 4, 2.6), WALL, tile=(4, 4), mats={'t': CON}, faces='fblrt')
m.at((tx, -2.07, 0.3 + H + 1.4), rx=math.pi / 2).cyl((0, 0, 0), 1.0, 0.12, 12, ('clock-face', '#f4f1e6')); m.home()
m.box((tx, -2.2, 0.3 + H + 1.75), (0.08, 0.04, 0.65), ('clock-hand', '#2a2a2a')); m.box((tx + 0.26, -2.2, 0.3 + H + 1.4), (0.52, 0.04, 0.08), ('clock-hand', '#2a2a2a'))
# 昇降口
# 昇降口：ガラス戸の絵はやめて、ひさしと柱だけ（戸口がそのまま開いている）
m.box((4, -D / 2 - 2.2, 0.3 + 3.55), (9.4, 4.6, 0.3), CON, tile=(3, 3))
for x in (0.2, 7.8): m.box((x, -D / 2 - 4.1, 0.3 + 1.7), (0.4, 0.4, 3.4), CON, tile=(3, 3), faces='fblr')
m.box((4, -D / 2 - 3.6, -0.05), (9.4, 3.0, 0.3), CON, tile=(3, 3), faces='fblrt')   # 昇降口の前の段（中の床と同じ高さまで）
# 屋上の給水タンクと旗ポール
m.cyl((10, 0, 0.3 + H), 1.3, 2.2, 8, ('tank', '#cfd6d8')); m.cyl((tx, -2, 0.3 + H + 2.6), 0.05, 4.5, 5, ('metal', '#c8c8c8'))
m.build('school'); export('school', 1500, view=(-0.6, -1.5, 0.6))

# ---- 体育館 ----
reset(); m = MB(); base(m, 19, 27, d=7.0)   # 東側は坂で地面が4m以上低いので、基礎を深くして浮かせない
m.box((0, 0, 0.3 + 3.5), (18, 26, 7), WALL, tile=(4, 4), faces='fblr')
for i in range(6):  # 高窓
    for sx in (-1, 1): m.quad((sx * 9.02, -11 + i * 4.2 + (0 if sx > 0 else 3), 4.8), (sx * 9.02, -8 + i * 4.2 - (0 if sx > 0 else 3), 4.8), (sx * 9.02, -8 + i * 4.2 - (0 if sx > 0 else 3), 6.4), (sx * 9.02, -11 + i * 4.2 + (0 if sx > 0 else 3), 6.4), ('window-glass', '#8fb4c8'))
R = ('roof-metal', '#7fa39e'); n = 6; pts = [(9.6 * math.cos(math.pi * j / n), 7.2 + 3.0 * math.sin(math.pi * j / n)) for j in range(n + 1)]
for j in range(n):
    (xa, za), (xb, zb) = pts[j], pts[j + 1]
    m.quad((xa, -13.6, za), (xa, 13.6, za), (xb, 13.6, zb), (xb, -13.6, zb), R, (0, 0, 9, 1))
for y, o in ((-13, 1), (13, -1)):
    ring = [(x, y, z) for (x, z) in pts]; ring = ring if o < 0 else list(reversed(ring))
    m.face(ring, [(0.5 + p[0] / 19, (p[2] - 7.2) / 4) for p in ring], WALL)
m.box((0, -13.05, 0.3 + 1.4), (4, 0.1, 2.8), ('gym-door', '#6f8f96'))
m.build('gym'); export('gym', 600)

# ---- 教室（中から見る。面は内向き） ----
def flipbox(m, c, s, mat, **kw):
    i0 = len(m.f); m.box(c, s, mat, **kw)
    for i in range(i0, len(m.f)): m.f[i].reverse(); m.uv[i].reverse()
reset(); RX, RY, RZ = 9.0, 6.0, 3.1   # 校舎の中の間取り（school_layout.py）にそろえて奥行き6m（北側の廊下を3mにした）
m = MB(); FL = ('classroom-floor', '#b08a5c'); PL = ('plaster', '#ece8dc')
flipbox(m, (0, 0, RZ / 2), (RX, RY, RZ), PL, tile={'d': (2, 2), '*': (3, 3)}, mats={'d': FL, 't': ('ceiling', '#f1efe6')}, faces='lrtd')
# 廊下側（+Y）の壁：引き戸の口をあける（x 1.8〜3.2）。廊下から自転車でも入れる
for xa, xb in ((-RX / 2, 1.8), (3.2, RX / 2)): m.quad((xa, RY / 2, 0), (xb, RY / 2, 0), (xb, RY / 2, RZ), (xa, RY / 2, RZ), PL, (0, 0, (xb - xa) / 3, RZ / 3))
m.quad((1.8, RY / 2, 2.2), (3.2, RY / 2, 2.2), (3.2, RY / 2, RZ), (1.8, RY / 2, RZ), PL)
# 窓側（-Y）：腰壁・柱・欄間。窓は開いていて島が見える
m.box((0, -RY / 2, 0.45), (RX, 0.25, 0.9), PL, tile=(3, 3)); m.box((0, -RY / 2, RZ - 0.25), (RX, 0.25, 0.5), PL, tile=(3, 3))
for x in (-RX / 2 + 0.15, -1.5, 1.5, RX / 2 - 0.15): m.box((x, -RY / 2, RZ / 2), (0.3, 0.25, RZ), PL, tile=(3, 3))
AL = ('sash', '#c9d0d2')
for x0, x1 in ((-RX / 2 + 0.3, -1.65), (-1.35, 1.35), (1.65, RX / 2 - 0.3)):
    m.box(((x0 + x1) / 2, -RY / 2, 0.92), (x1 - x0, 0.1, 0.05), AL); m.box(((x0 + x1) / 2, -RY / 2, 2.2), (x1 - x0, 0.06, 0.05), AL)
    m.box((x0 + (x1 - x0) * 0.25, -RY / 2 - 0.03, 1.56), (0.05, 0.05, 1.3), AL)
    m.quad((x0, -RY / 2 - 0.03, 0.92), (x0 + (x1 - x0) * 0.25, -RY / 2 - 0.03, 0.92), (x0 + (x1 - x0) * 0.25, -RY / 2 - 0.03, 2.2), (x0, -RY / 2 - 0.03, 2.2), ('glass-alpha', '#bfe0ee'))
# 黒板（-X の壁）、後ろの棚（+X）、廊下側の戸（+Y）
m.quad((-RX / 2 + 0.04, -2.3, 0.85), (-RX / 2 + 0.04, 2.3, 0.85), (-RX / 2 + 0.04, 2.3, 2.15), (-RX / 2 + 0.04, -2.3, 2.15), ('blackboard', '#2f5a48'))
m.box((-RX / 2 + 0.5, 0, 0.1), (1.0, 3.4, 0.2), ('wood', '#8a6a48')); m.box((-RX / 2 + 1.0, 0.2, 0.2 + 0.5), (0.5, 0.9, 1.0), ('wood', '#8a6a48'))
m.box((RX / 2 - 0.25, 0, 0.5), (0.5, RY - 0.6, 1.0), ('wood', '#8a6a48'), tile=(1, 1))
for xd in (1.8, 3.2): m.box((xd, RY / 2 - 0.05, 1.1), (0.1, 0.12, 2.2), ('door-frame', '#a98f6c'))   # 引き戸の枠
m.box((-RX / 2 + 0.06, 3.1, 2.55), (0.06, 0.5, 0.5), ('clock-face', '#f4f1e6'))
m.build('room')
# 机と椅子：後ろに寄せてある
d = MB(); DT = ('desk-top', '#c9a877'); MT = ('metal', '#9aa0a4')
k = 0
for ix in range(4):
    for iy in range(3):
        x = 1.4 + ix * 0.72 + (iy % 2) * 0.1; y = -2.9 + iy * 0.95
        d.box((x, y, 0.7), (0.62, 0.42, 0.04), DT)
        for ax, ay in ((-0.27, -0.17), (0.27, -0.17), (-0.27, 0.17), (0.27, 0.17)): d.box((x + ax, y + ay, 0.35), (0.03, 0.03, 0.68), MT, faces='fblr')
        if (ix + iy) % 2 == 0:
            d.box((x, y, 0.74 + 0.22), (0.38, 0.36, 0.03), DT); d.box((x, y + 0.17, 0.74 + 0.4), (0.38, 0.03, 0.32), DT)  # 机の上に上げた椅子
d.build('desks')
# 作業机（看板を置く）と文化祭の飾り。ゲーム側で名前ごとに表示を切り替える
s = MB(); s.box((-1.2, 0.2, 0.36), (1.9, 1.3, 0.72), DT, mats={'t': ('plywood', '#d9c39a')}); s.build('sign0')
s = MB(); s.quad((-2.1, -0.4, 0.74), (-0.3, -0.4, 0.74), (-0.3, 0.8, 0.74), (-2.1, 0.8, 0.74), ('festival-sign', '#e8c873')); s.build('sign1')
s = MB(); cols = ['#e8554e', '#f2c14e', '#5aa9e6', '#7bc96f', '#f08cc0']
for i in range(18):   # 紙の輪かざり（天井をジグザグに）
    x0 = -4.2 + i * 0.47; z0 = RZ - 0.2 - (0.35 if i % 2 else 0.05); z1 = RZ - 0.2 - (0.05 if i % 2 else 0.35)
    for y in (-2.2, 1.2): s.quad((x0, y, z0 - 0.07), (x0 + 0.47, y + 0.5, z1 - 0.07), (x0 + 0.47, y + 0.5, z1 + 0.07), (x0, y, z0 + 0.07), ('paper%d-ds' % (i % 5), cols[i % 5]))
s.build('deco1')
s = MB()
for i, (y, z) in enumerate([(-2.2, 2.35), (-1.2, 2.4), (0, 2.42), (1.2, 2.4), (2.2, 2.35), (-2.45, 1.5), (2.45, 1.5)]):  # 黒板のまわりの紙の花
    s.at((-RX / 2 + 0.08, y, z), ry=math.pi / 2).cyl((0, 0, 0), 0.17, 0.05, 6, ('paper%d-ds' % (i % 5), cols[i % 5])); s.home()
s.build('deco2')
s = MB()
for i in range(7):   # 窓の上の提灯
    x = -3.6 + i * 1.2; s.loft([(x, -RY / 2 + 0.35, 2.3, 0.07, 0.07), (x, -RY / 2 + 0.35, 2.38, 0.15, 0.15), (x, -RY / 2 + 0.35, 2.58, 0.15, 0.15), (x, -RY / 2 + 0.35, 2.66, 0.07, 0.07)], 6, ('lantern', '#f6e6c0' if i % 2 else '#f08a7a'))
s.build('deco3')
s = MB(); s.quad((-3.6, RY / 2 - 0.05, 2.25), (2.6, RY / 2 - 0.05, 2.25), (2.6, RY / 2 - 0.05, 2.9), (-3.6, RY / 2 - 0.05, 2.9), ('banner', '#f4f0e4'))  # 横断幕（文字はゲーム側）
s.build('deco4')
export('classroom', 2500, view=(0.9, -1.2, 1.5))

# ---- 民家 ----
def house(name, sx=9.0, sy=6.5, h=2.7, wall=('wood-wall', '#6f5540'), roof=('roof-tile', '#4d5868'), rh=2.1, two=False):
    reset(); m = MB(); base(m, sx + 0.6, sy + 0.6, d=1.4)
    hh = h * (2 if two else 1)
    m.box((0, 0, 0.3 + hh / 2), (sx, sy, hh), wall, tile=(2.5, 2.5), faces='fblr')
    fw = min(5.0, sx - 2)
    m.quad((-fw / 2, -sy / 2 - 0.03, 0.3), (fw / 2, -sy / 2 - 0.03, 0.3), (fw / 2, -sy / 2 - 0.03, 0.3 + h), (-fw / 2, -sy / 2 - 0.03, 0.3 + h), ('house-front', '#8a7358'))
    if two:
        for x in (-sx / 4, sx / 4): m.quad((x - 0.9, -sy / 2 - 0.03, 0.3 + h + 0.9), (x + 0.9, -sy / 2 - 0.03, 0.3 + h + 0.9), (x + 0.9, -sy / 2 - 0.03, 0.3 + h + 2.0), (x - 0.9, -sy / 2 - 0.03, 0.3 + h + 2.0), ('window-glass', '#8fb4c8'))
    top = m.gable((0, 0, 0.3 + hh), sx + 1.4, sy + 1.6, rh, roof, wall=('plaster', '#ece8dc'), tile=(2, 2), wx=sx, wy=sy)
    m.box((0, 0, top), (sx + 1.4, 0.3, 0.2), ('roof-ridge', '#3f4856'))
    m.box((0, -sy / 2 - 0.5, 0.3 + 0.2), (sx * 0.7, 1.0, 0.15), ('wood', '#8a6a48'))   # 縁側
    m.box((sx / 2 - 1.2, sy / 2 + 0.3, 0.9), (0.9, 0.5, 1.2), ('metal', '#b9bdb8'))        # 室外機とタンク
    m.build(name); export(name, 400)
house('house')
house('house2', sx=7.5, sy=6, wall=('plaster', '#ece8dc'), roof=('roof-metal-blue', '#5f7f9c'), rh=1.5, two=True)

# ---- 商店 ----
reset(); m = MB(); base(m, 9.6, 7.1, d=1.4)
m.box((0, 0, 0.3 + 1.6), (9, 6.5, 3.2), ('wood-wall', '#6f5540'), tile=(2.5, 2.5), faces='fblr', mats={'f': ('shop-front', '#a89a80')}, uvs={'f': (0, 0, 1, 1)})
m.gable((0, 0, 3.5), 10.2, 8, 1.9, ('roof-tile', '#4d5868'), wall=('plaster', '#ece8dc'), tile=(2, 2), wx=9, wy=6.5)
m.quad((-4.6, -5.0, 2.55), (4.6, -5.0, 2.55), (4.6, -3.25, 3.1), (-4.6, -3.25, 3.1), ('awning-ds', '#d9a441'))
m.box((0, -4.2, 3.5), (5.2, 0.12, 0.85), ('shop-sign', '#f1ead6'))
m.box((-2.6, -4.2, 0.3 + 0.22), (1.8, 0.5, 0.06), ('bench-blue', '#5b87a8'))
for x in (-3.3, -1.9): m.box((x, -4.2, 0.3 + 0.1), (0.08, 0.45, 0.2), ('metal', '#9aa0a4'))
m.box((2.9, -4.0, 0.3 + 0.45), (1.1, 0.7, 0.9), ('icebox', '#e9eef2'), mats={'t': ('icebox-lid', '#4f8fc0')})
m.build('shop'); export('shop', 400)
print('DONE', REPORT)
