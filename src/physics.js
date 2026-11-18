// 吹っ飛ばせる物の物理：机・いす・校舎の家具・外の小物（ベンチ、自販機、ポスト、看板…）。
// 歩く・走る・自転車・軽トラが当たると、重さに合わせて押されるか、回りながら飛ぶ。壁ではね返り、地面ではずみ、ほかの物も巻きこむ。
import * as THREE from 'three';
import { audio } from './audio.js';
import { LAYOUT as SL } from '../data/school-layout.js';
const V = () => new THREE.Vector3();
// 校舎（昇降口ポーチ南端 z=-54.6 に余裕 0.2m を足した範囲）と階段東端（斜め床の x1=21）を LAYOUT から導出
const BX0 = SL.X0 - 0.3, BX1 = SL.X1 + 0.3, BZ0 = SL.ZN - 0.3;
const BZ1 = Math.max(...SL.floors.map(f => f.z1)) + 0.2;
const STAIR_X1 = Math.max(...SL.floors.filter(f => f.h !== f.h1).map(f => f.x1));
const inSchoolBox = (x, z) => x > BX0 && x < BX1 && z > BZ0 && z < BZ1;
const floorAt = y => y > SL.F[2] - 0.6 ? 2 : y > SL.F[1] - 0.6 ? 1 : 0;
// 遠景でも目印として残す大型・発光系の小物
const WIDE_CULL = new Set(['vending', 'busstop', 'windsock']);
export function setupPhysics(G){
  const P = G.player, bodies = []; G.bodies = bodies;
  let cullT = 0, lastPx = 1e9, lastPz = 1e9, lastCx = 1e9, lastCy = 1e9, lastCz = 1e9, lastInSchool = null, lastIndoor = null;
  // 遠景の小物を間引き＋ヒステリシス付きで非表示にする（飛んでいる最中・動いている物は必ず表示）
  const updateCull = dt => {
    const cam = G.camera ? G.camera.position : P.pos;
    const inSch = !!G.inSchool, indoor = G.indoor || false;
    // 状態切替、主人公の移動（6m超）、カメラの移動（5m超）で即時に再評価する
    if (inSch !== lastInSchool || indoor !== lastIndoor || Math.hypot(P.pos.x - lastPx, P.pos.z - lastPz) > 6 || Math.hypot(cam.x - lastCx, cam.y - lastCy, cam.z - lastCz) > 5) cullT = 0;
    if ((cullT -= dt) > 0) return;
    cullT = 0.25; lastPx = P.pos.x; lastPz = P.pos.z; lastCx = cam.x; lastCy = cam.y; lastCz = cam.z; lastInSchool = inSch; lastIndoor = indoor;
    const pFl = floorAt(P.pos.y), cFl = floorAt(cam.y), nearStair = Math.min(P.pos.x, cam.x);
    for (const b of bodies){
      if (b.moving || b.v.lengthSq() > 0 || b.spin.lengthSq() > 0){ b.m.visible = true; continue; }
      const p = b.m.position, vis = b.m.visible;
      // 室内（特に3階上空配置の教室）では窓外の近景が高度差で消えないよう水平距離を使う
      const d = indoor ? Math.hypot(p.x - cam.x, p.z - cam.z) : Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z);
      if (b.school && inSchoolBox(p.x, p.z)){
        // 部屋イベント中（自宅・商店・教室など）は校舎内家具を隠す
        if (indoor){ b.m.visible = false; continue; }
        if (!inSch){ b.m.visible = d < (vis ? 60 : 48); continue; }
        const bFl = floorAt(p.y), df = Math.min(Math.abs(bFl - pFl), Math.abs(bFl - cFl));
        if (df === 0) b.m.visible = true;
        else if (df >= 2) b.m.visible = false;
        // 上下の階は階段東端（STAIR_X1=21）の近く（表示<+4m／非表示>=+7m）かつ距離内のときだけ見せる
        else b.m.visible = vis ? (nearStair < STAIR_X1 + 7 && d < 56) : (nearStair < STAIR_X1 + 4 && d < 48);
        continue;
      }
      if (indoor && indoor !== 'home' && indoor !== 'class'){ b.m.visible = false; continue; }
      const wide = WIDE_CULL.has(b.kind);
      b.m.visible = d < (vis ? (wide ? 130 : 90) : (wide ? 110 : 75));
    }
  };
  // 当たり判定（家・塀・木・校舎の壁）から押し出して、はね返す。skip は自分の当たり判定
  const bounceWalls = (p, v, r = 0.3, skip = null) => { let hit = false; for (const c of G.colliders){ if (c === skip || c.off || c.body || (c.y1 !== undefined && (p.y + 0.5 < c.y0 || p.y > c.y1)) || (c.h && p.y > G.groundAt(p.x, p.z, p.y) + c.h)) continue;
      if (c.r){ const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), rr = c.r + r; if (d < rr && d > 1e-4){ p.x = c.x + dx/d*rr; p.z = c.z + dz/d*rr; const dot = v.x*dx/d + v.z*dz/d; if (dot < 0){ v.x -= 1.6*dot*dx/d; v.z -= 1.6*dot*dz/d; } hit = true; } continue; }
      const cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0), ex = p.x - c.x, ez = p.z - c.z, lx = ex*cs - ez*sn, lz = ex*sn + ez*cs, hx = c.w/2 + r, hz = c.d/2 + r;
      if (Math.abs(lx) < hx && Math.abs(lz) < hz){ let nx = 0, nz = 0, px = lx, pz = lz; if (hx - Math.abs(lx) < hz - Math.abs(lz)){ px = Math.sign(lx)*hx; nx = Math.sign(lx); } else { pz = Math.sign(lz)*hz; nz = Math.sign(lz); }
        p.x = c.x + px*cs + pz*sn; p.z = c.z - px*sn + pz*cs; const wx = nx*cs + nz*sn, wz = -nx*sn + nz*cs, dot = v.x*wx + v.z*wz; if (dot < 0){ v.x -= 1.6*dot*wx; v.z -= 1.6*dot*wz; } hit = true; } }
    return hit; };
  G.bounceWalls = bounceWalls;
  // 物を登録する。mass が大きいほど飛びにくい。col は止まっているあいだの当たり判定（飛んでいるあいだは消す）
  const OBJ = { bench:'ベンチ', vending:'自販機', postbox:'ポスト', noticeboard:'掲示板', gomi:'ゴミ置き場', fishrack:'干物の台', mirror:'カーブミラー', stopsign:'止まれの標識', laundry:'物干し', surfboard:'サーフボード', windsock:'吹き流し', busstop:'バス停', planter:'植木鉢', piano:'ピアノ', shelf:'本棚', bed:'ベッド' };   // 見た人が言う物の名前
  G.addBody = (m, opt = {}) => { const c = opt.col || null;
    const b = { m, r:opt.r ?? 0.35, mass:opt.mass ?? 1, col:c, school:!!opt.school, kind:opt.kind || '',
      home:{ p:m.position.clone(), q:m.quaternion.clone(), rot:c?.rot || 0, y0:c?.y0, y1:c?.y1 }, v:V(), spin:V(), moving:false };
    if (b.col) b.col.body = false; bodies.push(b); return b; };
  G.resetBodies = () => { for (const b of bodies){ b.m.position.copy(b.home.p); b.m.quaternion.copy(b.home.q); b.v.set(0, 0, 0); b.spin.set(0, 0, 0); b.moving = false;
      if (b.col){ b.col.off = false; b.col.x = b.home.p.x; b.col.z = b.home.p.z; b.col.rot = b.home.rot; b.col.y0 = b.home.y0; b.col.y1 = b.home.y1; } }
    cullT = 0; updateCull(0); };
  const launch = (b, dx, dz, sp, from) => { const k = 1/Math.sqrt(b.mass), s = sp*k, up = s > 3.2;
    b.v.set(dx*s*(up ? 0.95 : 0.7), up ? 2 + s*0.42 : 0, dz*s*(up ? 0.95 : 0.7)); b.moving = true; b.m.visible = true; if (b.col) b.col.off = true;
    if (up && G.observe) G.observe('smash', b.m.position.x, b.m.position.z, { who:OBJ[b.kind] || (b.school ? '机やいす' : '物') });
    if (up){ b.spin.set((Math.random() - 0.5)*12*k, (Math.random() - 0.5)*9*k, (Math.random() - 0.5)*12*k); audio.burst(0.1, 500 + Math.random()*500, Math.min(0.5, 0.2 + b.mass*0.06)); audio.burst(0.05, 2400, 0.08, { when:0.03, type:'bandpass' }); }
    else audio.burst(0.05, 400, 0.06);
    if (up && from){ const st = G.state; const key = 'bodyLog_' + from; if (!st.today[key]){ st.today[key] = true; G.api.log(from === 'car' ? (G.inSchool ? '軽トラで校舎に乗りこんで、げた箱も机も吹っ飛ばした。' : '軽トラで、道ばたのものを吹っ飛ばしてしまった。') : from === 'bike' ? (G.inSchool ? '自転車で校舎の中を走って、机をはね飛ばした。先生には見つからなかった。' : '自転車で、道ばたのものをはね飛ばした。') : '走ってぶつかって、ものをひっくり返した。'); } } };
  // ぶつけるもの（主人公・自転車・軽トラ）。点 (x,z) と向き、速さ、届く半径
  const hitters = () => { const out = [], fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    if (P.driving){ const s = Math.sign(P.carSpeed) || 1, v = Math.abs(P.carSpeed); for (const a of [1.25, 0.2, -0.9]) out.push({ x:P.pos.x + fx*a*s, z:P.pos.z + fz*a*s, y:P.pos.y, dx:fx*s, dz:fz*s, sp:v, reach:0.95, from:'car' }); }
    else if (P.riding) out.push({ x:P.pos.x + fx*0.6, z:P.pos.z + fz*0.6, y:P.pos.y, dx:fx, dz:fz, sp:P.bikeSpeed, reach:0.55, from:'bike' });
    else if (P.moving && !P.sitting) out.push({ x:P.pos.x + fx*0.3, z:P.pos.z + fz*0.3, y:P.pos.y, dx:fx, dz:fz, sp:P.running ? 8.2 : 3.6, reach:0.45, from:'walk' });
    return out; };
  for (const k of G.world.knock || []) G.addBody(k.m, { mass:k.mass, col:k.col, kind:k.kind, r:k.col && k.col.w ? Math.max(0.3, Math.min(k.col.w, k.col.d)/2 + 0.1) : 0.35 });
  G.physicsUpdate = dt => { updateCull(dt); if (G.mode !== 'play') return; const hs = hitters();
    for (const b of bodies){ if (b.school && !G.inSchool && !b.moving) continue; const p = b.m.position;
      for (const h of hs){ if (h.sp < 0.6 || Math.abs(p.y - h.y) > 1.3 || b.v.lengthSq() > 2) continue; const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz); if (d > h.reach + b.r) continue;
        const l = d || 1; launch(b, (h.dx*2 + dx/l)/3, (h.dz*2 + dz/l)/3, h.sp, h.from);
        if (h.from === 'car') P.carSpeed *= Math.max(0.7, 1 - b.mass*0.03); else if (h.from === 'bike') P.bikeSpeed *= 0.9; }
      if (!b.moving) continue;
      b.v.y -= 20*dt; p.addScaledVector(b.v, dt); const e = b.m.rotation; e.x += b.spin.x*dt; e.y += b.spin.y*dt; e.z += b.spin.z*dt;
      if (bounceWalls(p, b.v, b.r, b.col)) audio.burst(0.05, 350, 0.1);
      const gh = G.groundAt(p.x, p.z, p.y + 0.4), floor = Math.max(gh, -1.2);
      if (p.y <= floor){ p.y = floor; if (b.v.y < -3.5){ b.v.y *= -0.3; b.spin.multiplyScalar(0.5); audio.burst(0.06, 600, 0.12); } else b.v.y = 0;
        b.v.x *= Math.max(0, 1 - 5*dt); b.v.z *= Math.max(0, 1 - 5*dt); b.spin.multiplyScalar(Math.max(0, 1 - 6*dt));
        if (b.v.lengthSq() < 0.02 && b.spin.lengthSq() < 0.05){ b.moving = false; const snap = a => Math.round(a/(Math.PI/2))*(Math.PI/2); e.x = snap(e.x); e.z = snap(e.z);
          if (b.col){ b.col.x = p.x; b.col.z = p.z; b.col.rot = e.y; b.col.off = false; if (b.col.y0 !== undefined){ const dy = p.y - (b.col.y0); b.col.y0 += dy; b.col.y1 += dy; } } } }
      // 飛んでいる物が、止まっている物に当たったら、そっちも飛ぶ
      const sp = Math.hypot(b.v.x, b.v.z); if (sp > 3) for (const q of bodies){ if (q === b || q.moving || q.v.lengthSq() > 0) continue; const qp = q.m.position, d = Math.hypot(qp.x - p.x, qp.z - p.z); if (d < b.r + q.r && Math.abs(qp.y - p.y) < 1){ launch(q, b.v.x/sp, b.v.z/sp, sp*0.6*Math.sqrt(b.mass/q.mass)); b.v.multiplyScalar(0.7); } }
      // 飛んでいる物が人に当たったら、その人も吹っ飛ぶ
      if (sp > 4 && G.knockNpc) for (const id in G.npcs){ const n = G.npcs[id]; if (!n.root.visible || n.knock || n.recover > 0 || (n.spot && n.spot.room)) continue; if (Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < b.r + 0.35 && Math.abs(n.pos.y + 0.8 - p.y) < 1.2){ G.knockNpc(n, b.v.x*0.6, 4 + sp*0.25, b.v.z*0.6, id); b.v.multiplyScalar(0.6); } } } };
}
