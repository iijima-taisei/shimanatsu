// ローカルLLM（試験）。WebLLM を WebGPU で動かす。モデルは最初の1回だけ Hugging Face から取ってきて、ブラウザに保存する。
// 推論はワーカー（src/llm-worker.js）でするので、ゲームの描画は止まらない。頼みごとは1つずつ順に処理する（priority は先に）。
// かるい：gemma3 1B（1本 約0.6秒、ときどき日本語が崩れる）。かしこい：gemma 4 E2B（1本 約2秒、状況をよく拾う自然な文。GPUメモリ約3.4GB）
export const MODELS = { light:{ id:'gemma3-1b-it-q4f16_1-MLC', size:'約550MB', name:'gemma3 1B' }, smart:{ id:'gemma-4-E2B-it-q4f16_1-MLC', size:'約2.7GB', name:'gemma 4 E2B' } };
export const LLM = { status:'off', progress:'', engine:null, error:'', model:null };   // status: off / loading / ready / error
export const llmSupported = () => !!navigator.gpu;
const queue = []; let busy = false;
// kind は 'light' か 'smart'。ちがうモデルが読みこまれていたら、いったん片づけて読み直す
export async function llmStart(onChange, kind='light'){
  const M = MODELS[kind] || MODELS.light;
  if (LLM.status === 'loading') { LLM.next = kind; return; }
  if (LLM.status === 'ready' && LLM.model === M.id) return;
  if (LLM.engine){ LLM.status = 'loading'; for (const j of queue.splice(0)) j.res(null); while (busy) await new Promise(r => setTimeout(r, 50)); try { await LLM.engine.unload(); } catch (e) {} LLM.engine = null; } if (!llmSupported()){ LLM.status = 'error'; LLM.error = 'このブラウザは WebGPU が使えません'; onChange && onChange(); return; }
  LLM.status = 'loading'; LLM.progress = '準備中…'; onChange && onChange();
  try {
    const { CreateWebWorkerMLCEngine } = await import('../vendor/web-llm/web-llm.js');
    LLM.model = M.id; LLM.name = M.name;
    LLM.engine = await CreateWebWorkerMLCEngine(new Worker(new URL('./llm-worker.js', import.meta.url), { type:'module' }), M.id,
      { initProgressCallback: p => { LLM.progress = `${Math.round((p.progress || 0)*100)}%`; onChange && onChange(); } });
    LLM.status = 'ready'; LLM.progress = ''; onChange && onChange(); pump();
    if (LLM.next && MODELS[LLM.next].id !== LLM.model){ const k = LLM.next; LLM.next = null; llmStart(onChange, k); } else LLM.next = null;
  } catch (e){ console.warn('LLM', e); LLM.status = 'error'; LLM.error = String(e.message || e).slice(0, 80); onChange && onChange(); }
}
// prompt を投げて、返事の文字列（失敗したら null）を返す
export function llmAsk(prompt, { maxTokens=48, temperature=0.85, priority=false } = {}){
  if (LLM.status !== 'ready') return Promise.resolve(null);
  return new Promise(res => { const job = { prompt, maxTokens, temperature, res }; if (priority) queue.unshift(job); else queue.push(job); if (queue.length > 6) { const old = queue.splice(6); for (const j of old) j.res(null); } pump(); });
}
async function pump(){ if (busy || LLM.status !== 'ready' || !queue.length) return; busy = true; const j = queue.shift();
  try { const r = await LLM.engine.chat.completions.create({ messages:[{ role:'user', content:j.prompt }], max_tokens:j.maxTokens, temperature:j.temperature, top_p:0.92 }); j.res(r.choices[0].message.content || null); }
  catch (e){ console.warn('LLM ask', e); j.res(null); }
  busy = false; pump(); }
