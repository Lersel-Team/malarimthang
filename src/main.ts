import '@fontsource/kanit/latin-400.css';
import '@fontsource/kanit/latin-500.css';
import '@fontsource/kanit/latin-700.css';
import '@fontsource/kanit/thai-400.css';
import '@fontsource/kanit/thai-500.css';
import '@fontsource/kanit/thai-700.css';
import '@fontsource/mali/thai-400.css';
import '@fontsource/mali/thai-700.css';
import Phaser from 'phaser';
import { RES } from './engine/hidpi';
import { COLORS, GAME_H, GAME_W } from './config';
import { BootScene } from './scenes/BootScene';
import { MarketScene } from './scenes/MarketScene';
import { NameScene } from './scenes/NameScene';
import { ShiftScene } from './scenes/ShiftScene';
import { SummaryScene } from './scenes/SummaryScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W * RES,
  height: GAME_H * RES,
  backgroundColor: COLORS.night,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [BootScene, NameScene, MarketScene, ShiftScene, SummaryScene],
});
void import('./devpanel').then((m) => m.mountDevPanel(game));
if (import.meta.env.DEV) void import('./devhooks').then((m) => m.exposeGame(game));
