# キャラクター：関節ごとのパーツに分けて作る（ゲーム側でパーツを回して動かす）。正面は -Y。
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

# ---- 細かさ（ぼくのなつやすみ2くらいの、PS2の主役級。1体 2,500〜3,500 三角形） ----
# 輪の数を2倍に（あいだを Catmull-Rom でなめらかにつなぐ）、一周の分割を約1.6倍にする
_loft = MB.loft
def _sub(rings, k=2):
    if len(rings) < 3: return rings
    out = []
    for i in range(len(rings) - 1):
        p0, p1, p2, p3 = rings[max(0, i - 1)], rings[i], rings[i + 1], rings[min(len(rings) - 1, i + 2)]
        for t in range(k):
            u = t / k; u2, u3 = u*u, u*u*u
            out.append(tuple(0.5*((2*b) + (-a + c)*u + (2*a - 5*b + 4*c - d)*u2 + (-a + 3*b - 3*c + d)*u3) for a, b, c, d in zip(p0, p1, p2, p3)))
    out.append(rings[-1]); return out
def _loft_hi(self, rings, n, mat, **kw): return _loft(self, _sub(rings), max(n, int(round(n*1.6/2))*2), mat, **kw)
MB.loft = _loft_hi

def front_uv(cx, w, z0, z1, back=None):
    def fn(x, y, z):
        return (min(0.98, max(0.02, 0.5 + (x - cx) / w)), min(0.98, max(0.02, (z - z0) / (z1 - z0))))
    return fn

def character(name, girl=False, s=1.0, skin='#f1c9a4', hair='#2a211c', style='short', top='top-shirt', bottom=('cloth-navy', '#2b3350'), shoe='#3a2a22', face='face-boy', apron=False, sleeve=None, skirt=None, socks=True, hat=False):
    reset()
    SK = ('skin', skin); HR = ('hair', hair); SH = ('shoe', shoe); N = 10
    R = lambda rings: [(a * s, b * s, c * s, d * s, e * s) for (a, b, c, d, e) in rings]
    hips = MB()
    hips.loft(R([(0, 0, -0.11, 0.125, 0.09), (0, 0, -0.04, 0.15, 0.105), (0, 0, 0.08, 0.135, 0.095)]), N, bottom, tile=(0.3, 0.3))
    if girl:
        ln = -0.50 if apron else (-0.56 if skirt else -0.34)
        hips.loft(R([(0, 0, ln, 0.27 if not apron else 0.2, 0.23 if not apron else 0.17), (0, 0, -0.12, 0.2, 0.15), (0, 0, 0.07, 0.14, 0.1)]), 12, skirt or (('skirt-pleats', '#2b3350') if not apron else ('cloth-apron', '#7a8fa6')), cap_top=False, cap_bot=False, tile=(0.5, 0.42))
    H = hips.build('hips', (0, 0, 0.93 * s), smooth=True)
    t = MB(); uvf = front_uv(0, 0.36 * s, 0, 0.46 * s)
    t.loft(R([(0, 0, 0.0, 0.132, 0.092), (0, 0, 0.14, 0.14 if not girl else 0.125, 0.098), (0, -0.005, 0.28, 0.165 if not girl else 0.15, 0.108), (0, 0, 0.40, 0.172 if not girl else 0.155, 0.095), (0, 0, 0.445, 0.07, 0.062)]), N, top, uvfn=uvf, cap_bot=True)
    t.loft(R([(0, 0, 0.43, 0.046, 0.046), (0, 0, 0.52, 0.043, 0.043)]), 8, SK, cap_bot=False)
    T = t.build('torso', (0, 0, 0.08 * s), H, smooth=True)
    h = MB(); fuv = front_uv(0, 0.215 * s, -0.022 * s, 0.182 * s)
    h.loft(R([(0, -0.012, 0.0, 0.035, 0.04), (0, -0.008, 0.03, 0.072, 0.08), (0, 0, 0.085, 0.094, 0.1), (0, 0, 0.15, 0.097, 0.105), (0, 0.004, 0.2, 0.078, 0.088), (0, 0.006, 0.23, 0.03, 0.035)]), 12, face, uvfn=fuv)
    # 耳（髪の短い子は見える）
    for sx in (-1, 1): h.loft(R([(sx*0.093, 0.012, 0.085, 0.01, 0.018), (sx*0.101, 0.014, 0.11, 0.016, 0.026), (sx*0.097, 0.016, 0.14, 0.01, 0.017)]), 6, SK)
    # 髪：頭より一回り大きい殻。前は額の上まで。
    def hair_shell(zb_back, zb_front, extra=0.0):
        rings = []
        for (z, rx, ry) in [(0.142, 0.104, 0.112), (0.18, 0.101, 0.11), (0.215, 0.082, 0.092), (0.243, 0.035, 0.04)]:
            rings.append((0, 0.006, z, rx + extra, ry + extra))
        h.loft(R(rings), 12, HR, tile=(0.2, 0.2), cap_bot=False)
        # 後ろと横を下まで覆う（前を開ける）
        import math as m
        n = 18; pts_top = []; pts_bot = []
        for j in range(n + 1):
            a = m.radians(-25 + 230 * j / n)  # 右耳の前〜後ろ〜左耳の前
            cx, sy = m.cos(a), m.sin(a)
            pts_top.append((cx * (0.104 + extra) * s, (0.006 + sy * (0.112 + extra)) * s, 0.144 * s))
            zb = zb_back if sy > 0.2 else zb_front
            pts_bot.append((cx * (0.1 + extra) * s, (0.006 + sy * (0.108 + extra)) * s, zb * s))
        for j in range(n):
            h.face([pts_bot[j], pts_bot[j + 1], pts_top[j + 1], pts_top[j]], [(j / n, 0), ((j + 1) / n, 0), ((j + 1) / n, 1), (j / n, 1)], HR)
        # 前髪
        h.face([(-0.085 * s, -0.1 * s, 0.15 * s), (0.085 * s, -0.1 * s, 0.15 * s), (0.07 * s, -0.09 * s, 0.205 * s), (-0.07 * s, -0.09 * s, 0.205 * s)], [(0, 0), (1, 0), (1, 1), (0, 1)], HR)
        # 前髪の毛先（とがった房を5本）
        for i in range(5):
            x = (-0.07 + i*0.035) * s; w = 0.022 * s; tip = (0.118 + (i % 2)*0.012) * s
            h.face([(x - w, -0.101 * s, 0.152 * s), (x + w, -0.101 * s, 0.152 * s), (x + 0.004 * s, -0.104 * s, tip)], [(0, 1), (1, 1), (0.5, 0)], HR)
        # 頭のてっぺんの、はねた毛
        h.face([(-0.01 * s, 0.0, 0.24 * s), (0.012 * s, 0.0, 0.24 * s), (0.03 * s, 0.02 * s, 0.29 * s)], [(0, 0), (1, 0), (0.5, 1)], HR)
    if style == 'short': hair_shell(0.05, 0.1)
    elif style == 'bob': hair_shell(-0.03, -0.01, 0.006)
    elif style == 'pony':
        hair_shell(0.04, 0.07)
        h.loft(R([(0, 0.2, -0.1, 0.012, 0.012), (0, 0.19, 0.0, 0.04, 0.035), (0, 0.15, 0.13, 0.045, 0.04), (0, 0.11, 0.18, 0.025, 0.025)]), 6, HR, tile=(0.2, 0.2))
    elif style == 'long':   # 背中まである長い髪
        hair_shell(-0.26, 0.0, 0.006)
    elif style == 'bun':
        hair_shell(0.05, 0.09)
        h.loft(R([(0, 0.07, 0.2, 0.03, 0.03), (0, 0.075, 0.245, 0.05, 0.05), (0, 0.075, 0.28, 0.03, 0.03)]), 6, HR, tile=(0.2, 0.2))
    if hat:   # 麦わら帽子（つばは下からも見えるよう両面）
        ST = ('straw-ds', '#e6cf96')
        h.loft(R([(0, 0.006, 0.188, 0.225, 0.235), (0, 0.006, 0.2, 0.112, 0.12)]), 12, ST, tile=(0.2, 0.2), cap_top=False, cap_bot=False)
        h.loft(R([(0, 0.006, 0.2, 0.112, 0.12), (0, 0.006, 0.262, 0.104, 0.112), (0, 0.006, 0.282, 0.06, 0.065)]), 12, ST, tile=(0.2, 0.2), cap_bot=False)
        h.loft(R([(0, 0.006, 0.2, 0.116, 0.124), (0, 0.006, 0.226, 0.113, 0.121)]), 12, ('ribbon', '#2f4a78'), cap_top=False, cap_bot=False)
    Hd = h.build('head', (0, 0, 0.5 * s), T, smooth=True)
    for side, sx in (('L', 1), ('R', -1)):
        a = MB(); a.loft(R([(0, 0, -0.27, 0.036, 0.038), (0, 0, -0.1, 0.044, 0.046), (0, 0, 0.0, 0.046, 0.048), (-0.012 * sx, 0, 0.04, 0.026, 0.03)]), 8, sleeve or (top + '-sleeve', '#f2f2ee'))
        A = a.build('arm' + side, (0.19 * sx * s if not girl else 0.172 * sx * s, 0, 0.37 * s), T, smooth=True)
        f = MB(); f.loft(R([(0, 0, -0.24, 0.028, 0.03), (0, 0, 0.0, 0.036, 0.037)]), 8, SK, cap_bot=False)
        f.loft(R([(0, -0.005, -0.33, 0.02, 0.03), (0, -0.005, -0.29, 0.03, 0.042), (0, 0, -0.24, 0.027, 0.03)]), 6, SK)
        f.loft(R([(0.022 * sx, -0.022, -0.3, 0.008, 0.008), (0.03 * sx, -0.03, -0.27, 0.011, 0.011), (0.022 * sx, -0.018, -0.25, 0.009, 0.009)]), 5, SK)   # 親指
        f.build('fore' + side, (0, 0, -0.27 * s), A, smooth=True)
        l = MB(); l.loft(R([(0, 0, -0.41, 0.052, 0.055), (0, 0, -0.2, 0.066, 0.07), (0, 0, 0.02, 0.075, 0.08)]), 8, SK if girl else bottom, tile=(0.3, 0.3))
        L = l.build('leg' + side, (0.082 * sx * s, 0, -0.08 * s), H, smooth=True)
        sh = MB(); legm = SK if girl else bottom
        sh.loft(R([(0, 0, -0.39, 0.038, 0.04), (0, 0.004, -0.2, 0.05, 0.054), (0, 0, 0.0, 0.05, 0.053)]), 8, legm, tile=(0.3, 0.3), cap_bot=False)
        if girl and socks: sh.loft(R([(0, 0, -0.39, 0.04, 0.042), (0, 0, -0.27, 0.047, 0.05)]), 8, ('sock', '#f4f4f0'), cap_bot=False, cap_top=False)
        sh.loft(R([(0, -0.045, -0.45, 0.046, 0.115), (0, -0.045, -0.415, 0.05, 0.12), (0, -0.01, -0.385, 0.042, 0.06)]), 8, SH)
        sh.build('shin' + side, (0, 0, -0.4 * s), L, smooth=True)
    export(name, limit=2500, view=(-0.7, -1.6, 0.35))

character('boy', face='face-boy', hair='#2b221d', style='short')
character('kouta', face='face-kouta', hair='#3a2a1e', skin='#d9a57c', style='short', s=1.03)
character('nagisa', girl=True, s=0.95, face='face-nagisa', hair='#3b2a22', style='pony', top='top-sailor')
character('kotoha', girl=True, s=0.93, face='face-kotoha', hair='#1f1d24', style='bob', top='top-sailor')
character('granny', girl=True, s=0.88, face='face-granny', hair='#c9c9c4', style='bun', top='top-kappogi', apron=True, shoe='#6a5a4a')
DRESS = ('dress-white', '#f4f0e6')
character('oneesan', girl=True, s=0.99, face='face-oneesan', hair='#1c1a22', skin='#f6dcc6', style='long', top=DRESS, sleeve=('skin', '#f6dcc6'), skirt=DRESS, socks=False, hat=True, shoe='#b89468')
character('ojisan', s=1.02, face='face-ojisan', hair='#8a8580', skin='#c98e62', style='short', top=('shirt-work', '#5a7fa8'), sleeve=('shirt-work', '#5a7fa8'), bottom=('cloth-work', '#5c5848'), shoe='#2f2f2f')
# 家族：お母さん・お父さん・妹（みなみ）
character('mother', girl=True, s=0.97, face='face-mother', hair='#3a2a22', skin='#f0c8a4', style='bun', top=('blouse-mother', '#e9d6b4'), sleeve=('blouse-mother', '#e9d6b4'), apron=True, socks=False, shoe='#7a5a44')
character('father', s=1.05, face='face-father', hair='#2a2420', skin='#d9a57c', style='short', top=('shirt-father', '#6f8f6a'), sleeve=('shirt-father', '#6f8f6a'), bottom=('cloth-khaki', '#8a7a5a'), shoe='#3a3330')
character('sister', girl=True, s=0.72, face='face-sister', hair='#2b201a', skin='#f4d2b4', style='pony', top=('tshirt-sister', '#f2a0b8'), sleeve=('skin', '#f4d2b4'), skirt=('skirt-sister', '#5a8fc8'), shoe='#e86a5a')
print('DONE', REPORT)
