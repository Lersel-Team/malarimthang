import Phaser from 'phaser';
import { FONT } from './grill/draw';

export function makeBtn(scene: Phaser.Scene, x: number, y: number, label: string, bg: string, fn: () => void, size = 18, pad = { x: 14, y: 8 }) {
  const t = scene.add
    .text(x, y, label, { fontFamily: FONT, fontSize: `${size}px`, color: '#fff', backgroundColor: bg, padding: pad, align: 'center' })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  t.on('pointerdown', () => t.setAlpha(0.7));
  t.on('pointerout', () => t.setAlpha(1));
  t.on('pointerup', () => {
    t.setAlpha(1);
    fn();
  });
  return t;
}

export function toastAt(scene: Phaser.Scene, x: number, y: number, msg: string) {
  const t = scene.add
    .text(x, y, msg, { fontFamily: FONT, fontSize: '16px', color: '#fff', stroke: '#000', strokeThickness: 4 })
    .setOrigin(0.5)
    .setDepth(500);
  scene.tweens.add({ targets: t, y: y - 24, alpha: 0, delay: 600, duration: 500, onComplete: () => t.destroy() });
}

export const baht = (n: number) => `฿${Math.round(n).toLocaleString('en-US')}`;
