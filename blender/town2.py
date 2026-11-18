# 集落の外の道ぞい：ガードレール、畑
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
def one(name, fn, limit=300, **kw):
    reset(); m = MB(); fn(m); m.build(name, smooth=kw.pop('smooth', False)); export(name, limit, **kw)
def guardrail(m):   # 白いガードレール（長さ4m）
    W = ('rail-white', '#eeeeea')
    for x in (-2, 0): m.cyl((x, 0, -0.3), 0.06, 1.1, 5, W, cap_bot=False)
    m.box((0, -0.08, 0.6), (4.0, 0.04, 0.32), W, faces='fbtd'); m.box((0, -0.11, 0.6), (4.0, 0.03, 0.08), ('rail-shade', '#c9c9c4'), faces='ftd')
one('guardrail', guardrail, 40)
def field(m):       # 畑：うねと葉もの
    m.box((0, 0, 0.02), (10, 7, 0.1), ('soil', '#7a5a40'), faces='fblrt', tile=(3, 3))
    for i in range(6):
        y = -2.9 + i * 1.16; m.box((0, y, 0.14), (9.4, 0.6, 0.16), ('soil-ridge', '#8a6648'), faces='fblrt')
        if i % 3 != 2: m.card((0, y, 0.2), 9.2, 0.55, ('leaves', '#4f8a45'), uv=(0, 0.3, 4, 0.8))
    for x in (-5.1, 5.1): m.box((x, 3.6, 0.5), (0.06, 0.06, 1.0), ('wood', '#8a6a48'), faces='fblr')
one('field', field, 120)
print('DONE', REPORT)
