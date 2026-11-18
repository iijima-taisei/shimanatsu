import * as THREE from 'three';
import { buildTerrain, buildRoads, buildSea, heightAt } from './world/terrain.js';
import { Sky } from './world/sky.js';
import { Player, keys } from './player.js';
import { loadModels, setNight } from './models.js';
import { buildWorld, AREAS, HOME } from './world/places.js';
import { NPC } from './npc.js';
import { setupGame, newState, loadSave, Fireworks } from './events.js';
import { dlg, setTick } from './dialogue.js';
import { audio } from './audio.js';
import { setupActivities } from './activities.js';
import { setupCars } from './car.js';
import { setupMap } from './map.js';
import { setupHud } from './hud.js';
import { setupDebug } from './debug.js';
import { setupWeather } from './weather.js';
import { setupKnock } from './knock.js';
import { setupNpcAI } from './npcai.js';
import { setupBubbles } from './bubble.js';
import { LLM, MODELS, llmStart, llmSupported } from './llm.js';
import { setupSchool } from './school.js';
import { setupFun } from './fun.js';
import { setupPhysics } from './physics.js';
import { setupItems } from './items.js';
import { BIND, DEFAULT, saveBind, keyName, pollPad, SETTINGS, saveSettings, gearName } from './keys.js';
import { setEngine } from './player.js';
import { skipDialogue } from './dialogue.js';
import { DATES, BIKE, PREP_TASKS, NAMES, FARE } from '../data/story.js';
import { ROADS, ROAD_PTS } from './world/terrain.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, powerPreference:'high-performance' });
const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(52, 1, 0.3, 2400);
// PS2相当の低い解像度で描いて、画面いっぱいに拡大する
function resize(){ const H = 480, a = innerWidth/innerHeight; renderer.setPixelRatio(1); renderer.setSize(Math.round(H*a), H, false); camera.aspect = a; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const G = window.G = { scene, camera, renderer, time:0, colliders:[], state:newState(), mode:'title', areas:AREAS, npcs:{}, lock:false, indoor:false, bgm:1 };
await loadModels();
buildRoads(scene); buildTerrain(scene); const sea = buildSea(scene);
const W = G.world = buildWorld(G);
// 外の景色をひとまとめにして、窓のない部屋の中では描かない（三角形を減らす）
{ const inside = new Set(Object.values(W.interiors)); const outdoor = G.outdoor = new THREE.Group(); for (const o of scene.children.slice()) if (!inside.has(o)) outdoor.add(o); scene.add(outdoor); }
const sky = G.sky = new Sky(scene);
const player = G.player = new Player(scene, camera, G.colliders);
G.npcs.nagisa = new NPC('nagisa', scene, { model:'nagisa', girl:true });
G.npcs.kouta = new NPC('kouta', scene, { model:'kouta' });
G.npcs.kotoha = new NPC('kotoha', scene, { model:'kotoha', girl:true });
G.npcs.oneesan = new NPC('oneesan', scene, { model:'oneesan', girl:true });
G.npcs.ojisan = new NPC('ojisan', scene, { model:'ojisan' });
G.npcs.mother = new NPC('mother', scene, { model:'mother', girl:true });
G.npcs.father = new NPC('father', scene, { model:'father' });
G.npcs.sister = new NPC('sister', scene, { model:'sister', girl:true });
G.npcs.granny = new NPC('granny', scene, { model:'granny', girl:true });
G.fireworks = new Fireworks(scene);
G.names = NAMES; G.roadPts = ROAD_PTS; G.roadIndex = Object.fromEntries(ROADS.map((r, i) => [r.id, i]));
setEngine((v, on = true) => audio.engine(v, on));
setupGame(G); setupActivities(G); setupCars(G); const map = G.map = setupMap(G); setupHud(G); setupDebug(G); setupWeather(G); setupKnock(G); setupBubbles(G); setupNpcAI(G); setupPhysics(G); setupSchool(G); setupFun(G); setupItems(G); setTick(() => audio.blip());
player.fields = W.fields;
player.teleport(HOME.x, HOME.z + 5.5, 0);

// ---- タイトル ----
const $ = id => document.getElementById(id);
const saved = loadSave();
if (saved){ $('continue').classList.remove('hidden'); $('savehint').textContent = `${DATES[saved.day]}の朝から再開できます。朝になると自動で記録します。`; }
else $('savehint').textContent = '朝になると自動で記録します。つづきは、その日の朝から始まります。';
$('start').disabled = false; $('continue').disabled = false;
let starting = false;
function begin(state){
  if (starting) return; starting = true;
  for (const k in keys) keys[k] = false;
  audio.start(); G.state = state; $('title').classList.add('hidden'); canvas.focus({ preventScroll:true });
  $('fade').style.transitionDuration = '0ms'; $('fade').style.opacity = 1; G.bgm = 0; setTimeout(() => G.startDay(), 400);
}
$('start').onclick = () => begin(newState()); $('continue').onclick = () => begin(Object.assign(newState(), saved));

// ---- 入力 ----
let target = null;
// ---- 一時停止とキー設定（Esc／START）----
let capture = null;
const pauseEl = $('pause');
const drawKeys = () => { for (const k in DEFAULT) $('bind-' + k).textContent = capture === k ? 'キーを押してください' : keyName(BIND[k]); };
const setPause = on => { G.paused = on; if (on) for (const b of document.querySelectorAll('.bubble')) b.style.visibility = 'hidden';   // AIのひとりごとの吹き出しを隠す
  pauseEl.classList.toggle('hidden', !on); capture = null; if (on) drawKeys(); };
for (const k in DEFAULT) $('bind-' + k).onclick = () => { capture = k; drawKeys(); };
$('bind-reset').onclick = () => { Object.assign(BIND, DEFAULT); saveBind(); drawKeys(); };
$('resume').onclick = () => setPause(false);
for (const el of document.querySelectorAll('input[name=view]')){ el.checked = el.value === SETTINGS.view; el.onchange = () => { SETTINGS.view = el.value; saveSettings(); player.fpPitch = 0; }; }
// AIのセリフ（ローカルLLM）。ONにしたときだけモデルを読みこむ（初回はダウンロードがある）
{ const box = $('llmon'), info = $('llminfo');
  const show = () => { info.textContent = !llmSupported() ? 'このブラウザでは使えません（WebGPU が必要）' : LLM.status === 'loading' ? `モデルを読みこみ中… ${LLM.progress}` : LLM.status === 'ready' ? `動いています（${LLM.name}、このパソコンの中だけで動く）` : LLM.status === 'error' ? '読みこめませんでした：' + LLM.error : `初めて使うモデルは、ダウンロードします（${MODELS[SETTINGS.llmModel].size}）。2回目からはすぐ使えます。`; };
  if (!llmSupported()){ box.disabled = true; SETTINGS.llm = false; }
  box.checked = SETTINGS.llm; box.onchange = () => { SETTINGS.llm = box.checked; saveSettings(); if (SETTINGS.llm) llmStart(show, SETTINGS.llmModel); show(); };
  for (const el of document.querySelectorAll('input[name=llmmodel]')){ el.checked = el.value === SETTINGS.llmModel; el.disabled = !llmSupported(); el.onchange = () => { SETTINGS.llmModel = el.value; saveSettings(); if (SETTINGS.llm) llmStart(show, SETTINGS.llmModel); show(); }; }
  if (SETTINGS.llm) llmStart(show, SETTINGS.llmModel); show(); G.llm = LLM; }
for (const el of document.querySelectorAll('input[name=drive]')){ el.checked = el.value === SETTINGS.drive; el.onchange = () => { SETTINGS.drive = el.value; saveSettings(); }; }
$('debugbtn').onclick = () => G.debug.open(); G.setPause = setPause;
addEventListener('keydown', e => {
  if (capture){ e.preventDefault(); e.stopImmediatePropagation(); if (e.code !== 'Escape' && !/^(KeyW|KeyA|KeyS|KeyD|Arrow.*|KeyM|KeyP|KeyB|KeyQ|KeyR)$/.test(e.code)){ const other = Object.keys(BIND).find(k => k !== capture && BIND[k] === e.code); if (other) BIND[other] = BIND[capture]; BIND[capture] = e.code; saveBind(); } capture = null; drawKeys(); return; }
  if (e.code === 'Escape' && !e.repeat && G.mode === 'play'){
    if (G.debugOpen){ e.preventDefault(); G.debug.close(); return; }
    if (G.paused){ e.preventDefault(); setPause(false); return; }
    if (G.lock && G.skippable){ e.preventDefault(); G.skipReq = true; skipDialogue(); return; }   // 2回目からの長いイベントは飛ばせる
    if (!G.lock && !dlg.busy && !G.mapOpen){ e.preventDefault(); setPause(true); return; } }
  if (G.paused){ if (!G.debugOpen || !e.target.closest?.('input, select, textarea')) e.stopImmediatePropagation(); return; }
}, true);
addEventListener('keydown', e => {
  if (G.mapOpen && !e.repeat && (e.code === 'KeyM' || e.code === 'Escape')){ e.preventDefault(); map.toggle(false); return; }
  if (e.repeat || e.isComposing || G.mode !== 'play' || e.target.closest?.('button, a, input, select, textarea, [contenteditable="true"]')) return;
  if (G.mapOpen) return;
  if (e.code === 'KeyM' && !G.lock && !dlg.busy){ e.preventDefault(); audio.select(); map.toggle(true); return; }
  if (e.code === 'KeyV' && !G.lock){ SETTINGS.view = SETTINGS.view === 'first' ? 'third' : 'first'; saveSettings(); player.fpPitch = 0; G.api.toast(SETTINGS.view === 'first' ? '一人称の視点（V でもどす）' : '三人称の視点', 1600); for (const el of document.querySelectorAll('input[name=view]')) el.checked = el.value === SETTINGS.view; }
  if (e.code === 'KeyP') G.photo();
  if (e.code === 'KeyB' && !G.lock && !dlg.busy && player.riding){ e.preventDefault(); G.leaveBike(); }
  if (e.code === 'KeyB' && !G.lock && !dlg.busy && player.driving){ e.preventDefault(); G.leaveCar(); }
  // マニュアルのギア：Shift で上げる、Ctrl か C で下げる（車は 1〜5速と R、原付は 1〜4速）
  if (SETTINGS.drive === 'manual' && (player.driving || (player.riding && player.riding.kind === 'moped')) && !G.lock){ const car = !!player.driving, top = car ? 5 : 4, low = car ? -1 : 1, speed = car ? Math.abs(player.carSpeed) : player.bikeSpeed;
    let g = player.gear ?? 1; if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') g = Math.min(top, g + 1); else if (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'KeyC') g = g === 1 ? (car && speed < 1 ? -1 : 1) : Math.max(low, g - 1); else g = null;
    if (g !== null && g !== player.gear){ player.gear = g; audio.burst(0.05, 1200, 0.1, { type:'bandpass' }); audio.tone(200 + g*40, 0.06, { type:'square', vol:0.04 }); } }
});
// 調べるキー（E。Enter・Zでも可）：調べる・話す・乗る。ジャンプキー（スペース）：ジャンプ
// 近くに何もないときに調べるキーを押したら、ひとりごとを返す（押しても何も起きない、をなくす）
const MUTTER = ['ふう、あつい……', '（なにもない）', '空が高い。', '汗が、あごから落ちた。', '遠くで波の音がする。', '……どこへ行こうかな。'];
const PUFF_STYLE = {
  sand:    { color:0xe8dfc4, size:4.2, opacity:0.82, scale:1.15 },
  road:    { color:0xcac7be, size:3.4, opacity:0.62, scale:0.70 },
  dirt:    { color:0xd4c6a4, size:4.0, opacity:0.78, scale:1.00 },
  grass:   { color:0xc2cca8, size:3.8, opacity:0.68, scale:0.85 },
  wood:    { color:0xd8ccb2, size:3.2, opacity:0.52, scale:0.55 },
  shallow: { color:0xe8f6fc, size:4.6, opacity:0.86, scale:1.05, up:1.45 },
};
let mutterAt = 0, mutterN = 0;
dlg.onConfirm = code => { if (G.paused || G.mapOpen) return; if (G.mode !== 'play' || G.lock) return;
  if (code !== BIND.jump){ if (target){ const t = target; audio.select(); G.run(t.act); } else if (!player.driving && !player.riding && G.time > mutterAt){ mutterAt = G.time + 1.2; audio.tone(520, 0.05, { vol:0.03 }); G.api.toast(MUTTER[mutterN++ % MUTTER.length], 1500); } }
  else if (player.jump()){ player.jumped = false; audio.tone(300, 0.16, { type:'triangle', vol:0.07, slide:1.9 }); } };

let last = performance.now(), lastMoved = 0;
const tmp = new THREE.Vector3();
let dialogueWidth = -1, viewWidth = 0, viewHeight = 0;
// 会話帯を除いた場所の中央に主人公を映す。移動中のカメラ角度は変えない。
function frameDialogue(){
  const width = dlg.busy ? $('dialogue').offsetWidth : 0;
  if (width === dialogueWidth && viewWidth === innerWidth && viewHeight === innerHeight) return;
  dialogueWidth = width; viewWidth = innerWidth; viewHeight = innerHeight;
  if (width) camera.setViewOffset(innerWidth, innerHeight, width/2, 0, innerWidth, innerHeight);
  else camera.clearViewOffset();
}
function frame(now){ const dt = Math.min(0.05, (now - last)/1000)*(G.timeScale ?? 1); last = now; tick(dt); requestAnimationFrame(frame); }   // timeScale でスローモーション
function tick(dt){
  G.time += dt; const S = G.state;
  if (G.mode === 'title'){ $('hud').style.display = 'none';
    const a = G.time*0.03; camera.position.set(-30 + Math.sin(a)*300, 110, 10 + Math.cos(a)*420); camera.lookAt(-30, 18, 10);
    sea.update(G.time); W.update(G.time); sky.update(18.25, tmp.set(0, 0, 0), dt, camera); for (const k in G.npcs) G.npcs[k].root.visible = false; player.root.visible = false;
    audio.update({ hour:18.25, coast:0.5, high:0.5, indoor:false, bgm:1 }); renderer.render(scene, camera); return;
  }
  player.root.visible = !player.driving && !player.hidden; $('hud').style.display = (G.mode === 'play' && !G.fadeBlack) ? '' : 'none';
  pollPad(); player.firstPerson = SETTINGS.view === 'first';
  if (G.mode === 'play' && !dlg.busy && !G.lock && !G.timeStop && !G.mapOpen && !G.paused) S.hour += dt/40*(window.TS || 1);
  player.locked = G.mode !== 'play' || dlg.busy || G.lock || !!G.mapOpen || !!G.paused;   // 地図を開いている間は、時間も動きも止まる
  player.bikeSpeedLimit = G.companion ? 7.8 : Infinity;
  G.schoolUpdate(dt); G.carsUpdate(dt); player.update(dt); G.knockUpdate(dt); G.bikesFlyUpdate(dt); G.physicsUpdate(dt); if (G.world && G.world.moving) G.world.moving(dt); G.npcai.update(dt); G.bubbleUpdate(dt); frameDialogue(); for (const k in G.npcs) G.npcs[k].update(dt, G);
  sea.update(G.time); W.update(G.time); sky.update(Math.min(S.hour, 23.9), player.pos, dt, camera); G.weather.update(dt, sky, player);
  { const nk = G.blackout ? 0 : Math.max(0, Math.min(1, (Math.min(S.hour, 23.9) - 17.9)/1.2 + G.weatherNow.cloud*0.35)); setNight(nk); W.setNight(nk); }
  G.fireworks.update(dt, G.time); if (G.fireworks.flash > 0){ sky.hemi.intensity += G.fireworks.flash*0.9; sky.hemi.color.lerp(G.fireworks.col, G.fireworks.flash*0.5); }
  // 調べられるもの
  target = null; if (G.mode === 'play' && !G.lock && !dlg.busy && !player.driving){ let best = 1e9; for (const it of G.interact){ const d = Math.hypot(player.pos.x - it.x, player.pos.z - it.z); if (d < it.r && d < best && it.when()){ best = d; target = it; } } }
  const pr = $('prompt'); if (G.promptOverride){ pr.textContent = G.promptOverride; pr.style.opacity = 1; } else if (player.carry && !player.locked && !player.carry.car.busy){ pr.textContent = '歩くと荷台に立ち上がる'; pr.style.opacity = 1; } else if (target){ pr.textContent = `［${keyName(BIND.interact)}］` + (typeof target.label === 'function' ? target.label() : target.label) + (player.riding ? '　［B］降りる' : ''); pr.style.opacity = 1; }
  else if (player.riding && !player.locked){ const mp = player.riding.kind === 'moped'; pr.textContent = mp ? `［B］原付から降りる　${SETTINGS.drive === 'manual' ? gearName(player.gear) + '　' : ''}${Math.round(player.bikeSpeed*3.6)} km/h` : BIKE.riding; pr.style.opacity = 1; }
  else if (player.driving && !player.locked){ pr.textContent = `［B］軽トラから降りる　${SETTINGS.drive === 'manual' ? gearName(player.gear) + '　' : ''}${Math.round(Math.abs(player.carSpeed)*3.6)} km/h${keys.Space && Math.abs(player.carSpeed) > 4 ? '　ドリフト！' : ''}`; pr.style.opacity = 1; }
  else pr.style.opacity = 0;
  // 画面の表示
  G.hud.update();
  // 音
  if (player.landed){ const v = player.landed; player.landed = 0; if (v > 4 && !player.swimming){ const surf = player.surface(), st = PUFF_STYLE[surf] || PUFF_STYLE.dirt, indoor = !!player.room; audio.land(surf, v, indoor); G.puff(player.pos.x, player.pos.y, player.pos.z, Math.min(1.5, v/8)*st.scale*(indoor ? 0.65 : 1), indoor ? { ...st, opacity:st.opacity*0.6 } : st); } }
  if (player.jumped){ player.jumped = false; audio.tone(300, 0.16, { type:'triangle', vol:0.07, slide:1.9 }); }
  if (player.riding || player.driving || player.air > 0) lastMoved = player.moved;   // 乗り物の上と空中では足音を出さない
  else if (player.moved - lastMoved > (player.swimming ? 1.5 : player.running ? 1.7 : 0.85)){ lastMoved = player.moved; audio.step(player.swimming, player.swimming ? 'shallow' : player.surface(), !!player.room); }
  const gh = heightAt(player.pos.x, player.pos.z);
  audio.update({ day:S.day, hour:S.hour, coast:Math.max(0, Math.min(1, 1 - gh/7)), high:Math.min(1, Math.max(0, gh/40)), indoor:G.indoor || G.inSchool, quiet:G.weatherNow.rain > 0.15, bgm:G.bgm || ((S.hour > 17.4 && S.hour < 19.4 && !G.lock) ? 1 : 0),
    furin: !G.indoor && (Math.hypot(player.pos.x - HOME.x, player.pos.z - HOME.z) < 16 || Math.hypot(player.pos.x + 84, player.pos.z - 66) < 14) });
  G.activities.update(dt); G.fxUpdate(dt); G.funUpdate(dt); G.itemsUpdate(dt); map.update(dt);
  if (player.trick){ G.trick('roll', player.trick); player.trick = 0; }
  if (player.bikeTrick){ G.trick('bike', player.bikeTrick); player.bikeTrick = 0; }
  G.watch();
  renderer.render(scene, camera);
}
G.tick = tick;
requestAnimationFrame(frame);
