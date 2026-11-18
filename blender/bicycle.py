# 自転車。車輪とクランクを分け、ゲーム側で移動量に合わせて回す。
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import MB, empty, reset, export

METAL = ('metal', '#9aa0a4')
FRAME = ('bike-frame', '#c8463c')
TIRE = ('tire', '#2a2a2a')

def build_bicycle(do_preview=True):
    reset()
    root = empty('bicycle')

    def bar(mesh, a, b, thickness=0.035, material=FRAME):
        ax, az = a; bx, bz = b
        length = math.hypot(bx-ax, bz-az)
        mesh.at(((ax+bx)/2, 0, (az+bz)/2), ry=-math.atan2(bz-az, bx-ax))
        mesh.box((0, 0, 0), (length, thickness, thickness), material)
        mesh.home()

    body = MB()
    for a, b in [((-.52,.33),(-.10,.33)), ((-.10,.33),(-.25,.85)), ((-.52,.33),(-.25,.85)), ((-.10,.33),(.38,.85)), ((-.25,.80),(.38,.85)), ((.52,.33),(.36,1.02))]:
        bar(body, a, b)
    body.box((-.27,0,.90), (.26,.16,.05), ('seat','#2a2a2a'))
    body.box((.36,0,1.03), (.04,.52,.04), METAL)
    # 前かごは上を開け、向こう側が見える低い縁だけにする。
    basket = ('basket', '#b9b3a4')
    x0,x1,y0,y1,z0,z1 = .46,.76,-.17,.17,.69,.89
    body.quad((x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),basket)
    for a,b in [((x0,y0),(x1,y0)),((x1,y0),(x1,y1)),((x1,y1),(x0,y1)),((x0,y1),(x0,y0))]:
        body.quad((*a,z0),(*b,z0),(*b,z1),(*a,z1),basket)
    body.build('frame', parent=root)

    for name,x in [('wheelRear',-.52),('wheelFront',.52)]:
        hub = empty(name, (x,0,.33), root)
        wheel = MB(); count = 12
        # 角張った中空タイヤ。円盤にせず、内側と外側、左右の側面を張る。
        for i in range(count):
            a = i/count*math.tau; b = (i+1)/count*math.tau
            def point(angle, radius, side): return (math.cos(angle)*radius,side,math.sin(angle)*radius)
            for radius,flip in [(.33,False),(.275,True)]:
                pts = [point(a,radius,-.025),point(b,radius,-.025),point(b,radius,.025),point(a,radius,.025)]
                if flip: pts.reverse()
                wheel.face(pts,[(0,0),(1,0),(1,1),(0,1)],TIRE)
            for side in [-.025,.025]:
                pts=[point(a,.275,side),point(b,.275,side),point(b,.33,side),point(a,.33,side)]
                if side<0: pts.reverse()
                wheel.face(pts,[(0,0),(1,0),(1,1),(0,1)],TIRE)
        for angle in [0,math.pi/2]:
            wheel.at(ry=angle).box((0,0,0),(.55,.014,.014),METAL); wheel.home()
        wheel.at(rx=math.pi/2).cyl((0,0,-.055),.025,.11,4,METAL); wheel.home()
        wheel.build(name+'Mesh', parent=hub)

    crank = empty('crank',(-.10,0,.33),root)
    pedals = MB()
    pedals.at(rx=math.pi/2).cyl((0,0,-.13),.025,.26,4,METAL); pedals.home()
    for side in [-1,1]:
        pedals.box((0,.12*side,.08*side),(.025,.025,.16),METAL)
        pedals.box((0,.15*side,.16*side),(.10,.09,.025),TIRE)
    pedals.build('pedals',parent=crank)
    export('bike', limit=500, view=(-.7,-1.5,.55),do_preview=do_preview)

if __name__ == '__main__':
    build_bicycle()
