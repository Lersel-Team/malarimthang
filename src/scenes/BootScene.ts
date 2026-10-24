import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { session } from '../session';
import type { GameState } from '../core/economy';
import { setupCamera } from '../engine/hidpi';
import { preloadAllArt } from '../art';
import { nightStreet, preloadUi, uiBar, uiFadeIn, uiGlow, uiGoto, uiIcon, uiPanel, uiTheme, type UiBar } from '../art/ui';

const THAI = 'หม่าล่าริมทาง ตลาดเช้า กำลังก่อถ่าน หั่นหมูสามชั้น เสียบไม้';
const LINES = [
  'กำลังก่อถ่าน...',
  'หั่นหมูสามชั้น...',
  'เสียบไม้ลูกชิ้น...',
  'ตำน้ำจิ้มแจ่ว...',
  'โรยผงหม่าล่า...',
  'จัดโต๊ะริมทาง...',
];
async function loadFonts(): Promise<void> {
  const all = Promise.all([
    document.fonts.load('400 16px Kanit'),
    document.fonts.load('700 16px Kanit'),
    document.fonts.load('700 16px Mali'),
    document.fonts.load('400 16px Kanit', THAI),
    document.fonts.load('700 16px Mali', THAI),
  ]).then(() => undefined);
  await Promise.race([all.catch(() => undefined), new Promise<void>((r) => setTimeout(r, 3000))]);
}

export class BootScene extends Phaser.Scene {
  private bar: UiBar | null = null;
  private skewer: Phaser.GameObjects.Image | null = null;
  private progress = 0;
  private done = false;
  private art!: Promise<[GameState | null, void]>;
  constructor() {
    super('Boot');
  }
  create() {
    setupCamera(this);
    this.progress = 0;
    this.done = false;
    this.bar = null;
    // art bakes while the fonts load (SVG textures need no web fonts)
    this.art = Promise.all([session.init(), preloadAllArt(this).catch((e) => console.warn('art preload failed', e))]);
    void loadFonts()
      .then(() => preloadUi(this))
      .then(() => this.boot());
  }

  update(_t: number, dt: number) {
    if (!this.bar) return;
    // ease toward 90 % while loading; jump to 100 % when done
    const target = this.done ? 1 : 0.9;
    this.progress += (target - this.progress) * Math.min(1, dt / (this.done ? 120 : 900));
    this.bar.setValue(this.progress, false);
    if (this.skewer) {
      this.skewer.x = GAME_W / 2 - 120 + 240 * this.progress - 4;
      this.skewer.y = 556 + Math.sin(this.time.now / 160) * 1.2;
    }
  }

  private boot() {
    uiFadeIn(this, 300);
    nightStreet(this);
    const cx = GAME_W / 2;

    // hanging neon sign
    const sign = this.add.container(cx, 190);
    const w = 312, h = 128;
    const chains = this.add.graphics();
    chains.lineStyle(2, 0x10091c, 0.9);
    for (const sx of [-110, 110]) chains.lineBetween(sx, -h / 2 + 4, sx, -h / 2 - 190);
    const glow = uiGlow(this, 0, 0, 420, 0.45);
    const board = uiPanel(this, 0, 0, w, h, 'wood');
    const inner = this.add.graphics();
    inner.lineStyle(2, 0xffb24a, 0.55).strokeRoundedRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 10);
    const title = this.add
      .text(0, -4, 'หม่าล่าริมทาง', { ...uiTheme.text.sign, fontSize: '42px', color: '#fff4dc', stroke: '#ff6a2a', strokeThickness: 3, padding: { x: 10, y: 14 } })
      .setOrigin(0.5);
    title.setShadow(0, 0, '#ffb24a', 14, true, true);
    const subtitle = this.add.text(0, 36, 'เสียบไม้ ปิ้งไฟ ลุ้นเงินริมทาง', { ...uiTheme.text.small, color: '#ffd9a0', fontSize: '14px' }).setOrigin(0.5);
    const sk = uiIcon(this, w / 2 - 30, -h / 2 + 4, 'skewer', 52).setAngle(8);
    const sk2 = uiIcon(this, -w / 2 + 28, h / 2 - 6, 'chili', 34).setAngle(-12);
    sign.add([chains, glow, board, inner, title, subtitle, sk, sk2]);
    this.tweens.add({ targets: sign, y: 196, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: glow, alpha: 0.3, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: title, alpha: { from: 1, to: 0.9 }, duration: 90, yoyo: true, repeat: -1, repeatDelay: 2600 });

    // loading bar with a skewer riding the fill
    this.bar = uiBar(this, cx, 566, 240, { h: 16, value: 0, kind: 'xp' });
    this.skewer = uiIcon(this, cx - 114, 556, 'skewer', 40).setAngle(45);
    this.skewer.setDepth(2);
    const line = this.add.text(cx, 596, LINES[0], { ...uiTheme.text.body, fontSize: '16px' }).setOrigin(0.5);
    let li = 0;
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.done) return;
        li = (li + 1) % LINES.length;
        this.tweens.add({ targets: line, alpha: 0, y: 590, duration: 160, onComplete: () => {
          line.setText(LINES[li]).setY(602);
          this.tweens.add({ targets: line, alpha: 1, y: 596, duration: 200 });
        } });
      },
    });

    const started = this.time.now;
    void this.art.then(([s]) => {
      this.done = true;
      line.setText(s ? s.shopName : 'พร้อมแล้ว!');
      line.setAlpha(1).setY(596);
      const wait = Math.max(450, 1100 - (this.time.now - started));
      this.time.delayedCall(wait, () => uiGoto(this, s ? 'Market' : 'Name'));
    });
    void GAME_H;
  }
}
