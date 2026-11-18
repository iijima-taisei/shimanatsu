// インタラクト対象の向き優先選択と、主人公の首振り注目計算

export const INTERACT_ANGLE_WEIGHT = 1.25;
export const HEAD_YAW_LIMIT = 0.85;
export const HEAD_PITCH_LIMIT = 0.45;
export const HEAD_SMOOTH_RATE = 10;

function clamp(v, lo, hi){
  return Math.max(lo, Math.min(hi, v));
}

// 対象候補の選択スコアを計算する（小さいほど優先）
// 自転車・原付の乗車中は、降車等の判定を妨げないよう従来の距離のみを使う
export function scoreInteract(item, pos, yaw, riding = false, dist){
  const dx = item.x - pos.x;
  const dz = item.z - pos.z;
  const d = dist !== undefined ? dist : Math.hypot(dx, dz);
  if (riding || d < 1e-6) return d;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const dot = clamp((fx*dx + fz*dz)/d, -1, 1);
  const angle = Math.acos(dot);
  return d + angle*INTERACT_ANGLE_WEIGHT;
}

// 探索範囲・有効条件を満たす候補から最良の対象を1つ選ぶ
export function pickInteractTarget(items, pos, yaw, riding = false){
  let best = 1e9;
  let chosen = null;
  for (const it of items){
    const d = Math.hypot(pos.x - it.x, pos.z - it.z);
    if (d >= it.r) continue;
    const score = riding ? d : scoreInteract(it, pos, yaw, false, d);
    if (score < best && it.when()){
      best = score;
      chosen = it;
    }
  }
  return chosen;
}

// 対象へ顔を向けるための相対ヨー・ピッチ角（rad）を可動域内にクランプして返す
export function computeHeadLook(pos, yaw, target, opt = {}){
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const distXZ = Math.hypot(dx, dz);
  if (distXZ < 0.05) return { yaw: 0, pitch: 0 };

  const targetYaw = Math.atan2(dx, dz);
  const relYaw = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
  const clampedYaw = clamp(relYaw, -HEAD_YAW_LIMIT, HEAD_YAW_LIMIT);

  const eyeY = pos.y + (opt.sitting ? 1.15 : 1.55);
  const targetY = target.y !== undefined ? target.y : (pos.y + 1.25);
  const dy = targetY - eyeY;
  // Three.js の head.rotation.x は負で上向き、正で下向き
  const rawPitch = -Math.atan2(dy, distXZ);
  const clampedPitch = clamp(rawPitch, -HEAD_PITCH_LIMIT, HEAD_PITCH_LIMIT);

  return { yaw: clampedYaw, pitch: clampedPitch };
}

// フレームレート非依存の平滑化で現在の首振り角を目標角へ近づける
export function smoothHeadLook(current, goal, dt, rate = HEAD_SMOOTH_RATE){
  const alpha = dt > 0 ? 1 - Math.exp(-dt*rate) : 0;
  return {
    yaw: current.yaw + (goal.yaw - current.yaw)*alpha,
    pitch: current.pitch + (goal.pitch - current.pitch)*alpha,
  };
}
