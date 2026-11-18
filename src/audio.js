// 環境音とBGMをWeb Audioで合成する（音声ファイルは使わない）
let ctx = null, master, noiseBuf; const L = {};
function noise(){ const b = ctx.createBufferSource(); b.buffer = noiseBuf; b.loop = true; b.start(); return b; }
function gainTo(g, v, t=0.8){ g.gain.setTargetAtTime(v, ctx.currentTime, t); }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth01 = (a, b, x) => { const t = clamp((x - a)/(b - a), 0, 1); return t*t*(3 - 2*t); };
// 晴れた日中の、大きな木々や建物の日陰エリア判定（0〜1の涼気度）
export function computeShadeFactor({ x, z, sunDir, hour = 12, cloud = 0, rain = 0, indoor = false, swimming = false, trees = [], buildings = [] } = {}){
  if (indoor || swimming || hour <= 6.5 || hour >= 18.0 || rain > 0.12 || cloud >= 0.45){
    return { shade:0, treeShade:0, bldShade:0 };
  }
  const sunK = clamp(1 - cloud*2.2, 0, 1);
  const dayK = smooth01(6.5, 7.5, hour)*(1 - smooth01(17.2, 18.0, hour));
  const sx = sunDir ? sunDir.x : 0.4, sz = sunDir ? sunDir.z : 0.3, sy = Math.max(0.25, sunDir ? sunDir.y : 0.7);
  const hLen = Math.hypot(sx, sz);
  const ux = hLen > 0.01 ? -sx/hLen : 0, uz = hLen > 0.01 ? -sz/hLen : -1;
  const tanApprox = Math.min(1.6, hLen/sy);
  let treeShade = 0;
  for (const t of trees || []){
    const s = t.s ?? 1;
    if (s < 0.72) continue;
    if (Math.abs(x - t.x) > 10 || Math.abs(z - t.z) > 10) continue;
    const len = Math.min(4.2, 4.8*s*tanApprox*0.65);
    const proj = len > 0.01 ? clamp(((x - t.x)*ux + (z - t.z)*uz)/len, 0, 1) : 0;
    const cx = t.x + ux*len*proj, cz = t.z + uz*len*proj;
    const d = Math.hypot(x - cx, z - cz), r = 2.6*s;
    if (d < r + 1.2){
      const k = clamp((r + 1.2 - d)/1.4, 0, 1);
      if (k > treeShade) treeShade = k;
    }
  }
  let bldShade = 0;
  for (const b of buildings || []){
    if (Math.abs(x - b.x) > 35 || Math.abs(z - b.z) > 35) continue;
    const hw = b.w*0.5, hd = b.d*0.5, bLen = Math.min(5.5, (b.h || 4.5)*tanApprox*0.72);
    let minOut = 99;
    for (const f of [0, 0.35, 0.7, 1.0]){
      const dx = (x - ux*bLen*f) - b.x, dz = (z - uz*bLen*f) - b.z;
      const lx = dx*b.cs - dz*b.sn, lz = dx*b.sn + dz*b.cs;
      const out = Math.hypot(Math.max(0, Math.abs(lx) - hw), Math.max(0, Math.abs(lz) - hd));
      if (out < minOut) minOut = out;
    }
    if (minOut < 1.2){
      const k = clamp((1.2 - minOut)/1.2, 0, 1);
      if (k > bldShade) bldShade = k;
    }
  }
  const ts = clamp(treeShade*sunK*dayK, 0, 1), bs = clamp(bldShade*sunK*dayK, 0, 1);
  return { shade:Math.max(ts, bs), treeShade:ts, bldShade:bs };
}
// 日向・日陰に応じた蝉・風・葉擦れの環境音バランスを計算する
export function computeAmbienceBalance(s = {}){
  const hour = s.hour ?? 12, coast = s.coast || 0, high = s.high || 0;
  const day = hour > 6.5 && hour < 17.6;
  const prox = clamp(s.cicadaProx || 0, 0, 1);
  const shade = clamp(s.shade || 0, 0, 1);
  const treeShade = clamp(s.treeShade || 0, 0, 1);
  const cicadaBase = day ? 0.05 : (prox > 0 && hour > 6.5 && hour < 19 ? 0.032 : 0);
  const cicadaGain = cicadaBase*(s.indoor ? 0.45 : 1)*(1 - coast*0.7)*(s.quiet ? 0.3 : 1)*(1 + prox*0.95)*(1 - shade*0.18);
  const cicadaFreq = 5200 + prox*550 - shade*650;
  const cicadaQ = 7 - shade*1.8;
  const cicadaSlow = 0.9 + prox*0.85;
  const windGain = s.indoor ? 0 : 0.02 + high*0.06 + shade*0.015;
  const rustleGain = (s.indoor || s.quiet) ? 0 : shade*(0.008 + treeShade*0.008);
  return { cicadaGain, cicadaFreq, cicadaQ, cicadaSlow, windGain, rustleGain };
}
// 風鈴の発音可否と次回間隔・音量を決める（台風時は鳴りすぎないよう停止する）
export function computeFurinSchedule(wind = 0, kind = 'clear', indoor = false){
  if (kind === 'typhoon' || wind >= 0.7) return { allow:false, minWait:0, maxWait:0, vol:0 };
  const w = clamp(wind || 0, 0, 0.7);
  const minWait = Math.max(3.5, 6.0 - w*3.5);
  const maxWait = Math.max(minWait + 2.5, 13.0 - w*7.0);
  const vol = (indoor ? 0.65 : 1.0)*(0.9 + w*0.2);
  return { allow:true, minWait, maxWait, vol };
}
// 自転車・原付の風切り音パラメータ計算（速度に応じて立ち上がり、停止・消音時はゼロへ）
export function computeRideWindParams(v, on = true){
  const active = !!on && v > 5.5;
  if (!active) return { active:false, gain:0, freq:280, q:0.85 };
  const u = Math.min(1.15, (v - 5.5) / 13.5);
  const smooth = u >= 1 ? 1 + (u - 1) * 0.25 : u * u * (3 - 2 * u);
  return {
    active: true,
    gain: 0.072 * smooth,
    freq: 280 + u * 920,
    q: 0.85 + Math.min(1, u) * 0.55,
  };
}
// 原付エンジン音パラメータ計算（速度とギア相当の段階から回転数・ピッチを決める）
export function computeMopedEngineParams(v, on = true, opt = {}){
  if (!on) return { active:false, gain:0, freq:56, cutoff:420, gear:1, rpm:0 };
  const speed = Math.max(0, v || 0);
  let gear = 1, rpm = 0;
  if (opt.manual){
    gear = clamp(Math.round(opt.gear || 1), 1, 4);
    rpm = clamp(opt.rpm ?? 0, 0, 1.15);
  } else {
    const stages = [[1, 0, 5.2], [2, 2.6, 9.6], [3, 5.8, 14.2], [4, 9.2, 19.0]];
    const idx = speed < 5.2 ? 0 : speed < 9.6 ? 1 : speed < 14.2 ? 2 : 3;
    const [g, lo, hi] = stages[idx];
    gear = g;
    rpm = speed < 0.2 ? 0 : clamp((speed - lo) / (hi - lo), 0.22, 1.1);
  }
  return {
    active: true,
    gain: 0.024 + Math.min(1, rpm) * 0.036,
    freq: 56 + rpm * 88 + (gear - 1) * 5,
    cutoff: 420 + rpm * 780 + (gear - 1) * 40,
    gear,
    rpm,
  };
}
// 地面材質ごとの足音・着地音パラメータ（日常動作の邪魔にならないよう差は控えめ）
const SURF_STEP = {
  sand:    { dur:0.095, freq:1950, vol:0.044, type:'bandpass' },
  road:    { dur:0.045, freq:1150, vol:0.052, type:'bandpass' },
  dirt:    { dur:0.070, freq:1380, vol:0.048, type:'bandpass' },
  grass:   { dur:0.080, freq:1650, vol:0.040, type:'bandpass' },
  wood:    { dur:0.055, freq:720,  vol:0.046, type:'bandpass', tap:175 },
  shallow: { dur:0.125, freq:1250, vol:0.054, type:'bandpass' },
};
const SURF_LAND = {
  sand:    { dur:0.105, freq:680,  vol:0.85, type:'bandpass' },
  road:    { dur:0.055, freq:350,  vol:1.05, type:'lowpass' },
  dirt:    { dur:0.075, freq:420,  vol:1.00, type:'lowpass' },
  grass:   { dur:0.080, freq:480,  vol:0.85, type:'lowpass' },
  wood:    { dur:0.070, freq:280,  vol:0.90, type:'lowpass', tap:135 },
  shallow: { dur:0.135, freq:1050, vol:0.95, type:'bandpass' },
};
// 文化祭準備の作業別サウンド定義（0 輪かざり／1 看板／2 紙の花／3 提灯／4 横断幕）
const PREP_SOUND = [
  s => [
    ['burst', 0.032, 3600 + s*260, 0.085, { type:'highpass' }],
    ['tone', 1840 + s*110, 0.024, { type:'triangle', vol:0.04, attack:0.002, slide:0.62 }],
    ['burst', 0.045, 2400, 0.065, { type:'bandpass', when:0.045 }],
    ['tone', 1420 + s*90, 0.026, { type:'triangle', vol:0.035, attack:0.002, when:0.048, slide:0.55 }],
  ],
  s => [
    ['burst', 0.095, 1650 + s*210, 0.075, { type:'bandpass' }],
    ['burst', 0.045, 720, 0.06, { type:'lowpass', when:0.02 }],
    ['tone', 210 + s*18, 0.05, { type:'triangle', vol:0.075, attack:0.002, when:0.015, slide:0.72 }],
  ],
  (s, step) => [
    ['burst', 0.06, 3100 + s*240, 0.06, { type:'bandpass' }],
    ['tone', 420 + step*28, 0.055, { type:'triangle', vol:0.05, attack:0.003, when:0.04, slide:0.82 }],
    ['burst', 0.028, 1200, 0.055, { type:'bandpass', when:0.042 }],
  ],
  s => [
    ['tone', 255 + s*22, 0.055, { type:'triangle', vol:0.075, attack:0.002, slide:0.68 }],
    ['burst', 0.035, 950, 0.06, { type:'bandpass' }],
    ['tone', 360 + s*30, 0.075, { type:'sine', vol:0.055, attack:0.004, when:0.055, slide:1.18 }],
  ],
  (s, step) => [
    ['burst', 0.07, 2100 + s*220, 0.075, { type:'bandpass' }],
    ['tone', 175 + s*15, 0.06, { type:'triangle', vol:0.085, attack:0.002, when:0.05, slide:0.65 }],
    ['tone', 540 + step*35, 0.07, { type:'sine', vol:0.045, attack:0.005, when:0.055, slide:1.08 }],
  ],
];
export const audio = {
  start(){ if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
    // やまびこ（チャイムや花火用）
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.38; dl.connect(fb); fb.connect(dl); dl.connect(master); L.echo = dl;
    // 波
    { const n = noise(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; const g = ctx.createGain(); g.gain.value = 0; const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13; const lg = ctx.createGain(); lg.gain.value = 0.5; const g2 = ctx.createGain(); g2.gain.value = 0.55;
      lfo.connect(lg); lg.connect(g2.gain); lfo.start(); n.connect(f); f.connect(g2); g2.connect(g); g.connect(master); L.wave = g; }
    // 昼の蝉（ジー…という持続音＋ミンミンのうねり）
    { const n = noise(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 7; const am = ctx.createGain(); am.gain.value = 0.5; const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 86; const og = ctx.createGain(); og.gain.value = 0.5; o.connect(og); og.connect(am.gain); o.start();
      const slow = ctx.createOscillator(); slow.frequency.value = 0.9; const sg = ctx.createGain(); sg.gain.value = 0.35; const g2 = ctx.createGain(); g2.gain.value = 0.6; slow.connect(sg); sg.connect(g2.gain); slow.start();
      const g = ctx.createGain(); g.gain.value = 0; n.connect(f); f.connect(am); am.connect(g2); g2.connect(g); g.connect(master); L.cicada = g; L.cicadaF = f; L.cicadaSlow = slow; }
    // 夜の虫
    { const o = ctx.createOscillator(); o.frequency.value = 4300; const am = ctx.createGain(); am.gain.value = 0; const tr = ctx.createOscillator(); tr.type = 'square'; tr.frequency.value = 28; const tg = ctx.createGain(); tg.gain.value = 0.5; tr.connect(tg); tg.connect(am.gain); tr.start();
      const slow = ctx.createOscillator(); slow.type = 'square'; slow.frequency.value = 0.7; const g2 = ctx.createGain(); g2.gain.value = 0.5; const sg = ctx.createGain(); sg.gain.value = 0.5; slow.connect(sg); sg.connect(g2.gain); slow.start();
      const g = ctx.createGain(); g.gain.value = 0; o.connect(am); am.connect(g2); g2.connect(g); g.connect(master); o.start(); L.cricket = g; }
    // 風
    { const n = noise(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 0.6; const g = ctx.createGain(); g.gain.value = 0; n.connect(f); f.connect(g); g.connect(master); L.wind = g; }
    // 葉擦れ（日陰の涼気用：柔らかな高域ノイズ＋ゆるやかな揺らぎ）
    { const n = noise(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2100; f.Q.value = 1.0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.38; const lg = ctx.createGain(); lg.gain.value = 0.35;
      const am = ctx.createGain(); am.gain.value = 0.65; lfo.connect(lg); lg.connect(am.gain); lfo.start();
      const g = ctx.createGain(); g.gain.value = 0; n.connect(f); f.connect(am); am.connect(g); g.connect(master); L.rustle = g; }
    this.nextHigu = 0; this.nextBgm = 0; this.nextChime = 0; this.bgmI = 0;
  },
  tone(freq, dur, { type='sine', vol=0.2, attack=0.01, when=0, echo=false, slide=0 }={}){ if (!ctx) return; const t = ctx.currentTime + when; const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq*slide, t+dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t+attack); g.gain.exponentialRampToValueAtTime(0.0005, t+dur); o.connect(g); g.connect(master); if (echo) g.connect(L.echo); o.start(t); o.stop(t+dur+0.05); },
  burst(dur, freq, vol, { when=0, type='lowpass', echo=false }={}){ if (!ctx) return; const t = ctx.currentTime + when; const n = ctx.createBufferSource(); n.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t+dur); n.connect(f); f.connect(g); g.connect(master); if (echo) g.connect(L.echo); n.start(t, Math.random()); n.stop(t+dur+0.05); },
  engine(v, on){ if (!ctx) return; if (!L.eng){ const o = ctx.createOscillator(); o.type = 'sawtooth'; const o2 = ctx.createOscillator(); o2.type = 'square'; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; const g = ctx.createGain(); g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start(); L.eng = { o, o2, g }; }
    const fq = 46 + v*7.5; L.eng.o.frequency.setTargetAtTime(fq, ctx.currentTime, 0.08); L.eng.o2.frequency.setTargetAtTime(fq*0.5, ctx.currentTime, 0.08); L.eng.g.gain.setTargetAtTime(on ? 0.035 + Math.min(0.04, v*0.003) : 0, ctx.currentTime, 0.12); },
  // 原付（moped）専用の合成エンジン音（速度とギア段階に応じた回転数変化）
  mopedEngine(v, on = true, opt = {}){
    if (!ctx) return;
    if (!L.moped){
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'triangle';
      const o3 = ctx.createOscillator(); o3.type = 'square';
      const o3g = ctx.createGain(); o3g.gain.value = 0.18;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(f); o2.connect(f); o3.connect(o3g); o3g.connect(f); f.connect(g); g.connect(master);
      o.start(); o2.start(); o3.start();
      L.moped = { o, o2, o3, f, g };
    }
    const p = computeMopedEngineParams(v, on, opt);
    const t = ctx.currentTime;
    L.moped.o.frequency.setTargetAtTime(p.freq, t, 0.06);
    L.moped.o2.frequency.setTargetAtTime(p.freq * 0.5, t, 0.06);
    L.moped.o3.frequency.setTargetAtTime(p.freq * 2.0, t, 0.06);
    L.moped.f.frequency.setTargetAtTime(p.cutoff, t, 0.07);
    L.moped.g.gain.setTargetAtTime(p.gain, t, p.active ? 0.06 : 0.02);
  },
  // 乗車中の風切り音（ホワイトノイズのバンドパス合成音）
  rideWind(v, on = true){
    if (!ctx) return;
    if (!L.rideWind){
      const n = noise();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 280; f.Q.value = 0.85;
      const g = ctx.createGain(); g.gain.value = 0;
      n.connect(f); f.connect(g); g.connect(master);
      L.rideWind = { f, g };
    }
    const p = computeRideWindParams(v, on);
    const t = ctx.currentTime;
    L.rideWind.f.frequency.setTargetAtTime(p.freq, t, 0.08);
    L.rideWind.f.Q.setTargetAtTime(p.q, t, 0.08);
    L.rideWind.g.gain.setTargetAtTime(p.gain, t, p.active ? 0.09 : 0.015);
  },
  // 自転車・原付の急減速時の軽いタイヤ擦過音
  bikeSkid(surf = 'road', speed = 8){
    if (!ctx) return;
    const hard = surf === 'road' || surf === 'wood';
    const freq = (hard ? 2250 : 1200) + Math.random() * 280;
    const dur = hard ? 0.085 : 0.105;
    const vol = Math.min(0.06, 0.028 + Math.max(0, speed - 6.5) * 0.003) * (hard ? 1 : 1.08);
    this.burst(dur, freq, vol, { type:'bandpass' });
  },
  step(swim, surf = 'dirt', indoor = false){
    if (swim === true){ this.burst(0.25, 900, 0.07); return; }
    const k = typeof swim === 'string' ? swim : surf;
    const s = SURF_STEP[k] || SURF_STEP.dirt;
    const p = 0.94 + Math.random()*0.12, vol = s.vol*(indoor ? 0.85 : 1);
    this.burst(s.dur, s.freq*p, vol, { type:s.type });
    if (s.tap) this.tone(s.tap*p, 0.035, { type:'triangle', vol:indoor ? 0.014 : 0.018 });
  },
  land(surf = 'dirt', v = 6, indoor = false){
    const s = SURF_LAND[surf] || SURF_LAND.dirt;
    const base = Math.min(0.22, v*0.022)*s.vol*(indoor ? 0.72 : 1);
    this.burst(s.dur, s.freq, base, { type:s.type });
    if (s.tap) this.tone(s.tap, 0.055, { type:'triangle', vol:base*0.25 });
  },
  blip(){ this.tone(880, 0.04, { type:'square', vol:0.02 }); },
  select(){ this.tone(660, 0.09, { type:'triangle', vol:0.12 }); this.tone(990, 0.12, { type:'triangle', vol:0.1, when:0.07 }); },
  // シャッター音＋フィルム巻き上げの合成音
  shutter(){
    if (!ctx) return;
    // 先幕・後幕の歯切れよいシャッター音
    this.burst(0.018, 4200, 0.28, { type:'highpass' });
    this.tone(180, 0.025, { type:'triangle', vol:0.14, attack:0.002, slide:0.55 });
    this.burst(0.024, 3400, 0.22, { type:'bandpass', when:0.045 });
    this.tone(240, 0.022, { type:'triangle', vol:0.09, attack:0.002, when:0.045, slide:0.65 });
    // フィルム巻き上げ（歯車の刻み＋巻き止め）
    for (let i = 0; i < 5; i++){
      const w = 0.15 + i * 0.03;
      this.burst(0.015, 2500 + i * 160, 0.075, { type:'bandpass', when:w });
      this.tone(620 + i * 35, 0.018, { type:'triangle', vol:0.036, attack:0.002, when:w, slide:0.82 });
    }
    this.burst(0.018, 1900, 0.09, { type:'bandpass', when:0.32 });
  },
  pickup(){ [1320, 1760, 2640].forEach((f, i) => this.tone(f, 0.25, { vol:0.09, when:i*0.07 })); },
  // 文化祭準備の手作業音（紙・ハサミ／はけ・木板／お花紙・黒板／木枠・提灯／布・木枠）
  prepStep(taskIdx, step = 1){
    if (!ctx) return;
    const fn = PREP_SOUND[taskIdx] || PREP_SOUND[0];
    for (const [kind, a, b, c, opt] of fn(step % 4, step)){
      if (kind === 'burst') this.burst(a, b, c, opt);
      else this.tone(a, b, c);
    }
  },
  // 文化祭準備の1タスク完了時の達成音（心地よい3音）
  prepDone(){
    if (!ctx) return;
    [[523.25, 0.24, 0], [659.25, 0.24, 0.085], [783.99, 0.42, 0.17]].forEach(([f, dur, when]) => {
      this.tone(f, dur, { type:'triangle', vol:0.08, attack:0.006, when, echo:true });
    });
  },
  // 釣りの予兆（微かな水音）と引き上げ成功音
  fishNibble(){ if (!ctx) return; this.burst(0.045, 1400 + Math.random()*300, 0.045, { type:'bandpass' }); this.tone(320 + Math.random()*50, 0.06, { vol:0.032, slide:0.72 }); },
  fishCatch(){ if (!ctx) return; this.burst(0.28, 750, 0.22); this.burst(0.36, 2200, 0.12, { type:'highpass', when:0.03 }); this.tone(240, 0.14, { type:'triangle', vol:0.12, slide:1.85 }); [1046.5, 1318.5, 1568].forEach((f, i) => this.tone(f, 0.24, { vol:0.085, when:0.05 + i*0.06 })); },
  // セミ捕獲・水切り・カニさがしの音
  bugCatch(){ if (!ctx) return; [987.77, 1318.5, 1661.2, 1975.5].forEach((f, i) => this.tone(f, 0.2, { type:'triangle', vol:0.08, when:i*0.055 })); },
  skipCue(){ if (!ctx) return; this.tone(980, 0.05, { type:'triangle', vol:0.045, slide:1.12 }); },
  skipBounce(i){ if (!ctx) return; const f = 760*Math.pow(1.075, i); this.tone(f, 0.075, { vol:0.09, slide:1.22 }); this.tone(f*1.5, 0.055, { type:'triangle', vol:0.045, when:0.01 }); this.burst(0.05, Math.min(5500, 2200 + i*220), 0.055, { type:'highpass' }); },
  crabScuttle(near=0.5){ if (!ctx) return; const v = 0.028 + near*0.026; this.burst(0.022, 3200 + Math.random()*800, v, { type:'bandpass' }); this.burst(0.022, 4000 + Math.random()*900, v*0.85, { type:'bandpass', when:0.045 }); },
  crabCatch(){ if (!ctx) return; [880, 1174.7, 1480, 1760].forEach((f, i) => this.tone(f, 0.22, { vol:0.085, when:i*0.055 })); },
  // 自宅・店先の涼やかなガラス風鈴の合成音（うなり＋非整数倍音＋時々の揺り返し）
  furin(volScale = 1){
    if (!ctx || volScale <= 0) return;
    const f = 2280 + Math.random()*540, v = 0.055*volScale;
    this.tone(f, 1.75, { type:'sine', vol:v, attack:0.004, echo:true });
    this.tone(f*1.005, 1.65, { type:'sine', vol:v*0.55, attack:0.005 });
    this.tone(f*2.756, 0.95, { type:'sine', vol:v*0.32, attack:0.003 });
    if (Math.random() < 0.35){
      const w = 0.18 + Math.random()*0.12, f2 = f*(0.99 + Math.random()*0.03);
      this.tone(f2, 1.35, { type:'sine', vol:v*0.55, attack:0.004, when:w, echo:true });
      this.tone(f2*2.756, 0.75, { type:'sine', vol:v*0.18, attack:0.003, when:w });
    }
  },
  // 17時の時報チャイム（遠くから柔らかく響く短い減衰サイン波和音のみ。BGMではない環境時報）
  eveningChime(){
    if (!ctx) return;
    const notes = [[392.00, 0.0], [523.25, 0.52], [659.25, 1.04], [523.25, 1.56]];
    for (const [f, when] of notes) this.tone(f, 1.7, { type:'sine', vol:0.048, attack:0.05, when, echo:true });
    this.tone(392.00, 2.2, { type:'sine', vol:0.032, attack:0.06, when:1.56, echo:true });
  },
  chime(){ const E=659.25, C=523.25, D=587.33, G=392.0; [[E,C,D,G],[C,D,E,C],[E,C,D,G],[G,D,E,C]].forEach((p, i) => p.forEach((f, j) => { const w = i*3.4 + j*0.7; this.tone(f, 1.9, { vol:0.11, when:w, echo:true, attack:0.005 }); this.tone(f*2, 1.2, { vol:0.03, when:w, echo:true }); })); },
  higurashi(){ const base = 3700 + Math.random()*300; for (let i=0;i<14;i++){ const w = i*(0.17 - i*0.004); this.tone(base*(1 - i*0.012), 0.13, { vol:0.045*(1 - i/18), when:w, echo:true }); } },
  bird(sea){ if (!ctx) return; if (sea){ const f = 1450 + Math.random()*250; this.tone(f, 0.36, { vol:0.035, slide:1.25, echo:true }); this.tone(f*1.12, 0.42, { vol:0.028, when:0.42, slide:0.88, echo:true }); }
    else { const f = 2200 + Math.random()*600; for (let i = 0; i < 3; i++) this.tone(f*(1 + i*0.08), 0.08, { vol:0.032, when:i*0.11, slide:1.25, echo:true }); } },
  tsuku(){ if (!ctx) return; const b = 4100 + Math.random()*200; for (let i = 0; i < 4; i++){ const w = i*0.42; this.tone(b, 0.11, { vol:0.025, when:w, slide:0.88 }); this.tone(b*0.84, 0.15, { vol:0.022, when:w + 0.13, slide:1.12 }); }
    this.tone(b*0.76, 0.38, { vol:0.02, when:1.7, slide:0.82 }); },
  suzumushi(){ if (!ctx) return; const f = 4650 + Math.random()*150; for (let i = 0; i < 6; i++) this.tone(f, 0.09, { vol:0.014, when:i*0.14 }); },
  firework(){ this.tone(900, 0.9, { vol:0.03, slide:2.2 }); this.burst(1.6, 220, 0.9, { when:0.95, echo:true }); this.burst(1.2, 5000, 0.12, { when:1.3, type:'highpass' }); },
  // 窓ガラスが割れる音（連続発音時は音割れ防止のため抑える）
  glass(vol = 1){
    if (!ctx || vol <= 0) return;
    const t = ctx.currentTime;
    if (this.lastGlass !== undefined && t - this.lastGlass < 0.06) vol *= 0.45;
    this.lastGlass = t;
    this.burst(0.09, 4200, 0.32*vol, { type:'highpass' });
    this.burst(0.22, 2600, 0.22*vol, { type:'bandpass', when:0.015, echo:true });
    const pings = [
      [3280, 0.18, 0.02, 0.065, true],
      [4120, 0.24, 0.055, 0.07, false],
      [5240, 0.15, 0.09, 0.05, false],
      [3640, 0.28, 0.14, 0.055, true],
      [4760, 0.21, 0.19, 0.04, false],
      [5120, 0.16, 0.24, 0.032, false],
    ];
    for (const [f, dur, when, v, echo] of pings){
      this.tone(f*(0.98 + Math.random()*0.04), dur, { vol:v*vol, when, slide:0.96, echo });
    }
  },
  bgmNote(){ const scale = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99]; const pat = [0,2,4,5, 4,2,3,1, 0,3,5,7, 6,4,2,4]; const f = scale[pat[this.bgmI % pat.length]]; this.bgmI++;
    this.tone(f, 2.4, { type:'triangle', vol:0.07, attack:0.02, echo:true }); if (this.bgmI % 4 === 1) this.tone(f/2, 3.2, { type:'sine', vol:0.06, attack:0.05 }); },
  // 毎フレーム：状況に合わせて各音の大きさを変える
  // 雨と強い風の音（ノイズを鳴らしっぱなしにして音量だけ変える）
  rain(v, wind=0){ if (!ctx) return; if (!L.rain){ const mk = (type, f, q) => { const n = noise(), fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; n.connect(fl); fl.connect(g); g.connect(master); return g; };
      L.rain = mk('highpass', 1100, 0.5); L.gale = mk('bandpass', 380, 0.8); }
    gainTo(L.rain, v*0.16, 0.6); gainTo(L.gale, wind*0.12*(0.7 + 0.3*Math.sin(ctx.currentTime*0.9)), 0.4); },
  update(s){ if (!ctx) return; const t = ctx.currentTime; const eve = s.hour >= 16.6 && s.hour < 19.2, night = s.hour >= 19 || s.hour < 5;
    const amb = computeAmbienceBalance(s);
    gainTo(L.wave, s.indoor ? 0.03 : Math.max(0.025, 0.42*s.coast));
    gainTo(L.cicada, amb.cicadaGain);
    if (L.cicadaSlow) L.cicadaSlow.frequency.setTargetAtTime(amb.cicadaSlow, t, 0.15);
    if (L.cicadaF){ L.cicadaF.frequency.setTargetAtTime(amb.cicadaFreq, t, 0.25); L.cicadaF.Q.setTargetAtTime(amb.cicadaQ, t, 0.25); }
    gainTo(L.cricket, night && !s.indoor ? 0.012 : 0);
    gainTo(L.wind, amb.windGain);
    if (L.rustle) gainTo(L.rustle, amb.rustleGain, 0.6);
    if (eve && !s.quiet && t > this.nextHigu){ this.higurashi(); this.nextHigu = t + 3 + Math.random()*6; }
    if (s.hour > 5.8 && s.hour < 9.2 && !s.quiet && !s.indoor && t > (this.nextBird || 0)){ this.bird(s.coast > 0.55); this.nextBird = t + 5 + Math.random()*8; }
    if ((s.day || 0) >= 6 && s.hour > 13 && s.hour < 16.8 && !s.quiet && s.coast < 0.6 && t > (this.nextTsuku || 0)){ this.tsuku(); this.nextTsuku = t + 9 + Math.random()*12; }
    if (night && !s.quiet && !s.indoor && t > (this.nextSuzu || 0)){ this.suzumushi(); this.nextSuzu = t + 5 + Math.random()*8; }
    const furinSch = computeFurinSchedule(s.wind || 0, s.weatherKind || 'clear', !!s.indoor);
    if (s.furin && furinSch.allow && t > (this.nextFurin || 0)){ this.furin(furinSch.vol); this.nextFurin = t + furinSch.minWait + Math.random()*(furinSch.maxWait - furinSch.minWait); }
    /* BGMは鳴らさない（環境音だけ） */ },
};
