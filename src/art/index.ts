import type Phaser from 'phaser';
import { preloadItems } from './items';
import { preloadShop } from './shop';
import { preloadUi } from './ui';

/** Rasterises all SVG art at RES×. Called once from BootScene before any scene uses a texture. */
export async function preloadAllArt(scene: Phaser.Scene): Promise<void> {
  await Promise.all([preloadItems(scene), preloadShop(scene), preloadUi(scene)]);
}
