// ローカルLLM（WebLLM）をWebGPUで動かすワーカー。ゲームの描画を止めないように、別スレッドで推論する。
// ワーカーの中では importmap が効かないので、相対パスで読む。
import { WebWorkerMLCEngineHandler } from '../vendor/web-llm/web-llm.js';
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = msg => handler.onmessage(msg);
