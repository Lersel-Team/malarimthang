// Adapter for item pictures. Uses itemIcon() from ../items once the art-items agent exports it,
// otherwise falls back to the legacy Graphics icon. Swapping is automatic.
import type Phaser from 'phaser';
import * as items from '../items';
import { ITEM_BY_ID } from '../../data/balance';
import { drawIcon } from '../../scenes/grill/draw';

type ItemIconFn = (scene: Phaser.Scene, itemId: string, size: number) => Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;

/** A game object showing the item, about `size` logical px tall, centred on its position. */
export function uiItemPic(scene: Phaser.Scene, itemId: string, size: number): Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform {
  const fn = (items as unknown as { itemIcon?: ItemIconFn }).itemIcon;
  if (fn) return fn(scene, itemId, size);
  const g = scene.add.graphics();
  const def = ITEM_BY_ID[itemId];
  if (def) drawIcon(g, def);
  return g.setScale(size / 30);
}
