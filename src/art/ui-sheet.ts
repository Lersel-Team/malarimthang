// Dev page (/ui-kit.html): every UI kit component on one scrollable sheet. Drag or wheel to scroll; ?y=NNN jumps.
import '@fontsource/kanit/latin-400.css';
import '@fontsource/kanit/latin-700.css';
import '@fontsource/kanit/thai-400.css';
import '@fontsource/kanit/thai-700.css';
import '@fontsource/mali/thai-700.css';
import Phaser from 'phaser';
import { RES, pt, setupCamera } from '../engine/hidpi';
import { GAME_H, GAME_W } from '../config';
import {
  ICON_NAMES, marketWall, preloadUi, uiBadge, uiBanner, uiBar, uiButton, uiConfetti, uiCounter, uiDivider, uiIcon, uiMoney, uiPanel, uiPill,
  uiRibbon, uiSectionHeader, uiStamp, uiStars, uiTheme, uiToast, uiModal, nightStreet,
} from './ui';

class Sheet extends Phaser.Scene {
  constructor() {
    super('Sheet');
  }
  async create() {
    setupCamera(this);
    await Promise.all([document.fonts.load('700 16px Mali', 'หม่าล่า'), document.fonts.load('400 16px Kanit', 'ก')]).catch(() => 0);
    await preloadUi(this);
    nightStreet(this);
    const root = this.add.container(0, 0);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => (root.add(o), o);
    let y = 24;
    const head = (s: string) => {
      add(uiSectionHeader(this, 180, y + 8, s, { w: 320 }));
      y += 34;
    };
    head('Panels');
    add(uiPanel(this, 16, y, 160, 90, 'wood', { origin: 'topLeft' }));
    add(uiPanel(this, 184, y, 160, 90, 'glass', { origin: 'topLeft' }));
    y += 106;
    add(uiPanel(this, 16, y, 160, 90, 'cream', { origin: 'topLeft' }));
    add(uiPanel(this, 184, y, 160, 90, 'tag', { origin: 'topLeft' }));
    y += 110;
    const rec = add(uiPanel(this, 16, y, 160, 130, 'receipt', { origin: 'topLeft' }));
    add(this.add.text(96, y + 66, 'ใบเสร็จ', { ...uiTheme.text.paperBold }).setOrigin(0.5));
    void rec;
    add(uiPanel(this, 184, y, 160, 130, 'ticket', { origin: 'topLeft' }));
    add(this.add.text(264, y + 80, 'ตั๋วออเดอร์', { ...uiTheme.text.paperBold }).setOrigin(0.5));
    y += 156;
    head('Buttons');
    y += 24;
    const bt = (x: number, label: string, o: Parameters<typeof uiButton>[6], w = 150) => add(uiButton(this, x, y, w, 48, label, { ...o, onClick: () => uiToast(this, label, { icon: 'check' }) }));
    bt(96, 'เปิดร้าน', { variant: 'primary' });
    bt(264, 'รอง', { variant: 'secondary' });
    y += 58;
    bt(96, 'ยืมแม่', { variant: 'green', icon: 'money' });
    bt(264, 'ghost', { variant: 'ghost' });
    y += 58;
    bt(96, 'ปิดใช้', { variant: 'primary', disabled: true });
    add(uiButton(this, 220, y, 44, 44, '', { variant: 'icon', icon: 'gear' }));
    add(uiButton(this, 272, y, 44, 44, '', { variant: 'icon', icon: 'sound' }));
    add(uiButton(this, 324, y, 44, 44, '', { variant: 'icon', icon: 'brush' }));
    y += 66;
    head('Pills, badges, money, ribbons');
    y += 20;
    add(uiPill(this, 80, y, 'วันที่ 3', { icon: 'clock' }));
    add(uiPill(this, 180, y, 'เลเวล 5', { icon: 'level', kind: 'lamp' }));
    add(uiPill(this, 280, y, '4.5', { icon: 'star', kind: 'cream' }));
    y += 36;
    add(uiBadge(this, 60, y, '3'));
    add(uiBadge(this, 100, y, 'NEW', 'green'));
    add(uiRibbon(this, 190, y, 'ถูกวันนี้', 'cheap'));
    add(uiRibbon(this, 290, y, 'แพงวันนี้', 'dear'));
    y += 40;
    const m = add(uiMoney(this, 100, y, { value: 120 }));
    add(uiMoney(this, 260, y, { value: 99999, h: 36 }));
    this.time.addEvent({ delay: 2200, loop: true, callback: () => m.setValue(Math.round(100 + Math.random() * 9000)) });
    y += 44;
    head('Stars, bars');
    y += 14;
    add(uiStars(this, 100, y, 3.5, { size: 24 }));
    add(uiStars(this, 270, y, 5, { size: 20 }));
    y += 34;
    const b = add(uiBar(this, 180, y, 300, { value: 0.62 }));
    this.time.addEvent({ delay: 3000, loop: true, callback: () => b.setValue(Math.random()) });
    y += 24;
    add(uiBar(this, 180, y, 300, { kind: 'green', value: 0.3, h: 12 }));
    y += 20;
    add(uiBar(this, 180, y, 300, { kind: 'red', value: 0.85, h: 12 }));
    y += 30;
    head('Divider, stamp, banner');
    y += 8;
    add(uiDivider(this, 180, y, 300, 'line'));
    y += 16;
    add(uiDivider(this, 180, y, 300, 'dashed'));
    y += 16;
    add(uiDivider(this, 180, y, 300, 'dots'));
    y += 44;
    add(uiStamp(this, 100, y, 'กำไร', '#1a7a3a')).slam(300);
    add(uiStamp(this, 260, y, 'ขาดทุน', '#c01818')).slam(600);
    y += 56;
    add(uiBanner(this, 180, y, 'เลเวลอัป! เลเวล 5'));
    y += 50;
    head('Icons');
    ICON_NAMES.forEach((n, i) => {
      const ix = 34 + (i % 6) * 58, iy = y + 10 + Math.floor(i / 6) * 56;
      add(uiPanel(this, ix, iy, 48, 48, 'glass', { shadow: false }));
      add(uiIcon(this, ix, iy, n, 28));
    });
    y += 3 * 56 + 20;
    add(uiButton(this, 180, y + 10, 200, 48, 'Toast', { variant: 'secondary', onClick: () => uiToast(this, 'ซื้อแล้ว 3 แพ็ค', { icon: 'cart' }) }));
    add(uiButton(this, 100, y + 70, 150, 48, 'Confetti', { onClick: () => uiConfetti(this, 180, 400) }));
    add(uiButton(this, 264, y + 70, 150, 48, 'Modal', { variant: 'green', onClick: () => { const md = uiModal(this, { w: 280, h: 200, title: 'เปลี่ยนชื่อร้าน', closable: true }); md.body.add(this.add.text(0, 0, 'เนื้อหา', uiTheme.text.body).setOrigin(0.5)); } }));
    y += 130;
    add(uiCounter(this, 0, y, GAME_W, 50));
    y += 80;
    void marketWall;

    const max = Math.max(0, y - GAME_H);
    let sy = Number(new URLSearchParams(location.search).get('y')) || 0;
    const set = (v: number) => { sy = Phaser.Math.Clamp(v, 0, max); root.y = -sy; };
    set(sy);
    let d: { y0: number; s0: number } | null = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (d = { y0: pt(p).y, s0: sy }));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => d && p.isDown && Math.abs(pt(p).y - d.y0) > 6 && set(d.s0 - (pt(p).y - d.y0)));
    this.input.on('pointerup', () => (d = null));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => set(sy + dy));
    (window as unknown as { __sheetMax: number }).__sheetMax = max;
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W * RES,
  height: GAME_H * RES,
  backgroundColor: '#1c1426',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Sheet],
});
(window as unknown as { __game: Phaser.Game }).__game = game;
