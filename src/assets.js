import * as THREE from 'three';
// テクスチャ読み込み。textures/<name>.png があれば使い、なければ仮テクスチャのまま。
const PLACE = { sand:'#e9e2cf', grass:'#7fa35a', asphalt:'#8a8a86', 'koga-stone':'#cfcdc4', rock:'#9a9488', water:'#3d8fb5',
  dirt:'#c9b48c', concrete:'#bdbab0', wood:'#8a6a48', roof:'#5c6470', 'school-wall':'#e6e1d2', window:'#9fc4d8', leaves:'#4f8a45', bark:'#6b523c' };
export const TEXTURES = new Set(['sand','grass','asphalt','koga-stone','rock','water','dirt','concrete','school-wall','school-windows','roof-tile','wood-wall','plaster','classroom-floor','blackboard','shop-front','house-front','vending','festival-sign','school-door','chainlink','leaves','pine-branch','palm-leaf','cloud','bark','face-boy','face-kouta','face-nagisa','face-kotoha','face-granny','face-oneesan','cloud-cb1','cloud-cb2','cloud-cb3','cloud-cu','cloud-st','face-ojisan','face-mother','face-father','face-sister','snack-shelf','goods-shelf','drink-case','fusuma','shoji-lit','bookshelf','poster','runway-view','souvenir-shelf','top-shirt','top-sailor','top-kappogi','skirt-pleats','cloth-navy','tin-roof','house-front2','noticeboard','manhole','garden-flowers','tatami']);
export const ALPHA = new Set(['leaves','pine-branch','palm-leaf','chainlink','manhole','garden-flowers']);
const cache = {};
function placeholder(name){
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  if (ALPHA.has(name) || name.startsWith('cloud')) return c;   // 透明部分のある画像は、届くまで見せない
  const hx = (PLACE[name] || '#b0b0b0'); const base = { r:parseInt(hx.slice(1,3),16)/255, g:parseInt(hx.slice(3,5),16)/255, b:parseInt(hx.slice(5,7),16)/255 };
  for (let y=0;y<64;y+=4) for (let x=0;x<64;x+=4){ const k = 0.9 + Math.random()*0.2; g.fillStyle = `rgb(${base.r*255*k|0},${base.g*255*k|0},${base.b*255*k|0})`; g.fillRect(x,y,4,4); }
  return c;
}
export function tex(name, {repeat=true, flipY=true}={}){
  const key = name + (flipY?'':'|n');
  if (cache[key]) return cache[key];
  const t = new THREE.CanvasTexture(placeholder(name));
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 1; t.generateMipmaps = true; t.flipY = flipY;
  cache[key] = t;
  const img = new Image();
  img.onload = () => { t.dispose(); t.image = img; t.needsUpdate = true; };
  img.onerror = () => {};
  img.src = `textures/${name}.png`;
  return t;
}
export function lambert(name, opt={}){
  const m = new THREE.MeshLambertMaterial({ map: tex(name, opt), ...(opt.mat||{}) });
  if (opt.alpha){ m.alphaTest = 0.5; m.side = THREE.DoubleSide; }
  return m;
}

export function textTex(text, {w=512, h=128, bg='#f4f0e4', fg='#3a2a22', font='bold 84px "Zen Maru Gothic", sans-serif', flipY=false}={}){
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const draw = () => { g.fillStyle = bg; g.fillRect(0,0,w,h); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w/2, h/2+4); t.needsUpdate = true; };
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = flipY; draw(); document.fonts && document.fonts.ready.then(draw); return t;
}
