import * as THREE from 'three';
import { AIRPORT, heightAt, ZONES, PLATFORMS, ROADS, ROAD_W, ROAD_PTS, roadDist } from './terrain.js';
import { model, sway, WIND } from '../models.js';
import { tex, textTex } from '../assets.js';

export const SCHOOL = { x:30, z:-62 };
export const ROOM = { id:'class', x:40, z:-60.5, y:16.5, minX:36.0, maxX:43.9, minZ:-63.3, maxZ:-57.7,
  col:[{ x:38.8, z:-61.4, w:1.9, d:1.3 }, { x:42.6, z:-59.25, w:3.0, d:2.8 }, { x:35.9, z:-61.4, w:1.2, d:3.4 }] };
export const HOME = { x:-78, z:46.5 };
// 入れる建物の中。部屋は建物の真上の空中に置き、中にいる間だけ見せる（窓の外は映さない）。
// 座標はゲーム内の値。col は部屋の中の家具の当たり判定。walls は壁の内側までの半幅（x, z）と天井の高さ（カメラが壁を抜けないように使う）。
const box = (cx, cz, x, z, w, d) => ({ x:cx + x, z:cz + z, w, d });
export const HOME_IN = { id:'home', x:HOME.x, z:HOME.z, y:40, walls:[4.5, 3.3, 2.5], minX:HOME.x - 4.15, maxX:HOME.x + 4.15, minZ:HOME.z - 2.95, maxZ:HOME.z + 2.95,
  col:[box(HOME.x, HOME.z, 0.6, 2.13, 0.25, 2.4), box(HOME.x, HOME.z, 0.6, -2.13, 0.25, 2.4), { x:HOME.x - 2.2, z:HOME.z - 0.3, r:0.62 }, box(HOME.x, HOME.z, -4.1, -1.9, 0.8, 0.7),
    { x:HOME.x - 0.3, z:HOME.z - 2.6, r:0.25 }, box(HOME.x, HOME.z, 3.4, -2.75, 1.45, 0.65), box(HOME.x, HOME.z, 4.25, 0.4, 0.45, 1.25), box(HOME.x, HOME.z, -2.3, 3.05, 0.55, 0.45)] };
export const SHOP = { x:-84, z:66 };
export const SHOP_IN = { id:'shop', x:SHOP.x, z:SHOP.z, y:40, walls:[4.3, 3.1, 2.9], minX:SHOP.x - 4.0, maxX:SHOP.x + 4.0, minZ:SHOP.z - 1.0, maxZ:SHOP.z + 2.8,
  col:[box(SHOP.x, SHOP.z, -0.8, -0.8, 2.5, 0.6), box(SHOP.x, SHOP.z, -3.2, 0.35, 1.35, 1.05), box(SHOP.x, SHOP.z, -1.2, 0.35, 1.35, 1.05), box(SHOP.x, SHOP.z, 4.0, -0.2, 0.65, 3.6),
    box(SHOP.x, SHOP.z, 2.1, 1.6, 1.25, 0.75), box(SHOP.x, SHOP.z, 2.0, -0.6, 1.35, 0.8), { x:SHOP.x - 3.7, z:SHOP.z + 2.5, r:0.38 }] };
export const TERM = { x:16, z:96 };
export const TERM_IN = { id:'term', x:TERM.x, z:TERM.z, y:46, walls:[7.0, 3.5, 3.4], minX:TERM.x - 6.7, maxX:TERM.x + 6.7, minZ:TERM.z - 3.1, maxZ:TERM.z + 3.1,
  col:[box(TERM.x, TERM.z, -4.5, 0.6, 3.3, 0.7), box(TERM.x, TERM.z, 0.5, 0.6, 3.3, 0.7), box(TERM.x, TERM.z, -4.5, -1.2, 3.3, 0.7), box(TERM.x, TERM.z, 0.5, -1.2, 3.3, 0.7),
    box(TERM.x, TERM.z, 5.2, 1.6, 0.8, 3.1), box(TERM.x, TERM.z, -6.5, 2.6, 1.0, 0.8), box(TERM.x, TERM.z, -6.7, -1.5, 0.7, 1.3)] };
export const ROOMS = { class:ROOM, home:HOME_IN, shop:SHOP_IN, term:TERM_IN };
// 友達と散歩で行ける場所
export const SPOTS = {
  lookout:  { x:-34,  z:-62,  r:7,  name:'峠の展望台' },
  ishiyama: { x:-190, z:250,  r:9,  name:'石山の展望台' },
  shrine:   { x:-84,  z:-46,  r:9,  name:'潮見神社' },
  onsen:    { x:-182, z:30,   r:10, name:'石柱の湯' },
  pier:     { x:-270, z:70,   r:8,  name:'港の灯台' },
  beach:    { x:84,   z:34,   r:16, name:'白砂の浜' },
  wakago:   { x:132,  z:-430, r:14, name:'若浦の集落' },
};
// 狭い場所を先に書く（先に当たったものが表示される）
export const AREAS = [ [-412,64,48,'沖の小島'], [-34,-62,20,'峠の展望台'], [-84,-46,22,'潮見神社'], [-182,30,20,'石柱の湯'], [-190,250,26,'石山の展望台'], [84,34,34,'白砂の浜'], [-236,70,42,'白砂港'], [20,108,60,'白砂空港'], [135,-430,52,'若浦の集落'], [30,-45,52,'都立白砂高校'], [-75,40,60,'本村の集落'] ];

function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0,1,0);

export function buildWorld(G){
  const { scene, colliders } = G; const W = { bob:[], shells:[], bikes:[], cars:[], decos:{} };
  // 吹っ飛ばせる外の小物（physics.js が W.knock を見て登録する）。数字は重さ
  const KNOCK = { bench:1.5, vending:4, postbox:2, noticeboard:1.5, gomi:2, fishrack:1.5, mirror:0.8, stopsign:0.8, laundry:1, surfboard:0.6, windsock:1, busstop:3, planter:0.8 }; W.knock = [];
  const footMat = new THREE.MeshLambertMaterial({ map:tex('concrete'), color:0xbdbab0 });   // 建物の土台（坂で浮かないように）
  const put = (name, x, z, ry=0, opt={}) => { const m = model(name); const y = opt.y ?? heightAt(x, z); m.position.set(x, y + (opt.dy||0), z); m.rotation.y = ry; if (opt.s) m.scale.setScalar(opt.s); scene.add(m);
    let col = null; if (opt.box) colliders.push(col = { x, z, w:opt.box[0], d:opt.box[1], rot:ry });
    // 坂の上の建物：角の地面が低いと下が浮いて透けるので、地面の下まで届く土台を足す
    if (opt.box && !KNOCK[name]){ const [w, d] = opt.box, cs = Math.cos(ry), sn = Math.sin(ry); let lo = y; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]){ const lx = a*w/2, lz = b*d/2; lo = Math.min(lo, heightAt(x + lx*cs + lz*sn, z - lx*sn + lz*cs)); }
      if (y - lo > 1.0){ const hgt = y - lo + 1.0, f = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, hgt, d - 0.1), footMat); f.position.set(x, y - hgt/2 - 0.05, z); f.rotation.y = ry; scene.add(f); } } if (opt.r) colliders.push(col = { x, z, r:opt.r });
    if (KNOCK[name]) W.knock.push({ m, col, mass:KNOCK[name], kind:name }); return m; };
  const putBike = (x, z, ry, opt={}) => {
    const mesh = put('bike', x, z, ry, opt);
    W.bikes.push({ mesh, home:{ x:mesh.position.x, y:mesh.position.y, z:mesh.position.z, ry } });
  };
  // 原付（自転車と同じしくみで乗る。kind:'moped'）
  const putMoped = (x, z, ry) => { const mesh = put('moped', x, z, ry, { dy:0.02 }); W.bikes.push({ mesh, kind:'moped', home:{ x:mesh.position.x, y:mesh.position.y, z:mesh.position.z, ry } }); };
  W.putMoped = putMoped;
  // 軽トラの当たり判定は、運転席（ぶつかる）と荷台（ジャンプで越えて乗れる）の2つ。位置は car.js の syncCol で車に合わせる
  const putCar = (x, z, ry) => { const mesh = put('keitruck', x, z, ry); const car = { mesh, home:{ x, y:mesh.position.y, z, ry } };
    car.col = { x, z, w:1.6, d:1.35, rot:ry, off0:0.95 }; car.bed = { x, z, w:1.6, d:2.05, rot:ry, off0:-0.58, h:0.95, car };
    for (const c of [car.col, car.bed]){ c.x = x + Math.sin(ry)*c.off0; c.z = z + Math.cos(ry)*c.off0; colliders.push(c); } W.cars.push(car); };
  // amp を渡すと風に揺れる（草・茂み・木の葉）
  const instanced = (name, list, amp=0) => { if (!list.length) return; const src = model(name); src.updateMatrixWorld(true);
    src.traverse(o => { if (!o.isMesh) return; const im = new THREE.InstancedMesh(o.geometry, amp && !/bark|trunk/.test(o.material.name) ? sway(o.material, amp) : o.material, list.length);
      list.forEach((t, i) => { P.set(t.x, (t.y ?? heightAt(t.x, t.z)) - 0.05, t.z); Q.setFromAxisAngle(UP, t.ry||0); S.setScalar(t.s||1); M.compose(P, Q, S).multiply(o.matrixWorld); im.setMatrixAt(i, M); });
      im.frustumCulled = false; scene.add(im); }); };

  // ---- 学校 ----
  W.school = new THREE.Group(); scene.add(W.school);
  const sch = model('school'); sch.position.set(SCHOOL.x, 9, SCHOOL.z); W.school.add(sch);
  // 校舎の当たり判定は、中の壁ごとに school.js が作る（自転車のまま昇降口から入れるように）。北に出っぱった階段塔だけここで
  colliders.push({ x:15, z:-67.2, w:7, d:1.2 });
  put('gym', 66, -46, 0, { y:9, box:[18,26] });
  // 地面に敷く土の面。平らな板ではなく、細かく割って地形の高さに沿わせる（坂や区画の端で浮いたり、足が隠れたりしないように）
  const patchMat = new THREE.MeshLambertMaterial({ map: tex('dirt'), vertexColors:true, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
  const patches = { v:[], u:[], c:[], i:[] };
  const groundPatch = (cx, cz, w, d, ry, color, cell=3) => { const nx = Math.max(1, Math.ceil(w/cell)), nz = Math.max(1, Math.ceil(d/cell)), base = patches.v.length/3, cs = Math.cos(ry), sn = Math.sin(ry);
    for (let j=0;j<=nz;j++) for (let i=0;i<=nx;i++){ const lx = (i/nx - 0.5)*w, lz = (j/nz - 0.5)*d, x = cx + lx*cs + lz*sn, z = cz - lx*sn + lz*cs; patches.v.push(x, heightAt(x, z) + 0.07, z); patches.u.push(x/5, z/5); patches.c.push(color.r, color.g, color.b); }
    for (let j=0;j<nz;j++) for (let i=0;i<nx;i++){ const p0 = base + j*(nx+1) + i, p1 = p0 + 1, p2 = p0 + nx + 1, p3 = p2 + 1; patches.i.push(p0, p2, p1, p1, p2, p3); } };
  groundPatch(28, -32, 58, 34, 0, new THREE.Color(1, 1, 1));   // 校庭
  put('goal', 3, -32, Math.PI/2, { y:9 }); put('goal', 53, -32, -Math.PI/2, { y:9 });
  put('gate', 30, -12, 0, { y:9 }); colliders.push({ x:22.1, z:-12, w:8.6, d:1 }, { x:37.9, z:-12, w:8.6, d:1 });
  for (let i=0;i<5;i++){ put('fence', -1, -18 - i*4, Math.PI/2, { y:9 }); }
  putBike(24, -52, 0.4, { y:9.02 }); putBike(25.2, -52.2, 0.5, { y:9.02 }); putBike(26.6, -51.8, 0.3, { y:9.02 });
  put('tree-round', 44, -16, 0, { y:9, s:1.5, r:0.5 }); put('bench', 44, -19.5, Math.PI, { y:9 });
  // 教室（校舎3階の位置に置き、中にいる間だけ見せる）
  W.classroom = model('classroom'); W.classroom.position.set(ROOM.x, ROOM.y, ROOM.z); W.classroom.visible = false; scene.add(W.classroom);
  // 自宅・商店・空港の中（Blender では -Y が入口。ゲームでは +Z が入口になるので、そのまま置ける）
  W.interiors = { class:W.classroom };
  for (const [k, def, name] of [['home', HOME_IN, 'home-in'], ['shop', SHOP_IN, 'shop-in'], ['term', TERM_IN, 'terminal-in']]){ const m = model(name); m.position.set(def.x, def.y, def.z); m.visible = false; scene.add(m); W.interiors[k] = m; }
  // 首を振る扇風機（部屋の中に置き、部屋といっしょに見え隠れする）。x, z は部屋の中心から、ry は向き
  W.fans = [];
  for (const [k, x, z, ry] of [['home', -0.3, -2.6, -0.69], ['shop', 3.3, -2.5, -0.92], ['term', 6.4, -3.0, -1.13]]){ const f = model('fan'); f.position.set(x, 0, z); f.rotation.y = ry; W.interiors[k].add(f);
    W.fans.push({ head:f.getObjectByName('fanHead'), blades:f.getObjectByName('fanBlades'), t:Math.random()*10, room:k }); }
  // 毎フレーム：風の時間を進め、扇風機の羽根を回して首を振る
  W.moving = dt => { WIND.value += dt;
    if (G.player){ const p = G.player.pos; for (const g of W.grassCells){ const [x, z] = g.userData.c; g.visible = !G.indoor && Math.hypot(x - p.x, z - p.z) < 120; } } for (const f of W.fans){ if (!W.interiors[f.room].visible) continue; f.t += dt; if (f.head) f.head.rotation.y = Math.sin(f.t*0.55)*0.75; if (f.blades) f.blades.rotation.z += dt*22; } };
  W.interiors.shop.traverse(o => { if (o.isMesh && o.material.name === 'kori-flag-ds'){ o.material = o.material.clone(); o.material.map = textTex('氷', { w:128, h:256, font:'bold 150px "Zen Maru Gothic", sans-serif', fg:'#2f6fb5', bg:'#f4f0e4' }); o.material.color.set(0xffffff); } });
  { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d'); const draw = () => { g.fillStyle = '#2f3a48'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#f4d35e'; g.font = 'bold 34px "Zen Maru Gothic", sans-serif'; g.fillText('出発　DEPARTURES', 24, 46);
      g.fillStyle = '#eef'; g.font = 'bold 30px "Zen Maru Gothic", sans-serif'; [['09:10', '調布ゆき'], ['13:25', '調布ゆき'], ['16:40', '調布ゆき']].forEach(([t, d], i) => { g.fillText(t, 30, 104 + i*52); g.fillText(d, 170, 104 + i*52); g.fillStyle = '#9fd28a'; g.fillText('定刻', 380, 104 + i*52); g.fillStyle = '#eef'; }); };
    draw(); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; document.fonts && document.fonts.ready.then(() => { draw(); t.needsUpdate = true; });
    W.interiors.term.traverse(o => { if (o.isMesh && o.material.name === 'timetable'){ o.material = o.material.clone(); o.material.map = t; o.material.color.set(0xffffff); } }); }
  W.classroom.traverse(o => { if (/^(sign0|sign1|deco[1-4])$/.test(o.name)) W.decos[o.name] = o;
    if (o.isMesh && o.material.name === 'banner'){ o.material = o.material.clone(); o.material.map = textTex('第52回　白砂祭', { w:1024, h:128, font:'bold 92px "Yomogi", sans-serif', fg:'#c8463c' }); o.material.color.set(0xffffff); } });

  // ---- 集落 ----
  // 道の両わきに区画を並べ、家は必ず道のほうを向く。塀と生け垣で通りの輪郭を作る。
  const R = rng(20260816);
  const DEPTH = { house:7, house2:6.5, house3:8.6, house4:8.1, shed:4.2, shop:7 }, WIDTH = { house:9.4, house2:8, house3:10.6, house4:11.6, shed:5.2, shop:9.4 };
  const TYPES = ['house', 'house', 'house', 'house2', 'house2', 'house3', 'house3', 'house4', 'shed'];
  const lots = W.lots = [{ x:HOME.x, z:HOME.z, ry:0, type:'house', home:true }, { x:SHOP.x, z:SHOP.z, ry:Math.PI, type:'shop' }];
  const PLAZA = { x:-62.5, z:41, r:8 };
  const inVillage = (x, z) => Math.hypot((x + 78)/68, (z - 38)/52) < 1 || Math.hypot((x - 135)/50, (z + 430)/28) < 1;   // 本村と、北の若浦
  const rad = t => Math.max(WIDTH[t], DEPTH[t])*0.5;
  const lotFree = (x, z, r, self) => lots.every(l => l === self || Math.hypot(l.x - x, l.z - z) > rad(l.type)*0.86 + r) && Math.hypot(x - PLAZA.x, z - PLAZA.z) > PLAZA.r + r;
  ROADS.forEach((road, ri) => { if (!road.lots) return; const hw = ROAD_W[road.kind]; const pts = ROAD_PTS.filter(p => p[4] === ri); const next = { '-1':4 + R()*5, '1':4 + R()*5 };
    for (const p of pts) for (const side of [-1, 1]){ if (p[5] < next[side]) continue; const type = TYPES[Math.floor(R()*TYPES.length)], D = DEPTH[type], Wd = WIDTH[type];
      const off = hw + 0.45 + 2.0 + D/2 + R()*0.9, x = p[0] + p[2]*side*off, z = p[1] + p[3]*side*off; const fx = -p[2]*side, fz = -p[3]*side, tx = fz, tz = -fx;
      let ok = inVillage(x, z) && roadDist(x, z) > off - 0.7 && lotFree(x, z, rad(type)*0.86 + 0.2);
      if (ok) for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (roadDist(x + fx*a*D/2 + tx*b*Wd/2, z + fz*a*D/2 + tz*b*Wd/2) < 2.9) ok = false;
      if (!ok){ next[side] = p[5] + 3; continue; }
      lots.push({ x, z, ry:Math.atan2(fx, fz), type, ri, fence: R() < 0.64 ? 'wall' : R() < 0.7 ? 'hedge' : null }); next[side] = p[5] + Wd + 1.0 + R()*2.6; } });
  lots[0].fence = 'wall';
  const walls = [], hedges = [], planters = [], hib = [], gardenTrees = [], byType = {}, yards = []; let trucks = 0;
  for (const l of lots){ const D = DEPTH[l.type], Wd = WIDTH[l.type], fx = Math.sin(l.ry), fz = Math.cos(l.ry), tx = fz, tz = -fx; const at = (a, b) => [l.x + fx*a + tx*b, l.z + fz*a + tz*b];
    colliders.push({ x:l.x, z:l.z, w:Wd, d:D, rot:l.ry });
    if (l.type === 'shop'){ W.shop = put('shop', l.x, l.z, l.ry); continue; }
    (byType[l.type] = byType[l.type] || []).push({ x:l.x, z:l.z, ry:l.ry, s:1 }); yards.push(l);
    // 庭のもの
    const free = (x, z, r) => roadDist(x, z) > r + 2.6 && lotFree(x, z, r, l);
    if (R() < 0.55) for (const sgn of [-1, 1]){ const [x, z] = at(D/2 + 0.45, sgn*(1.6 + R()*1.2)); planters.push({ x, z, ry:l.ry }); }
    if (R() < 0.5){ const [x, z] = at(D/2 + 0.9, (R() < 0.5 ? -1 : 1)*(Wd/2 - 0.6)); if (free(x, z, 0.8)) hib.push({ x, z, ry:R()*6, s:0.7 + R()*0.4 }); }
    if (R() < 0.6){ const [x, z] = at(-D/2 - 2 - R()*2, (R() - 0.5)*Wd); if (free(x, z, 1.6)){ gardenTrees.push({ x, z, ry:R()*6, s:0.5 + R()*0.3 }); colliders.push({ x, z, r:0.35 }); } }
    if (R() < 0.3){ const [x, z] = at(0.5, -(Wd/2 + 1.7)); if (free(x, z, 1.7)) put('laundry', x, z, l.ry + Math.PI/2); }
    if (R() < 0.22 && trucks < 4){ const [x, z] = at(0.6, Wd/2 + 1.5); if (free(x, z, 1.6)){ putCar(x, z, l.ry + (R() - 0.5)*0.2); trucks++; } }
    else if (R() < 0.3){ const [x, z] = at(D/2 + 0.6, -Wd/2 + 1.2); putBike(x, z, l.ry + 1.4, { dy:0.02 }); }
  }
  for (const k in byType) instanced(k, byType[k].map(t => ({ ...t, y: heightAt(t.x, t.z) + 0.05 })));
  // 通りに沿って塀を連続させる（家の門と交差点ではあける）。通りの輪郭がはっきりして、住宅街に見える
  ROADS.forEach((road, ri) => { if (!road.lots) return; const hw = ROAD_W[road.kind];
    for (const p of ROAD_PTS) { if (p[4] !== ri) continue; for (const side of [-1, 1]){ const x = p[0] + p[2]*side*(hw + 0.85), z = p[1] + p[3]*side*(hw + 0.85);
      if (!inVillage(x, z) || roadDist(x, z, ri) < 4.0 || Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 1) continue;
      let best = null, bd = 12.5; for (const l of lots){ const d = Math.hypot(l.x - x, l.z - z); if (d < bd){ bd = d; best = l; } }
      if (!best || best.type === 'shop' || !best.fence || best.type === 'shed') continue;
      const lat = Math.abs((x - best.x)*Math.cos(best.ry) - (z - best.z)*Math.sin(best.ry)); if (best.ri === ri || best.home) { if (lat < 2.0) continue; }
      const th = Math.atan2(p[2], p[3]); (best.fence === 'wall' ? walls : hedges).push({ x, z, ry: side > 0 ? th : th + Math.PI }); colliders.push({ x, z, w:4.2, d:0.5, rot:th, h:1.0 }); } } });
  instanced('wall', walls); instanced('hedge', hedges); instanced('planter', planters); instanced('hibiscus', hib);
  // 敷地の地面（土や砂利）
  { const col = new THREE.Color(); yards.forEach(l => { const D = DEPTH[l.type], Wd = WIDTH[l.type]; col.setHSL(0.09 + R()*0.03, 0.12 + R()*0.15, 0.72 + R()*0.2);
      groundPatch(l.x + Math.sin(l.ry)*0.9, l.z + Math.cos(l.ry)*0.9, Wd + 2.6, D + 3.6, l.ry, col.clone()); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(patches.v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(patches.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(patches.c, 3)); g.setIndex(patches.i); g.computeVertexNormals();
    const m = new THREE.Mesh(g, patchMat); m.frustumCulled = false; scene.add(m); }
  putCar(HOME.x + 7.2, HOME.z + 0.6, 0);   // 家の横の軽トラ
  put('laundry', HOME.x - 6.8, HOME.z, Math.PI/2); putBike(HOME.x + 3.4, HOME.z + 4.2, 1.2, { dy:0.02 }); putMoped(HOME.x + 5.4, HOME.z + 3.6, 1.4);   // 家の原付（お父さんの）
  put('vending', -77.8, 62.4, Math.PI, { box:[1.1, 0.9] });
  W.shop.traverse(o => { if (o.isMesh && o.material.name === 'shop-sign'){ o.material = o.material.clone(); o.material.map = textTex('しおかぜ商店', { w:512, h:96, font:'bold 64px "Zen Maru Gothic", sans-serif' }); o.material.color.set(0xffffff); } });
  // 辻の広場：火の見やぐら（集落の目印）・ポスト・掲示板
  put('firetower', -60.5, 43, 0.3, { r:1.5 }); put('postbox', -66.2, 38.4, -0.6, { r:0.3 }); put('noticeboard', -62.6, 36.9, 0.15, { box:[1.8, 0.3] }); put('bench', -58, 39.2, -0.9); put('statue', -56.5, 44.5, -1.2, { r:0.8, s:0.8 });
  put('busstop', -88, 30.6, 0); put('gomi', -100.2, 44, Math.PI/2, { box:[1.1, 1.9] });
  // 塀の上の猫（なでられる）
  W.cats = []; walls.filter((w, i) => i % 9 === 4).slice(0, 6).forEach((w, i) => { const m = put(i % 2 ? 'cat2' : 'cat', w.x, w.z, w.ry + (i % 3 - 1)*0.8 + Math.PI/2, { dy:1.4 }); W.cats.push({ id:i, x:w.x, z:w.z, mesh:m }); });
  // 交差点のカーブミラーと「止まれ」
  const JUNC = [[-104,14],[-76,10],[-104,36],[-104,57],[-64,54],[-44,50],[-128,22],[-134,40],[-126,60],[-56,22.8],[-70,34]];
  for (const [jx, jz] of JUNC){ const cand = [[3.7, 3.7], [-3.7, 3.7], [3.7, -3.7], [-3.7, -3.7]].map(([a, b]) => [jx + a, jz + b]).filter(([x, z]) => roadDist(x, z) > 2.75 && lotFree(x, z, 0.3));
    if (cand[0]){ const [x, z] = cand[0]; put('mirror', x, z, Math.atan2(jx - x, jz - z), { r:0.15 }); }
    if (cand[1] && R() < 0.7){ const [x, z] = cand[cand.length - 1]; put('stopsign', x, z, Math.atan2(jx - x, jz - z), { r:0.12 }); } }
  const stopCv = document.createElement('canvas'); stopCv.width = 128; stopCv.height = 384; { const g = stopCv.getContext('2d'); g.fillStyle = '#eceadf'; g.font = 'bold 112px "Zen Maru Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; ['止', 'ま', 'れ'].forEach((c, i) => g.fillText(c, 64, 64 + i*128)); }
  const stopTex = new THREE.CanvasTexture(stopCv); stopTex.colorSpace = THREE.SRGBColorSpace; document.fonts && document.fonts.ready.then(() => { const g = stopCv.getContext('2d'); g.clearRect(0, 0, 128, 384); ['止', 'ま', 'れ'].forEach((c, i) => g.fillText(c, 64, 64 + i*128)); stopTex.needsUpdate = true; });
  const decalMat = (map) => new THREE.MeshLambertMaterial({ map, transparent:true, alphaTest:0.3, polygonOffset:true, polygonOffsetFactor:-6, polygonOffsetUnits:-6 });
  const stopMat = decalMat(stopTex), holeMat = decalMat(tex('manhole', { repeat:false }));
  const decal = (mat, x, z, w, h, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI/2), mat); m.position.set(x, heightAt(x, z) + 0.2, z); m.rotation.y = ry; scene.add(m); };
  ROADS.forEach((road, ri) => { const pts = ROAD_PTS.filter(p => p[4] === ri), len = pts[pts.length - 1][5];
    if (/^c\d/.test(road.id)) for (const [d, flip] of [[7, 0], [len - 7, 1]]){ const p = pts.reduce((a, b) => Math.abs(b[5] - d) < Math.abs(a[5] - d) ? b : a); const tx = p[3], tz = -p[2]; decal(stopMat, p[0] + p[2]*0, p[1], 1.1, 3.3, Math.atan2(tx, tz) + (flip ? Math.PI : 0)); }
    if (road.kind !== 'path') for (const p of pts) if (p[5] > 10 && R() < 0.045 && inVillage(p[0], p[1])) decal(holeMat, p[0] + p[2]*0.8, p[1] + p[3]*0.8, 0.9, 0.9, R()*6); });
  // ---- 港 ----
  put('pier', -256, 70, 0, { y:0.6 }); PLATFORMS.push({ x:-256, z:70, w:46, d:6, top:1.62 });
  colliders.push({ x:-256, z:67.1, w:46, d:0.5, h:0.55 });   // 桟橋北側の車止め
  const lhMesh = put('lighthouse', -275, 70, 0, { y:1.6, r:1.4 });
  let lhLampMat = null; lhMesh.traverse(o => { if (o.isMesh && o.material && o.material.name === 'lh-lamp'){ lhLampMat = o.material = o.material.clone(); lhLampMat.color.setHex(0x9ff5c2); lhLampMat.emissive.setHex(0x3be084); lhLampMat.emissiveIntensity = 0.25; } });
  const lhGlow = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(130,255,180,1)'); gr.addColorStop(0.4, 'rgba(80,235,145,0.45)'); gr.addColorStop(1, 'rgba(60,220,130,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const tx = new THREE.CanvasTexture(cv);
    const pt = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-275, 9.83, 70], 3)),
      new THREE.PointsMaterial({ map:tx, size:26, sizeAttenuation:false, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, fog:false, opacity:0 }));
    pt.frustumCulled = false; scene.add(pt);
    const bm = new THREE.MeshBasicMaterial({ color:0x7ff5b2, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, fog:false, side:THREE.DoubleSide });
    const grp = new THREE.Group(); grp.position.set(-275, 9.83, 70);
    for (const sgn of [-1, 1]){ const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 18, 8, 1, true), bm); cone.position.z = sgn*9; cone.rotation.x = sgn > 0 ? -Math.PI/2 : Math.PI/2; grp.add(cone); }
    grp.visible = false; scene.add(grp);
    return { pt, grp, bm };
  })();
  for (const [x,z,ry] of [[-248,78,0.2],[-262,61,3.3],[-238,60,2.9]]){ const b = put('boat', x, z, ry, { y:-0.25 }); W.bob.push(b); colliders.push({ x, z, r:2.2 }); }
  const tet = []; for (let i=0;i<16;i++) tet.push({ x:-278 + i*2.9, z:76.4 + (i%2)*1.6, y:-0.9 + (i%3)*0.35, ry:i*1.3, s:1.3 }); instanced('tetrapod', tet);
  put('fishrack', -210, 84, 0.3, { box:[3.1, 1.1] }); put('fishrack', -205, 86.5, 0.2, { box:[3.1, 1.1] }); putCar(-217, 66, 1.9); putMoped(-208, 61.5, 0.4);
  put('statue', -214, 62, 1.5, { r:0.8 }); put('statue', -212, 80, 1.9, { r:0.8, s:0.8 }); put('bench', -224, 80, -Math.PI/2); put('vending', -220, 60, 0, { box:[1.1,0.9] });
  // ---- 浜 ----
  W.surf = put('surfboard', 83.5, 39.2, 0.8); W.surf.rotation.z = 0.25; put('bench', 68, 26, -Math.PI/2); putBike(67, 40, 2, { dy:0.02 });
  // ---- 展望台・神社・温泉 ----
  put('lookout', -34, -64, 0, { y:32 }); PLATFORMS.push({ x:-34, z:-64, w:5.4, d:5.4, top:32.35 }); put('statue', -25, -57, -0.6, { r:0.8, s:0.9 });
  put('lookout', -190, 250, 0, { y:37 }); PLATFORMS.push({ x:-190, z:250, w:5.4, d:5.4, top:37.35 }); put('statue', -182, 244, 2.2, { r:0.8 }); put('statue', -180, 256, 1.2, { r:0.8, s:0.8 });   // 石山の展望台（南の台地）
  for (const [lx, lz] of [[-34, -64], [-190, 250]]){
    for (const dx of [-2.3, 2.3]) for (const dz of [-2.3, 2.3]) colliders.push({ x:lx + dx, z:lz + dz, r:0.18 });
    colliders.push({ x:lx, z:lz - 2.3, w:4.6, d:0.18, h:1.05 }, { x:lx - 2.3, z:lz, w:0.18, d:4.6, h:1.05 }, { x:lx + 2.3, z:lz, w:0.18, d:4.6, h:1.05 });
  }
  put('torii', -84, -24, 0); colliders.push({ x:-82.1, z:-24, r:0.3 }, { x:-85.9, z:-24, r:0.3 });
  put('shrine', -84, -54, 0, { y:15, box:[4.8,4.8] });
  put('onsen', -182, 30, -Math.PI/2, { y:2.2 }); PLATFORMS.push({ x:-182, z:30, r:7.4, top:2.62 });
  // 石柱の湯の縁（10角形・ジャンプで越えられる）と7本の石柱の当たり判定
  for (let j = 0; j < 10; j++){ const a = j*Math.PI*2/10; colliders.push({ x:-182 + Math.sin(a)*4.2, z:30 + Math.cos(a)*4.2, w:2.85, d:0.7, rot:a, h:0.52 }); }
  for (const [bx, by] of [[-5.6, 3], [-5.6, 0], [-5.6, -3], [-2.8, 5.4], [0, 5.4], [2.8, 5.4], [5.6, 3]]) colliders.push({ x:-182 + by, z:30 + bx, r:0.48 });
  // 石柱の湯の湯気
  const steam = (() => {
    const N = 28, cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.5, 'rgba(245,250,255,0.35)'); gr.addColorStop(1, 'rgba(240,248,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const pos = new Float32Array(N*3), col = new Float32Array(N*3), seed = [];
    for (let i = 0; i < N; i++){ const a = i*2.39996, r = 0.5 + ((i*7) % 11)/11*2.7; seed.push({ bx:-182 + Math.cos(a)*r, bz:30 + Math.sin(a)*r, ph:(i/N), sp:0.22 + (i % 5)*0.03 }); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ map:new THREE.CanvasTexture(cv), size:2.4, sizeAttenuation:true, transparent:true, opacity:0.32, vertexColors:true, depthWrite:false });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    return { geo, mat, seed, pos, col };
  })();

  // ---- 空港（島の真ん中の平地）----
  { const A = AIRPORT, cv = document.createElement('canvas'); cv.width = 2048; cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = '#4a4b4f'; g.fillRect(0, 0, 2048, 128);
    g.fillStyle = '#e8e6dc'; g.fillRect(0, 6, 2048, 4); g.fillRect(0, 118, 2048, 4); for (let x = 150; x < 1900; x += 90) g.fillRect(x, 61, 46, 6); for (const x0 of [30, 1950]) for (let i = 0; i < 6; i++) g.fillRect(x0, 20 + i*16, 70, 8);
    const rt = new THREE.CanvasTexture(cv); rt.colorSpace = THREE.SRGBColorSpace; const po = { polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3 };
    const run = new THREE.Mesh(new THREE.PlaneGeometry(A.w - 8, 9).rotateX(-Math.PI/2), new THREE.MeshLambertMaterial({ map:rt, ...po })); run.position.set(A.x, A.h + 0.1, A.rz); scene.add(run);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(52, 10).rotateX(-Math.PI/2), new THREE.MeshLambertMaterial({ map:tex('concrete'), ...po })); apron.position.set(14, A.h + 0.09, 105.5); scene.add(apron);
    const term = put('terminal', 16, 96, 0, { y:A.h, box:[18, 8] }); term.traverse(o => { if (o.isMesh && o.material.name === 'airport-sign'){ o.material = o.material.clone(); o.material.map = textTex('白砂空港', { w:512, h:64, font:'bold 48px "Zen Maru Gothic", sans-serif', fg:'#ffffff', bg:'#2f6fb5' }); o.material.color.set(0xffffff); } });
    W.plane = put('plane', 34, 106.5, 1.25, { y:A.h + 0.1, box:[3, 13] }); W.planeHome = { x:34, y:A.h + 0.1, z:106.5, ry:1.25 }; put('windsock', -52, 106, 0, { y:A.h }); put('windsock', 90, 124, 0, { y:A.h });
    put('bench', -1.5, 102, Math.PI/2, { y:A.h }); put('vending', 3.5, 99.4, 0, { y:A.h, box:[1.1, 0.9] }); putCar(-12, 100, 0.3); put('statue', -12, 94, 1.0, { r:0.8 }); }
  // ---- 浜の入口の白い門 ----
  { const ry = 0.896, lx = Math.cos(ry), lz = -Math.sin(ry); put('maingate', 65, 26.4, ry); for (const o of [-6.2, -3.6, 3.6, 6.2]) colliders.push({ x:65 + lx*o, z:26.4 + lz*o, r:0.75 }); }
  // ---- 若浦（北の集落）と、東海岸の道ぞい ----
  put('fishrack', 110, -441, 0.4, { box:[3.1, 1.1] }); put('busstop', 133, -421, 0.3); put('vending', 127, -421.5, 0.3, { box:[1.1, 0.9] }); put('statue', 122, -419, 2.6, { r:0.8 }); put('bench', 108, -449, -Math.PI/2);
  putCar(140, -419.5, 1.3); putBike(125, -419.6, 1.9, { dy:0.02 }); putMoped(131, -414.5, 2.2);
  for (const [x, z, ry] of [[90, -452, 1.2]]){ const b = put('boat', x, z, ry, { y:-0.25 }); W.bob.push(b); colliders.push({ x, z, r:2.2 }); }
  put('bench', 112, -152, Math.PI/2); put('statue', 100, -96, 1.6, { r:0.8, s:0.9 }); put('statue', 232, -292, 0.9, { r:0.8 });

  // ---- 木・茂み・電柱（自動配置） ----
  const trees = { 'tree-round':gardenTrees, 'tree-pine':[], 'tree-palm':[] }, bushes = [];
  const inZone = (x, z) => { for (const k in ZONES){ if (k === 'village') continue; const [zx,zz,r] = ZONES[k]; if (Math.hypot(x-zx, z-zz) < r*0.66) return true; } return false; };
  let nTree = 0;
  const onRunway = (x, z, m) => Math.abs(x - AIRPORT.x) < AIRPORT.w/2 + m && Math.abs(z - AIRPORT.z) < AIRPORT.d/2 + m;
  for (let i=0;i<5000 && nTree < 330;i++){
    const x = -300 + R()*630, z = -620 + R()*1140, h = heightAt(x, z); if (h < 2.8 || h > 74 || onRunway(x, z, 8)) continue;
    if (inZone(x, z) || roadDist(x, z) < 6.5) continue;
    if (inVillage(x, z) && (!lotFree(x, z, 2.5) || R() < 0.6)) continue;
    const slope = Math.abs(heightAt(x+2, z)-h) + Math.abs(heightAt(x, z+2)-h); if (slope > 4.2) continue;
    const t = (h < 7 && R() < 0.7) || R() < 0.2 ? 'tree-pine' : 'tree-round';
    trees[t].push({ x, z, ry:R()*6.28, s:0.8 + R()*0.7 }); colliders.push({ x, z, r:0.45 }); nTree++;
  }
  for (const [x,z] of [[52,42],[62,25],[72,44],[60,46],[-204,82],[-218,86],[-194,64],[-172,20],[-190,18],[-168,38],[70,20],[-230,84],[96,-448],[150,-405]]){ trees['tree-palm'].push({ x, z, ry:R()*6.28, s:0.9+R()*0.4 }); colliders.push({ x, z, r:0.4 }); }
  for (let i=0;i<2400 && bushes.length < 170;i++){ const x = -300 + R()*630, z = -620 + R()*1140, h = heightAt(x, z); if (h < 2.9 || onRunway(x, z, 4) || inZone(x,z) || roadDist(x,z) < 3.6 || (inVillage(x, z) && !lotFree(x, z, 1.5))) continue; bushes.push({ x, z, ry:R()*6.28, s:0.6+R()*0.8 }); }
  for (const k in trees) instanced(k, trees[k], k === 'tree-palm' ? 0.0025 : 0.0016); instanced('bush', bushes, 0.03);
  // 草むら：風になびく草の株を、道や家から離れた草地に、かたまりで散らす
  { const grass = []; for (let i = 0; i < 12000 && grass.length < 22000; i++){ const cx = -300 + R()*630, cz = -620 + R()*1140, h0 = heightAt(cx, cz);
      if (h0 < 2.9 || onRunway(cx, cz, 5) || inZone(cx, cz) || roadDist(cx, cz) < 2.6 || (inVillage(cx, cz) && !lotFree(cx, cz, 1.2))) continue;
      const n = 6 + Math.floor(R()*9); for (let j = 0; j < n; j++){ const x = cx + (R() - 0.5)*4.5, z = cz + (R() - 0.5)*4.5; if (heightAt(x, z) < 2.9 || roadDist(x, z) < 2.4) continue; grass.push({ x, z, ry:R()*6.28, s:1.0 + R()*0.9 }); } }
    // 40m 四方の区画ごとに分けて、近くの区画だけ描く（島じゅうを毎回描くと重い）
    const cells = {}; for (const g of grass){ const k = Math.floor(g.x/40) + ',' + Math.floor(g.z/40); (cells[k] = cells[k] || []).push(g); }
    const src = model('grass-tuft'); src.updateMatrixWorld(true); W.grassCells = [];
    for (const k in cells){ const list = cells[k], grp = new THREE.Group(); let cx = 0, cz = 0;
      src.traverse(o => { if (!o.isMesh) return; const im = new THREE.InstancedMesh(o.geometry, sway(o.material, 0.28), list.length);
        list.forEach((t, i) => { P.set(t.x, heightAt(t.x, t.z) - 0.03, t.z); Q.setFromAxisAngle(UP, t.ry); S.setScalar(t.s); M.compose(P, Q, S).multiply(o.matrixWorld); im.setMatrixAt(i, M); });
        im.computeBoundingSphere(); grp.add(im); });
      for (const t of list){ cx += t.x; cz += t.z; } grp.userData.c = [cx/list.length, cz/list.length]; scene.add(grp); W.grassCells.push(grp); }
    W.grass = grass.length; }
  W.allTrees = [...trees['tree-round'], ...trees['tree-pine'], ...trees['tree-palm']];   // 地図に描く用
  W.trees = trees['tree-round'].filter(t => t.s >= 0.8).sort((a, b) => Math.hypot(a.x + 40, a.z - 20) - Math.hypot(b.x + 40, b.z - 20)).slice(0, 12);
  // 電柱と電線：幹線と路地に沿って約30mおき
  const poles = [], wire = [];
  ROADS.forEach((road, ri) => { if (road.kind === 'path' || road.id === 'beach' && false) return; const hw = ROAD_W[road.kind], side = ri % 2 ? 1 : -1; let next = 8, prev = null;
    for (const p of ROAD_PTS) { if (p[4] !== ri || p[5] < next) continue; const x = p[0] + p[2]*side*(hw + 0.75), z = p[1] + p[3]*side*(hw + 0.75), y = heightAt(x, z);
      if (y < 1.5 || Math.hypot(x - 65, z - 26.4) < 13 || roadDist(x, z, ri) < 3.4 || !lotFree(x, z, 0.2) || lots.some(l => Math.hypot(l.x + Math.sin(l.ry)*(DEPTH[l.type]/2 + 1.5) - x, l.z + Math.cos(l.ry)*(DEPTH[l.type]/2 + 1.5) - z) < 2.2)){ next = p[5] + 4; continue; }
      next = p[5] + 30; const ry = Math.atan2(p[2], p[3]) + Math.PI/2; poles.push({ x, z, ry }); colliders.push({ x, z, r:0.2 }); const top = [x, y + 7.85, z];
      if (prev && Math.hypot(top[0]-prev[0], top[2]-prev[2]) < 60) for (const o of [-0.9, 0.9]){ const N = 6; for (let k=0;k<N;k++){ const a = k/N, b = (k+1)/N, sag = t => -Math.sin(t*Math.PI)*0.9;
        wire.push(prev[0]+(top[0]-prev[0])*a + p[2]*o, prev[1]+(top[1]-prev[1])*a+sag(a), prev[2]+(top[2]-prev[2])*a + p[3]*o, prev[0]+(top[0]-prev[0])*b + p[2]*o, prev[1]+(top[1]-prev[1])*b+sag(b), prev[2]+(top[2]-prev[2])*b + p[3]*o); } }
      prev = top; } });
  instanced('pole', poles);
  // 街灯：夜だけ見える灯りと、道に落ちる光の輪
  { const lamps = poles.filter((p, i) => i % 2 === 0); const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,220,150,1)'); gr.addColorStop(0.4, 'rgba(255,200,120,0.45)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const glow = new THREE.CanvasTexture(cv); const pm = new THREE.MeshBasicMaterial({ map:glow, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0, fog:false, polygonOffset:true, polygonOffsetFactor:-8, polygonOffsetUnits:-8 });
    const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI/2), pm, lamps.length); const pos = [];
    lamps.forEach((l, i) => { const y = heightAt(l.x, l.z); P.set(l.x, y + 0.3, l.z); Q.identity(); S.setScalar(1); M.compose(P, Q, S); pool.setMatrixAt(i, M); pos.push(l.x, y + 6.4, l.z); });
    pool.frustumCulled = false; pool.renderOrder = 5; scene.add(pool);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const bm = new THREE.PointsMaterial({ map:glow, size:22, sizeAttenuation:false, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0, fog:false });
    const bulbs = new THREE.Points(bg, bm); bulbs.frustumCulled = false; scene.add(bulbs);
    W.setNight = k => { pm.opacity = k*0.55; bm.opacity = k; pool.visible = bulbs.visible = k > 0.01;
      if (lhLampMat) lhLampMat.emissiveIntensity = k*1.1 + 0.25;
      lhGlow.pt.material.opacity = k*0.9; lhGlow.pt.visible = k > 0.04;
      lhGlow.bm.opacity = k*0.24; lhGlow.grp.visible = k > 0.05; }; }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3)); scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color:0x1c1c22 })));
  // 集落の外の道：谷側にガードレール、平らな空き地に畑。道ぞいに「次の目印」が途切れないようにする
  { const rails = [], fields = [];
    ROADS.forEach((road, ri) => { if (road.kind !== 'main') return; const hw = ROAD_W.main;
      for (const p of ROAD_PTS){ if (p[4] !== ri || inVillage(p[0], p[1])) continue; const hL = heightAt(p[0] - p[2]*7, p[1] - p[3]*7), hR = heightAt(p[0] + p[2]*7, p[1] + p[3]*7), h0 = heightAt(p[0], p[1]); const side = hL < hR ? -1 : 1;
        if (Math.min(hL, hR) > h0 - 0.35 || h0 < 2.2) continue; const x = p[0] + p[2]*side*(hw + 0.7), z = p[1] + p[3]*side*(hw + 0.7); if (roadDist(x, z, ri) < 4 || inZone(x, z) && Math.hypot(x - 30, z + 45) < 40) continue;
        rails.push({ x, z, ry: Math.atan2(p[2], p[3]) + (side > 0 ? Math.PI : 0), y: heightAt(x, z) + 0.05 }); } });
    instanced('guardrail', rails);
    for (let i = 0; i < 6000 && fields.length < 24; i++){ const x = -150 + R()*250, z = 50 + R()*130, h = heightAt(x, z); if (h < 3.2 || inVillage(x, z) || inZone(x, z) || onRunway(x, z, 10)) continue; const d = roadDist(x, z); if (d < 9 || d > 44) continue;
      if (Math.abs(heightAt(x + 5, z) - h) + Math.abs(heightAt(x, z + 4) - h) + Math.abs(heightAt(x - 5, z) - h) > 0.9) continue; if (fields.some(f => Math.hypot(f.x - x, f.z - z) < 14) || Object.values(trees).some(a => a.some(t => Math.hypot(t.x - x, t.z - z) < 7.5))) continue;
      fields.push({ x, z, ry: Math.round(R()*3)*Math.PI/2 + (R() - 0.5)*0.3 }); }
    instanced('field', fields); W.fields = fields; }
  // 貝がら
  const shellSpots = []; for (let i=0;i<4000 && shellSpots.length < 14;i++){ const x = -300 + R()*630, z = -620 + R()*1140, h = heightAt(x, z); if (h > 0.5 && h < 1.6 && shellSpots.every(s => Math.hypot(s[0]-x, s[1]-z) > 30)) shellSpots.push([x, z]); }
  shellSpots.forEach(([x, z], i) => { const m = put('shell', x, z, R()*6, { s:1.6, dy:0.02 }); W.shells.push({ id:i, x, z, mesh:m }); });
  // ---- 沖の小島（既存の R() の種に影響しないよう固定配置）----
  put('statue', -416, 64, Math.PI/2, { r:0.8, s:0.9 });
  put('bench', -391, 65.5, -Math.PI/2);
  for (const [kind, x, z, ry, s] of [['tree-palm', -393, 56, 0.5, 1.05], ['tree-palm', -396, 76, 2.2, 0.95], ['tree-pine', -410, 48, 1.1, 1.1], ['tree-pine', -428, 72, 3.8, 1.15], ['tree-round', -414, 82, 0.9, 1.05], ['tree-round', -424, 52, 2.7, 1.0]]){
    put(kind, x, z, ry, { s, r:0.42 }); W.allTrees.push({ x, z, s });
  }
  W.update = (time) => {
    W.bob.forEach((b, i) => { b.position.y = -0.25 + Math.sin(time*0.9 + i*2)*0.08; b.rotation.z = Math.sin(time*0.7 + i)*0.03; });
    if (lhGlow.grp.visible) lhGlow.grp.rotation.y = time*0.85;
    const cool = (G.state.hour < 8.5 || G.state.hour > 17.0 || (G.weatherNow && G.weatherNow.rain > 0.15)) ? 1 : 0.65;
    steam.mat.opacity = 0.28*cool;
    for (let i = 0; i < steam.seed.length; i++){ const s = steam.seed[i], p = (time*s.sp + s.ph) % 1;
      steam.pos[i*3] = s.bx + Math.sin(time*0.8 + i)*0.22; steam.pos[i*3 + 1] = 2.75 + p*1.45; steam.pos[i*3 + 2] = s.bz + Math.cos(time*0.7 + i)*0.22;
      const a = Math.sin(p*Math.PI); steam.col[i*3] = a; steam.col[i*3 + 1] = a; steam.col[i*3 + 2] = a; }
    steam.geo.attributes.position.needsUpdate = true; steam.geo.attributes.color.needsUpdate = true;
  };
  return W;
}
