// ミニマップ（画面左下）と、島全体の地図（Mキー）。
// 地形・道・建物は最初に1回だけ絵にして、あとはその上に自分と友達の印を重ねる。
import { heightAt, ROADS, ROAD_W, ROAD_PTS, PLATFORMS } from './world/terrain.js';
import { HOME, SPOTS } from './world/places.js';
import { NAMES } from '../data/story.js';
import { keys } from './player.js';
import { LAYOUT as SL } from '../data/school-layout.js';
import { floorIndex } from './school.js';

const X0 = -470, Z0 = -640, MW = 800, MD = 1180, K = 2;       // 地図にする範囲（m）と、下絵の細かさ（px/m）
const FONT = '"Zen Maru Gothic","Hiragino Maru Gothic ProN",sans-serif';
// 目印。[x, z, 丸の中の字, 名前, 色, 名前を出す側]
const MARKS = [
  [30, -57, '学', '都立白砂高校', '#e2574c', 'r'], [HOME.x, HOME.z, '家', '自宅', '#f0a030', 't'], [-84, 66, '店', 'しおかぜ商店', '#d9739a', 'b'],
  [SPOTS.pier.x, SPOTS.pier.z, '港', '白砂港', '#3f7fd0', 'b'], [SPOTS.beach.x, SPOTS.beach.z, '浜', SPOTS.beach.name, '#2aa7a0', 'r'],
  [SPOTS.lookout.x, SPOTS.lookout.z, '展', SPOTS.lookout.name, '#7c8a3c', 'r'], [-190, 250, '石', '石山の展望台', '#7c8a3c', 'r'], [14, 100, '空', '白砂空港', '#5b7fa8', 'r'], [135, -430, '若', '若浦の集落', '#b07a3a', 'r'], [-416, 64, '島', '沖の小島', '#4f9da6', 'r'], [SPOTS.shrine.x, SPOTS.shrine.z, '社', SPOTS.shrine.name, '#c0453a', 't'], [SPOTS.onsen.x, SPOTS.onsen.z, '湯', SPOTS.onsen.name, '#8a62c8', 't'],
];
const FRIEND = { nagisa:['#ff8552', 'な'], kouta:['#3d9bf0', '航'], kotoha:['#a67cf0', 'こ'], granny:['#8d8372', 'ば'], oneesan:['#4f5f86', '姉'] };   // お姉さんは、会ったあとで、姿が見えているときだけ地図に出る

function buildBase(G){
  const W = G.world, cv = document.createElement('canvas'); cv.width = MW*K; cv.height = MD*K; const g = cv.getContext('2d');
  // 地形：1mごとに高さを調べて色をつける
  const t = document.createElement('canvas'); t.width = MW; t.height = MD; const tg = t.getContext('2d'), im = tg.createImageData(MW, MD), d = im.data;
  const hs = new Float32Array(MW*MD); for (let z = 0; z < MD; z++) for (let x = 0; x < MW; x++) hs[z*MW + x] = heightAt(X0 + x + 0.5, Z0 + z + 0.5);
  const mix = (a, b, k) => [a[0] + (b[0]-a[0])*k, a[1] + (b[1]-a[1])*k, a[2] + (b[2]-a[2])*k], cl = v => Math.max(0, Math.min(1, v));
  for (let z = 0; z < MD; z++) for (let x = 0; x < MW; x++){ const i = z*MW + x, h = hs[i]; let c;
    if (h < 0) c = mix([172, 214, 224], [112, 168, 198], cl(-h/9));
    else { c = h < 1.7 ? mix([240, 232, 200], [226, 226, 180], cl(h/1.7)) : h < 30 ? mix([190, 216, 156], [142, 186, 124], cl((h - 1.7)/28)) : mix([142, 186, 124], [176, 166, 140], cl((h - 30)/30));
      const sh = cl(0.5 + ((hs[i - 1] ?? h) - (hs[i + 1] ?? h))*0.09 + ((hs[i - MW] ?? h) - (hs[i + MW] ?? h))*0.09) - 0.5; c = [c[0] + sh*46, c[1] + sh*46, c[2] + sh*40];   // 北西から光を当てた陰影
      if (hs[i - 1] < 0 || hs[i + 1] < 0 || hs[i - MW] < 0 || hs[i + MW] < 0) c = [150, 140, 108]; }                                                                     // 海岸線
    d[i*4] = c[0]; d[i*4 + 1] = c[1]; d[i*4 + 2] = c[2]; d[i*4 + 3] = 255; }
  tg.putImageData(im, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(t, 0, 0, cv.width, cv.height);
  g.setTransform(K, 0, 0, K, -X0*K, -Z0*K);   // ここからは世界の座標（m）でそのまま描ける
  // 木
  g.fillStyle = 'rgba(86,140,84,.55)'; for (const tr of W.allTrees || []){ g.beginPath(); g.arc(tr.x, tr.z, 1.6*(tr.s || 1), 0, 7); g.fill(); }
  // 桟橋や台
  g.fillStyle = '#d9cfb6'; g.strokeStyle = '#8f8468'; g.lineWidth = 0.3;
  for (const p of PLATFORMS){ g.beginPath(); if (p.r) g.arc(p.x, p.z, p.r, 0, 7); else g.rect(p.x - p.w/2, p.z - p.d/2, p.w, p.d); g.fill(); g.stroke(); }
  // 道：ふちを先に、その上に路面
  g.lineJoin = g.lineCap = 'round';
  for (const pass of [0, 1]) ROADS.forEach((road, ri) => { const hw = ROAD_W[road.kind]; g.beginPath(); let first = true;
    for (const p of ROAD_PTS){ if (p[4] !== ri) continue; first ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1]); first = false; }
    g.strokeStyle = pass ? (road.kind === 'path' ? '#efe2c0' : '#fffaf0') : '#8c7f66'; g.lineWidth = pass ? hw*2 : hw*2 + 1.3; g.stroke(); });
  // 建物（当たり判定の箱のうち、塀と車を除いた大きいもの）
  const cars = new Set((W.cars || []).map(c => c.col)); g.fillStyle = '#c98a66'; g.strokeStyle = '#6f4a36'; g.lineWidth = 0.45;
  for (const c of G.colliders){ if (c.r || c.h || cars.has(c) || Math.min(c.w, c.d) < 2.4) continue; g.save(); g.translate(c.x, c.z); g.rotate(-(c.rot || 0)); g.beginPath(); g.rect(-c.w/2, -c.d/2, c.w, c.d); g.fill(); g.stroke(); g.restore(); }
  return cv;
}

export function setupMap(G){
  const P = G.player, W = G.world, base = buildBase(G);
  const mini = document.getElementById('minimap'), full = document.getElementById('mapcv'), box = document.getElementById('map');
  const mg = mini.getContext('2d'), fg = full.getContext('2d');
  document.getElementById('maplegend').innerHTML = Object.keys(FRIEND).map(id => `<li><i style="background:${FRIEND[id][0]}">${FRIEND[id][1]}</i>${NAMES[id]}</li>`).join('')
    + '<li><i class="me"></i>自分</li><li><i class="car"></i>軽トラ</li><li><i class="bike"></i>自転車</li>';
  const fit = (cv) => { const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(cv.clientWidth*dpr), h = Math.round(cv.clientHeight*dpr); if (w && h && (cv.width !== w || cv.height !== h)){ cv.width = w; cv.height = h; } return dpr; };
  const badge = (g, x, y, r, col, ch, a=1) => { g.globalAlpha = a; g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = r*0.22; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.font = `700 ${r*1.15}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, y + r*0.06); g.globalAlpha = 1; };
  const arrow = (g, x, y, s) => { g.save(); g.translate(x, y); g.rotate(Math.PI - P.yaw); g.beginPath(); g.moveTo(0, -s); g.lineTo(s*0.72, s*0.8); g.lineTo(0, s*0.38); g.lineTo(-s*0.72, s*0.8); g.closePath();
    g.fillStyle = '#ffd84a'; g.strokeStyle = '#3a2c10'; g.lineWidth = s*0.2; g.lineJoin = 'round'; g.stroke(); g.fill(); g.restore(); };
  const vehicle = (g, x, y, s, car) => { g.fillStyle = car ? '#fff' : '#52e0d0'; g.strokeStyle = '#27323c'; g.lineWidth = s*0.28; g.beginPath(); if (car) g.rect(x - s, y - s*0.7, s*2, s*1.4); else { g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y); g.closePath(); } g.fill(); g.stroke(); };
  const friends = () => Object.keys(FRIEND).filter(id => G.npcs[id] && (G.npcs[id].spot || G.npcs[id].following) && (id !== 'oneesan' || (G.state.flags.metOneesan && !G.npcs[id].spot.hide))).map(id => ({ id, x:G.npcs[id].pos.x, z:G.npcs[id].pos.z }));
  const vehicles = () => [...(W.cars || []).filter(c => c !== P.driving).map(c => [c.mesh.position, true]), ...(W.bikes || []).filter(b => b !== P.riding).map(b => [b.mesh.position, false])];

  // いま行くべき場所（初日、なぎさに会うまでは学校）。地図とミニマップで、輪を広げて知らせる
  const goal = () => !G.state.flags.metNagisa && G.mode === 'play' ? [34, -52.6] : null;
  // 控えめに：細い線で、ゆっくり一重に広がるだけ
  const ping = (g, x, y, r, dpr) => { const k = (G.realTime || 0) % 2.4/2.4; g.beginPath(); g.arc(x, y, r*(0.9 + k*0.8), 0, 7); g.strokeStyle = `rgba(230,110,80,${0.55*(1 - k)})`; g.lineWidth = 1.5*dpr; g.stroke(); };
  // ミニマップのふちの時計：一周が一日（真上が正午、真下が真夜中）。空の色の帯の上を、太陽か月が回る。だいたいの時間が分かればよい
  const SKYCOL = h => h < 4.8 || h >= 19.6 ? '#25314b' : h < 6.3 ? '#e7a067' : h < 16.4 ? '#8fcbe8' : h < 18.2 ? '#f2b45c' : '#e0735a';
  function timeRing(g, R, r0, r1, dpr){ const th = h => -Math.PI/2 + (h - 12)/24*Math.PI*2, rm = (r0 + r1)/2;
    for (let h = 0; h < 24; h += 0.25){ g.beginPath(); g.arc(R, R, rm, th(h), th(h + 0.27)); g.strokeStyle = SKYCOL(h); g.lineWidth = r1 - r0; g.stroke(); }
    g.beginPath(); g.arc(R, R, r1, 0, 7); g.lineWidth = 1.2*dpr; g.strokeStyle = 'rgba(40,30,20,.55)'; g.stroke();
    for (const h of [0, 6, 12, 18]){ const a = th(h); g.beginPath(); g.moveTo(R + Math.cos(a)*r0, R + Math.sin(a)*r0); g.lineTo(R + Math.cos(a)*(r0 + 3*dpr), R + Math.sin(a)*(r0 + 3*dpr)); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.5*dpr; g.stroke(); }
    const hour = G.state.hour, a = th(hour), x = R + Math.cos(a)*rm, y = R + Math.sin(a)*rm, s = (r1 - r0)*0.75, night = hour < 5 || hour >= 19.3;
    if (night){ g.beginPath(); g.arc(x, y, s, 0, 7); g.fillStyle = '#f6f0c8'; g.fill(); g.beginPath(); g.arc(x + s*0.45, y - s*0.3, s*0.85, 0, 7); g.fillStyle = SKYCOL(hour); g.fill(); }
    else { g.save(); g.translate(x, y); g.strokeStyle = '#e8902a'; g.lineWidth = 1.5*dpr; for (let i = 0; i < 8; i++){ const b = i/8*Math.PI*2; g.beginPath(); g.moveTo(Math.cos(b)*s*0.95, Math.sin(b)*s*0.95); g.lineTo(Math.cos(b)*s*1.35, Math.sin(b)*s*1.35); g.stroke(); }
      g.beginPath(); g.arc(0, 0, s*0.8, 0, 7); g.fillStyle = '#ffd84a'; g.fill(); g.lineWidth = 1.2*dpr; g.strokeStyle = '#b8681a'; g.stroke(); g.restore(); } }
  // ---- 校舎の中の間取り図（いる階だけ）。at(x,z) は画面の位置、s は1mあたりの画素 ----
  const ROOMCOL = { class:'#f3e6c4', ours:'#f6d58a', staff:'#dfe7ee', entrance:'#e6e1d6', health:'#e9f2ea', library:'#eadfcf', music:'#efe0ef', art:'#f2e3d6', empty:'#ece8de' };
  function drawPlan(g, at, s, dpr, fl, labels){ const y = SL.F[fl];
    g.fillStyle = '#4a5560'; g.fillRect(-9999, -9999, 99999, 99999);
    const rect = (x0, z0, x1, z1, col) => { const [a, b] = at(x0, z0), [c, d] = at(x1, z1); g.fillStyle = col; g.fillRect(a, b, c - a, d - b); };
    for (const f of SL.floors){ const lo = Math.min(f.h, f.h1), hi = Math.max(f.h, f.h1); if (hi < y - 0.1 || lo > y + 0.1 && !(f.h !== f.h1 && lo < y + 3.7)) continue;
      rect(f.x0, f.z0, f.x1, f.z1, f.h !== f.h1 ? '#c9b48c' : '#e8e3d6');
      if (f.h !== f.h1){ g.strokeStyle = 'rgba(90,70,40,.45)'; g.lineWidth = 1*dpr; for (let x = f.x0; x <= f.x1; x += 0.8){ const [a, b] = at(x, f.z0), [, d] = at(x, f.z1); g.beginPath(); g.moveTo(a, b); g.lineTo(a, d); g.stroke(); } } }
    for (const r of SL.rooms) if (r.floor === fl) rect(r.x0, r.z0, r.x1, r.z1, ROOMCOL[r.kind] || '#ece8de');
    for (const w of SL.walls){ if (w.y1 < y + 0.5 || w.y0 > y + 0.5) continue; const [a, b] = at(w.x0, w.z0), [c, d] = at(w.x1, w.z1);
      g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.strokeStyle = w.kind === 'rail' ? '#8a8f94' : '#3a342c'; g.lineWidth = (w.kind === 'shell' ? 3 : w.kind === 'rail' ? 1.2 : 2)*dpr; g.stroke(); }
    if (labels){ g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const r of SL.rooms){ if (r.floor !== fl) continue; const [x, yy] = at((r.x0 + r.x1)/2, (r.z0 + r.z1)/2); g.font = `700 ${Math.max(9, Math.min(15, s*1.3))*dpr/ (labels === 'mini' ? 1.3 : 1)}px ${FONT}`; g.fillStyle = '#4a3b2a'; g.fillText(r.name.replace('（自分の教室）', ''), x, yy); }
      const [sx, sy] = at(15.5, -61); g.fillStyle = '#6a5a40'; g.font = `700 ${12*dpr}px ${FONT}`; g.fillText('階段', sx, sy); } }
  // ---- ミニマップ：北が上。自分が中心 ----
  // miniZoom は ＋／− キーで変える（大きいほど寄る）
  let range = 85, miniZoom = 1;
  function drawMini(dt){ const dpr = fit(mini), w = mini.width, R = w/2; if (!w) return;
    range += ((P.driving ? 150 : P.riding ? 115 : 85)/miniZoom - range)*Math.min(1, dt*4); const s = R/range;   // 乗り物では広い範囲を映す
    const RW = 11*dpr, MR = R - RW - 2*dpr;   // 外側の輪は時計。地図はその内側
    mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, w, w); mg.save(); mg.beginPath(); mg.arc(R, R, MR, 0, 7); mg.clip();
    mg.fillStyle = '#70a8c6'; mg.fillRect(0, 0, w, w);
    const at = (x, z) => [R + (x - P.pos.x)*s, R + (z - P.pos.z)*s];
    if (G.inSchool){ const sp = R/22; const at2 = (x, z) => [R + (x - P.pos.x)*sp, R + (z - P.pos.z)*sp]; drawPlan(mg, at2, sp, dpr, floorIndex(P.pos.y), 'mini'); arrow(mg, R, R, 9*dpr); mg.restore(); drawRing(); return; }
    mg.drawImage(base, (P.pos.x - range - X0)*K, (P.pos.z - range - Z0)*K, range*2*K, range*2*K, 0, 0, w, w);
    const rim = (x, y, pad) => { const dx = x - R, dy = y - R, d = Math.hypot(dx, dy), m = MR - pad; return d > m ? [R + dx/d*m, R + dy/d*m, true] : [x, y, false]; };
    for (const [pos, car] of vehicles()){ const [x, y] = at(pos.x, pos.z); if (Math.hypot(x - R, y - R) < MR) vehicle(mg, x, y, 4.2*dpr, car); }
    for (const m of MARKS){ const [x, y, out] = rim(...at(m[0], m[1]), 12*dpr); badge(mg, x, y, (out ? 7.5 : 9.5)*dpr, m[4], m[2], out ? 0.8 : 1); }   // 遠い目印は、ふちにその方角で出す
    for (const f of friends()){ if (Math.hypot(f.x - P.pos.x, f.z - P.pos.z) < 3) continue; const [x, y, out] = rim(...at(f.x, f.z), 12*dpr); badge(mg, x, y, (out ? 6.5 : 8.5)*dpr, FRIEND[f.id][0], FRIEND[f.id][1], out ? 0.85 : 1); }
    { const gl = goal(); if (gl){ const [x, y] = rim(...at(gl[0], gl[1]), 14*dpr); ping(mg, x, y, 9*dpr, dpr); } }
    arrow(mg, R, R, 9*dpr); mg.restore();
    drawRing();
    function drawRing(){ mg.beginPath(); mg.arc(R, R, MR, 0, 7); mg.lineWidth = 2.5*dpr; mg.strokeStyle = 'rgba(255,255,255,.9)'; mg.stroke(); timeRing(mg, R, MR + 1.5*dpr, R - 1*dpr, dpr); }
    mg.fillStyle = '#fff'; mg.strokeStyle = 'rgba(20,40,70,.9)'; mg.lineWidth = 3*dpr; mg.font = `700 ${12*dpr}px ${FONT}`; mg.textAlign = 'center'; mg.textBaseline = 'top'; mg.strokeText('北', R, R - MR + 3*dpr); mg.fillText('北', R, R - MR + 3*dpr); }

  // ---- 全体の地図 ----
  // view：地図の中心（世界の座標）と倍率。ホイール・ドラッグ・＋／−・WASD で動かす
  const view = { cx:X0 + MW/2, cz:Z0 + MD/2, zoom:1 };
  const clampView = () => { view.zoom = Math.max(1, Math.min(6, view.zoom)); const vw = MW/view.zoom/2, vh = MD/view.zoom/2;
    view.cx = Math.max(X0 + vw, Math.min(X0 + MW - vw, view.cx)); view.cz = Math.max(Z0 + vh, Math.min(Z0 + MD - vh, view.cz)); };
  // 画面上の点 (fx,fy は 0〜1) を動かさずに倍率を変える
  const zoomAt = (k, fx=0.5, fy=0.5) => { const vw = MW/view.zoom, vh = MD/view.zoom, wx = view.cx - vw/2 + fx*vw, wz = view.cz - vh/2 + fy*vh;
    view.zoom *= k; clampView(); const nw = MW/view.zoom, nh = MD/view.zoom; view.cx = wx - fx*nw + nw/2; view.cz = wz - fy*nh + nh/2; clampView(); };
  function drawFull(){ const dpr = fit(full), w = full.width, h = full.height; if (!w) return; clampView();
    if (G.inSchool){   // 校舎の中では、3つの階の間取り図を縦に並べ、いる階を明るくする
      const fl = floorIndex(P.pos.y), s2 = w/48, rowH = h/3, cz = (SL.ZN + SL.ZS)/2 - 0.8;
      fg.setTransform(1, 0, 0, 1, 0, 0); fg.fillStyle = '#4a5560'; fg.fillRect(0, 0, w, h);
      for (let i = 0; i < 3; i++){ const row = 2 - i, oy = row*rowH, at2 = (x, z) => [(x - 30)*s2 + w/2, (z - cz)*s2 + oy + rowH*0.58];
        fg.save(); fg.beginPath(); fg.rect(0, oy, w, rowH); fg.clip(); drawPlan(fg, at2, s2, dpr, i, 'full'); fg.restore();
        if (i !== fl){ fg.fillStyle = 'rgba(40,48,56,.55)'; fg.fillRect(0, oy, w, rowH); }
        fg.fillStyle = i === fl ? '#ffd84a' : '#dfe4ea'; fg.font = `700 ${22*dpr}px ${FONT}`; fg.textAlign = 'left'; fg.textBaseline = 'top'; fg.fillText(`${i + 1}階${i === fl ? '　いまここ' : ''}`, 14*dpr, oy + 10*dpr);
        if (i === fl){ const [px, py] = at2(P.pos.x, P.pos.z); arrow(fg, px, py, 11*dpr); fg.strokeStyle = '#ffd84a'; fg.lineWidth = 3*dpr; fg.strokeRect(2*dpr, oy + 2*dpr, w - 4*dpr, rowH - 4*dpr); } }
      document.getElementById('mapzoom').textContent = ''; return; }
    const vw = MW/view.zoom, vh = MD/view.zoom, x0 = view.cx - vw/2, z0 = view.cz - vh/2, s = w/vw;
    fg.setTransform(1, 0, 0, 1, 0, 0); fg.fillStyle = '#70a8c6'; fg.fillRect(0, 0, w, h); fg.imageSmoothingQuality = 'high'; fg.drawImage(base, (x0 - X0)*K, (z0 - Z0)*K, vw*K, vh*K, 0, 0, w, h);
    const at = (x, z) => [(x - x0)*s, (z - z0)*s];
    const text = (str, x, y, size, col='#2c2a22', align='center') => { fg.font = `700 ${size*dpr}px ${FONT}`; fg.textAlign = align; fg.textBaseline = 'middle'; fg.lineJoin = 'round'; fg.lineWidth = size*dpr*0.32; fg.strokeStyle = 'rgba(255,252,240,.92)'; fg.strokeText(str, x, y); fg.fillStyle = col; fg.fillText(str, x, y); };
    
    for (const [pos, car] of vehicles()){ const [x, y] = at(pos.x, pos.z); vehicle(fg, x, y, 4*dpr, car); }
    const r = 10*dpr;
    for (const m of MARKS){ const [x, y] = at(m[0], m[1]); badge(fg, x, y, r, m[4], m[2]);
      if (m[5] === 'r') text(m[3], x + r*1.4, y, 14, '#2c2a22', 'left'); else text(m[3], x, y + (m[5] === 't' ? -1 : 1)*r*1.9, 14); }
    // 友達。同じ場所に集まっているときは横にずらして並べる
    const placed = MARKS.map(m => at(m[0], m[1]));
    for (const f of friends()){ let [x, y] = at(f.x, f.z); x += r*1.2; y -= r*1.5; while (placed.some(q => Math.hypot(q[0] - x, q[1] - y) < r*1.7)) x += r*1.8; placed.push([x, y]); badge(fg, x, y, r*0.85, FRIEND[f.id][0], FRIEND[f.id][1]); }
    { const gl = goal(); if (gl){ const [x, y] = at(gl[0], gl[1]); ping(fg, x, y, 11*dpr, dpr); } }
    const [px, py] = at(Math.max(x0 + 6/view.zoom, Math.min(x0 + vw - 6/view.zoom, P.pos.x)), Math.max(z0 + 6/view.zoom, Math.min(z0 + vh - 6/view.zoom, P.pos.z))), k = (G.realTime || 0) % 1.4/1.4;
    document.getElementById('mapzoom').textContent = `×${view.zoom.toFixed(1)}`;
    fg.beginPath(); fg.arc(px, py, (8 + k*16)*dpr, 0, 7); fg.strokeStyle = `rgba(255,200,40,${1 - k})`; fg.lineWidth = 2.5*dpr; fg.stroke(); arrow(fg, px, py, 10*dpr); }

  const center = () => { view.cx = P.pos.x; view.cz = P.pos.z; clampView(); };
  const api = { open:false,
    toggle(on = !api.open){ api.open = on; G.mapOpen = on; box.classList.toggle('hidden', !on); if (on){ if (view.zoom > 1) center(); G.hud && G.hud.renderMenu(); drawFull(); } },
    update(dt){ G.realTime = (G.realTime || 0) + dt;
      if (api.open){ const sp = MW/view.zoom*0.7*dt; if (keys.KeyW || keys.ArrowUp) view.cz -= sp; if (keys.KeyS || keys.ArrowDown) view.cz += sp; if (keys.KeyA || keys.ArrowLeft) view.cx -= sp; if (keys.KeyD || keys.ArrowRight) view.cx += sp; drawFull(); }
      else if (G.mode === 'play') drawMini(dt); } };
  // 枠の外をクリックしたら閉じる。地図の上ではドラッグで動かし、ホイールで拡大縮小
  // 閉じるのは ×・M・Esc だけ（地図の上やまわりを押しても閉じない）
  document.getElementById('mapclose').onclick = () => api.toggle(false);
  let drag = null;
  full.addEventListener('pointerdown', e => { drag = { x:e.clientX, y:e.clientY }; full.setPointerCapture(e.pointerId); });
  full.addEventListener('pointermove', e => { if (!drag) return; const r = full.getBoundingClientRect(); view.cx -= (e.clientX - drag.x)/r.width*MW/view.zoom; view.cz -= (e.clientY - drag.y)/r.height*MD/view.zoom; drag = { x:e.clientX, y:e.clientY }; clampView(); });
  for (const ev of ['pointerup', 'pointercancel']) full.addEventListener(ev, () => drag = null);
  full.addEventListener('wheel', e => { e.preventDefault(); const r = full.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.2 : 1/1.2, (e.clientX - r.left)/r.width, (e.clientY - r.top)/r.height); }, { passive:false });
  document.getElementById('mapplus').onclick = () => zoomAt(1.5); document.getElementById('mapminus').onclick = () => zoomAt(1/1.5); document.getElementById('mapme').onclick = () => { if (view.zoom < 2) view.zoom = 2.5; center(); };
  const ZIN = ['Equal', 'NumpadAdd', 'Semicolon'], ZOUT = ['Minus', 'NumpadSubtract'];
  addEventListener('keydown', e => { if (e.repeat || G.mode !== 'play') return; const zin = ZIN.includes(e.code), zout = ZOUT.includes(e.code); if (!zin && !zout) return;
    if (api.open) zoomAt(zin ? 1.5 : 1/1.5); else { miniZoom = Math.max(0.4, Math.min(2.5, miniZoom*(zin ? 1.4 : 1/1.4))); G.api.toast(`ミニマップ ×${miniZoom.toFixed(1)}`, 1200); } });
  api.view = view; api.zoomAt = zoomAt;
  return api;
}
