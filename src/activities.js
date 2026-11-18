// 島でできること：釣り、水切り、セミ取り、足湯、おみくじ、自販機、サッカーボール、飛び込み。
import * as THREE from 'three';
import { say, closeDialogue } from './dialogue.js';
import { heightAt } from './world/terrain.js';
import { audio } from './audio.js';
import { NAMES, STORM_FISH as T_STORM_FISH, STORM_CICADA as T_STORM_CICADA, CRABS, STARGAZE, STARGAZE_FRIEND } from '../data/story.js';
import { isConfirm, keyName, BIND } from './keys.js';
import { knockLine } from './knock.js';
const wait = ms => new Promise(r => setTimeout(r, ms)), rnd = Math.random;
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
  const gauge = (title, ms=6000, hint='ここで投げる') => new Promise(res => { const el = document.createElement('div'); el.className = 'gauge';
    el.innerHTML = `<div class="gtitle">${title}</div><div class="gbar"><i class="gzone"></i><b></b></div><div class="ghint">［${keyName(BIND.interact)}］${hint}</div>`; document.body.appendChild(el);
    const mark = el.querySelector('b'), t0 = performance.now(); let raf = 0, done = false; const pos = () => { const t = (performance.now() - t0)/1000*1.15; return 1 - Math.abs((t % 2) - 1); };   // 0→1→0 と往復する
    const draw = () => { mark.style.left = (pos()*100) + '%'; raf = requestAnimationFrame(draw); }; draw(); const iv = setInterval(() => { mark.style.left = (pos()*100) + '%'; }, 30);
    const fin = v => { if (done) return; done = true; cancelAnimationFrame(raf); clearInterval(iv); removeEventListener('keydown', h, true); clearTimeout(to); setTimeout(() => el.remove(), 350); res(v); };
    const h = e => { if (!e.repeat && isConfirm(e.code)){ e.preventDefault(); e.stopImmediatePropagation(); const p = pos(); mark.style.left = (p*100) + '%'; el.classList.add('ghit'); fin(Math.max(0, 1 - Math.abs(p - 0.5)*2)); } };
    addEventListener('keydown', h, true); const to = setTimeout(() => fin(0.1), ms); });

  // ---- 釣り（桟橋）----
  const fishing = async () => { const st = S(); if (G.weatherNow.wind > 0.6){ await say('', T_STORM_FISH); return; } if (st.hour > 19.6){ await say('', '暗くて、うきが見えない。釣りは明るいうちにしよう。'); return; }
    P.pose = 'work'; await say('', 'しかけを投げた。うきが波にゆれている。\n「！」が出たら、すぐにEを押す。'); closeDialogue();
    toast('……', 7000); const early = await waitKey(1500 + rnd()*3300);
    if (early){ toast('早すぎた。魚は逃げてしまった'); await wait(1300); P.pose = null; st.hour += 0.25; return; }
    audio.tone(1200, 0.1, { type:'square', vol:0.08 }); audio.tone(1700, 0.16, { type:'square', vol:0.08, when:0.09 }); toast('！', 900);
    const hit = await waitKey(900); st.hour += 0.4; P.pose = null;
    if (!hit){ await say('', 'えさだけ取られた。……もう一回。'); return; }
    let r = rnd()*100, f = FISH[0]; for (const c of FISH){ if ((r -= c[1]) < 0){ f = c; break; } }
    const cm = Math.round(f[2]*(0.8 + rnd()*0.5)); st.fish = (st.fish || 0) + 1; audio.pickup(); audio.burst(0.3, 1200, 0.12); G.snap();
    await say('', `${f[0]}が釣れた！（${cm}センチ）` + (f[0] === 'シマアジ' ? '\n港の人が見たらうらやましがる大物だ。' : '') + `\nこれまでに釣った魚：${st.fish}匹`);
    once('fishLog', `港で${f[0]}を釣った。`); await withFriend('fish'); };
  for (const [x, z] of [[-270.5, 68.3], [-248, 68.3]]) I.push({ x, z, r:2.0, when: free, label:'釣りをする', act: fishing });

  // ---- 水切り（浜）----
  // 水切り：投げる瞬間のタイミングで、はねる回数が決まる（運ではなく腕）
  const skipping = async () => { const st = S(); P.yaw = Math.PI/2; await say('', '平たい石をえらんだ。手首を返して、水面すれすれに投げる。'); closeDialogue();
    const acc = await gauge('水切り　印がまんなかに来たら投げる'); P.pose = 'wave'; setTimeout(() => P.pose = null, 500);
    const n = acc > 0.97 ? 12 : 1 + Math.round(Math.pow(acc, 1.6)*10); for (let i = 0; i < n; i++){ audio.tone(820 + i*70, 0.07, { vol:0.09 }); audio.burst(0.05, 2500, 0.05, { type:'highpass' }); toast('ぴっ'.repeat(i + 1), 700); await wait(Math.max(110, 300 - i*24)); }
    audio.burst(0.25, 900, 0.1); await wait(350); const best = n > (st.skip || 0); if (best) st.skip = n; st.hour += 0.12;
    await say('', `${n}回はねた！` + (acc > 0.97 ? '\nこれ以上ないくらい、きれいに決まった。' : acc < 0.35 ? '\n手首の返しが早すぎた。' : '') + (best ? '\n新記録だ。' : `\n（これまでの記録：${st.skip}回）`)); once('skipLog', '浜で水切りをした。'); if (best && n >= 5) log(`水切りで${n}回はねた。新記録。`); await withFriend('skip'); };
  I.push({ x:100, z:22, r:6, when: () => free() && heightAt(P.pos.x, P.pos.z) > 0.15, label:'水切りをする', act: skipping });
  I.push({ x:-203, z:55, r:4.5, when: () => free() && heightAt(P.pos.x, P.pos.z) > 0.15, label:'水切りをする', act: skipping });

  // ---- セミ取り（木）----
  W.trees.forEach((t, i) => I.push({ x:t.x, z:t.z, r:1.9, label:'セミをさがす', when: () => free() && S().hour > 6.5 && S().hour < 19 && !(S().today.bugTrees || []).includes(i), act: async () => { const st = S();
    if (G.weatherNow.rain > 0.15){ await say('', T_STORM_CICADA); return; } (st.today.bugTrees = st.today.bugTrees || []).push(i); P.pose = 'lookup'; await say('', '幹の高いところでセミが鳴いている。\n息を止めて、そっと手をのばした。'); P.pose = null;
    // そっと近づいたか（直前に走ったり跳んだりしていないか）で、捕まえやすさが変わる
    const quiet = G.time - loudAt > 1.5 && performance.now() - (P.loudT || 0) > 1500;
    const hasNet = S().items && S().items.net; if (hasNet){ G.showNet(true); setTimeout(() => G.showNet(false), 1800); }
    if (rnd() < (quiet ? (hasNet ? 0.04 : 0.12) : (hasNet ? 0.4 : 0.75))){ audio.burst(0.35, 6000, 0.14, { type:'bandpass' }); await say('', quiet ? 'ジジッ！\n……逃げられた。おまけに、おしっこをかけられた。' : 'ジジッ！\n足音で気づかれた。走ってこないで、そっと歩いて近づけばよかった。'); return; }
    const name = st.hour >= 16.5 ? 'ヒグラシ' : (st.day >= 6 && rnd() < 0.45 ? 'ツクツクボウシ' : rnd() < 0.5 ? 'ミンミンゼミ' : 'アブラゼミ'); st.bugs = st.bugs || []; const isNew = !st.bugs.includes(name); if (isNew) st.bugs.push(name);
    audio.pickup(); await say('', `${name}をつかまえた。\nしばらく手の中で鳴かせて、空に放した。` + (isNew ? `\n（見つけたセミ：${st.bugs.length} / ${CICADAS.length} 種類）` : '')); once('bugLog', `${name}をつかまえて、放してやった。`); } }));

  // ---- 足湯（温泉）----
  I.push({ x:-182, z:30, r:5.6, when: free, label:'足湯につかる', act: async () => { const st = S(); await fade(true); st.hour += 0.7;
    // 石の縁（中心から4.2m、高さ0.5m）に腰かけ、靴をぬいで足をお湯に入れる
    { const cx = -182, cz = 30, a = Math.atan2(P.pos.z - cz, P.pos.x - cx); P.pos.x = cx + Math.cos(a)*4.2; P.pos.z = cz + Math.sin(a)*4.2; P.yaw = Math.atan2(cx - P.pos.x, cz - P.pos.z); P.sitting = true; P.seatDrop = 0.5 - 0.39; P.ch.setBarefoot(true); P.camYaw = P.yaw + Math.PI + 0.6; }
    await fade(false); G.snap();
    const eve = st.hour > 17.2 && st.hour < 19.4;
    await say('', eve ? '石の柱のあいだに夕日が落ちていく。\nお湯も空も、同じ色になった。' : 'ぬるめのお湯に足首までつかる。\n波の音と、遠くの船のエンジンの音。'); await say('', '……足の指がふやけてきた。'); once('onsenLog', eve ? '石柱の湯で、夕日を見ながら足湯につかった。' : '石柱の湯で足湯につかった。'); await withFriend('onsen'); toast('歩くと、お湯から上がって靴をはく', 2600); } });   // 歩きだすまで、足はお湯の中

  // ---- 磯のカニさがし ----
  const crabHunt = async () => { const st = S(); await say('', '潮だまりの岩をそっとのぞきこんだ。小さなはさみが動いている。'); closeDialogue();
    const acc = await gauge('カニさがし　岩かげから出たところでつかまえる', 6000, 'ここでつかまえる'); P.pose = 'craft'; setTimeout(() => P.pose = null, 600); st.hour += 0.2;
    if (acc < 0.38){ audio.burst(0.08, 900, 0.08); await say('', 'あ……岩のすきまに逃げこまれた。動きが速い。'); return; }
    const pool = st.hour >= 16 ? [1, 3, 0, 2] : [0, 2, 1, 3]; const name = CRABS[pool[Math.floor(rnd()*pool.length)]];
    st.crabs = st.crabs || []; const isNew = !st.crabs.includes(name); if (isNew) st.crabs.push(name);
    st.today.crab = true; audio.pickup(); G.observe && G.observe('crab', P.pos.x, P.pos.z);
    await say('', `${name}をつかまえた！\n手のひらでしばらく歩かせてから、岩場へ帰してやった。` + (isNew ? `\n（見つけたカニ：${st.crabs.length} / ${CRABS.length} 種類）` : ''));
    once('crabLog', `磯の岩場で${name}を見つけた。`); await withFriend('crab'); };
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

  let edgeAt = 0, loudAt = -9;
  G.activities = {
    bag(){ const st = S(), a = []; if (st.fish) a.push(`魚 ${st.fish}`); if (st.bugs && st.bugs.length) a.push(`セミ ${st.bugs.length}/${CICADAS.length}`); if (st.crabs && st.crabs.length) a.push(`カニ ${st.crabs.length}/${CRABS.length}`); if (st.skip) a.push(`水切り ${st.skip}回`); if (st.goals) a.push(`ゴール ${st.goals}`); return a.length ? '<br>' + a.join('　') : ''; },
    update(dt){ if (G.mode !== 'play') return; updateBall(dt); if (P.running || P.air > 0.05 || P.riding || P.driving) loudAt = G.time;
      if (P.splash){ P.splash = false; if ((P.diveH || 0) > 3) G.trick('dive', P.diveH); P.diveH = 0; audio.burst(0.5, 700, 0.5); audio.burst(0.9, 2600, 0.12, { type:'highpass', when:0.05 }); once('diveLog', '海に飛び込んだ。'); if (!S().today.diveToast){ S().today.diveToast = true; toast('ざぶん！'); } }
      if (P.bikeDive){ P.bikeDive = false; audio.burst(0.6, 600, 0.6); audio.burst(1.0, 2400, 0.14, { type:'highpass', when:0.05 }); toast('自転車ごと海に入ってしまった！（自転車は明日の朝、元の場所に戻る）', 5000); once('bikeDiveLog', '自転車で、そのまま海に突っ込んだ。'); }
      if (P.carStall){ P.carStall = false; audio.burst(0.6, 500, 0.5); toast('深みで水をかぶって、エンジンが止まってしまった（軽トラは明日の朝、元の場所に戻る）', 5000); once('carStallLog', '軽トラで海に入った。しばらくは走れたけれど、深みでエンジンが止まった。'); }
      if (P.edge){ P.edge = false; if (G.time > edgeAt){ edgeAt = G.time + 6; toast('これ以上沖に出ると、流されてしまいそうだ'); } } },
  };
}
