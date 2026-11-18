// 吹っ飛ばせる物の物理：机・いす・校舎の家具・外の小物（ベンチ、自販機、ポスト、看板…）。
// 歩く・走る・自転車・軽トラが当たると、重さに合わせて押されるか、回りながら飛ぶ。壁ではね返り、地面ではずみ、ほかの物も巻きこむ。
import * as THREE from 'three';
import { audio } from './audio.js';
const V = () => new THREE.Vector3();
export function setupPhysics(G){
  const P = G.player, bodies = []; G.bodies = bodies;
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
  G.addBody = (m, opt = {}) => { const b = { m, r:opt.r ?? 0.35, mass:opt.mass ?? 1, col:opt.col || null, school:!!opt.school, kind:opt.kind || '', home:{ p:m.position.clone(), q:m.quaternion.clone() }, v:V(), spin:V(), moving:false };
    if (b.col) b.col.body = false; bodies.push(b); return b; };
  G.resetBodies = () => { for (const b of bodies){ b.m.position.copy(b.home.p); b.m.quaternion.copy(b.home.q); b.v.set(0, 0, 0); b.spin.set(0, 0, 0); b.moving = false; if (b.col){ b.col.off = false; b.col.x = b.home.p.x; b.col.z = b.home.p.z; } } };
  const launch = (b, dx, dz, sp, from) => { const k = 1/Math.sqrt(b.mass), s = sp*k, up = s > 3.2;
    b.v.set(dx*s*(up ? 0.95 : 0.7), up ? 2 + s*0.42 : 0, dz*s*(up ? 0.95 : 0.7)); b.moving = true; if (b.col) b.col.off = true;
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
  G.physicsUpdate = dt => { if (G.mode !== 'play') return; const hs = hitters();
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
