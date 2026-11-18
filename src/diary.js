import { isConfirm } from './keys.js';
import { DATES, DIARY_END } from '../data/story.js';
// その日の天気（絵日記の見出し用）
const WNAME = { clear:'はれ', light:'こさめ', storm:'かみなり雨', gust:'くもり', typhoon:'たいふう' };
export function dayWeather(day, override){
  if (override && WNAME[override]) return WNAME[override];
  return day === 2 ? 'はれ　一時雨' : day === 5 ? 'はれのち夕立' : day === 7 ? 'くもり　風つよし' : day === 8 ? 'たいふう' : day === 10 ? '雨のちはれ' : 'はれ';
}
// 1日の終わりの絵日記
export function composeDiary(S, weather){
  const uniq = [...new Set(S.today.log)]; let body = uniq.slice(0, 4).join('\n');
  if (!uniq.length) body = 'なんにもしない一日だった。\nそれも、わるくない。';
  const tail = S.day === 11 ? '夏休みが、終わった。' : DIARY_END[(S.day*3 + uniq.length) % DIARY_END.length];
  return { date: DATES[S.day], weather: weather || dayWeather(S.day), text: body + '\n' + tail, photo: S.today.photo || null };
}
function fillPage(el, page){
  el.innerHTML = `<div class="page"><h2></h2>${page.photo ? '<img alt="今日の思い出の写真">' : ''}<p></p><div class="hint"></div></div>`;
  el.querySelector('h2').textContent = page.date + '　' + (page.weather || 'はれ');
  if (page.photo) el.querySelector('img').src = page.photo;
  el.querySelector('p').textContent = page.text;
}
export function showDiary(page, hint='Eで　つぎの日へ'){
  const el = document.getElementById('diary'); el.classList.remove('hidden');
  fillPage(el, page); el.querySelector('.hint').textContent = hint;
  return new Promise(res => { const t0 = performance.now(); const done = e => { if (performance.now() - t0 < 900 || e.repeat) return; if (e.type === 'keydown' && !isConfirm(e.code)) return; removeEventListener('keydown', done); el.removeEventListener('click', done); el.classList.add('hidden'); res(); };
    addEventListener('keydown', done); el.addEventListener('click', done); });
}
// これまでの絵日記をめくって読み返す
export function browseDiary(pages, startIdx){
  if (!pages || !pages.length) return Promise.resolve();
  const el = document.getElementById('diary'); el.classList.remove('hidden');
  let i = startIdx === undefined ? pages.length - 1 : Math.max(0, Math.min(pages.length - 1, startIdx));
  return new Promise(res => {
    const draw = () => {
      fillPage(el, pages[i]);
      const h = el.querySelector('.hint'); h.className = 'hint diary-nav';
      h.innerHTML = `<button type="button" data-act="prev"${i <= 0 ? ' disabled' : ''}>◀ 前の日</button><span class="diary-idx">${i + 1} / ${pages.length}</span><button type="button" data-act="next"${i >= pages.length - 1 ? ' disabled' : ''}>次の日 ▶</button><button type="button" data-act="close">とじる</button>`;
    };
    const close = () => { removeEventListener('keydown', onKey, true); el.removeEventListener('click', onClick); el.classList.add('hidden'); res(); };
    const step = d => { const next = Math.max(0, Math.min(pages.length - 1, i + d)); if (next !== i){ i = next; draw(); } };
    const onClick = e => { const b = e.target.closest('button[data-act]'); if (!b){ if (e.target === el) close(); return; }
      const a = b.dataset.act; if (a === 'prev') step(-1); else if (a === 'next') step(1); else if (a === 'close') close(); };
    const onKey = e => { if (e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA'){ e.preventDefault(); e.stopImmediatePropagation(); step(-1); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD'){ e.preventDefault(); e.stopImmediatePropagation(); step(1); }
      else if (e.code === 'Escape' || (isConfirm(e.code) && !e.target.closest('button[data-act]'))){ e.preventDefault(); e.stopImmediatePropagation(); close(); } };
    draw(); addEventListener('keydown', onKey, true); el.addEventListener('click', onClick);
  });
}
