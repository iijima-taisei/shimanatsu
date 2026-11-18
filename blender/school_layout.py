# 校舎の中の間取り。Blender（school_in.py）とゲーム（data/school-layout.js）で同じものを使う。
# 座標はゲーム内の値（x 東、z 南、y 上、メートル）。校舎は x 8〜52、z -66.5〜-57.5。北側が廊下、南側が教室。
# python3 blender/school_layout.py で data/school-layout.js を書き出す。
import json, os
F = [9.1, 12.8, 16.5]            # 1階・2階・3階の床の高さ（3階の教室 ROOM.y = 16.5）
CH = 3.4                          # 天井の高さ（上の階の床の裏まで。壁と天井のすきまができないように）
X0, X1, ZN, ZS, ZC = 8.0, 52.0, -66.5, -57.5, -63.5   # 西・東・北の外壁・南の外壁・廊下と教室の境（廊下の幅3m）
ZM = -61.0                        # 階段の上り（北）と下り（南）の境
T = 0.25                          # 壁の厚さ
floors, walls, rooms, props = [], [], [], []
def floor(x0, x1, z0, z1, h, h1=None, axis='x'): floors.append({'x0':x0, 'x1':x1, 'z0':z0, 'z1':z1, 'h':h, 'h1':h if h1 is None else h1, 'axis':axis})
def wall(x0, z0, x1, z1, y0, y1, kind='wall', vis=True): walls.append({'x0':x0, 'z0':z0, 'x1':x1, 'z1':z1, 'y0':y0, 'y1':y1, 'kind':kind, 'vis':vis})
def wall_gaps(x0, x1, z, y0, y1, gaps, kind='wall', vis=True):   # x 方向の壁を、gaps（[a,b] の区間）をあけて並べる
    cur = x0
    for a, b in sorted(gaps):
        if a > cur: wall(cur, z, a, z, y0, y1, kind, vis)
        cur = max(cur, b)
    if cur < x1: wall(cur, z, x1, z, y0, y1, kind, vis)
def room(name, kind, fl, x0, x1, door=None): rooms.append({'name':name, 'kind':kind, 'floor':fl, 'x0':x0, 'x1':x1, 'z0':ZC, 'z1':ZS, 'door':door})
def prop(kind, fl, x, z, w, d, h, ry=0.0): props.append({'kind':kind, 'floor':fl, 'x':x, 'z':z, 'w':w, 'd':d, 'h':h, 'ry':ry})

# ---- 床 ----
for i, y in enumerate(F): floor(X0, X1, ZN, ZC, y)                       # 廊下（どの階も東西に通る）
floor(21, X1, ZC, ZS, F[0]); floor(21, X1, ZC, ZS, F[1]); floor(21, X1, ZC, ZS, F[2])   # 教室の並び
floor(30, 38, ZS, -54.6, F[0])                                            # 昇降口の前（ポーチ）
floor(X0, 10, ZC, ZS, F[1])                                               # 2階の踊り場（西）
floor(10, 21, ZC, ZM, F[1], F[0])                                         # 上りの階段：x 21（1階）→ x 10（2階）
floor(10, 21, ZM, ZS, F[1], F[2])                                         # 上りの階段：x 10（2階）→ x 21（3階）

# ---- 外壁（窓つき）。1階の南は昇降口をあける ----
for i, y in enumerate(F):
    top = y + CH if i < 2 else y + CH
    wall(X0, ZN, X1, ZN, y - 0.3, top, 'shell')
    wall(X0, ZN, X0, ZS, y - 0.3, top, 'shell'); wall(X1, ZN, X1, ZS, y - 0.3, top, 'shell')
    if i == 0: wall_gaps(X0, X1, ZS, y - 0.3, top, [[30.3, 37.7]], 'shell')   # 昇降口はポーチの幅いっぱいにあける（軽トラも通れる）
    elif i == 2: wall_gaps(X0, X1, ZS, y - 0.3, top, [[35.5, 44.5]], 'shell'); wall(35.5, ZS, 44.5, ZS, y - 0.3, top, 'shell', vis=False)   # 3階の自分の教室は、教室のモデルが窓を持つ
    else: wall(X0, ZS, X1, ZS, y - 0.3, top, 'shell')
wall(30, ZS, 30, -54.6, F[0], F[0] + 3.0); wall(38, ZS, 38, -54.6, F[0], F[0] + 3.0)   # ポーチの両わき

# ---- 部屋（南側）。扉は廊下側に2mあける ----
R1 = [('保健室', 'health', 21, 30, [22.6, 25.2]), ('昇降口', 'entrance', 30, 38, None), ('職員室', 'staff', 38, 45, [41.6, 44.2]), ('図書室', 'library', 45, 52, [45.8, 48.4])]
R2 = [('1年1組', 'class', 21, 30.5, [27.4, 30.0]), ('3年1組', 'class', 30.5, 40, [36.9, 39.5]), ('音楽室', 'music', 40, 52, [40.8, 43.4])]
R3 = [('美術室', 'art', 23, 35.5, [32.4, 35.0]), ('2年1組（自分の教室）', 'ours', 35.5, 44.5, [41.8, 43.2]), ('空き教室', 'empty', 44.5, 52, [45.4, 48.0])]   # 扉は2.6m（自分の教室だけ、教室のモデルの戸口）
for fl, rs in enumerate([R1, R2, R3]):
    y = F[fl]
    gaps = []
    for name, kind, a, b, door in rs:
        room(name, kind, fl, a, b, door)
        if kind == 'entrance': gaps.append([a, b])
        elif door: gaps.append(door)
    x_start = 23 if fl == 2 else 21
    ours = fl == 2
    wall_gaps(x_start, X1, ZC, y, y + CH, gaps)
    for name, kind, a, b, door in rs[1:]:   # 部屋の仕切り
        wall(a, ZC, a, ZS, y, y + CH, 'wall', vis=not (ours and kind == 'ours'))
    if ours: wall(44.5, ZC, 44.5, ZS, y, y + CH, 'wall', vis=False)
# 自分の教室（3階）は教室のモデルが壁を持つので、廊下側の壁は見せない
for w in walls:
    if abs(w['z0'] - ZC) < 0.01 and abs(w['z1'] - ZC) < 0.01 and w['y0'] == F[2] and w['x0'] >= 35.5 - 0.01 and w['x1'] <= 44.5 + 0.01: w['vis'] = False

# ---- 階段のまわり ----
wall(10, ZM, 21, ZM, F[0] - 0.3, F[2] + CH, 'wall')                         # 上りと下りの間の壁
wall(21, ZC, 21, ZS, F[0], F[1] + CH, 'wall')                               # 1・2階の、階段と部屋の間
wall_gaps(X0, 21, ZC, F[0], F[0] + 2.4, [[19, 21]], 'wall')                 # 1階：廊下から階段の下へは入れない（上り口は x 19〜21）
wall_gaps(10, 21, ZC, F[1], F[1] + 1.1, [], 'rail')                          # 2階：廊下と上り階段の間の手すり
wall_gaps(X0, 21, ZC, F[2], F[2] + 1.1, [], 'rail')                          # 3階：吹き抜けの手すり
wall(23, ZC, 23, ZS, F[2], F[2] + CH, 'wall')                               # 3階：踊り場と美術室の間
floor(21, 23, ZC, ZS, F[2])                                                  # 3階の踊り場

# ---- 部屋の中の、動かない家具 ----
for i in range(4): prop('staffdesk', 0, 39.6 + (i % 2)*2.3, -61.8 + (i // 2)*2.0, 1.6, 0.8, 0.74)
prop('cabinet', 0, 44.5 - 0.3, -61.0, 0.5, 3.0, 1.8)
for i in range(3): prop('bookshelf', 0, 46.2 + i*2.2, -58.0, 1.8, 0.4, 2.0)
prop('bookshelf', 0, 51.6, -61.5, 0.4, 3.0, 2.0); prop('readtable', 0, 48.5, -61.8, 2.4, 1.2, 0.72)
for i in range(2): prop('bed', 0, 22.2 + i*2.6, -59.2, 1.0, 2.0, 0.55)
prop('medshelf', 0, 29.6, -61.5, 0.4, 2.0, 1.8)
for x in (30.9, 32.2, 35.8, 37.1): prop('lockers', 0, x, -61.5, 1.2, 0.5, 1.8)   # げた箱。まんなか（x 33〜35）は通り道
prop('piano', 1, 50.5, -59.6, 1.5, 1.2, 1.1, 0.0); prop('drums', 1, 49.5, -62.4, 1.4, 1.2, 0.9)
for i in range(3): prop('easel', 2, 26.0 + i*3.0, -60.2, 0.6, 0.6, 1.5, 0.3)
prop('artshelf', 2, 23.4, -61.0, 0.4, 3.0, 1.6)
prop('teacherdesk', 1, 22.2, -61.0, 0.8, 1.6, 0.8); prop('teacherdesk', 1, 31.7, -61.0, 0.8, 1.6, 0.8)
# 黒板（西の壁）
blackboards = [{'floor':1, 'x':21.15, 'z':-61.0}, {'floor':1, 'x':30.65, 'z':-61.0}, {'floor':2, 'x':44.65, 'z':-61.0}, {'floor':1, 'x':40.15, 'z':-61.0}]
# 動かせる机といす（ゲーム側で置く）：部屋ごとの並び
desks = []
for name, kind, a, b, door in R2 + R3:
    if kind not in ('class', 'empty'): continue
    fl = 1 if (name, kind, a, b, door) in R2 else 2
    cols = 4 if b - a > 8.5 else 3
    for ix in range(cols):
        for iz in range(4):
            desks.append({'floor':fl, 'x':a + 2.6 + ix*((b - a - 4.0)/(cols - 1)), 'z':-62.6 + iz*1.3, 'ry':-1.5708})
LAYOUT = {'F':F, 'CH':CH, 'X0':X0, 'X1':X1, 'ZN':ZN, 'ZS':ZS, 'ZC':ZC, 'ZM':ZM, 'T':T, 'floors':floors, 'walls':walls, 'rooms':rooms, 'props':props, 'boards':blackboards, 'desks':desks}
if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(root, 'data', 'school-layout.js'), 'w') as f:
        f.write('// 校舎の中の間取り。blender/school_layout.py から書き出したもの（手で直さない）\nexport const LAYOUT = ' + json.dumps(LAYOUT, ensure_ascii=False) + ';\n')
    print('walls', len(walls), 'floors', len(floors), 'props', len(props), 'desks', len(desks))
