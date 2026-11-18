// 日めくりカレンダーとアナログ時計（画面の左下、ミニマップの横）と、メニュー（Mキー）の持ち物。
// 数のものは文字ではなくアイコンで見せる。
import { DATES, REMAIN, PREP_TASKS, FARE, ITEMS } from '../data/story.js';
const MONTH = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'], WEEK = ['日','月','火','水','木','金','土'];
const ICON = n => `textures/icon-${n}.png`;
const PREP_ICON = ['prep-ring', 'prep-sign', 'prep-flower', 'prep-lantern', 'prep-banner'];
const parse = s => { const m = /(\d+)月(\d+)日/.exec(s); return [+m[1], +m[2]]; };

// 日めくり：上に月、まんなかに大きな日付、下に曜日と「夏休み あと○日」
function calendarHTML(day){ const [mo, d] = parse(DATES[day]), w = new Date(2026, mo - 1, d).getDay();
  return `<div class="cal-ring"><i></i><i></i></div><div class="cal-month">${MONTH[mo - 1]}</div><div class="cal-day${w === 0 ? ' sun' : w === 6 ? ' sat' : ''}">${d}</div><div class="cal-week">${WEEK[w]}曜日</div><div class="cal-left">${REMAIN[day] ? `のこり ${REMAIN[day]}日` : '最後の日'}</div>`; }
// アナログ時計。昼は白い文字盤、夜は紺
function drawClock(cv, hour){ const dpr = Math.min(2, devicePixelRatio || 1), s = cv.clientWidth*dpr; if (!s) return; if (cv.width !== s){ cv.width = cv.height = s; } const g = cv.getContext('2d'), r = s/2;
  const night = hour >= 18.5 || hour < 5.5; g.clearRect(0, 0, s, s); g.save(); g.translate(r, r);
  g.beginPath(); g.arc(0, 0, r*0.95, 0, 7); g.fillStyle = night ? '#24324d' : '#fbf8ef'; g.fill(); g.lineWidth = r*0.09; g.strokeStyle = '#7a5a3c'; g.stroke();
  for (let i = 0; i < 12; i++){ const a = i/12*Math.PI*2, big = i % 3 === 0; g.beginPath(); g.moveTo(Math.sin(a)*r*(big ? 0.62 : 0.7), -Math.cos(a)*r*(big ? 0.62 : 0.7)); g.lineTo(Math.sin(a)*r*0.8, -Math.cos(a)*r*0.8); g.lineWidth = r*(big ? 0.07 : 0.035); g.strokeStyle = night ? '#d6dcef' : '#4a3b2a'; g.stroke(); }
  const h = hour % 12, m = (hour % 1)*60, hand = (a, len, w, col) => { g.beginPath(); g.moveTo(-Math.sin(a)*len*0.15, Math.cos(a)*len*0.15); g.lineTo(Math.sin(a)*len, -Math.cos(a)*len); g.lineWidth = w; g.lineCap = 'round'; g.strokeStyle = col; g.stroke(); };
  hand(h/12*Math.PI*2, r*0.45, r*0.11, night ? '#f2f2f2' : '#3a2c1c'); hand(m/60*Math.PI*2, r*0.68, r*0.07, night ? '#f2f2f2' : '#3a2c1c');
  g.beginPath(); g.arc(0, 0, r*0.07, 0, 7); g.fillStyle = '#d9483b'; g.fill(); g.restore(); }

export function setupHud(G){
  const $ = id => document.getElementById(id), S = () => G.state;
  let shownDay = -1, lastMin = -1;
  const setCal = (el, day, flip) => { el.innerHTML = calendarHTML(day); if (flip){ el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip'); } };
  // 持ち物：アイコンと数。まだ持っていないものは出さない
  const tile = (icon, n, title, cls='') => `<div class="inv${cls}" title="${title}"><img src="${ICON(icon)}" alt="${title}"><b>${n}</b></div>`;
  const row = (icon, have, total, title) => `<div class="irow" title="${title}">${Array.from({ length:total }, (_, i) => `<img class="${i < have ? 'on' : 'off'}" src="${ICON(icon)}" alt="">`).join('')}</div>`;
  function renderMenu(){ const st = S(), el = $('menuinv'); if (!el) return; setCal($('menucal'), st.day, !!G.mapFlip); G.mapFlip = false;   // 日が変わって初めて開いたときは、ページをめくる drawClock($('menuclock'), st.hour);
    const prep = PREP_ICON.map((n, i) => `<img class="${i < st.prep ? 'on' : 'off'}${i === st.prep ? ' next' : ''}" src="${ICON(n)}" alt="${PREP_TASKS[i].name}" title="${PREP_TASKS[i].name}">`).join('');
    const tiles = [];
    if (st.money || st.flags.knowFlight) tiles.push(tile('coin', st.money, 'おこづかい（円）', st.flags.knowFlight && !st.flags.flew && st.money >= FARE ? ' ready' : ''));
    if (st.ramune) tiles.push(tile('ramune', st.ramune, 'ラムネ'));
    if (st.shells.length) tiles.push(tile('shell', st.shells.length, '貝がら'));
    if (st.fish) tiles.push(tile('fish', st.fish, '釣った魚'));
    if (st.flags.senko && !st.flags.senkoDone) tiles.push(tile('senko', 1, '線香花火'));
    if (st.skip) tiles.push(tile('stone', st.skip, '水切りの記録（回）'));
    if (st.goals) tiles.push(tile('ball', st.goals, 'ゴールの数'));
    const it = st.items || {}; for (const k in ITEMS) if (it[k]) tiles.push(`<div class="inv tool${k === 'hat' ? ' click' + (it.wearHat ? ' on' : '') : ''}" data-item="${k}" title="${ITEMS[k].name}：${ITEMS[k].desc}"><img src="${ICON(ITEMS[k].icon)}" alt="${ITEMS[k].name}"><b>${k === 'umbrella' ? (it.umbrellaOff ? 'とじ' : '') : k === 'hat' ? (it.wearHat ? 'かぶる' : '') : ''}</b></div>`);
    let html = `<div class="mhead">文化祭の準備</div><div class="prep">${prep}</div>`;
    if (tiles.length) html += `<div class="mhead">持ち物</div><div class="invgrid">${tiles.join('')}</div>`;
    if (st.bugs && st.bugs.length) html += `<div class="mhead">セミ</div>${row('cicada', st.bugs.length, 4, 'つかまえたセミの種類')}`;
    if (st.crabs && st.crabs.length) html += `<div class="mhead">磯のカニ（${st.crabs.length} / 4）</div><div class="menutags">${st.crabs.join('　')}</div>`;
    if (st.taiso) html += `<div class="mhead">ラジオ体操</div>${row('stamp', st.taiso, 12, 'ラジオ体操のスタンプ')}`;
    if (st.flags.knowFlight && !st.flags.flew){ const k = Math.min(1, st.money/FARE); html += `<div class="mhead">遊覧飛行</div><div class="goalbar"><i style="width:${k*100}%"></i></div>`; }
    if (st.diary && st.diary.length) html += `<p class="menudir"><button type="button" id="menudiary">絵日記を読み返す（${st.diary.length}日ぶん）</button></p>`;
    el.innerHTML = html; }
  document.getElementById('menuinv')?.addEventListener('click', e => {
    if (e.target.closest('#menudiary')){ G.map && G.map.toggle(false); G.browseDiary && G.browseDiary(); return; }
    const t = e.target.closest('[data-item]'); if (!t) return; const it = S().items || {}; if (t.dataset.item === 'hat'){ it.wearHat = !it.wearHat; renderMenu(); } else if (t.dataset.item === 'umbrella'){ it.umbrellaOff = !it.umbrellaOff; renderMenu(); } });
  G.hud = {
    renderMenu,
    update(){ const st = S(); if (G.mode !== 'play') return;
      // 日めくりと時計はメニューの中だけ。画面には、ミニマップのふちの時計（map.js）を出す
      const min = Math.floor(st.hour*6); if (min !== lastMin){ lastMin = min; if (G.mapOpen) renderMenu(); }
      if (st.day !== shownDay){ if (shownDay >= 0) G.mapFlip = true; shownDay = st.day; } },
  };
}
