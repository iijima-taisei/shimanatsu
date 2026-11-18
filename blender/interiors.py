# 入れる建物の中：自宅、しおかぜ商店、空港の待合室。
# 部屋の中心の床が原点。ゲームでは x はそのまま、z = -Blenderのy（Blenderの -Y がゲームの南＝入口側）。
# 窓の外は映さない（部屋は建物の上空に置くので）。窓は明るい障子やすりガラスにする。
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
PL = ('plaster', '#ece8dc'); WD = ('wood', '#8a6a48'); DK = ('wood-dark', '#5a4330'); TT = ('tatami', '#c9c08a'); MT = ('metal', '#9aa0a4')
def flipbox(m, c, s, mat, **kw):
    i0 = len(m.f); m.box(c, s, mat, **kw)
    for i in range(i0, len(m.f)): m.f[i].reverse(); m.uv[i].reverse()
def wallquad(m, x0, y0, x1, y1, z0, z1, mat, uv=(0, 0, 1, 1)):   # 部屋の内側を向く壁の板（x0,y0 → x1,y1 を左から右へ見る）
    m.quad((x0, y0, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1 if False else y0, z1), mat, uv)

# ---- 自宅：西が居間、東が自分の部屋。南に玄関 ----
reset(); m = MB(); RX, RY, RZ = 9.0, 6.6, 2.5
flipbox(m, (0, 0, RZ / 2), (RX, RY, RZ), PL, tile={'d': (1.8, 0.9), '*': (2.5, 2.5)}, mats={'d': TT, 't': ('ceiling-wood', '#b89a74')}, faces='fblrtd')
for y in (-RY / 2 + 0.06, RY / 2 - 0.06): m.box((0, y, 0.05), (RX, 0.1, 0.1), DK, faces='fbt')                    # 畳寄せ
m.box((0, 0, RZ - 0.04), (RX - 0.1, 0.08, 0.08), DK, faces='fbd'); m.box((0.6, 0, RZ - 0.04), (0.08, RY - 0.1, 0.08), DK, faces='lrd')
# 間仕切り（ふすま）。まんなかを開けてある
for y0, y1 in ((-RY / 2, -0.95), (0.95, RY / 2)):
    m.box((0.6, (y0 + y1) / 2, RZ / 2), (0.12, y1 - y0, RZ), ('fusuma', '#e6dcc2'), tile=(1.2, 2.4), faces='lrt')
m.box((0.6, 0, RZ - 0.25), (0.12, 1.9, 0.5), PL, faces='lrd')
# 玄関（南西）：土間と引き戸
m.box((-3.5, -RY / 2 + 0.6, 0.02), (2.0, 1.2, 0.04), ('concrete', '#bdbab0'), tile=(1, 1), faces='t'); m.box((-3.5, -RY / 2 + 1.25, 0.1), (2.0, 0.1, 0.2), DK)
m.quad((-4.4, -RY / 2 + 0.03, 0), (-2.6, -RY / 2 + 0.03, 0), (-2.6, -RY / 2 + 0.03, 2.0), (-4.4, -RY / 2 + 0.03, 2.0), ('house-front', '#d8cdb4')); m.f[-1].reverse(); m.uv[-1].reverse()
m.box((-2.3, -RY / 2 + 0.25, 0.45), (0.5, 0.4, 0.9), WD)                                                          # 下駄箱
# 居間の窓（北）と縁側の障子（南）
m.quad((-4.2, RY / 2 - 0.03, 0.75), (-0.2, RY / 2 - 0.03, 0.75), (-0.2, RY / 2 - 0.03, 2.05), (-4.2, RY / 2 - 0.03, 2.05), ('shoji-lit', '#f6f1df'), (0, 0, 3, 1))
m.quad((-2.0, -RY / 2 + 0.03, 0.15), (0.2, -RY / 2 + 0.03, 0.15), (0.2, -RY / 2 + 0.03, 2.05), (-2.0, -RY / 2 + 0.03, 2.05), ('shoji-lit', '#f6f1df'), (0, 0, 2, 1))
m.f[-1].reverse(); m.uv[-1].reverse()   # 南の障子だけ裏返す（北の窓は、そのままで内側を向く）
# ちゃぶ台・座ぶとん・テレビ・扇風機・柱時計
m.cyl((-2.2, 0.3, 0.3), 0.6, 0.05, 10, ('chabudai', '#7a4a2c')); m.cyl((-2.2, 0.3, 0.0), 0.08, 0.3, 6, DK, cap_bot=False)
for (x, y) in ((-2.2, -0.65), (-3.15, 0.3), (-1.25, 0.3)): m.box((x, y, 0.05), (0.55, 0.55, 0.1), ('zabuton', '#8a3a3a'))
m.box((-4.1, 1.9, 0.25), (0.75, 0.6, 0.5), DK); m.box((-4.1, 1.9, 0.82), (0.7, 0.62, 0.64), ('tv-body', '#5a5650'), mats={'r': ('tv-screen', '#2c3a3e')})
# 扇風機は首を振るので別のモデル（blender/moving.py の fan。ゲームで置く）
m.box((-4.42, -0.6, 1.75), (0.08, 0.36, 0.6), ('clock-face', '#f4f1e6'), mats={'r': ('clock-face', '#f4f1e6')})
m.cyl((-2.2, 0.3, 1.85), 0.18, 0.18, 8, ('lampshade', '#f2ead0')); m.cyl((-2.2, 0.3, 2.03), 0.01, 0.47, 3, DK, cap_bot=False)
m.box((-2.2, 0.15, 0.37), (0.36, 0.22, 0.06), ('suika', '#3f8a3c'), mats={'t': ('suika-red', '#e5534b')})          # 切ったスイカ
# 自分の部屋：文机と電気スタンド、日記帳、ふとん、本棚、虫かご、ポスター、窓
m.box((3.4, 2.75, 0.3), (1.4, 0.6, 0.06), WD); 
for (x, y) in ((2.75, 2.5), (4.05, 2.5), (2.75, 3.0), (4.05, 3.0)): m.box((x, y, 0.14), (0.06, 0.06, 0.28), WD, faces='fblr')
m.box((3.15, 2.65, 0.35), (0.42, 0.3, 0.04), ('diary-book', '#3f6fa8')); m.box((3.95, 2.85, 0.5), (0.05, 0.05, 0.36), MT); m.box((3.8, 2.85, 0.7), (0.32, 0.16, 0.08), ('desklamp', '#e2c24a'))
m.box((2.4, 2.55, 0.06), (0.5, 0.5, 0.12), ('zabuton', '#3a5a8a'))
m.quad((2.4, RY / 2 - 0.03, 0.8), (4.3, RY / 2 - 0.03, 0.8), (4.3, RY / 2 - 0.03, 2.0), (2.4, RY / 2 - 0.03, 2.0), ('sky-window', '#cfe8f6'))
m.box((3.35, RY / 2 - 0.08, 0.78), (2.0, 0.12, 0.05), WD); m.box((3.35, RY / 2 - 0.08, 2.02), (2.0, 0.12, 0.05), WD); m.box((3.35, RY / 2 - 0.08, 1.4), (0.04, 0.1, 1.2), WD)
m.box((2.2, -1.6, 0.06), (1.05, 2.0, 0.12), ('futon', '#f3f1ea')); m.box((2.2, -0.75, 0.16), (0.6, 0.3, 0.1), ('pillow', '#cfe0ee')); m.box((2.2, -1.85, 0.14), (1.0, 1.2, 0.06), ('towelket', '#9ccbd8'))
m.box((4.25, -0.4, 0.8), (0.4, 1.2, 1.6), WD, faces='fblrt', mats={'l': ('bookshelf', '#7a5a40')})
m.box((4.25, -0.4, 1.7), (0.3, 0.32, 0.2), ('mushikago', '#7fbf7a'))                                           # 虫かご
m.cyl((4.25, -1.0, 1.6), 0.09, 0.2, 6, ('shell-jar', '#cfe6ee'))
m.quad((1.2, -RY / 2 + 0.03, 1.0), (2.2, -RY / 2 + 0.03, 1.0), (2.2, -RY / 2 + 0.03, 1.9), (1.2, -RY / 2 + 0.03, 1.9), ('poster', '#4fa3c8')); m.f[-1].reverse(); m.uv[-1].reverse()
m.cyl((2.6, 0.2, 2.2), 0.16, 0.12, 8, ('lampshade', '#f2ead0')); m.cyl((2.6, 0.2, 2.32), 0.01, 0.18, 3, DK, cap_bot=False)
m.cyl((3.8, 0.9, 0.0), 0.12, 0.03, 8, ('katori', '#3f7a3a'))                                                    # 蚊取り線香
m.build('home-in'); export('home-in', 1200, view=(0.4, -1.0, 1.6))

# ---- しおかぜ商店：南が入口。奥に帳場 ----
reset(); m = MB(); RX, RY, RZ = 8.6, 6.2, 2.9
flipbox(m, (0, 0, RZ / 2), (RX, RY, RZ), ('wood-wall', '#6f5540'), tile={'d': (1.2, 1.2), '*': (2.5, 2.5)}, mats={'d': ('concrete', '#bdbab0'), 't': ('ceiling-wood', '#b89a74')}, faces='fblrtd')
m.quad((-2.0, -RY / 2 + 0.03, 0), (2.0, -RY / 2 + 0.03, 0), (2.0, -RY / 2 + 0.03, 2.3), (-2.0, -RY / 2 + 0.03, 2.3), ('shop-glass', '#e8f2ee')); m.f[-1].reverse(); m.uv[-1].reverse()
# 帳場（奥）：一段高い畳とレジ
m.box((0, RY / 2 - 1.0, 0.25), (RX - 0.1, 2.0, 0.5), WD, faces='ft', mats={'t': TT}, tile=(1.8, 0.9))
m.box((-0.8, RY / 2 - 2.3, 0.45), (2.4, 0.5, 0.9), WD, mats={'t': ('counter', '#9a7a52')}); m.box((-1.4, RY / 2 - 2.3, 1.0), (0.5, 0.4, 0.2), ('register', '#c9c4b0'))
m.box((0.2, RY / 2 - 2.3, 0.97), (0.6, 0.35, 0.14), ('candyjar', '#e6c86a'))
# 棚：だがし・カップめん・日用品
for x in (-3.2, -1.2):
    m.box((x, -0.6, 0.75), (1.3, 0.5, 1.5), WD, faces='flrt', mats={'f': ('snack-shelf', '#d98a4a')})
    m.box((x, -0.1, 0.75), (1.3, 0.5, 1.5), WD, faces='blrt', mats={'b': ('snack-shelf', '#d98a4a')})
m.box((RX / 2 - 0.3, 0.2, 1.0), (0.6, 3.6, 2.0), WD, faces='fblrt', mats={'l': ('goods-shelf', '#b9a37a')})
# 冷蔵ケース（ラムネ）とアイスの冷凍庫
m.box((2.1, -1.6, 0.95), (1.2, 0.7, 1.9), ('fridge', '#e9eef2'), mats={'l': ('drink-case', '#7fb6cf')})
m.box((2.0, 0.6, 0.4), (1.3, 0.75, 0.8), ('icebox', '#e9eef2'), mats={'t': ('icebox-lid', '#4f8fc0')})
m.box((1.6, -RY / 2 + 0.2, 2.2), (0.04, 0.02, 0.7), ('kori-flag-ds', '#f4f0e4'))
m.quad((1.2, -RY / 2 + 0.25, 1.6), (1.6, -RY / 2 + 0.25, 1.6), (1.6, -RY / 2 + 0.25, 2.5), (1.2, -RY / 2 + 0.25, 2.5), ('kori-flag-ds', '#f4f0e4'))
for x in (-2.0, 0.5, 2.6): m.cyl((x, 0, RZ - 0.35), 0.18, 0.12, 8, ('lampshade', '#f2ead0'))
m.cyl((-RX / 2 + 0.6, -RY / 2 + 0.6, 0.0), 0.32, 0.45, 8, ('bucket', '#5b87a8'))
m.build('shop-in'); export('shop-in', 1000, view=(0.4, -1.1, 1.5))

# ---- 空港の待合室：南が入口、北が滑走路側の大きな窓 ----
reset(); m = MB(); RX, RY, RZ = 14.0, 7.0, 3.4
flipbox(m, (0, 0, RZ / 2), (RX, RY, RZ), PL, tile={'d': (1.5, 1.5), '*': (3, 3)}, mats={'d': ('terrazzo', '#d7d3c8'), 't': ('ceiling', '#f1efe6')}, faces='fblrtd')
m.quad((RX / 2 - 0.3, RY / 2 - 0.03, 0.5), (-RX / 2 + 0.3, RY / 2 - 0.03, 0.5), (-RX / 2 + 0.3, RY / 2 - 0.03, 3.0), (RX / 2 - 0.3, RY / 2 - 0.03, 3.0), ('runway-view', '#cfe8f6'))
m.f[-1].reverse(); m.uv[-1].reverse()
for x in range(-6, 7, 2): m.box((x, RY / 2 - 0.08, 1.75), (0.1, 0.1, 2.5), MT, faces='fblr')
m.quad((-1.6, -RY / 2 + 0.03, 0), (1.6, -RY / 2 + 0.03, 0), (1.6, -RY / 2 + 0.03, 2.5), (-1.6, -RY / 2 + 0.03, 2.5), ('shop-glass', '#e8f2ee')); m.f[-1].reverse(); m.uv[-1].reverse()
# 長いす
for y in (-0.6, 1.2):
    for x in (-4.5, 0.5):
        m.box((x, y, 0.42), (3.2, 0.5, 0.06), ('bench-blue', '#5b87a8')); m.box((x, y + 0.24, 0.7), (3.2, 0.06, 0.5), ('bench-blue', '#5b87a8'))
        for dx in (-1.4, 1.4): m.box((x + dx, y, 0.2), (0.06, 0.4, 0.4), MT, faces='fblr')
# カウンターと時刻表
m.box((RX / 2 - 1.8, -1.6, 0.5), (0.7, 3.0, 1.0), ('counter', '#9a7a52'), mats={'t': ('counter-top', '#e9e4d6')})
m.quad((RX / 2 - 0.03, -2.8, 1.3), (RX / 2 - 0.03, -0.4, 1.3), (RX / 2 - 0.03, -0.4, 2.6), (RX / 2 - 0.03, -2.8, 2.6), ('timetable', '#2f3a48')); m.f[-1].reverse(); m.uv[-1].reverse()
m.box((-RX / 2 + 0.5, -2.6, 0.9), (0.9, 0.7, 1.8), ('vending', '#e6eef2'), mats={'r': ('vending', '#e6eef2')})
m.box((-RX / 2 + 0.3, 1.5, 1.1), (0.6, 1.2, 2.2), ('souvenir', '#c9a46a'), mats={'r': ('souvenir-shelf', '#d98a4a')})
for x in (-4.0, 0.0, 4.0): m.box((x, 0, RZ - 0.05), (2.4, 0.3, 0.06), ('light-panel', '#f6f4ec'))
m.build('terminal-in'); export('terminal-in', 900, view=(0.4, -1.1, 1.5))
print('DONE', REPORT)
