// NPCの「その場の状況を見て、しゃべる・動く」をローカルLLMで作る（試験。設定で ON のときだけ）。
// 生成は会話を待たせないように先回りする：近くの人ごとに、いまの状況でのひとことを1つ作っておき、話しかけられたら使う。
// 使えないとき（モデル未読みこみ・おかしな返事・状況が変わった）は、いつもの決まったセリフ（data/talk.js）にもどる。
import { llmAsk, LLM } from './llm.js';
import { PERSONA, TALK2, KNOCK2, OBSERVE } from '../data/talk.js';
import { NAMES, DATES } from '../data/story.js';
import { AREAS } from './world/places.js';
import { SETTINGS } from './keys.js';
import * as THREE from 'three';

export function setupNpcAI(G){
  const P = G.player, ready = {}, asking = {};
  const on = () => SETTINGS.llm && LLM.status === 'ready';
  const area = (x, z) => { let best = null, bd = 1e9; for (const [ax, az, r, name] of AREAS){ const d = Math.hypot(x - ax, z - az); if (d < r && d < bd){ bd = d; best = name; } } return best; };
  const band = h => h < 5 ? '真夜中' : h < 9 ? '朝' : h < 11.5 ? '午前' : h < 14 ? '昼' : h < 16.5 ? '午後' : h < 19 ? '夕方' : '夜';
  const sky = () => { const w = G.weatherNow || {}; return w.storm > 0.3 ? '雷雨' : w.rain > 0.5 ? '大雨' : w.rain > 0.12 ? '小雨' : w.wind > 0.5 ? '風が強い' : w.cloud > 0.5 ? 'くもり' : '晴れ'; };
  // いまの状況を、短い日本語の箇条にする（これが変わったら作り直す）
  const situation = (id, extra) => { const st = G.state, n = G.npcs[id], f = st.friends[id] ?? 0, L = [];
    L.push(`${DATES[st.day] || '夏休み'}、${band(st.hour)}（${Math.floor(st.hour)}時ごろ）。天気は${sky()}。`);
    const where = G.indoor === 'home' ? '主人公の家の中' : G.indoor === 'shop' ? 'しおかぜ商店の中' : G.indoor === 'term' ? '空港の待合室' : G.inSchool ? '学校の校舎の中' : area(n.pos.x, n.pos.z);
    if (where) L.push(`場所は${where}。`);
    if (n.doing) L.push(`${NAMES[id]}は${n.doing}。`);
    const me = []; if (P.driving) me.push('軽トラを運転している'); else if (P.riding) me.push(P.riding.kind === 'moped' ? '原付に乗っている' : '自転車に乗っている');
    if (P.swimming) me.push('泳いでいる'); if (st.items && st.items.hat && st.items.wearHat) me.push('麦わら帽子をかぶっている');
    if (G.weatherNow && G.weatherNow.rain > 0.12 && !(st.items && st.items.umbrella && !st.items.umbrellaOff) && !G.indoor) me.push('傘をささずにぬれている');
    if (G.companion === id) me.push(`${NAMES[id]}といっしょに歩いている`);
    if (me.length) L.push('主人公は' + me.join('、') + '。');
    { const others = Object.keys(G.npcs).filter(k => k !== id && G.npcs[k].root.visible && Math.hypot(G.npcs[k].pos.x - n.pos.x, G.npcs[k].pos.z - n.pos.z) < 10).map(k => NAMES[k]); if (others.length) L.push(`近くに${others.join('、')}がいる。`); }
    if (st.today['knock_' + id]) L.push(`今日、主人公は乗り物で${NAMES[id]}をはね飛ばした（無傷）。`);
    if (['nagisa', 'kouta', 'kotoha'].includes(id)) L.push(`文化祭の準備は5つのうち${st.prep}つ終わった。` + (f >= 7 ? '主人公とはとても仲がいい。' : f >= 3 ? '主人公と仲よくなってきた。' : ''));
    if (extra) L.push(extra);
    return L.join('\n'); };
  const examples = id => { const D = TALK2[id] || {}, all = [...(D.t0 || []), ...(D.t1 || [])]; const out = []; for (let i = 0; i < 4 && all.length; i++) out.push(all.splice(Math.floor(Math.random()*all.length), 1)[0]); return out; };
  const prompt = (id, sit, ask) => `あなたは日本の小さな島を舞台にした、夏休みのゲームの台本作家です。\n人物：${PERSONA[id]}\nこの人物のセリフの例：\n${examples(id).map(e => '・' + e).join('\n')}\nいまの状況：\n${sit}\n${ask}\nセリフだけを書いてください。名前・かぎかっこ・説明は書かず、40文字以内で1つだけ。`;
  // 返事の後始末と検査。おかしなものは捨てる（null）
  // 人ごとに使わない呼び方（一人称・二人称のまちがいを捨てる）
  const WRONG = { nagisa:/お前|おまえ|おれ|オレ|僕|ぼく/, kouta:/あたし|わたし|僕|ぼく|あんた/, kotoha:/お前|おまえ|おれ|あたし|あんた/, oneesan:/お前|おまえ|おれ/, granny:/お前|おれ/, ojisan:/あたし|わたし/,
    mother:/お前|おまえ|おれ|僕/, father:/あたし|わたし|僕/, sister:/お前|おまえ|おれ|あんた|わたし|あたし/ };
  const recent = {}; const fresh = (id, t) => { const r = recent[id] = recent[id] || []; if (r.some(x => x === t || x.slice(0, 8) === t.slice(0, 8))) return false; r.push(t); if (r.length > 8) r.shift(); return true; };
  const clean = (t, id) => { if (!t) return null; t = t.replace(/<think>[\s\S]*?<\/think>/g, '').trim().split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
    t = t.replace(/^[・\-\*]\s*/, '').replace(new RegExp('^(' + NAMES[id] + '|' + id + ')\\s*[:：]\\s*'), '').replace(/^[「『"“]+|[」』"”]+$/g, '').trim();
    if (t.length < 3 || t.length > 48) return null; if (/[A-Za-z]{3,}|[<>{}#*]|人物|状況|セリフ|主人公|台本|文字|ゲーム/.test(t)) return null;
    if (!/[ぁ-んァ-ン]/.test(t)) return null;   // かなの無い文（中国語など）は使わない
    if (/[们这个说吗对没东过还时]/.test(t)) return null; if (WRONG[id] && WRONG[id].test(t)) return null; if (/\s〜|。.*。.*。/.test(t)) return null; if (Object.values(TALK2[id] || {}).some(a => a.includes(t))) return null; if (!fresh(id, t)) return null;
    return t; };
  // 先回りして、ひとことを1つ作っておく
  const wait = {};   // うまくいかなかった人は、しばらく聞かない（GPUを使いつづけない）
  const prefetch = id => { const sit = situation(id); if ((ready[id] && ready[id].sit === sit) || asking[id] || (wait[id] || 0) > G.time) return; asking[id] = true;
    llmAsk(prompt(id, sit, 'この状況で、この人物が主人公に話しかけられて言うひとこと。'), { temperature:0.7 }).then(t => { asking[id] = false; const l = clean(t, id); if (l) ready[id] = { sit, text:l }; else wait[id] = G.time + 8; }); };
  // 話しかけたとき：状況が同じなら作っておいたものを使う（1回で使い切る）
  const take = id => { if (!on()) return null; const r = ready[id]; if (!r || r.sit !== situation(id)) return null; delete ready[id]; G.aiLines = (G.aiLines || 0) + 1; return r.text; };
  // 吹っ飛ばされた直後のひとこと。間に合わなければ null（決まったセリフを使う）
  const react = (id, what, ms=1600) => { if (!on() || !PERSONA[id]) return Promise.resolve(null);
    const ex = (KNOCK2[id] || []).slice(0, 3).map(e => '・' + e).join('\n');
    const p = llmAsk(`あなたは夏休みのゲームの台本作家です。\n人物：${PERSONA[id]}\n${what}（まったくの無傷で、起き上がったところ）。\nこういうときのセリフの例：\n${ex}\nいまの状況：\n${situation(id)}\nこの人物が主人公に言う、短いひとことを1つ。セリフだけを書き、40文字以内。`, { priority:true, maxTokens:40, temperature:0.7 }).then(t => clean(t, id));
    return Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]); };
  // ---- ひとりごとと、ひまなときの行動 ----
  const MUTTER = { nagisa:'よし、あとで看板の続きやろ', kouta:'今日の波、悪くねえな', kotoha:'……あの雲、描きたい', oneesan:'変わらないのね、この島は', granny:'今日も暑いねえ', ojisan:'風が変わってきたな', mother:'洗濯物、よく乾きそう', father:'いい天気だなあ', sister:'カニさん、どこかなー' };
  const ACTS = ['その場でのんびりする', '近くを歩きまわる', '主人公のそばへ行く', '遠くの景色をながめる'];
  const decide = id => { const n = G.npcs[id]; asking['act' + id] = true;
    const q = `この人物は、いまひまにしている。次にすることを、下から番号で1つ選び、そのとき小さくつぶやくひとりごとも書いてください。\n${ACTS.map((a, i) => `${i + 1}. ${a}`).join('\n')}\nひとりごとは、だれにも話しかけず、自分に向かって小さく言う短い言葉にする。\n答えの形：番号|ひとりごと（例：4|${MUTTER[id] || 'いい風だなあ'}）`;
    llmAsk(`次の人物になりきって答えてください。\n人物：${PERSONA[id]}\nいまの状況：\n${situation(id)}\n${q}\n出力は「番号|ひとりごと」の1行だけ。見出し・説明・記号の飾りは書かない。`, { maxTokens:44, temperature:0.7 }).then(t => { asking['act' + id] = false; G.npcai.lastAct = t; if (!t || !on()) return;
      const m = t.replace(/[*#`]/g, '').match(/([1-4])\s*[|｜:：.．、]\s*(.+)/); const k = m ? +m[1] : (t.match(/[1-4]/) || [0])[0]*1; const line = clean(m ? m[2] : t.replace(/^[1-4]\s*/, ''), id);
      if (k && n.aiAct) n.aiAct(k, G); if (line && n.root.visible && !G.speaking(id)) G.speak(id, line); G.aiActs = (G.aiActs || 0) + 1; }); };
  // ---- 見たこと ----
  // G.observe(種類, x, z, くわしく)：その場所が見える近くの人（30m以内・同じ屋内）が、見たこととして覚える
  const DESC = { knock:o => `主人公が${o.how}で${o.who}をはね飛ばした（${o.who}は無傷で、空をくるくる飛んだ）`, bikefly:() => '主人公が、とめてあった自転車にぶつかって、自転車が空を飛んだ',
    smash:o => `主人公が${o.who}にぶつかって、${o.who}が吹っ飛んだ`, goal:o => `主人公が${o.who}を吹っ飛ばして、サッカーのゴールに入れた`, flip:o => `主人公が${o.h}mの高さから飛び降りて、空中で宙返りした`,
    jump:() => '主人公が乗り物ごと坂から飛び出して、大ジャンプした', dive:o => `主人公が${o.h}mの高さから海に飛びこんだ`, swim:() => '主人公が海に入って泳ぎはじめた', rain:() => '雨が降りだした', stop:() => '雨がやんだ',
    plane:() => '空港から定期便の飛行機が飛び立った', cat:() => '主人公が道ばたのねこをなでた', shell:() => '主人公が浜で貝がらを拾った',
    star:() => '夜空を流れ星が流れた', crab:() => '主人公が磯でカニをつかまえた' };
  const mem = {};
  const sees = (id, x, z) => { const n = G.npcs[id]; if (!n || !n.root.visible || !PERSONA[id] || n.knock || n.ride) return false; const s = n.spot || {};
    if (G.indoor ? (s.room !== G.indoor && !(s.room === true && G.indoor === 'class')) : (s.room && !n.following)) return false; return x === null || Math.hypot(n.pos.x - x, n.pos.z - z) < 30; };
  G.observe = (kind, x, z, o = {}) => { for (const id in G.npcs){ if (id === o.except || !sees(id, x, z)) continue; const m = mem[id] = mem[id] || [];
      if (m.some(e => e.kind === kind && G.time - e.t < 4)) continue; m.push({ kind, o, t:G.time, done:false }); if (m.length > 5) m.shift(); } };
  const fill = (t, o) => t.replace(/\{who\}/g, o.who || '');
  // 見たことへのひとことを言う（AIが動いていればAI、だめなら控えの文）
  const comment = (id, e) => { e.done = true; const fb = () => { const a = OBSERVE[e.kind]; if (a && !G.speaking(id)) G.speak(id, fill(a[Math.floor(Math.random()*a.length)], e.o)); };
    if (!on()){ fb(); return; } asking['obs' + id] = true;
    llmAsk(`次の人物になりきって答えてください。\n人物：${PERSONA[id]}\nいまの状況：\n${situation(id)}\nいま、目の前で見たこと：${DESC[e.kind](e.o)}。\nそれを見て、この人物が思わず口にするひとこと（ひとりごとか、主人公への声かけ）を1つ。セリフだけを書き、40文字以内。見出しや説明は書かない。`, { priority:true, maxTokens:44, temperature:0.75 })
      .then(t => { asking['obs' + id] = false; const l = clean(t, id); if (l && !G.speaking(id) && G.npcs[id].root.visible) G.speak(id, l); else if (!l) fb(); }); };
  // まわりのようすの変化も、見たこととして拾う（雨・飛行機・泳ぎ）
  let wasRain = false, wasDep = null, wasSwim = false;
  const watch = () => { const r = (G.weatherNow && G.weatherNow.rain) || 0; if (!wasRain && r > 0.15){ wasRain = true; G.observe('rain', null, null); } else if (wasRain && r < 0.05){ wasRain = false; G.observe('stop', null, null); }
    if (G.departing && !wasDep) G.observe('plane', null, null); wasDep = G.departing;
    if (P.swimming && !wasSwim) G.observe('swim', P.pos.x, P.pos.z); wasSwim = P.swimming; };
  let tPre = 0, tAct = 8, tObs = 3;
  G.npcai = { take, react, situation, ready, update(dt){
    if (G.mode !== 'play') return;
    watch(); tObs -= dt;
    // 定期的に：近くの人が、見たこと（なければ、いま目に入っていること）を口にする
    if (tObs <= 0 && !G.lock){ tObs = 4 + Math.random()*4;
      const cand = Object.keys(G.npcs).filter(id => PERSONA[id] && G.npcs[id].root.visible && !G.npcs[id].knock && !(G.npcs[id].recover > 0) && !G.speaking(id) && !asking['obs' + id] && Math.hypot(G.npcs[id].pos.x - P.pos.x, G.npcs[id].pos.z - P.pos.z) < 22);
      const fresh = cand.map(id => [id, (mem[id] || []).filter(e => !e.done && G.time - e.t < 45).pop()]).filter(x => x[1]);
      if (fresh.length){ const [id, e] = fresh[Math.floor(Math.random()*fresh.length)]; comment(id, e); }
      else if (cand.length && Math.random() < 0.6 && G.time - (G.lastSpeak || 0) > 7){ const id = cand[Math.floor(Math.random()*cand.length)];
        if (on()){ asking['obs' + id] = true; llmAsk(prompt(id, situation(id), 'いま目に入っていること（主人公のようす・天気・まわりの人や景色）について、この人物が口にするひとこと。ひとりごとでも、主人公への声かけでもよい。'), { maxTokens:44, temperature:0.75 }).then(t => { asking['obs' + id] = false; const l = clean(t, id); if (l && !G.speaking(id)) G.speak(id, l); }); }
        else { const l = G.lineFor && G.lineFor(id); if (l) G.speak(id, l); } } }
    if (!on()) return;
    tPre -= dt; tAct -= dt;
    const near = Object.keys(G.npcs).filter(id => PERSONA[id] && G.npcs[id].root.visible && !G.npcs[id].knock).map(id => [id, Math.hypot(G.npcs[id].pos.x - P.pos.x, G.npcs[id].pos.z - P.pos.z)]).sort((a, b) => a[1] - b[1]);
    if (tPre <= 0){ tPre = 1.2; for (const [id, d] of near.slice(0, 2)) if (d < 16) prefetch(id); }
    if (tAct <= 0 && !G.lock){ tAct = 9 + Math.random()*8; const c = near.filter(([id, d]) => d < 22 && d > 2.5 && G.npcs[id].isFree && G.npcs[id].isFree(G) && !asking['act' + id]); if (c.length) decide(c[Math.floor(Math.random()*c.length)][0]); }
  } };
}
