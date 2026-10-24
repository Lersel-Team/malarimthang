import Phaser from 'phaser';
import { setupCamera } from '../engine/hidpi';
import { GAME_H, GAME_W } from '../config';
import { newGame } from '../core/economy';
import { DEFAULT_SHOP_NAME, session } from '../session';
import { FONT } from './grill/draw';
import { openNameInput } from './nameInput';

/** First launch only: name the stall, then start a fresh game. */
export class NameScene extends Phaser.Scene {
  constructor() {
    super('Name');
  }
  create() {
    setupCamera(this);
    this.add.text(GAME_W / 2, GAME_H * 0.3, '🍢', { fontFamily: FONT, fontSize: '64px' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, GAME_H * 0.42, 'ร้านหม่าล่าริมทาง', { fontFamily: FONT, fontSize: '22px', color: '#ffd9a0' }).setOrigin(0.5);
    openNameInput({
      game: this.game,
      title: 'ตั้งชื่อร้านของคุณ',
      initial: DEFAULT_SHOP_NAME,
      cancellable: false,
      confirmLabel: 'เริ่มเลย ▶',
      onDone: (name) => {
        void session.commit({ ...newGame(), shopName: name ?? DEFAULT_SHOP_NAME }).then(() => this.scene.start('Market'));
      },
    });
  }
}
