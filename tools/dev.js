// 確認用の道具。ブラウザのコンソールで  await import('/tools/dev.js')  として読み込む。
// タブが裏にあっても進むようにコマ送りし、会話は自動で送る（window.hold = true で止まる）。
const G = window.G;
// 「はじめる」を押すとセーブが上書きされるので、読みこんだ時点のセーブを別のキーに写しておく（まだ写していなければ）。
// 確認が終わったら restoreSave() で戻す。
const SAVE = 'shimanatsu-save-v1', BACK = 'shimanatsu-save-before-dev';
try { if (localStorage[SAVE] && !localStorage[BACK]) localStorage[BACK] = localStorage[SAVE]; } catch (e) {}
window.restoreSave = () => { try { if (localStorage[BACK]){ localStorage[SAVE] = localStorage[BACK]; localStorage.removeItem(BACK); return 'restored'; } } catch (e) {} return 'no backup'; };
// タブが裏にあるとブラウザがタイマーを1秒に1回まで間引くので、確認中だけ正確なタイマーに差し替える。
// （回しっぱなしだとCPUを使うので、確認が終わったらページを読み込み直すこと）
if (!window.__fastTimers){ window.__fastTimers = true; const ch = new MessageChannel(), q = []; let id = 1e6, armed = false; const arm = () => { if (!armed && q.length){ armed = true; ch.port2.postMessage(0); } };
  ch.port1.onmessage = () => { armed = false; const now = performance.now(); for (const t of q.slice()) if (now >= t.at){ if (t.every) t.at = now + t.every; else q.splice(q.indexOf(t), 1); try { t.fn(); } catch (e) { console.error(e); } } arm(); };
  window.setTimeout = (fn, ms=0) => { q.push({ id:++id, fn, at:performance.now() + ms }); arm(); return id; };
  window.setInterval = (fn, ms=0) => { q.push({ id:++id, fn, at:performance.now() + ms, every:Math.max(4, ms) }); arm(); return id; };
  window.clearTimeout = window.clearInterval = i => { const k = q.findIndex(t => t.id === i); if (k >= 0) q.splice(k, 1); }; }
window.sl = ms => new Promise(r => setTimeout(r, ms));
clearInterval(window.auto);
window.auto = setInterval(() => { G.tick(0.033); const d = document.getElementById('dialogue');
  if (!d.classList.contains('hidden') && !window.hold){ dispatchEvent(new KeyboardEvent('keydown', { code:'Space' })); dispatchEvent(new KeyboardEvent('keyup', { code:'Space' })); } }, 50);
// 上から見る
window.top_ = (x, z, h, hour=11) => { G.state.hour = hour; G.timeStop = true; G.player.camOverride = true; G.camera.position.set(x, h, z + h*0.35); G.camera.lookAt(x, 5, z); };
// 主人公を置いて見る
window.view = async (x, z, yaw, cy, cp=0.05, cd=3, hour) => { G.player.camOverride = false; if (hour) G.state.hour = hour; G.timeStop = true; G.player.teleport(x, z, yaw); G.player.camYaw = cy; G.player.camPitch = cp; G.player.camDist = cd; G.player.snap = true; await sl(700); };
window.startGame = async () => { if (G.mode === 'title') document.getElementById('start').click(); for (let i = 0; i < 300 && (G.mode !== 'play' || G.lock || !G.state.today); i++) await sl(100); await sl(300); };
window.info = () => ({ lots: G.world.lots && G.world.lots.length, tris: G.renderer.info.render.triangles, calls: G.renderer.info.render.calls });
