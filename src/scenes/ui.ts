import Phaser from 'phaser';
import { FONT } from './grill/draw';
import { baht, uiButton, uiToast, type UiIconName } from '../art/ui';

export { baht };

/** Legacy helper kept for compatibility: now a kit button (primary variant). `bg` is ignored. */
export function makeBtn(scene: Phaser.Scene, x: number, y: number, label: string, _bg: string, fn: () => void, size = 18) {
  return uiButton(scene, x, y, Math.max(120, label.length * size * 0.7 + 40), Math.max(44, size * 2.2), label, { fontSize: size, onClick: fn });
}

/** Toast pill (kit). `icon` optional. */
export function toastAt(scene: Phaser.Scene, x: number, y: number, msg: string, icon?: UiIconName) {
  uiToast(scene, msg, { x, y, icon });
}

void FONT;
