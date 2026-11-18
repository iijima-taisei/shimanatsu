// 軽トラや自転車で人にぶつかると、その人が派手に吹っ飛ぶ（もちろん無傷。起き上がって一言いい、元の場所へ歩いて戻る）
import { heightAt } from './world/terrain.js';
import { audio } from './audio.js';
import { NAMES, KNOCK } from '../data/story.js';
import { KNOCK2 } from '../data/talk.js';
// 吹っ飛ばされたときのひとことを、前と同じにならないように選ぶ
const lastKnock = {};
export const knockLine = id => { const a = KNOCK2[id] || [KNOCK[id] || 'わっ！']; let i = Math.floor(Math.random()*a.length); if (a.length > 1 && i === lastKnock[id]) i = (i + 1) % a.length; lastKnock[id] = i; return a[i]; };
export function setupKnock(G){
  const P = G.player;
  // ぶつかったかを調べる（毎フレーム）
  G.knockUpdate = dt => { if (G.mode !== 'play' || G.lock) return;
    let src = null, v = 0, fx = 0, fz = 0, reach = 0;
    if (P.driving){ v = Math.abs(P.carSpeed); const s = Math.sign(P.carSpeed) || 1; fx = Math.sin(P.yaw)*s; fz = Math.cos(P.yaw)*s; src = [P.pos.x + fx*1.0, P.pos.z + fz*1.0]; reach = 1.5; }
    else if (P.riding){ v = P.bikeSpeed; fx = Math.sin(P.yaw); fz = Math.cos(P.yaw); src = [P.pos.x + fx*0.6, P.pos.z + fz*0.6]; reach = 0.9; }
    if (!src || v < 3) return;
    for (const id in G.npcs){ const n = G.npcs[id]; if (!n.root.visible || n.ride || n.knock || n.recover > 0 || (n.spot && n.spot.room)) continue;
      const dx = n.pos.x - src[0], dz = n.pos.z - src[1]; if (Math.hypot(dx, dz) > reach || Math.abs(n.pos.y - P.pos.y) > 1.6) continue;
      // 進む向きに、少し横へずらして飛ばす
      const side = Math.sign(dx*fz - dz*fx) || 1, hs = 4 + v*0.9, up = 6.5 + v*0.5;
      G.knockNpc(n, fx*hs + fz*side*hs*0.35, up, fz*hs - fx*side*hs*0.35, id);
      audio.burst(0.12, 260, 0.55); audio.tone(880, 0.12, { type:'square', vol:0.06 }); audio.tone(1320, 0.18, { type:'square', vol:0.05, when:0.08 });
      if (P.driving) P.carSpeed *= 0.75; else P.bikeSpeed *= 0.6;
      setTimeout(() => G.speak(id, knockLine(id)), 900);   // 本人のひとことは頭の上の吹き出し
      const st = G.state; if (!st.today['knock_' + id]){ st.today['knock_' + id] = true; G.api.log(`うっかり${P.driving ? '軽トラ' : '自転車'}で${NAMES[id]}をはね飛ばしてしまった。${NAMES[id]}は、なぜか無傷だった。`); } }
    // とめてある自転車にぶつかったら、自転車ごと吹っ飛ぶ
    for (const b of G.world.bikes){ if (b === P.riding || b.fly) continue; const m = b.mesh.position, dx = m.x - src[0], dz = m.z - src[1]; if (Math.hypot(dx, dz) > reach + 0.2 || Math.abs(m.y - P.pos.y) > 1.6) continue;
      G.observe && G.observe('bikefly', m.x, m.z);
      const side = Math.sign(dx*fz - dz*fx) || 1, hs = 3.5 + v*0.85; b.fly = { vx:fx*hs + fz*side*hs*0.4, vz:fz*hs - fx*side*hs*0.4, vy:5 + v*0.45, sx:(Math.random() - 0.5)*14, sy:(Math.random() - 0.5)*10, sz:(Math.random() - 0.5)*14 };
      audio.burst(0.1, 900, 0.35); audio.tone(1500, 0.06, { type:'square', vol:0.05 }); audio.tone(1900, 0.08, { type:'square', vol:0.04, when:0.05 }); if (P.driving) P.carSpeed *= 0.9; else P.bikeSpeed *= 0.7;
      if (!G.state.today.knockBike){ G.state.today.knockBike = true; G.api.log('とめてあった自転車にぶつかって、自転車が空を飛んだ。'); } } };
  // 飛んでいる自転車を動かす（毎フレーム）。地面に落ちたら横倒しのまま。翌朝、元の場所に戻る
  G.bikesFlyUpdate = dt => { for (const b of G.world.bikes){ const f = b.fly; if (!f) continue; const m = b.mesh; f.vy -= 20*dt; m.position.x += f.vx*dt; m.position.z += f.vz*dt; m.position.y += f.vy*dt;
      m.rotation.x += f.sx*dt; m.rotation.y += f.sy*dt; m.rotation.z += f.sz*dt; const gh = G.groundAt ? G.groundAt(m.position.x, m.position.z, m.position.y + 0.3) : heightAt(m.position.x, m.position.z);
      if (m.position.y <= gh && f.vy < 0){ m.position.y = gh + 0.02; if (Math.abs(f.vy) > 4 && Math.random() < 0.7){ f.vy = -f.vy*0.35; f.vx *= 0.6; f.vz *= 0.6; audio.burst(0.06, 1200, 0.15); } else { b.fly = null; m.rotation.set(0, m.rotation.y, Math.PI/2*0.92, 'YXZ'); audio.burst(0.1, 700, 0.2); } } } };
  // 人を吹っ飛ばす（車・自転車・ボール・ほかの吹っ飛んだ人から）。vx,vy,vz は初速
  const GOALS = [{ x:3, dir:-1 }, { x:53, dir:1 }];   // 校庭のゴール（ゴールラインの x と、外向き）
  G.knockNpc = (n, vx, vy, vz, id) => { if (n.knock || n.ride || n.recover > 0) return;
    G.observe && G.observe('knock', n.pos.x, n.pos.z, { who:NAMES[id], except:id, how:P.driving ? '軽トラ' : P.riding ? (P.riding.kind === 'moped' ? '原付' : '自転車') : 'ボールか体当たり' }); n.knock = { vx, vy, vz, sx:(5 + Math.random()*8)*(Math.random() < 0.5 ? -1 : 1), sz:(Math.random() - 0.5)*7, rx:0, rz:0, bounces:0, home:n.spot ? { ...n.spot } : (n.back || null), px:n.pos.x, goal:false };
    n.wasFollowing = n.following; n.following = false; n.back = null; };
  // 飛んでいる人を動かす。npc.js の update の最初から呼ばれ、true を返したら通常の動きはしない
  G.knockMove = (n, dt) => {
    if (n.knock){ const k = n.knock, px = n.pos.x; k.vy -= 20*dt; n.pos.x += k.vx*dt; n.pos.z += k.vz*dt; n.pos.y += k.vy*dt; k.rx += k.sx*dt; k.rz += k.sz*dt;
      if (G.bounceWalls(n.pos, k)) audio.burst(0.06, 300, 0.2);
      // ゴールに飛びこんだら、豪華演出
      if (!k.goal) for (const g of GOALS){ if (Math.sign(px - g.x) !== Math.sign(n.pos.x - g.x) && n.pos.z > -35.6 && n.pos.z < -28.4 && n.pos.y < heightAt(n.pos.x, n.pos.z) + 2.6){ k.goal = true; k.vx *= 0.25; k.vz *= 0.25; G.celebrate && G.celebrate(n.id, n.pos); } }
      // 飛んでいる人が、ほかの人に当たったら、その人も飛ぶ
      const sp = Math.hypot(k.vx, k.vz); if (sp > 4) for (const id in G.npcs){ const o = G.npcs[id]; if (o === n || o.knock || o.recover > 0 || !o.root.visible || (o.spot && o.spot.room)) continue;
        if (Math.hypot(o.pos.x - n.pos.x, o.pos.z - n.pos.z) < 0.7 && Math.abs(o.pos.y - n.pos.y) < 1.4){ G.knockNpc(o, k.vx*0.7, 4 + sp*0.3, k.vz*0.7, id); k.vx *= 0.5; k.vz *= 0.5; audio.burst(0.12, 260, 0.45); setTimeout(() => G.api.toast(`${NAMES[id]}「${knockLine(id)}」`, 2600), 700); } }
      const gh = G.groundAt(n.pos.x, n.pos.z, n.pos.y + 0.4), water = gh < -0.8;
      n.ch.shadow.visible = false; n.ch.set('jump'); n.ch.setTumble(k.rx, k.rz, 0); n.root.rotation.y = n.yaw; n.ch.update(dt);
      if (n.pos.y <= Math.max(gh, -0.9) && k.vy < 0){
        if (water){ n.pos.y = -0.9; n.knock = null; n.recover = 2.0; n.wet = true; n.back = k.home; audio.burst(0.6, 700, 0.5); audio.burst(0.9, 2600, 0.12, { type:'highpass', when:0.05 }); G.api.toast('ざぶーん！', 1500); n.ch.setTumble(0, 0, 0); return true; }
        n.pos.y = gh;
        // 地面ではずんで、転がって止まる
        if (k.vy < -6 && k.bounces < 2){ k.bounces++; k.vy *= -0.35; k.vx *= 0.6; k.vz *= 0.6; k.sx *= 0.6; audio.burst(0.08, 400, 0.25); G.puff && G.puff(n.pos.x, gh, n.pos.z, 0.8); return true; }
        k.vy = 0; k.vx *= Math.max(0, 1 - 6*dt); k.vz *= Math.max(0, 1 - 6*dt);
        if (Math.hypot(k.vx, k.vz) < 0.6){ n.knock = null; n.recover = 1.4; n.back = k.home; n.lieRx = Math.round(k.rx/Math.PI)*Math.PI - Math.PI/2*Math.sign(Math.cos(k.rx) || 1)*0; audio.burst(0.08, 400, 0.25); } }
      return true; }
    if (n.recover > 0){ n.recover -= dt; const k = Math.min(1, n.recover/0.4);   // 寝ころんでから、起き上がる
      if (n.wet){ n.ch.set('swim'); n.ch.setTumble(0, 0, 0); n.pos.y = -0.95; } else { n.ch.set('idle'); n.ch.setTumble(-Math.PI/2*k, 0, k); }
      n.ch.update(dt); if (n.recover <= 0){ n.ch.setTumble(0, 0, 0); if (n.wet){ n.wet = false; if (n.back) n.place(n.back); n.back = null; } if (n.wasFollowing){ n.following = true; n.wasFollowing = false; n.back = null; } } return true; }
    // 起き上がったら、元いた場所へ歩いて戻る
    if (n.back && !n.following){ const dx = n.back.x - n.pos.x, dz = n.back.z - n.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.3 || d > 80){ n.place(n.back); n.back = null; return false; }
      const sp = Math.min(3, d*2); n.pos.x += dx/d*sp*dt; n.pos.z += dz/d*sp*dt; n.pos.y = G.groundAt(n.pos.x, n.pos.z, n.pos.y); n.yaw = Math.atan2(dx, dz); n.root.rotation.y = n.yaw; n.ch.shadow.visible = true; n.ch.set('walk'); n.ch.update(dt); return true; }
    return false; };
}
