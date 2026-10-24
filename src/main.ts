import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W } from './config';
import { BootScene } from './scenes/BootScene';
import { MarketScene } from './scenes/MarketScene';
import { NameScene } from './scenes/NameScene';
import { ShiftScene } from './scenes/ShiftScene';
import { SummaryScene } from './scenes/SummaryScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: COLORS.night,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [BootScene, NameScene, MarketScene, ShiftScene, SummaryScene],
});
if (import.meta.env.DEV) void import('./devhooks').then((m) => m.exposeGame(game));
