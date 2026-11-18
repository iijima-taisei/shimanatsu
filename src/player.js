import * as THREE from 'three';
import { heightAt, inBounds, roadKindAt, platformAt, AIRPORT } from './world/terrain.js';
import { SETTINGS, GEARS } from './keys.js';
const ROLLBOX = new THREE.Box3();
const ROLL = 0.85;   // 前回り受け身の長さ（秒）
const COYOTE = 0.10;   // 段差から足が離れた直後にジャンプを許容する時間（秒）
const JUMP_BUF = 0.12;   // 着地前のジャンプ先行入力を保持する時間（秒）
const FP_EYE = new THREE.Vector3();
const BIKE_BOUNCE_DUR = 0.16;   // 着地クッションの減衰時間（秒）
let audio_engine = () => {};
let audio_wind = () => {};
let audio_skid = () => {};
let fx_bikePuff = null;
// 原付のエンジン音（main.js から渡す。既存互換）
export const setEngine = fn => { audio_engine = fn; };
// 自転車・原付の走行音・砂ぼこり演出を一括登録する
export const setBikeAudio = ({ engine, wind, skid, puff } = {}) => {
  if (engine) audio_engine = engine;
  if (wind) audio_wind = wind;
  if (skid) audio_skid = skid;
  if (puff) fx_bikePuff = puff;
};
// 着地時の車体・サドル姿勢の上下バウンス量（0.16秒程度の減衰振動）
export function computeBikeBounce(t, amp, dur = BIKE_BOUNCE_DUR){
  if (t <= 0 || t >= dur || amp <= 0) return 0;
  const u = t / dur;
  return -amp * 1.55 * Math.sin(u * Math.PI * 1.65) * Math.pow(1 - u, 1.5);
}
// 高速からの急減速でブレーキ演出を出すかの判定
export function shouldBikeBrakeFx(prevSpeed, nextSpeed, dt, { locked = false, air = 0, gh = 0 } = {}){
  if (locked || air > 0.01 || gh < 0.05 || dt <= 0) return false;
  const decel = (prevSpeed - nextSpeed) / dt;
  return prevSpeed >= 6.5 && decel >= 7.5;
}
// 足もとの高さ。ふだんは地形（heightAt）、校舎の中では階ごとの床（school.js が setGround で差しかえる）。y はいまの高さ（どの階の床かを選ぶのに使う）
let ground = (x, z, y) => heightAt(x, z);
let floor = () => null;
export const setGround = (fn, floorFn) => { ground = fn; if (floorFn) floor = floorFn; };
const gAt = (y, x, z) => ground(x, z, y);
import { Character } from './models.js';
import { computeHeadLook, smoothHeadLook } from './interact.js';
export const keys = {};
export class Player {
  constructor(scene, camera, colliders){
    this.ch = new Character({ model:'boy' }); this.root = this.ch.root; scene.add(this.root);
    this.pos = this.root.position; this.cam = camera; this.col = colliders;
    this.yaw = 0; this.camYaw = Math.PI; this.camPitch = 0.28; this.camDist = 6.2; this.locked = false; this.swimming = false; this.sitting = false;
    this.camPos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.moved = 0;
    this.riding = null; this.bikeSpeed = 0; this.bikePhase = 0;
    this.bikeBounceT = 0; this.bikeBounceAmp = 0; this.bikeBrakeCd = 0;
    this.headLook = { yaw: 0, pitch: 0 }; this._headApplied = { yaw: 0, pitch: 0 };
    this.air = 0; this.vy = 0;   // 地面からの高さと上下の速さ（ジャンプ・落下）
    this.coyote = 0; this.jumpBuf = 0; this.jumped = false;
    addEventListener('keydown', e => {
      if (e.isComposing || e.target.closest?.('button, a, input, select, textarea, [contenteditable="true"]')) return;
      keys[e.code] = true; if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => { keys[e.code] = false; });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    let drag = false; const cv = document.getElementById('game');
    cv.addEventListener('pointerdown', e => { drag = true; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointerup', () => drag = false);
    cv.addEventListener('pointercancel', () => drag = false);
    cv.addEventListener('lostpointercapture', () => drag = false);
    cv.addEventListener('pointermove', e => { if (drag){ this.camYaw -= e.movementX*0.006; if (this.firstPerson) this.fpPitch = THREE.MathUtils.clamp((this.fpPitch || 0) - e.movementY*0.004, -1.2, 1.2); else this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY*0.004, -0.15, 1.1); } });
    cv.addEventListener('wheel', e => { this.camDist = THREE.MathUtils.clamp(this.camDist + e.deltaY*0.01, 3, 12); }, {passive:true});
  }
  // ジャンプ。泳いでいる間・空中・座っている間はできない（徒歩のみコヨーテタイムと先行入力バッファを許容する）
  jump(){
    if (this.locked || this.driving || this.swimming) return false;
    const coyote = !this.riding && this.coyote > 0 && this.vy <= 0;
    if ((this.air > 0.01 || this.vy > 0) && !coyote){
      if (!this.riding) this.jumpBuf = JUMP_BUF;
      return false;
    }
    this.sitting = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.vy = this.riding ? 6.6 : 8.1;
    this.air = Math.max(this.air, 0.001);
    return true;
  }
  // 足元の地面の材質を返す（'wood' | 'shallow' | 'road' | 'dirt' | 'sand' | 'grass'）
  surface(x = this.pos.x, z = this.pos.z, y = this.pos.y){
    if (this.room) return 'wood';
    if (floor(x, z, y) !== null) return 'wood';
    if (this.bedAt && this.bedAt(x, z, y)) return 'wood';
    const plat = platformAt(x, z);
    if (plat && Math.abs(y - plat.top) < 0.35) return 'wood';
    const gh = heightAt(x, z);
    if (gh < 0.2) return 'shallow';
    const rk = roadKindAt(x, z);
    if (rk === 'main' || rk === 'lane') return 'road';
    if (rk === 'path') return 'dirt';
    if ((Math.abs(x - AIRPORT.x) < (AIRPORT.w - 8)/2 && Math.abs(z - AIRPORT.rz) < 4.6)
      || (Math.abs(x - 14) < 26.2 && Math.abs(z - 105.5) < 5.1)) return 'road';
    if (x >= -1 && x <= 57 && z >= -49 && z <= -15) return 'dirt';
    if (this.fields) for (const f of this.fields) if (Math.hypot(x - f.x, z - f.z) < 4.5) return 'dirt';
    if (gh < 2.35) return 'sand';
    return 'grass';
  }
  // 上下の動き。ground は足元の高さ。着地したら true
  // 上がるときより、落ちるときの重力を強くする（ふわっとせず、着地に手応えが出る）
  fly(dt, ground){ this.vy -= (this.vy > 0 ? 22 : 34)*dt; const y = this.pos.y + this.vy*dt; if (y <= ground){ const hard = this.vy; this.air = 0; this.vy = 0; this.pos.y = ground; this.landSpeed = -hard; this.landed = -hard; return true; } this.pos.y = y; this.air = y - ground; return false; }
  teleport(x, z, yaw=0, yHint=999){ this.air = 0; this.vy = 0; this.coyote = 0; this.jumpBuf = 0; this.jumped = false; this.sitting = false; this.seatDrop = 0; this.carry = null; this.bikeBounceT = 0; this.bikeBounceAmp = 0; this.bikeBrakeCd = 0; this.bikeDiveH = 0; this.clearHeadLook(); this.headLook.yaw = 0; this.headLook.pitch = 0; if (this.ch?.barefoot) this.ch.setBarefoot(false); if (this.driving) this.exitCar(true); if (this.riding) this.dismountBike(true); if (this.ch?.base) this.ch.base.position.y = 0; this.pos.set(x, this.room ? this.room.y : gAt(yHint, x, z), z); this.yaw = yaw; this.camYaw = yaw + Math.PI; this.snap = true; }
  // どれだけ深く物に重なっているか（0なら当たっていない）。軽トラが、めりこんだ状態から抜け出せるようにするために使う
  depthAt(x, z, radius=0.35){ let m = 0;
    for (const c of this.col){ if (c.off || (c.y1 !== undefined && (this.pos.y + 0.5 < c.y0 || this.pos.y > c.y1))) continue; let d;   // 校舎の壁は、その階にいるときだけ
      if (c.r) d = c.r + radius - Math.hypot(x-c.x, z-c.z);
      else { const a=-(c.rot||0), cs=Math.cos(a), sn=Math.sin(a), dx=x-c.x, dz=z-c.z; d = Math.min(c.w/2+radius-Math.abs(dx*cs-dz*sn), c.d/2+radius-Math.abs(dx*sn+dz*cs)); }
      if (d > m) m = d; }
    return m; }
  clearAt(x, z, radius=0.35){
    for (const c of this.col){
      if (c.off || (c.h && this.air > c.h) || (c.car && this.pos.y > c.car.mesh.position.y + 0.5) || (c.y1 !== undefined && (this.pos.y + 0.5 < c.y0 || this.pos.y > c.y1))) continue;
      if (c.r){ if (Math.hypot(x-c.x,z-c.z)<c.r+radius) return false; }
      else { const a=-(c.rot||0), cs=Math.cos(a), sn=Math.sin(a), dx=x-c.x, dz=z-c.z;
        if (Math.abs(dx*cs-dz*sn)<c.w/2+radius && Math.abs(dx*sn+dz*cs)<c.d/2+radius) return false; }
    }
    return true;
  }
  bikeCanFit(x, z, yaw){
    const sx=Math.sin(yaw), sz=Math.cos(yaw), h=gAt(this.pos.y, x,z); let rear, front;
    // 前後の車輪も確認し、岸や壁に前輪だけ入り込むのを防ぐ。
    for (const offset of [-0.28,0.27,0.79]){
      const px=x+sx*offset, pz=z+sz*offset, y=gAt(this.pos.y, px,pz);
      if (y<-1.8 || Math.abs(y-h)>1.3 || !this.clearAt(px,pz,0.26)) return false;   // 海にも入れる（深みに入ると泳ぎに切り替わる）
      if (offset<0) rear=y; else front=y;
    }
    return Math.abs(front-rear)<1.4;
  }
  mountBike(bike){
    if (this.riding || this.room || this.swimming || !bike?.mesh || Math.hypot(this.pos.x-bike.mesh.position.x,this.pos.z-bike.mesh.position.z)>2.6) return false;
    const yaw=bike.mesh.rotation.y+Math.PI/2, x=bike.mesh.position.x-Math.sin(yaw)*0.27, z=bike.mesh.position.z-Math.cos(yaw)*0.27;
    if (!this.bikeCanFit(x,z,yaw)) return false;
    this.riding=bike; this.bikeSpeed=0; this.bikePhase=bike.phase||0; this.sitting=false;
    this.bikeBounceT=0; this.bikeBounceAmp=0; this.bikeBrakeCd=0; this.bikeDiveH=0;
    this.coyote=0; this.jumpBuf=0; this.jumped=false;
    this.pos.set(x,gAt(this.pos.y, x,z),z); this.yaw=yaw; this.camYaw=yaw+Math.PI;
    this.bikeCamDist=this.camDist; this.camDist=7.4; this.camPitch=Math.max(0.15,this.camPitch); this.snap=true;
    bike.wheels=['wheelFront','wheelRear'].map(name=>bike.mesh.getObjectByName(name)).filter(Boolean); bike.crank=bike.mesh.getObjectByName('crank');
    this.syncBike(); return true;
  }
  dismountBike(force=false){
    if (!this.riding) return true;
    let point=null;
    if (!force){
      for (const distance of [0.85,1.15,1.45]){
        for (const angle of [Math.PI/2,-Math.PI/2,Math.PI*0.75,-Math.PI*0.75,Math.PI]){
          const x=this.pos.x+Math.sin(this.yaw+angle)*distance, z=this.pos.z+Math.cos(this.yaw+angle)*distance, y=gAt(this.pos.y, x,z);
          if (y>-0.95 && Math.abs(y-this.pos.y)<1.2 && this.clearAt(x,z)){ point={x,y,z}; break; }
        }
        if (point) break;
      }
      if (!point) return false;
    }
    audio_wind(0,false);
    if (this.riding.kind==='moped') audio_engine(0,false);   // 原付のエンジンを止める
    this.bikeBounceT=0; this.bikeBounceAmp=0; this.bikeBrakeCd=0; this.bikeDiveH=0;
    if (this.ch?.base) this.ch.base.position.y=0;
    this.syncBike(); this.riding.phase=this.bikePhase; this.riding=null; this.bikeSpeed=0;
    if (point) this.pos.set(point.x,point.y,point.z);
    this.camDist=this.bikeCamDist??6.2; this.moving=false; this.running=false; this.ch.set('idle'); return true;
  }
  syncBike(bounceY = 0){
    const bike=this.riding; if (!bike) return;
    const sx=Math.sin(this.yaw), sz=Math.cos(this.yaw), x=this.pos.x+sx*0.27, z=this.pos.z+sz*0.27;
    const front=gAt(this.pos.y, x+sx*0.52,z+sz*0.52), rear=gAt(this.pos.y, x-sx*0.52,z-sz*0.52);
    bike.mesh.position.set(x,(front+rear)/2+this.air+bounceY*0.85,z); bike.mesh.rotation.set(0,this.yaw-Math.PI/2,Math.atan2(front-rear,1.04),'YXZ'); bike.mesh.visible=true;
    if (bike.crank) bike.crank.rotation.z=-this.bikePhase;
  }
  updateBike(dt,mx,mz){
    const len=Math.hypot(mx,mz), moped=this.riding.kind==='moped';
    const prevSpeed=this.bikeSpeed;
    // 原付は自転車より速い（ペダルはこがない）。マニュアルでは Shift/Ctrl で1〜4速を変え、W でアクセル、A/D でハンドル
    const top=Math.min(moped ? (SETTINGS.drive==='manual' ? 19 : keys.ShiftLeft||keys.ShiftRight ? 19 : 16) : keys.ShiftLeft||keys.ShiftRight ? 13.5 : 10.5,this.bikeSpeedLimit??Infinity);
    if (this.locked) this.bikeSpeed=0;
    else if (moped && SETTINGS.drive==='manual'){ const G2=GEARS.moped, g=Math.max(1,Math.min(4,this.gear||1)), gas=keys.KeyW||keys.ArrowUp, brake=keys.KeyS||keys.ArrowDown; this.gear=g;
      if (gas){ const low=g>1 && this.bikeSpeed<G2.max[g-1]*0.5; this.bikeSpeed+=(this.bikeSpeed<G2.max[g] ? G2.acc[g]*(low?0.3:1) : -4)*dt; }
      else if (brake) this.bikeSpeed=Math.max(0,this.bikeSpeed-12*dt); else this.bikeSpeed=Math.max(0,this.bikeSpeed-(1.2+g*0.4)*dt);
      this.bikeSpeed=Math.min(this.bikeSpeed,top); this.rpm=this.bikeSpeed/G2.max[g];
      if (Math.abs(mx)>0.1 && this.bikeSpeed>0.5){ const next=this.yaw-mx*dt*2.1*Math.min(1,this.bikeSpeed/4); if (this.bikeCanFit(this.pos.x,this.pos.z,next)) this.yaw=next; } }
    else {
      const target=len>0.01 ? top : 0;
      let braking=false;
      if (len>0.01){
        const fx=-Math.sin(this.camYaw), fz=-Math.cos(this.camYaw), dx=(fx*mz-fz*mx)/len, dz=(fz*mz+fx*mx)/len;
        const angle=Math.atan2(Math.sin(Math.atan2(dx,dz)-this.yaw),Math.cos(Math.atan2(dx,dz)-this.yaw));
        // 高速走行中に逆向き入力された場合は、即座に旋回せずブレーキで急減速させる
        if (Math.abs(angle)>2.35 && this.bikeSpeed>4.5){
          braking=true;
          this.bikeSpeed=Math.max(0,this.bikeSpeed-15*dt);
        } else {
          const turn=THREE.MathUtils.clamp(angle,-dt*2.3,dt*2.3), next=this.yaw+turn;
          if (this.bikeCanFit(this.pos.x,this.pos.z,next)) this.yaw=next;
          // 大きく向きを変える間は速度を落とし、狭い道でも扱いやすくする。
          if (Math.abs(angle)>1.0) this.bikeSpeed=Math.min(this.bikeSpeed,4.5);
        }
      }
      if (!braking){
        const rate=target>this.bikeSpeed ? (moped ? 9 : 7.5) : 5.0;
        this.bikeSpeed+=THREE.MathUtils.clamp(target-this.bikeSpeed,-rate*dt,rate*dt);
      }
    }
    // 高速からの急減速時は軽いタイヤ擦過音と後輪足元の小さな砂ぼこりを出す
    const ghBefore=gAt(this.pos.y,this.pos.x,this.pos.z);
    if (this.bikeBrakeCd>0) this.bikeBrakeCd=Math.max(0,this.bikeBrakeCd-dt);
    if (shouldBikeBrakeFx(prevSpeed,this.bikeSpeed,dt,{ locked:this.locked, air:this.air, gh:ghBefore }) && this.bikeBrakeCd<=0){
      this.bikeBrakeCd=0.11;
      const surf=this.surface(this.pos.x,this.pos.z,this.pos.y);
      audio_skid(surf,prevSpeed);
      const rx=this.pos.x-Math.sin(this.yaw)*0.25, rz=this.pos.z-Math.cos(this.yaw)*0.25, ry=gAt(this.pos.y,rx,rz);
      if (fx_bikePuff) fx_bikePuff(rx,ry,rz,surf);
      else if (typeof window!=='undefined' && window.G?.puff) window.G.puff(rx,ry,rz,0.42,{ size:2.6, opacity:0.55, up:0.65 });
    }
    const distance=this.bikeSpeed*dt, steps=Math.max(1,Math.ceil(distance/0.18)), step=distance/steps; let moved=0;
    for (let i=0;i<steps && step>0;i++){
      let x=this.pos.x+Math.sin(this.yaw)*step, z=this.pos.z+Math.cos(this.yaw)*step, h=gAt(this.pos.y, x,z); const h0=gAt(this.pos.y, this.pos.x,this.pos.z);
      let slope=(h-h0)/step;
      if (!this.bikeCanFit(x,z,this.yaw) || (slope>1.5 && this.air<=0)){
        // 壁の角や門柱にかすったら、止まらずに向きを少しずらして、壁ぞいにすべる（入り口でつかえないように）
        let ok=false;
        for (const d of [0.12,-0.12,0.28,-0.28,0.5,-0.5]){ const yy=this.yaw+d, xx=this.pos.x+Math.sin(yy)*step, zz=this.pos.z+Math.cos(yy)*step, hh=gAt(this.pos.y, xx,zz);
          if (this.bikeCanFit(xx,zz,yy) && (hh-h0)/step<=1.5){ this.yaw+=d*0.5; x=xx; z=zz; h=hh; slope=(hh-h0)/step; this.bikeSpeed*=0.9; ok=true; break; } }
        if (!ok){ this.bikeSpeed=0; break; } }
      if (slope>0.3 && this.air<=0) this.bikeSpeed=Math.max(2.4,this.bikeSpeed*(1-Math.min(0.5,slope*0.05)));   // 急な上りは遅くなるだけで、止められはしない
      this.pos.x=x; this.pos.z=z; moved+=step;
    }
    this.moved+=moved; this.moving=moved>0.0001; this.running=false; this.swimming=false;
    { const gh=gAt(this.pos.y, this.pos.x,this.pos.z);
      if (this.air>0 || this.vy>0){
        this.bikeTop=Math.max(this.bikeTop??this.pos.y,this.pos.y);
        if (this.fly(dt,gh)){
          const drop=this.bikeTop-gh; this.bikeTop=null; if (drop>2) this.bikeTrick=drop;
          if (gh<-0.75) this.bikeDiveH=Math.max(0,drop);
          if (gh>=-0.75 && this.landSpeed>2.2){
            this.bikeBounceT=0.0001;
            this.bikeBounceAmp=THREE.MathUtils.clamp(this.landSpeed*0.0075,0.025,0.08);
          }
        }
      }
      else if (gh<this.pos.y-0.5 && this.bikeSpeed>4){ this.vy=Math.max(0,this.bikeClimb||0); this.air=0.01; this.bikeTop=this.pos.y; }   // 坂の頂上や段差から、勢いのまま飛び出す
      else { const y0=this.pos.y; this.pos.y+=(gh-this.pos.y)*Math.min(1,dt*16); this.bikeClimb=(this.pos.y-y0)/Math.max(dt,1e-3); }
      if (gh<0.1) this.bikeSpeed=Math.min(this.bikeSpeed,4.6);          // 水の中は重い
      // 深みに入ったら落下高を引き継いで泳ぎに切り替える
      if (gh<-0.75 && this.air<=0){ this.bikeDive=true; this.diveH=this.bikeDiveH||Math.max(0,this.pos.y-gh); this.bikeDiveH=0; this.bikeTop=null; this.dismountBike(true); this.swimming=true; return; } }
    let bounceY=0;
    if (this.bikeBounceT>0){
      this.bikeBounceT+=dt;
      if (this.bikeBounceT>=BIKE_BOUNCE_DUR){ this.bikeBounceT=0; this.bikeBounceAmp=0; }
      else bounceY=computeBikeBounce(this.bikeBounceT,this.bikeBounceAmp,BIKE_BOUNCE_DUR);
    }
    this.root.rotation.y=this.yaw;
    this.root.rotation.z=0; this.ch.shadow.visible=true;
    for (const wheel of this.riding.wheels||[]) wheel.rotation.z-=moved/0.33;
    if (len>0.01 && !moped) this.bikePhase+=moved/(0.33*2.4);   // 原付はペダルをこがない
    if (this.locked){
      audio_wind(0,false);
      if (moped) audio_engine(0,false);
    } else {
      audio_wind(this.bikeSpeed,true);
      if (moped) audio_engine(this.bikeSpeed,true,{ manual:SETTINGS.drive==='manual', gear:this.gear, rpm:this.rpm });
    }
    this.clearHeadLook();
    this.ch.cyclePhase=this.bikePhase; this.ch.set('cycle'); this.ch.update(dt);
    if (this.ch?.base) this.ch.base.position.y=bounceY;
    this.syncBike(bounceY);
    if (!this.camOverride) this.updateCam(dt);
  }
  update(dt){
    if (this.frozen) return;   // 飛行機に乗っているあいだなど、イベントが位置を動かす
    let mx = 0, mz = 0;
    if (!this.locked){
      if (keys.KeyW||keys.ArrowUp) mz += 1; if (keys.KeyS||keys.ArrowDown) mz -= 1; if (keys.KeyA||keys.ArrowLeft) mx -= 1; if (keys.KeyD||keys.ArrowRight) mx += 1;
      if (keys.KeyQ) this.camYaw += dt*1.8; if (keys.KeyR) this.camYaw -= dt*1.8;
      const gp = navigator.getGamepads && navigator.getGamepads()[0];
      if (gp){ if (Math.abs(gp.axes[0])>0.2) mx += gp.axes[0]; if (Math.abs(gp.axes[1])>0.2) mz -= gp.axes[1]; if (Math.abs(gp.axes[2])>0.2) this.camYaw -= gp.axes[2]*dt*2.4; }
    }
    if (this.driving){ this.coyote = 0; this.jumpBuf = 0; this.updateCar(dt,mx,mz); return; }
    // 軽トラの荷台に腰かけている。とまっている車なら、歩くと荷台の上に立ち上がる
    if (this.carry){ const car = this.carry.car;
      if (!this.locked && !car.busy && Math.hypot(mx, mz) > 0.1){ this.carry = null; this.sitting = false; const p = car.mesh.position; this.pos.set(p.x - Math.sin(car.mesh.rotation.y)*0.6, p.y + 0.68, p.z - Math.cos(car.mesh.rotation.y)*0.6); }
      else { this.carryUpdate(); this.air = 0; this.vy = 0; this.coyote = 0; this.jumpBuf = 0; this.moving = false; this.swimming = false; this.root.rotation.y = this.yaw; this.ch.shadow.visible = false; this.clearHeadLook(); this.ch.set(this.pose || 'sit'); this.ch.update(dt);
        if (!this.camOverride){ if (car.busy){ let d = car.mesh.rotation.y + Math.PI - this.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.camYaw += d*Math.min(1, dt*1.2); } this.updateCam(dt); } return; } }
    if (this.riding){ this.coyote = 0; this.jumpBuf = 0; this.updateBike(dt,mx,mz); return; }
    if (this.rollT > 0){ mx = 0; mz = 0; }   // 受け身の最中は動かせない
    const len = Math.hypot(mx, mz); const run = keys.ShiftLeft||keys.ShiftRight;
    if (len > 0.01){
      if (this.sitting){ this.sitting = false; if (this.ch.barefoot){ const dx = this.pos.x + 182, dz = this.pos.z - 30, d = Math.hypot(dx, dz) || 1; this.pos.x = -182 + dx/d*5.05; this.pos.z = 30 + dz/d*5.05; } }
      mx/=len; mz/=len; const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
      const dx = fx*mz + -fz*mx, dz = fz*mz + fx*mx;
      const sp = this.swimming ? 2.2*(this.swimBoost || 1) : run ? 8.2 : 3.6;   // 浮き輪があると速く泳げる
      let nx = this.pos.x + dx*sp*dt, nz = this.pos.z + dz*sp*dt;
      for (const c of (this.room ? this.room.col : this.col)){ // 円 or 箱の押し出し
        if (c.off || (c.h && this.air > c.h) || (c.car && this.pos.y > c.car.mesh.position.y + 0.5) || (c.y1 !== undefined && (this.pos.y + 0.5 < c.y0 || this.pos.y > c.y1))) continue;   // 低い塀と軽トラの荷台はジャンプで越えられる。高さの範囲がある壁（校舎の中）は、その階だけ
        if (c.r){ const ex=nx-c.x, ez=nz-c.z, d=Math.hypot(ex,ez), rr=c.r+0.35; if (d<rr && d>1e-4){ nx=c.x+ex/d*rr; nz=c.z+ez/d*rr; } }
        else { const cs=Math.cos(c.rot||0), sn=Math.sin(c.rot||0); const ex=nx-c.x, ez=nz-c.z; const lx=ex*cs-ez*sn, lz=ex*sn+ez*cs; const hx=c.w/2+0.35, hz=c.d/2+0.35;   // rot は three.js の rotation.y と同じ向き
          if (Math.abs(lx)<hx && Math.abs(lz)<hz){ let px=lx, pz=lz; if (hx-Math.abs(lx) < hz-Math.abs(lz)) px=Math.sign(lx)*hx; else pz=Math.sign(lz)*hz;
            nx=c.x+px*cs+pz*sn; nz=c.z-px*sn+pz*cs; } }
      }
      if (this.room){ nx = Math.min(this.room.maxX, Math.max(this.room.minX, nx)); nz = Math.min(this.room.maxZ, Math.max(this.room.minZ, nz)); }
      const h = this.room ? 0 : gAt(this.pos.y, nx, nz), h0 = this.room ? 0 : gAt(this.pos.y, this.pos.x, this.pos.z);
      // 見えない壁は置かない：急な坂は遅くなるだけ、海はどこまでも泳げる（島から遠く離れたときだけ引き返す）
      const slope = (h-h0)/(sp*dt); if (slope > 0.8 && this.air <= 0 && !this.swimming){ const f = Math.max(0.22, 1-(slope-0.8)*0.55); nx = this.pos.x+(nx-this.pos.x)*f; nz = this.pos.z+(nz-this.pos.z)*f; }
      if (inBounds(nx, nz) || Math.hypot(nx + 40, nz + 55) < Math.hypot(this.pos.x + 40, this.pos.z + 55)){ this.pos.x = nx; this.pos.z = nz; this.moved += sp*dt; } else this.edge = true;
      const ty = Math.atan2(dx, dz); let d = ty - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d*Math.min(1, dt*10);
    }
    if (!this.sitting){ this.seatDrop = 0; if (this.ch.barefoot) this.ch.setBarefoot(false); }
    // 強い風に押される（台風）。塀や建物の中には押しこまない
    if (this.wind && !this.locked && !this.sitting && !this.swimming){ const nx = this.pos.x + this.wind.x*dt, nz = this.pos.z + this.wind.z*dt; if (this.clearAt(nx, nz)){ this.pos.x = nx; this.pos.z = nz; } }
    let gh = this.room ? this.room.y : gAt(this.pos.y, this.pos.x, this.pos.z); if (!this.room && this.bedAt){ const b = this.bedAt(this.pos.x, this.pos.z, this.pos.y); if (b) gh = Math.max(gh, b.top); }
    // 座っているときは、座面にお尻がのる高さまで体を下げる（seatDrop = 座面の高さ − 0.39。0.39 は座ったときの太ももの付け根の高さ）
    const water = gh < -1.0, ty = water ? -0.95 : gh + (this.sitting ? this.seatDrop || 0 : 0);
    // どこから落ちはじめたか（受け身や飛びこみの高さに使う）
    if (this.air <= 0 && this.vy <= 0) this.fallTop = this.pos.y; else this.fallTop = Math.max(this.fallTop ?? this.pos.y, this.pos.y);
    let landedNow = false;
    if (this.air > 0 || this.vy > 0){
      if (this.fly(dt, ty)){
        landedNow = true;
        const drop = this.fallTop - this.pos.y; this.fallTop = this.pos.y; this.flip = 0;
        if (water){ if (this.landSpeed > 3){ this.splash = true; this.diveH = drop; } }
        else if (drop > 2.4){ this.rollT = ROLL; this.trick = drop; }   // 高いところから落ちたら、前まわりで受け身
      }
    }
    else if (ty < this.pos.y - 0.6){ this.air = this.pos.y - ty; this.vy = 0; }            // 桟橋や段差の端から落ちる
    else this.pos.y += (ty - this.pos.y)*Math.min(1, dt*12);
    this.swimming = water && this.air <= 0;
    // コヨーテタイムと先行入力バッファを更新する（徒歩のみ）
    if (this.swimming || this.locked || this.rollT > 0){
      this.coyote = 0; this.jumpBuf = 0;
    } else if (landedNow && this.jumpBuf > 0){
      if (this.jump()) this.jumped = true;
    } else {
      if (this.jumpBuf > 0) this.jumpBuf = Math.max(0, this.jumpBuf - dt);
      if (this.air <= 0.01 && this.vy <= 0 && !this.sitting) this.coyote = COYOTE;
      else this.coyote = Math.max(0, this.coyote - dt);
    }
    // 宙返り：高いところから落ちているあいだは前に回る。地面が近づいたら、ちょうど一回転したところで止める
    this.flip = 0;   // 高いところから落ちても、空中で回らない（利用者の指定、2026-11-17）
    // 受け身：着地したら、前まわりで転がって勢いを逃がす
    let tumble = this.flip || 0, lie = 0, side = 0;
    if (this.rollT > 0){ this.rollT -= dt; const k = 1 - Math.max(0, this.rollT)/ROLL; this.ch.rollK = k;
      // 手をついてから回りはじめ、起き上がる前に一回転を終える。体は丸めて低く（地面にもぐらない程度）
      const r = THREE.MathUtils.smoothstep(k, 0.12, 0.8); tumble = r*Math.PI*2; side = Math.sin(r*Math.PI)*0.35;   // 右肩から斜めに転がる
      const nx = this.pos.x + Math.sin(this.yaw)*2.6*dt, nz = this.pos.z + Math.cos(this.yaw)*2.6*dt; if (this.clearAt(nx, nz)){ this.pos.x = nx; this.pos.z = nz; } }
    if (tumble || this.tumbling){ this.ch.setTumble(tumble % (Math.PI*2), side, lie); this.tumbling = !!tumble; }
    this.root.rotation.y = this.yaw; this.ch.shadow.visible = !this.swimming && this.air < 0.05;
    this.clearHeadLook();
    this.ch.set(this.pose || (this.rollT > 0 ? 'roll' : this.flip ? 'jump' : (this.air > 0.05 ? 'jump' : this.swimming ? 'swim' : this.sitting ? 'sit' : len>0.01 ? (run?'run':'walk') : 'idle'))); this.ch.update(dt);
    if (this.rollT > 0){ const b = this.ch.base; this.ch.root.updateMatrixWorld(true); const lo = ROLLBOX.setFromObject(b, true).min.y; b.position.y += this.pos.y + 0.02 - lo; }   // 転がっている間は、体のいちばん低い所を地面にそろえる（もぐらない・浮かない）
    this.moving = len>0.01; this.running = run && this.moving; if (this.running || this.air > 0.05) this.loudT = performance.now();   // セミ取り：走った・跳んだ時刻
    if (!this.camOverride) this.updateCam(dt);
  }
  updateCam(dt){
    // 一人称：目の高さから、camYaw の向きを見る。軽トラでは右側の運転席から、自転車と原付では進む向きを向く
    const head = this.ch.n.head;
    if (this.firstPerson){ const e = FP_EYE;
      if (this.driving){ const m = this.driving.mesh.position, y = this.driving.mesh.rotation.y; e.set(m.x + Math.sin(y)*0.42 - Math.cos(y)*0.32, m.y + 1.42, m.z + Math.cos(y)*0.42 + Math.sin(y)*0.32); }
      else { head.getWorldPosition(e); e.y += 0.12; e.x -= Math.sin(this.camYaw)*0.12; e.z -= Math.cos(this.camYaw)*0.12; }
      if (this.riding){ let d = this.yaw + Math.PI - this.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (this.bikeSpeed > 1) this.camYaw += d*Math.min(1, dt*3); }
      if (head) head.visible = false; const fp = this.fpPitch || 0, cy = this.camYaw;
      this.camPos.copy(e); this.cam.position.copy(e); this.look.set(e.x - Math.sin(cy)*Math.cos(fp), e.y + Math.sin(fp), e.z - Math.cos(cy)*Math.cos(fp)); this.cam.lookAt(this.look); return; }
    if (head && !head.visible) head.visible = true;
    const cy = this.camYaw, cp = this.camPitch, d = this.camDist;
    const tx = this.pos.x + Math.sin(cy)*Math.cos(cp)*d, tz = this.pos.z + Math.cos(cy)*Math.cos(cp)*d; let tyy = this.pos.y + 1.5 + Math.sin(cp)*d;
    if (this.room){ const b = this.roomBox(); if (b){ const ox = this.pos.x, oy = this.pos.y + 1.35, oz = this.pos.z; let t = 1;   // 頭から見る線が壁や天井に当たる手前でカメラを止める（横にずらすと外が見える）
        for (const [o, d, lo, hi] of [[ox, tx - ox, b[0], b[1]], [oy, tyy - oy, b[2], b[3]], [oz, tz - oz, b[4], b[5]]]){ if (d > 1e-6) t = Math.min(t, (hi - o)/d); else if (d < -1e-6) t = Math.min(t, (lo - o)/d); }
        t = Math.max(0, t); this.camClamp = [ox + (tx - ox)*t, oy + (tyy - oy)*t, oz + (tz - oz)*t]; }
      else { const r = this.room; this.camClamp = [Math.min(r.maxX, Math.max(r.minX, tx)), Math.min(r.y+2.4, tyy), Math.min(r.maxZ, Math.max(r.minZ, tz))]; } }
    else if (this.camFix){ this.camClamp = this.camFix(tx, tyy, tz); }   // 校舎の中：壁と天井の手前で止める
    else { this.camClamp = null; tyy = Math.max(tyy, heightAt(tx, tz) + 0.6, 0.5); const h = this.camHit(tx, tyy, tz); if (h) this.camClamp = h; }   // 外：家や塀の中に入らないように
    const [qx, qy, qz] = this.camClamp || [tx, tyy, tz];
    const k = this.snap ? 1 : Math.min(1, dt*6); this.snap = false;
    this.camPos.x += (qx-this.camPos.x)*k; this.camPos.y += (qy-this.camPos.y)*k; this.camPos.z += (qz-this.camPos.z)*k;
    const b = this.room && this.roomBox(); if (b){ this.camPos.x = Math.min(b[1], Math.max(b[0], this.camPos.x)); this.camPos.y = Math.min(b[3], Math.max(b[2], this.camPos.y)); this.camPos.z = Math.min(b[5], Math.max(b[4], this.camPos.z)); }   // 追いかけの途中でも壁の外に出さない
    this.cam.position.copy(this.camPos); this.look.set(this.pos.x, this.pos.y+1.35, this.pos.z); this.cam.lookAt(this.look);
  }
  // 外のカメラ：頭からカメラへの線を少しずつ進め、建物の当たり判定（高さの範囲も見る）に入る手前で止める。細い物（木・電柱）と車は見ない
  camHit(tx, ty, tz){ if (this.room || (window.G && window.G.indoor === 'home')) return null; const hx = this.pos.x, hy = this.pos.y + 1.4, hz = this.pos.z, len = Math.hypot(tx - hx, tz - hz) + 1.5, near = [];
    for (const c of this.col){ if (c.off || c.off0 !== undefined || (c.r !== undefined && c.r < 0.8)) continue; const rr = c.r !== undefined ? c.r : Math.hypot(c.w, c.d)/2; if (Math.abs(c.x - hx) < len + rr && Math.abs(c.z - hz) < len + rr) near.push(c); }
    if (!near.length) return null; const N = 16;
    for (let i = 1; i <= N; i++){ const t = i/N, x = hx + (tx - hx)*t, y = hy + (ty - hy)*t, z = hz + (tz - hz)*t;
      for (const c of near){ if (c.y1 !== undefined && (y + 0.3 < c.y0 || y - 0.3 > c.y1)) continue; if (c.h !== undefined && y > heightAt(c.x, c.z) + c.h + 0.3) continue;
        let inside; if (c.r !== undefined) inside = Math.hypot(x - c.x, z - c.z) < c.r + 0.45;
        else { const cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0), ex = x - c.x, ez = z - c.z; inside = Math.abs(ex*cs - ez*sn) < c.w/2 + 0.45 && Math.abs(ex*sn + ez*cs) < c.d/2 + 0.45; }   // 0.45 は画面の手前の切れ目（0.3）ぶんの余裕
        if (inside){ const k = Math.max(0.1, (i - 1)/N); return [hx + (tx - hx)*k, Math.max(hy + (ty - hy)*k, heightAt(hx + (tx - hx)*k, hz + (tz - hz)*k) + 0.6), hz + (tz - hz)*k]; } } }
    return null; }
  // 部屋の中でカメラが動ける箱（壁・天井から、画面の手前の切れ目ぶん内側）
  roomBox(){ const r = this.room; if (!r || !r.walls) return null; const [hx, hz, h] = r.walls, m = 0.45;
    return [r.x - hx + m, r.x + hx - m, r.y + 0.3, r.y + h - 0.35, r.z - hz + m, r.z + hz - m]; }
  // 前フレームに加えた首振りオフセットを外し、ch.update がアニメーション角度だけを補間できるようにする
  clearHeadLook(){
    const head = this.ch.n.head;
    if (head){
      head.rotation.x -= this._headApplied.pitch;
      head.rotation.y -= this._headApplied.yaw;
    }
    this._headApplied.yaw = 0;
    this._headApplied.pitch = 0;
  }
  // 選択中の対象へ頭を緩やかに向ける（一人称や乗車・水泳・受け身・操作停止中は正面へ戻す）
  updateHeadLook(target, dt){
    this.clearHeadLook();
    const active = !!(target && !this.locked && !this.driving && !this.riding && !this.carry
      && !this.swimming && !(this.rollT > 0) && !this.pose && !this.firstPerson && !this.frozen);
    const goal = active ? computeHeadLook(this.pos, this.yaw, target, { sitting: this.sitting }) : { yaw: 0, pitch: 0 };
    this.headLook = smoothHeadLook(this.headLook, goal, dt);
    const head = this.ch.n.head;
    if (head && !this.firstPerson){
      head.rotation.x += this.headLook.pitch;
      head.rotation.y += this.headLook.yaw;
      this._headApplied.pitch = this.headLook.pitch;
      this._headApplied.yaw = this.headLook.yaw;
    }
  }
}
