// 校舎の中：暗転なしで歩いても自転車でも出入りできる。階ごとの床・壁、吹っ飛ばせる机といす、校舎内の現在地。
import * as THREE from 'three';
import { LAYOUT as L } from '../data/school-layout.js';
import { heightAt } from './world/terrain.js';
import { model, extraLit } from './models.js';
import { setGround } from './player.js';
import { audio } from './audio.js';
import { ROOM } from './world/places.js';
const BX0 = L.X0 - 0.3, BX1 = L.X1 + 0.3, BZ0 = L.ZN - 0.3, BZ1 = -54.4;   // 校舎（ポーチをふくむ）の範囲
const inBox = (x, z) => x > BX0 && x < BX1 && z > BZ0 && z < BZ1;
// (x,z) の床のうち、いまの高さ y から上がれる（y+0.55 以下の）いちばん高いもの。無ければ null
export function schoolFloor(x, z, y){ if (!inBox(x, z)) return null; let best = null;
  for (const f of L.floors){ if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue; const h = f.h === f.h1 ? f.h : f.h + (f.h1 - f.h)*(x - f.x0)/(f.x1 - f.x0);
    if (h <= y + 0.55 && (best === null || h > best)) best = h; }
  return best; }
export const floorIndex = y => y > L.F[2] - 0.6 ? 2 : y > L.F[1] - 0.6 ? 1 : 0;
export function setupSchool(G){
  const P = G.player, W = G.world, scene = G.scene;
  const groundAt = (x, z, y = 999) => { const f = schoolFloor(x, z, y); return f === null ? heightAt(x, z) : f; };
  G.groundAt = groundAt; setGround(groundAt);
  // 上の階を切り取るクリップ平面（現在は 999 で切らないが、ガラス材質にも共有する）
  const cut = new THREE.Plane(new THREE.Vector3(0, -1, 0), 999); G.renderer.localClippingEnabled = true;
  // 窓ガラス：無傷ガラスと破損後の四隅残欠、破片プール用の共有ジオメトリ・材質
  const paneGeo = new THREE.PlaneGeometry(1, 1);
  const glassMat = new THREE.MeshBasicMaterial({ color:0xbfe4ef, transparent:true, opacity:0.24, side:THREE.DoubleSide, depthWrite:false, clippingPlanes:[cut] });
  const brokenGeo = new THREE.BufferGeometry();
  brokenGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.5, 0.5, 0, -0.38, 0.5, 0, -0.5, 0.24, 0,
     0.5, 0.5, 0,  0.5, 0.28, 0,  0.36, 0.5, 0,
    -0.5, -0.5, 0, -0.5, -0.26, 0, -0.40, -0.5, 0,
     0.5, -0.5, 0,  0.37, -0.5, 0,  0.5, -0.22, 0,
  ]), 3));
  brokenGeo.computeVertexNormals();
  const brokenMat = new THREE.MeshBasicMaterial({ color:0xd4f0f8, transparent:true, opacity:0.36, side:THREE.DoubleSide, depthWrite:false, clippingPlanes:[cut] });
  const shardGeo = new THREE.BufferGeometry();
  shardGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.09, -0.06, 0, 0.10, -0.03, 0, -0.02, 0.11, 0]), 3));
  shardGeo.computeVertexNormals();
  const shardMat = new THREE.MeshBasicMaterial({ color:0xdbf3fa, transparent:true, opacity:0.62, side:THREE.DoubleSide, depthWrite:false, clippingPlanes:[cut] });
  const panesGroup = new THREE.Group(); scene.add(panesGroup); panesGroup.visible = false;
  const panes = [];
  // 壁と家具の当たり判定（高さの範囲つき）。外から見た校舎の箱の判定は、これに置きかえる
  const cols = [];
  for (const w of L.walls){ const horiz = Math.abs(w.z1 - w.z0) < 0.01, t = w.kind === 'rail' ? 0.12 : L.T;
    // 外壁の窓は通り抜けられる（開いている）。腰壁（床から0.9mまで）・欄間（2.3mから上）・柱だけが当たる。窓から外へ飛び出せる
    if (w.kind === 'shell' && horiz){ const fl = w.y0 + 0.3, a0 = Math.min(w.x0, w.x1), a1 = Math.max(w.x0, w.x1), z = w.z0;
      cols.push({ x:(a0 + a1)/2, z, w:a1 - a0 + 0.05, d:t, y0:w.y0, y1:fl + 0.9, sill:true }, { x:(a0 + a1)/2, z, w:a1 - a0 + 0.05, d:t, y0:fl + 2.3, y1:w.y1 });
      const np = Math.max(1, Math.round((a1 - a0)/3.6)), posts = w.vis ? Array.from({ length:np + 1 }, (_, i) => a0 + (a1 - a0)*i/np) : [35.5, 38.5, 41.5, 44.5];   // 自分の教室は、教室のモデルの窓の柱
      for (const x of posts) cols.push({ x, z, w:0.32, d:t, y0:w.y0, y1:w.y1 });
      // 隣り合う柱の内端どうしの間（1スパン）× 開口高さに窓ガラス面を張る（当たり判定には入れない）
      for (let i = 0; i < posts.length - 1; i++){ const x0 = posts[i] + 0.16, x1 = posts[i + 1] - 0.16; if (x1 - x0 <= 0.1) continue;
        const y0 = fl + 0.9, y1 = fl + 2.3, cx = (x0 + x1)/2, cy = (y0 + y1)/2, sw = x1 - x0, sh = y1 - y0;
        const mesh = new THREE.Mesh(paneGeo, glassMat); mesh.position.set(cx, cy, z); mesh.scale.set(sw, sh, 1);
        const brokenMesh = new THREE.Mesh(brokenGeo, brokenMat); brokenMesh.position.set(cx, cy, z); brokenMesh.scale.set(sw, sh, 1); brokenMesh.visible = false;
        panesGroup.add(mesh, brokenMesh); panes.push({ x0, x1, z, y0, y1, mesh, brokenMesh, broken:false }); }
      continue; }
    cols.push({ x:(w.x0 + w.x1)/2, z:(w.z0 + w.z1)/2, w:horiz ? Math.abs(w.x1 - w.x0) + 0.05 : t, d:horiz ? t : Math.abs(w.z1 - w.z0) + 0.05, y0:w.y0, y1:w.kind === 'rail' ? w.y0 + 3 : w.y1 }); }
  for (const c of ROOM.col) cols.push({ ...c, y0:ROOM.y, y1:ROOM.y + 1.5 });   // 自分の教室の作業机・棚
  G.colliders.push(...cols);
  // 破片プール（固定長最大32個、1個=1三角形）
  const SHARD_MAX = 32;
  const shards = Array.from({ length:SHARD_MAX }, () => {
    const mesh = new THREE.Mesh(shardGeo, shardMat); mesh.visible = false; panesGroup.add(mesh);
    return { mesh, vx:0, vy:0, vz:0, rx:0, ry:0, rz:0, life:0, maxLife:0.75, baseScale:1 }; });
  let shardCur = 0;
  const allocShard = () => {
    for (let i = 0; i < SHARD_MAX; i++){ const s = shards[(shardCur + i)%SHARD_MAX]; if (s.life <= 0){ shardCur = (shardCur + i + 1)%SHARD_MAX; return s; } }
    const s = shards[shardCur]; shardCur = (shardCur + 1)%SHARD_MAX; return s; };
  const spawnShards = (ix, hitY, iz, dirZ, avx, avz) => {
    const count = 10 + Math.floor(Math.random()*3);
    for (let i = 0; i < count; i++){ const s = allocShard();
      s.mesh.position.set(ix + (Math.random() - 0.5)*0.55, hitY + (Math.random() - 0.5)*0.55, iz + dirZ*0.05);
      s.mesh.rotation.set(Math.random()*6.28, Math.random()*6.28, Math.random()*6.28);
      s.vx = (Math.random() - 0.5)*3.4 + avx*0.2; s.vy = 0.6 + Math.random()*2.8; s.vz = dirZ*(2.4 + Math.random()*3.8) + avz*0.25;
      s.rx = (Math.random() - 0.5)*16; s.ry = (Math.random() - 0.5)*16; s.rz = (Math.random() - 0.5)*16;
      s.maxLife = 0.65 + Math.random()*0.20; s.life = s.maxLife; s.baseScale = 0.8 + Math.random()*0.6;
      s.mesh.scale.setScalar(s.baseScale); s.mesh.visible = true; } };
  // 見た目：中に入ったら外観を消して中を見せる（境目は昇降口のガラス戸）
  const inside = model('school-in'); scene.add(inside); inside.visible = false; W.schoolIn = inside;
  // ---- 机といす・家具：吹っ飛ばせる物（physics.js）。中にいるときだけ見せる ----
  const MASS = { staffdesk:2.5, cabinet:3, bookshelf:3, readtable:2, bed:2, medshelf:2.5, lockers:3, piano:6, drums:1.5, easel:0.6, artshelf:2, teacherdesk:2 };
  const group = new THREE.Group(); scene.add(group); group.visible = false; const desks = model('sdesk'), chairs = model('schair');
  for (const d of L.desks){ const y = L.F[d.floor];
    for (const [src, dx, mass, r] of [[desks, 0, 0.6, 0.32], [chairs, 0.5, 0.4, 0.24]]){ const m = src.clone(); m.position.set(d.x + dx, y, d.z); m.rotation.set(0, d.ry, 0); group.add(m); G.addBody(m, { mass, r, school:true }); } }
  { const lib = model('school-props'); lib.updateMatrixWorld(true);
    L.props.forEach((p, i) => { const o = lib.getObjectByName('p' + i); if (!o) return; const m = o.clone(); o.getWorldPosition(m.position); m.rotation.set(0, 0, 0); group.add(m);
      const y = L.F[p.floor], col = { x:p.x, z:p.z, w:p.w, d:p.d, rot:0, y0:y, y1:y + Math.max(1.2, p.h) }; G.colliders.push(col);
      G.addBody(m, { mass:MASS[p.kind] || 2, r:Math.max(0.3, Math.min(p.w, p.d)/2 + 0.1), col, school:true, kind:p.kind }); }); }
  const prevPos = new Map();
  const origTeleport = P.teleport;
  P.teleport = function(...args){ const r = origTeleport.apply(this || P, args); prevPos.delete(P); return r; };
  G.schoolReset = () => { G.resetBodies(); for (const p of panes){ p.broken = false; p.mesh.visible = true; p.brokenMesh.visible = false; }
    for (const s of shards){ s.life = 0; s.mesh.visible = false; } prevPos.clear(); };
  // 上の階を消す：校舎の中では、いる階の天井より上を切り取って見せない（カメラを高く引いて、いまの階を見下ろせる）
  const LITRE = /^(light-panel|lampshade|desklamp|lh-lamp)$/;
  const classGlass = [];
  for (const root of [inside, group, W.classroom, W.school]) root.traverse(o => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
    // 元の glb 内の固定窓ガラス（glass-alpha）は隠し、割れる窓ガラス面だけを見せる
    if ((root === inside || root === W.classroom) && !Array.isArray(o.material) && o.material && o.material.name === 'glass-alpha'){
      o.visible = false;
      if (root === W.classroom) classGlass.push(o);
    }
    const cl = ms.map(m => { const c = m.clone(); c.clippingPlanes = [cut]; if (LITRE.test(m.name)) extraLit.push(c); return c; }); o.material = Array.isArray(o.material) ? cl : cl[0]; });
  G.schoolCut = () => cut.constant;
  // 窓の通過検出（主人公・高速の物理ボディ/ボール・knock中のNPC）
  const syncPrev = (key, p) => { let r = prevPos.get(key); if (!r){ r = { x:p.x, y:p.y, z:p.z, ready:true }; prevPos.set(key, r); } else { r.x = p.x; r.y = p.y; r.z = p.z; r.ready = true; } return r; };
  const testActor = (key, cur, hMin, hMax, active, dt) => {
    const prev = prevPos.get(key);
    if (!prev || !prev.ready || !active){ syncPrev(key, cur); return; }
    const dx = cur.x - prev.x, dy = cur.y - prev.y, dz = cur.z - prev.z;
    if (dx*dx + dy*dy + dz*dz > 36){ syncPrev(key, cur); return; }   // teleport 等の瞬間移動は同期のみ
    if (Math.abs(dz) > 1e-6){ const dirZ = Math.sign(dz), invDt = dt > 1e-4 ? 1/dt : 0, avx = dx*invDt, avz = dz*invDt;
      for (const pane of panes){ if (pane.broken) continue;
        if (!((prev.z < pane.z && cur.z >= pane.z) || (prev.z > pane.z && cur.z <= pane.z))) continue;
        const t = (pane.z - prev.z)/dz, ix = prev.x + dx*t, iy = prev.y + dy*t;
        if (ix < pane.x0 || ix > pane.x1 || iy + hMax <= pane.y0 || iy + hMin >= pane.y1) continue;
        pane.broken = true; pane.mesh.visible = false; pane.brokenMesh.visible = true;
        const hitY = Math.min(pane.y1 - 0.1, Math.max(pane.y0 + 0.1, iy + (hMin + hMax)*0.5));
        spawnShards(Math.min(pane.x1 - 0.12, Math.max(pane.x0 + 0.12, ix)), hitY, pane.z, dirZ, avx, avz);
        const dist = Math.hypot(P.pos.x - ix, P.pos.y + 0.9 - hitY, P.pos.z - pane.z);
        if (dist < 45) audio.glass(Math.max(0.08, 1 - dist/45)); } }
    prev.x = cur.x; prev.y = cur.y; prev.z = cur.z; };
  // ---- 毎フレーム ----
  let was = false, place = '';
  G.inSchool = false;
  G.schoolUpdate = dt => {
    const inS = G.indoor === 'class' || (!G.indoor && inBox(P.pos.x, P.pos.z) && P.pos.y > L.F[0] - 1.2);   // 軽トラのままでも入れる
    if (inS !== was){ was = inS; }
    G.inSchool = inS;
    // 中の壁がそのまま外観なので、校舎の近くでは外からも中を見せる（窓から中が見え、昇降口から中へそのまま入れる）
    const near = !G.indoor && Math.hypot(P.pos.x - 30, P.pos.z + 62) < 170; inside.visible = near; group.visible = near; panesGroup.visible = near; W.school.visible = true; W.classroom.visible = near || G.indoor === 'class';
    for (const g of classGlass) g.visible = G.indoor === 'class';
    const play = G.mode === 'play';
    testActor(P, P.pos, 0.2, 1.6, play && !P.frozen && !G.indoor, dt);
    for (const b of G.bodies || []) testActor(b, b.m.position, 0, 0.8, play && b.moving && b.v.lengthSq() > 2.2, dt);
    if (G.ball) testActor(G.ball, G.ball.mesh.position, -G.ball.r, G.ball.r, play && G.ball.v.lengthSq() > 2.2, dt);
    for (const id in G.npcs){ const n = G.npcs[id]; testActor(n, n.pos, 0.2, 1.6, play && !!n.knock && n.root.visible, dt); }
    for (const s of shards){ if (s.life <= 0) continue; s.life -= dt; if (s.life <= 0){ s.mesh.visible = false; continue; }
      s.vy -= 14*dt; s.mesh.position.x += s.vx*dt; s.mesh.position.y += s.vy*dt; s.mesh.position.z += s.vz*dt;
      s.mesh.rotation.x += s.rx*dt; s.mesh.rotation.y += s.ry*dt; s.mesh.rotation.z += s.rz*dt;
      s.mesh.scale.setScalar(s.baseScale*Math.min(1, s.life/(s.maxLife*0.45))); }
    P.camFix = inS && !P.room ? camFix : null;
    cut.constant = 999;   // 上の階は切り取らない（天井が透けて空が見えるので）。カメラは天井の下で止める
    if (!inS) return;
    // いまいる部屋（場所の名前）
    const fl = floorIndex(P.pos.y); let now = `${fl + 1}階　廊下`; if (P.pos.z > L.ZS) now = '昇降口';
    for (const r of L.rooms) if (r.floor === fl && P.pos.x > r.x0 && P.pos.x < r.x1 && P.pos.z > r.z0 && P.pos.z < r.z1) now = `${fl + 1}階　${r.name}`;
    if (P.pos.x < 21 && P.pos.z > L.ZC) now = '階段';
    G.schoolPlace = now; };
  // カメラ：主人公の頭から外へ向かって、壁と天井にぶつかる手前で止める
  function camFix(tx, ty, tz){ const hx = P.pos.x, hy = P.pos.y + 1.4, hz = P.pos.z, fl = floorIndex(P.pos.y), top = L.F[fl] + L.CH, ceil = top - 0.35;   // 天井の下で止める（天井を抜けると上の階の床の裏が見える）
    let k = 1; for (let i = 1; i <= 12; i++){ const t = i/12, x = hx + (tx - hx)*t, z = hz + (tz - hz)*t, y = hy + (ty - hy)*t;
      if (y > ceil || cols.some(c => y + 0.3 > c.y0 && y - 0.3 < c.y1 && Math.abs(x - c.x) < c.w/2 + 0.4 && Math.abs(z - c.z) < c.d/2 + 0.4)){ k = (i - 1)/12; break; } }
    k = Math.max(0.12, k); return [hx + (tx - hx)*k, Math.min(ceil, hy + (ty - hy)*k), hz + (tz - hz)*k]; }
  return { cols, panes };
}
