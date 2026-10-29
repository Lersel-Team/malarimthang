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
