# 新島の標高データを、ゲームの座標で文字の地図にして確かめる（配置を決めるときの確認用）
import sys, math
s=open('data/niijima-dem.js').read(); rows=s.split('`')[1].split('\n')[1:]
A='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
NX=58; G=[]
for r in rows:
    line=[-1.0]*NX
    if r:
        off=int(r[:2])
        for i,ch in enumerate(r[2:]):
            if ch!='.': line[off+i]=(A.index(ch)/61)**2*430
    G.append(line)
AX,AZ,CX,CZ,SXX,SZZ=-90,38,22.0,66.3,13.0,10.0   # ゲームの(AX,AZ)が、標高データの(CX,CZ)マス。1マス = 東西13m・南北10m
def real(gx,gz):
    c=CX+(gx-AX)/SXX; r=CZ+(gz-AZ)/SZZ; i=int(math.floor(c)); j=int(math.floor(r)); u=c-i; v=r-j
    def g(a,b): return G[b][a] if 0<=b<len(G) and 0<=a<NX else -1.0
    q=[g(i,j),g(i+1,j),g(i,j+1),g(i+1,j+1)]; q=[-25.0 if t<0 else t for t in q]
    return q[0]*(1-u)*(1-v)+q[1]*u*(1-v)+q[2]*(1-u)*v+q[3]*u*v
if __name__=='__main__':
    marks={}
    for a in sys.argv[1:]:
        k,x,z=a.split(','); marks[(round(float(x)/10),round(float(z)/10))]=k
    print('    '+''.join(str(abs(x)//10%10) for x in range(-330,350,10)))
    for z in range(-620,550,10):
        row=''
        for x in range(-330,350,10):
            h=real(x,z)*0.18; ch='.' if h<=0 else '0123456789'[min(9,int(h/2))] if h<20 else 'abcdefghijklmnop'[min(15,int((h-20)/5))]
            row+=marks.get((x//10,z//10),ch)
        print(f'{z:5d} '+row)
