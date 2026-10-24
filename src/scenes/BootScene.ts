import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W } from '../config';
import { session } from '../session';
import { FONT } from './grill/draw';
import { setupCamera } from '../engine/hidpi';

const THAI = 'หม่าล่าริมทาง ตลาดเช้า กำลังก่อถ่าน';
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
  constructor() {
    super('Boot');
  }
  create() {
    setupCamera(this);
    void loadFonts().then(() => this.boot());
  }
  private boot() {
    this.add.text(GAME_W / 2, GAME_H / 2 - 20, 'หม่าล่าริมทาง', { fontFamily: FONT, fontSize: '34px', color: '#ffd9a0', stroke: '#ff5a2a', strokeThickness: 2 }).setOrigin(0.5);
    const sub = this.add.text(GAME_W / 2, GAME_H / 2 + 24, 'กำลังก่อถ่าน...', { fontFamily: FONT, fontSize: '16px', color: COLORS.text }).setOrigin(0.5);
    void session.init().then((s) => {
      if (s) {
        sub.setText(s.shopName);
        this.scene.start('Market');
      } else {
        this.scene.start('Name');
      }
    });
  }
}
