# 持ち物（傘・虫取り網・浮き輪・麦わら帽子）と、原付（荷台と前かごのついた、小さなバイク）。
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
MT = ('metal', '#9aa0a4')
def one(name, fn, limit=400, **kw):
    reset(); m = MB(); fn(m); m.build(name, smooth=kw.pop('smooth', False)); export(name, limit, **kw)
def umbrella(m):   # 開いた傘。原点は手で持つところ、傘の骨は上（+Z）
    m.cyl((0, 0, 0), 0.015, 0.95, 5, ('umbrella-shaft', '#e8e8e8'), cap_bot=False)
    m.loft([(0, 0, -0.06, 0.02, 0.02), (0.04, 0, -0.12, 0.02, 0.02), (0.07, 0, -0.06, 0.018, 0.018)], 4, ('umbrella-handle', '#f4f4f0'))
    n = 10; R = 0.58; top = 0.98
    for i in range(n):   # 8〜10枚の布（両面）
        a, b = 2*math.pi*i/n, 2*math.pi*(i + 1)/n
        p0 = (0, 0, top + 0.08); p1 = (math.cos(a)*R, math.sin(a)*R, top - 0.18); p2 = (math.cos(b)*R, math.sin(b)*R, top - 0.18)
        m.face([p0, p1, p2], [(0.5, 1), (0, 0), (1, 0)], ('umbrella-cloth-ds', '#cfe6f2'))
    for i in range(n): a = 2*math.pi*i/n; m.box((math.cos(a)*R*0.5, math.sin(a)*R*0.5, top - 0.06), (0.012, 0.012, 0.012), MT)
one('umbrella', umbrella, 200)
def bugnet(m):   # 虫取り網。原点は手で持つところ、網は上
    m.cyl((0, 0, -0.3), 0.018, 1.7, 5, ('bamboo', '#c9b06a'), cap_bot=False)
    m.at((0, 0, 1.55), rx=math.pi/2).loft([(0, 0, -0.01, 0.2, 0.2), (0, 0, 0.01, 0.2, 0.2)], 10, ('net-ring', '#4a7a3a'), cap_top=False, cap_bot=False); m.home()
    m.at((0, 0, 1.55), rx=math.pi/2).loft([(0, 0, 0, 0.2, 0.2), (0, 0, 0.3, 0.12, 0.12), (0, 0, 0.42, 0.02, 0.02)], 8, ('net-alpha', '#7fbf6a'), cap_top=False, cap_bot=False); m.home()
one('bugnet', bugnet, 200)
def ukiwa(m):   # 浮き輪（赤と白）。原点は輪のまんなか
    n, k, R, r = 12, 6, 0.32, 0.1
    for i in range(n):
        for j in range(k):
            def pt(a, b): return ((R + r*math.cos(b))*math.cos(a), (R + r*math.cos(b))*math.sin(a), r*math.sin(b))
            a0, a1, b0, b1 = 2*math.pi*i/n, 2*math.pi*(i + 1)/n, 2*math.pi*j/k, 2*math.pi*(j + 1)/k
            m.face([pt(a0, b0), pt(a1, b0), pt(a1, b1), pt(a0, b1)], [(0, 0), (1, 0), (1, 1), (0, 1)], ('ukiwa-red', '#e5534b') if i % 2 else ('ukiwa-white', '#f4f4f0'))
one('ukiwa', ukiwa, 200, smooth=True)
def strawhat(m):  # 麦わら帽子。原点は頭のてっぺんの少し下
    m.loft([(0, 0, 0.0, 0.25, 0.25), (0, 0, 0.012, 0.25, 0.25)], 14, ('straw-ds', '#e6cf96'), cap_top=True, cap_bot=True)
    m.loft([(0, 0, 0.012, 0.13, 0.13), (0, 0, 0.1, 0.12, 0.12), (0, 0, 0.13, 0.07, 0.07)], 12, ('straw-ds', '#e6cf96'), cap_bot=False)
    m.loft([(0, 0, 0.014, 0.133, 0.133), (0, 0, 0.045, 0.128, 0.128)], 12, ('ribbon', '#2f4a78'), cap_top=False, cap_bot=False)
one('strawhat', strawhat, 200)

# ---- 原付：前かご・荷台・脚まわりの覆いのついた、小さなバイク。自転車と同じく、正面はゲームの +X ----
reset(); root = empty('moped')
BODY = ('moped-body', '#7fbfa4'); SHIELD = ('moped-shield', '#efe6cf'); SEAT = ('seat', '#3a2c24'); TIRE = ('tire', '#2a2a2a'); CH = ('chrome', '#c8ccd0')
b = MB()
b.box((-0.05, 0, 0.42), (0.9, 0.2, 0.18), BODY)                                  # 下の骨（足を通すところは低い）
b.box((-0.12, 0, 0.62), (0.4, 0.26, 0.22), BODY); b.box((-0.18, 0, 0.78), (0.52, 0.24, 0.1), SEAT)   # 座席の下と座席
b.box((-0.55, 0, 0.82), (0.36, 0.3, 0.03), MT); b.box((-0.55, 0, 0.66), (0.05, 0.28, 0.3), MT)     # 荷台
b.box((-0.38, 0, 0.5), (0.3, 0.3, 0.18), BODY)                                    # うしろの覆い
b.box((0.3, 0, 0.62), (0.1, 0.46, 0.55), SHIELD, faces='fblrt')                   # 脚の前の覆い（白）
b.box((0.42, 0, 0.82), (0.08, 0.12, 0.5), BODY)                                   # 前の柱
b.box((0.45, 0, 1.06), (0.08, 0.62, 0.05), CH); b.box((0.45, 0.32, 1.06), (0.1, 0.06, 0.06), SEAT); b.box((0.45, -0.32, 1.06), (0.1, 0.06, 0.06), SEAT)   # ハンドルとグリップ
b.at((0.53, 0, 1.0), ry=math.pi/2).cyl((0, 0, 0), 0.07, 0.06, 8, ('lh-lamp', '#f6eeb0')); b.home()            # 丸いライト
b.box((0.68, 0, 0.86), (0.28, 0.32, 0.03), ('basket', '#b9b3a4'))
for y0 in (-0.16, 0.16): b.box((0.68, y0, 0.93), (0.28, 0.02, 0.14), ('basket', '#b9b3a4'))
for x0 in (0.54, 0.82): b.box((x0, 0, 0.93), (0.02, 0.32, 0.14), ('basket', '#b9b3a4'))
b.box((-0.05, -0.16, 0.34), (0.32, 0.14, 0.2), ('engine', '#6f7478'))              # エンジン
b.box((-0.45, -0.16, 0.32), (0.5, 0.07, 0.07), CH)                                # マフラー
b.box((0.6, 0, 0.55), (0.04, 0.08, 0.5), CH); b.box((-0.6, 0, 0.45), (0.3, 0.08, 0.04), CH)   # 前のフォークと後ろの腕
b.box((0.6, 0, 0.44), (0.42, 0.12, 0.03), BODY)                                   # 前の泥よけ
b.build('frame', parent=root)
for name, x in (('wheelRear', -0.6), ('wheelFront', 0.6)):
    hub = empty(name, (x, 0, 0.3), root); w = MB()
    w.at(rx=math.pi/2).loft([(0, 0, -0.05, 0.3, 0.3), (0, 0, 0.05, 0.3, 0.3)], 12, TIRE); w.home()
    w.at(rx=math.pi/2).loft([(0, 0, -0.052, 0.17, 0.17), (0, 0, 0.052, 0.17, 0.17)], 8, CH, cap_top=True, cap_bot=True); w.home()
    w.build(name + 'Mesh', parent=hub)
export('moped', 700, view=(-0.7, -1.5, 0.55))
print('DONE', REPORT)
