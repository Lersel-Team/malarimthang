import Phaser from 'phaser';
import { COLORS, GAME_W } from '../config';
import { ITEMS } from '../data/balance';
import {
  createGrill,
  extinguish,
  flip,
  item,
  placeSkewer,
  removeSkewer,
  sideZone,
  skewerQuality,
  tick,
  type Grill,
  type GrillEvent,
  type Skewer,
} from '../core/cooking';
import { Sfx } from '../audio/sfx';
import { BODY_H, FONT, drawBody, drawIndicators, makeTextures, mix, skewerSnapshot } from './grill/draw';

/** Number of grill slots. 4 for Sprint 1; 6-12 also lay out (6 per row). */
export const SLOT_COUNT = 4;
const HEAT_EVENNESS = 0.55;
const DRAG_PX = 10;

// Layout
const GRID_X = 16, GRID_W = 328, GRID_Y = 410, GRID_H = 158;
const TRAY = { x: 12, y: 268, w: 336, h: 126 };
const COOLER = { x: 8, y: 580, w: 240, h: 152 };
const BIN = { x: 256, y: 600, w: 54, h: 80 };
const WATER = { x: 318, y: 600, w: 34, h: 80 };

interface View {
  sk: Skewer;
  g: Phaser.GameObjects.Graphics;
  shownDown: 0 | 1;
  baseX: number;
  baseY: number;
}
interface Gesture {
  mode: 'skewer' | 'cooler' | 'fan' | 'bottle' | 'ui';
  sx: number;
  sy: number;
  slot: number;
  itemId?: string;
  ui?: () => void;
  dragging: boolean;
}
interface Served {
  sk: Skewer;
  q: number;
}

const inRect = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export class GrillScene extends Phaser.Scene {
  private grill!: Grill;
  private sfx!: Sfx;
  private views: (View | null)[] = [];
  private gestures = new Map<number, Gesture>();
  private served: Served[] = [];
  private stats = { perfect: 0, ok: 0, burnt: 0, bin: 0 };
  private qSum = 0;
  private ringOn = true;
  private waterMode = false;
  private coalG!: Phaser.GameObjects.Graphics;
  private trayG!: Phaser.GameObjects.Graphics;
  private bottleG!: Phaser.GameObjects.Graphics;
  private trayIcons: Phaser.GameObjects.GameObject[] = [];
  private flames: (Phaser.GameObjects.Image | null)[] = [];
  private smokeT: number[] = [];
  private lastSizzle: number[] = [];
  private hudText!: Phaser.GameObjects.Text;
  private heatText!: Phaser.GameObjects.Text;
  private ringBtn!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private steam!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeGrey!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeBlack!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private splat!: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers: { x: number; y: number; r: number; ph: number }[][] = [];
  private fanning = new Set<number>();

  constructor() {
    super('Grill');
  }

  // ---- geometry ----
  private cols = Math.min(SLOT_COUNT, 6);
  private rows = Math.ceil(SLOT_COUNT / 6);
  private cellW = GRID_W / this.cols;
  private cellH = GRID_H / this.rows;
  private coalH = this.rows === 1 ? 30 : 20;
  private cell(i: number) {
    const col = i % this.cols, row = Math.floor(i / this.cols);
    return { x: GRID_X + col * this.cellW, y: GRID_Y + row * this.cellH, w: this.cellW, h: this.cellH };
  }
  private skScale() {
    return Math.min(1, (this.cellH - this.coalH) / 150, this.cellW / 46);
  }
  private skPos(i: number) {
    const c = this.cell(i);
    return { x: c.x + c.w / 2, y: c.y + (c.h - this.coalH) / 2 + 4 };
  }

  create() {
    this.cols = Math.min(SLOT_COUNT, 6);
    this.rows = Math.ceil(SLOT_COUNT / 6);
    this.cellW = GRID_W / this.cols;
    this.cellH = GRID_H / this.rows;
    this.coalH = this.rows === 1 ? 30 : 20;

    this.sfx = (this.registry.get('sfx') as Sfx | undefined) ?? new Sfx();
    this.registry.set('sfx', this.sfx);
    this.sfx.stopAll();

    this.grill = createGrill(SLOT_COUNT, HEAT_EVENNESS, Math.random);
    this.views = Array(SLOT_COUNT).fill(null);
    this.flames = Array(SLOT_COUNT).fill(null);
    this.smokeT = Array(SLOT_COUNT).fill(0);
    this.lastSizzle = Array(SLOT_COUNT).fill(-1);
    this.gestures.clear();
    this.fanning.clear();
    this.served = [];
    this.stats = { perfect: 0, ok: 0, burnt: 0, bin: 0 };
    this.qSum = 0;
    this.waterMode = false;
    this.trayIcons = [];

    makeTextures(this);
    this.drawBackdrop();
    this.drawGrillFrame();
    this.drawCooler();
    this.buildEmbers();

    this.trayG = this.add.graphics();
    this.coalG = this.add.graphics().setDepth(1);
    this.bottleG = this.add.graphics();
    this.drawTrayFrame();
    this.drawBinAndBottle();
    this.buildHud();
    this.buildParticles();

    this.toast = this.add
      .text(GAME_W / 2, 378, '', { fontFamily: FONT, fontSize: '20px', color: '#fff', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(200)
      .setAlpha(0);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.events.once('shutdown', () => {
      this.sfx.stopAll();
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('pointerupoutside', this.onUp, this);
    });
    this.refreshTray();
    this.refreshHud();
  }

  // ---- static drawing ----
  private drawBackdrop() {
    const g = this.add.graphics();
    for (let i = 0; i < 13; i++) {
      g.fillStyle(mix(0x120a1e, 0x4a2a5a, i / 12), 1);
      g.fillRect(0, i * 20, GAME_W, 20);
    }
    g.fillStyle(0xfff0c8, 0.9);
    g.fillCircle(50, 40, 14);
    g.fillStyle(0x120a1e, 0.35);
    g.fillCircle(45, 36, 12);
    // skyline
    g.fillStyle(0x1c1426, 1);
    for (let x = 0, i = 0; x < GAME_W; x += 46, i++) g.fillRect(x, 70 + ((i * 37) % 40), 42, 120);
    g.fillStyle(0xf6c870, 0.8);
    for (let i = 0; i < 14; i++) g.fillRect(8 + ((i * 53) % 330), 84 + ((i * 29) % 70), 4, 5);
    // lamp glow
    for (let r = 90; r > 10; r -= 12) {
      g.fillStyle(COLORS.lamp, 0.05);
      g.fillCircle(296, 96, r);
    }
    g.fillStyle(0xffd890, 1);
    g.fillCircle(296, 96, 7);
    g.lineStyle(2, 0x3a2a3a, 1);
    g.lineBetween(296, 60, 296, 96);
    // stall awning
    for (let i = 0; i < 12; i++) {
      g.fillStyle(i % 2 ? 0xf2e6d0 : COLORS.mala, 1);
      g.fillTriangle(i * 30, 112, i * 30 + 30, 112, i * 30 + 15, 136);
      g.fillRect(i * 30, 98, 30, 14);
    }
    g.fillStyle(0x2a1a14, 1);
    g.fillRect(0, 150, GAME_W, 36);
    g.fillStyle(0x4a3226, 1);
    g.fillRect(0, 150, GAME_W, 5);
    this.add.text(GAME_W / 2, 168, 'หม่าล่าริมทาง', { fontFamily: FONT, fontSize: '16px', color: COLORS.text }).setOrigin(0.5);
    // hud panel
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(8, 190, 344, 70, 8);
    // lower background
    g.fillStyle(0x140d1c, 1);
    g.fillRect(0, 262, GAME_W, 480).setDepth(-1);
    g.setDepth(-2);
  }

  private drawTrayFrame() {
    const g = this.trayG;
    g.clear();
    g.fillStyle(0x2a1d34, 1);
    g.fillRoundedRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 10);
    g.lineStyle(2, 0x6a4a7a, 1);
    g.strokeRoundedRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 10);
  }

  private drawGrillFrame() {
    const g = this.add.graphics();
    g.fillStyle(0x3a3436, 1);
    g.fillRoundedRect(10, GRID_Y - 6, 340, GRID_H + 12, 10);
    g.fillStyle(0x15100f, 1);
    g.fillRoundedRect(GRID_X - 4, GRID_Y - 2, GRID_W + 8, GRID_H + 4, 6);
    for (let i = 0; i < SLOT_COUNT; i++) {
      const c = this.cell(i);
      g.lineStyle(1, 0x4a4244, 1);
      g.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      this.add
        .text(c.x + 4, c.y + 2, String(i + 1), { fontFamily: FONT, fontSize: '10px', color: '#7a6a70' })
        .setDepth(0);
    }
  }

  private drawCooler() {
    const g = this.add.graphics();
    g.fillStyle(0x7fa8b8, 1);
    g.fillRoundedRect(COOLER.x, COOLER.y, COOLER.w, COOLER.h, 10);
    g.fillStyle(0x24343c, 1);
    g.fillRoundedRect(COOLER.x + 5, COOLER.y + 22, COOLER.w - 10, COOLER.h - 27, 6);
    this.add.text(COOLER.x + 10, COOLER.y + 3, 'ตู้แช่', { fontFamily: FONT, fontSize: '14px', color: '#10222a' });
    const items = ITEMS.filter((i) => i.unlockLevel === 1).slice(0, 4);
    items.forEach((it, i) => {
      const x = COOLER.x + 12 + i * 58;
      const y = COOLER.y + 30;
      const b = this.add.graphics();
      b.fillStyle(0x3a4e58, 1);
      b.fillRoundedRect(x, y, 52, 112, 6);
      const ic = this.add.graphics({ x: x + 26, y: y + 58 });
      ic.setScale(0.8);
      drawBody(ic, it, 0);
      this.add
        .text(x + 26, y + 100, it.th, { fontFamily: FONT, fontSize: '10px', color: '#e8f4f8' })
        .setOrigin(0.5);
    });
  }

  private coolerItemAt(x: number, y: number): string | undefined {
    const items = ITEMS.filter((i) => i.unlockLevel === 1).slice(0, 4);
    for (let i = 0; i < items.length; i++) {
      if (inRect({ x: COOLER.x + 12 + i * 58, y: COOLER.y + 30, w: 52, h: 112 }, x, y)) return items[i].id;
    }
    return undefined;
  }

  private drawBinAndBottle() {
    const g = this.add.graphics();
    g.fillStyle(0x5a5a62, 1);
    g.fillRoundedRect(BIN.x, BIN.y + 8, BIN.w, BIN.h - 8, 6);
    g.fillStyle(0x7a7a84, 1);
    g.fillRoundedRect(BIN.x - 3, BIN.y, BIN.w + 6, 10, 3);
    g.lineStyle(2, 0x3a3a42, 1);
    for (let i = 1; i < 4; i++) g.lineBetween(BIN.x + i * 11, BIN.y + 18, BIN.x + i * 11, BIN.y + BIN.h - 8);
    this.add.text(BIN.x + BIN.w / 2, BIN.y + BIN.h + 10, 'ถังขยะ', { fontFamily: FONT, fontSize: '11px', color: '#b0a8b8' }).setOrigin(0.5);
    this.add.text(WATER.x + WATER.w / 2, WATER.y + WATER.h + 10, 'น้ำ', { fontFamily: FONT, fontSize: '11px', color: '#b0a8b8' }).setOrigin(0.5);
    this.redrawBottle();
  }

  private redrawBottle() {
    const g = this.bottleG;
    g.clear();
    const { x, y, w, h } = WATER;
    g.fillStyle(this.waterMode ? 0x5ac8ff : 0x3a86b8, 1);
    g.fillRoundedRect(x + 3, y + 22, w - 6, h - 22, 8);
    g.fillStyle(0xdddddd, 1);
    g.fillRect(x + w / 2 - 5, y + 10, 10, 14);
    g.fillStyle(0xcc3030, 1);
    g.fillRect(x + w / 2 - 9, y + 4, 18, 8);
    g.fillRect(x + w / 2 + 6, y + 6, 8, 3);
    if (this.waterMode) {
      g.lineStyle(3, 0xffffff, 1);
      g.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 8);
    }
  }

  private buildEmbers() {
    this.embers = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const c = this.cell(i);
      const arr = [];
      for (let k = 0; k < 7; k++) {
        arr.push({
          x: c.x + 8 + Math.random() * (c.w - 16),
          y: c.y + c.h - this.coalH + 6 + Math.random() * (this.coalH - 12),
          r: 3 + Math.random() * 4,
          ph: Math.random() * 6.28,
        });
      }
      this.embers.push(arr);
    }
  }

  private buildHud() {
    const st = { fontFamily: FONT, fontSize: '13px', color: COLORS.text };
    this.hudText = this.add.text(16, 194, '', { ...st, lineSpacing: 2 });
    this.heatText = this.add.text(16, 240, '', { ...st, fontSize: '11px', color: '#c0a8b0' });
    const btn = (x: number, label: string, fn: () => void) => {
      const t = this.add
        .text(x, 8, label, { fontFamily: FONT, fontSize: '13px', color: '#fff', backgroundColor: '#5a3a6a', padding: { x: 7, y: 5 } })
        .setOrigin(1, 0)
        .setDepth(20);
      this.btns.push({ t, fn });
      return t;
    };
    this.btns = [];
    btn(352, 'เริ่มใหม่', () => {
      this.scene.restart();
    });
    this.ringBtn = btn(284, 'วงสุก: เปิด', () => {
      this.ringOn = !this.ringOn;
      this.ringBtn.setText(this.ringOn ? 'วงสุก: เปิด' : 'วงสุก: ปิด');
    });
    this.muteBtn = btn(200, 'เสียง: เปิด', () => {
      this.sfx.muted = !this.sfx.muted;
      this.muteBtn.setText(this.sfx.muted ? 'เสียง: ปิด' : 'เสียง: เปิด');
    });
    this.muteBtn.setText(this.sfx.muted ? 'เสียง: ปิด' : 'เสียง: เปิด');
    this.ringBtn.setText(this.ringOn ? 'วงสุก: เปิด' : 'วงสุก: ปิด');
  }
  private btns: { t: Phaser.GameObjects.Text; fn: () => void }[] = [];

  private buildParticles() {
    const mk = (cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      this.add.particles(0, 0, cfg.frame === 'spark' ? 'spark' : 'puff', { ...cfg, frame: undefined, emitting: false }).setDepth(60);
    this.steam = mk({ lifespan: 900, speedY: { min: -50, max: -28 }, speedX: { min: -12, max: 12 }, scale: { start: 0.5, end: 1.5 }, alpha: { start: 0.7, end: 0 }, tint: 0xffffff });
    this.smokeGrey = mk({ lifespan: 1200, speedY: { min: -45, max: -25 }, speedX: { min: -10, max: 10 }, scale: { start: 0.6, end: 1.8 }, alpha: { start: 0.55, end: 0 }, tint: 0x9a9a9a });
    this.smokeBlack = mk({ lifespan: 1600, speedY: { min: -55, max: -30 }, speedX: { min: -16, max: 16 }, scale: { start: 0.9, end: 2.6 }, alpha: { start: 0.8, end: 0 }, tint: 0x222222 });
    this.sparks = mk({ frame: 'spark', lifespan: 600, speedY: { min: -90, max: -40 }, speedX: { min: -30, max: 30 }, scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, tint: 0xffa030 });
    this.splat = mk({ frame: 'spark', lifespan: 700, speed: { min: 40, max: 130 }, gravityY: 260, scale: { start: 1.4, end: 0.3 }, alpha: { start: 1, end: 0 }, tint: 0xf0c830 });
  }

  // ---- helpers ----
  private say(msg: string) {
    this.toast.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 700, duration: 400 });
  }

  private qualityLabel(q: number): 'perfect' | 'ok' | 'burnt' {
    return q >= 0.95 ? 'perfect' : q >= 0.5 ? 'ok' : 'burnt';
  }

  private refreshHud() {
    const n = this.stats.perfect + this.stats.ok + this.stats.burnt;
    const avg = n ? Math.round((this.qSum / n) * 100) : 0;
    this.hudText.setText(
      `เสิร์ฟสุกพอดี ${this.stats.perfect}  พอใช้ ${this.stats.ok}  ไหม้/เกรียม ${this.stats.burnt}\nคุณภาพเฉลี่ย ${n ? avg + '%' : '-'}   ทิ้งถัง ${this.stats.bin}`,
    );
  }

  private refreshTray() {
    this.trayIcons.forEach((o) => o.destroy());
    this.trayIcons = [];
    if (this.served.length === 0) {
      this.trayIcons.push(
        this.add
          .text(TRAY.x + TRAY.w / 2, TRAY.y + TRAY.h / 2, 'ลากไม้ที่สุกแล้วมาวางที่ถาด', { fontFamily: FONT, fontSize: '14px', color: '#6a5a78' })
          .setOrigin(0.5),
      );
      return;
    }
    const last = this.served.slice(-8);
    last.forEach((s, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = TRAY.x + 42 + col * 84;
      const y = TRAY.y + 8 + row * 58;
      const def = item(s.sk);
      const g = this.add.graphics({ x, y: y + 28 }).setScale(0.38).setAngle(90);
      drawBody(g, def, s.sk.sides[s.sk.down]);
      const lab = this.qualityLabel(s.q);
      const t = this.add
        .text(x + 26, y + 20, `${Math.round(s.q * 100)}%`, { fontFamily: FONT, fontSize: '14px', color: lab === 'perfect' ? '#ffd23a' : lab === 'ok' ? '#e8e0c8' : '#d06a50' })
        .setOrigin(0, 0.5);
      this.trayIcons.push(g, t);
    });
  }

  // ---- views ----
  private syncViews() {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const sk = this.grill.slots[i];
      const v = this.views[i];
      if (v && (!sk || v.sk.id !== sk.id)) {
        v.g.destroy();
        this.views[i] = null;
      }
      if (sk && !this.views[i]) {
        const p = this.skPos(i);
        const g = this.add.graphics({ x: p.x, y: p.y }).setScale(this.skScale()).setDepth(5);
        g.y = p.y - 30;
        this.tweens.add({ targets: g, y: p.y, duration: 140, ease: 'Back.Out' });
        this.views[i] = { sk, g, shownDown: sk.down, baseX: p.x, baseY: p.y };
      }
    }
  }

  private redrawView(v: View) {
    const sk = v.sk;
    const def = item(sk);
    const g = v.g;
    g.clear();
    drawBody(g, def, sk.sides[v.shownDown], sk.burst);
    const zones: [ReturnType<typeof sideZone>, ReturnType<typeof sideZone>] = [sideZone(sk.sides[0], def), sideZone(sk.sides[1], def)];
    drawIndicators(g, def, zones, v.shownDown, sk.sides[v.shownDown], this.ringOn, sk.burst);
  }

  private doFlip(slot: number) {
    const v = this.views[slot];
    if (!v) return;
    if (!flip(v.sk)) return;
    this.sfx.flip();
    this.tweens.killTweensOf(v.g);
    const s = this.skScale();
    v.g.setScale(s);
    v.g.x = v.baseX;
    v.g.y = v.baseY;
    this.tweens.add({
      targets: v.g,
      scaleX: 0.05 * s,
      angle: 14,
      y: v.baseY - 10,
      duration: 70,
      onComplete: () => {
        v.shownDown = v.sk.down;
        this.tweens.add({ targets: v.g, scaleX: s, angle: 0, y: v.baseY, duration: 90, ease: 'Back.Out' });
      },
    });
  }

  // ---- input ----
  private skewerAt(x: number, y: number): number {
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (!this.views[i]) continue;
      const c = this.cell(i);
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h - this.coalH + 8) return i;
    }
    return -1;
  }
  private cellAt(x: number, y: number): number {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const c = this.cell(i);
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return i;
    }
    return -1;
  }

  private onDown(p: Phaser.Input.Pointer) {
    this.sfx.unlock();
    const g: Gesture = { mode: 'ui', sx: p.x, sy: p.y, slot: -1, dragging: false };
    const btn = this.btns.find((b) => b.t.getBounds().contains(p.x, p.y));
    if (btn) {
      g.mode = 'ui';
      g.ui = btn.fn;
    } else if (inRect(WATER, p.x, p.y)) {
      g.mode = 'bottle';
    } else {
      const itemId = this.coolerItemAt(p.x, p.y);
      const sIdx = this.skewerAt(p.x, p.y);
      if (itemId) {
        g.mode = 'cooler';
        g.itemId = itemId;
      } else if (sIdx >= 0) {
        g.mode = 'skewer';
        g.slot = sIdx;
      } else {
        const c = this.cellAt(p.x, p.y);
        if (c >= 0) {
          g.mode = 'fan';
          g.slot = c;
          this.fanning.add(p.id);
        }
      }
    }
    this.gestures.set(p.id, g);
  }

  private onMove(p: Phaser.Input.Pointer) {
    const g = this.gestures.get(p.id);
    if (!g) return;
    if (g.mode === 'fan') {
      const c = this.cellAt(p.x, p.y);
      if (c >= 0) g.slot = c;
      return;
    }
    if (g.mode !== 'skewer') return;
    const v = this.views[g.slot];
    if (!v) return;
    if (!g.dragging && Phaser.Math.Distance.Between(p.x, p.y, g.sx, g.sy) > DRAG_PX) {
      g.dragging = true;
      this.tweens.killTweensOf(v.g);
      v.g.setScale(this.skScale() * 1.1).setAngle(0).setDepth(100);
    }
    if (g.dragging) {
      v.g.x = p.x;
      v.g.y = p.y;
    }
  }

  private onUp(p: Phaser.Input.Pointer) {
    const g = this.gestures.get(p.id);
    this.gestures.delete(p.id);
    this.fanning.delete(p.id);
    if (!g) return;
    if (g.mode === 'ui') {
      const d = Phaser.Math.Distance.Between(p.x, p.y, g.sx, g.sy);
      if (g.ui && d <= DRAG_PX) g.ui();
    } else if (g.mode === 'bottle') {
      this.waterMode = !this.waterMode;
      this.redrawBottle();
      if (this.waterMode) this.say('แตะไม้ที่ไฟลุก');
    } else if (g.mode === 'cooler') {
      if (Phaser.Math.Distance.Between(p.x, p.y, g.sx, g.sy) <= DRAG_PX && g.itemId) this.placeItem(g.itemId);
    } else if (g.mode === 'skewer') {
      const v = this.views[g.slot];
      if (!v) return;
      if (!g.dragging) {
        if (this.waterMode) {
          if (v.sk.flare > 0 && extinguish(this.grill, g.slot)) {
            this.sfx.spray();
            this.removeFlame(g.slot);
            this.steam.emitParticleAt(v.baseX, v.baseY, 6);
            this.waterMode = false;
            this.redrawBottle();
          } else {
            this.say('ไม่มีไฟ');
          }
        } else {
          this.doFlip(g.slot);
        }
        return;
      }
      this.drop(g.slot, v, p.x, p.y);
    }
  }

  private snapBack(v: View) {
    v.g.setDepth(5);
    this.tweens.add({ targets: v.g, x: v.baseX, y: v.baseY, scale: this.skScale(), duration: 160, ease: 'Back.Out' });
  }

  private drop(slot: number, v: View, x: number, y: number) {
    if (inRect(BIN, x, y) || inRect({ x: BIN.x - 10, y: BIN.y - 10, w: BIN.w + 20, h: BIN.h + 20 }, x, y)) {
      removeSkewer(this.grill, slot);
      this.sfx.bin();
      this.stats.bin++;
      this.destroyView(slot);
      this.refreshHud();
      return;
    }
    if (inRect(TRAY, x, y) || y < GRID_Y - 10) {
      const q = skewerQuality(v.sk);
      if (q === null) {
        this.say(v.sk.burst ? 'แตกแล้ว! ทิ้งถังนะ' : 'ยังดิบ!');
        this.snapBack(v);
        return;
      }
      const sk = removeSkewer(this.grill, slot);
      this.destroyView(slot);
      if (!sk) return;
      this.sfx.coin();
      this.served.push({ sk: skewerSnapshot(sk), q });
      this.stats[this.qualityLabel(q)]++;
      this.qSum += q;
      this.refreshTray();
      this.refreshHud();
      return;
    }
    this.snapBack(v);
  }

  private destroyView(slot: number) {
    this.views[slot]?.g.destroy();
    this.views[slot] = null;
    this.removeFlame(slot);
  }

  private placeItem(itemId: string) {
    const slot = this.grill.slots.findIndex((s) => s === null);
    if (slot < 0) return this.say('เตาเต็ม!');
    if (placeSkewer(this.grill, slot, itemId)) this.sfx.place();
    else this.say('วางไม่ได้');
  }

  // ---- flames / fx ----
  private addFlame(slot: number) {
    if (this.flames[slot]) return;
    const c = this.cell(slot);
    const f = this.add.image(c.x + c.w / 2, c.y + c.h - this.coalH + 4, 'flame').setOrigin(0.5, 1).setDepth(8);
    f.setScale(Math.min(1.6, c.w / 40));
    this.tweens.add({ targets: f, scaleY: f.scaleY * 1.25, scaleX: f.scaleX * 0.9, duration: 120, yoyo: true, repeat: -1 });
    this.flames[slot] = f;
  }
  private removeFlame(slot: number) {
    const f = this.flames[slot];
    if (!f) return;
    this.tweens.killTweensOf(f);
    f.destroy();
    this.flames[slot] = null;
  }

  private handleEvent(e: GrillEvent) {
    const p = this.skPos(e.slot);
    const top = p.y - BODY_H * 0.4;
    switch (e.type) {
      case 'zone': {
        if (e.zone === 'perfect') {
          this.sfx.ding();
          this.steam.emitParticleAt(p.x, top, 10);
        } else if (e.zone === 'charred') {
          this.smokeGrey.emitParticleAt(p.x, top, 6);
        } else if (e.zone === 'burnt') {
          this.sfx.burnt();
          this.smokeBlack.emitParticleAt(p.x, top, 12);
        }
        break;
      }
      case 'flareStart':
        this.addFlame(e.slot);
        this.sfx.flare();
        this.cameras.main.shake(120, 0.004);
        break;
      case 'flareEnd':
        this.removeFlame(e.slot);
        break;
      case 'burst':
        this.splat.emitParticleAt(p.x, p.y, 16);
        this.say('ชีสแตก!');
        break;
    }
  }

  // ---- loop ----
  update(time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const fan = [...this.gestures.values()].find((g) => g.mode === 'fan');
    const fanSlot = fan ? fan.slot : null;
    const events = tick(this.grill, dt, Math.random, { fanSlot });
    this.syncViews();
    for (const e of events) this.handleEvent(e);
    // flames follow state (covers flare without events, e.g. after extinguish)
    for (let i = 0; i < SLOT_COUNT; i++) {
      const sk = this.grill.slots[i];
      if (sk && sk.flare > 0) this.addFlame(i);
      else if (this.flames[i]) this.removeFlame(i);
    }

    // coals
    const g = this.coalG;
    g.clear();
    for (let i = 0; i < SLOT_COUNT; i++) {
      const c = this.cell(i);
      const sk = this.grill.slots[i];
      const heat = this.grill.heat[i];
      let b = Phaser.Math.Clamp((heat - 0.6) / 0.8, 0, 1);
      if (fanSlot === i) b = Math.min(1, b + 0.35);
      if (sk && sk.flare > 0) b = 1;
      const y0 = c.y + c.h - this.coalH;
      g.fillStyle(mix(0x2a1a14, 0x6a2410, b), 1);
      g.fillRect(c.x + 2, y0, c.w - 4, this.coalH - 2);
      for (const em of this.embers[i]) {
        const fl = 0.7 + 0.3 * Math.sin(time / 180 + em.ph);
        g.fillStyle(mix(0xb02a10, 0xffb040, b), (0.25 + 0.75 * b) * fl);
        g.fillCircle(em.x, em.y, em.r * (0.8 + 0.4 * b));
      }
      g.fillStyle(0xff8a2a, 0.08 + 0.2 * b);
      g.fillRect(c.x + 2, y0 - 14, c.w - 4, 14);
      if (fanSlot === i && Math.random() < 0.5) this.sparks.emitParticleAt(c.x + 8 + Math.random() * (c.w - 16), y0 + 4, 1);
    }

    // views, smoke, sizzle
    for (let i = 0; i < SLOT_COUNT; i++) {
      const v = this.views[i];
      const sk = this.grill.slots[i];
      let level = 0;
      if (v && sk) {
        this.redrawView(v);
        const def = item(sk);
        const c = sk.sides[sk.down];
        level = Math.min(1, 0.2 + 0.8 * Math.min(1, c));
        const z = sideZone(c, def);
        this.smokeT[i] -= dt;
        if (this.smokeT[i] <= 0 && (z === 'charred' || z === 'burnt')) {
          this.smokeT[i] = z === 'burnt' ? 0.12 : 0.3;
          (z === 'burnt' ? this.smokeBlack : this.smokeGrey).emitParticleAt(v.baseX, v.baseY - BODY_H * 0.45, 1);
        }
        if (z === 'perfect' && Math.random() < dt * 3) this.steam.emitParticleAt(v.baseX, v.baseY - BODY_H * 0.4, 1);
      }
      if (Math.abs(level - this.lastSizzle[i]) > 0.02) {
        this.lastSizzle[i] = level;
        this.sfx.setSizzle(i, level);
      }
    }
    this.heatText.setText('ความร้อนช่อง: ' + this.grill.heat.map((h) => h.toFixed(2)).join('  '));
  }
}
