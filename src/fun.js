// 「できたら面白い」ことの演出：ゴールの豪華演出、受け身・飛びこみ・大ジャンプの高さ表示、スローモーション。
import * as THREE from 'three';
import { audio } from './audio.js';
import { NAMES } from '../data/story.js';
export function setupFun(G){
  const P = G.player, scene = G.scene, fx = [];
  G.timeScale = 1;
  const slow = (k, ms) => { G.timeScale = k; clearTimeout(slow.t); slow.t = setTimeout(() => { G.timeScale = 1; }, ms); };   // 実時間で ms のあいだ
  // 大きな文字を画面のまんなかに出す
  const banner = document.createElement('div'); banner.id = 'banner'; banner.className = 'hidden'; document.body.appendChild(banner);
  const show = (big, small, cls = '') => { banner.innerHTML = `<b>${big}</b>${small ? `<i>${small}</i>` : ''}`; banner.className = cls; void banner.offsetWidth; banner.classList.add('pop'); clearTimeout(show.t); show.t = setTimeout(() => banner.className = 'hidden', 2600); };
  G.banner = show;
  // 紙吹雪（重さのある小さな紙が、ひらひら落ちる）
  const confetti = (pos, n = 260) => { const g = new THREE.BufferGeometry(), p = new Float32Array(n*3), col = new Float32Array(n*3), v = [], c = new THREE.Color();
    for (let i = 0; i < n; i++){ p.set([pos.x, pos.y + 1, pos.z], i*3); const a = Math.random()*6.28, s = 3 + Math.random()*7; v.push([Math.cos(a)*s*0.6, 6 + Math.random()*9, Math.sin(a)*s*0.6, Math.random()*6]); c.setHSL(Math.random(), 0.85, 0.6); col.set([c.r, c.g, c.b], i*3); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size:5, sizeAttenuation:false, vertexColors:true, transparent:true, depthWrite:false })); m.frustumCulled = false; scene.add(m); let t = 0;
    fx.push(dt => { t += dt; for (let i = 0; i < n; i++){ const q = v[i]; q[1] -= 9*dt; q[1] = Math.max(q[1], -1.6 - Math.sin(t*4 + q[3])*0.6); q[0] *= 1 - dt*0.8; q[2] *= 1 - dt*0.8;   // 空気の抵抗で、ゆっくり舞い落ちる
        p[i*3] += (q[0] + Math.sin(t*3 + q[3])*0.8)*dt; p[i*3 + 1] += q[1]*dt; p[i*3 + 2] += (q[2] + Math.cos(t*3 + q[3])*0.8)*dt; }
      g.attributes.position.needsUpdate = true; m.material.opacity = Math.min(1, (5 - t)/1.5); if (t > 5){ scene.remove(m); g.dispose(); m.material.dispose(); return false; } }); };
  // 打ち上げ花火（ゴールの上で、ぱっと開く）
  const pop = (pos, delay) => setTimeout(() => { const n = 90, g = new THREE.BufferGeometry(), p = new Float32Array(n*3), v = []; const c = new THREE.Vector3(pos.x + (Math.random() - 0.5)*8, pos.y + 14 + Math.random()*6, pos.z + (Math.random() - 0.5)*8);
      for (let i = 0; i < n; i++){ p.set([c.x, c.y, c.z], i*3); const a = Math.random()*6.28, b = Math.acos(Math.random()*2 - 1), s = 7 + Math.random()*2; v.push([Math.sin(b)*Math.cos(a)*s, Math.cos(b)*s, Math.sin(b)*Math.sin(a)*s]); }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const m = new THREE.Points(g, new THREE.PointsMaterial({ color:new THREE.Color().setHSL(Math.random(), 0.9, 0.62), size:4, sizeAttenuation:false, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
      m.frustumCulled = false; scene.add(m); audio.burst(0.7, 200, 0.5, { echo:true }); let t = 0;
      fx.push(dt => { t += dt; for (let i = 0; i < n; i++){ v[i][1] -= 5*dt; p[i*3] += v[i][0]*dt; p[i*3 + 1] += v[i][1]*dt; p[i*3 + 2] += v[i][2]*dt; v[i][0] *= 0.98; v[i][2] *= 0.98; } g.attributes.position.needsUpdate = true; m.material.opacity = Math.max(0, 1 - t/1.6); if (t > 1.6){ scene.remove(m); g.dispose(); return false; } }); }, delay);
  // ゴールの豪華演出。id が人なら「人をゴールに入れた」
  G.celebrate = (id, pos) => { const st = G.state, who = id ? NAMES[id] : null;
    slow(0.25, 1700); confetti(pos); for (let i = 0; i < 5; i++) pop(pos, 500 + i*380);
    [523, 659, 784, 1047, 1319].forEach((f, i) => audio.tone(f, 0.28, { type:'square', vol:0.08, when:0.1 + i*0.11 })); audio.tone(1047, 0.9, { type:'triangle', vol:0.1, when:0.7 });
    for (let i = 0; i < 6; i++) audio.burst(0.9, 1400 + i*120, 0.07, { type:'bandpass', when:0.2 + i*0.15 });   // 歓声
    show(id ? 'ゴーーーール！！' : 'ゴール！！', id ? `${who}がゴールに飛びこんだ！` : '', 'goal');
    // カメラ：ゴールのほうを向く
    if (!P.camOverride && !G.lock){ const old = P.camYaw; P.camYaw = Math.atan2(P.pos.x - pos.x, P.pos.z - pos.z); setTimeout(() => {}, 0); }
    if (id && G.observe) G.observe('goal', pos.x, pos.z, { who, except:id });
    if (id){ st.humanGoals = (st.humanGoals || 0) + 1; if (!st.today['hgoal_' + id]){ st.today['hgoal_' + id] = true; G.api.log(`${who}を吹っ飛ばして、ゴールに入れてしまった。校庭に歓声がひびいた（気がした）。`); } } };
  // 着地の技：受け身・飛びこみ・自転車の大ジャンプ・軽トラの大ジャンプ
  G.trick = (kind, h) => { const st = G.state, m = h.toFixed(1);
    if (G.observe) G.observe({ roll:'flip', dive:'dive', bike:'jump', car:'jump' }[kind] || 'jump', P.pos.x, P.pos.z, { h:m });
    if (kind === 'roll'){ audio.burst(0.15, 300, 0.4);   /* 受け身は文字を出さない（動きと音だけ） */ audio.burst(0.3, 1800, 0.08, { type:'highpass', when:0.1 }); G.puff && G.puff(P.pos.x, P.pos.y, P.pos.z, 1.6);
      if (h > 6) slow(0.4, 500); if (!st.today.rollLog){ st.today.rollLog = true; G.api.log(h > 6 ? `${m}mの高さから飛び降りて、受け身をとった。足がじんじんした。` : '高いところから飛び降りて、くるっと受け身をとった。'); } }
    else if (kind === 'dive'){ show('飛びこみ！', `${m}m`, 'trick'); if (h > 8 && !st.today.highDive){ st.today.highDive = true; G.api.log(`${m}mの高さから、海に飛びこんだ。`); } }
    else if (kind === 'bike'){ show('大ジャンプ！', `${m}m`, 'trick'); }
    else if (kind === 'car'){ show('軽トラ、空を飛ぶ！', `${m}m`, 'trick'); if (!st.today.carJump){ st.today.carJump = true; G.api.log('軽トラで坂から飛び出した。荷台の荷物が全部浮いた。'); } }
    st.bestDrop = Math.max(st.bestDrop || 0, h); };
  G.funUpdate = dt => { for (let i = fx.length - 1; i >= 0; i--) if (fx[i](dt) === false) fx.splice(i, 1); };
}
