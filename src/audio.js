// 環境音とBGMをWeb Audioで合成する（音声ファイルは使わない）
let ctx = null, master, noiseBuf; const L = {};
function noise(){ const b = ctx.createBufferSource(); b.buffer = noiseBuf; b.loop = true; b.start(); return b; }
function gainTo(g, v, t=0.8){ g.gain.setTargetAtTime(v, ctx.currentTime, t); }
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
      const g = ctx.createGain(); g.gain.value = 0; n.connect(f); f.connect(am); am.connect(g2); g2.connect(g); g.connect(master); L.cicada = g; }
    // 夜の虫
    { const o = ctx.createOscillator(); o.frequency.value = 4300; const am = ctx.createGain(); am.gain.value = 0; const tr = ctx.createOscillator(); tr.type = 'square'; tr.frequency.value = 28; const tg = ctx.createGain(); tg.gain.value = 0.5; tr.connect(tg); tg.connect(am.gain); tr.start();
      const slow = ctx.createOscillator(); slow.type = 'square'; slow.frequency.value = 0.7; const g2 = ctx.createGain(); g2.gain.value = 0.5; const sg = ctx.createGain(); sg.gain.value = 0.5; slow.connect(sg); sg.connect(g2.gain); slow.start();
      const g = ctx.createGain(); g.gain.value = 0; o.connect(am); am.connect(g2); g2.connect(g); g.connect(master); o.start(); L.cricket = g; }
    // 風
    { const n = noise(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 0.6; const g = ctx.createGain(); g.gain.value = 0; n.connect(f); f.connect(g); g.connect(master); L.wind = g; }
    this.nextHigu = 0; this.nextBgm = 0; this.nextChime = 0; this.bgmI = 0;
  },
  tone(freq, dur, { type='sine', vol=0.2, attack=0.01, when=0, echo=false, slide=0 }={}){ if (!ctx) return; const t = ctx.currentTime + when; const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq*slide, t+dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t+attack); g.gain.exponentialRampToValueAtTime(0.0005, t+dur); o.connect(g); g.connect(master); if (echo) g.connect(L.echo); o.start(t); o.stop(t+dur+0.05); },
  burst(dur, freq, vol, { when=0, type='lowpass', echo=false }={}){ if (!ctx) return; const t = ctx.currentTime + when; const n = ctx.createBufferSource(); n.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t+dur); n.connect(f); f.connect(g); g.connect(master); if (echo) g.connect(L.echo); n.start(t, Math.random()); n.stop(t+dur+0.05); },
  engine(v, on){ if (!ctx) return; if (!L.eng){ const o = ctx.createOscillator(); o.type = 'sawtooth'; const o2 = ctx.createOscillator(); o2.type = 'square'; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; const g = ctx.createGain(); g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start(); L.eng = { o, o2, g }; }
    const fq = 46 + v*7.5; L.eng.o.frequency.setTargetAtTime(fq, ctx.currentTime, 0.08); L.eng.o2.frequency.setTargetAtTime(fq*0.5, ctx.currentTime, 0.08); L.eng.g.gain.setTargetAtTime(on ? 0.035 + Math.min(0.04, v*0.003) : 0, ctx.currentTime, 0.12); },
  step(swim){ swim ? this.burst(0.25, 900, 0.07) : this.burst(0.07, 1400, 0.05, { type:'bandpass' }); },
  blip(){ this.tone(880, 0.04, { type:'square', vol:0.02 }); },
  select(){ this.tone(660, 0.09, { type:'triangle', vol:0.12 }); this.tone(990, 0.12, { type:'triangle', vol:0.1, when:0.07 }); },
  shutter(){ this.burst(0.05, 3000, 0.25, { type:'highpass' }); this.burst(0.08, 2000, 0.2, { type:'highpass', when:0.09 }); },
  pickup(){ [1320, 1760, 2640].forEach((f, i) => this.tone(f, 0.25, { vol:0.09, when:i*0.07 })); },
  furin(){ const f = 2300 + Math.random()*500; this.tone(f, 1.6, { vol:0.07 }); this.tone(f*2.76, 0.9, { vol:0.025 }); },
  chime(){ const E=659.25, C=523.25, D=587.33, G=392.0; [[E,C,D,G],[C,D,E,C],[E,C,D,G],[G,D,E,C]].forEach((p, i) => p.forEach((f, j) => { const w = i*3.4 + j*0.7; this.tone(f, 1.9, { vol:0.11, when:w, echo:true, attack:0.005 }); this.tone(f*2, 1.2, { vol:0.03, when:w, echo:true }); })); },
  higurashi(){ const base = 3700 + Math.random()*300; for (let i=0;i<14;i++){ const w = i*(0.17 - i*0.004); this.tone(base*(1 - i*0.012), 0.13, { vol:0.045*(1 - i/18), when:w, echo:true }); } },
  bird(sea){ if (!ctx) return; if (sea){ const f = 1450 + Math.random()*250; this.tone(f, 0.36, { vol:0.035, slide:1.25, echo:true }); this.tone(f*1.12, 0.42, { vol:0.028, when:0.42, slide:0.88, echo:true }); }
    else { const f = 2200 + Math.random()*600; for (let i = 0; i < 3; i++) this.tone(f*(1 + i*0.08), 0.08, { vol:0.032, when:i*0.11, slide:1.25, echo:true }); } },
  tsuku(){ if (!ctx) return; const b = 4100 + Math.random()*200; for (let i = 0; i < 4; i++){ const w = i*0.42; this.tone(b, 0.11, { vol:0.025, when:w, slide:0.88 }); this.tone(b*0.84, 0.15, { vol:0.022, when:w + 0.13, slide:1.12 }); }
    this.tone(b*0.76, 0.38, { vol:0.02, when:1.7, slide:0.82 }); },
  suzumushi(){ if (!ctx) return; const f = 4650 + Math.random()*150; for (let i = 0; i < 6; i++) this.tone(f, 0.09, { vol:0.014, when:i*0.14 }); },
  firework(){ this.tone(900, 0.9, { vol:0.03, slide:2.2 }); this.burst(1.6, 220, 0.9, { when:0.95, echo:true }); this.burst(1.2, 5000, 0.12, { when:1.3, type:'highpass' }); },
  bgmNote(){ const scale = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99]; const pat = [0,2,4,5, 4,2,3,1, 0,3,5,7, 6,4,2,4]; const f = scale[pat[this.bgmI % pat.length]]; this.bgmI++;
    this.tone(f, 2.4, { type:'triangle', vol:0.07, attack:0.02, echo:true }); if (this.bgmI % 4 === 1) this.tone(f/2, 3.2, { type:'sine', vol:0.06, attack:0.05 }); },
  // 毎フレーム：状況に合わせて各音の大きさを変える
  // 雨と強い風の音（ノイズを鳴らしっぱなしにして音量だけ変える）
  rain(v, wind=0){ if (!ctx) return; if (!L.rain){ const mk = (type, f, q) => { const n = noise(), fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; n.connect(fl); fl.connect(g); g.connect(master); return g; };
      L.rain = mk('highpass', 1100, 0.5); L.gale = mk('bandpass', 380, 0.8); }
    gainTo(L.rain, v*0.16, 0.6); gainTo(L.gale, wind*0.12*(0.7 + 0.3*Math.sin(ctx.currentTime*0.9)), 0.4); },
  update(s){ if (!ctx) return; const t = ctx.currentTime; const day = s.hour > 6.5 && s.hour < 17.6, eve = s.hour >= 16.6 && s.hour < 19.2, night = s.hour >= 19 || s.hour < 5;
    gainTo(L.wave, s.indoor ? 0.03 : Math.max(0.025, 0.42*s.coast)); gainTo(L.cicada, (day ? 0.05 : 0) * (s.indoor ? 0.45 : 1) * (1 - s.coast*0.7) * (s.quiet ? 0.3 : 1));
    gainTo(L.cricket, night && !s.indoor ? 0.012 : 0); gainTo(L.wind, s.indoor ? 0 : 0.02 + s.high*0.06);
    if (eve && !s.quiet && t > this.nextHigu){ this.higurashi(); this.nextHigu = t + 3 + Math.random()*6; }
    if (s.hour > 5.8 && s.hour < 9.2 && !s.quiet && !s.indoor && t > (this.nextBird || 0)){ this.bird(s.coast > 0.55); this.nextBird = t + 5 + Math.random()*8; }
    if ((s.day || 0) >= 6 && s.hour > 13 && s.hour < 16.8 && !s.quiet && s.coast < 0.6 && t > (this.nextTsuku || 0)){ this.tsuku(); this.nextTsuku = t + 9 + Math.random()*12; }
    if (night && !s.quiet && !s.indoor && t > (this.nextSuzu || 0)){ this.suzumushi(); this.nextSuzu = t + 5 + Math.random()*8; }
    if (s.furin && t > (this.nextFurin||0)){ this.furin(); this.nextFurin = t + 2 + Math.random()*7; }
    /* BGMは鳴らさない（環境音だけ） */ },
};
