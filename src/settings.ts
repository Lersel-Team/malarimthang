// Small device-level settings (not part of the game save).
const KEY = 'mrt.settings';
export interface Settings { fx: boolean; tutorialSeen: boolean }

function load(): Partial<Settings> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>; } catch { return {}; }
}
export const settings: Settings = {
  fx: load().fx ?? (navigator.hardwareConcurrency ?? 8) > 4,
  tutorialSeen: load().tutorialSeen ?? false,
};
export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void {
  settings[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

/** True when the primary input is a finger (phone/tablet). Dev override: ?device=pc|phone. */
function detectTouch(): boolean {
  const force = import.meta.env.DEV ? new URLSearchParams(location.search).get('device') : null;
  if (force === 'pc') return false;
  if (force === 'phone') return true;
  try {
    if (matchMedia('(pointer: coarse)').matches) return true;
    if (matchMedia('(pointer: fine)').matches) return false;
  } catch { /* fall through */ }
  return (navigator.maxTouchPoints ?? 0) > 0;
}
export const isTouchDevice = detectTouch();

/** Game-time multiplier: a mouse is slower to aim than a finger, so PC plays at a gentler pace. */
export const INPUT_SPEED = isTouchDevice ? 1 : 0.75;
