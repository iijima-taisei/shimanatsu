import * as THREE from 'three';
import { tex } from '../assets.js';
// 時間帯ごとの色 [時, 空の上, 地平線, 太陽光, 太陽の強さ, 環境光の強さ]
const K = [
  [ 4.5, 0x0b1230, 0x1c2a52, 0x8fa4ff, 0.10, 0.35],
  [ 5.6, 0x33508f, 0xf2a586, 0xffb08a, 0.55, 0.55],
  [ 7.0, 0x4d9be0, 0xcfe6f2, 0xfff0d2, 1.15, 0.85],
  [12.0, 0x2f86e0, 0xb9e2f5, 0xfffaf0, 1.55, 1.00],
  [15.5, 0x3a8ad8, 0xcde4ea, 0xfff0cc, 1.40, 0.95],
  [17.3, 0x5a86c8, 0xffcf8a, 0xffc070, 1.25, 0.80],
  [18.4, 0x54589e, 0xff8a4a, 0xff8a3c, 0.95, 0.62],
  [19.1, 0x2f2f6e, 0xe0607a, 0xd06a70, 0.40, 0.48],
  [19.9, 0x121a44, 0x35407a, 0x8fa4ff, 0.14, 0.38],
  [24.0, 0x0b1230, 0x1c2a52, 0x8fa4ff, 0.10, 0.35],
];
const ca = new THREE.Color(), cb = new THREE.Color();
function sample(h, idx, out){
  let i = 0; while (i < K.length-2 && h > K[i+1][0]) i++;
  const a = K[i], b = K[i+1]; const t = Math.min(1, Math.max(0, (h-a[0])/(b[0]-a[0])));
  if (out){ ca.setHex(a[idx]); cb.setHex(b[idx]); return out.copy(ca).lerp(cb, t); }
  return a[idx] + (b[idx]-a[idx])*t;
}
export class Sky {
  constructor(scene){
    this.scene = scene;
    this.uni = { top:{value:new THREE.Color()}, hor:{value:new THREE.Color()}, coolHor:{value:new THREE.Color()}, twilight:{value:0}, sunDir:{value:new THREE.Vector3(0,1,0)}, sunCol:{value:new THREE.Color()}, sunVisible:{value:1}, night:{value:0}, time:{value:0}, cloud:{value:0} };
    const mat = new THREE.ShaderMaterial({ uniforms:this.uni, side:THREE.BackSide, depthWrite:false, fog:false,
      vertexShader:`varying vec3 vP; void main(){ vP = position; vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; }`,
      fragmentShader:`varying vec3 vP; uniform vec3 top; uniform vec3 hor; uniform vec3 coolHor; uniform float twilight; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunVisible; uniform float night; uniform float time; uniform float cloud;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        void main(){ vec3 d = normalize(vP); float t = pow(clamp(d.y*1.25+0.02,0.0,1.0), 0.55);
          float facing = smoothstep(-0.35, 0.8, dot(normalize(d.xz + vec2(0.0001)), normalize(sunDir.xz)));
          vec3 horizon = mix(hor, mix(coolHor, hor, facing), twilight); vec3 c = mix(horizon, top, t);
          float s = max(dot(d, sunDir), 0.0); c += sunCol*sunVisible*(pow(s, 6.0)*0.35 + pow(s, 600.0)*4.0 + pow(s,60.0)*0.3);
          float clear = smoothstep(0.82, 0.12, cloud);
          vec3 mwN = normalize(vec3(0.72, 0.36, -0.59));
          float band = exp(-pow(dot(d, mwN)*4.2, 2.0));
          float mwPatch = 0.62 + 0.38*sin(d.x*6.0 + d.z*5.0)*cos(d.y*7.0 - d.x*4.0);
          vec2 g2 = floor(d.xz/(abs(d.y)+0.42)*360.0); float st2 = step(0.991, h21(g2))*band;
          c += (band*mwPatch*vec3(0.14, 0.19, 0.32) + vec3(0.75, 0.82, 1.0)*st2*0.45)*night*clear*smoothstep(0.02, 0.16, d.y);
          vec2 g = floor(d.xz/(abs(d.y)+0.35)*210.0); float st = step(0.9965, h21(g))*night*clear*step(0.02,d.y);
          float tw = 0.65 + 0.35*sin(time*(1.6 + 3.0*h21(g+7.0)) + h21(g+13.0)*6.28);
          vec3 scol = mix(vec3(0.82, 0.88, 1.0), vec3(1.0, 0.92, 0.82), h21(g+19.0));
          c += scol*st*(0.25+0.75*h21(g+3.0))*tw;
          if (d.y < 0.0) c = mix(horizon, horizon*0.6, clamp(-d.y*4.0,0.0,1.0));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 16, 10), mat); this.dome.renderOrder = -10; scene.add(this.dome);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x7a8a6a, 1); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1); scene.add(this.sun); scene.add(this.sun.target);
    scene.fog = new THREE.Fog(0xb9e2f5, 90, 620);
    // 雲（板ポリゴン）
    this.clouds = new THREE.Group(); scene.add(this.clouds);
    // 雲は種類ごとの絵（入道雲3種・小さな積雲・すじ雲）。水平線に入道雲が立ち、空の中ほどに積雲、高いところにすじ雲
    const cmat = name => new THREE.MeshBasicMaterial({ map: tex(name, {repeat:false}), transparent:true, depthWrite:false, fog:false, opacity:0.95, side:THREE.DoubleSide });
    const M = { cb1:cmat('cloud-cb1'), cb2:cmat('cloud-cb2'), cb3:cmat('cloud-cb3'), cu:cmat('cloud-cu'), st:cmat('cloud-st') };
    this.cloudMats = Object.values(M); this.cloudMat = { color:{ copy:c => { for (const m of this.cloudMats) m.color.copy(c); return this.cloudMat.color; }, lerp:(c, k) => { for (const m of this.cloudMats) m.color.lerp(c, k); return this.cloudMat.color; } } };
    let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
    const add = (m, a, r, y, w, h) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(Math.cos(a)*r, y, Math.sin(a)*r); p.lookAt(0, y*0.6, 0); p.renderOrder = -9 + r/2000; this.clouds.add(p); return p; };
    // 入道雲：水平線のあちこちに、高さも形もばらばらに。根もとは水平線の少し下から
    // cb2（かなとこ雲）はキノコ雲に見えるので使わない。cb1 は左右反転したものも混ぜて形を散らす
    const CB = [M.cb1, M.cb3, M.cb1, M.cb3, M.cb1, M.cb3, M.cb1, M.cb3, M.cb1];
    CB.forEach((m, i) => { const a = i/CB.length*Math.PI*2 + (rnd() - 0.5)*0.5, r = 1150 + rnd()*450, w = m === M.cb3 ? 900 + rnd()*500 : 420 + rnd()*380, h = m === M.cb3 ? w*0.55 : w*(1.05 + rnd()*0.35); const p = add(m, a, r, h*0.42 - 20, w, h); if (i % 4 === 2) p.scale.x = -1; });
    // 積雲：空の中ほどに、小さく散らばる
    for (let i = 0; i < 16; i++){ const a = rnd()*Math.PI*2, r = 500 + rnd()*600, w = 120 + rnd()*200; add(M.cu, a, r, 170 + rnd()*170, w, w*0.6); }
    // すじ雲：高いところに薄く
    for (let i = 0; i < 6; i++){ const a = rnd()*Math.PI*2, r = 700 + rnd()*500, w = 500 + rnd()*500; add(M.st, a, r, 420 + rnd()*200, w, w*0.35); }
    this.tmp = new THREE.Color(); this.lightDir = new THREE.Vector3(); this.viewDir = new THREE.Vector3();
  }
  update(hour, center, dt, camera){
    const u = this.uni; u.time.value += dt; u.cloud.value = 0; sample(hour, 1, u.top.value); sample(hour, 2, u.hor.value); sample(hour, 3, u.sunCol.value);
    // 太陽は東の海から昇って西に沈む
    const a = (hour-5.2)/(19.3-5.2)*Math.PI; const el = Math.sin(a);
    const dir = u.sunDir.value.set(Math.cos(a)*0.95, Math.max(el,-0.25)*0.85+0.02, 0.32).normalize();
    // 朝夕の暖色は太陽側に寄せ、反対側は空の青紫を残す。
    const smooth = THREE.MathUtils.smoothstep;
    u.twilight.value = Math.max(
      smooth(hour, 4.8, 5.6)*(1-smooth(hour, 5.8, 7.0)),
      smooth(hour, 16.0, 18.0)*(1-smooth(hour, 19.2, 20.0))
    );
    u.coolHor.value.copy(u.top.value).lerp(u.hor.value, 0.12);
    u.sunVisible.value = smooth(el, -0.04, 0.08);
    const night = hour>19.3||hour<5.2;
    u.night.value = THREE.MathUtils.clamp(hour>12 ? (hour-19.0)/0.9 : (5.6-hour)/0.8, 0, 1);
    // 夜の補助光と太陽の描画方向を分け、夜空に太陽の円が出ないようにする。
    this.lightDir.copy(dir); if (night) this.lightDir.set(-0.3, 0.8, 0.4).normalize();
    this.sun.color.copy(u.sunCol.value); this.sun.intensity = sample(hour, 4)*1.6;
    this.sun.position.copy(center).addScaledVector(this.lightDir, 200); this.sun.target.position.copy(center);
    this.hemi.intensity = sample(hour, 5)*1.5; this.hemi.color.copy(u.top.value).lerp(this.tmp.set(0xffffff), 0.55); this.hemi.groundColor.copy(u.hor.value).multiplyScalar(0.55);
    this.scene.fog.color.copy(u.hor.value);
    // 遠景の霧も視線方向の水平線色に合わせ、空との境目を目立たせない。
    if (camera){
      camera.getWorldDirection(this.viewDir);
      const h = Math.hypot(this.viewDir.x, this.viewDir.z);
      if (h > 0.0001){
        const facing = smooth((this.viewDir.x*dir.x + this.viewDir.z*dir.z)/(h*Math.hypot(dir.x, dir.z)), -0.35, 0.8);
        this.scene.fog.color.lerp(u.coolHor.value, u.twilight.value*(1-facing));
      }
    }
    this.cloudMat.color.copy(u.hor.value).lerp(this.tmp.set(0xffffff), night?0.05:0.6); 
    this.dome.position.copy(center); this.clouds.position.set(center.x, 0, center.z); this.clouds.rotation.y += dt*0.0016;
    this.sunDir = dir; this.nightK = u.night.value;
  }
}
