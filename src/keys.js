// キーの割り当て（一時停止メニューで変えられる）と、ゲームパッドのボタン
const SAVEK = 'shimanatsu-keys';
export const DEFAULT = { interact:'KeyE', jump:'Space' };
export const BIND = { ...DEFAULT };
try { const b = JSON.parse(localStorage.getItem(SAVEK) || '{}'); for (const k in DEFAULT) if (typeof b[k] === 'string') BIND[k] = b[k]; } catch (e) {}
export const saveBind = () => { try { localStorage.setItem(SAVEK, JSON.stringify(BIND)); } catch (e) {} };
// 会話を送れるキー（調べる・ジャンプのどちらでも、Enter・Z でも送れる）
export const isConfirm = code => code === BIND.interact || code === BIND.jump || code === 'Enter' || code === 'KeyZ';
export const keyName = code => code === 'Space' ? 'スペース' : code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5)
  : ({ ShiftLeft:'左Shift', ShiftRight:'右Shift', ControlLeft:'左Ctrl', AltLeft:'左Alt', Enter:'Enter', Tab:'Tab', ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→' })[code] || code;
// 設定：運転の操作方法（easy かんたん／manual マニュアル（ギアを変える）／radio ラジコン（倒した方向へ進む））
// view は視点（third 三人称／first 一人称）
export const SETTINGS = { drive:'easy', view:'third', llm:false, llmModel:'light' };
try { const v = JSON.parse(localStorage.getItem('shimanatsu-settings') || '{}'); if (['easy', 'manual', 'radio'].includes(v.drive)) SETTINGS.drive = v.drive; if (['third', 'first'].includes(v.view)) SETTINGS.view = v.view; SETTINGS.llm = v.llm === true; if (['light', 'smart'].includes(v.llmModel)) SETTINGS.llmModel = v.llmModel; } catch (e) {}
export const saveSettings = () => { try { localStorage.setItem('shimanatsu-settings', JSON.stringify(SETTINGS)); } catch (e) {} };
// マニュアルのギア。車は1〜5速と R、原付は1〜4速。数字はその速さの上限（m/s）と加速
export const GEARS = { car:{ max:[0, 7, 12, 17, 23, 29], acc:[0, 7.5, 6.2, 5, 4, 3.2] }, moped:{ max:[0, 6, 10, 14.5, 19], acc:[0, 8, 6.5, 5, 4] } };
export const gearName = g => g < 0 ? 'R' : g === 0 ? 'N' : g + '速';
// ゲームパッド：A＝調べる・会話、B＝ジャンプ、X＝乗り物を降りる、Y＝地図、RB＝写真、START＝一時停止、十字キー上下＝選択肢
const PAD = { 0:() => BIND.interact, 1:() => BIND.jump, 2:() => 'KeyB', 3:() => 'KeyM', 5:() => 'KeyP', 9:() => 'Escape', 12:() => 'ArrowUp', 13:() => 'ArrowDown' };
const prev = {};
export function pollPad(){ const gp = navigator.getGamepads && navigator.getGamepads()[0]; if (!gp) return;
  for (const b in PAD){ const on = !!(gp.buttons[b] && gp.buttons[b].pressed), code = PAD[b]();
    if (on && !prev[b]) dispatchEvent(new KeyboardEvent('keydown', { code })); else if (!on && prev[b]) dispatchEvent(new KeyboardEvent('keyup', { code })); prev[b] = on; } }
