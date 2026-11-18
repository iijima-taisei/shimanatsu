# 校舎の中（1〜3階、廊下、階段、各部屋、家具）と、動かせる机・いす。
# 間取りは school_layout.py。ゲームの座標そのままで作る（ゲーム (x, y, z) → Blender (x, -z, y)）。
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from school_layout import LAYOUT as L
F, CH, T = L['F'], L['CH'], L['T']
PL = ('plaster', '#ece8dc'); FL = ('classroom-floor', '#b08a5c'); CE = ('ceiling', '#f1efe6'); CO = ('concrete', '#bdbab0'); WD = ('wood', '#8a6a48'); MT = ('metal', '#9aa0a4')
GL = ('glass-alpha', '#bfe0ee'); SA = ('sash', '#c9d0d2'); WAIN = ('wainscot', '#9c8a6e')
def gbox(m, x0, x1, y0, y1, z0, z1, mat, **kw):   # ゲーム座標の箱
    m.box(((x0 + x1)/2, -(z0 + z1)/2, (y0 + y1)/2), (abs(x1 - x0), abs(z1 - z0), abs(y1 - y0)), mat, **kw)
def gquad(m, x0, z0, x1, z1, y0, y1, mat, nx, nz, uv=(0, 0, 1, 1)):   # 縦の板。向き (nx, nz) を向く
    p = [(x0, -z0, y0), (x1, -z1, y0), (x1, -z1, y1), (x0, -z0, y1)]
    ex, ey = x1 - x0, -(z1 - z0); n = (ey*(y1 - y0), -ex*(y1 - y0))   # (e × up) の水平成分
    if n[0]*nx + n[1]*(-nz) < 0: p = [p[1], p[0], p[3], p[2]]
    m.quad(*p, mat, uv)
def ours(x, z, fl): return fl == 2 and 35.5 <= x <= 44.5 and z > L['ZC']

reset(); m = MB()
# ---- 床と天井 ----
for f in L['floors']:
    x0, x1, z0, z1, h, h1 = f['x0'], f['x1'], f['z0'], f['z1'], f['h'], f['h1']
    if h != h1:   # 階段：14段の段々（当たり判定はなめらかな坂）
        n = 14
        for i in range(n):
            a = x0 + (x1 - x0)*i/n; b = x0 + (x1 - x0)*(i + 1)/n; y = h + (h1 - h)*(i + 0.5)/n
            gbox(m, a, b, y - 0.25, y, z0 + 0.05, z1 - 0.05, ('stairs', '#b8a88a'), tile=(1, 1), mats={'t': ('stair-top', '#a8875c')})
        # 段の下の斜めの板（下から見たとき）
        continue
    fl = F.index(h) if h in F else 0
    segs = [(x0, x1)]
    if fl == 2 and z0 >= L['ZC'] - 0.01 and x0 <= 35.5 and x1 >= 44.5: segs = [(x0, 35.5), (44.5, x1)]   # 自分の教室は、教室のモデルの床を使う
    for a, b in segs:
        gbox(m, a, b, h - 0.3, h, z0, z1, FL if z1 - z0 > 2.5 or z0 < L['ZC'] else FL, tile=(2, 2), mats={'d': CE}, faces='td')
# 屋上の天井
for a, b, z0, z1 in [(L['X0'], L['X1'], L['ZN'], L['ZC']), (L['X0'], 35.5, L['ZC'], L['ZS']), (44.5, L['X1'], L['ZC'], L['ZS'])]:
    gbox(m, a, b, F[2] + CH, F[2] + CH + 0.3, z0, z1, CE, tile=(3, 3), faces='d')
# ---- 壁 ----
for w in L['walls']:
    if not w['vis']: continue
    x0, z0, x1, z1, y0, y1, kind = w['x0'], w['z0'], w['x1'], w['z1'], w['y0'], w['y1'], w['kind']
    horiz = abs(z1 - z0) < 0.01; L_ = math.hypot(x1 - x0, z1 - z0)
    if kind == 'rail':
        gbox(m, min(x0, x1), max(x0, x1), y0 + 1.0, y0 + 1.08, z0 - 0.05, z0 + 0.05, MT) if horiz else None
        n = max(2, int(L_/1.2))
        for i in range(n + 1): px = x0 + (x1 - x0)*i/n; gbox(m, px - 0.03, px + 0.03, y0, y0 + 1.0, z0 - 0.03, z0 + 0.03, MT, faces='fblr')
        continue
    if kind == 'shell':
        # 外壁：腰壁・柱・欄間と、ガラス。内側から外が見える
        n = max(1, round(L_/3.6)); inward = (0, 1) if abs(z0 - L['ZN']) < 0.01 else (0, -1) if abs(z0 - L['ZS']) < 0.01 else (1, 0) if abs(x0 - L['X0']) < 0.01 else (-1, 0)
        th = T/2
        def seg(a0, a1, b0, b1, mat):
            if horiz: gbox(m, a0, a1, b0, b1, z0 - th, z0 + th, mat, tile=(2, 2))
            else: gbox(m, x0 - th, x0 + th, b0, b1, a0, a1, mat, tile=(2, 2))
        a_start, a_end = (min(x0, x1), max(x0, x1)) if horiz else (min(z0, z1), max(z0, z1))
        if not horiz:   # 東西の妻壁は窓なし
            seg(a_start, a_end, y0, y1, PL); continue
        seg(a_start, a_end, y0, y0 + 1.2, PL); seg(a_start, a_end, y0 + 2.6, y1, PL)
        for i in range(n + 1):
            a = a_start + (a_end - a_start)*i/n; seg(max(a_start, a - 0.15), min(a_end, a + 0.15), y0 + 1.2, y0 + 2.6, PL)
        for i in range(n):
            a = a_start + (a_end - a_start)*i/n + 0.15; b = a_start + (a_end - a_start)*(i + 1)/n - 0.15
            for s in (1, -1): gquad(m, a, z0, b, z0, y0 + 1.2, y0 + 2.6, GL, 0, s)
            gbox(m, a, b, y0 + 1.2, y0 + 1.25, z0 - 0.12, z0 + 0.12, SA)
        continue
    th = T/2
    if horiz: gbox(m, min(x0, x1), max(x0, x1), y0, y1, z0 - th, z0 + th, PL, tile=(2, 2), mats={'f': PL, 'b': PL})
    else: gbox(m, x0 - th, x0 + th, y0, y1, min(z0, z1), max(z0, z1), PL, tile=(2, 2))
    # 腰板（下のほうだけ木）
    if horiz and y1 - y0 > 2: gbox(m, min(x0, x1), max(x0, x1), y0, y0 + 0.9, z0 - th - 0.02, z0 + th + 0.02, WAIN, tile=(1, 1), faces='fb')
# ---- 外から見たとき：階と階のあいだの帯（床の厚み）と、屋上のへり ----
for i in range(3):
    y0 = F[i] + CH; y1 = (F[i + 1] - 0.3) if i < 2 else 20.1
    if y1 - y0 < 0.02: continue
    for (x0, z0, x1, z1) in ((L['X0'], L['ZN'], L['X1'], L['ZN']), (L['X0'], L['ZS'], L['X1'], L['ZS'])): gbox(m, x0, x1, y0, y1, z0 - 0.15, z0 + 0.15, CO, tile=(3, 3))
    for x in (L['X0'], L['X1']): gbox(m, x - 0.15, x + 0.15, y0, y1, L['ZN'], L['ZS'], CO, tile=(3, 3))
# 土台：坂の低い側で校舎が浮いて見えないよう、地面の下まで四方に下ろす
FB = -4.0
gbox(m, L['X0'] - 0.15, L['X1'] + 0.15, FB, F[0] - 0.3, L['ZS'] - 0.15, L['ZS'] + 0.15, CO, tile=(3, 3)); gbox(m, L['X0'] - 0.15, L['X1'] + 0.15, FB, F[0] - 0.3, L['ZN'] - 0.15, L['ZN'] + 0.15, CO, tile=(3, 3))
for x in (L['X0'], L['X1']): gbox(m, x - 0.15, x + 0.15, FB, F[0] - 0.3, L['ZN'], L['ZS'], CO, tile=(3, 3))
# ---- 黒板と、部屋の名札 ----
for b in L['boards']:
    y = F[b['floor']]; gquad(m, b['x'], b['z'] - 2.2, b['x'], b['z'] + 2.2, y + 0.85, y + 2.1, ('blackboard', '#2f5a48'), 1, 0)
    gbox(m, b['x'] - 0.05, b['x'] + 0.25, y + 0.8, y + 0.85, b['z'] - 2.2, b['z'] + 2.2, WD)
for r in L['rooms']:
    if r['kind'] in ('entrance',) or not r['door']: continue
    y = F[r['floor']]; d = r['door']; cx = (d[0] + d[1])/2
    gbox(m, cx - 0.45, cx + 0.45, y + 2.55, y + 2.8, L['ZC'] - 0.35, L['ZC'] - 0.13, ('nameplate', '#f4f0e4'))
    for x in d: gbox(m, x - 0.06, x + 0.06, y, y + 2.2, L['ZC'] - 0.16, L['ZC'] + 0.16, ('door-frame', '#a98f6c'))   # 引き戸の枠
# ---- 家具 ----
LOOK = {'staffdesk':(('desk-gray', '#9aa3a8'), ('desk-top', '#c9a877')), 'cabinet':(MT, MT), 'bookshelf':(WD, ('bookshelf', '#7a5a40')), 'readtable':(WD, ('desk-top', '#c9a877')),
        'bed':(MT, ('futon', '#f3f1ea')), 'medshelf':(('cabinet-white', '#e9eef2'), ('cabinet-white', '#e9eef2')), 'lockers':(('locker', '#b9c4c8'), ('locker', '#b9c4c8')),
        'piano':(('piano', '#1e1c1c'), ('piano', '#1e1c1c')), 'drums':(('drum', '#c94a3a'), MT), 'easel':(WD, ('canvas', '#f4f0e4')), 'artshelf':(WD, ('paint-jars', '#d9a441')), 'teacherdesk':(WD, ('desk-top', '#c9a877'))}
# ---- 天井の蛍光灯 ----
for i, y in enumerate(F):
    for x in range(10, 52, 6): gbox(m, x - 0.6, x + 0.6, y + CH - 0.06, y + CH - 0.01, -65.6, -65.4, ('light-panel', '#f6f4ec'))
    for r in L['rooms']:
        if r['floor'] != i or r['kind'] == 'ours': continue
        for fx in (0.3, 0.7):
            x = r['x0'] + (r['x1'] - r['x0'])*fx; gbox(m, x - 0.6, x + 0.6, y + CH - 0.06, y + CH - 0.01, -61.2, -60.8, ('light-panel', '#f6f4ec'))
# 廊下の掲示板と消火器
for i, y in enumerate(F):
    gquad(m, 46, L['ZN'] + 0.14, 49, L['ZN'] + 0.14, y + 1.2, y + 2.2, ('noticeboard', '#c9a46a'), 0, 1)
    gbox(m, 24.0, 24.3, y, y + 0.55, L['ZN'] + 0.15, L['ZN'] + 0.45, ('extinguisher', '#d9483b'))
m.build('school-in'); export('school-in', 9000, view=(0.6, -1.2, 1.2))

# ---- 動かせる家具（ひとつずつ別の物にして、ゲームで吹っ飛ばせるようにする）。原点は家具の足もとの中心 ----
reset()
for i, p in enumerate(L['props']):
    k = MB(); side, top = LOOK[p['kind']]; hw, hd, h = p['w']/2, p['d']/2, p['h']
    def lb(x0, x1, y0, y1, z0, z1, mat, **kw): gbox(k, x0, x1, y0, y1, z0, z1, mat, **kw)
    if p['kind'] == 'easel':
        lb(-0.03, 0.03, 0, h, -0.03, 0.03, WD); lb(-0.35, 0.35, 0.8, 1.4, -0.04, 0.04, top)
        for dx in (-0.25, 0.25): lb(dx - 0.02, dx + 0.02, 0, 0.9, 0.15, 0.19, WD)
    elif p['kind'] == 'bed': lb(-hw, hw, 0, 0.4, -hd, hd, side); lb(-hw, hw, 0.4, h, -hd, hd, top); lb(-hw, hw, 0.4, 0.75, -hd, -hd + 0.06, MT)
    elif p['kind'] == 'piano': lb(-hw, hw, 0.25, h, -hd, hd, side); lb(-hw + 0.05, hw - 0.05, 0.7, 0.74, hd - 0.02, hd + 0.18, ('keys', '#f4f4f0')); lb(-hw + 0.1, -hw + 0.18, 0, 0.25, -hd + 0.1, hd - 0.1, side); lb(hw - 0.18, hw - 0.1, 0, 0.25, -hd + 0.1, hd - 0.1, side)
    elif p['kind'] in ('staffdesk', 'teacherdesk', 'readtable'):
        lb(-hw, hw, h - 0.04, h, -hd, hd, top)
        for sx in (-1, 1): lb(sx*hw - 0.04*sx - 0.02, sx*hw - 0.04*sx + 0.02, 0, h - 0.04, -hd + 0.05, hd - 0.05, side)
        if p['kind'] == 'staffdesk': lb(-hw + 0.1, -hw + 0.55, 0.1, h - 0.06, -hd + 0.05, hd - 0.05, side)
    else: lb(-hw, hw, 0, h, -hd, hd, side, tile=(1, 1), mats={'t': top, 'f': top if p['kind'] in ('bookshelf', 'lockers', 'medshelf', 'artshelf') else side, 'b': top if p['kind'] in ('lockers',) else side,
             'r': top if p['kind'] in ('bookshelf', 'artshelf') and p['w'] < 1 else side, 'l': top if p['kind'] in ('bookshelf',) and p['w'] < 1 else side})
    if p['kind'] == 'drums':
        for j, (dx, dz) in enumerate(((-0.4, 0.2), (0.35, 0.25), (0, -0.3))): k.at((dx, -dz, 0.9 + j*0.05)).cyl((0, 0, 0), 0.22, 0.14, 8, ('drum-head', '#f0ece0')); k.home()
    k.build('p%d' % i, (p['x'], -p['z'], F[p['floor']]))
export('school-props', 4000, view=(0.6, -1.2, 1.2))

# ---- 動かせる机といす（原点は足もとの中心。正面 -Y） ----
reset(); d = MB(); DT = ('desk-top', '#c9a877')
d.box((0, 0, 0.72), (0.62, 0.44, 0.04), DT); d.box((0, 0.02, 0.6), (0.56, 0.36, 0.14), ('desk-box', '#8a9298'), faces='fblrd')
for ax, ay in ((-0.28, -0.18), (0.28, -0.18), (-0.28, 0.18), (0.28, 0.18)): d.box((ax, ay, 0.35), (0.035, 0.035, 0.7), MT, faces='fblr')
d.build('sdesk'); export('sdesk', 80)
reset(); c = MB()
c.box((0, 0, 0.43), (0.38, 0.36, 0.03), DT); c.box((0, 0.17, 0.66), (0.38, 0.03, 0.3), DT)
for ax, ay in ((-0.17, -0.15), (0.17, -0.15), (-0.17, 0.15), (0.17, 0.15)): c.box((ax, ay, 0.21), (0.03, 0.03, 0.42), MT, faces='fblr')
c.build('schair'); export('schair', 70)
print('DONE', REPORT)
