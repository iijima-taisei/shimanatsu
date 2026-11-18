// デバッグモード（一時停止メニューの「デバッグ」から）。日にち・時刻・持ち物・好感度・フラグを好きに変えられる。
// 変えた値はすぐゲームに反映する。保存は、ふだんどおり翌朝に行われる。
import { DATES, NAMES } from '../data/story.js';
import { SPOTS, HOME, SHOP, TERM } from './world/places.js';
import { WEATHER_NAMES } from './weather.js';
const FLAGS = ['metNagisa', 'metOneesan', 'metOjisan', 'moneyHint', 'knowFlight', 'flew', 'rodeTruck', 'senko', 'senkoDone', 'isletBottle', 'toldBottle', 'readAlbum', 'finale', 'finalHint'];
const NUMS = [['prep', '文化祭の準備', 0, 5], ['money', 'おこづかい（円）', 0, 99999], ['ramune', 'ラムネ', 0, 99], ['fish', '釣った魚', 0, 999], ['fishSold', '売った魚', 0, 999], ['skip', '水切りの記録', 0, 99], ['goals', 'ゴール', 0, 999], ['taiso', 'ラジオ体操のスタンプ', 0, 12]];
const CICADAS = ['アブラゼミ', 'ミンミンゼミ', 'ツクツクボウシ', 'ヒグラシ'];
const CRABS = ['イワガニ', 'アカテガニ', 'ホンヤドカリ', 'スナガニ'];
const WARPS = [['自宅の前', HOME.x, HOME.z + 5.5], ['学校', 34, -48], ['しおかぜ商店', SHOP.x - 0.5, SHOP.z - 5.4], ['白砂港', -230, 70], ['白砂の浜', SPOTS.beach.x - 8, SPOTS.beach.z], ['潮見神社', SPOTS.shrine.x, SPOTS.shrine.z + 6],
  ['石柱の湯', SPOTS.onsen.x + 6, SPOTS.onsen.z], ['峠の展望台', -34, -60], ['石山の展望台', -186, 246], ['空港', TERM.x, TERM.z + 6.2], ['若浦の集落', 125, -425], ['沖の小島', -390, 64]];
export function setupDebug(G){
  const el = document.getElementById('debug'), S = () => G.state, P = G.player;
  const refresh = () => { if (G.api.refresh) G.api.refresh(); if (G.hud) G.hud.renderMenu(); };
  function render(){ const st = S();
    el.innerHTML = `<div class="page dbg"><h2>デバッグ</h2>
      <section><h3>日にち・時刻</h3>
        <label>日にち <select id="dbg-day">${DATES.map((d, i) => `<option value="${i}"${i === st.day ? ' selected' : ''}>${i + 1}日目　${d}</option>`).join('')}</select></label> <button data-act="day">この日の朝から始める</button><br>
        <label>時刻 <input id="dbg-hour" type="range" min="6" max="21" step="0.1" value="${st.hour.toFixed(1)}"> <output id="dbg-hourv">${fmt(st.hour)}</output></label>
        <label><input id="dbg-stop" type="checkbox"${G.timeStop ? ' checked' : ''}> 時間を止める</label><br>
        <label>天気 <select id="dbg-weather"><option value="">日にちどおり</option>${Object.entries(WEATHER_NAMES).map(([k, n]) => `<option value="${k}"${G.weatherOverride === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label></section>
      <section><h3>持ち物・記録</h3><div class="dbg-grid">${NUMS.map(([k, n, lo, hi]) => `<label>${n}<input type="number" data-num="${k}" min="${lo}" max="${hi}" value="${st[k] || 0}"></label>`).join('')}
        <label>貝がら（${G.world.shells.length}個中）<input type="number" id="dbg-shells" min="0" max="${G.world.shells.length}" value="${st.shells.length}"></label></div>
        <div>${CICADAS.map(c => `<label><input type="checkbox" data-bug="${c}"${st.bugs.includes(c) ? ' checked' : ''}> ${c}</label>`).join(' ')}</div>
        <div>${CRABS.map(c => `<label><input type="checkbox" data-crab="${c}"${(st.crabs || []).includes(c) ? ' checked' : ''}> ${c}</label>`).join(' ')}</div></section>
      <section><h3>好感度（0〜10）</h3><div class="dbg-grid">${Object.keys(st.friends).map(id => `<label>${NAMES[id]}<input type="range" min="0" max="10" data-friend="${id}" value="${st.friends[id]}"> <output>${st.friends[id]}</output></label>`).join('')}</div></section>
      <section><h3>フラグ</h3><div class="dbg-flags">${[...new Set([...FLAGS, ...Object.keys(st.flags)])].map(f => `<label><input type="checkbox" data-flag="${f}"${st.flags[f] ? ' checked' : ''}> ${f}</label>`).join('')}</div></section>
      <section><h3>ワープ</h3><div>${WARPS.map((w, i) => `<button data-warp="${i}">${w[0]}</button>`).join(' ')}</div></section>
      <section><h3>そのほかの値（JSON）</h3><textarea id="dbg-json" spellcheck="false">${JSON.stringify({ ...st, diary:`（${st.diary.length}ページ。ここでは変えない）` }, null, 1)}</textarea><button data-act="json">この内容を反映する</button> <span id="dbg-msg"></span></section>
      <p><button data-act="close">とじる（Esc）</button></p></div>`; }
  const fmt = h => `${Math.floor(h)}:${String(Math.floor((h % 1)*60)).padStart(2, '0')}`;
  el.addEventListener('input', e => { const t = e.target, st = S();
    if (t.id === 'dbg-hour'){ st.hour = +t.value; el.querySelector('#dbg-hourv').textContent = fmt(st.hour); }
    else if (t.dataset.num){ st[t.dataset.num] = Math.max(+t.min, Math.min(+t.max, Math.floor(+t.value || 0))); if (t.dataset.num === 'prep') refresh(); }
    else if (t.id === 'dbg-shells'){ const n = Math.max(0, Math.min(G.world.shells.length, Math.floor(+t.value || 0))); st.shells = G.world.shells.slice(0, n).map(s => s.id); refresh(); }
    else if (t.dataset.friend){ st.friends[t.dataset.friend] = +t.value; t.nextElementSibling.textContent = t.value; } });
  el.addEventListener('change', e => { const t = e.target, st = S();
    if (t.id === 'dbg-stop') G.timeStop = t.checked;
    else if (t.id === 'dbg-weather') G.weatherOverride = t.value || null;
    else if (t.dataset.bug){ const b = t.dataset.bug; st.bugs = t.checked ? [...new Set([...st.bugs, b])] : st.bugs.filter(x => x !== b); }
    else if (t.dataset.crab){ const b = t.dataset.crab; st.crabs = st.crabs || []; st.crabs = t.checked ? [...new Set([...st.crabs, b])] : st.crabs.filter(x => x !== b); }
    else if (t.dataset.flag) st.flags[t.dataset.flag] = t.checked; });
  el.addEventListener('click', e => { const t = e.target.closest('button'); if (!t) return; const st = S();
    if (t.dataset.warp){ const w = WARPS[+t.dataset.warp]; G.api.leaveRoom(); P.teleport(w[1], w[2], 0); G.debug.close(); G.setPause(false); }
    else if (t.dataset.act === 'close'){ G.debug.close(); }
    else if (t.dataset.act === 'day'){ st.day = +el.querySelector('#dbg-day').value; G.debug.close(); G.setPause(false); G.run(() => G.api.startDay()); }
    else if (t.dataset.act === 'json'){ const msg = el.querySelector('#dbg-msg'); try { const v = JSON.parse(el.querySelector('#dbg-json').value); delete v.diary; for (const k in v) if (k !== 'today' || typeof v.today === 'object') st[k] = v[k]; refresh(); msg.textContent = '反映しました'; } catch (err){ msg.textContent = 'JSONの書き方がちがいます：' + err.message; } } });
  G.debug = { open(){ render(); el.classList.remove('hidden'); G.debugOpen = true; }, close(){ el.classList.add('hidden'); G.debugOpen = false; } };
}
