import Phaser from 'phaser';
import { setupCamera } from '../engine/hidpi';
import { GAME_W } from '../config';
import { newGame } from '../core/economy';
import { DEFAULT_SHOP_NAME, session } from '../session';
import { nightStreet, uiFadeIn, uiGlow, uiGoto, uiIcon, uiPanel, uiTheme } from '../art/ui';
import { openNameInput } from './nameInput';

/** First launch only: name the stall, then start a fresh game. */
export class NameScene extends Phaser.Scene {
  constructor() {
    super('Name');
  }
  create() {
    setupCamera(this);
    uiFadeIn(this);
    nightStreet(this);
    const cx = GAME_W / 2;
    // small sign: the DOM card (name input) sits below it
    const w = 280, h = 76;
    const c = this.add.container(cx, 78);
    const chains = this.add.graphics();
    chains.lineStyle(2, 0x10091c, 0.9);
    for (const sx of [-96, 96]) chains.lineBetween(sx, -h / 2 + 4, sx, -h / 2 - 90);
    c.add([chains, uiGlow(this, 0, 0, 340, 0.4), uiPanel(this, 0, 0, w, h, 'wood')]);
    c.add(
      this.add
        .text(0, 0, 'หม่าล่าริมทาง', { ...uiTheme.text.sign, fontSize: '34px', stroke: '#ff6a2a', strokeThickness: 3, padding: { x: 8, y: 12 } })
        .setOrigin(0.5)
        .setShadow(0, 0, '#ffb24a', 12, true, true),
    );
    this.tweens.add({ targets: c, y: 82, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const sk = uiIcon(this, cx, 176, 'skewer', 100).setAngle(-12);
    this.tweens.add({ targets: sk, angle: -4, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    openNameInput({
      game: this.game,
      title: 'ตั้งชื่อร้านของคุณ',
      initial: DEFAULT_SHOP_NAME,
      cancellable: false,
      confirmLabel: 'เริ่มเลย',
      dim: 0.12,
      onDone: (name) => {
        void session.commit({ ...newGame(), shopName: name ?? DEFAULT_SHOP_NAME }).then(() => uiGoto(this, 'Market'));
      },
    });
  }
}
