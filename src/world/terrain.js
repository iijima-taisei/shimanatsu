import * as THREE from 'three';
import { tex } from '../assets.js';
import { DEM_ROWS } from '../../data/niijima-dem.js';

// ---- 高さ関数（地形メッシュと当たり判定で共用） ----
function hash(ix, iz){ let n = ix*374761393 + iz*668265263; n = (n^(n>>13))*1274126177; return ((n^(n>>16))>>>0)/4294967295; }
function vnoise(x, z){ const ix=Math.floor(x), iz=Math.floor(z), fx=x-ix, fz=z-iz; const u=fx*fx*(3-2*fx), v=fz*fz*(3-2*fz);
  const a=hash(ix,iz), b=hash(ix+1,iz), c=hash(ix,iz+1), d=hash(ix+1,iz+1); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }
function fbm(x, z){ return vnoise(x,z)*0.55 + vnoise(x*2.1,z*2.1)*0.3 + vnoise(x*4.3,z*4.3)*0.15; }
const sstep = (a,b,x)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
const gauss = (dx,dz,sx,sz)=>Math.exp(-(dx*dx/(sx*sx)+dz*dz/(sz*sz)));

// ---- 島の形：新島の標高データ（国土地理院）を縮めて使う ----
// 東西は約1/7.7、南北は1/10、高さは0.18倍（実際の430m → 約77m）。集落の位置（AX,AZ）を標高データの本村に合わせてある。
const NXD = 58, NZD = DEM_ROWS.length, DX = 13, DZ = 10, AX = -90, AZ = 38, CX = 22.0, CZ = 66.3, VS = 0.18;
const DEM = (() => { const A = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', g = new Float32Array(NXD*NZD).fill(-1);
  DEM_ROWS.forEach((row, j) => { if (!row) return; const off = +row.slice(0, 2); [...row.slice(2)].forEach((ch, i) => { if (ch !== '.') g[j*NXD + off + i] = (A.indexOf(ch)/61)**2*430; }); });
  // 海は、岸から離れるほど深くする
  const dist = new Int8Array(NXD*NZD).fill(9); for (let pass = 1; pass <= 3; pass++) for (let j = 0; j < NZD; j++) for (let i = 0; i < NXD; i++){ const k = j*NXD + i; if (g[k] >= 0 || dist[k] < 9) continue;
    for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1]]){ const x = i + a, z = j + b; if (x < 0 || z < 0 || x >= NXD || z >= NZD) continue; const n = z*NXD + x; if (pass === 1 ? g[n] >= 0 : dist[n] === pass - 1){ dist[k] = pass; break; } } }
  for (let k = 0; k < g.length; k++) if (g[k] < 0) g[k] = dist[k] === 1 ? -22 : dist[k] === 2 ? -52 : -90;
  return g; })();
const dem = (i, j) => (i < 0 || j < 0 || i >= NXD || j >= NZD) ? -90 : DEM[j*NXD + i];
function raw(x, z){
  const c = CX + (x - AX)/DX, r = CZ + (z - AZ)/DZ, i = Math.floor(c), j = Math.floor(r), u = c - i, v = r - j;
  let h = (dem(i, j)*(1-u)*(1-v) + dem(i+1, j)*u*(1-v) + dem(i, j+1)*(1-u)*v + dem(i+1, j+1)*u*v)*VS;
  h += (fbm(x*0.013 + 4, z*0.013 + 9) - 0.5)*1.6;                                           // 海岸線をなめらかに揺らす
  if (h > 0) h += (fbm(x*0.03, z*0.03) - 0.5)*Math.min(6, 1.2 + h*0.16)*sstep(0, 2, h);      // 山ほど大きいでこぼこ
  h = Math.max(h, 40*gauss(x + 420, z - 64, 30, 46) - 10 + (fbm(x*0.04, z*0.04) - 0.5)*5);  // 西の沖の小島（地内島にあたる）
  return Math.max(-14, h);
}
// 平らにならす場所 [x, z, 半径, 高さ]
export const ZONES = {
  school:   [ 30, -45, 62, 9],
  village:  [-75,  36, 104, 5],
  wakago:   [135, -430, 46, 5],
  port:     [-230, 70, 34, 1.6],
  shrine:   [-84, -52, 18, 15],
  lookout:  [-34, -64, 13, 32],
  ishiyama: [-190, 250, 13, 37],
  onsen:    [-182, 30, 18, 2.2],
  beach:    [ 82,  34, 26, 1.3],
};
// 空港：滑走路のまわりを長方形に平らにする
export const AIRPORT = { x:20, z:108, w:156, d:36, h:6.5, rz:116 };   // rz は滑走路の中心線
// 動ける範囲（島と、そのまわりの海）
export const inBounds = (x, z) => Math.hypot((x + 40)/500, (z + 55)/700) < 1;
// 桟橋や東屋の床など、乗れる台 {x,z,w,d,top} か {x,z,r,top}
export const PLATFORMS = [];
function baseHeight(x, z){
  let h = raw(x, z);
  for (const k in ZONES){ const [zx,zz,r,zh] = ZONES[k]; const dist = Math.hypot(x-zx, z-zz);
    if (dist < r){ const w = 1 - sstep(r*0.62, r, dist); h = h + (zh-h)*w; } }
  { const A = AIRPORT, d = Math.hypot(Math.max(0, Math.abs(x - A.x) - A.w/2), Math.max(0, Math.abs(z - A.z) - A.d/2)); if (d < 14 && h > 0.5) h += (A.h - h)*(1 - sstep(0, 14, d)); }
  return h;
}
// 地形メッシュの格子。高さは「実際に描かれる面」と同じになるよう、格子の三角形の上で補間する
// （式の値をそのまま使うと、坂で道や足元が地面に埋まる）。
const GX0 = -440, GZ0 = -664, TW = 800, TD = 1216, SX = 100, SZ = 152; let GRID = null;
function gridH(g, x, z){ const gx = (x - GX0)/TW*SX, gz = (z - GZ0)/TD*SZ; if (gx < 0 || gz < 0 || gx >= SX || gz >= SZ) return baseHeight(x, z);
  const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz, i = iz*(SX+1)+ix;
  const ha = g[i], hd = g[i+1], hb = g[i+SX+1], hc = g[i+SX+2];
  return u + v <= 1 ? ha + (hd-ha)*u + (hb-ha)*v : hc + (hb-hc)*(1-u) + (hd-hc)*(1-v); }
function grid(){ if (GRID) return GRID; const g = new Float32Array((SX+1)*(SZ+1));
  for (let iz=0; iz<=SZ; iz++) for (let ix=0; ix<=SX; ix++) g[iz*(SX+1)+ix] = baseHeight(GX0 + ix*TW/SX, GZ0 + iz*TD/SZ);
  // 山道の切り通し：cut のついた道は、道のりに沿って高さをならし、まわりの地面をその高さに寄せる（急斜面で道が傾かないように）
  for (const road of ROADS){ if (!road.cut) continue; const curve = new THREE.CatmullRomCurve3(road.pts.map(p => new THREE.Vector3(p[0], 0, p[1]))), n = Math.ceil(curve.getLength()/2), P = [];
    for (let i = 0; i <= n; i++){ const p = curve.getPointAt(i/n); P.push([p.x, p.z, Math.max(1.3, gridH(g, p.x, p.z))]); }
    for (let pass = 0; pass < 3; pass++){ const hs = P.map(p => p[2]); for (let i = 1; i < n; i++){ let sum = 0, c = 0; for (let k = -5; k <= 5; k++){ const q = hs[i + k]; if (q !== undefined){ sum += q; c++; } } P[i][2] = sum/c; } }
    for (let iz=0; iz<=SZ; iz++) for (let ix=0; ix<=SX; ix++){ const x = GX0 + ix*TW/SX, z = GZ0 + iz*TD/SZ; let best = 1e9, bh = 0; for (const p of P){ const d = (p[0]-x)*(p[0]-x) + (p[1]-z)*(p[1]-z); if (d < best){ best = d; bh = p[2]; } }
      if (best < 196){ const k = iz*(SX+1)+ix; g[k] += (bh - g[k])*(1 - sstep(5, 14, Math.sqrt(best))); } } }
  return GRID = g; }
export function heightAt(x, z){
  for (const p of PLATFORMS){ if (p.r ? Math.hypot(x-p.x, z-p.z) < p.r : (Math.abs(x-p.x) < p.w/2 && Math.abs(z-p.z) < p.d/2)) return p.top; }
  return gridH(grid(), x, z);
}

export function buildTerrain(scene){
  const geo = new THREE.PlaneGeometry(TW, TD, SX, SZ); geo.rotateX(-Math.PI/2); geo.translate(GX0 + TW/2, 0, GZ0 + TD/2); const gr = grid();
  { const idx = geo.index.array, keep = []; for (let i = 0; i < idx.length; i += 3){ if (gr[idx[i]] < -9 && gr[idx[i+1]] < -9 && gr[idx[i+2]] < -9) continue; keep.push(idx[i], idx[i+1], idx[i+2]); } geo.setIndex(keep); }   // 深い海の底は張らない
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i); pos.setY(i, gr[i]); uv.setXY(i, x/7, z/7); }
  geo.computeVertexNormals();
  const nor = geo.attributes.normal; const blend = new Float32Array(pos.count*2);
  for (let i=0;i<pos.count;i++){ const h=pos.getY(i);
    blend[i*2]   = 1 - sstep(1.7, 3.0, h + (hash(i,7)-0.5)*0.6);        // 砂
    blend[i*2+1] = sstep(0.22, 0.42, 1-nor.getY(i));                    // 岩
  }
  geo.setAttribute('aBlend', new THREE.BufferAttribute(blend, 2));
  const mat = new THREE.MeshLambertMaterial({ map: tex('grass') });
  const sand = tex('sand'), rock = tex('rock');
  mat.onBeforeCompile = (s)=>{
    s.uniforms.tSand = { value: sand }; s.uniforms.tRock = { value: rock };
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aBlend; varying vec2 vBlend;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlend = aBlend;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tSand; uniform sampler2D tRock; varying vec2 vBlend;')
      .replace('#include <map_fragment>', `vec4 cg = texture2D(map, vMapUv); vec4 cs = texture2D(tSand, vMapUv); vec4 cr = texture2D(tRock, vMapUv*0.5);
        vec4 tc = mix(cg, cs, vBlend.x); cr.rgb = mix(cr.rgb, vec3(0.95, 0.93, 0.88), 0.5);   // 新島の崖は白い
        tc = mix(tc, cr, vBlend.y*(1.0-vBlend.x*0.7)); diffuseColor *= tc;`);
  };
  const mesh = new THREE.Mesh(geo, mat); scene.add(mesh);
  return mesh;
}

// ---- 道（地形に沿うリボン） ----
// 道は結節点（校門・商店・港・神社…）どうしをつなぎ、行き止まりを作らない。
// kind: main=幹線（中央線あり）, lane=集落の路地, path=山や海への細道。 lots=両わきに家を並べる。
export const ROADS = [
  { id:'school',  kind:'main', lots:true, cut:true, pts:[[-70,34],[-40,10],[-8,-12],[30,-8]] },              // 本通り〜校門（山すその峠を越える）
  { id:'main',    kind:'main', lots:true,  pts:[[-70,34],[-104,36],[-134,40],[-162,50],[-190,62],[-210,68]] }, // 本通り〜港
  { id:'beach',   kind:'main', pts:[[30,-8],[50,6],[62,24],[72,32]] },                                        // 校門〜東の浜
  { id:'lookout', kind:'path', cut:true, pts:[[-8,-12],[-16,-30],[-26,-48],[-32,-59]] },                      // 峠〜展望台
  { id:'onsen',   kind:'path', pts:[[-134,40],[-150,34],[-164,30],[-173,30]] },                               // 前浜の温泉
  { id:'shrine',  kind:'path', cut:true, pts:[[-76,10],[-80,-6],[-84,-22],[-84,-46]] },                       // 神社の参道
  { id:'north',   kind:'lane', lots:true,  pts:[[-128,22],[-104,14],[-76,10],[-52,8],[-40,10]] },             // 北の路地
  { id:'shopst',  kind:'lane', lots:true,  pts:[[-126,60],[-104,57],[-84,55.5],[-64,54],[-44,50],[-26,42],[-14,28],[-20,10],[-24,-1]] }, // 商店の通り
  { id:'c1',      kind:'lane', lots:true,  pts:[[-104,14],[-103,25],[-104,36],[-105,47],[-104,57]] },
  { id:'c2',      kind:'lane', lots:true,  pts:[[-76,10],[-74,22],[-70,34],[-66,44],[-64,54]] },
  { id:'c3',      kind:'lane', lots:true,  pts:[[-40,10],[-38,24],[-40,38],[-44,50]] },
  { id:'c4',      kind:'lane', lots:true,  pts:[[-128,22],[-132,31],[-134,40],[-131,50],[-126,60]] },
  { id:'airport', kind:'main', pts:[[-26,42],[-14,62],[-8,82],[-6,99]] },                                      // 空港
  { id:'south',   kind:'path', cut:true, pts:[[-104,57],[-100,90],[-96,125],[-92,160],[-70,190],[-70,212],[-90,232],[-125,246],[-160,250],[-183,250]] }, // 南の台地・石山
  { id:'wakago',  kind:'main', cut:true, pts:[[30,-8],[58,-12],[80,-30],[88,-60],[92,-90],[104,-120],[114,-160],[136,-200],[164,-235],[198,-268],[236,-300],[254,-338],[232,-375],[200,-400],[165,-415],[130,-425]] }, // 東海岸〜北の集落
  { id:'w1',      kind:'lane', lots:true,  pts:[[130,-425],[118,-436],[104,-444]] },
  { id:'w2',      kind:'lane', lots:true,  pts:[[165,-415],[158,-432],[140,-442],[118,-436]] },
];
export const ROAD_W = { main:2.5, lane:1.75, path:1.6 };
export const ROAD_PTS = [];   // [x, z, nx, nz, 道の番号, 道のりm]
export function roadDist(x, z, skip=-1){ let m = 1e9; for (const p of ROAD_PTS){ if (p[4] === skip) continue; const d = Math.hypot(x-p[0], z-p[1]); if (d < m) m = d; } return m; }
// 道の帯。offs は道の中心からの横位置（複数列にすると地面のでこぼこに沿いやすい）。
// keep(x,z) が false の場所は張らない（交差点で、線や側溝がほかの道の上に重ならないようにする）。
function ribbon(curve, n, offs, lift, vScale, keep){ const v=[], u=[], idx=[], K=offs.length, ok=[];
  for (let i=0;i<=n;i++){ const p=curve.getPointAt(i/n), t=curve.getTangentAt(i/n); const nx=-t.z, nz=t.x; let good = true;
    offs.forEach((o, k) => { const x=p.x+nx*o, z=p.z+nz*o; v.push(x, heightAt(x,z)+lift, z); u.push(k/(K-1), i*vScale); if (keep && !keep(x, z)) good = false; }); ok.push(good); }
  for (let i=0;i<n;i++){ if (!ok[i] || !ok[i+1]) continue; for (let k=0;k<K-1;k++){ const a=i*K+k, c=a+K; idx.push(a,a+1,c, a+1,c+1,c); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v,3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u,2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
export function buildRoads(scene){
  const po = { polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 };
  const asphalt = new THREE.MeshLambertMaterial({ map: tex('asphalt'), ...po });
  const dirt = new THREE.MeshLambertMaterial({ map: tex('dirt'), color:0xd8d0c0, ...po });
  const gutter = new THREE.MeshLambertMaterial({ map: tex('concrete'), polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3 });
  const white = new THREE.MeshLambertMaterial({ color:0xe8e6dc, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4 });
  const curves = ROADS.map(r => new THREE.CatmullRomCurve3(r.pts.map(p=>new THREE.Vector3(p[0],0,p[1]))));
  curves.forEach((curve, ri) => { const len = curve.getLength(), n = Math.ceil(len/4); for (let i=0;i<=n;i++){ const p=curve.getPointAt(i/n), t=curve.getTangentAt(i/n); ROAD_PTS.push([p.x, p.z, -t.z, t.x, ri, len*i/n]); } });
  // ほかの道の舗装の上かどうか（細かく見るための点列）
  const fine = curves.map((c, ri) => { const n = Math.ceil(c.getLength()/1.5), a = []; for (let i=0;i<=n;i++){ const p = c.getPointAt(i/n); a.push(p.x, p.z); } return a; });
  const onOther = (x, z, self) => { for (let ri=0; ri<fine.length; ri++){ if (ri === self) continue; const a = fine[ri], lim = ROAD_W[ROADS[ri].kind] + 0.5; for (let i=0;i<a.length;i+=2) if (Math.abs(a[i]-x) < lim && Math.abs(a[i+1]-z) < lim && Math.hypot(a[i]-x, a[i+1]-z) < lim) return true; } return false; };
  ROADS.forEach((r, ri) => {
    const curve = curves[ri], len = curve.getLength(), n = Math.ceil(len/2), hw = ROAD_W[r.kind], lift = 0.14 + ri*0.006, keep = (x, z) => !onOther(x, z, ri);
    scene.add(new THREE.Mesh(ribbon(curve, n, [-hw, -hw/3, hw/3, hw], lift, 0.4), r.kind === 'path' ? dirt : asphalt));
    if (r.kind !== 'path'){   // 側溝（コンクリートのふた）
      scene.add(new THREE.Mesh(ribbon(curve, n, [-hw-0.45, -hw], lift+0.01, 1.1, keep), gutter)); scene.add(new THREE.Mesh(ribbon(curve, n, [hw, hw+0.45], lift+0.01, 1.1, keep), gutter)); }
    if (r.kind === 'main') scene.add(new THREE.Mesh(ribbon(curve, n, [-0.07, 0.07], lift+0.02, 1, keep), white));
    if (r.kind === 'lane'){ scene.add(new THREE.Mesh(ribbon(curve, n, [-hw+0.22, -hw+0.32], lift+0.02, 1, keep), white)); scene.add(new THREE.Mesh(ribbon(curve, n, [hw-0.32, hw-0.22], lift+0.02, 1, keep), white)); }
  });
}

// ---- 海 ----
export function buildSea(scene){
  const t = tex('water'); t.repeat.set(160,160);
  // 海岸からの浅瀬の深さを小さなテクスチャにして、波打ち際に白い寄せ波を描く
  const gr = grid(), dw = SX + 1, dh = SZ + 1, dep = new Uint8Array(dw*dh*4);
  for (let i = 0; i < gr.length; i++){ const v = Math.round(Math.max(0, Math.min(1, (-gr[i] + 0.35)/2.6))*255); dep[i*4] = v; dep[i*4+1] = v; dep[i*4+2] = v; dep[i*4+3] = 255; }
  const dTex = new THREE.DataTexture(dep, dw, dh, THREE.RGBAFormat); dTex.minFilter = dTex.magFilter = THREE.LinearFilter; dTex.needsUpdate = true;
  const uni = { uTime:{ value:0 }, uRough:{ value:1 }, tDepth:{ value:dTex } };
  const mat = new THREE.MeshLambertMaterial({ map:t, transparent:true, opacity:0.86 });
  mat.onBeforeCompile = s => {
    Object.assign(s.uniforms, uni);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uRough; uniform sampler2D tDepth; varying vec3 vW;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 suv = vec2((vW.x - (${GX0.toFixed(1)})) / ${TW.toFixed(1)}, (vW.z - (${GZ0.toFixed(1)})) / ${TD.toFixed(1)});
        float sdep = (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) ? texture2D(tDepth, suv).r : 1.0;
        if (sdep < 0.88){
          float shore = 1.0 - smoothstep(0.0, 0.88, sdep);
          float w1 = sin(sdep * 22.0 - uTime * (1.8 + uRough * 0.35));
          float w2 = sin(sdep * 14.0 - uTime * (1.2 + uRough * 0.25) + 2.1);
          float foam = smoothstep(0.64, 0.94, w1) * shore * 0.68 + smoothstep(0.74, 0.96, w2) * shore * 0.42;
          foam += smoothstep(0.24, 0.02, sdep) * (0.42 + 0.18 * sin(uTime * 2.1 + vW.x * 0.14 + vW.z * 0.14));
          foam = clamp(foam, 0.0, 0.9);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.98, 1.0), foam);
          diffuseColor.a = max(diffuseColor.a, mix(0.86, 0.96, foam));
        }`);
  };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4000,4000,1,1).rotateX(-Math.PI/2), mat); m.position.y = 0; scene.add(m);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000,4000).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x1d5a7c, fog:true})); floor.position.y=-13.5; scene.add(floor);
  // 台風の日は波を高くする（window.G.seaRough）
  return { update(time){ const r = (window.G && window.G.seaRough) || 1; uni.uTime.value = time; uni.uRough.value = r; t.offset.set(time*0.012*r, time*0.008*r); m.position.y = Math.sin(time*0.7*(0.6 + r*0.4))*0.08*r; } };
}
