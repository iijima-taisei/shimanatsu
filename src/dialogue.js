// 右の縦書き会話帯。say() と choose() は最後の頁の決定を待つ Promise を返す。
import { isConfirm } from './keys.js';
const $ = id => document.getElementById(id);
let resolve = null, letters = [], pages = [[]], page = 0, shown = 0, opts = null, sel = 0, timer = 0, onTick = null;
export const dlg = { busy: false };
// 縦書きで半角の数字や英字が横に寝ないように、文字を「1文字ずつのHTML」に分ける。
// 2けたまでの数字・英字は縦中横（1マスに横並び）、3けた以上の数字は全角にして1文字ずつ立てる。
const esc = c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c;
function tokenize(text){ const out = [], re = /(\d+)|([A-Za-z]+)|([\s\S])/g; let m;
  while ((m = re.exec(text))){ const run = m[1] || m[2];
    if (run && run.length <= 2) out.push(`<span class="tcy">${run}</span>`);
    else if (m[1]) for (const d of run) out.push(String.fromCharCode(d.charCodeAt(0) + 0xFEE0));
    else if (m[2]) for (const c of run) out.push(c);
    else out.push(esc(m[3])); }
  return out; }
const current = () => pages[page];
const done = () => shown >= current().length;
const choosing = () => !!opts && page === pages.length-1 && done();
function markChoice(){
  for (const [i, button] of [...$('dchoices').children].entries()){
    button.classList.toggle('sel', i===sel); button.textContent = (i===sel?'▶ ':'　') + opts[i];
  }
}
function render(){
  $('dtext').innerHTML = current().slice(0, shown).join('');
  $('dialogue').dataset.page = String(page + 1); $('dialogue').dataset.pages = String(pages.length);
  $('dnext').textContent = page < pages.length-1 ? 'つづきを読む　▼' : '▼';
  $('dnext').style.visibility = done() && !choosing() ? 'visible' : 'hidden';
  const ready = choosing();
  $('dchoices').setAttribute('aria-hidden', String(!ready));
  for (const button of $('dchoices').children) button.disabled = !ready;
}
function makeChoices(){
  const c = $('dchoices'); c.innerHTML = '';
  if (!opts) return;
  opts.forEach((text, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.disabled = true;
    button.onfocus = () => { sel = i; markChoice(); };
    button.onclick = () => { if (!choosing()) return; sel = i; advance(); };
    c.appendChild(button);
  });
  markChoice();
}
// 選択肢の場所を先に確保し、縦書きの実際の段組みで収まる長さを測る。
function fitPages(progress=0){
  const el = $('dtext'); pages = []; let start = 0;
  while (start < letters.length){
    let lo = start+1, hi = letters.length, end = start+1;
    while (lo <= hi){
      const middle = Math.floor((lo+hi)/2); el.innerHTML = letters.slice(start, middle).join('');
      if (el.scrollWidth <= el.clientWidth+1 && el.scrollHeight <= el.clientHeight+1){ end = middle; lo = middle+1; }
      else hi = middle-1;
    }
    pages.push(letters.slice(start, end)); start = end;
  }
  if (!pages.length) pages = [[]];
  page = 0;
  while (page < pages.length-1 && progress > pages[page].length){ progress -= pages[page].length; page++; }
  shown = Math.min(progress, current().length); render();
}
function typePage(){
  clearInterval(timer); if (done()) return;
  timer = setInterval(() => {
    if (shown < current().length){ shown++; if (onTick && shown % 2 === 0) onTick(); render(); }
    if (done()) clearInterval(timer);
  }, 28);
}
function open(name, text, options){
  clearInterval(timer); dlg.busy = true; $('dialogue').classList.remove('hidden');
  $('dname').textContent = name || ''; letters = tokenize(text); page = 0; shown = 0; opts = options || null; sel = 0;
  makeChoices(); fitPages(); typePage();
  return new Promise(r => resolve = r);
}
function advance(){
  if (!resolve) return;
  if (!done()){ shown = current().length; clearInterval(timer); render(); return; }
  if (page < pages.length-1){ page++; shown = 0; render(); typePage(); return; }
  const r = resolve, v = opts ? sel : undefined; resolve = null; r(v); }
export function say(name, text){ return open(name, text); }
export function choose(name, text, options){ return open(name, text, options); }
export function closeDialogue(){ if (dlg.busy) closedAt = performance.now(); clearInterval(timer); $('dialogue').classList.add('hidden'); dlg.busy = false; }
export async function talk(lines){ for (const l of lines) await say(l[0], l[1]); }
export function setTick(fn){ onTick = fn; }
// イベントを飛ばすとき：いま出ている会話を、その場で終わらせる
export function skipDialogue(){ if (!resolve) return; const r = resolve, v = opts ? 0 : undefined; resolve = null; clearInterval(timer); r(v); }
function reflow(){
  if (!dlg.busy) return;
  const progress = pages.slice(0, page).reduce((sum, part) => sum+part.length, 0)+shown;
  fitPages(progress); typePage();
}
addEventListener('resize', reflow);
if (document.fonts) document.fonts.ready.then(reflow);
// 決定キーは「1回押したら1つだけ進む」。押しっぱなし・二重のキーイベント（日本語入力中など）・
// 会話を閉じた同じ押下で次の会話が始まる、をまとめて防ぐため、決定キーの受付はここ1か所にする。
// 会話送りはどれでも。会話の外では E＝調べる、スペース＝ジャンプ（main.js）
let held = false, lastAt = 0, closedAt = 0;
addEventListener('keyup', e => { if (isConfirm(e.code)) held = false; });
addEventListener('blur', () => { held = false; });
addEventListener('keydown', e => {
  if (resolve && choosing() && !e.repeat && !e.isComposing){
    const up = ['ArrowUp','KeyW'].includes(e.code), down = ['ArrowDown','KeyS'].includes(e.code);
    if (up || down){
      e.preventDefault(); const focused = e.target.closest?.('#dchoices button');
      sel = (sel + (up ? opts.length-1 : 1)) % opts.length; markChoice();
      const button = $('dchoices').children[sel]; if (focused) button.focus(); button.scrollIntoView({ block:'nearest' }); return;
    }
  }
  // タイトルや選択肢のボタンは、ブラウザ本来の決定操作に任せる。
  if (e.target.closest?.('button, a, input, select, textarea, [contenteditable="true"]')) return;
  if (!isConfirm(e.code)) return; e.preventDefault();
  const now = performance.now(); if (e.repeat || e.isComposing || held || now - lastAt < 180) return; held = true; lastAt = now;
  if (resolve){ advance(); return; }
  if (!dlg.busy && now - closedAt > 300 && dlg.onConfirm) dlg.onConfirm(e.code);
});
$('dialogue').addEventListener('click', e => { if (e.target.parentElement && e.target.parentElement.id === 'dchoices') return; const now = performance.now(); if (now - lastAt < 180) return; lastAt = now; advance(); });
