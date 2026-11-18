# 動く小物：風になびく草の株（grass-tuft）と、首を振る扇風機（fan）。
# 草はゲーム側で頂点を揺らす（高いところほど大きく）。扇風機は fanHead（首）と fanBlades（羽根）を動かす。
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

# ---- 草の株：細い葉を放射状に。下半分は濃い緑、先は明るい緑 ----
reset(); m = MB(); rnd = random.Random(3)
LO = ('grass-blade-lo-ds', '#3f7a32'); HI = ('grass-blade-hi-ds', '#7fb24e')
for i in range(16):
    a = rnd.uniform(0, math.pi * 2); r0 = rnd.uniform(0, 0.12); h = rnd.uniform(0.45, 0.85); lean = rnd.uniform(0.1, 0.35); w = rnd.uniform(0.035, 0.06)
    c, s = math.cos(a), math.sin(a); bx, by = c * r0, s * r0; px, py = -s * w, c * w
    mx, my, mz = bx + c * lean * 0.35, by + s * lean * 0.35, h * 0.5
    tx, ty, tz = bx + c * lean, by + s * lean, h
    m.quad((bx - px, by - py, -0.05), (bx + px, by + py, -0.05), (mx + px * 0.7, my + py * 0.7, mz), (mx - px * 0.7, my - py * 0.7, mz), LO)
    m.face([(mx - px * 0.7, my - py * 0.7, mz), (mx + px * 0.7, my + py * 0.7, mz), (tx, ty, tz)], [(0, 0), (1, 0), (0.5, 1)], HI)
m.build('grass-tuft'); export('grass-tuft', 200)

# ---- 扇風機：台・柱・首（fanHead）・羽根（fanBlades）。高さ約1.1m ----
reset()
WH = ('fan', '#e8eef2'); BL = ('fan-blade-alpha', '#9fd0ea'); GR = ('fan-guard', '#c8d2d8'); BT = ('fan-button', '#5aa0c8')
root = empty('fan')
m = MB(); m.cyl((0, 0, 0), 0.22, 0.06, 16, WH); m.cyl((0, 0, 0.06), 0.035, 0.86, 8, WH, cap_bot=False)
for i, x in enumerate((-0.09, -0.03, 0.03, 0.09)): m.box((x, -0.16, 0.065), (0.045, 0.04, 0.02), BT if i else ('fan-button-on', '#e8734a'))
m.build('fanBase', parent=root)
head = empty('fanHead', (0, 0, 0.95), root)
m = MB(); m.box((0, 0.04, 0), (0.12, 0.2, 0.14), WH); m.cyl((0, -0.06, 0), 0.07, 0.0, 10, WH)
# 前後のガード（細い輪と、放射状の骨）
for y in (-0.1, -0.2):
    for k in range(24):
        a0, a1 = k / 24 * math.pi * 2, (k + 1) / 24 * math.pi * 2; R = 0.27
        m.at((0, y, 0), ry=-(a0 + a1) / 2).box((R, 0, 0), (0.012, 0.012, R * 0.27), GR); m.home()
    for k in range(12): m.at((0, y, 0), ry=k / 12 * math.pi * 2).box((0.135, 0, 0), (0.27, 0.008, 0.008), GR); m.home()
m.cyl((0, -0.21, 0), 0.05, 0.0, 10, ('fan-badge', '#4a8ac0'))
m.build('fanHeadMesh', parent=head)
blades = empty('fanBlades', (0, -0.15, 0), head)
m = MB(); m.at((0, 0, 0), rx=math.pi / 2).cyl((0, 0, -0.03), 0.045, 0.06, 10, WH); m.home()
for k in range(3):
    a = k / 3 * math.pi * 2
    c, s = math.cos(a), math.sin(a); cc, ss = math.cos(a + 0.7), math.sin(a + 0.7); c2, s2 = math.cos(a - 0.35), math.sin(a - 0.35)
    m.face([(c2 * 0.04, 0, s2 * 0.04), (c * 0.24, 0, s * 0.24), (cc * 0.21, 0, ss * 0.21), (math.cos(a + 0.6) * 0.05, 0, math.sin(a + 0.6) * 0.05)], [(0, 0), (1, 0), (1, 1), (0, 1)], BL)
m.build('fanBladesMesh', parent=blades)
export('fan', 3000)
