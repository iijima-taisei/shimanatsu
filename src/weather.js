// 天気：晴れ・小雨・雷雨・台風。日と時刻で決まる（デバッグで固定もできる）。
// 雨粒は線の板で描き、空・光・霧を曇らせ、雷は光と音、台風は風で主人公を押し、波を高くする。
import * as THREE from 'three';
import { audio } from './audio.js';
export const TYPHOON_DAY = 8;          // 8月21日
// 日ごとの天気 [始まる時刻, 終わる時刻, 種類]
const PLAN = { 2:[[13, 16, 'light']], 5:[[16, 19.5, 'storm']], 7:[[15, 24, 'gust']], [TYPHOON_DAY]:[[0, 24, 'typhoon']], 10:[[6, 10, 'light']] };
// 種類ごとの強さ：rain 雨、storm 雷、wind 風、cloud 曇り
export const KINDS = { clear:{ rain:0, storm:0, wind:0, cloud:0 }, light:{ rain:0.3, storm:0, wind:0.1, cloud:0.55 }, storm:{ rain:1, storm:1, wind:0.35, cloud:0.92 },
  gust:{ rain:0.08, storm:0, wind:0.45, cloud:0.6 }, typhoon:{ rain:0.95, storm:0.45, wind:1, cloud:0.97 } };
export const WEATHER_NAMES = { clear:'晴れ', light:'小雨', storm:'雷雨', gust:'くもり・強い風', typhoon:'台風' };
function target(day, hour){ for (const [a, b, k] of PLAN[day] || []){ const ramp = Math.min(1, (hour - a)/0.4, (b - hour)/0.4); if (ramp > 0){ const w = KINDS[k], q = Math.max(0, ramp);
      const peak = k === 'typhoon' ? 0.75 + 0.25*Math.max(0, Math.min(1, (hour - 12)/2, (21 - hour)/2)) : 1;   // 台風は午後から夜がいちばん強い
      return { rain:w.rain*q*peak, storm:w.storm*q*peak, wind:w.wind*q*peak, cloud:w.cloud*Math.min(1, q*1.5), kind:k }; } }
  return { ...KINDS.clear, kind:'clear' }; }
export function setupWeather(G){
  const scene = G.scene, N = 2200, BOX = 34, H = 22;
  const pos = new Float32Array(N*6), drops = new Float32Array(N*3);
  for (let i = 0; i < N; i++){ drops[i*3] = (Math.random() - 0.5)*BOX*2; drops[i*3 + 1] = Math.random()*H; drops[i*3 + 2] = (Math.random() - 0.5)*BOX*2; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color:0xc8d4e0, transparent:true, opacity:0.45, depthWrite:false })); rain.frustumCulled = false; scene.add(rain);
  const now = { rain:0, storm:0, wind:0, cloud:0, kind:'clear' }; G.weatherNow = now; G.fogBase = [90, 620];
  let thunderAt = 0, flash = 0, ownFlash = false; const flashEl = document.getElementById('flash'), gray = new THREE.Color(), grayH = new THREE.Color(), GRAY_LIGHT = new THREE.Color(0xa3abb3), GRAY_DARK = new THREE.Color(0x4e565f), GRAYH_LIGHT = new THREE.Color(0xb7bdc2), GRAYH_DARK = new THREE.Color(0x6a7178), windDir = new THREE.Vector2(-0.8, 0.6).normalize();
  G.weather = {
    // sky.update のあとに呼ぶ
    update(dt, sky, P){ const st = G.state, tg = G.weatherOverride ? { ...KINDS[G.weatherOverride], kind:G.weatherOverride } : target(st.day, st.hour), k = Math.min(1, dt*0.5);
      for (const key of ['rain', 'storm', 'wind', 'cloud']) now[key] += (tg[key] - now[key])*k; now.kind = tg.kind;
      const inside = (G.indoor && G.indoor !== 'class') || G.inSchool, show = now.rain > 0.02 && !inside && G.mode === 'play';
      rain.visible = show;
      if (show){ const cam = G.camera.position, n = Math.floor(N*Math.min(1, now.rain)), fall = 14 + now.rain*10, wx = windDir.x*now.wind*9, wz = windDir.y*now.wind*9, len = 0.35 + now.rain*0.5;
        for (let i = 0; i < n; i++){ let y = drops[i*3 + 1] - fall*dt; if (y < 0) y += H; drops[i*3 + 1] = y; drops[i*3] = ((drops[i*3] + wx*dt + BOX) % (BOX*2) + BOX*2) % (BOX*2) - BOX; drops[i*3 + 2] = ((drops[i*3 + 2] + wz*dt + BOX) % (BOX*2) + BOX*2) % (BOX*2) - BOX;
          const x = cam.x + drops[i*3], z = cam.z + drops[i*3 + 2], yy = cam.y - H*0.4 + y; pos.set([x, yy, z, x - wx*len/fall*3, yy + len, z - wz*len/fall*3], i*6); }
        geo.setDrawRange(0, n*2); geo.attributes.position.needsUpdate = true; }
      // 空と光を曇らせる
      // 雨が強いほど、雲は暗い灰色になる
      const c = now.cloud; sky.uni.cloud.value = c; gray.lerpColors(GRAY_LIGHT, GRAY_DARK, now.rain); grayH.lerpColors(GRAYH_LIGHT, GRAYH_DARK, now.rain);
      sky.uni.top.value.lerp(gray, c*0.9); sky.uni.hor.value.lerp(grayH, c*0.85); sky.uni.coolHor.value.lerp(grayH, c*0.85); sky.uni.sunVisible.value *= 1 - c;
      sky.sun.intensity *= 1 - c*0.85; sky.hemi.intensity *= 1 - c*(0.25 + now.rain*0.3); sky.cloudMat.color.lerp(gray, c*0.8); scene.fog.color.lerp(grayH, c*0.8);
      scene.fog.near = G.fogBase[0]*(1 - now.rain*0.6); scene.fog.far = G.fogBase[1]*(1 - now.rain*0.62);
      if (G.blackout){ sky.hemi.intensity *= 0.3; sky.sun.intensity *= 0.15; }
      // 雷：ぴかっと光って、少し遅れてごろごろ
      if (now.storm > 0.3 && G.time > thunderAt && G.mode === 'play'){ thunderAt = G.time + 3 + Math.random()*9/now.storm; flash = 1; const d = 0.4 + Math.random()*2; audio.burst(2.6, 90, 0.55*(inside ? 0.5 : 1), { when:d }); audio.burst(0.5, 380, 0.25*(inside ? 0.4 : 1), { when:d }); }
      if (flash > 0){ flash -= dt*3; sky.hemi.intensity += Math.max(0, flash)*1.4; if (!inside){ ownFlash = true; flashEl.style.transition = 'none'; flashEl.style.opacity = Math.max(0, flash)*0.45; } }
      else if (ownFlash){ ownFlash = false; flashEl.style.opacity = 0; }   // 写真のフラッシュは消さない
      // 風：歩いている主人公を少し押す。波も高くなる
      P.wind = now.wind > 0.2 && !inside ? { x:windDir.x*now.wind*1.6, z:windDir.y*now.wind*1.6 } : null; G.seaRough = 1 + now.wind*5;
      audio.rain(now.rain*(inside ? 0.35 : 1), now.wind*(inside ? 0.2 : 1)); },
  };
}
