import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { tex, TEXTURES, ALPHA } from './assets.js';
// Blenderから書き出した glb を読み込む。なければ仮の箱を返す。
const loader = new GLTFLoader(); const lib = {};
export const MODEL_NAMES = ['boy','grass-tuft','fan','kouta','nagisa','kotoha','granny','school','gym','classroom','house','house2','shop','tree-round','tree-pine','tree-palm','bush','pole','statue','torii','shrine','onsen','lookout','pier','boat','bike','bench','vending','busstop','lighthouse','fence','gate','surfboard','goal','tetrapod','laundry','shell','ramune','wall','hedge','postbox','mirror','firetower','noticeboard','planter','hibiscus','stopsign','keitruck','house3','house4','shed','gomi','cat','cat2','fishrack','guardrail','field','oneesan','terminal','plane','maingate','windsock','ojisan','home-in','shop-in','terminal-in','mother','father','sister','school-in','sdesk','schair','school-props','umbrella','bugnet','ukiwa','strawhat','moped'];
export async function loadModels(){
  await Promise.all(MODEL_NAMES.map(n => new Promise(res => loader.load(`models/${n}.glb`, g => { prep(g.scene); lib[n] = g.scene; res(); }, undefined, () => res()))));
}
const matCache = {};
// 夜になると灯る面（窓・自販機・提灯・灯台）
const LIT = /^(window-glass|house-front|house-front2|shop-front|vending|lh-lamp|lantern|lampshade|desklamp|light-panel)$/;
let nightNow = -1;
export const extraLit = [];
export const NIGHT_UNI = { value:0 };
const delayedLit = [];
const delayedMatCache = new WeakMap();
// 建物ごとの時間差点灯カーブ（offset は 0..0.55 の実行時オフセット）
export function computeBuildingNight(k, offset = 0, span = 0.18){
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const u = Math.max(0, Math.min(1, (k - offset)/span));
  return u*u*(3 - 2*u);
}
export function registerDelayedLit(mat, off = 0){
  delayedLit.push({ mat, off });
  return mat;
}
// インスタンス化される建物用：aLitOff 属性で建物ごとにわずかな時間差をつけて灯す
export function litDelayed(mat){
  if (!LIT.test(mat.name)) return mat;
  if (delayedMatCache.has(mat)) return delayedMatCache.get(mat);
  const m = mat.clone(); m.name = mat.name; m.emissiveIntensity = m.map ? 0.75 : 1.0;
  m.onBeforeCompile = sh => {
    sh.uniforms.uNight = NIGHT_UNI;
    sh.vertexShader = 'uniform float uNight; attribute float aLitOff; varying float vLitK;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float uLit = clamp((uNight - aLitOff) / 0.18, 0.0, 1.0);
      vLitK = uNight <= 0.0 ? 0.0 : (uNight >= 1.0 ? 1.0 : uLit * uLit * (3.0 - 2.0 * uLit));`);
    sh.fragmentShader = 'varying float vLitK;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance *= vLitK;`);
  };
  m.customProgramCacheKey = () => 'lit-delayed';
  delayedMatCache.set(mat, m);
  return m;
}
// 風：草や木の葉を、高いところほど大きく揺らす（頂点シェーダーで動かす。amp は揺れの強さ）
export const WIND = { value:0 };
const swayCache = {};
export function sway(mat, amp){ const key = mat.uuid + '|' + amp; if (swayCache[key]) return swayCache[key]; const m = mat.clone(); m.name = mat.name;
  m.onBeforeCompile = sh => { sh.uniforms.uWind = WIND; sh.uniforms.uAmp = { value:amp };
    sh.vertexShader = 'uniform float uWind; uniform float uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
      #else
        vec3 ip = modelMatrix[3].xyz;
      #endif
      float hk = max(position.y, 0.0); hk *= hk;
      float ph = uWind*1.7 + ip.x*0.31 + ip.z*0.23;
      transformed.x += (sin(ph) + 0.45*sin(ph*2.3 + 1.7))*hk*uAmp;
      transformed.z += (cos(ph*0.8) + 0.3*sin(ph*1.9))*hk*uAmp*0.6;`); };
  m.customProgramCacheKey = () => 'sway' + amp; swayCache[key] = m; return m; }   // 複製した灯りの材質（校舎の中の蛍光灯など）
export function setNight(k){
  if (k === nightNow) return;
  if (k !== 0 && k !== 1 && Math.abs(k - nightNow) < 0.02) return;
  nightNow = k; NIGHT_UNI.value = k;
  for (const m of [...Object.values(matCache), ...extraLit]){ if (LIT.test(m.name)) m.emissiveIntensity = k*(m.map ? 0.75 : 1.0) + (/lh-lamp|lantern/.test(m.name) ? 0.25 : 0); }
  for (const d of delayedLit){ const bk = computeBuildingNight(k, d.off); d.mat.emissiveIntensity = bk*(d.mat.map ? 0.75 : 1.0); }
}
function prep(root){
  root.traverse(o => { if (!o.isMesh) return; const src = o.material; const name = src.name.replace(/\.\d+$/, ''); const key = name + '|' + src.color.getHexString();
    let m = matCache[key];
    // 面はすべて両面にする（片面だと、裏から見たときに壁や床が消えて向こうが透けて見える）
    if (!m){ m = new THREE.MeshLambertMaterial({ color: src.color.clone(), side:THREE.DoubleSide }); m.name = name;
      if (TEXTURES.has(name)){ m.map = tex(name, { flipY:false }); m.color.set(0xffffff); }
      if (ALPHA.has(name)){ m.alphaTest = 0.45; m.side = THREE.DoubleSide; }
      if (/-ds$|skirt|cloth-apron|^eave$/.test(name)) m.side = THREE.DoubleSide;
      if (/-alpha$/.test(name)){ m.side = THREE.DoubleSide; m.transparent = true; if (ALPHA.has(name)){ m.alphaTest = 0.2; } else { m.opacity = 0.3; m.depthWrite = false; } }
      if (name === 'water'){ m.transparent = true; m.opacity = 0.8; }
      if (LIT.test(name)){ if (m.map) m.emissiveMap = m.map; m.emissive.setRGB(1, 0.76, 0.46); m.emissiveIntensity = 0; }
      matCache[key] = m; }
    o.material = m; });
}
export function has(name){ return !!lib[name]; }
export function model(name, size=[2,2,2], color=0xb0a898){
  if (lib[name]) return lib[name].clone(true);
  const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshLambertMaterial({color})); m.position.y = size[1]/2; g.add(m); return g;
}

// ---- キャラクター：関節ごとのパーツを回して動かす ----
const PARTS = ['hips','torso','head','armL','foreL','armR','foreR','legL','shinL','legR','shinR'];
function boxPart(w,h,d,color,py){ const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshLambertMaterial({color})); m.position.y = py; return m; }
function fallbackChar(opt){
  const skin=0xf0c8a0, top=opt.top||0xf4f4f0, bot=opt.bottom||0x2b3350, hair=opt.hair||0x2a2018;
  const n = {}; const mk = (name, parent, x,y,z)=>{ const g = new THREE.Group(); g.name=name; g.position.set(x,y,z); parent.add(g); n[name]=g; return g; };
  const root = new THREE.Group();
  mk('hips', root, 0,0.86,0).add(boxPart(0.3,0.2,0.18,bot,0));
  mk('torso', n.hips, 0,0.1,0).add(boxPart(0.32,0.42,0.19,top,0.21));
  mk('head', n.torso, 0,0.45,0).add(boxPart(0.21,0.23,0.21,skin,0.13), boxPart(0.23,0.12,0.23,hair,0.22));
  for (const [s,sx] of [['L',1],['R',-1]]){
    mk('arm'+s, n.torso, 0.2*sx,0.38,0).add(boxPart(0.09,0.28,0.09,top,-0.14));
    mk('fore'+s, n['arm'+s], 0,-0.28,0).add(boxPart(0.08,0.27,0.08,skin,-0.135));
    mk('leg'+s, n.hips, 0.085*sx,-0.08,0).add(boxPart(0.12,0.4,0.12,bot,-0.2));
    mk('shin'+s, n['leg'+s], 0,-0.4,0).add(boxPart(0.1,0.4,0.1,opt.girl?skin:bot,-0.2));
  }
  return root;
}
const TV = new THREE.Vector3();
export class Character {
  constructor(opt={}){
    this.root = new THREE.Group();
    const base = opt.model && lib[opt.model] ? lib[opt.model].clone(true) : fallbackChar(opt);
    if (opt.model && lib[opt.model] && opt.tint) base.traverse(o=>{ if (o.isMesh && opt.tint[o.material.name]){ o.material = o.material.clone(); if (opt.tint[o.material.name].map) o.material.map = opt.tint[o.material.name].map; else o.material.color.set(opt.tint[o.material.name]); } });
    this.root.add(base); this.base = base; this.n = {}; base.traverse(o => { if (PARTS.includes(o.name)) this.n[o.name] = o; });
    this.rest = {}; for (const k in this.n) this.rest[k] = this.n[k].position.clone();
    // 腰はそのままに、座ると裾が太ももに沿って折り上がる。複製した人物同士で形状を共有しない。
    this.seatedCloth = []; this.sitBlend = 0;
    base.traverse(o => { if (!o.isMesh || !/^(skirt-pleats|cloth-apron)$/.test(o.material.name)) return;
      o.geometry = o.geometry.clone();
      const pos = o.geometry.attributes.position; pos.setUsage(THREE.DynamicDrawUsage);
      let waist = -Infinity; for (let i=0;i<pos.count;i++) waist = Math.max(waist, pos.getY(i));
      this.seatedCloth.push({ geo:o.geometry, rest:pos.array.slice(), normals:o.geometry.attributes.normal.array.slice(), waist, pivot:this.rest.legL?.y ?? -0.08 });
    });
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.38, 10).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0.32, depthWrite:false}));
    sh.position.y = 0.04; this.root.add(sh); this.shadow = sh;
    this.state = 'idle'; this.t = Math.random()*10; this.speed = 0; this.blend = {}; this.photoArm = false; this.photoHeadYaw = null;
  }
  set(state){ this.state = state; }
  // からだ全体を回す（宙返り・受け身・吹っ飛び）。rx は前まわり、rz は横まわり。回転の中心は腰のあたり（足もとから c）。
  // lie を 1 にすると、寝た姿勢でも地面より下にもぐらないよう、からだを下げる
  setTumble(rx = 0, rz = 0, lie = 0){ const b = this.base, c = 0.55; b.rotation.set(rx, 0, rz); TV.set(0, c, 0).applyEuler(b.rotation); b.position.set(-TV.x, c - TV.y - lie*(c - 0.14)*Math.max(Math.abs(Math.sin(rx)), Math.abs(Math.sin(rz))), -TV.z); }
  // はだし：靴の面を肌の色にする（足湯につかるとき）
  setBarefoot(on){ if (this.barefoot === on) return; this.barefoot = on; let skin = null; this.root.traverse(o => { if (o.isMesh && o.material && o.material.name === 'skin') skin = o.material; });
    this.root.traverse(o => { if (!o.isMesh || !o.material) return; if (on && o.material.name === 'shoe' && skin){ o.userData.shoe = o.material; o.material = skin; } else if (!on && o.userData.shoe){ o.material = o.userData.shoe; o.userData.shoe = null; } }); }
  update(dt){
    this.t += dt * (this.state==='run' ? 11 : this.state==='walk' ? 7.5 : 1);
    const t = this.t, n = this.n, P = {}; for (const k of PARTS) P[k] = [0,0,0]; let hipY = 0;
    const s = Math.sin(t), c = Math.cos(t);
    switch (this.state){
      case 'walk': P.legL=[s*0.6,0,0]; P.legR=[-s*0.6,0,0]; P.shinL=[Math.max(0,-c)*0.8,0,0]; P.shinR=[Math.max(0,c)*0.8,0,0];
        P.armL=[-s*0.5,0,0.06]; P.armR=[s*0.5,0,-0.06]; P.foreL=[-0.25,0,0]; P.foreR=[-0.25,0,0]; hipY = Math.abs(c)*0.025; P.torso=[0.04,s*0.06,0]; break;
      case 'run': P.legL=[s*1.0,0,0]; P.legR=[-s*1.0,0,0]; P.shinL=[Math.max(0,-c)*1.5+0.2,0,0]; P.shinR=[Math.max(0,c)*1.5+0.2,0,0];
        P.armL=[-s*0.9,0,0.1]; P.armR=[s*0.9,0,-0.1]; P.foreL=[-1.2,0,0]; P.foreR=[-1.2,0,0]; hipY = Math.abs(c)*0.06; P.torso=[0.22,s*0.1,0]; break;
      case 'sit': P.legL=[-1.5,0,0.08]; P.legR=[-1.5,0,-0.08]; P.shinL=[1.45,0,0]; P.shinR=[1.45,0,0]; P.armL=[-0.35,0,0.12]; P.armR=[-0.35,0,-0.12]; P.foreL=[-0.5,0,0]; P.foreR=[-0.5,0,0];
        hipY = -0.42; P.torso=[0.05+Math.sin(t*1.2)*0.015,0,0]; P.head=[0.05,Math.sin(t*0.4)*0.25,0]; break;
      case 'cycle': {
        hipY=0.10; P.torso=[0.48,0,0]; P.head=[-0.40,0,0];
        P.armL=[-0.96,0,0.10]; P.armR=[-0.96,0,-0.10]; P.foreL=[-0.65,0,0]; P.foreR=[-0.65,0,0];
        // ペダルの円運動から膝の角度を求める。惰性走行では足も止まる。
        for (const [side,offset] of [['L',0],['R',Math.PI]]){
          const phase=(this.cyclePhase||0)+offset, pedalY=0.35+Math.cos(phase)*0.16, pedalZ=0.17+Math.sin(phase)*0.16;
          const down=(this.rest.hips?.y??0.93)+hipY+(this.rest['leg'+side]?.y??-0.08)-pedalY, forward=pedalZ-0.02;
          const a=0.40,b=0.44,r=THREE.MathUtils.clamp(Math.hypot(down,forward),0.12,a+b-0.005);
          const thigh=Math.atan2(forward,down)+Math.acos(THREE.MathUtils.clamp((a*a+r*r-b*b)/(2*a*r),-1,1));
          const knee=Math.PI-Math.acos(THREE.MathUtils.clamp((a*a+b*b-r*r)/(2*a*b),-1,1));
          P['leg'+side]=[-thigh,0,side==='L'?0.10:-0.10]; P['shin'+side]=[knee,0,0];
        }
        break;
      }
      // 前回り受け身（rollK は 0〜1 の進み）：両手を前について → 体を丸めて肩から転がる → しゃがんで起き上がる
      case 'roll': { const k = this.rollK ?? 0.5, L = (a, b, u) => a.map((v, i) => v + (b[i] - v)*u);
        const R = { legL:[-1.0,0,0.1], legR:[-0.8,0,-0.1], shinL:[1.5,0,0], shinR:[1.3,0,0], torso:[1.05,0,0], head:[0.45,0,0], armL:[-0.75,0,0.25], armR:[-0.85,0,-0.2], foreL:[-0.15,0,0], foreR:[-0.1,0,0], hy:[-0.25,0,0] };   // 手をつく
        const T = { legL:[-2.2,0,0.15], legR:[-2.0,0,-0.15], shinL:[2.4,0,0], shinR:[2.3,0,0], torso:[1.0,0,0.25], head:[0.8,0.2,0], armL:[-0.9,0,0.35], armR:[-1.6,0,-0.45], foreL:[-1.7,0,0], foreR:[-0.9,0,0], hy:[-0.32,0,0] };   // 丸くなる（右肩から）
        const E = { legL:[-1.6,0,0.1], legR:[-0.9,0,-0.1], shinL:[2.1,0,0], shinR:[1.2,0,0], torso:[0.55,0,0], head:[0.15,0,0], armL:[-0.5,0,0.2], armR:[-0.7,0,-0.2], foreL:[-0.7,0,0], foreR:[-0.7,0,0], hy:[-0.36,0,0] };   // しゃがんで起きる
        const [A, B, u] = k < 0.18 ? [R, T, k/0.18] : k < 0.72 ? [T, T, 0] : [T, E, (k - 0.72)/0.28];
        for (const key of ['legL','legR','shinL','shinR','torso','head','armL','armR','foreL','foreR']) P[key] = L(A[key], B[key], u); hipY = L(A.hy, B.hy, u)[0]; break; }
      case 'jump': P.legL=[-0.75,0,0]; P.legR=[-0.3,0,0]; P.shinL=[1.15,0,0]; P.shinR=[0.6,0,0]; P.armL=[-0.5,0,0.95]; P.armR=[-0.5,0,-0.95]; P.foreL=[-0.3,0,0]; P.foreR=[-0.3,0,0]; P.torso=[0.08,0,0]; break;
      case 'swim': P.hips=[1.25,0,0]; P.legL=[Math.sin(t*6)*0.35,0,0]; P.legR=[-Math.sin(t*6)*0.35,0,0]; P.armL=[-2.6+Math.sin(t*3)*0.9,0,0.3]; P.armR=[-2.6-Math.sin(t*3)*0.9,0,-0.3]; P.head=[-1.0,0,0]; hipY=-0.55+Math.sin(t*2)*0.04; break;
      case 'wave': P.armR=[0,0,-2.6+Math.sin(t*9)*0.3]; P.foreR=[0,0,-0.4+Math.sin(t*9)*0.3]; P.armL=[0,0,0.08]; P.torso=[0,0,Math.sin(t*2)*0.02]; break;
      // 机の上で手を動かす（切る・塗る・折る）。前かがみで、手元を見ている
      case 'craft': P.torso=[0.34,0,0]; P.head=[0.28,Math.sin(t*0.7)*0.06,0]; P.armL=[-0.62+Math.sin(t*4)*0.07,0,0.3]; P.armR=[-0.62-Math.sin(t*4)*0.1,0,-0.3]; P.foreL=[-0.95+Math.sin(t*4+1)*0.1,0,-0.35]; P.foreR=[-0.95-Math.sin(t*4+1)*0.22,0,0.35]; break;
      // スケッチブックを左手で抱えて、右手で描く
      case 'sketch': P.torso=[0.08,0,0]; P.head=[0.3+Math.sin(t*0.5)*0.12,0,0]; P.armL=[-0.45,0,0.12]; P.foreL=[-1.45,0,-0.5]; P.armR=[-0.55,0,-0.2]; P.foreR=[-1.25+Math.sin(t*7)*0.1,0,0.45+Math.sin(t*5)*0.12]; break;
      case 'work': P.armL=[-1.1+Math.sin(t*5)*0.25,0,0.2]; P.armR=[-1.1-Math.sin(t*5)*0.25,0,-0.2]; P.foreL=[-0.7,0,0]; P.foreR=[-0.7,0,0]; P.torso=[0.25,0,0]; P.head=[0.2,0,0]; break;
      // 盆踊り：両手を交互に上げ、足を踏みかえる
      case 'dance': { const b = Math.sin(t*2.4), u = Math.cos(t*2.4); P.armL=[-1.2-b*0.5,0,0.5+u*0.2]; P.armR=[-1.2+b*0.5,0,-0.5+u*0.2]; P.foreL=[-0.6,0,0]; P.foreR=[-0.6,0,0];
        P.legL=[Math.max(0,b)*0.35,0,0]; P.legR=[Math.max(0,-b)*0.35,0,0]; P.shinL=[Math.max(0,b)*0.5,0,0]; P.shinR=[Math.max(0,-b)*0.5,0,0]; P.torso=[0.08,b*0.15,0]; P.head=[0.1,b*0.1,0]; hipY = -Math.abs(u)*0.03; break; }
      // ラジオ体操：腕を大きく回して、上で伸びる
      case 'taiso': { const a = t*2.0; P.armL=[0,0,0.2+Math.max(0,Math.sin(a))*2.7]; P.armR=[0,0,-0.2-Math.max(0,Math.sin(a))*2.7]; P.legL=[0,0,0.12]; P.legR=[0,0,-0.12]; P.torso=[0,0,Math.sin(a*0.5)*0.08]; hipY = Math.min(0, Math.cos(a))*0.05; break; }
      case 'lookup': P.head=[-0.45,0,0]; P.armL=[0,0,0.08]; P.armR=[0,0,-0.08]; P.torso=[-0.05,0,0]; break;
      case 'photo': P.armL=[0,0,0.08]; P.armR=[-0.55,0,-1.85]; P.foreR=[-0.65,0,-0.25]; P.torso=[0,0,0.03]; P.head=[-0.04,0,-0.04]; break;
      default: P.armL=[0,0,0.08+Math.sin(t*1.6)*0.015]; P.armR=[0,0,-0.08-Math.sin(t*1.6)*0.015]; P.torso=[Math.sin(t*1.6)*0.02,0,0]; P.head=[0,Math.sin(t*0.5)*0.15,0];
    }
    if (this.holdUp){ P.armR = [-1.75, 0, -0.1]; P.foreR = [-0.5, 0, 0.15]; }   // 傘や網を持ち上げる
    if (this.photoArm){
      if (this.holdUp){ P.armL = [-0.55, 0, 1.85]; P.foreL = [-0.65, 0, 0.25]; }
      else { P.armR = [-0.55, 0, -1.85]; P.foreR = [-0.65, 0, -0.25]; }
      if (this.photoHeadYaw !== null && this.photoHeadYaw !== undefined) P.head = [P.head[0] - 0.04, this.photoHeadYaw, -0.04];
    }
    const k = Math.min(1, dt*10);
    for (const name of PARTS){ const o = n[name]; if (!o) continue; const r = P[name];
      o.rotation.x += (r[0]-o.rotation.x)*k; o.rotation.y += (r[1]-o.rotation.y)*k; o.rotation.z += (r[2]-o.rotation.z)*k; }
    if (n.hips){ const ty = this.rest.hips.y + hipY; n.hips.position.y += (ty - n.hips.position.y)*k; }
    const seated = this.state === 'sit' ? 1 : 0;
    const blend = this.sitBlend + (seated-this.sitBlend)*k;
    const next = Math.abs(seated-blend) < 0.0001 ? seated : blend;
    if (next !== this.sitBlend){
      this.sitBlend = next;
      for (const cloth of this.seatedCloth){ const pos = cloth.geo.attributes.position, a = cloth.rest;
        for (let i=0;i<pos.count;i++){
          const x=a[i*3], y=a[i*3+1], z=a[i*3+2];
          const weight = THREE.MathUtils.clamp((cloth.waist-y)/(cloth.waist-cloth.pivot), 0, 1);
          const angle = -1.5*next*weight, cs = Math.cos(angle), sn = Math.sin(angle);
          const depth = z*(1-0.45*next*weight), dy = y-cloth.pivot;
          pos.setXYZ(i, x, cloth.pivot+dy*cs-depth*sn, dy*sn+depth*cs);
        }
        pos.needsUpdate = true;
        if (next === 0){ cloth.geo.attributes.normal.array.set(cloth.normals); cloth.geo.attributes.normal.needsUpdate = true; }
        else cloth.geo.computeVertexNormals();
        cloth.geo.computeBoundingSphere();
      }
    }
  }
}
