import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W } from './config';
import { ShiftScene } from './scenes/ShiftScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: COLORS.night,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [ShiftScene],
});
