// 持ち物：傘（雨の日にさす）、虫取り網、浮き輪、麦わら帽子。友達の傘と、相合傘。
import * as THREE from 'three';
import { model } from './models.js';
import { audio } from './audio.js';
import { NAMES } from '../data/story.js';
import * as T from '../data/story.js';
const UCOL = { nagisa:0xf2c94c, kotoha:0xb9a7e0, oneesan:0x2f4a78, granny:0x6f8f6a, mother:0xd98a8a, father:0x3a3a40, sister:0xf2a0b8, ojisan:0x445566 };   // 航太は傘をささない
export function setupItems(G){
  const P = G.player, S = () => G.state;
  const items = () => S().items || (S().items = {});
  // 主人公の傘・帽子・浮き輪・網
  const mk = (name, parent, x, y, z) => { const m = model(name); m.position.set(x, y, z); m.visible = false; parent.add(m); return m; };
  const pU = mk('umbrella', P.root, 0.16, 1.18, 0.16), ring = mk('ukiwa', P.root, 0, 0.92, 0), net = mk('bugnet', P.root, 0.2, 0.9, 0.25);
  const hat = model('strawhat'); hat.visible = false; (P.ch.n.head || P.root).add(hat); hat.position.set(0, 0.215, 0.005);
  G.showNet = on => { net.visible = on; P.ch.holdUp = on; };
  // 友達の傘（色ちがい）
  const nU = {}; for (const id in UCOL){ const n = G.npcs[id]; if (!n) continue; const m = mk('umbrella', n.root, 0.16, 1.18, 0.16); m.traverse(o => { if (o.isMesh && o.material.name === 'umbrella-cloth-ds'){ o.material = o.material.clone(); o.material.color.set(UCOL[id]); } }); nU[id] = m; }
  G.npcHasUmbrella = id => !!nU[id];
  let tapAt = 0, toldOpen = false, aiaiT = 0;
  addEventListener('keydown', e => { if (e.code === 'KeyU' && !e.repeat && G.mode === 'play' && items().umbrella && !G.lock){ items().umbrellaOff = !items().umbrellaOff; audio.burst(0.15, 1600, 0.08, { type:'bandpass' }); G.api.toast(items().umbrellaOff ? '傘をたたんだ' : '傘をひらいた', 1500); } });
  G.itemsUpdate = dt => { const st = S(), it = items(), rain = G.weatherNow ? G.weatherNow.rain : 0, outdoors = !G.indoor && !G.inSchool;
    // 主人公の傘：雨が降っていて、外を歩いているとき
    const under = G.aiai && G.aiaiHolder === 'npc';
    const open = !!it.umbrella && !it.umbrellaOff && rain > 0.12 && outdoors && !P.riding && !P.driving && !P.swimming && !P.carry && !P.sitting && !under && P.air < 0.5;
    pU.visible = !!(open || (G.aiai && G.aiaiHolder === 'player' && rain > 0.05 && outdoors));   // undefined だと three.js は表示してしまう pU.scale.setScalar(G.aiai && G.aiaiHolder === 'player' ? 1.3 : 1);
    if (!net.visible) P.ch.holdUp = pU.visible;
    if (open && !toldOpen){ toldOpen = true; G.api.toast('傘をさした（U でたたむ）', 2500); }
    if (pU.visible && G.time > tapAt){ tapAt = G.time + 0.05 + Math.random()*0.12; audio.burst(0.03, 2600 + Math.random()*1500, 0.012 + rain*0.02, { type:'bandpass' }); }   // 傘に当たる雨の音
    hat.visible = !!(it.hat && it.wearHat);
    ring.visible = !!(it.ukiwa && P.swimming); P.swimBoost = it.ukiwa ? 1.6 : 1;
    // 友達の傘
    for (const id in nU){ const n = G.npcs[id], m = nU[id]; const on = rain > 0.12 && n.root.visible && !(n.spot && n.spot.room) && !n.knock && !n.ride && !n.wet && outdoors;
      m.visible = on; n.ch.holdUp = on; m.scale.setScalar(G.aiai === id && G.aiaiHolder === 'npc' ? 1.35 : 1); }
    // 相合傘：雨がやんだら終わり。歩いているうちに一度だけ、特別な会話
    if (G.aiai){ aiaiT += dt; if (rain < 0.05 || G.companion !== G.aiai){ const id = G.aiai; G.aiai = null; aiaiT = 0; if (rain < 0.05 && G.companion === id) G.api.toast(T.AIAI_END, 3500); }
      else if (aiaiT > 25 && !st.today.aiaiTalk && !G.lock){ st.today.aiaiTalk = true; const id = G.aiai; G.run(async () => { const { talk } = await import('./dialogue.js'); await talk(T.AIAI_TALK[id] || []); G.api.friend(id, 2); }); } } };
  // 相合傘を始める（events.js の会話から呼ぶ）。holder は傘を持っている側
  G.startAiai = async (id, holder) => { const st = S(); G.aiai = id; G.aiaiHolder = holder; aiaiT = 0; const n = G.npcs[id]; n.following = true; G.companion = id;
    G.api.friend(id, 2); if (!st.today.aiaiLog){ st.today.aiaiLog = true; G.api.log(holder === 'npc' ? `雨の中、${NAMES[id]}の傘に入れてもらった。肩が少しぬれた。` : `雨の中、${NAMES[id]}を傘に入れてあげた。`); } };
}
