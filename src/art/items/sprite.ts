// Skewer sprite: stick + N chunk images with cook-stage crossfade, oil sheen and sauce glaze.
import Phaser from 'phaser';
import { CHUNK_H, CHUNK_W, itemKey, type Stage } from './chunks';

export type Sauce = 'none' | 'good' | 'early';
export interface SkewerOpts {
  /** 13+ lane grills: 3 smaller chunks. */
  compact?: boolean;
  /** Body height (stick span) in logical px, default 92. */
  bodyH?: number;
}
export const BODY_H = 92;
const STICK_EXTRA_TOP = 14, STICK_EXTRA_BOT = 10;

/** Number of chunks on a skewer of this item. */
export function chunkCount(itemId: string, compact: boolean): number {
  return compact || itemId === 'enoki' ? 3 : 4;
}

export class SkewerSprite extends Phaser.GameObjects.Container {
  readonly itemId: string;
  readonly bodyH: number;
  private base: Phaser.GameObjects.Image[] = [];
  private over: Phaser.GameObjects.Image[] = [];
  private oil: Phaser.GameObjects.Image[] = [];
  private glaze: Phaser.GameObjects.Image[] = [];
  private burstImgs: Phaser.GameObjects.Image[] = [];
  private stickImg: Phaser.GameObjects.Image;
  private a: Stage = 'raw';
  private b: Stage = 'raw';
  private mixT = 0;

  constructor(scene: Phaser.Scene, itemId: string, opts: SkewerOpts = {}) {
    super(scene, 0, 0);
    this.itemId = itemId;
    const H = (this.bodyH = opts.bodyH ?? BODY_H);
    const compact = !!opts.compact;
    const n = chunkCount(itemId, compact);
    const cs = compact ? 0.82 : 1;
    const top = -H / 2 - STICK_EXTRA_TOP;
    const stickLen = H + STICK_EXTRA_TOP + STICK_EXTRA_BOT;
    this.stickImg = scene.add.image(0, top, 'skewer-stick').setOrigin(0.5, 0).setDisplaySize(6, stickLen);
    this.add(this.stickImg);
    const pitch = (H - 24) / (n - 1);
    for (let i = 0; i < n; i++) {
      const y = -H / 2 + 12 + i * pitch;
      const mk = (key: string) => scene.add.image(0, y, key).setDisplaySize(CHUNK_W * cs, CHUNK_H * cs);
      const base = mk(itemKey(itemId, 'raw'));
      const over = mk(itemKey(itemId, 'raw')).setAlpha(0);
      const glaze = mk(itemKey(itemId, 'glaze')).setVisible(false);
      const oil = mk(itemKey(itemId, 'oil')).setVisible(false);
      const burst = scene.add.image(0, y, 'fx-burst').setDisplaySize(36 * cs, 20 * cs).setVisible(false);
      this.base.push(base);
      this.over.push(over);
      this.glaze.push(glaze);
      this.oil.push(oil);
      this.burstImgs.push(burst);
      this.add([base, over, glaze, oil, burst]);
    }
    scene.add.existing(this);
  }

  /** Show stage `a`, optionally crossfading to `b` by `t` (0..1). */
  setStage(a: Stage, b: Stage = a, t = 0): this {
    if (a !== this.a) {
      this.a = a;
      for (const im of this.base) im.setTexture(itemKey(this.itemId, a));
    }
    if (b !== this.b) {
      this.b = b;
      for (const im of this.over) im.setTexture(itemKey(this.itemId, b));
    }
    if (t !== this.mixT || a === b) {
      this.mixT = a === b ? 0 : t;
      for (const im of this.over) im.setAlpha(this.mixT);
    }
    return this;
  }

  private oiled = false;
  private sauced = false;
  private burst = false;
  private vis(): void {
    for (let i = 0; i < this.base.length; i++) {
      this.base[i].setVisible(!this.burst);
      this.over[i].setVisible(!this.burst);
      this.glaze[i].setVisible(!this.burst && this.sauced);
      this.oil[i].setVisible(!this.burst && this.oiled);
      this.burstImgs[i].setVisible(this.burst);
    }
  }

  setOiled(on: boolean): this {
    if (on !== this.oiled) {
      this.oiled = on;
      this.vis();
    }
    return this;
  }

  /** Sauce glaze; colour/strength come from the caller (darkens as it burns). */
  setSauce(kind: Sauce, tint = 0x9a3a22, alpha = 0.6): this {
    const on = kind !== 'none';
    if (on !== this.sauced) {
      this.sauced = on;
      this.vis();
    }
    if (on) for (const im of this.glaze) im.setTint(kind === 'early' ? 0x7a2a12 : tint).setAlpha(alpha);
    return this;
  }

  setBurst(on: boolean): this {
    if (on !== this.burst) {
      this.burst = on;
      this.vis();
    }
    return this;
  }
}

/** Builds a skewer sprite (stick + chunks) for an item. */
export function drawSkewerSprite(scene: Phaser.Scene, itemId: string, opts: SkewerOpts = {}): SkewerSprite {
  return new SkewerSprite(scene, itemId, opts);
}
