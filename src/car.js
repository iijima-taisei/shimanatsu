// 軽トラに乗る。W/Sで前進・後退、A/Dでハンドル、Bで降りる。
import * as THREE from 'three';
import { heightAt, inBounds } from './world/terrain.js';
import { audio } from './audio.js';
import { keys } from './player.js';
import { SETTINGS, GEARS } from './keys.js';
const clamp = THREE.MathUtils.clamp;
export function setupCars(G){
  const P = G.player, W = G.world, I = G.interact, { toast, log } = G.api;
  const syncCol = car => { const m = car.mesh, yaw = m.rotation.y; for (const c of [car.col, car.bed]){ c.x = m.position.x + Math.sin(yaw)*c.off0; c.z = m.position.z + Math.cos(yaw)*c.off0; c.rot = yaw; } };
  // 車を (x,z) に向き yaw で置き、地面の傾きに合わせる
  const place = (car, x, z, yaw) => { const m = car.mesh, fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
    const y0 = car.mesh.position.y + 0.6, h = (a, b) => Math.max(G.groundAt(x + fx*a + lx*b, z + fz*a + lz*b, y0), -0.6);   // 校舎の中では、いまの階の床
    const hf = (h(1.0, 0.6) + h(1.0, -0.6))/2, hr = (h(-1.0, 0.6) + h(-1.0, -0.6))/2, hl = (h(1.0, 0.6) + h(-1.0, 0.6))/2, hrt = (h(1.0, -0.6) + h(-1.0, -0.6))/2;
    m.position.set(x, (hf + hr)/2, z); m.rotation.set(-Math.atan2(hf - hr, 2.0), yaw, Math.atan2(hl - hrt, 1.2), 'YXZ'); m.updateMatrixWorld(true); };
  const sit = car => place(car, P.pos.x, P.pos.z, P.yaw);
  // ---- 荷台 ----
  // 荷台の床の高さ（車の地面からの高さ）と、荷台の範囲（車の向きでの前後 lz・左右 lx）
  const BED_TOP = 0.68, BED = { x:0.66, z0:-1.55, z1:0.38 };
  const local = (car, x, z) => { const m = car.mesh.position, yaw = car.mesh.rotation.y, dx = x - m.x, dz = z - m.z; return [dx*Math.cos(yaw) - dz*Math.sin(yaw), dx*Math.sin(yaw) + dz*Math.cos(yaw)]; };
  const world = (car, lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(car.mesh.matrixWorld);
  // 足元が荷台の上なら、その高さを返す（上から乗るときだけ。横からは塀と同じで、跳ばないと越えられない）
  P.bedAt = (x, z, y) => { for (const car of W.cars){ if (car === P.driving) continue; const top = car.mesh.position.y + BED_TOP; if (y < top - 0.45) continue;
      const [lx, lz] = local(car, x, z); if (Math.abs(lx) < BED.x && lz > BED.z0 && lz < BED.z1) return { top, car }; } return null; };
  const onBed = () => P.bedAt(P.pos.x, P.pos.z, P.pos.y);
  // 荷台のふちに腰かける位置。side = 1 なら右、-1 なら左。顔は内側に向ける
  const SEATS = [[0.6, -0.35, -1], [-0.6, -0.35, 1], [0.6, -1.15, -1], [-0.6, -1.15, 1]];
  const seatOf = (car, i) => { const [lx, lz, side] = SEATS[i], p = world(car, lx, 0.98 - 0.39, lz); return { p, yaw:car.mesh.rotation.y + side*Math.PI/2 }; };
  // 人を荷台に乗せる（主人公は P.carry、友達は npc.ride）。毎フレーム車に合わせて置き直す
  const carryUpdate = () => {
    // 止まっている車の荷台に残った友達は、主人公が降りたら一緒に降りる
    for (const k in G.npcs){ const n = G.npcs[k], car = n.ride && n.ride.car; if (!car || car === P.driving || car.busy || (P.carry && P.carry.car === car)) continue; hopOff(n, car, -1); if (G.companion === k) n.following = true; }
    if (P.carry){ const { p, yaw } = seatOf(P.carry.car, P.carry.seat); P.pos.copy(p); P.yaw = yaw; }
    for (const k in G.npcs){ const n = G.npcs[k]; if (!n.ride) continue; const { p, yaw } = seatOf(n.ride.car, n.ride.seat); n.pos.copy(p); n.yaw = yaw; } };
  P.carryUpdate = carryUpdate;
  const hop = (npc, car, seat) => { npc.ride = { car, seat }; npc.following = false; };
  const hopOff = (npc, car, side=1) => { if (!npc.ride) return; npc.ride = null; const m = car.mesh.position, yaw = car.mesh.rotation.y; const x = m.x + Math.cos(yaw)*1.8*side - Math.sin(yaw)*1.2, z = m.z - Math.sin(yaw)*1.8*side - Math.cos(yaw)*1.2;
    npc.pos.set(x, heightAt(x, z), z); };
  G.cars = { place, syncCol, hop, hopOff, onBed, seatOf };

  const enter = async car => { if (P.riding || P.driving || P.swimming || P.air > 0) return;
    P.driving = car; car.col.off = car.bed.off = true; car.jam = 0; P.gear = 1; P.carHead = car.mesh.rotation.y; P.carSpeed = 0; P.sitting = false; P.yaw = car.mesh.rotation.y; P.pos.set(car.mesh.position.x, car.mesh.position.y, car.mesh.position.z);
    P.carCamDist = P.camDist; P.camDist = 9.5; P.camPitch = Math.max(0.24, P.camPitch); P.camYaw = P.yaw + Math.PI; P.snap = true;
    const c = G.companion && G.npcs[G.companion]; if (c) hop(c, car, 0);
    toast(c ? `${G.names[G.companion]}は荷台に飛び乗った。W/Sで進む・下がる。A/Dでハンドルを切る。Bで降りる` : '軽トラを借りた。W/Sで進む・下がる。A/Dでハンドルを切る。Bで降りる', 5200);
    if (!G.state.today.carLog){ G.state.today.carLog = true; log(c ? `${G.names[G.companion]}を荷台に乗せて、軽トラで島を走った。` : '軽トラを運転した。島の道は、車だとあっという間だ。'); } };
  // 降りる。横か後ろの空いている場所へ。force は場所がなくてもその場に降りる
  const leave = (force=false) => { const car = P.driving; if (!car) return true; const yaw = P.yaw; let spot = null;
    for (const [a, b] of [[0, -1.5], [0, 1.5], [-2.6, 0], [2.8, 0], [0, -2.2], [0, 2.2]]){ const x = P.pos.x + Math.sin(yaw)*a + Math.cos(yaw)*b, z = P.pos.z + Math.cos(yaw)*a - Math.sin(yaw)*b; if (P.clearAt(x, z) && Math.abs(heightAt(x, z) - P.pos.y) < 1.6){ spot = [x, z]; break; } }
    if (!spot && !force){ toast('ここは狭くて降りられない。少し動かそう'); return false; }
    sit(car); P.driving = null; P.carSpeed = 0; car.col.off = car.bed.off = false; syncCol(car); audio.engine(0, false);
    if (spot) P.pos.set(spot[0], heightAt(spot[0], spot[1]), spot[1]); P.camDist = P.carCamDist ?? 6.2; P.root.visible = true;
    for (const k in G.npcs){ const n = G.npcs[k]; if (n.ride && n.ride.car === car){ hopOff(n, car, -1); if (G.companion === k) n.following = true; } }
    return true; };
  G.leaveCar = () => { if (P.driving && leave()) toast('軽トラをとめた。近くでEを押すと、また乗れる', 3000); };
  P.exitCar = leave;
  G.resetCars = () => { if (P.driving) leave(true); P.carry = null; for (const k in G.npcs) G.npcs[k].ride = null; drive = null;
    for (const car of W.cars){ car.mesh.position.set(car.home.x, car.home.y, car.home.z); car.mesh.rotation.set(0, car.home.ry, 0); car.mesh.updateMatrixWorld(true); car.water = 0; car.col.off = car.bed.off = false; syncCol(car); } };
  for (const car of W.cars) I.push({ get x(){ return car.mesh.position.x; }, get y(){ return car.mesh.position.y + 1.0; }, get z(){ return car.mesh.position.z; }, r:2.7, when: () => !G.indoor && !P.riding && !P.driving && !P.swimming && !P.carry && !car.busy && !onBed() && Math.abs(P.pos.y - car.mesh.position.y) < 1.5, label:'軽トラに乗る', act: () => enter(car) });
  // 荷台の上で：腰かける。友達がいっしょなら、友達も飛び乗ってくる
  I.push({ get x(){ return P.pos.x; }, get z(){ return P.pos.z; }, r:0.5, when: () => !G.indoor && !P.sitting && !P.carry && !!onBed() && !onBed().car.busy, label:'荷台に腰かける', act: async () => {
    const car = onBed().car, c = G.companion && G.npcs[G.companion]; P.carry = { car, seat:1 }; P.sitting = true; carryUpdate();
    if (c && !c.ride){ hop(c, car, 0); carryUpdate(); }
    toast('荷台のふちに腰かけた。歩くと降りる', 3000);
    if (!G.state.today.bedSit){ G.state.today.bedSit = true; log(c ? `とめてある軽トラの荷台に、${G.names[G.companion]}と並んで腰かけた。` : 'とめてある軽トラの荷台に腰かけて、しばらくぼんやりした。'); } } });

  // ---- 決まった道を走る（おじさんの運転など）----
  let drive = null;
  // pts の上を speed m/s で走り、終点で止まる。Promise は着いたときに解決する
  G.autoDrive = (car, pts, speed=10) => new Promise(done => { car.busy = true; car.col.off = car.bed.off = true; drive = { car, pts, i:0, t:0, v:0, speed, done }; });
  G.carsUpdate = dt => { if (drive){ const d = drive, { car, pts } = d; if (G.skipReq){ d.i = pts.length - 1; d.t = 0; }   // 飛ばすときは終点へ d.v += (d.speed - d.v)*Math.min(1, dt*0.8);
      let step = d.v*dt; while (step > 0 && d.i < pts.length - 1){ const a = pts[d.i], b = pts[d.i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); const rest = L*(1 - d.t); if (step < rest){ d.t += step/L; step = 0; } else { step -= rest; d.i++; d.t = 0; } }
      const a = pts[Math.min(d.i, pts.length - 1)], b = pts[Math.min(d.i + 1, pts.length - 1)], x = a[0] + (b[0] - a[0])*d.t, z = a[1] + (b[1] - a[1])*d.t;
      const ahead = pts[Math.min(d.i + 3, pts.length - 1)], want = Math.atan2(ahead[0] - x, ahead[1] - z); let yaw = car.mesh.rotation.y, dy = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)); if (Math.hypot(ahead[0] - x, ahead[1] - z) > 0.5) yaw += dy*Math.min(1, dt*3);
      place(car, x, z, yaw); audio.engine(d.v, true);
      if (d.i >= pts.length - 1){ drive = null; car.busy = false; car.col.off = car.bed.off = false; syncCol(car); audio.engine(0, false); d.done(); } }
    carryUpdate(); };
  // 道の番号と向きから、走る点列を作る。日本は左側通行なので、道の中心から左へ寄せる
  G.route = (...legs) => { const out = [];
    for (const [ri, rev] of legs){ let pts = G.roadPts.filter(p => p[4] === ri).map(p => [p[0], p[1]]); if (rev) pts.reverse(); for (const p of pts){ const q = out[out.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 1) out.push(p); } }
    return out.map((p, i) => { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)], tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1; return [p[0] + tz/L*1.1, p[1] - tx/L*1.1]; }); };

  // 当たり判定は、中心線に並べた4つの丸。わざと甘くしてある：
  // ・SLACK までの重なりは当たりとみなさない（塀や家の角をかすめても止まらない）
  // ・それより深く重なっていても、重なりが深くならない向きには動ける（めりこんだ状態から抜け出せる）
  // ・それでも動けないままアクセルを踏み続けたら、当たりを無視して抜ける（car.jam）
  const PROBE = [1.05, 0.35, -0.35, -1.0], PR = 0.5, SLACK = 0.22;
  const depth = (x, z, yaw) => { let m = 0; for (const a of PROBE) m = Math.max(m, P.depthAt(x + Math.sin(yaw)*a, z + Math.cos(yaw)*a, PR)); return m; };
  P.updateCar = function(dt, mx, mz){ const car = this.driving; let v = this.carSpeed;
    // 操作方法：かんたん（W/Sでアクセルとバック、A/Dでハンドル）、マニュアル（Shift/Ctrlでギアを変える）、ラジコン（倒した方向へ自動でハンドルを切る）
    const mode = SETTINGS.drive; let steer = mx, top = 22; this.gear = this.gear ?? 1;
    if (this.locked) v = 0;
    else if (mode === 'manual'){ const G2 = GEARS.car, g = this.gear, gas = keys.KeyW || keys.ArrowUp, brake = keys.KeyS || keys.ArrowDown; top = 29;
      if (gas){ if (g > 0){ const low = g > 1 && v < G2.max[g - 1]*0.5; v += (v < G2.max[g] ? G2.acc[g]*(low ? 0.3 : 1) : -4)*dt; } else v = Math.max(-6, v - 5*dt); }   // 高いギアのまま遅いと、なかなか進まない
      else if (brake) v -= Math.sign(v)*Math.min(Math.abs(v), 14*dt);
      else v -= Math.sign(v)*Math.min(Math.abs(v), (g > 0 ? 1.4 + g*0.35 : 2)*dt);   // エンジンブレーキ
      if (g > 0 && v > G2.max[g]) v -= 6*dt; this.rpm = g > 0 ? Math.max(0, v)/G2.max[g] : Math.abs(v)/6; }
    else if (mode === 'radio'){ const len = Math.hypot(mx, mz);
      if (len > 0.1){ const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw), dx = fx*mz - fz*mx, dz = fz*mz + fx*mx, want = Math.atan2(dx, dz), ang = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
        steer = clamp(-ang*1.6, -1, 1); v += (Math.abs(ang) > 2.4 ? -5 : 7)*dt*len; }
      else { steer = 0; v -= Math.sign(v)*Math.min(Math.abs(v), 6*dt); } }
    else if (mz > 0.1) v += (v < 0 ? 14 : 7.5)*dt; else if (mz < -0.1) v -= (v > 0 ? 15 : 5)*dt; else v -= Math.sign(v)*Math.min(Math.abs(v), 3.2*dt);
    // サイドブレーキ（スペース）：後ろがすべって、ドリフトする
    const drift = !this.locked && keys.Space && Math.abs(v) > 4; if (drift){ v -= Math.sign(v)*3.5*dt; if ((car.skid = (car.skid || 0) - dt) < 0){ car.skid = 0.12; audio.burst(0.12, 2600, 0.05, { type:'highpass' }); G.puff && G.puff(this.pos.x - Math.sin(this.yaw)*1.2, this.pos.y, this.pos.z - Math.cos(this.yaw)*1.2, 0.5); } }
    // 水の中：浅瀬はそのまま走れる。深みではエンジンが水をかぶり、しばらくすると止まる
    const gh0 = heightAt(this.pos.x, this.pos.z), deep = gh0 < -0.45, wet = gh0 < 0.05;
    car.water = clamp((car.water || 0) + (deep ? dt/9 : -dt/4), 0, 1);
    v = clamp(v, deep ? -3 : wet ? -4 : -6, deep ? 5.5 - car.water*2.5 : wet ? 9 : top);
    if (deep && car.water > 0.55 && !car.warned){ car.warned = true; toast('エンジンがせきこんでいる。浅いところに戻らないと止まりそうだ', 3600); }
    if (car.water < 0.2) car.warned = false;
    if (wet && Math.abs(v) > 1.5 && (car.splash = (car.splash || 0) - dt) < 0){ car.splash = 0.32; audio.burst(0.3, 1300, 0.05 + Math.min(0.07, Math.abs(v)*0.008)); }
    const yaw0 = this.yaw;
    if (!this.locked && Math.abs(v) > 0.15) this.yaw -= steer*dt*1.9*(drift ? 1.9 : 1)*clamp(v/5, -1, 1)*(1 - Math.min(0.55, Math.abs(v)/40));
    // 進む向きは、ハンドルの向きに少し遅れてついていく（ドリフト中は大きく遅れる）
    this.carHead = this.carHead ?? this.yaw; { const d = Math.atan2(Math.sin(this.yaw - this.carHead), Math.cos(this.yaw - this.carHead)); this.carHead += d*Math.min(1, dt*(drift ? 1.3 : 12)); }
    const dist = v*dt, steps = Math.max(1, Math.ceil(Math.abs(dist)/0.22)), step = dist/steps; let moved = 0, prevYaw = yaw0;
    // その向きに1歩進めるか。すでに重なっている丸は、重なりが深くならなければ通す（めりこんでも必ず抜け出せる）
    const tryMove = (yaw, was) => { const hd = yaw + Math.atan2(Math.sin(this.carHead - this.yaw), Math.cos(this.carHead - this.yaw)), fx = Math.sin(hd), fz = Math.cos(hd), nx = this.pos.x + fx*step, nz = this.pos.z + fz*step;
      if (!inBounds(nx, nz)) return null;
      if (!(car.jam > 0.7)){ const now = depth(nx, nz, yaw); if (now > SLACK && now > was + 0.004) return null; }
      const s = Math.sign(step), gy = this.pos.y + 0.6, rise = (G.groundAt(nx + fx*1.6*s, nz + fz*1.6*s, gy) - G.groundAt(nx, nz, gy))/1.6; if (rise > 1.3) return null;      // 崖は登れない
      return { nx, nz, rise }; };
    for (let i = 0; i < steps && step !== 0; i++){ const was = depth(this.pos.x, this.pos.z, prevYaw); let m = tryMove(this.yaw, was);
      if (!m){ for (const d of [0.14, -0.14, 0.3, -0.3, 0.5, -0.5]){ m = tryMove(prevYaw + d, was); if (m){ this.yaw = prevYaw + d; v *= 0.93; break; } } }   // ぶつかったら、塀に沿って向きを逃がす
      if (!m){ this.yaw = prevYaw; if (Math.abs(v) > 4) audio.burst(0.12, 300, 0.35); v = -v*0.2; if (Math.abs(mz) > 0.1) car.jam = (car.jam || 0) + dt; break; }
      if (m.rise > 0.35) v *= 1 - Math.min(0.4, m.rise*0.035);
      this.pos.x = m.nx; this.pos.z = m.nz; moved += Math.abs(step); prevYaw = this.yaw; }
    if (car.jam && moved > 0 && depth(this.pos.x, this.pos.z, this.yaw) <= SLACK) car.jam = 0;
    this.carSpeed = v; this.moved += moved; this.moving = Math.abs(v) > 0.2; this.running = false; this.swimming = false; this.air = 0; this.vy = 0;
    // 高さ：ふだんは地面に沿う。速いまま坂の頂上や段差を越えると、上向きの勢いのまま宙を飛ぶ
    const gh = Math.max(G.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.6), -0.6);
    if (this.carAir){ this.carVy -= 20*dt; this.pos.y += this.carVy*dt; this.carTop = Math.max(this.carTop, this.pos.y);
      if (this.pos.y <= gh){ const drop = this.carTop - gh, hard = -this.carVy; this.pos.y = gh; this.carAir = false; audio.burst(0.25, 160, Math.min(0.7, hard*0.06)); audio.burst(0.1, 900, 0.15);
        if (hard > 5){ v *= 0.8; G.puff && G.puff(this.pos.x, gh, this.pos.z, 1.8); } if (drop > 1.8) G.trick('car', drop); } }
    else if (gh < this.pos.y - 0.45 && Math.abs(v) > 6){ this.carAir = true; this.carVy = Math.max(0, this.carClimb || 0); this.carTop = this.pos.y; }
    else { const y0 = this.pos.y; this.pos.y += (gh - this.pos.y)*Math.min(1, dt*14); this.carClimb = (this.pos.y - y0)/Math.max(dt, 1e-3); }
    this.carSpeed = v; this.root.rotation.y = this.yaw; sit(car);
    if (this.carAir){ car.mesh.position.y = this.pos.y; car.mesh.rotation.x = THREE.MathUtils.clamp(-this.carVy*0.04, -0.5, 0.5); }
    audio.engine((SETTINGS.drive === 'manual' ? 3 + Math.min(1.1, this.rpm || 0)*15 : Math.abs(v))*(car.water > 0.55 ? 0.55 + 0.45*Math.abs(Math.sin(G.time*13)) : 1), true);
    if (car.water >= 1){ car.water = 0; car.warned = false; this.carStall = true; leave(true); return; }                 // 深みに長くいると、エンジンが止まる
    if (!this.camOverride){ if (Math.abs(v) > 1.5){ let d = this.yaw + Math.PI - this.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.camYaw += d*Math.min(1, dt*1.8); } this.updateCam(dt); } };
}
