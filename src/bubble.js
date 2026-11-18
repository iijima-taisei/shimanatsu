// NPCの頭の上に出る吹き出し。ふだんのひとこと・はね飛ばされたとき・見たことの感想は、会話の帯ではなくここに出す。
// 筋書きのある会話（初対面・うわさ・行事・選ぶもの）は、今までどおり右の会話の帯。
import * as THREE from 'three';
import { NAMES } from '../data/story.js';
export function setupBubbles(G){
  const els = {}, v = new THREE.Vector3();
  // id の人に text を言わせる。sec を省くと、文の長さに合わせて出しておく
  G.speak = (id, text, sec) => { if (!text || !G.npcs[id]) return; let b = els[id]; if (!b){ b = els[id] = document.createElement('div'); b.className = 'bubble'; document.body.appendChild(b); }
    b.replaceChildren(Object.assign(document.createElement('small'), { textContent:NAMES[id] || '' }), document.createTextNode(text)); b.t = sec || Math.min(9, 3.2 + text.length*0.11); b.classList.add('show'); G.lastSpeak = G.time; };
  // 主人公と同じ場所（同じ部屋、または外どうし）にいる人だけ吹き出しを出す
  const together = n => { const room = n.spot && n.spot.room; if (n.following) return true; if (G.indoor && G.indoor !== 'class') return room === G.indoor; return !room || room === true || room === 'class'; };
  G.speaking = id => !!(els[id] && els[id].classList.contains('show'));
  G.bubbleUpdate = dt => { const r = G.renderer.domElement.getBoundingClientRect(), hide = G.paused || G.mapOpen || G.mode !== 'play';
    for (const id in els){ const b = els[id], n = G.npcs[id]; if (!b.classList.contains('show')) continue; b.t -= dt;
      if (b.t <= 0 || !n.root.visible || !together(n) || Math.hypot(n.pos.x - G.player.pos.x, n.pos.z - G.player.pos.z) > 45){ b.classList.remove('show'); continue; }
      if (hide){ b.style.visibility = 'hidden'; continue; }
      v.set(n.pos.x, n.pos.y + 2.05, n.pos.z).project(G.camera);
      const half = Math.min(b.offsetWidth/2 + 8, r.width/2); b.style.left = Math.min(r.right - half, Math.max(r.left + half, r.left + (v.x*0.5 + 0.5)*r.width)) + 'px';
      b.style.top = Math.max(r.top + b.offsetHeight + 4, r.top + (-v.y*0.5 + 0.5)*r.height) + 'px'; b.style.visibility = v.z < 1 && Math.abs(v.x) < 1.15 && v.y > -1.1 && v.y < 1.3 ? 'visible' : 'hidden'; } };
}
