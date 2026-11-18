// 島でできること：釣り、水切り、セミ取り、足湯、おみくじ、自販機、サッカーボール、飛び込み。
import * as THREE from 'three';
import { say, closeDialogue } from './dialogue.js';
import { heightAt } from './world/terrain.js';
import { audio } from './audio.js';
import { NAMES, STORM_FISH as T_STORM_FISH, STORM_CICADA as T_STORM_CICADA, CRABS, STARGAZE, STARGAZE_FRIEND } from '../data/story.js';
import { isConfirm, keyName, BIND } from './keys.js';
import { knockLine } from './knock.js';
const wait = ms => new Promise(r => setTimeout(r, ms)), rnd = Math.random;
// 釣りの待機時間から、本アタリ直前の予兆回数（1〜2回）と発生時刻を決める
export function planBite(totalMs, r = Math.random()){
  const count = r < 0.5 ? 1 : 2;
  const nibbles = count === 1 ? [Math.round(totalMs*0.68)] : [Math.round(totalMs*0.45), Math.round(totalMs*0.74)];
  return { count, nibbles };
}
// 水切りのタイミング精度（0〜1）から跳ねる回数を決める
export function skipBounces(acc){ return acc > 0.97 ? 12 : 1 + Math.round(Math.pow(acc, 1.6)*10); }
// 飛び込み時の落下高に応じた白い水柱（G.puff）と時間差水輪（ripple）のパラメータ計算
export function computeDiveFxParams(diveH = 0, bike = false){
  const raw = Number.isFinite(diveH) ? diveH : 0;
  const h = Math.max(0, Math.min(14, raw));
  const b = bike ? 1 : 0;
  const count = (h >= 2.5 || bike) ? 3 : 2;
  const ripples = [
    { r0:0.24 + h*0.035, r1:1.55 + h*0.25 + b*0.55, dur:0.70 + h*0.045, op:0.90, y:0.06, delay:0 },
    { r0:0.18 + h*0.025, r1:1.25 + h*0.20 + b*0.45, dur:0.65 + h*0.040, op:0.74, y:0.06, delay:0.13 + h*0.008 },
  ];
  if (count === 3){
    ripples.push({ r0:0.14 + h*0.020, r1:0.98 + h*0.15 + b*0.35, dur:0.60 + h*0.035, op:0.58, y:0.06, delay:0.27 + h*0.014 });
  }
  return {
    column: {
      k: 0.40 + h*0.045 + b*0.20,
      color: 0xf4fbff,
      size: Math.min(9.5, 4.4 + h*0.36 + b*1.0),
      opacity: Math.min(0.96, 0.86 + h*0.008),
      up: 2.8 + h*0.85 + b*1.1,
      n: Math.round(12 + h*1.5 + b*4),
      dur: 0.52 + h*0.05 + b*0.10,
      gravity: 10.5,
    },
    spray: {
      k: 1.15 + h*0.14 + b*0.40,
      color: 0xe8f6fc,
      size: Math.min(8.0, 3.6 + h*0.26 + b*0.7),
      opacity: Math.min(0.92, 0.78 + h*0.010),
      up: 1.45 + h*0.28 + b*0.45,
      n: Math.round(10 + h*1.0 + b*4),
      dur: 0.45 + h*0.035 + b*0.08,
      gravity: 8.5,
    },
    ripples,
  };
}
// 浅瀬・水泳時の移動距離に応じた波紋（ripple）の発生判定と間隔管理
export function stepWaterRipple(tracker, x, z, active, opt = {}){
  const stepDist = opt.stepDist ?? 0.9;
  const maxJump = opt.maxJump ?? 8;
  if (!active){
    tracker.active = false;
    return null;
  }
  if (!tracker.active){
    tracker.active = true;
    tracker.x = x;
    tracker.z = z;
    return { x, z, initial:true };
  }
  const dist = Math.hypot(x - tracker.x, z - tracker.z);
  if (dist > maxJump){
    tracker.x = x;
    tracker.z = z;
    return null;
  }
  if (dist >= stepDist){
    tracker.x = x;
    tracker.z = z;
    return { x, z, dist, initial:false };
  }
  return null;
}
const CICADAS = ['アブラゼミ', 'ミンミンゼミ', 'ツクツクボウシ', 'ヒグラシ'];
const FISH = [['アジ', 30, 18], ['タカベ', 22, 20], ['ムロアジ', 18, 28], ['メジナ', 14, 30], ['カワハギ', 10, 22], ['イサキ', 5, 32], ['シマアジ', 1, 45]];
const WITH = {   // 友達といっしょのときの一言
  fish: { nagisa:'やるじゃん！　今夜のおかず、決まりだね', kouta:'おっ、いい型！　じいちゃんに見せたら喜ぶぞ', kotoha:'……きれい。うろこが、虹みたいに光ってる' },
  skip: { nagisa:'あたしもやる！　……えいっ。あ、沈んだ', kouta:'甘いな。手首だよ、手首。見てろよ', kotoha:'石が、水の上を歩いてるみたい' },
  onsen: { nagisa:'はー……。もう今日はここから動きたくない', kouta:'海のあとの足湯、最高だろ？', kotoha:'……あったかい。ねむくなってきた' },
  crab: { nagisa:'わっ、元気いい！　はさまれないでね', kouta:'おっ、いい動き！　岩のすきま、うじゃうじゃいるよな', kotoha:'……甲羅の模様、よく見るときれい' },
};
export function setupActivities(G){
  const P = G.player, W = G.world, I = G.interact, S = () => G.state, { toast, log, fade, friend } = G.api;
  const once = (key, text) => { const t = S().today; if (!t[key]){ t[key] = true; log(text); } };
  const withFriend = async kind => { const id = G.companion; if (!id) return; await say(NAMES[id], WITH[kind][id]); if (!S().today['w_' + kind]){ S().today['w_' + kind] = true; friend(id, 1); } };
  const free = () => !G.indoor && !P.riding && !P.driving && !P.swimming && P.air <= 0;
  // 決定キーが押されるのを待つ（ms 以内に押されたら true）
  const waitKey = ms => new Promise(res => { let done = false; const fin = v => { if (done) return; done = true; removeEventListener('keydown', h); clearTimeout(t); res(v); };
    const h = e => { if (!e.repeat && isConfirm(e.code)) fin(true); }; addEventListener('keydown', h); const t = setTimeout(() => fin(false), ms); });

  // タイミングのゲージ。ゆれる印が真ん中に来たときに押すほど 1 に近い値を返す
  const gauge = (title, ms=6000, hint='ここで投げる', onTick=null) => new Promise(res => { const el = document.createElement('div'); el.className = 'gauge';
    el.innerHTML = `<div class="gtitle">${title}</div><div class="gbar"><i class="gzone"></i><b></b></div><div class="ghint">［${keyName(BIND.interact)}］${hint}</div>`; document.body.appendChild(el);
    const mark = el.querySelector('b'), t0 = performance.now(); let raf = 0, done = false; const pos = () => { const t = (performance.now() - t0)/1000*1.15; return 1 - Math.abs((t % 2) - 1); };   // 0→1→0 と往復する
    const step = () => { const p = pos(); mark.style.left = (p*100) + '%'; onTick && onTick(p, (performance.now() - t0)/1000); };
    const draw = () => { step(); raf = requestAnimationFrame(draw); }; draw(); const iv = setInterval(step, 30);
    const fin = v => { if (done) return; done = true; cancelAnimationFrame(raf); clearInterval(iv); removeEventListener('keydown', h, true); clearTimeout(to); setTimeout(() => el.remove(), 350); res(v); };
    const h = e => { if (!e.repeat && isConfirm(e.code)){ e.preventDefault(); e.stopImmediatePropagation(); const p = pos(); mark.style.left = (p*100) + '%'; el.classList.add('ghit'); fin(Math.max(0, 1 - Math.abs(p - 0.5)*2)); } };
    addEventListener('keydown', h, true); const to = setTimeout(() => fin(0.1), ms); });

  // 水面・足元の軽量エフェクト（三角形を増やさない LineLoop 水輪）
  const fx = [];
  const ringPts = []; for (let i = 0; i < 20; i++){ const a = i/20*Math.PI*2; ringPts.push(Math.cos(a), 0, Math.sin(a)); }
  const ringGeo = new THREE.BufferGeometry(); ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringPts, 3));
  const ripple = (x, z, { r0=0.12, r1=0.95, dur=0.6, op=0.75, y=0.06, color=0xf4fbff, delay=0 }={}) => {
    if (!G.scene) return;
    let mat = null, line = null, t = -delay;
    const spawn = () => {
      mat = new THREE.LineBasicMaterial({ color, transparent:true, opacity:op, depthWrite:false });
      line = new THREE.LineLoop(ringGeo, mat);
      line.position.set(x, y, z);
      line.scale.setScalar(r0);
      G.scene.add(line);
    };
    if (delay <= 0) spawn();
    fx.push(dt => {
      t += dt;
      if (t < 0) return;
      if (!line) spawn();
      const u = Math.min(1, t/dur), ease = 1 - (1 - u)*(1 - u);
      line.scale.setScalar(r0 + (r1 - r0)*ease); mat.opacity = op*(1 - u);
      if (t >= dur){ G.scene.remove(line); mat.dispose(); return false; }
    });
  };
  // 飛び込み時の水柱と時間差の多重水輪を発生させる
  const emitDiveSplash = (x, z, diveH, bike = false) => {
    const p = computeDiveFxParams(diveH, bike);
    if (G.puff){
      G.puff(x, 0.05, z, p.column.k, p.column);
      G.puff(x, 0.05, z, p.spray.k, p.spray);
    }
    for (const r of p.ripples) ripple(x, z, r);
  };
  // 立ち位置から最も近い海面（heightAt < -0.1）の方向と距離を探す
  const findSea = (x, z, maxD=24) => {
    let best = null;
    for (let i = 0; i < 16; i++){ const th = i/16*Math.PI*2;
      for (let d = 3; d <= maxD; d += 1.5){ const sx = x + Math.sin(th)*d, sz = z + Math.cos(th)*d;
        if (heightAt(sx, sz) < -0.1){ if (!best || d < best.d) best = { yaw:th, d, x:sx, z:sz }; break; } } }
    return best;
  };
  // 釣り中だけ出す一時的なウキ（終了時に破棄して常設三角形数に影響させない）
  const makeBobber = (x, z) => {
    if (!G.scene) return null;
    const grp = new THREE.Group();
    const g1 = new THREE.CylinderGeometry(0.032, 0.022, 0.14, 6), m1 = new THREE.MeshBasicMaterial({ color:0xf6f3e8 });
    const g2 = new THREE.CylinderGeometry(0.036, 0.036, 0.09, 6), m2 = new THREE.MeshBasicMaterial({ color:0xe84838 });
    const body = new THREE.Mesh(g1, m1), top = new THREE.Mesh(g2, m2); top.position.y = 0.1; grp.add(body, top);
    grp.position.set(x, 0, z); G.scene.add(grp);
    return { grp, dispose(){ G.scene.remove(grp); g1.dispose(); g2.dispose(); m1.dispose(); m2.dispose(); } };
  };

  // ---- 釣り（桟橋）----
  const fishing = async () => { const st = S(); if (G.weatherNow.wind > 0.6){ await say('', T_STORM_FISH); return; } if (st.hour > 19.6){ await say('', '暗くて、うきが見えない。釣りは明るいうちにしよう。'); return; }
    const sea = findSea(P.pos.x, P.pos.z, 18);
    const fxX = sea ? sea.x + Math.sin(sea.yaw)*1.5 : P.pos.x + Math.sin(P.yaw)*4;
    const fxZ = sea ? sea.z + Math.cos(sea.yaw)*1.5 : P.pos.z + Math.cos(P.yaw)*4;
    if (sea) P.yaw = sea.yaw;
    P.pose = 'work'; await say('', 'しかけを投げた。うきが波にゆれている。\n「！」が出たら、すぐにEを押す。'); closeDialogue();
    const bobber = makeBobber(fxX, fxZ);
    let phase = 'wait', nibbleUntil = 0, bobAlive = true;
    if (bobber) fx.push(() => { if (!bobAlive) return false;
      if (phase === 'bite') bobber.grp.position.set(fxX, -0.18 + Math.sin(G.time*26)*0.02, fxZ);
      else if (phase === 'catch') bobber.grp.position.set(fxX, 0.55, fxZ);
      else if (G.time < nibbleUntil) bobber.grp.position.set(fxX + Math.sin(G.time*48)*0.035, -0.05 - Math.abs(Math.sin(G.time*36))*0.06, fxZ + Math.cos(G.time*42)*0.025);
      else bobber.grp.position.set(fxX, Math.sin(G.time*2.4)*0.035, fxZ); });
    const timers = [];
    try {
      toast('……', 7000);
      const totalWait = 1500 + rnd()*3300;
      const { nibbles } = planBite(totalWait, rnd());
      for (const at of nibbles) timers.push(setTimeout(() => {
        nibbleUntil = G.time + 0.28; ripple(fxX, fxZ, { r0:0.1, r1:0.55, dur:0.55, op:0.65 });
        audio.fishNibble(); toast('……ぴくっ', 450);
      }, at));
      let early = false;
      try { early = await waitKey(totalWait); }
      finally { for (const t of timers) clearTimeout(t); }
      if (early){ toast('早すぎた。魚は逃げてしまった', 1500); await wait(450); P.pose = null; st.hour += 0.25; return; }
      phase = 'bite'; ripple(fxX, fxZ, { r0:0.16, r1:1.1, dur:0.65, op:0.85 });
      audio.tone(1200, 0.1, { type:'square', vol:0.08 }); audio.tone(1700, 0.16, { type:'square', vol:0.08, when:0.09 }); toast('！', 900);
      const hit = await waitKey(900); st.hour += 0.4; P.pose = null;
      if (!hit){ toast('えさだけ取られた。……もう一回。', 2000); return; }
      phase = 'catch';
      G.puff && G.puff(fxX, 0.08, fxZ, 1.35, { color:0xe8f6fc, size:4.8, opacity:0.9, up:1.8 });
      ripple(fxX, fxZ, { r0:0.18, r1:1.4, dur:0.75, op:0.9 });
      setTimeout(() => ripple(fxX, fxZ, { r0:0.1, r1:1.0, dur:0.6, op:0.7 }), 120);
      let r = rnd()*100, f = FISH[0]; for (const c of FISH){ if ((r -= c[1]) < 0){ f = c; break; } }
      const cm = Math.round(f[2]*(0.8 + rnd()*0.5)); st.fish = (st.fish || 0) + 1; audio.fishCatch(); G.snap();
      await say('', `${f[0]}が釣れた！（${cm}センチ）` + (f[0] === 'シマアジ' ? '\n港の人が見たらうらやましがる大物だ。' : '') + `\nこれまでに釣った魚：${st.fish}匹`);
      once('fishLog', `港で${f[0]}を釣った。`); await withFriend('fish');
      G.observe && G.observe('fish', P.pos.x, P.pos.z, { fish:f[0], friendsOnly:true, maxDist:18, cooldown:5 });
    } finally { bobAlive = false; for (const t of timers) clearTimeout(t); if (bobber) bobber.dispose(); P.pose = null; } };
  for (const [x, z] of [[-270.5, 68.3], [-248, 68.3]]) I.push({ x, z, r:2.0, when: free, label:'釣りをする', act: fishing });

  // ---- 水切り（浜）----
  // 水切り：投げる瞬間のタイミングで、はねる回数が決まる（運ではなく腕）
  const skipping = async () => { const st = S(); const sea = findSea(P.pos.x, P.pos.z, 24); const seaYaw = sea ? sea.yaw : Math.PI/2, seaD = sea ? sea.d : 7; P.yaw = seaYaw;
    await say('', '平たい石をえらんだ。手首を返して、水面すれすれに投げる。'); closeDialogue();
    const sx = P.pos.x + Math.sin(seaYaw)*seaD, sz = P.pos.z + Math.cos(seaYaw)*seaD;
    let inZone = false, nextCue = 0, acc = 0.1;
    P.pose = 'craft';
    try {
      acc = await gauge('水切り　印がまんなかに来たら投げる', 6000, 'ここで投げる', (p, elapsed) => {
        const near = Math.abs(p - 0.5) < 0.09;
        if (near && !inZone && elapsed >= nextCue){
          nextCue = elapsed + 0.22;
          audio.skipCue ? audio.skipCue() : audio.tone(980, 0.05, { type:'triangle', vol:0.045, slide:1.12 });
          ripple(sx, sz, { r0:0.08, r1:0.48, dur:0.4, op:0.5 });
        }
        inZone = near;
      });
    } finally { if (P.pose === 'craft') P.pose = null; }
    P.pose = 'wave'; setTimeout(() => { if (P.pose === 'wave') P.pose = null; }, 500);
    const n = skipBounces(acc); let lastX = sx, lastZ = sz;
    for (let i = 0; i < n; i++){
      const d = seaD + 0.8 + i*1.35, rx = P.pos.x + Math.sin(seaYaw)*d, rz = P.pos.z + Math.cos(seaYaw)*d; lastX = rx; lastZ = rz;
      audio.skipBounce(i); ripple(rx, rz, { r0:0.12, r1:0.75 + Math.min(0.4, i*0.04), dur:0.55, op:0.8 });
      G.puff && G.puff(rx, 0.05, rz, 0.55, { color:0xe8f6fc, size:3.2, opacity:0.65, up:0.8 });
      toast('ぴっ'.repeat(i + 1), 700); await wait(Math.max(110, 300 - i*24));
    }
    audio.burst(0.25, 900, 0.1); ripple(lastX, lastZ, { r0:0.15, r1:1.1, dur:0.65, op:0.75 }); await wait(350); const best = n > (st.skip || 0); if (best) st.skip = n; st.hour += 0.12;
    once('skipLog', '浜で水切りをした。'); if (best && n >= 5) log(`水切りで${n}回はねた。新記録。`);
    if (acc < 0.35 && !best){ toast(`${n}回はねた。……手首の返しが早すぎた。（記録：${st.skip}回）`, 2200); return; }
    await say('', `${n}回はねた！` + (acc > 0.97 ? '\nこれ以上ないくらい、きれいに決まった。' : acc < 0.35 ? '\n手首の返しが早すぎた。' : '') + (best ? '\n新記録だ。' : `\n（これまでの記録：${st.skip}回）`));
    await withFriend('skip');
    if (n >= 5) G.observe && G.observe('skip', P.pos.x, P.pos.z, { n, friendsOnly:true, maxDist:18, cooldown:5 }); };
  I.push({ x:100, z:22, r:6, when: () => free() && heightAt(P.pos.x, P.pos.z) > 0.15, label:'水切りをする', act: skipping });
  I.push({ x:-203, z:55, r:4.5, when: () => free() && heightAt(P.pos.x, P.pos.z) > 0.15, label:'水切りをする', act: skipping });

  // ---- セミ取り（木）----
  W.trees.forEach((t, i) => I.push({ x:t.x, z:t.z, r:1.9, label:'セミをさがす', when: () => free() && S().hour > 6.5 && S().hour < 19 && !(S().today.bugTrees || []).includes(i), act: async () => { const st = S();
    if (G.weatherNow.rain > 0.15){ await say('', T_STORM_CICADA); return; } (st.today.bugTrees = st.today.bugTrees || []).push(i); P.pose = 'lookup'; await say('', '幹の高いところでセミが鳴いている。\n息を止めて、そっと手をのばした。'); P.pose = null;
    // そっと近づいたか（直前に走ったり跳んだりしていないか）で、捕まえやすさが変わる
    const quiet = G.time - loudAt > 1.5 && performance.now() - (P.loudT || 0) > 1500;
    const hasNet = S().items && S().items.net; if (hasNet){ G.showNet(true); setTimeout(() => G.showNet(false), 1800); }
    if (rnd() < (quiet ? (hasNet ? 0.04 : 0.12) : (hasNet ? 0.4 : 0.75))){ audio.burst(0.35, 6000, 0.14, { type:'bandpass' }); closeDialogue(); toast(quiet ? 'ジジッ！　……逃げられた。おまけに、おしっこをかけられた。' : 'ジジッ！　足音で気づかれた。そっと歩いて近づけばよかった。', 2600); return; }
    const name = st.hour >= 16.5 ? 'ヒグラシ' : (st.day >= 6 && rnd() < 0.45 ? 'ツクツクボウシ' : rnd() < 0.5 ? 'ミンミンゼミ' : 'アブラゼミ'); st.bugs = st.bugs || []; const isNew = !st.bugs.includes(name); if (isNew) st.bugs.push(name);
    audio.bugCatch();
    const bx = P.pos.x + Math.sin(P.yaw)*0.7, bz = P.pos.z + Math.cos(P.yaw)*0.7;
    G.puff && G.puff(bx, P.pos.y + 1.45, bz, 0.95, { color:0xe9f7b0, size:3.8, opacity:0.85, up:1.8 });
    setTimeout(() => G.puff && G.puff(bx, P.pos.y + 1.9, bz, 0.7, { color:0xa8d96e, size:3.0, opacity:0.75, up:2.1 }), 110);
    await say('', `${name}をつかまえた。\nしばらく手の中で鳴かせて、空に放した。` + (isNew ? `\n（見つけたセミ：${st.bugs.length} / ${CICADAS.length} 種類）` : '')); once('bugLog', `${name}をつかまえて、放してやった。`);
    G.observe && G.observe('bug', P.pos.x, P.pos.z, { bug:name, friendsOnly:true, maxDist:18, cooldown:5 }); } }));

  // ---- 足湯（温泉）----
  I.push({ x:-182, z:30, r:5.6, when: free, label:'足湯につかる', act: async () => { const st = S(); await fade(true); st.hour += 0.7;
    // 石の縁（中心から4.2m、高さ0.5m）に腰かけ、靴をぬいで足をお湯に入れる
    { const cx = -182, cz = 30, a = Math.atan2(P.pos.z - cz, P.pos.x - cx); P.pos.x = cx + Math.cos(a)*4.2; P.pos.z = cz + Math.sin(a)*4.2; P.yaw = Math.atan2(cx - P.pos.x, cz - P.pos.z); P.sitting = true; P.seatDrop = 0.5 - 0.39; P.ch.setBarefoot(true); P.camYaw = P.yaw + Math.PI + 0.6;
      const c = G.companion ? G.npcs[G.companion] : null;
      if (c){ if (c.knock || c.recover > 0){ c.knock = null; c.recover = 0; c.wet = false; c.back = null; c.wasFollowing = false; c.following = true; c.ch.setTumble(0, 0, 0); }
        const ca = a + 0.19, nx = cx + Math.cos(ca)*4.2, nz = cz + Math.sin(ca)*4.2, cyaw = Math.atan2(cx - nx, cz - nz), drop = 0.5 - 0.39;
        c.seatTogether = { x:nx, z:nz, yaw:cyaw, seatDrop:drop, barefoot:true };
        c.pos.set(nx, (G.groundAt ? G.groundAt(nx, nz, heightAt(nx, nz) + 0.5) : heightAt(nx, nz)) + drop, nz);
        c.yaw = cyaw; if (c.root) c.root.rotation.y = cyaw; c.ch.setBarefoot(true); c.ch.set('sit'); c.ch.update(1); } }
    await fade(false); G.snap();
    const eve = st.hour > 17.2 && st.hour < 19.4;
    await say('', eve ? '石の柱のあいだに夕日が落ちていく。\nお湯も空も、同じ色になった。' : 'ぬるめのお湯に足首までつかる。\n波の音と、遠くの船のエンジンの音。'); await say('', '……足の指がふやけてきた。'); once('onsenLog', eve ? '石柱の湯で、夕日を見ながら足湯につかった。' : '石柱の湯で足湯につかった。'); await withFriend('onsen'); toast('歩くと、お湯から上がって靴をはく', 2600); } });   // 歩きだすまで、足はお湯の中

  // ---- 磯のカニさがし ----
  const nearbySway = (x, z, r=9) => {
    const out = [];
    for (const s of W.shells || []) if (s.mesh && s.mesh.visible && Math.hypot(s.x - x, s.z - z) < r) out.push({ m:s.mesh, rz:s.mesh.rotation.z });
    for (const b of G.bodies || []) if (b.m && b.m.visible && !b.moving && Math.hypot(b.m.position.x - x, b.m.position.z - z) < r) out.push({ m:b.m, rz:b.m.rotation.z });
    return out.slice(0, 3);
  };
  const crabHunt = async () => { const st = S(); await say('', '潮だまりの岩をそっとのぞきこんだ。小さなはさみが動いている。'); closeDialogue();
    const swayList = nearbySway(P.pos.x, P.pos.z), hx = P.pos.x + Math.sin(P.yaw)*1.2, hz = P.pos.z + Math.cos(P.yaw)*1.2;
    let nextScuttle = 0.25, acc = 0.1;
    try {
      acc = await gauge('カニさがし　岩かげから出たところでつかまえる', 6000, 'ここでつかまえる', (p, elapsed) => {
        for (const o of swayList) o.m.rotation.z = o.rz + Math.sin(elapsed*26)*0.045;
        if (elapsed >= nextScuttle){
          const near = Math.max(0, 1 - Math.abs(p - 0.5)*3);
          nextScuttle = elapsed + (0.48 - near*0.18) + rnd()*0.12;
          audio.crabScuttle(near);
          ripple(hx, hz, { r0:0.06, r1:0.32, dur:0.35, op:0.45, y:Math.max(0.06, heightAt(hx, hz) + 0.04) });
          G.puff && G.puff(hx, heightAt(hx, hz), hz, 0.35, { color:0xd8ceb4, size:2.6, opacity:0.55, up:0.35 });
        }
      });
    } finally { for (const o of swayList) o.m.rotation.z = o.rz; }
    P.pose = 'craft'; setTimeout(() => { if (P.pose === 'craft') P.pose = null; }, 600); st.hour += 0.2;
    if (acc < 0.38){ audio.burst(0.08, 900, 0.08); P.pose = null; toast('あ……岩のすきまに逃げこまれた。動きが速い。', 2200); return; }
    const pool = st.hour >= 16 ? [1, 3, 0, 2] : [0, 2, 1, 3]; const name = CRABS[pool[Math.floor(rnd()*pool.length)]];
    st.crabs = st.crabs || []; const isNew = !st.crabs.includes(name); if (isNew) st.crabs.push(name);
    st.today.crab = true; audio.crabCatch();
    { const hy = heightAt(hx, hz), wy = Math.max(0.06, hy + 0.04);
      ripple(hx, hz, { r0:0.12, r1:1.05, dur:0.65, op:0.88, y:wy });
      setTimeout(() => ripple(hx, hz, { r0:0.08, r1:0.75, dur:0.5, op:0.65, y:wy }), 100);
      G.puff && G.puff(hx, Math.max(0.05, hy), hz, 1.05, { color:0xe8f6fc, size:4.0, opacity:0.88, up:1.45 });
      G.puff && G.puff(hx, Math.max(0.05, hy), hz, 0.75, { color:0xd8ceb4, size:3.0, opacity:0.65, up:0.9 }); }
    await say('', `${name}をつかまえた！\n手のひらでしばらく歩かせてから、岩場へ帰してやった。` + (isNew ? `\n（見つけたカニ：${st.crabs.length} / ${CRABS.length} 種類）` : ''));
    once('crabLog', `磯の岩場で${name}を見つけた。`); await withFriend('crab');
    G.observe && G.observe('crab', P.pos.x, P.pos.z, { cooldown:5 }); };
  for (const [x, z] of [[-208, 52], [96, -446], [-388, 68]]) I.push({ x, z, r:3.5, when: () => free() && S().hour < 19.2 && G.weatherNow.wind <= 0.6, label:'カニをさがす', act: crabHunt });

  // ---- 夜の展望台で星座さがし ----
  const stargaze = async () => { const st = S(), id = G.companion; st.today.stargaze = true; st.today.star = true;
    P.dismountBike(true); P.pose = 'lookup'; P.camOverride = true; const cam = G.camera;
    const savedPos = cam.position.clone(); P.yaw = Math.atan2(0.4, 0.72);
    cam.position.set(P.pos.x - 1.5, P.pos.y + 0.85, P.pos.z - 2.6); cam.lookAt(P.pos.x + 12, P.pos.y + 18, P.pos.z + 20);
    try {
      for (const l of STARGAZE) await say(l[0], l[1]);
      G.snap();
      if (id && STARGAZE_FRIEND[id]){ for (const l of STARGAZE_FRIEND[id]) await say(l[0], l[1]); friend(id, 2); }
      st.hour += 0.35; once('starLog', id ? `${NAMES[id]}と展望台から、天の川と夏の星座を見上げた。` : '夜の展望台から、天の川と夏の星座を見上げた。');
    } finally { P.pose = null; P.camOverride = false; cam.position.copy(savedPos); } };
  for (const [x, z] of [[-34, -62.5], [-190, 248.5]]) I.push({ x, z, r:3.2, when: () => free() && S().hour >= 19.3 && G.weatherNow.cloud < 0.35 && !S().today.stargaze, label:'夜空を見上げる', act: stargaze });

  // ---- おみくじ（神社）----
  const LUCK = [['大吉', 'さがしものは、足もとにあり。'], ['中吉', '待ち人、海のほうより来たる。'], ['小吉', 'あせらず歩けば、道はひらける。'], ['吉', '友を大切にすれば、夏は長し。'], ['末吉', '寝坊に注意。朝の光に福あり。']];
  I.push({ x:-84, z:-50.4, r:2.3, when: free, label:'お参りする', act: async () => { const st = S(); audio.burst(0.05, 1800, 0.25, { type:'bandpass' }); audio.burst(0.05, 1800, 0.25, { type:'bandpass', when:0.45 });
    if (st.today.luck){ await say('', '（ぱん、ぱん）\n手を合わせた。木もれ日がゆれている。'); return; }
    const l = LUCK[(st.day*7 + 3 + Math.floor(rnd()*5)) % LUCK.length]; st.today.luck = l[0];
    await say('', '（ぱん、ぱん）\n手を合わせて、おみくじを一枚引いた。'); await say('', `${l[0]}。\n「${l[1]}」`); log(`神社でおみくじを引いた。${l[0]}だった。`); } });

  // ---- 自販機 ----
  const DRINKS = ['冷たいサイダー', 'みかんジュース', '麦茶', 'スポーツドリンク'];
  for (const [x, z] of [[-77.8, 61.1], [-220, 61.3]]) I.push({ x, z, r:1.5, when: free, label:'ジュースを買う', act: async () => { audio.tone(140, 0.12, { type:'square', vol:0.12 }); audio.burst(0.12, 300, 0.4, { when:0.35 });
    const d = DRINKS[Math.floor(rnd()*DRINKS.length)]; await say('', `ガコン。\n${d}を買って、その場で一気に飲んだ。` + (S().hour > 11 && S().hour < 16 ? '\n日なたのアスファルトがゆらゆらしている。' : '')); once('drinkLog', `自販機で${d}を買った。`); } });

  // ---- サッカーボール（校庭）----
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32; { const g = cv.getContext('2d'); g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#2a2a2e'; for (const [x, y] of [[8, 8], [24, 22], [40, 8], [56, 22], [24, 2], [56, 2], [8, 28], [40, 28]]){ g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); } }
  const bt = new THREE.CanvasTexture(cv); bt.colorSpace = THREE.SRGBColorSpace;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 7), new THREE.MeshLambertMaterial({ map:bt })); G.scene.add(ball);
  const BR = 0.22, bv = new THREE.Vector3(), HOME_B = [28, -30]; let goalWait = 0, ballDay = -1;
  G.ball = { mesh:ball, v:bv, r:BR };
  const resetBall = () => { ball.position.set(HOME_B[0], heightAt(...HOME_B) + BR, HOME_B[1]); bv.set(0, 0, 0); };
  resetBall();
  const updateBall = dt => { const st = S(); if (ballDay !== st.day){ ballDay = st.day; resetBall(); } if (goalWait > 0){ goalWait -= dt; if (goalWait <= 0) resetBall(); return; }
    const b = ball.position, dx = b.x - P.pos.x, dz = b.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.62 && Math.abs(b.y - P.pos.y - 0.3) < 0.9 && (P.moving || P.air > 0) && !G.indoor){   // ける
      const sp = P.riding ? P.bikeSpeed : P.running ? 8.2 : 3.6, fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
      bv.set(fx*(sp*1.3 + 2) + dx*1.5, P.running || P.air > 0 || P.riding ? 4.4 : 1.8, fz*(sp*1.3 + 2) + dz*1.5); audio.burst(0.07, 420, 0.3); }
    if (bv.lengthSq() < 1e-4 && b.y <= heightAt(b.x, b.z) + BR + 0.01) return;
    const px = b.x; bv.y -= 18*dt; b.addScaledVector(bv, dt); const gh = Math.max(heightAt(b.x, b.z), -0.3) + BR;
    if (b.y <= gh){ b.y = gh; if (bv.y < -1.6){ bv.y *= -0.5; audio.burst(0.04, 500, 0.08); } else bv.y = 0;
      const k = Math.max(0, 1 - 1.3*dt); bv.x *= k; bv.z *= k; bv.x -= (heightAt(b.x + 0.4, b.z) - heightAt(b.x - 0.4, b.z))*10*dt; bv.z -= (heightAt(b.x, b.z + 0.4) - heightAt(b.x, b.z - 0.4))*10*dt;
      if (Math.hypot(bv.x, bv.z) < 0.12) bv.x = bv.z = 0; }
    ball.rotation.z -= bv.x*dt/BR; ball.rotation.x += bv.z*dt/BR;
    const inMouth = b.z > -35.6 && b.z < -28.4 && b.y < heightAt(b.x, b.z) + 2.4;
    // 強いボールが人に当たったら、その人が吹っ飛ぶ
    { const sp = Math.hypot(bv.x, bv.z); if (sp > 5) for (const id in G.npcs){ const n = G.npcs[id]; if (!n.root.visible || n.knock || n.recover > 0 || (n.spot && n.spot.room)) continue;
        if (Math.hypot(n.pos.x - b.x, n.pos.z - b.z) < 0.6 && Math.abs(n.pos.y + 1 - b.y) < 1.2){ G.knockNpc(n, bv.x*0.7, 3.5 + sp*0.35, bv.z*0.7, id); bv.multiplyScalar(-0.3); audio.burst(0.1, 600, 0.4); setTimeout(() => G.speak(id, knockLine(id)), 600); break; } } }
    if (inMouth && ((px > 3 && b.x <= 3) || (px < 53 && b.x >= 53))){ goalWait = 1.6; bv.multiplyScalar(0.2); st.goals = (st.goals || 0) + 1; G.celebrate(null, b); once('goalLog', '校庭でボールをけって、ゴールを決めた。'); }
    if (Math.hypot(b.x - HOME_B[0], b.z - HOME_B[1]) > 110 || heightAt(b.x, b.z) < -0.5) resetBall(); };

  let edgeAt = 0, loudAt = -9, cicadaFxT = 0;
  const playerWater = { active:false, x:0, z:0 };
  const compWater = { id:null, active:false, x:0, z:0 };
  G.activities = {
    bag(){ const st = S(), a = []; if (st.fish) a.push(`魚 ${st.fish}`); if (st.bugs && st.bugs.length) a.push(`セミ ${st.bugs.length}/${CICADAS.length}`); if (st.crabs && st.crabs.length) a.push(`カニ ${st.crabs.length}/${CRABS.length}`); if (st.skip) a.push(`水切り ${st.skip}回`); if (st.goals) a.push(`ゴール ${st.goals}`); return a.length ? '<br>' + a.join('　') : ''; },
    cicadaProx(){ const st = S(); if (G.indoor || (G.weatherNow && G.weatherNow.rain > 0.15) || st.hour <= 6.5 || st.hour >= 19) return 0;
      const done = st.today.bugTrees || []; let best = 0;
      W.trees.forEach((t, i) => { if (done.includes(i)) return; const d = Math.hypot(P.pos.x - t.x, P.pos.z - t.z); if (d < 14) best = Math.max(best, Math.min(1, 1 - (d - 1.9)/12.1)); });
      return best; },
    update(dt){ if (G.mode !== 'play') return; for (let i = fx.length - 1; i >= 0; i--) if (fx[i](dt) === false) fx.splice(i, 1); updateBall(dt); if (P.running || P.air > 0.05 || P.riding || P.driving) loudAt = G.time;
      cicadaFxT -= dt;
      if (cicadaFxT <= 0){ cicadaFxT = 0.75 + rnd()*0.35; const st = S();
        if (!G.indoor && !(G.weatherNow && G.weatherNow.rain > 0.15) && st.hour > 6.5 && st.hour < 19 && G.puff){
          const done = st.today.bugTrees || []; let bestT = null, bestD = 12;
          W.trees.forEach((t, i) => { if (done.includes(i)) return; const d = Math.hypot(P.pos.x - t.x, P.pos.z - t.z); if (d < bestD){ bestD = d; bestT = t; } });
          if (bestT){ const s = bestT.s || 1, gy = heightAt(bestT.x, bestT.z);
            G.puff(bestT.x + (rnd() - 0.5)*1.8*s, gy + (2.3 + rnd()*1.4)*s, bestT.z + (rnd() - 0.5)*1.8*s, 0.55, { color:0xb7e078, size:2.8, opacity:0.65, up:0.35 }); } } }
      if (P.splash){
        P.splash = false;
        const diveH = Math.max(0, P.diveH || 0); P.diveH = 0;
        if (diveH > 3) G.trick('dive', diveH);
        emitDiveSplash(P.pos.x, P.pos.z, diveH, false);
        audio.splash(diveH, false);
        playerWater.active = true; playerWater.x = P.pos.x; playerWater.z = P.pos.z;
        once('diveLog', '海に飛び込んだ。');
        if (!S().today.diveToast){ S().today.diveToast = true; toast('ざぶん！'); }
      }
      if (P.bikeDive){
        P.bikeDive = false;
        const diveH = Math.max(0, P.diveH || 0); P.diveH = 0;
        emitDiveSplash(P.pos.x, P.pos.z, diveH, true);
        audio.splash(diveH, true);
        playerWater.active = true; playerWater.x = P.pos.x; playerWater.z = P.pos.z;
        toast('自転車ごと海に入ってしまった！（自転車は明日の朝、元の場所に戻る）', 5000);
        once('bikeDiveLog', '自転車で、そのまま海に突っ込んだ。');
      }
      /* 主人公の浅瀬移動・水泳による足元／水面の波紋 */
      {
        const surf = (!G.indoor && !P.room && !P.driving && !P.carry && !P.hidden && !P.frozen && !P.sitting && (P.swimming || P.air <= 0.05))
          ? P.surface() : '';
        const gh = surf === 'shallow' ? heightAt(P.pos.x, P.pos.z) : 1;
        const inWater = surf === 'shallow' && (P.swimming || gh < 0.10);
        const step = stepWaterRipple(playerWater, P.pos.x, P.pos.z, inWater, { stepDist: P.swimming ? 1.15 : 0.85 });
        if (step){
          const wy = P.swimming ? 0.06 : Math.max(0.06, gh + 0.04);
          ripple(step.x, step.z, P.swimming
            ? { r0:0.16, r1:1.05, dur:0.65, op:0.62, y:wy }
            : { r0:0.10, r1:0.72, dur:0.50, op:0.54, y:wy });
        }
      }
      /* 海に入った同行者の浅瀬・水泳による波紋 */
      {
        const cid = G.companion, c = cid && G.npcs ? G.npcs[cid] : null;
        if (compWater.id !== cid){ compWater.id = cid; compWater.active = false; }
        const valid = !!(c && c.following && c.root?.visible && !c.ride && !c.knock && !(c.recover > 0) && !c.seatTogether && !G.indoor && !P.room);
        const cgh = valid ? (G.groundAt ? G.groundAt(c.pos.x, c.pos.z, c.pos.y) : heightAt(c.pos.x, c.pos.z)) : 1;
        const cInWater = valid && cgh < 0.10 && c.pos.y < 0.25;
        const cSwim = cgh < -1.0;
        const cStep = stepWaterRipple(compWater, c ? c.pos.x : 0, c ? c.pos.z : 0, cInWater, { stepDist: cSwim ? 1.15 : 0.85 });
        if (cStep){
          const wy = cSwim ? 0.06 : Math.max(0.06, cgh + 0.04);
          ripple(cStep.x, cStep.z, cSwim
            ? { r0:0.14, r1:0.95, dur:0.60, op:0.55, y:wy }
            : { r0:0.09, r1:0.65, dur:0.48, op:0.48, y:wy });
        }
      }
      if (P.carStall){ P.carStall = false; audio.burst(0.6, 500, 0.5); toast('深みで水をかぶって、エンジンが止まってしまった（軽トラは明日の朝、元の場所に戻る）', 5000); once('carStallLog', '軽トラで海に入った。しばらくは走れたけれど、深みでエンジンが止まった。'); }
      if (P.edge){ P.edge = false; if (G.time > edgeAt){ edgeAt = G.time + 6; toast('これ以上沖に出ると、流されてしまいそうだ'); } } },
  };
}
