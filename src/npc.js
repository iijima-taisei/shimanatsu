import * as THREE from 'three';
import { Character } from './models.js';
import { heightAt } from './world/terrain.js';
import { ROOMS } from './world/places.js';
const rid = s => s.room === true ? 'class' : s.room;   // 部屋の名前（room:true は教室）
// 盆踊りの輪（8月13日の夕方、本村の広場の火の見やぐらのまわり）。番号は輪の中の位置
export const BON = { day:6, from:18, to:20.6, x:-60.5, z:43, r:6.2, slots:{ nagisa:0, kouta:1, kotoha:2, granny:3, oneesan:4, ojisan:5 }, n:7 };
import { PREP_TASKS } from '../data/story.js';
import { TYPHOON_DAY } from './weather.js';
// 台風の日：みんな家にいる。朝のうちだけ、航太と源さんが港で船の備えをしている
const STORM = { kouta:h => h < 12.5 ? { k:'storm', x:-216.5, z:66.8, ry:-0.6, pose:'idle' } : null, ojisan:h => h < 12.5 ? { k:'storm', x:-214.6, z:69.2, ry:-2.6, pose:'idle' } : null };
// 手に持つ物（右手・左手）。何をしているかが見て分かるように、作業ごとに変える
const lam = c => new THREE.MeshLambertMaterial({ color:c, side:THREE.DoubleSide });
const box = (w, h, d, c, x=0, y=0, z=0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); return m; };
const HELD = {
  paper:   () => [[box(0.03, 0.2, 0.012, 0x9aa0a4, 0, -0.36, 0.04), box(0.03, 0.2, 0.012, 0x9aa0a4, 0.03, -0.36, 0.04)], [box(0.16, 0.004, 0.22, 0xf2c14e, 0, -0.33, 0.1)]],       // はさみ／色紙
  brush:   () => [[box(0.025, 0.24, 0.025, 0x8a6a48, 0, -0.38, 0.04), box(0.05, 0.07, 0.03, 0x3f7fd0, 0, -0.52, 0.04)], [box(0.11, 0.12, 0.11, 0x3f7fd0, 0, -0.38, 0.06)]],       // はけ／ペンキ缶
  flower:  () => [[new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), lam(0xf08cc0))], [box(0.14, 0.004, 0.18, 0xf7d6e6, 0, -0.33, 0.1)]],
  lantern: () => [[new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 6), lam(0xf08a7a))], []],
  cloth:   () => [[box(0.3, 0.004, 0.24, 0xf4f0e4, 0.1, -0.33, 0.12)], [box(0.3, 0.004, 0.24, 0xf4f0e4, -0.1, -0.33, 0.12)]],
  sketch:  () => [[box(0.012, 0.15, 0.012, 0x3a3a3a, 0, -0.36, 0.03)], [box(0.26, 0.012, 0.34, 0xf4f1e6, 0, -0.3, 0.14), box(0.27, 0.01, 0.35, 0x6f7f9c, 0, -0.31, 0.14)]],  // 鉛筆／スケッチブック
};
const KIND = ['paper', 'brush', 'flower', 'lantern', 'cloth'];
const PI = Math.PI;
// 日と時刻で居場所が変わる
export const SCHED = {
  nagisa: (d, h) => h < 15 ? { k:'room', x:38.8, z:-60.2, ry:PI, pose:'work', room:true } : (d % 2 ? { k:'pier', x:-246, z:72.75, ry:0, pose:'sit', seat:0 } : { k:'gate', x:33.6, z:-9.6, ry:0.3, pose:'idle' }),
  kouta:  (d, h) => h < 11 ? { k:'beach', x:82.2, z:37.2, ry:-2.0, pose:'idle', beach:true } : h < 15 ? { k:'shop', x:-80.85, z:61.8, ry:PI, pose:'sit', seat:0.55 } : (d % 2 ? { k:'room', x:40.6, z:-61.6, ry:-PI/2, pose:'work', room:true } : { k:'beach2', x:78, z:26, ry:PI/2, pose:'idle', beach:true }),
  kotoha: (d, h) => h < 11 ? { k:'lookout', x:-34, z:-65.75, ry:0, pose:'sit', seat:0.5 } : h < 15 ? { k:'room', x:37.3, z:-61.3, ry:PI/2, pose:'work', room:true } : { k:'shrine', x:-81.8, z:-39, ry:PI, pose:'work' },
  // 謎のお姉さん：夕方は前浜で夕日を見ている。昼は日ごとに島のあちこち。早朝と夜はいない
  oneesan: (d, h) => { if (h < 6.5 || h > 19.6) return { k:'none', x:-200, z:46, ry:0, pose:'idle', hide:true };
    if (d === 11 && h >= 17) return { k:'fin', x:70, z:22, ry:PI/2, pose:'idle' };
    if (h >= 16) return { k:'maehama', x:-200, z:46, ry:-PI/2, pose:'idle' };
    return [{ k:'ishiyama', x:-186, z:246, ry:-2.2, pose:'idle' }, { k:'airport', x:0, z:102, ry:PI/2, pose:'idle' }, { k:'shore', x:96, z:-64, ry:PI/2, pose:'idle' },
      { k:'wakago', x:106, z:-446, ry:-PI/2, pose:'idle' }, { k:'pier', x:-271, z:71.6, ry:-PI/2, pose:'idle' }][(d*2 + (h < 11 ? 0 : 1)) % 5]; },
  // しおばあ：朝は広場でラジオ体操、昼は店の帳場、夜はいない
  // 家族：お母さんは家と庭（洗濯物）と夕方の買い物、お父さんは空港で働いて夕方に帰る、妹は浜や神社で遊ぶ
  mother: (d, h) => h < 9 || h >= 17 ? { k:'home', room:'home', x:-78 - 1.0, z:46.5 - 1.8, ry:0.3, pose:'idle' } : h < 11.5 ? { k:'laundry', x:-78 - 6.2, z:46.5 + 1.4, ry:-PI/2, pose:'work' }
    : h < 15 ? { k:'home2', room:'home', x:-78 - 1.2, z:46.5 + 1.2, ry:0, pose:'idle' } : { k:'shop', room:'shop', x:-84 - 2.4, z:66 + 1.6, ry:PI, pose:'idle' },
  father: (d, h) => h < 8 || h >= 17.5 ? { k:'home', room:'home', x:-78 - 3.2, z:46.5 - 0.9, ry:-PI/2 + 0.4, pose:'idle' } : { k:'term', room:'term', x:16 + 6.0, z:96 + 1.6, ry:-PI/2, pose:'idle' },
  sister: (d, h) => h < 8.5 ? { k:'plaza', x:-61.8, z:38.2, ry:-0.3, pose:'taiso' } : h < 12 ? { k:'beach', x:88, z:44, ry:PI/2, pose:'idle', beach:true } : h < 14 ? { k:'home', room:'home', x:-78 - 3.0, z:46.5 - 1.0, ry:-PI/2, pose:'idle' }
    : h < 17 ? { k:'shrine', x:-81, z:-30, ry:PI, pose:'idle' } : { k:'home2', room:'home', x:-78 - 2.6, z:46.5 + 0.6, ry:PI, pose:'idle' },
  granny: (d, h) => h < 8.5 ? { k:'plaza', x:-63.5, z:38.6, ry:0.2, pose:'taiso' } : h < 19.5 ? { k:'shop', room:'shop', x:-84.8, z:63.95, dy:0.5, ry:PI, pose:'idle' } : { k:'none', x:-84, z:60, ry:0, pose:'idle', hide:true },
  // 港のおじさん：午前は桟橋で釣り、午後は港の軽トラのそば
  ojisan: (d, h) => d === 11 || h < 8 || h > 18 ? { k:'none', x:-214, z:69, ry:0, pose:'idle', hide:true } : h < 12.5 ? { k:'pier', x:-262, z:72.75, ry:0, pose:'sit', seat:0 } : { k:'port', x:-214.6, z:69.2, ry:-2.6, pose:'idle' },
};
const FINAL = { nagisa:{ k:'fin', x:80, z:30.5, ry:PI/2, pose:'idle' }, kouta:{ k:'fin', x:83, z:35.5, ry:PI/2, pose:'idle' }, kotoha:{ k:'fin', x:78.5, z:38.5, ry:PI/2, pose:'idle' } };
export class NPC {
  constructor(id, scene, opt){ this.id = id; this.ch = new Character(opt); this.root = this.ch.root; this.pos = this.root.position; scene.add(this.root); this.spot = null; this.following = false; this.override = null; this.chatPeer = null; this.yaw = 0; this.photoT = 0; this.photoYaw = 0; }
  setHold(kind){ if (kind === this.holdKind) return; this.holdKind = kind; for (const m of this.held || []) m.parent && m.parent.remove(m); this.held = [];
    if (!kind) return; const [right, left] = HELD[kind](); const n = this.ch.n;
    for (const [list, node] of [[right, n.foreR], [left, n.foreL]]) for (const m of list){ if (!node) continue; if (m.position.y === 0) m.position.set(0, -0.36, 0.06); node.add(m); this.held.push(m); } }
  // seat は座面の高さ（地面から）。座る人は、お尻が座面にのるように下げる
  place(s){ this.spot = s; this.pos.set(s.x, (s.room ? ROOMS[rid(s)].y + (s.dy || 0) : heightAt(s.x, s.z)) + (s.seat !== undefined ? s.seat - 0.39 : 0), s.z); this.yaw = s.ry; }
  // 歩ける場所か（建物・塀・水を避ける）。y の範囲つきの壁は、その高さにいるときだけ
  blocked(x, z, G){ if (heightAt(x, z) < 0.2) return true; const y = this.pos.y;
    for (const c of G.colliders){ if (c.off || (c.y1 !== undefined && (y + 0.5 < c.y0 || y > c.y1))) continue;
      if (c.r !== undefined){ if (Math.hypot(x - c.x, z - c.z) < c.r + 0.3) return true; continue; }
      const dx = x - c.x, dz = z - c.z, r = c.rot || 0, lx = dx*Math.cos(r) - dz*Math.sin(r), lz = dx*Math.sin(r) + dz*Math.cos(r);
      if (Math.abs(lx) < c.w/2 + 0.3 && Math.abs(lz) < c.d/2 + 0.3) return true; }
    return false; }
  // 1歩進む。まっすぐ行けなければ左右にずらして試す。進めたら true
  step(ux, uz, len, G){ for (const off of [0, 0.6, -0.6, 1.2, -1.2]){ const c = Math.cos(off), s = Math.sin(off), vx = ux*c + uz*s, vz = -ux*s + uz*c, x = this.pos.x + vx*len, z = this.pos.z + vz*len;
      if (!this.blocked(x, z, G) || this.blocked(this.pos.x, this.pos.z, G)){ this.pos.x = x; this.pos.z = z; this.pos.y = G.groundAt ? G.groundAt(x, z, this.pos.y + 0.5) : heightAt(x, z); return true; } }
    return false; }
  // ひまにしているか（LLMが行動を決めてよいとき。決まった予定・行事・連れ歩き・作業・掛け合い中は決めない）
  isFree(G){ const s = this.spot; return !!s && !s.room && !s.hide && s.seat === undefined && s.pose === 'idle' && s.k !== 'bon' && !this.pose && !this.override && !this.following && !this.trip && !this.ride && !this.knock && !(this.recover > 0) && !this.back && !this.chatPeer && !G.indoor; }
  // LLMが選んだ行動：1 のんびり、2 歩きまわる、3 主人公のそばへ、4 遠くをながめる
  aiAct(k, G){ if (!this.isFree(G)) return; const s = this.spot, P = G.player;
    if (k === 2){ const a = Math.random()*Math.PI*2, r = 2 + Math.random()*4, x = s.x + Math.sin(a)*r, z = s.z + Math.cos(a)*r; if (!this.blocked(x, z, G)) this.wander = { x, z }; }
    else if (k === 3){ const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz); if (d > 2.2){ const x = P.pos.x - dx/d*1.6, z = P.pos.z - dz/d*1.6; if (Math.hypot(x - s.x, z - s.z) < 12 && !this.blocked(x, z, G)) this.wander = { x, z }; } }
    else if (k === 4){ this.lookYaw = Math.atan2(80 - this.pos.x, 30 - this.pos.z) + (Math.random() - 0.5)*1.2; this.wander = null; }
    this.wanderT = 8 + Math.random()*6; }
  update(dt, G){
    const S = G.state, P = G.player; let pose = 'idle';
    // 軽トラの荷台に乗っている（位置は car.js が毎フレーム合わせる）
    if (G.knockMove && G.knockMove(this, dt)){ if (this.photoT){ this.photoT = 0; this.ch.photoArm = false; this.ch.photoHeadYaw = null; } this.lookUpT = 0; return; }   // はね飛ばされている最中（knock.js）
    if (this.photoT > 0){ this.photoT = Math.max(0, this.photoT - dt); if (this.photoT === 0){ this.ch.photoArm = false; this.ch.photoHeadYaw = null; } }
    if (this.lookUpT > 0) this.lookUpT = Math.max(0, this.lookUpT - dt);
    if (this.ride){ this.root.visible = true; this.ch.shadow.visible = false; this.doing = ''; this.setHold(null); this.root.rotation.y = this.yaw; this.ch.set('sit'); this.ch.update(dt); return; }
    if (this.following){
      const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      const gh = P.room ? P.room.y : G.groundAt(this.pos.x, this.pos.z, this.pos.y);
      if (this.photoT > 0 && gh >= -1){ pose = 'photo'; let a = this.photoYaw - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); this.yaw += a*Math.min(1, dt*12); }
      else {
        if (d > 40){ this.pos.x = P.pos.x - 1.5; this.pos.z = P.pos.z - 1.5; }
        else if (d > (G.aiai === this.id ? 0.8 : 2.1)){ /* 相合傘のときは、すぐそばを歩く */ const sp = d > 6 ? 8.6 : d > 3.2 ? 4.2 : 2.6; this.pos.x += dx/d*sp*dt; this.pos.z += dz/d*sp*dt; pose = sp > 5 ? 'run' : 'walk'; const ty = Math.atan2(dx, dz); let a = ty - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); this.yaw += a*Math.min(1, dt*10); }
        else if (this.pose && gh >= -1){ pose = this.pose; if (d > 0.1){ let a = Math.atan2(dx, dz) - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); this.yaw += a*Math.min(1, dt*10); } }
        else if (this.lookUpT > 0 && gh >= -1){ pose = 'lookup'; if (this.lookUpYaw != null){ let a = this.lookUpYaw - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); this.yaw += a*Math.min(1, dt*8); } }
      }
      if (gh < -1){ pose = 'swim'; this.pos.y += (-0.95 - this.pos.y)*Math.min(1, dt*10); } else this.pos.y += (gh - this.pos.y)*Math.min(1, dt*12);
      this.root.visible = true; this.ch.shadow.visible = gh >= -1;
    } else {
      const bon = S.day === BON.day && S.hour >= BON.from && S.hour < BON.to && BON.slots[this.id] !== undefined;
      const storm = S.day === TYPHOON_DAY ? ((STORM[this.id] && STORM[this.id](S.hour)) || { k:'stormhome', x:this.pos.x, z:this.pos.z, ry:0, pose:'idle', hide:true }) : null;
      const want = this.override || storm || (bon ? { k:'bon', x:BON.x, z:BON.z + BON.r, ry:0, pose:'dance' } : (S.day === 11 && S.hour >= 17 && FINAL[this.id]) ? FINAL[this.id] : SCHED[this.id](S.day, S.hour));
      if (!this.spot || this.spot.k !== want.k){ const far = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) > 28 || !this.spot || (this.spot.room && (rid(this.spot) === 'class' ? !G.inSchool : G.indoor !== rid(this.spot))) || this.spot.hide || G.fadeBlack || want.k === 'bon';
        // 外から外への移動は、見えているところでは歩いていく（遠いと走る）。部屋の出入りと、見ていないところでは今までどおり移す
        const outside = !!this.spot && !this.spot.room && !this.spot.hide && !want.room && !want.hide && !G.indoor;
        if (far){ this.place(want); this.trip = null; this.wander = null; }
        else if (outside && (!this.trip || this.trip.k !== want.k) && Math.hypot(want.x - this.pos.x, want.z - this.pos.z) < 160){ this.trip = want; this.wander = null; this.stuck = 0; } }
      // 移動中：目的地へ向かって歩く。ぶつかりそうなら少し向きを変えてよける
      if (this.trip && !this.lock && !(this.photoT > 0)){ const t = this.trip, dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.35){ this.place(t); this.trip = null; this.wanderT = 3 + Math.random()*4; }
        else { const sp = d > 25 ? 3.6 : 1.5, r = this.step(dx/d, dz/d, sp*dt, G); if (!r) this.stuck += dt; else this.stuck = 0;
          if (this.stuck > 3 && Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) > 18){ this.place(t); this.trip = null; }
          this.root.visible = true; this.ch.shadow.visible = true; this.doing = ''; this.setHold(null); let a = Math.atan2(dx, dz) - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); this.yaw += a*Math.min(1, dt*6);
          this.root.rotation.y = this.yaw; this.ch.set(sp > 3 ? 'run' : 'walk'); this.ch.update(dt); return; } }
      // ひまなとき（外で立っている）：まわりを少し歩いて、立ち止まって、あたりを見る
      { const sp0 = this.spot, free = sp0 && !sp0.room && !sp0.hide && sp0.seat === undefined && sp0.pose === 'idle' && sp0.k !== 'bon' && !this.pose && !this.override && !G.indoor;
        const talking = G.lock && Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < 6;
        if (free && !talking && !this.chatPeer && !(this.photoT > 0)){ this.wanderT = (this.wanderT ?? Math.random()*6) - dt;
          if (!this.wander && this.wanderT <= 0){ const a = Math.random()*Math.PI*2, r = 0.8 + Math.random()*2.8, x = sp0.x + Math.sin(a)*r, z = sp0.z + Math.cos(a)*r;
            if (!this.blocked(x, z, G)) this.wander = { x, z }; this.wanderT = 5 + Math.random()*9; this.lookYaw = null; }
          if (this.wander){ const dx = this.wander.x - this.pos.x, dz = this.wander.z - this.pos.z, d = Math.hypot(dx, dz);
            if (d < 0.2 || !this.step(dx/d, dz/d, 1.0*dt, G)){ this.wander = null; this.lookYaw = Math.random()*Math.PI*2; }
            else { let a = Math.atan2(dx, dz) - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); this.yaw += a*Math.min(1, dt*5); this.root.visible = true; this.root.rotation.y = this.yaw; this.ch.set('walk'); this.ch.update(dt); return; } } }
        else if (this.wander){ this.wander = null; } }
      // 盆踊り：輪になって、やぐらのまわりをゆっくり回る
      if (this.spot.k === 'bon'){ const a = (BON.slots[this.id]/BON.n)*Math.PI*2 + G.time*0.11, x = BON.x + Math.sin(a)*BON.r, z = BON.z + Math.cos(a)*BON.r; this.pos.set(x, heightAt(x, z), z); this.spot = { ...this.spot, ry:a + Math.PI/2 }; }
      const s = this.spot; pose = s.pose; this.root.visible = s.room ? (rid(s) === 'class' ? G.world.classroom.visible && G.indoor !== 'home' && G.indoor !== 'shop' && G.indoor !== 'term' : G.indoor === rid(s)) : !s.hide;   // 教室は3階。ほかの階にいるときは（上の階を消しているので）見せない
      let yaw = (this.lookYaw != null && pose === 'idle') ? this.lookYaw : s.ry; const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z;
      if ((pose === 'idle' || this.pose === 'nod' || this.pose === 'wave') && Math.hypot(dx, dz) < 4.5) yaw = Math.atan2(dx, dz);
      const peer = this.chatPeer && G.npcs && G.npcs[this.chatPeer];
      if (peer && pose !== 'sit' && s.seat === undefined && !this.pose) yaw = Math.atan2(peer.pos.x - this.pos.x, peer.pos.z - this.pos.z);
      if (this.pose) pose = this.pose;
      const seated = pose === 'sit' || s.seat !== undefined;
      if (this.lookUpT > 0 && !seated && !this.pose && !(this.photoT > 0)){ pose = 'lookup'; if (this.lookUpYaw != null) yaw = this.lookUpYaw; }
      if (this.photoT > 0 && !seated){ pose = 'photo'; yaw = this.photoYaw; }
      let a = yaw - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); this.yaw += a*Math.min(1, dt*6);
    }
    // 作業中は、していることに合わせた姿勢と持ち物にする
    let hold = null; this.doing = '';
    if (!this.following && !this.pose && !(this.photoT > 0) && this.spot && pose === 'work'){
      if (rid(this.spot) === 'class'){ if (S.prep < 5){ pose = 'craft'; hold = KIND[S.prep]; this.doing = PREP_TASKS[S.prep].doing; } else { pose = 'idle'; this.doing = 'できあがった教室をながめている'; } }
      else if (this.id === 'kotoha'){ pose = 'sketch'; hold = 'sketch'; this.doing = 'スケッチをしている'; } }
    this.setHold(hold);
    this.root.rotation.y = this.yaw; this.ch.set(pose); this.ch.update(dt);
  }
}
