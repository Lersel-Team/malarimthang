// UI kit (owner: art-ui agent). Stable API for every scene:
//   import { uiPanel, uiButton, uiTheme, ... } from '../art/ui';
// Conventions: x,y are the CENTRE of a widget (uiPanel accepts { origin: 'topLeft' }). Sizes are logical px.
// Textures are rasterised once in preloadUi (called from BootScene via preloadAllArt).
import type Phaser from 'phaser';
import { preloadUiTextures } from './ui/textures';

export async function preloadUi(scene: Phaser.Scene): Promise<void> {
  await preloadUiTextures(scene);
}

export * from './ui/theme';
export * from './ui/widgets';
export * from './ui/backdrop';
export { uiItemPic } from './ui/itemPic';
export { ICON_NAMES, iconSvg, type UiIconName } from './ui/icons';
export type { BtnKind, PillKind, BarKind } from './ui/textures';
