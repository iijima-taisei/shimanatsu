import * as THREE from 'three';
import * as T from '../data/story.js';
import { TALK2 } from '../data/talk.js';
import { say, choose, talk, closeDialogue, dlg } from './dialogue.js';
import { ROOM, ROOMS, SPOTS, HOME, HOME_IN, SHOP, SHOP_IN, TERM, TERM_IN } from './world/places.js';
import { BON } from './npc.js';
import { TYPHOON_DAY } from './weather.js';
import { heightAt } from './world/terrain.js';
import { composeDiary, showDiary, browseDiary, dayWeather } from './diary.js';
import { audio } from './audio.js';
import { isConfirm, keyName, BIND, SETTINGS } from './keys.js';
const N = T.NAMES, wait = ms => new Promise(r => setTimeout(r, ms)), SAVE = 'shimanatsu-save-v1';
export const newState = () => ({ day:0, hour:7, prep:0, friends:{ nagisa:0, kouta:0, kotoha:0, oneesan:0 }, ramune:0, fish:0, bugs:[], crabs:[], skip:0, goals:0, shells:[], walked:{}, flags:{}, diary:[], taiso:0, seen:{}, items:{}, money:0, fishSold:0, today:{ log:[], talked:{}, gave:{} } });
export const loadSave = () => {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE));
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    if (!object(data) || !Number.isInteger(data.day) || data.day < 0 || data.day >= T.DATES.length) return null;
    // 再開地点はその日の朝。古い保存データに足りない項目は初期値で補う。
    const state = newState(); state.day = data.day;
    const count = (value, max=Infinity) => Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
    state.prep = count(data.prep, 5); state.ramune = count(data.ramune);
    state.fish = count(data.fish); state.skip = count(data.skip, 99); state.goals = count(data.goals);
    if (Array.isArray(data.bugs)) state.bugs = [...new Set(data.bugs.filter(b => typeof b === 'string'))].slice(0, 8);
    if (Array.isArray(data.crabs)) state.crabs = [...new Set(data.crabs.filter(b => typeof b === 'string'))].slice(0, 8);
    if (object(data.friends)) for (const id in state.friends) state.friends[id] = count(data.friends[id], 10);
    if (Array.isArray(data.shells)) state.shells = [...new Set(data.shells.filter(id => Number.isInteger(id) && id >= 0))];
    state.taiso = count(data.taiso, 12); state.money = count(data.money, 99999); state.fishSold = count(data.fishSold);
    for (const key of ['walked', 'flags', 'seen', 'items']) if (object(data[key])) state[key] = Object.fromEntries(Object.entries(data[key]).filter(([, value]) => typeof value === 'boolean'));
    if (Array.isArray(data.diary)) state.diary = data.diary.filter(page => object(page) && typeof page.date === 'string' && typeof page.text === 'string').map(page => ({
      date:page.date, weather:typeof page.weather === 'string' ? page.weather : 'はれ', text:page.text, photo:typeof page.photo === 'string' && /^data:image\/(jpeg|png);base64,/.test(page.photo) ? page.photo : null,
    }));
    return state;
  } catch (e) { return null; }
};

export function setupGame(G){
  const P = G.player, W = G.world, I = G.interact = [];
  const S = () => G.state;
  const fadeEl = document.getElementById('fade');
  const fade = async (on, ms=700) => { fadeEl.style.transitionDuration = ms + 'ms'; fadeEl.style.opacity = on ? 1 : 0; G.fadeBlack = on; await wait(ms + 60); };
  const toast = (t, ms=2600) => { const el = document.getElementById('toast'); el.textContent = t; el.style.opacity = 1; clearTimeout(toast.t); toast.t = setTimeout(() => el.style.opacity = 0, ms); };
  const log = t => S().today.log.push(t);
  // 好感度が段階（3・7）を越えたら、そっと知らせて日記に残し、次に話したときに特別な会話をする
  const friend = (id, n) => { const st = S(); if (st.friends[id] === undefined) return; const before = st.friends[id]; st.friends[id] = Math.min(10, before + n);
    if (!T.TIER_TALK[id]) return; for (const [t, th] of [[1, 3], [2, 7]]) if (before < th && st.friends[id] >= th){ st.flags[`tier${t}_${id}`] = true;
      toast(t === 1 ? `${N[id]}と、少し仲良くなった気がする` : `${N[id]}と、すっかり打ち解けた気がする`, 3200); audio.tone(784, 0.18, { type:'triangle', vol:0.06 }); audio.tone(1047, 0.3, { type:'triangle', vol:0.06, when:0.15 });
      log(t === 1 ? `${N[id]}と、少し仲良くなった気がする。` : `${N[id]}と、なんでも話せるようになってきた。`); } };
  const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(S())); } catch (e) {} };
  G.snap = (force=false, manual=false) => { if ((S().today.manual && !manual) || (S().today.photo && !force)) return; if (!G.renderer.domElement.width || !G.renderer.domElement.height) return;   // 画面が出ていないときは撮らない（写真の失敗でイベントを止めない）
    G.renderer.render(G.scene, G.camera); const c = document.createElement('canvas'); c.width = 400; c.height = 250; const src = G.renderer.domElement; const sw = Math.min(src.width, src.height*1.6), sh = sw/1.6;
    c.getContext('2d').drawImage(src, (src.width-sw)/2, (src.height-sh)/2, sw, sh, 0, 0, 400, 250); S().today.photo = c.toDataURL('image/jpeg', 0.72); };
  G.photo = () => { if (G.lock || dlg.busy) return; G.snap(true, true); S().today.manual = true; audio.shutter(); const f = document.getElementById('flash'); f.style.transition = 'none'; f.style.opacity = 0.9; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }); toast('写真を撮った。今日の日記にのる'); };
  const run = async fn => { if (G.lock) return; G.lock = true; if (G.npcai && G.npcai.interrupt) G.npcai.interrupt(); try { await fn(); } finally { closeDialogue(); G.lock = false; } };
  G.run = run;
  G.browseDiary = () => run(() => browseDiary(S().diary));
  const rideBike = async bike => {
    if (!P.mountBike(bike)){ toast(T.BIKE.cannotRide); return; }
    if (bike.kind === 'moped'){ P.gear = 1; toast(SETTINGS.drive === 'manual' ? '原付に乗った。W アクセル、A/D ハンドル、Shift/Ctrl でギア、B で降りる' : '原付に乗った。WASD で走る、B で降りる', 4200); if (!S().today.moped){ S().today.moped = true; log('お父さんの原付を借りて、島の道を走った。風が強い。'); } return; }
    toast(G.companion ? T.BIKE.together : T.BIKE.mounted, 4200);
  };
  const leaveBike = () => {
    if (!P.riding) return;
    toast(P.dismountBike() ? T.BIKE.dismounted : T.BIKE.blocked, 3200);
  };
  G.leaveBike = leaveBike;
  for (const bike of W.bikes) I.push({
    get x(){ return bike.mesh.position.x; }, get z(){ return bike.mesh.position.z; }, r:1.8,
    when:() => !G.indoor && !P.riding && !P.swimming && Math.abs(P.pos.y-bike.mesh.position.y)<1,
    label:bike.kind === 'moped' ? '原付に乗る' : T.BIKE.ride, act:() => rideBike(bike),
  });
  const listCv = document.createElement('canvas'); listCv.width = 1024; listCv.height = 384; const listTex = new THREE.CanvasTexture(listCv); listTex.colorSpace = THREE.SRGBColorSpace;
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 1.15), new THREE.MeshBasicMaterial({ map:listTex, transparent:true })); m.position.set(-4.43, 1.5, 0); m.rotation.y = Math.PI/2; W.classroom.add(m); }
  const drawList = () => { const g = listCv.getContext('2d'), p = S().prep; g.clearRect(0, 0, 1024, 384); g.textBaseline = 'middle'; g.fillStyle = '#f4f1e4'; g.font = '56px "Yomogi", sans-serif'; g.fillText('白砂祭までに　やること', 40, 50);
    T.PREP_TASKS.forEach((t, i) => { const x = 50 + (i % 2)*490, y = 140 + Math.floor(i/2)*84; g.fillStyle = i < p ? '#f2d36b' : '#f4f1e4'; g.font = '52px "Yomogi", sans-serif'; g.fillText((i < p ? '◎ ' : i === p ? '→ ' : '・ ') + t.name, x, y); if (i < p){ g.fillRect(x + 62, y + 2, g.measureText(t.name).width + 8, 4); } }); listTex.needsUpdate = true; };
  document.fonts && document.fonts.ready.then(() => drawList());
  // 作業机の上に、いま取りかかっている作業の材料と作りかけを置く
  const tableProps = []; { const lam = c => new THREE.MeshLambertMaterial({ color:c }), add = (g, m, x, y, z) => { m.position.set(x, y, z); g.add(m); return m; }, COL = [0xe8554e, 0xf2c14e, 0x5aa9e6, 0x7bc96f, 0xf08cc0];
    const mk = () => { const g = new THREE.Group(); g.position.set(-1.2, 0.735, -0.2); g.visible = false; W.classroom.add(g); tableProps.push(g); return g; };
    let g = mk();   // 0 輪かざり：色紙の束と、つなぎかけの輪
    COL.forEach((c, i) => add(g, new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.21), lam(c)), -0.6 + i*0.03, 0.01 + i*0.012, 0.35 - i*0.02));
    for (let i = 0; i < 9; i++){ const r = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 4, 8), lam(COL[i % 5])), -0.25 + i*0.09, 0.03, -0.3 + Math.sin(i*0.9)*0.05); r.rotation.set(i % 2 ? Math.PI/2 : 0.35, i*0.4, 0); }
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.22), lam(0x9aa0a4)), 0.45, 0.01, 0.3).rotation.y = 0.5;
    g = mk();       // 1 看板：ペンキ缶とはけ
    [0x3f7fd0, 0xe8913f, 0xf4f1e6].forEach((c, i) => { add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 8), lam(0xc9cdd0)), 0.55 + (i % 2)*0.2, 0.08, -0.4 + i*0.22); add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.01, 8), lam(c)), 0.55 + (i % 2)*0.2, 0.152, -0.4 + i*0.22); });
    add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36).rotateX(-Math.PI/2), lam(0x3f7fd0)), -0.55, 0.012, 0.3);
    g = mk();       // 2 紙の花：お花紙の束と、できた花
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.24), lam(0xf7d6e6)), -0.55, 0.03, 0.3);
    for (let i = 0; i < 7; i++) add(g, new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 0), lam(COL[i % 5])), -0.1 + (i % 4)*0.2, 0.08, -0.3 + Math.floor(i/4)*0.24);
    g = mk();       // 3 提灯：段ボール箱と提灯
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), lam(0xb9925a)), -0.5, 0.15, 0.2);
    for (let i = 0; i < 5; i++) add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 6), lam(i % 2 ? 0xf6e6c0 : 0xf08a7a)), 0.05 + i*0.19, 0.11, -0.3 + (i % 2)*0.12);
    g = mk();       // 4 横断幕：広げかけの布
    add(g, new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.5), lam(0xf4f0e4)), 0, 0.012, 0); const roll = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), lam(0xf4f0e4)), 0.8, 0.07, 0); roll.rotation.x = Math.PI/2; }
  G.applyPrep = () => { drawList(); tableProps.forEach((g, i) => g.visible = i === S().prep); const p = S().prep, d = W.decos; const v = (k, on) => { if (d[k]) d[k].visible = on; }; v('sign0', true); v('deco1', p >= 1); v('sign1', p >= 2); v('deco2', p >= 3); v('deco3', p >= 4); v('deco4', p >= 5); };
  // 入れる建物。in は中に入ったときの位置と向き、out は外に出たときの位置と向き、open は入れる時間
  const DOORS = {
    class:{ in:[42.5, -63.6, 0], camYaw:Math.PI*0.85, out:[34, -50.5, 0], open:[0, 19.2], closed:'校舎はもう閉まっている。' },
    home:{ in:[HOME.x - 3.5, HOME.z + 2.2, Math.PI], camYaw:0.4, out:[HOME.x, HOME.z + 5.5, 0], open:[0, 99] },
    shop:{ in:[SHOP.x, SHOP.z + 2.0, Math.PI], camYaw:0.3, out:[SHOP.x - 0.5, SHOP.z - 5.4, Math.PI], open:[7, 19.5], closed:T.SHOP_CLOSED },
    term:{ in:[TERM.x, TERM.z + 2.4, Math.PI], camYaw:0.3, out:[TERM.x, TERM.z + 6.2, 0], open:[7, 18.5], closed:'待合室はもう閉まっている。最終便は出たあとだ。' },
  };
  // id は部屋の名前（'class' 'home' 'shop' 'term'）。false で外に出る
  const setIndoor = id => { if (id === true) id = 'class'; if (id) P.dismountBike(true); G.indoor = id || false; W.school.visible = id !== 'class';
    if (W.homeHouse) W.homeHouse.visible = id !== 'home';
    for (const k in W.interiors) W.interiors[k].visible = k === id; G.outdoor.visible = !id || id === 'class' || id === 'home'; P.room = id ? ROOMS[id] : null; P.camDist = id ? 3.4 : 6.2; P.sitting = false; P.carry = null; };
  const companion = () => G.companion ? G.npcs[G.companion] : null;
  const enter = async (id='class') => { const d = DOORS[id], h = S().hour; if (S().day === TYPHOON_DAY && T.STORM_CLOSED[id]){ await say('', T.STORM_CLOSED[id]); return; } if (h < d.open[0] || h >= d.open[1]){ await say('', d.closed); return; }
    await fade(true, 250); setIndoor(id); P.teleport(d.in[0], d.in[1], d.in[2]); P.camYaw = d.camYaw; const c = companion(); if (c) c.pos.set(d.in[0] + 0.9, ROOMS[id].y, d.in[1] + 0.3); audio.tone(880, 0.08, { vol:0.04 }); await fade(false, 250); };
  const exit = async () => { const d = DOORS[G.indoor]; if (!d) return; await fade(true, 250); setIndoor(false); P.teleport(d.out[0], d.out[1], d.out[2]); const c = companion(); if (c){ const x = d.out[0] + 1.2, z = d.out[1]; c.pos.set(x, heightAt(x, z), z); } await fade(false, 250); };
  const enterRoom = () => enter('class'), exitRoom = exit;

  // ---- 会話 ----
  // その人が知っているうわさがあれば、ふつうの話のかわりに一度だけ話す
  const rumor = async id => { const st = S(); for (const r of T.RUMORS){ if (!r.lines[id] || st.flags['rumor_' + r.key] || !r.when(st)) continue; st.flags['rumor_' + r.key] = true; if (r.set) st.flags[r.set] = true; await talk(r.lines[id]); return true; } return false; };
  // ひとこと：その場の状況（雨・時間・場所・帽子）に合うものを優先して、同じセリフはしばらく言わない
  const said = new Set();
  const lineFor = id => { const st = S(), D = TALK2[id]; if (!D) return null; const f = st.friends[id] ?? 0, tier = f < 3 ? 0 : f < 7 ? 1 : 2, h = st.hour, npc = G.npcs[id], k = npc && npc.spot ? npc.spot.k : '';
    const ctx = []; if (G.weatherNow && G.weatherNow.rain > 0.15 && D.rain) ctx.push(...D.rain); if (h < 9 && D.morning) ctx.push(...D.morning); if (h >= 16.5 && h < 19 && D.evening) ctx.push(...D.evening); if (h >= 19 && D.night) ctx.push(...D.night);
    if (/beach|fin/.test(k) && D.beach) ctx.push(...D.beach); if ((G.inSchool || k === 'room') && D.school) ctx.push(...D.school); if (st.items && st.items.hat && st.items.wearHat && D.hat) ctx.push(...D.hat);
    const base = [...(D.t0 || []), ...(tier >= 1 ? D.t1 || [] : []), ...(tier >= 2 ? D.t2 || [] : [])], top = tier >= 2 && D.t2 ? D.t2 : tier >= 1 && D.t1 ? D.t1 : [];
    const pick = arr => { const fresh = arr.filter(l => !said.has(l)); if (!fresh.length) return null; const l = fresh[Math.floor(Math.random()*fresh.length)]; said.add(l); return l; };
    let l = (ctx.length && Math.random() < 0.45 && pick(ctx)) || (top.length && Math.random() < 0.5 && pick(top)) || pick(base);
    if (!l){ for (const x of base) said.delete(x); l = pick(base); } return l; };
  G.lineFor = lineFor;
  const chat = async id => { if (await rumor(id)) return; const st = S(), n = (st.today.talked[id] || 0);
    const l = (G.npcai && G.npcai.take(id)) || lineFor(id) || T.TALK[id][0][0]; G.speak(id, l);   /* ふだんのひとことは頭の上の吹き出し（会話の帯は使わない） */ if (!n) friend(id, 1); st.today.talked[id] = n + 1; };
  const talkTo = async id => { const st = S(), npc = G.npcs[id];
    if (id === 'mother' && !(st.items && st.items.umbrella) && [2, 5, 7, 8, 10].includes(st.day)){ await say(N.mother, T.MOTHER_RAIN); return; }
    if (id === 'sister' && st.bugs.length >= 4 && !st.flags.sisterCicada){ st.flags.sisterCicada = true; await talk(T.SISTER_CICADA); log('みなみに、島じゅうのセミを全部見つけたことを自慢した。'); return; }
    if (id === 'sister' && (st.crabs || []).length >= 2 && !st.flags.sisterCrab){ st.flags.sisterCrab = true; await talk(T.SISTER_CRAB); log('みなみと、磯で見つけたカニの話をした。'); return; }
    if (T.FAMILY.includes(id)){ const n = st.today.talked[id] || 0; G.speak(id, (G.npcai && G.npcai.take(id)) || lineFor(id) || T.FAMILY_TALK[id][0][0]); st.today.talked[id] = n + 1; return; }
    if (id === 'granny'){ if (st.day >= 8 && !st.flags.senko){ await talk(T.SENKO_GIVE); st.flags.senko = true; log('しおばあに、線香花火をもらった。'); return; }
      await chat(id); const c = await choose(N.granny, 'はい、いらっしゃい', ['ラムネをもらう', 'やめる']);
      if (c === 0){ if (st.today.ramune) await talk(T.GRANNY_NOMORE); else { await talk(T.GRANNY_RAMUNE); st.ramune++; st.today.ramune = true; audio.pickup(); log('しおかぜ商店でラムネをもらった。'); } } return; }
    if (id === 'ojisan'){
      if (!st.flags.metOjisan){ await talk(T.OJISAN_FIRST); st.flags.metOjisan = true; log('港の源さんと知り合った。'); return; }
      if (st.day === TYPHOON_DAY){ if (st.today.stormHelp){ await say(N.ojisan, '早く帰れ。ここはもう大丈夫だ'); return; }
        if (await choose(N.ojisan, T.STORM_HELP_ASK, ['手伝う', 'やめる']) !== 0) return;
        st.today.stormHelp = true; await fade(true, 800); st.hour += 1.0; await fade(false, 800); await talk(T.STORM_HELP); st.money += 1000; friend('kouta', 2); audio.pickup(); toast(`おこづかい ＋1000円`, 3000); log('台風の朝、航太と源さんの船のロープを手伝った。びしょぬれになった。'); return; }
      const canRide = npc.spot && npc.spot.k === 'port' && !st.today.ride, atPier = npc.spot && npc.spot.k === 'pier', opts = [], acts = [];
      if (canRide){ opts.push('荷台に乗せてもらう'); acts.push('ride'); }
      if (atPier && !st.today.net){ opts.push('網の手伝いをする'); acts.push('net'); }
      if (st.fish > st.fishSold){ opts.push(`釣った魚を見せる（${st.fish - st.fishSold}匹）`); acts.push('sell'); }
      if (!st.flags.moneyHint){ opts.push('おこづかいを稼ぎたい'); acts.push('hint'); }
      await chat('ojisan'); if (!opts.length) return; opts.push('やめる'); acts.push('no');
      const a = acts[await choose(N.ojisan, canRide ? T.RIDE_ASK : 'おう', opts)];
      if (a === 'ride') await truckRide();
      else if (a === 'hint'){ st.flags.moneyHint = true; st.flags.knowFlight = true; await talk(T.MONEY_HINT); }
      else if (a === 'net'){ st.today.net = true; await talk(T.NET_HELP.slice(0, 1)); await fade(true, 800); st.hour += 1.2; P.pose = 'craft'; await fade(false, 800); await talk(T.NET_HELP.slice(1)); P.pose = null; st.money += 700; audio.pickup(); toast(`おこづかい ＋700円（${st.money}円）`, 3000); log('源さんの網の手伝いをして、700円もらった。'); }
      else if (a === 'sell'){ const n = st.fish - st.fishSold; await talk(T.FISH_SELL(n)); st.fishSold = st.fish; st.money += n*150; audio.pickup(); toast(`おこづかい ＋${n*150}円（${st.money}円）`, 3000); log(`釣った魚を源さんに買ってもらった。${n*150}円になった。`); }
      return; }
    if (id === 'oneesan'){ const k = npc.spot && npc.spot.k, place = T.ONEESAN_PLACE[k];
      if (!st.flags.metOneesan){ await talk(T.FIRST_ONEESAN); st.flags.metOneesan = true; friend(id, 1); st.today.talked[id] = 1; log('麦わら帽子のお姉さんに会った。名前は教えてくれなかった。'); return; }
      if (st.flags.isletBottle && !st.flags.toldBottle){ st.flags.toldBottle = true; await talk(T.ONEESAN_BOTTLE); friend(id, 2); log('お姉さんに、沖の小島で見つけた小瓶の話をした。'); return; }
      st.seen = st.seen || {}; if (place && !st.seen[k]){ st.seen[k] = true; G.speak(id, place[1]); friend(id, 1); log(`${place[0]}で、お姉さんに会った。`); } else await chat(id);
      if (!(st.ramune > 0 && !st.today.gave[id])) return;
      const a = ['ramune', 'no'][await choose(N[id], '……あら', ['ラムネをあげる', 'やめる'])];
      if (a === 'ramune'){ st.ramune--; st.today.gave[id] = true; await talk(T.RAMUNE_GIVE[id]); friend(id, 2); log('お姉さんにラムネをあげた。'); }
      return; }
    for (const t of [2, 1]) if (T.TIER_TALK[id] && st.flags[`tier${t}_${id}`] && !st.flags[`tierSaid${t}_${id}`]){ st.flags[`tierSaid${t}_${id}`] = true; if (t === 2) st.flags[`tierSaid1_${id}`] = true; await talk(T.TIER_TALK[id][t - 1]); return; }
    if (id === 'nagisa' && !st.flags.metNagisa){ await talk(T.FIRST_NAGISA); await choose(N.nagisa, 'で、手伝ってくれるよね？', ['まかせて', '……がんばる']); await talk(T.FIRST_NAGISA_END); st.flags.metNagisa = true; friend('nagisa', 1); st.today.talked.nagisa = 1; log('なぎさに、文化祭の準備を手伝うと約束した。'); return; }
    const opts = [], acts = [];
    if (G.companion === id){ opts.push('ここで別れる'); acts.push('part'); } else if (!G.companion && st.hour < 19.6){ opts.push('いっしょに歩く'); acts.push('walk'); }
    if (st.ramune > 0 && !st.today.gave[id]){ opts.push('ラムネをあげる'); acts.push('ramune'); }
    if (id === 'kouta' && npc.spot && npc.spot.beach && !npc.following && !st.today.swim && st.hour < 18.5){ opts.push('海で泳ぐ'); acts.push('swim'); }
    if (id === 'kotoha' && npc.spot && !npc.spot.room && !npc.following && !st.today.sketch){ opts.push('スケッチを見せてもらう'); acts.push('sketch'); }
    // 雨の日：傘がない（さしていない）なら、友達の傘に入れてもらう。自分に傘があって友達がないなら、入れてあげる
    const raining = G.weatherNow && G.weatherNow.rain > 0.12 && !G.indoor && !G.inSchool, mine = st.items && st.items.umbrella && !st.items.umbrellaOff;
    if (raining && G.aiai !== id){ if (!mine && G.npcHasUmbrella(id) && T.AIAI_IN[id]){ opts.push('傘に入れてもらう'); acts.push('aiaiIn'); } else if (mine && T.AIAI_GIVE[id]){ opts.push('傘に入れてあげる'); acts.push('aiaiGive'); } }
    // 話しかけると、まず吹き出しでひとこと。ほかにできることがあるときだけ、選ぶ帯を出す
    await chat(id); if (!opts.length) return; opts.push('やめる'); acts.push('no');
    const a = acts[await choose(N[id], '……', opts)];
    if (a === 'walk'){ await talk(T.INVITE[id]); npc.following = true; G.companion = id; toast(N[id] + 'といっしょに、行ってみたい場所まで歩こう'); }
    else if (a === 'part'){ await talk(T.PART[id]); npc.following = false; G.companion = null; npc.spot = null; }
    else if (a === 'ramune'){ st.ramune--; st.today.gave[id] = true; await talk(T.RAMUNE_GIVE[id]); friend(id, 1); log(N[id] + 'にラムネをあげた。'); }
    else if (a === 'swim'){ await talk(T.SWIM.slice(0, 1)); await fade(true); P.dismountBike(true); st.hour += 1.5; st.today.swim = true; P.teleport(90, 36, -Math.PI/2); await fade(false); G.snap(); await talk(T.SWIM.slice(1)); friend('kouta', 2); log('航太と海で泳いだ。競争には負けた。'); }
    else if (a === 'aiaiIn'){ await talk(T.AIAI_IN[id]); await G.startAiai(id, 'npc'); }
    else if (a === 'aiaiGive'){ await talk(T.AIAI_GIVE[id]); await G.startAiai(id, 'player'); }
    else if (a === 'sketch'){ await talk(T.SKETCH); st.today.sketch = true; friend('kotoha', 2); log('ことはのスケッチブックを見せてもらった。'); }
  };
  for (const id of ['nagisa', 'kouta', 'kotoha', 'granny', 'oneesan', 'ojisan', ...T.FAMILY]) I.push({ get x(){ return G.npcs[id].pos.x; }, get z(){ return G.npcs[id].pos.z; }, r:2.3, when: () => G.npcs[id].root.visible && Math.abs(G.npcs[id].pos.y - P.pos.y) < 2.5 && !(S().day === 11 && S().hour >= 17 && id !== 'granny'), label: () => (id === 'oneesan' && !S().flags.metOneesan ? '麦わら帽子の人' : id === 'ojisan' && !S().flags.metOjisan ? '日に焼けたおじさん' : N[id]) + 'と話す' + (G.npcs[id].doing ? `（${G.npcs[id].doing}）` : ''), act: () => talkTo(id) });

  // ---- 文化祭の準備 ----
  const doPrep = async () => { const st = S(), nag = G.npcs.nagisa, here = nag.root.visible && nag.spot && nag.spot.room && !nag.following || G.companion === 'nagisa';
    if (st.prep >= 5){ if (here) await talk(T.PREP_COMPLETE); else await say('', '準備はもう終わっている。教室がまるごと「海の家」だ。'); return; }
    if (st.today.prep){ if (here) await talk(T.PREP_DONE_TODAY); else await say('', '今日のぶんの作業はもう終わった。'); return; }
    if (!st.flags.metNagisa && here){ await talkTo('nagisa'); return; }
    if (st.hour > 17.6){ await say('', '今日はもう遅い。作業は明日にしよう。'); return; }
    const task = T.PREP_TASKS[st.prep];
    if (await choose('', `今日の作業は「${task.name}」。\n${task.how}\n（2時間くらいかかる）`, ['やる', 'やめる']) !== 0) return;
    closeDialogue(); await work(st.prep);
    const stage = T.PREP[st.prep]; st.hour += 2; st.prep++; st.today.prep = true; G.applyPrep(); G.snap();
    if (here){ await talk(stage.lines); friend('nagisa', 1); log(stage.log); } else { await talk(T.PREP_ALONE); log(`ひとりで${task.name}を進めた。`); }
    for (const id of ['kouta', 'kotoha']) if (G.npcs[id].root.visible && G.npcs[id].spot && G.npcs[id].spot.room) friend(id, 1);
    toast(st.prep < 5 ? `「${task.name}」が終わった（${st.prep} / 5）。次は「${T.PREP_TASKS[st.prep].name}」` : '文化祭の準備が、ぜんぶ終わった！', 4500); };
  // 作業の画面：何を作っているかを出し、Eを押すたびに飾りが少しずつできていく
  const waitConfirm = () => new Promise(res => { const h = e => { if (e.repeat || !isConfirm(e.code)) return; removeEventListener('keydown', h); res(); }; addEventListener('keydown', h); });
  const work = async i => { const task = T.PREP_TASKS[i], obj = W.decos[['deco1', 'sign1', 'deco2', 'deco3', 'deco4'][i]], $ = id => document.getElementById(id);
    P.teleport(40.2, -62.5, -0.9); P.camYaw = task.cam[0]; P.camPitch = task.cam[1]; P.camDist = 3.4; P.pose = 'work';
    G.renderer.localClippingEnabled = true; const saved = [], plane = new THREE.Plane(new THREE.Vector3(task.axis === 'x' ? -1 : 0, 0, task.axis === 'z' ? -1 : 0), 0); let lo = 0, hi = 1;
    if (obj){ obj.visible = true; obj.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(obj); lo = box.min[task.axis] - 0.05; hi = box.max[task.axis] + 0.05;
      obj.traverse(m => { if (m.isMesh){ saved.push([m, m.material]); m.material = m.material.clone(); m.material.clippingPlanes = [plane]; } }); }
    const show = n => { plane.constant = lo + (hi - lo)*n/task.steps; $('wbar').firstElementChild.style.width = (100*n/task.steps) + '%'; $('wcount').textContent = `${n} / ${task.steps} ${task.unit}`; };
    $('wtitle').textContent = `準備 ${i + 1} / 5　${task.name}`; $('wdesc').textContent = task.how; $('whint').textContent = 'Eを押して、手を動かす'; show(0); $('work').classList.remove('hidden');
    for (let n = 1; n <= task.steps; n++){ await waitConfirm(); audio.burst(0.07, 2400 + (n % 3)*500, 0.12, { type:'bandpass' }); audio.tone(520 + n*45, 0.12, { type:'triangle', vol:0.07 }); show(n); await wait(140); }
    $('whint').textContent = task.done; audio.pickup(); await wait(1500); $('work').classList.add('hidden');
    for (const [m, mat] of saved){ m.material.dispose(); m.material = mat; }   /* 切り取りは校舎の階の表示でも使うので、切らない */ P.pose = null; };
  // 校舎には昇降口から歩いて（自転車でも）そのまま入れる（school.js）。自分の教室は3階
  I.push({ x:38.8, z:-61.4, r:1.7, when: () => G.inSchool && P.pos.y > 16, label: () => S().prep < 5 ? `文化祭の準備：${T.PREP_TASKS[S().prep].name}` : '教室をながめる', act: doPrep });

  // ---- ベンチ・貝がら・家 ----
  // 4つめは座面の高さ（展望台のベンチ 0.5、ふつうのベンチ 0.45、商店の前の縁台 0.55）
  for (const [x, z, ry, h] of [[-34, -65.6, 0, 0.5], [-190, 248.4, 0, 0.5], [68, 26, Math.PI/2, 0.45], [112, -152, Math.PI/2, 0.45], [-224, 80, -Math.PI/2, 0.45], [44, -19.5, Math.PI, 0.45], [-81.95, 61.8, Math.PI, 0.55], [-391, 65.5, -Math.PI/2, 0.45]])
    I.push({ x, z, r:1.3, when: () => !P.sitting && !G.indoor, label:'すわる', act: async () => { P.dismountBike(true); P.pos.x = x; P.pos.z = z; P.yaw = ry; P.sitting = true; P.seatDrop = h - 0.39; } });
  for (const s of W.shells) I.push({ x:s.x, z:s.z, r:1.4, when: () => !S().shells.includes(s.id), label:'貝がらを拾う', act: async () => { S().shells.push(s.id); G.observe && G.observe('shell', s.x, s.z); s.mesh.visible = false; audio.pickup(); toast(`貝がらを拾った（${S().shells.length} / ${W.shells.length}）`); log('浜で貝がらを拾った。'); } });
  for (const c of W.cats) I.push({ x:c.x, z:c.z, r:1.9, when: () => !G.indoor, label:'ねこをなでる', act: async () => { G.observe && G.observe('cat', c.x, c.z); audio.tone(700, 0.25, { vol:0.08, slide:1.5 }); audio.tone(900, 0.3, { vol:0.06, slide:0.7, when:0.22 }); await say('', S().today.cat ? 'ねこは目を細めてじっとしている。' : 'ねこは一度だけ「にゃ」と鳴いて、また海のほうを向いた。'); if (!S().today.cat){ S().today.cat = true; log('塀の上のねこをなでた。'); } } });
  I.push({ x:HOME.x, z:HOME.z + 4.4, r:2.2, when: () => !G.indoor, label:T.HOME_ENTER, act: () => enter('home') });
  I.push({ x:HOME.x + 3.4, z:HOME.z - 2.15, r:1.0, when: () => G.indoor === 'home', label:() => S().diary.length && (S().hour < 12 || (S().day === 11 && !S().flags.finale)) ? '絵日記を見る' : T.DESK, act: async () => { const st = S();
    if (st.day === 11 && !st.flags.finale){
      if (st.diary.length && await choose('', '机の上に、これまでの絵日記が置いてある。', ['これまでの絵日記を読む', '浜へ行く']) === 0){ await browseDiary(st.diary); return; }
      await say('', '今夜は花火だ。夕方になったら、東の浜へ行こう。'); return; }
    if (st.hour < 12){
      if (st.diary.length && await choose('', 'まだ朝だ。机の上には、これまでの絵日記がある。', ['これまでの絵日記を読む', 'やめる']) === 0) await browseDiary(st.diary);
      else if (!st.diary.length) await say('', 'まだ朝だ。寝るにはもったいない。');
      return; }
    if (st.diary.length){
      const c = await choose('', '今日はもう休む？', ['日記を書いて寝る', 'これまでの絵日記を読む', 'まだ遊ぶ']);
      if (c === 0) await endDay(); else if (c === 1) await browseDiary(st.diary);
    } else if (await choose('', '今日はもう休む？', ['日記を書いて寝る', 'まだ遊ぶ']) === 0) await endDay(); } });

  // ---- 家・店・空港の中と、島の行事 ----
  const fx = []; G.fxUpdate = dt => { for (let i = fx.length - 1; i >= 0; i--) if (fx[i](dt) === false) fx.splice(i, 1); };
  function setupPlaces(){
    const inRoom = id => () => G.indoor === id;
    const at = (def, x, z) => ({ x:def.x + x, z:def.z + z });
    const spot = (def, x, z, r, id, label, act) => I.push({ ...at(def, x, z), r, when: inRoom(id), label, act });
    // 自宅
    spot(HOME_IN, -3.5, 2.85, 0.9, 'home', '外に出る', exit);
    spot(HOME_IN, -3.4, -1.9, 1.0, 'home', 'テレビを見る', async () => { audio.tone(1200, 0.05, { vol:0.03 }); await say('', T.TV[S().day % T.TV.length]); S().hour += 0.1; });
    spot(HOME_IN, -0.3, -2.0, 0.9, 'home', '扇風機に当たる', async () => { const st = S(); audio.burst(1.2, 600, 0.05); await say('', T.FAN[(st.day + (st.today.fan || 0)) % T.FAN.length]); st.today.fan = (st.today.fan || 0) + 1; if (st.today.fan === 1 && st.day % 3 === 0) log('扇風機の前で、宇宙人の声をまねした。'); });
    spot(HOME_IN, -2.2, 0.55, 1.0, 'home', () => T.SUIKA_DAYS.includes(S().day) && !S().today.suika ? 'スイカを食べる' : '麦茶を飲む', async () => { const st = S();
      if (T.SUIKA_DAYS.includes(st.day) && !st.today.suika){ st.today.suika = true; await talk(T.SUIKA); st.hour += 0.3; log('縁側でスイカを食べた。種をとばしたら、庭の向こうまで飛んだ。'); }
      else { audio.tone(1500, 0.08, { vol:0.03 }); audio.tone(1900, 0.1, { vol:0.025, when:0.1 }); await say('', T.MUGICHA); } });
    spot(HOME_IN, 2.2, 1.6, 1.1, 'home', 'ふとんで、ごろごろする', async () => { const st = S(); if (st.hour > 17){ await say('', 'いま寝たら、夜まで起きなさそうだ。'); return; }
      await fade(true, 900); st.hour += 1.5; await fade(false, 900); await say('', T.NAP[st.day % T.NAP.length]); if (!st.today.nap){ st.today.nap = true; log('昼寝をした。起きたら畳のあとが顔についていた。'); } });
    spot(HOME_IN, -2.4, 2.45, 0.7, 'home', () => S().items && S().items.umbrella ? '傘立て（もう借りた）' : '傘立てから傘を借りる', async () => { const st = S(); st.items = st.items || {}; if (st.items.umbrella){ await say('', '傘立てには、骨の折れた傘が一本残っている。'); return; } st.items.umbrella = true; audio.pickup(); await talk(T.UMBRELLA_STAND); });
    spot(SHOP_IN, 3.1, -0.2, 0.9, 'shop', '道具の棚を見る', async () => { const st = S(); st.items = st.items || {}; const list = Object.entries(T.ITEMS).filter(([k]) => !st.items[k]);
      if (!list.length){ await say('', '欲しいものは、もうぜんぶ持っている。'); return; }
      const c = await choose('', `道具の棚。（おこづかい ${st.money}円）`, [...list.map(([k, v]) => `${v.name}　${v.price}円`), 'やめる']); if (c >= list.length) return; const [k, v] = list[c];
      if (st.money < v.price){ await say('しおばあ', `${v.name}かい。${v.price}円だよ。……足りないねえ。源さんの手伝いでもしておいで`); return; }
      st.money -= v.price; st.items[k] = true; if (k === 'hat') st.items.wearHat = true; audio.pickup(); await say('しおばあ', `はいよ、${v.name}。${v.desc}`); log(`しおかぜ商店で${v.name}を買った。`); });
    spot(HOME_IN, 3.7, 0.4, 0.9, 'home', '本棚の上を見る', async () => { const st = S(); await say('', T.SHELF(st.bugs.length, st.shells.length, st.fish, (st.crabs || []).length)); });
    // 校舎の各部屋
    const inFl = flY => () => !G.indoor && G.inSchool && Math.abs(P.pos.y - flY) < 1.2 && !P.riding && !P.driving;
    I.push({ x:50.5, z:-59.6, r:1.8, when: inFl(12.8), label:'ピアノを弾く', act: async () => { const st = S();
      [523.25, 659.25, 783.99, 987.77, 1318.51].forEach((f, i) => audio.tone(f, 1.5, { type:'triangle', vol:0.06, when:i*0.16, echo:true }));
      await talk(T.SCHOOL_SPOTS.piano);
      if (G.companion && T.SCHOOL_SPOTS.pianoFriend[G.companion]){ await talk(T.SCHOOL_SPOTS.pianoFriend[G.companion]); friend(G.companion, 1); }
      if (!st.today.piano){ st.today.piano = true; log('音楽室のピアノを少しだけ弾いた。潮風が鍵盤をなでていった。'); } } });
    I.push({ x:49.5, z:-62.4, r:1.7, when: inFl(12.8), label:'ドラムをたたく', act: async () => {
      audio.burst(0.06, 220, 0.25); audio.burst(0.05, 1600, 0.1, { when:0.18, type:'highpass' }); audio.burst(0.07, 180, 0.28, { when:0.35 });
      await talk(T.SCHOOL_SPOTS.drums); } });
    I.push({ x:48.4, z:-58.4, r:2.0, when: inFl(9.1), label:'本棚を見る', act: async () => { const st = S();
      const c = await choose('', T.SCHOOL_SPOTS.libraryAsk, ['白砂島の地誌', '白砂祭の文集', 'やめる']);
      if (c === 0) await talk(T.SCHOOL_SPOTS.libraryIsland);
      else if (c === 1){ st.flags.readAlbum = true; await talk(T.SCHOOL_SPOTS.libraryAlbum); if (!st.today.album){ st.today.album = true; log('図書室で、十年前の白砂祭の文集を見つけた。'); } } } });
    I.push({ x:29.0, z:-60.2, r:2.0, when: inFl(16.5), label:'イーゼルを見る', act: async () => { const st = S();
      await talk(T.SCHOOL_SPOTS.art);
      if (G.companion === 'kotoha' || (st.friends.kotoha >= 3 && Math.hypot(G.npcs.kotoha.pos.x - P.pos.x, G.npcs.kotoha.pos.z - P.pos.z) < 6)){ await talk(T.SCHOOL_SPOTS.artKotoha); } } });
    I.push({ x:23.5, z:-59.2, r:2.0, when: inFl(9.1), label:'ベッドで一休みする', act: async () => {
      await fade(true, 500); S().hour += 0.25; await fade(false, 500); await talk(T.SCHOOL_SPOTS.health); } });
    // 沖の小島：砂浜の小瓶と、高台の古い石像
    { const bot = new THREE.Group();
      const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.28, 7), new THREE.MeshLambertMaterial({ color:0x66b88e, transparent:true, opacity:0.85 }));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.08, 7), bm.material); neck.position.y = 0.16;
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 6), new THREE.MeshLambertMaterial({ color:0xb8925a })); cork.position.y = 0.21;
      bot.add(bm, neck, cork); bot.position.set(-388, heightAt(-388, 62.5) + 0.06, 62.5); bot.rotation.set(0.3, 0.4, 1.15); G.outdoor.add(bot);
      fx.push(() => { bot.visible = !S().flags.isletBottle; });
      I.push({ x:-388, z:62.5, r:1.9, when: () => !G.indoor && !S().flags.isletBottle && !P.riding && !P.driving, label:'小瓶を拾う', act: async () => { const st = S();
        st.flags.isletBottle = true; st.today.islet = true; audio.pickup(); G.snap(); await talk(T.ISLET_BOTTLE); log('沖の小島で、十年前の手紙が入ったガラスの小瓶を見つけた。'); } });
      I.push({ x:-416, z:64, r:2.3, when: () => !G.indoor && !P.riding && !P.driving, label:'石像を見る', act: async () => { const st = S();
        st.today.islet = true; await talk(T.ISLET_STATUE); if (!st.today.isletStat){ st.today.isletStat = true; log('沖の小島の石像から、海を隔てて白砂島を見わたした。'); } } }); }
    // しおかぜ商店
    I.push({ x:SHOP.x - 0.5, z:SHOP.z - 4.6, r:1.6, when: () => !G.indoor && !P.riding && !P.driving, label:T.SHOP_ENTER, act: () => enter('shop') });
    spot(SHOP_IN, 0, 2.85, 0.8, 'shop', '外に出る', exit);
    spot(SHOP_IN, 2.0, 0.2, 0.9, 'shop', 'アイスを買う', async () => { const st = S(); if (st.today.ice){ await say('', '今日はもう食べた。おなかをこわしそうだ。'); return; }
      st.today.ice = true; audio.tone(140, 0.1, { type:'square', vol:0.08 }); const hit = Math.random() < 0.18; await talk(hit ? T.ICE.hit : T.ICE.miss); log(hit ? 'アイスの棒が「あたり」だった！' : 'しおかぜ商店で、ソーダ味のアイスを食べた。'); });
    spot(SHOP_IN, -2.2, 1.25, 1.2, 'shop', 'だがしをえらぶ', async () => { const st = S(); const d = T.DAGASHI[(st.day*3 + (st.today.dagashi || 0)) % T.DAGASHI.length]; st.today.dagashi = (st.today.dagashi || 0) + 1;
      audio.pickup(); await say('', `${d}を買った。十円玉が、手の中であたたかかった。`); if (st.today.dagashi === 1) log(`だがし屋で${d}を買った。`); });
    // 空港の待合室
    I.push({ x:TERM.x, z:TERM.z + 5.2, r:1.8, when: () => !G.indoor && !P.riding && !P.driving, label:T.TERM_ENTER, act: () => enter('term') });
    spot(TERM_IN, 0, 3.0, 0.8, 'term', '外に出る', exit);
    spot(TERM_IN, 4.4, 0.9, 0.75, 'term', '時刻表を見る', async () => { await say('', T.TIMETABLE); S().flags.knowFlight = true; });
    spot(TERM_IN, 4.4, 2.5, 0.85, 'term', '遊覧飛行の受付', flight);
    spot(TERM_IN, 0, -2.7, 1.6, 'term', '窓から滑走路を見る', async () => { const st = S(); await say('', T.RUNWAY[st.day % 2]); if (!st.today.runway){ st.today.runway = true; log('空港の待合室から、滑走路をながめた。'); } });
    spot(TERM_IN, -6.0, -1.5, 1.0, 'term', 'おみやげを見る', async () => { await say('', T.SOUVENIR); });
    // ラジオ体操（毎朝、広場で）
    I.push({ x:-63.5, z:40.6, r:3.2, when: () => !G.indoor && S().hour >= 6.9 && S().hour < 8.5 && !S().today.taiso && !P.riding && !P.driving, label:'ラジオ体操をする', act: async () => { const st = S();
      P.yaw = 0.2; P.pose = 'taiso'; await talk(T.TAISO); await wait(2600); P.pose = null; st.today.taiso = true; st.taiso = Math.min(12, st.taiso + 1); st.hour += 0.3; audio.pickup();
      await say('', `${T.TAISO_DONE}（${st.taiso} / 12）`); log(st.taiso === 1 ? '朝、広場のラジオ体操に行った。' : `ラジオ体操に行った。スタンプは${st.taiso}個目。`); } });
    // 盆踊り（8月13日の夕方）：火の見やぐらから提灯を張り、輪になって踊る
    { const n = 8, per = 6, im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 6), new THREE.MeshBasicMaterial({ color:0xffffff }), n*per), m = new THREE.Matrix4(), col = new THREE.Color();
      const top = new THREE.Vector3(BON.x, heightAt(BON.x, BON.z) + 8.5, BON.z); const wire = [];
      for (let i = 0; i < n; i++){ const a = i/n*Math.PI*2, ex = BON.x + Math.sin(a)*11, ez = BON.z + Math.cos(a)*11, ey = heightAt(ex, ez) + 3.4;
        for (let j = 0; j < per; j++){ const t = (j + 1)/(per + 0.6), x = top.x + (ex - top.x)*t, z = top.z + (ez - top.z)*t, y = top.y + (ey - top.y)*t - Math.sin(t*Math.PI)*0.7;
          m.makeTranslation(x, y, z); im.setMatrixAt(i*per + j, m); im.setColorAt(i*per + j, col.set(j % 2 ? 0xfff2d0 : 0xff6a50)); }
        wire.push(top.x, top.y, top.z, ex, ey, ez); }
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3)); const lines = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color:0x222222 }));
      const g = new THREE.Group(); g.add(im, lines); g.visible = false; G.scene.add(g); im.frustumCulled = false;
      const bonOn = () => S().day === BON.day && S().hour >= BON.from - 0.5 && S().hour < BON.to + 0.5;
      fx.push(() => { g.visible = bonOn() && G.indoor !== 'class'; });
      I.push({ x:BON.x, z:BON.z, r:9.5, when: () => !G.indoor && S().day === BON.day && S().hour >= BON.from && S().hour < BON.to && !S().today.bon && !P.riding && !P.driving, label:'踊りの輪に入る', act: bonDance }); }
    // 線香花火（しおばあにもらったら、夜、家の前で）
    I.push({ x:HOME.x - 2.5, z:HOME.z + 7, r:2.6, when: () => !G.indoor && S().flags.senko && !S().flags.senkoDone && S().hour >= 19 && !P.riding && !P.driving, label:T.SENKO, act: senko });
  }
  let taikoAt = 0;
  function bonSound(st){ if (st.day !== BON.day || st.hour < BON.from || st.hour >= BON.to || G.indoor) return; const d = Math.hypot(P.pos.x - BON.x, P.pos.z - BON.z); if (d > 120 || G.time < taikoAt) return;
    taikoAt = G.time + 0.62; const v = Math.max(0, 1 - d/120)*0.5; audio.burst(0.35, 120, v); if (Math.floor(G.time/0.62) % 4 === 3) audio.burst(0.08, 900, v*0.25, { when:0.31, type:'bandpass' });
    if (d > 25 && d < 90 && !st.today.bonHint){ st.today.bonHint = true; toast(T.BON_HINT, 3500); } }
  async function bonDance(){ const st = S(), c = companion(); st.today.bon = true; P.dismountBike(true); G.timeStop = true;
    let on = true, beat = 0; const slot = 6;
    fx.push(dt => { if (!on) return false; const a = (slot/BON.n)*Math.PI*2 + G.time*0.11, x = BON.x + Math.sin(a)*BON.r, z = BON.z + Math.cos(a)*BON.r; P.pos.x = x; P.pos.z = z; P.yaw = a + Math.PI/2;
      if (c){ c.following = false; if (!c.override){ c.override = { k:'bonpair', x:BON.x, z:BON.z, ry:0, pose:'dance' }; c.spot = null; } const b = a - 0.35, cx = BON.x + Math.sin(b)*BON.r, cz = BON.z + Math.cos(b)*BON.r; c.pos.set(cx, heightAt(cx, cz), cz); c.yaw = b + Math.PI/2; }
      if ((beat -= dt) < 0){ beat = 0.62; audio.burst(0.35, 120, 0.5); } });
    P.pose = 'dance'; P.camDist = 9; P.camPitch = 0.3;
    try {
      await talk(T.BON_JOIN); await wait(2500); for (const l of T.BON_DANCE){ await say('', l); await wait(1500); }
      if (c && T.BON_FRIEND[G.companion]){ await talk(T.BON_FRIEND[G.companion]); friend(G.companion, 2); }
      if (st.flags.metOneesan){ await talk(T.BON_ONEESAN); friend('oneesan', 1); }
      G.snap(true); await wait(1500); await talk(T.BON_END);
    } finally { on = false; P.pose = null; if (c){ c.override = null; c.following = true; } P.camDist = 6.2; G.timeStop = false; }
    st.hour += 0.8; for (const k of ['nagisa', 'kouta', 'kotoha']) friend(k, 1); log(c ? `${N[G.companion]}と盆踊りの輪に入った。提灯の下で、汗びっしょりになった。` : '広場の盆踊りに入った。しおばあに踊りを教わった。'); }
  async function senko(){ const st = S(), c = companion(); st.flags.senkoDone = true; P.dismountBike(true); G.timeStop = true;
    const fwd = (d, side=0) => [P.pos.x + Math.sin(P.yaw)*d + Math.cos(P.yaw)*side, P.pos.z + Math.cos(P.yaw)*d - Math.sin(P.yaw)*side];
    if (c){ c.following = false; const [x, z] = fwd(0.1, -0.9); c.override = { k:'senko', x, z, ry:P.yaw, pose:'craft' }; c.spot = null; c.place(c.override); }
    P.pose = 'craft'; P.camDist = 4.2; P.camPitch = 0.25;
    // 火の玉と、散る火花
    const N2 = 60, g = new THREE.BufferGeometry(), pos = new Float32Array(N2*3), vel = [], life = []; g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color:0xffc070, size:2, sizeAttenuation:false, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, fog:false })); pts.frustumCulled = false; G.scene.add(pts);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color:0xff7a30 })); G.scene.add(ball);
    const balls = [[0.55, 0]].concat(c ? [[0.55, -0.9]] : []); let on = true;
    for (let i = 0; i < N2; i++){ vel.push([0, 0, 0]); life.push(0); }
    fx.push(dt => { if (!on){ G.scene.remove(pts, ball); g.dispose(); return false; }
      for (let i = 0; i < N2; i++){ life[i] -= dt; const k = i % balls.length, [bx, bz] = fwd(balls[k][0], balls[k][1]), by = P.pos.y + 0.55;
        if (life[i] <= 0 && Math.random() < 0.35){ life[i] = 0.12 + Math.random()*0.2; pos.set([bx, by, bz], i*3); const a = Math.random()*6.28, s = 0.35 + Math.random()*0.55; vel[i] = [Math.cos(a)*s, 0.2 + Math.random()*0.5, Math.sin(a)*s]; }
        else if (life[i] > 0){ pos[i*3] += vel[i][0]*dt; pos[i*3+1] += vel[i][1]*dt; pos[i*3+2] += vel[i][2]*dt; vel[i][1] -= 3*dt; } else pos[i*3+1] = -999; }
      g.attributes.position.needsUpdate = true; const [bx, bz] = fwd(0.55, 0); ball.position.set(bx, P.pos.y + 0.55, bz);
      if (Math.random() < dt*8) audio.burst(0.03, 4000, 0.02, { type:'highpass' }); });
    try { await talk(c && T.SENKO_FRIEND[G.companion] ? T.SENKO_FRIEND[G.companion] : T.SENKO_ALONE); G.snap(true); await wait(1500); }
    finally { on = false; P.pose = null; if (c){ c.override = null; c.following = true; } P.camDist = 6.2; G.timeStop = false; }
    st.hour += 0.3; if (c) friend(G.companion, 2); log(c ? `家の前で、${N[G.companion]}と線香花火をした。` : '家の前で、ひとりで線香花火をした。'); }

  // 着地の砂ぼこり・水しぶき
  G.puff = (x, y, z, k=1, opt={}) => {
    const color = opt.color ?? 0xd9cdb0, size = opt.size ?? 4, baseOp = opt.opacity ?? 0.8, up = opt.up ?? 1;
    const n = 12, g = new THREE.BufferGeometry(), pos = new Float32Array(n*3), vel = [];
    for (let i = 0; i < n; i++){ const a = i/n*Math.PI*2; pos.set([x, y + 0.05, z], i*3); vel.push([Math.cos(a)*(1.2 + Math.random())*k, (0.4 + Math.random()*0.5)*up, Math.sin(a)*(1.2 + Math.random())*k]); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color, size, sizeAttenuation:false, transparent:true, opacity:baseOp, depthWrite:false }), pts = new THREE.Points(g, m);
    pts.frustumCulled = false; G.scene.add(pts); let t = 0;
    fx.push(dt => { t += dt; for (let i = 0; i < n; i++){ pos[i*3] += vel[i][0]*dt; pos[i*3+1] += vel[i][1]*dt; pos[i*3+2] += vel[i][2]*dt; vel[i][0] *= 0.9; vel[i][2] *= 0.9; } g.attributes.position.needsUpdate = true; m.opacity = baseOp*(1 - t/0.4);
      if (t > 0.4){ G.scene.remove(pts); g.dispose(); m.dispose(); return false; } }); };
  // 定期便：時刻表どおりに飛行機が島から飛び立つ（遠くからでも見える。乗りたいと思えるように）
  const DEPART = [9 + 10/60, 13 + 25/60, 16 + 40/60]; let depKey = -1;
  G.resetPlane = () => { const p = W.plane, h = W.planeHome; G.planeBusy = false; G.departing = null; p.visible = true; p.position.set(h.x, h.y, h.z); p.rotation.set(0, h.ry, 0); };
  fx.push(dt => { const st = S(), p = W.plane, h = W.planeHome; if (G.mode !== 'play') return;
    if (G.departing){ const d = G.departing;
      if (d.away){ if (st.hour >= d.back || st.day !== d.day){ G.resetPlane(); } return; }
      const l = d.legs[d.leg]; d.s += l.v(d.s/l.L, l.L)*dt;
      if (d.s >= l.L){ d.s -= l.L; d.leg++; if (d.leg >= d.legs.length){ d.away = true; p.visible = false;
        return; } }
      const L2 = d.legs[d.leg], u = Math.min(1, d.s/L2.L), q = L2.c.getPointAt(u), t = L2.c.getTangentAt(u); p.position.copy(q); p.rotation.set(-Math.atan2(t.y, Math.hypot(t.x, t.z)), Math.atan2(t.x, t.z), 0, 'YXZ');
      const dist = Math.hypot(P.pos.x - q.x, P.pos.z - q.z, (P.pos.y - q.y)*0.5); if ((d.snd -= dt) < 0){ d.snd = 0.22; const v = Math.max(0, 1 - dist/520)*(G.indoor ? 0.3 : 1); if (v > 0.01) audio.burst(0.3, 160 + Math.min(300, q.y*3), 0.18*v); }
      if (!d.told && dist < 380 && d.leg >= 1 && !G.indoor){ d.told = true; d.near = true; if (!st.today.sawPlane){ st.today.sawPlane = true; log('空港から飛び立つ飛行機を見た。窓の中の人には、島はどう見えるんだろう。'); } }
      return; }
    if (G.planeBusy || st.day === 11 || st.day === TYPHOON_DAY) return;
    DEPART.forEach((t, i) => { const key = st.day*10 + i; if (st.hour >= t && st.hour < t + 0.25 && depKey !== key){ depKey = key; const g = h.y, V = (x, y, z) => new THREE.Vector3(x, y, z), cv = pts => new THREE.CatmullRomCurve3(pts.map(a => V(...a)));
      const legs = [{ c:cv([[34, g, 106.5], [30, g, 108.5], [10, g, 111], [-20, g, 111], [-40, g, 112], [-52, g, 114.5], [-52, g, 117], [-44, g, 116.5]]), v:() => 7 },
        { c:cv([[-44, g, 116.5], [-20, g, 116], [10, g, 116], [35, g + 1, 116], [60, g + 8, 115], [120, 35, 100], [260, 80, 60], [500, 140, 0], [800, 200, -80]]), v:(u, L) => Math.min(48, 8 + u*L*0.25) }];
      for (const l of legs) l.L = l.c.getLength(); G.planeBusy = true; G.departing = { legs, leg:0, s:0, snd:0, day:st.day, back:t + 0.9 }; } }); });
  // 遊覧飛行：おこづかいを貯めて券を買うと、小さな飛行機で島を一周する
  async function flight(){ const st = S(), h = st.hour;
    st.flags.knowFlight = true; if (h < 9 || h >= 16){ await say('', T.FLIGHT_CLOSED); return; } if (st.today.flight){ await say('', T.FLIGHT_DONE); return; }
    if (G.planeBusy){ await say('受付', 'ただいま定期便が出ています。飛行機がもどるまで、少しお待ちください。'); return; }
    if (await choose('受付', T.FLIGHT_ASK, [`乗る（${T.FARE}円）`, 'やめる']) !== 0) return;
    if (st.money < T.FARE){ await talk(T.FLIGHT_POOR(st.money)); return; }
    st.money -= T.FARE; st.today.flight = true; const comp = companion(), cid = G.companion, again = !!st.flags.flew; G.planeBusy = true;
    await talk(T.FLIGHT_BOARD); if (comp) await talk(T.FLIGHT_FRIEND_FREE(N[cid])); await talk(T.FLIGHT_PILOT);
    await fade(true, 900); setIndoor(false); const plane = W.plane, home = W.planeHome, g = home.y, fogWas = G.fogBase;
    if (comp){ comp.following = false; comp.override = { k:'fly', x:TERM.x, z:TERM.z, ry:0, pose:'idle', hide:true }; comp.spot = null; }
    P.hidden = true; P.frozen = true; P.camOverride = true; G.fogBase = [250, 1500];
    const V = (x, y, z) => new THREE.Vector3(x, y, z), curve = pts => new THREE.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : V(...p)));
    const { keys } = await import('./player.js');
    // 地上走行と離陸までは自動。上空に出たら、自分で操縦する。Bで空港へもどると、自動で着陸する
    const TAXI = { c:curve([[34, g, 106.5], [30, g, 108.5], [10, g, 111], [-20, g, 111], [-40, g, 112], [-52, g, 114.5], [-52, g, 117], [-44, g, 116.5]]), v:() => 7 };
    const TAKEOFF = { c:curve([[-44, g, 116.5], [-20, g, 116], [10, g, 116], [35, g + 1, 116], [60, g + 8, 115], [100, 28, 110], [140, 45, 100]]), v:(u, L) => Math.min(40, 8 + u*L*0.3) };
    const LAND = { c:curve([[205, 30, 116], [150, 18, 116], [110, g + 3, 116], [90, g, 116], [50, g, 116], [12, g, 116], [2, g, 114]]), v:u => 34 - 28*Math.min(1, u*1.25) };
    const PARK = { c:curve([[2, g, 114], [12, g, 110.5], [26, g, 107.6], [34, g, 106.5]]), v:() => 5 };
    for (const l of [TAXI, TAKEOFF, LAND, PARK]) l.L = l.c.getLength();
    const queue = [TAXI, TAKEOFF], fly = { phase:'auto', leg:null, s:0, pos:V(0, 0, 0), yaw:0, pitch:0, roll:0, v:40, t:0, done:false, seen:{} };
    let prevYaw = null; const cam = G.camera, tmp = V(0, 0, 0);
    const startReturn = () => { if (fly.phase !== 'free') return; fly.phase = 'auto'; G.promptOverride = null; const f = V(Math.sin(fly.yaw), 0, Math.cos(fly.yaw));
      const toward = V(320, 60, 116).sub(fly.pos).setY(0).normalize();
      queue.push({ c:curve([fly.pos.clone(), fly.pos.clone().addScaledVector(f, 90), fly.pos.clone().addScaledVector(f, 120).addScaledVector(toward, 120).setY(Math.max(70, fly.pos.y)), V(320, 60, 150), V(300, 50, 116), V(205, 30, 116)]), v:() => 40 }, LAND, PARK);
      queue.forEach(l => l.L = l.L || l.c.getLength()); };
    const place = (p, yaw, pitch, roll) => { plane.position.copy(p); plane.rotation.set(pitch, yaw, roll, 'YXZ'); P.pos.copy(p); P.yaw = yaw; };
    fx.push(dt => { if (fly.done) return false;
      if (G.skipReq && fly.phase !== 'end'){ fly.phase = 'auto'; queue.length = 0; fly.leg = PARK; fly.s = PARK.L; G.promptOverride = null; }
      if (fly.phase === 'auto'){
        if (!fly.leg){ fly.leg = queue.shift(); fly.s = 0; if (!fly.leg){ fly.done = true; return false; } }
        const l = fly.leg; fly.s += l.v(fly.s/l.L, l.L)*dt;
        if (fly.s >= l.L){ fly.leg = null; if (l === TAKEOFF){ fly.phase = 'free'; fly.v = 40; } else if (l === PARK){ fly.done = true; place(V(home.x, home.y, home.z), home.ry, 0, 0); return false; } return; }
        const u = Math.min(1, fly.s/l.L), p = l.c.getPointAt(u), t = l.c.getTangentAt(u), yaw = Math.atan2(t.x, t.z);
        const dy = prevYaw === null ? 0 : Math.atan2(Math.sin(yaw - prevYaw), Math.cos(yaw - prevYaw)); prevYaw = yaw; fly.roll += (THREE.MathUtils.clamp(-dy/Math.max(dt, 1e-3)*0.7, -0.6, 0.6) - fly.roll)*Math.min(1, dt*2);
        fly.pos.copy(p); fly.yaw = yaw; fly.pitch = -Math.atan2(t.y, Math.hypot(t.x, t.z)); fly.v = l.v(u, l.L); place(p, yaw, fly.pitch, p.y > g + 2 ? fly.roll : 0);
      } else if (fly.phase === 'free'){
        // 操縦：A/D で旋回、W/S で上昇・下降、Shift で加速、B で空港へもどる
        fly.t += dt; const turn = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), climb = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
        fly.v += ((keys.ShiftLeft || keys.ShiftRight ? 58 : 38) - fly.v)*Math.min(1, dt*0.8); fly.yaw -= turn*0.65*dt; fly.roll += (turn*0.55 - fly.roll)*Math.min(1, dt*3);
        let vy = climb*12; const ground = Math.max(0, heightAt(fly.pos.x, fly.pos.z)) + 25; if (fly.pos.y < ground) vy = Math.max(vy, (ground - fly.pos.y)*1.5 + 4); if (fly.pos.y > 260) vy = Math.min(vy, -4);
        // 島から遠く離れたら、ゆっくり島のほうへ向き直る
        const cx = -40 - fly.pos.x, cz = -55 - fly.pos.z; if (Math.hypot(cx, cz) > 650){ const want = Math.atan2(cx, cz); fly.yaw += Math.atan2(Math.sin(want - fly.yaw), Math.cos(want - fly.yaw))*Math.min(1, dt*0.6); }
        fly.pitch += (-Math.atan2(vy, fly.v) - fly.pitch)*Math.min(1, dt*3);
        fly.pos.x += Math.sin(fly.yaw)*fly.v*dt; fly.pos.z += Math.cos(fly.yaw)*fly.v*dt; fly.pos.y += vy*dt; place(fly.pos, fly.yaw, fly.pitch, -fly.roll);
        G.promptOverride = 'A/D 旋回　W/S 上昇・下降　Shift 加速　［B］空港にもどる';
        if (keys.KeyB || fly.t > 240) startReturn(); else if (fly.t > 190 && !fly.seen.late){ fly.seen.late = true; toast('燃料のメーターが半分を切った。そろそろもどろう', 4000); }
      }
      audio.engine(Math.min(16, 4 + fly.v*0.3), true);
      const p = plane.position, fwd = V(Math.sin(fly.yaw), 0, Math.cos(fly.yaw)), high = p.y > g + 10, back = high ? 22 : 11;
      tmp.copy(p).addScaledVector(fwd, -back); tmp.y += high ? 7 : 3.5; cam.position.lerp(tmp, Math.min(1, dt*(fly.phase === 'free' ? 3.5 : 2.5))); cam.lookAt(p.x + fwd.x*8, p.y + 1, p.z + fwd.z*8); });
    const until = fn => new Promise(res => { const tick = () => fn() ? res() : setTimeout(tick, 100); tick(); });
    const near = (x, z, r) => () => fly.phase === 'free' && Math.hypot(fly.pos.x - x, fly.pos.z - z) < r;
    cam.position.set(home.x - 12, home.y + 5, home.z - 6); await fade(false, 900);
    if (again){ G.skippable = true; toast('［Esc］で着陸までとばせる', 3500); }
    try {
      await until(() => fly.leg === TAKEOFF || fly.done || G.skipReq); if (!G.skipReq) await talk(T.FLIGHT_TAKEOFF);
      await until(() => fly.phase === 'free' || fly.done || G.skipReq); if (!G.skipReq){ G.snap(true); await say('', T.FLIGHT_VIEW[0][1]); }
      // 飛んだ場所に合わせて、見えたものを一言ずつ
      const views = [[130, -430, 160, T.FLIGHT_VIEW[1][1]], [84, 34, 140, T.FLIGHT_VIEW[2][1]], [30, -45, 120, T.FLIGHT_VIEW[3][1]], [-190, 250, 140, T.FLIGHT_VIEW_ISHI]];
      let friendSaid = false;
      while (fly.phase === 'free' && !G.skipReq){ await wait(200);
        for (const v of views){ if (!v.done && near(v[0], v[1], v[2])()){ v.done = true; await say('', v[3]); } }
        if (!friendSaid && fly.t > 20){ friendSaid = true; await talk(comp && T.FLIGHT_FRIEND[cid] ? T.FLIGHT_FRIEND[cid] : T.FLIGHT_ALONE); } }
      await until(() => fly.leg === LAND || fly.done || G.skipReq); if (!G.skipReq && !fly.done) await talk(T.FLIGHT_LAND);
      await until(() => fly.done);
    } finally {
      G.skippable = false; G.skipReq = false; G.planeBusy = false; G.promptOverride = null; st.flags.flew = true; fly.done = true;
      plane.position.set(home.x, home.y, home.z); plane.rotation.set(0, home.ry, 0); audio.engine(0, false);
      await fade(true, 800); G.fogBase = fogWas; P.hidden = false; P.frozen = false; P.camOverride = false; P.teleport(TERM.x, TERM.z + 6.2, 0);
      if (comp){ comp.override = null; comp.following = true; const x = TERM.x + 1.2, z = TERM.z + 6.4; comp.pos.set(x, heightAt(x, z), z); }
      await fade(false, 800); }
    st.hour += 0.6; if (comp) friend(cid, 3);
    log(comp ? `${N[cid]}と遊覧飛行に乗った。操縦かんを少しだけ握らせてもらった。空から見た島は、地図とおなじ形をしていた。` : 'おこづかいを貯めて、遊覧飛行に乗った。操縦かんを少しだけ握らせてもらった。空から見た島は、地図とおなじ形をしていた。'); }

  // 源さんの軽トラの荷台に乗って、東の浜か北の若浦まで
  async function truckRide(){ const st = S(), oj = G.npcs.ojisan, car = W.cars.find(cr => Math.hypot(cr.home.x + 217, cr.home.z - 66) < 1);
    if (!car || Math.hypot(car.mesh.position.x - car.home.x, car.mesh.position.z - car.home.z) > 4){ await say(N.ojisan, 'あれ、おれの軽トラ、だれか乗ってったな？　……まあいい、島の中ならそのうち見つかる'); return; }
    const di = await choose(N.ojisan, 'どこまで行く？', [...T.RIDE_DEST.map(d => d[0]), 'やっぱりやめる']); if (di >= T.RIDE_DEST.length) return; const dest = T.RIDE_DEST[di][1];
    const c = companion(), cid = G.companion; st.today.ride = true;
    await fade(true, 700); P.dismountBike(true); G.cars.place(car, car.home.x, car.home.z, car.home.ry); G.cars.syncCol(car);
    oj.override = { k:'drive', x:car.home.x, z:car.home.z, ry:0, pose:'idle', hide:true }; oj.spot = null;
    P.carry = { car, seat:1 }; P.sitting = true; if (c) G.cars.hop(c, car, 0); G.cars.seatOf(car, 1); P.carryUpdate(); P.camDist = 7.5; P.camPitch = 0.28; P.camYaw = car.mesh.rotation.y + Math.PI; P.snap = true;
    await fade(false, 700); const again = !!st.flags.rodeTruck; st.flags.rodeTruck = true; await talk(T.RIDE_START);
    if (again){ G.skippable = true; toast('［Esc］で目的地までとばせる', 3500); }
    const R = name => G.roadIndex[name], route = [[car.mesh.position.x, car.mesh.position.z], ...G.route([R('main'), true], [R('school'), false], [R(dest === 'beach' ? 'beach' : 'wakago'), false])];
    const arrived = G.autoDrive(car, route, 11); let done = false; arrived.then(() => done = true);
    const go = () => !done && !G.skipReq;
    await wait(3500); if (go()) await say('', T.RIDE_ALONE[st.day % T.RIDE_ALONE.length]);
    await wait(3000); if (go() && c && T.RIDE_FRIEND[cid]) await talk(T.RIDE_FRIEND[cid]);
    await wait(2500); if (go()){ G.snap(true); await talk(T.RIDE_COAST); }
    await arrived; G.skippable = false; G.skipReq = false; await talk(T.RIDE_ARRIVE[dest]);
    await fade(true, 600); P.carry = null; P.sitting = false; const m = car.mesh.position, yaw = car.mesh.rotation.y, sx = m.x - Math.cos(yaw)*2.2, sz = m.z + Math.sin(yaw)*2.2;
    P.teleport(sx, sz, yaw + Math.PI); if (c){ G.cars.hopOff(c, car, -1); c.following = true; }
    oj.override = { k:'arrive', x:m.x + Math.cos(yaw)*2.0, z:m.z - Math.sin(yaw)*2.0, ry:yaw, pose:'idle' }; oj.spot = null; P.camDist = 6.2;
    st.hour += dest === 'beach' ? 0.4 : 0.7; if (c) friend(cid, 2); await fade(false, 600);
    log(c ? `源さんの軽トラの荷台に、${N[cid]}と乗せてもらった。${dest === 'beach' ? '東の浜' : '北の若浦'}まで、風がすごかった。` : `源さんの軽トラの荷台に乗せてもらって、${dest === 'beach' ? '東の浜' : '北の若浦'}まで行った。`); }

  async function dinner(){ const st = S(), lg = st.today.log.join(''); P.sitting = false; await fade(true, 600); st.hour = Math.max(st.hour, 18.5); await fade(false, 600);
    await talk(T.DINNER[st.day % T.DINNER.length]);
    if (st.today.flight) await talk(T.DINNER_CTX.flight); else if (st.today.prep && st.prep >= 5) await talk(T.DINNER_CTX.prepDone); else if (/釣/.test(lg)) await talk(T.DINNER_CTX.fish); else if (st.today.bon) await talk(T.DINNER_CTX.bon); else if (st.today.islet) await talk(T.DINNER_CTX.islet); else if (st.today.crab) await talk(T.DINNER_CTX.crab); else if (st.today.star) await talk(T.DINNER_CTX.star); else if (st.today.ride) await talk(T.DINNER_CTX.ride);
    log(T.DINNER_LOG); }
  let candle = null;
  async function blackout(){ const st = S(); G.blackout = true; audio.burst(0.08, 2000, 0.2);
    candle = new THREE.Group(); const l = new THREE.PointLight(0xffa040, 2.4, 8, 1.4); l.position.set(0, 0.25, 0); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 6), new THREE.MeshBasicMaterial({ color:0xffd27a }));
    fl.position.y = 0.17; const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), new THREE.MeshLambertMaterial({ color:0xf4efe2 })); wax.position.y = 0.06; candle.add(l, fl, wax);
    candle.position.set(HOME.x - 2.0, HOME_IN.y + 0.36, HOME.z - 0.45); G.scene.add(candle); fx.push(() => { if (!candle) return false; l.intensity = 2.1 + Math.sin(G.time*13)*0.25 + Math.sin(G.time*7.3)*0.2; fl.scale.y = 1 + Math.sin(G.time*17)*0.15; });
    await talk(T.BLACKOUT); log(T.BLACKOUT_LOG); }
  // 台風一過の朝、東の浜に流れ着いたもの
  { const drift = [[98, 12], [100, 38], [95, 56]].map(([x, z], i) => { let xx = x; for (; xx > 70 && heightAt(xx, z) < 0.35; xx -= 1); const mats = [[new THREE.SphereGeometry(0.16, 8, 6), 0x5fae8a], [new THREE.CylinderGeometry(0.05, 0.07, 0.3, 6), 0x9fc4a8], [new THREE.BoxGeometry(1.2, 0.12, 0.16), 0xe8e2d4]][i];
      const m = new THREE.Mesh(mats[0], new THREE.MeshLambertMaterial({ color:mats[1], transparent:i < 2, opacity:i < 2 ? 0.85 : 1 })); m.position.set(xx, heightAt(xx, z) + 0.1, z); if (i === 1) m.rotation.z = Math.PI/2.4; if (i === 2) m.rotation.y = 0.7; m.visible = false; G.outdoor.add(m); return { x:xx, z, m, i }; });
    fx.push(() => { const st = S(); for (const d of drift) d.m.visible = st.day === TYPHOON_DAY + 1 && !st.flags['drift' + d.i]; });
    for (const d of drift) I.push({ x:d.x, z:d.z, r:1.6, when: () => S().day === TYPHOON_DAY + 1 && !S().flags['drift' + d.i] && !G.indoor, label:'流れ着いたものを見る', act: async () => { const st = S(); st.flags['drift' + d.i] = true; audio.pickup(); await say('', T.DRIFT[d.i][1]); log(`台風のあとの浜で、${T.DRIFT[d.i][0]}を見つけた。`); } }); }
  setupPlaces();
  // 夏の流れ星：晴れた夜、ときどき夜空を横切る
  { let meteor = null, nextStar = 16;
    fx.push(dt => { const st = S();
      if (meteor){ meteor.t += dt; const u = meteor.t/0.65, a = Math.sin(Math.min(1, u)*Math.PI);
        const pos = meteor.g.attributes.position.array;
        for (let i = 0; i < 3; i++){ const p0 = meteor.s[i] + meteor.v[i]*u, p1 = meteor.s[i] + meteor.v[i]*Math.max(0, u - 0.18); pos[i] = p0; pos[i+3] = p1; }
        meteor.g.attributes.position.needsUpdate = true; meteor.m.opacity = a*0.95;
        if (meteor.t >= 0.65){ G.scene.remove(meteor.line); meteor.g.dispose(); meteor.m.dispose(); meteor = null; } return; }
      if (G.mode !== 'play' || st.hour < 19.4 || G.weatherNow.cloud >= 0.3 || G.indoor || G.inSchool) return;
      if ((nextStar -= dt) > 0) return; nextStar = 15 + Math.random()*15;
      const th = Math.random()*Math.PI*2, r = 180, sx = P.pos.x + Math.cos(th)*r, sy = 150 + Math.random()*50, sz = P.pos.z + Math.sin(th)*r;
      const vx = -Math.sin(th)*85 + (Math.random() - 0.5)*30, vy = -45 - Math.random()*20, vz = Math.cos(th)*85 + (Math.random() - 0.5)*30;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const m = new THREE.LineBasicMaterial({ color:0xf6f9ff, transparent:true, opacity:0, fog:false, depthWrite:false });
      const line = new THREE.Line(g, m); line.frustumCulled = false; G.scene.add(line);
      meteor = { line, g, m, t:0, s:[sx, sy, sz], v:[vx, vy, vz] };
      G.observe && G.observe('star', P.pos.x, P.pos.z);
      if (!P.driving && !P.riding && !st.today.meteorLog){ st.today.meteorLog = true; toast('あ、流れ星……'); log('夜空を横切る流れ星を見た。'); } }); }
  // ---- 1日のはじまり・おわり ----
  const hud = () => { const st = S(); G.applyPrep(); W.shells.forEach(s => s.mesh.visible = !st.shells.includes(s.id)); };
  const startDay = async (first) => { const st = S(); st.hour = 7; st.today = { log:[], talked:{}, gave:{} }; G.companion = null; for (const k in G.npcs){ G.npcs[k].following = false; G.npcs[k].spot = null; G.npcs[k].override = null; }
    P.dismountBike(true);
    for (const b of W.bikes){ const { mesh, home } = b; b.fly = null; mesh.position.set(home.x, home.y, home.z); mesh.rotation.set(0, home.ry, 0); mesh.visible = true; }
    if (G.resetCars) G.resetCars(); if (G.resetPlane) G.resetPlane(); if (G.schoolReset) G.schoolReset();
    setIndoor('home'); P.sitting = false; P.teleport(HOME.x + 2.2, HOME.z + 0.6, Math.PI); P.camYaw = 0.6; P.camPitch = 0.2; hud(); save(); G.mode = 'play'; await fade(false, 1200);
    toast(st.day === 11 ? '夏休み　最後の日' : `夏休み　あと${T.REMAIN[st.day]}日`, 3500);
    G.blackout = false; if (candle){ G.scene.remove(candle); candle = null; }
    await talk(st.day === 0 && first ? T.INTRO : st.day === 11 ? T.FINAL_MORNING : st.day === TYPHOON_DAY ? [['', T.TYPHOON_MORNING]] : st.day === TYPHOON_DAY + 1 ? [['', T.AFTER_STORM]] : [['', T.MORNING[st.day % T.MORNING.length]]]);
  };
  const endDay = async () => { const st = S(); P.dismountBike(true); await fade(true, 1200); const page = composeDiary(st, dayWeather(st.day, G.weatherOverride)); st.diary.push(page); G.bgm = 1; await showDiary(page, st.day === 11 ? 'Eで　つづける' : undefined); G.bgm = 0;
    if (st.day >= 11){ await epilogue(); return; } st.day++; await startDay(); };
  G.startDay = () => run(() => startDay(true)); G.endDay = () => run(endDay);

  // ---- 最終日の花火とエピローグ ----
  const finale = async () => { const st = S(); if (!P.dismountBike()) P.dismountBike(true); st.flags.finale = true; for (const k of ['nagisa', 'kouta', 'kotoha']){ G.npcs[k].following = false; G.npcs[k].spot = null; } G.companion = null;
    if (st.flags.metOneesan){ G.npcs.oneesan.override = { k:'fin', x:69.5, z:28.5, ry:Math.PI/2, pose:'lookup' }; G.npcs.oneesan.spot = null; }
    await talk(T.FINAL_CALL); await fade(true); st.hour = 19.85; P.teleport(76.5, 34.5, Math.PI/2); P.camYaw = -Math.PI/2 - 0.25; P.camPitch = -0.05; P.camDist = 8.5; G.timeStop = true; for (const k of ['nagisa', 'kouta', 'kotoha']) G.npcs[k].pose = 'lookup'; P.pose = 'lookup';
    await fade(false, 1500); await wait(600); G.fireworks.on = true; await talk(T.FINAL_FIRE.common); await wait(2500); G.snap(true);
    for (const k of ['kouta', 'kotoha', 'nagisa']){ await talk(T.FINAL_FIRE[k][st.friends[k] >= 7 ? 1 : 0]); await wait(1800); }
    if (st.flags.metOneesan){ await talk(T.FINAL_FIRE.oneesan[st.friends.oneesan >= 4 ? 1 : 0]); await wait(1400); }
    G.fireworks.on = false; await wait(3500); await talk(T.FINAL_FIRE.end); log('みんなで浜に集まって、花火を見た。'); P.pose = null; for (const k of ['nagisa', 'kouta', 'kotoha']) G.npcs[k].pose = null; G.npcs.oneesan.override = null; G.timeStop = false; await endDay(); };
  const epilogue = async () => { const st = S(); st.hour = 11.5; setIndoor(false); G.timeStop = true; G.mode = 'epilogue'; const full = st.prep >= 5; if (full) st.prep = 5; G.applyPrep();
    G.npcs.nagisa.override = { k:'ep', x:38.6, z:-60.6, ry:0.9, pose:'wave', room:true }; G.npcs.kouta.override = { k:'ep', x:40.4, z:-61.4, ry:0.2, pose:'wave', room:true }; G.npcs.kotoha.override = { k:'ep', x:37.6, z:-62.2, ry:1.2, pose:'idle', room:true };
    G.npcs.sister.override = { k:'ep', x:36.8, z:-60.0, ry:0.5, pose:'wave', room:true }; G.npcs.granny.override = { k:'ep', x:36.6, z:-62.4, ry:1.1, pose:'idle', room:true };
    for (const k of ['nagisa', 'kouta', 'kotoha', 'sister', 'granny']) G.npcs[k].spot = null; P.teleport(41.8, -59.4, -2.2); P.camYaw = 0.75; P.camPitch = 0.16; G.bgm = 2;
    await fade(false, 1800); for (const l of (full ? T.EPILOGUE_DONE : T.EPILOGUE_PART)){ await say('', l); }
    if (st.friends.kotoha >= 7) await talk(T.EPILOGUE_KOTOHA);
    await fade(true, 2000);
    await say('', `しまなつ　― おしまい ―\n文化祭の準備 ${st.prep} / 5　　貝がら ${st.shells.length} / ${W.shells.length}\n釣った魚 ${st.fish}匹　　セミ ${st.bugs.length} / 4　　カニ ${(st.crabs || []).length} / 4　　ラジオ体操 ${st.taiso} / 12`);
    if (st.diary.length && await choose('', 'これまでの絵日記を読み返しますか？', ['絵日記を読み返す', 'タイトルへもどる']) === 0) await browseDiary(st.diary, 0);
    localStorage.removeItem(SAVE); location.reload(); };

  G.api = { refresh:() => hud(), leaveRoom:() => setIndoor(false), enterRoom, exitRoom, enter, exit, talkTo, truckRide, bonDance, senko, flight, doPrep, endDay, startDay, finale, epilogue, fade, rideBike, leaveBike, toast, log, friend };

  // ---- 毎フレームの見はり ----
  let areaNow = null, lastChime = -1;
  G.watch = () => { const st = S(); if (G.mode !== 'play' || G.lock) return;
    if (P.riding && P.bikeSpeed>2 && !st.today.bike){ st.today.bike = true; log(T.BIKE.diary); }
    // 場所の名前
    let a = null; if (G.inSchool) a = G.schoolPlace; else if (!G.indoor) for (const [x, z, r, name] of G.areas) if (Math.hypot(P.pos.x - x, P.pos.z - z) < r){ a = name; break; }
    if (a !== areaNow){ areaNow = a; const el = document.getElementById('place'); if (a){ el.textContent = '― ' + a + ' ―'; el.style.opacity = 1; clearTimeout(el.t); el.t = setTimeout(() => el.style.opacity = 0, 3200); } }
    // 盆踊りの夜は、広場から太鼓が聞こえる
    bonSound(st);
    // 台風：外で強い風に初めて当たったとき。夜は家で停電
    if (st.day === TYPHOON_DAY){ if (!G.indoor && G.weatherNow.wind > 0.6 && !st.today.gale){ st.today.gale = true; toast(T.STORM_GALE, 3500); log('台風の日に外へ出た。雨が横から降ってきた。'); }
      if (st.hour >= 18 && G.indoor === 'home' && !st.today.blackout){ st.today.blackout = true; run(blackout); return; } }
    // 夕方、家に帰ると家族で夕ごはん
    if (st.hour >= 17.8 && st.hour < 20.5 && G.indoor === 'home' && !st.today.dinner && st.day !== 11 && !(st.day === TYPHOON_DAY && !st.today.blackout)){ st.today.dinner = true; run(dinner); return; }
    // チャイム
    for (const h of [12, 17]) if (st.hour >= h && st.hour < h + 0.05 && lastChime !== st.day*100 + h){ lastChime = st.day*100 + h; audio.chime(); if (h === 17) toast('五時のチャイムが島じゅうに響いている'); }
    // 行き先の会話は一度だけ。夕日は訪れ直した場所でも、その日に一度見られる。
    if (G.companion && !G.indoor) for (const k in SPOTS){ const id = G.companion, s = SPOTS[k], key = k + ':' + id; if (Math.hypot(P.pos.x - s.x, P.pos.z - s.z) > s.r) continue;
      const firstWalk = !st.walked[key], sunset = st.hour > 17.2 && st.hour < 19.3 && ['beach', 'pier', 'onsen', 'lookout', 'ishiyama'].includes(k) && !st.today.sunset;
      if (!firstWalk && !sunset) continue;
      run(async () => { if (!P.dismountBike()) P.dismountBike(true); P.camPitch = 0.1;
        if (firstWalk){ st.walked[key] = true; G.snap(); await talk(T.WALK[k][id]); friend(id, 2); log(`${N[id]}と${s.name}まで歩いた。`); }
        if (sunset){ st.today.sunset = true; const stopped = G.timeStop; G.timeStop = true;
          try { await talk(T.SUNSET); G.snap(true); friend(id, 1); log(`${N[id]}と夕日を見た。`); }
          finally { G.timeStop = stopped; }
        }
      }); return; }
    // 最終日
    if (st.day === 11 && !st.flags.finale){ if (st.hour >= 17 && !st.flags.finalHint){ st.flags.finalHint = true; toast('そろそろ東の浜へ行こう。みんなが待っている', 5000); }
      if (st.hour >= 17 && Math.hypot(P.pos.x - SPOTS.beach.x, P.pos.z - SPOTS.beach.z) < 18 && !G.indoor){ run(finale); return; }
      if (st.hour >= 20.2){ run(async () => { await say('', 'いけない、もうこんな時間だ。浜へ急いだ。'); await fade(true); P.dismountBike(true); setIndoor(false); P.teleport(SPOTS.beach.x - 6, SPOTS.beach.z, Math.PI/2); await fade(false); await finale(); }); return; } }
    else if (st.hour >= 21){ run(async () => { await talk(T.NIGHT_FORCE); await endDay(); }); }
  };
}

// 花火
export class Fireworks {
  constructor(scene){ this.scene = scene; this.on = false; this.list = []; this.next = 0; this.flash = 0; }
  burst(){ const n = 110, g = new THREE.BufferGeometry(), p = new Float32Array(n*3), v = []; const c = new THREE.Vector3(150 + Math.random()*50, 26 + Math.random()*26, 34 + (Math.random()-0.5)*90);
    for (let i=0;i<n;i++){ p.set([c.x, c.y, c.z], i*3); const a = Math.random()*Math.PI*2, b = Math.acos(Math.random()*2-1), s = (i % 3 ? 20 : 11) + Math.random()*3; v.push([Math.sin(b)*Math.cos(a)*s, Math.cos(b)*s, Math.sin(b)*Math.sin(a)*s]); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const col = new THREE.Color().setHSL(Math.random(), 0.85, 0.65);
    const m = new THREE.Points(g, new THREE.PointsMaterial({ color:col, size:4, sizeAttenuation:false, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, fog:false })); m.frustumCulled = false; this.scene.add(m); this.list.push({ m, v, t:0 }); this.flash = 1; this.col = col; }
  update(dt, time){ if (this.on && time > this.next){ audio.firework(); setTimeout(() => this.on !== null && this.burst(), 950); this.next = time + 1.1 + Math.random()*1.6; }
    this.flash = Math.max(0, this.flash - dt*1.4);
    for (let i=this.list.length-1;i>=0;i--){ const b = this.list[i]; b.t += dt; const p = b.m.geometry.attributes.position; const k = Math.exp(-b.t*1.3);
      for (let j=0;j<b.v.length;j++){ p.array[j*3] += b.v[j][0]*dt*k; p.array[j*3+1] += (b.v[j][1]*k - 4*b.t)*dt; p.array[j*3+2] += b.v[j][2]*dt*k; } p.needsUpdate = true; b.m.material.opacity = Math.max(0, 1 - b.t/2.4);
      if (b.t > 2.4){ this.scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); this.list.splice(i, 1); } } }
}
