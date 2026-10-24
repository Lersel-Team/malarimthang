import Phaser from 'phaser';
import { settings } from '../settings';
import { pt, setupCamera } from '../engine/hidpi';
import { COLORS, GAME_H, GAME_W } from '../config';
import { COOKING, ITEM_BY_ID, LOCATIONS, PROGRESSION, UPGRADES } from '../data/balance';
import type { ShiftResult } from '../core/economy';
import { session } from '../session';
import { renameShop } from './nameInput';
import {
  createGrill,
  extinguish,
  brushOil,
  brushSauce,
  effectiveMargin,
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
import { MAX_TICKETS, Shift, type Customer, type ShiftEvent } from '../core/shift';
import { SHOP_H, ShopView } from './shop/ShopView';
import { BODY_H, FONT, drawBody, drawIcon, drawIndicators, makeTextures, mix } from './grill/draw';

// Dev only: ?speed=0.3 slows the game for QA/playtests, ?speed=3 fast-forwards. Ignored in production builds.
const DEV_SPEED = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('speed')) || 1 : 1;

const HEAT_EVENNESS = 0.55;
const DRAG_PX = 10;

// Layout
const GRID_X = 16, GRID_W = 328, GRID_Y = 388, GRID_H = 150;
const COOLER = { x: 8, y: 556, w: 240, h: 150 };
const BIN = { x: 256, y: 556, w: 54, h: 70 };
const POT = { x: 256, y: 666, w: 96, h: 60 }; // brush pot below bin/water; oil brush = left half, sauce = right half
const BRUSH_COL = { oil: 0xf0c020, sauce: 0x8a3a22 } as const;
type BrushKind = 'oil' | 'sauce';
const WATER = { x: 318, y: 556, w: 34, h: 70 };
const HUD_H = 28;
const CARD_Y = SHOP_H + 4, CARD_W = 112, CARD_H = 122, CARD_GAP = 4, CARD_X0 = 8;
const cardX = (i: number) => CARD_X0 + i * (CARD_W + CARD_GAP);
const SHAKER = { dx: 4, dy: 78, w: 46, h: 26 };

/** Level index into an upgrade's values table (clamped). */
function upgradeValue(id: string, level: number): number {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return 0;
  return u.values[Math.max(0, Math.min(u.values.length - 1, level))];
}

interface Card {
  bg: Phaser.GameObjects.Graphics;
  bar: Phaser.GameObjects.Graphics;
  content: Phaser.GameObjects.GameObject[];
  sig: string;
}

interface View {
  sk: Skewer;
  g: Phaser.GameObjects.Graphics;
  shownDown: 0 | 1;
  baseX: number;
  baseY: number;
}
interface Gesture {
  mode: 'skewer' | 'cooler' | 'fan' | 'bottle' | 'ui' | 'pot' | 'brush';
  sx: number;
  sy: number;
  slot: number;
  itemId?: string;
  ui?: () => void;
  kind?: BrushKind;
  done?: Set<number>;
  dragging: boolean;
}

const inRect = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export class ShiftScene extends Phaser.Scene {
  private grill!: Grill;
  private sfx!: Sfx;
  private views: (View | null)[] = [];
  private gestures = new Map<number, Gesture>();
  private shift!: Shift;
  private shopView!: ShopView;
  private cards: Card[] = [];
  private over = false;
  private hudClock!: Phaser.GameObjects.Text;
  private hudMoney!: Phaser.GameObjects.Text;
  private hudStar!: Phaser.GameObjects.Text;
  private hudCombo!: Phaser.GameObjects.Text;
  private powder!: Phaser.GameObjects.Particles.ParticleEmitter;
  private stats = { perfect: 0, ok: 0, burnt: 0, bin: 0 };
  private ringOn = true;
  private waterMode = false;
  private brushMode: BrushKind | null = null;
  private brushIdle = 0;
  private brushG!: Phaser.GameObjects.Graphics;
  private potG!: Phaser.GameObjects.Graphics;
  private drip!: Phaser.GameObjects.Particles.ParticleEmitter;
  private earlyWarned = false;
  private ptr = { x: 0, y: 0 };
  private coalG!: Phaser.GameObjects.Graphics;
  private bottleG!: Phaser.GameObjects.Graphics;
  private flames: (Phaser.GameObjects.Image | null)[] = [];
  private smokeT: number[] = [];
  private lastSizzle: number[] = [];
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
  private n = 4; // grill slots
  private menu: string[] = [];
  private stock: Record<string, number> = {};
  private sold: Record<string, number> = {};
  private wasted: Record<string, number> = {};
  private perfects = 0;
  private paused = false;
  private coolerCells: { id: string; x: number; y: number; w: number; h: number; icon: Phaser.GameObjects.Graphics; count: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super('Shift');
  }

  // ---- geometry ----
  private cols = 4;
  private rows = 1;
  private cellW = GRID_W / 4;
  private cellH = GRID_H;
  private coalH = 30;
  /** 6 per row then wrap; columns balanced across rows (8 -> 2x4, 10 -> 2x5, 12 -> 2x6). */
  private setGeometry() {
    this.rows = Math.ceil(this.n / 6);
    this.cols = Math.ceil(this.n / this.rows);
    this.cellW = GRID_W / this.cols;
    this.cellH = GRID_H / this.rows;
    this.coalH = this.rows === 1 ? 30 : 20;
  }
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
    setupCamera(this);
    if (settings.fx && this.renderer.type === Phaser.WEBGL) {
      this.cameras.main.postFX.addVignette(0.5, 0.5, 1.0, 0.2);
      // Bloom was tried (addBloom(0xffffff,1,1,0.5,0.18)) but washes/dims the whole frame; keep vignette only.
    }
    const st = session.s;
    this.n = Math.max(1, Math.min(12, Math.round(upgradeValue('grillSize', st.upgrades.grillSize ?? 0))));
    this.setGeometry();
    this.stock = { ...st.stock };
    this.menu = st.unlockedItems.filter((id) => ITEM_BY_ID[id] && (this.stock[id] ?? 0) > 0);
    this.sold = {};
    this.wasted = {};
    this.perfects = 0;
    this.paused = false;
    const seats = upgradeValue('tables', st.upgrades.tables ?? 0);

    this.sfx = (this.registry.get('sfx') as Sfx | undefined) ?? new Sfx();
    this.registry.set('sfx', this.sfx);
    this.sfx.stopAll();

    this.grill = createGrill(this.n, upgradeValue('grillType', st.upgrades.grillType ?? 0) || HEAT_EVENNESS, Math.random);
    this.views = Array(this.n).fill(null);
    this.flames = Array(this.n).fill(null);
    this.smokeT = Array(this.n).fill(0);
    this.lastSizzle = Array(this.n).fill(-1);
    this.gestures.clear();
    this.fanning.clear();
    this.over = false;
    this.cards = [];
    this.shift = new Shift({
      location: LOCATIONS.find((l) => l.id === st.location) ?? LOCATIONS[0],
      menu: this.menu,
      seats,
      rating: st.rating,
      priceMult: upgradeValue('powder', st.upgrades.powder ?? 0) || 1,
      patienceMult: upgradeValue('seating', st.upgrades.seating ?? 0) || 1,
      spawnMult: upgradeValue('sign', st.upgrades.sign ?? 0) || 1,
      rng: Math.random,
    });
    this.stats = { perfect: 0, ok: 0, burnt: 0, bin: 0 };
    this.waterMode = false;
    this.brushMode = null;
    this.brushIdle = 0;
    this.earlyWarned = false;

    makeTextures(this);
    this.drawLowerBackdrop();
    this.shopView = new ShopView(this, 0, 0, GAME_W, SHOP_H, { seats, shopName: st.shopName });
    this.drawGrillFrame();
    this.drawCooler();
    this.buildEmbers();

    this.coalG = this.add.graphics().setDepth(1);
    this.bottleG = this.add.graphics();
    this.drawBinAndBottle();
    this.potG = this.add.graphics();
    this.brushG = this.add.graphics().setDepth(120);
    this.add.text(POT.x + 24, POT.y + POT.h - 9, 'น้ำมัน', { fontFamily: FONT, fontSize: '10px', color: '#f0d890' }).setOrigin(0.5);
    this.add.text(POT.x + 72, POT.y + POT.h - 9, 'ซอส', { fontFamily: FONT, fontSize: '10px', color: '#e0a090' }).setOrigin(0.5);
    this.redrawPot();
    this.buildHud();
    this.buildParticles();
    this.buildCards();

    this.toast = this.add
      .text(GAME_W / 2, 380, '', { fontFamily: FONT, fontSize: '20px', color: '#fff', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(200)
      .setAlpha(0);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.events.once('shutdown', () => {
      this.sfx.stopAll();
      this.shopView.destroy();
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('pointerupoutside', this.onUp, this);
    });
    this.refreshCards();
    this.refreshHud();
    this.say('ทาน้ำมัน → พลิก → ทาซอส', 2600);
  }

  // ---- static drawing ----
  private drawLowerBackdrop() {
    const g = this.add.graphics().setDepth(-2);
    g.fillStyle(0x140d1c, 1);
    g.fillRect(0, SHOP_H, GAME_W, GAME_H - SHOP_H);
  }

  private drawGrillFrame() {
    const g = this.add.graphics();
    g.fillStyle(0x3a3436, 1);
    g.fillRoundedRect(10, GRID_Y - 6, 340, GRID_H + 12, 10);
    g.fillStyle(0x15100f, 1);
    g.fillRoundedRect(GRID_X - 4, GRID_Y - 2, GRID_W + 8, GRID_H + 4, 6);
    for (let i = 0; i < this.n; i++) {
      const c = this.cell(i);
      g.lineStyle(1, 0x4a4244, 1);
      g.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      this.add
        .text(c.x + 4, c.y + 2, String(i + 1), { fontFamily: FONT, fontSize: '10px', color: '#7a6a70' })
        .setDepth(0);
    }
  }

  /** Cell rect for cooler item i of n: <=4 big cards, <=8 two rows, else three rows of icons. */
  private coolerRect(i: number, n: number) {
    const x0 = COOLER.x + 12, y0 = COOLER.y + 30;
    if (n <= 4) return { x: x0 + i * 58, y: y0, w: 52, h: 112, mode: 0 };
    if (n <= 8) return { x: x0 + (i % 4) * 55, y: y0 + Math.floor(i / 4) * 58, w: 52, h: 54, mode: 1 };
    return { x: x0 + (i % 6) * 38, y: y0 + Math.floor(i / 6) * 38, w: 36, h: 36, mode: 2 };
  }

  private drawCooler() {
    const g = this.add.graphics();
    g.fillStyle(0x7fa8b8, 1);
    g.fillRoundedRect(COOLER.x, COOLER.y, COOLER.w, COOLER.h, 10);
    g.fillStyle(0x24343c, 1);
    g.fillRoundedRect(COOLER.x + 5, COOLER.y + 22, COOLER.w - 10, COOLER.h - 27, 6);
    this.add.text(COOLER.x + 10, COOLER.y + 3, 'ตู้แช่', { fontFamily: FONT, fontSize: '14px', color: '#10222a' });
    this.coolerCells = [];
    const ids = this.menu.slice(0, 18);
    ids.forEach((id, i) => {
      const it = ITEM_BY_ID[id];
      const r = this.coolerRect(i, ids.length);
      const b = this.add.graphics();
      b.fillStyle(0x3a4e58, 1);
      b.fillRoundedRect(r.x, r.y, r.w, r.h, 6);
      const ic = this.add.graphics({ x: r.x + r.w / 2, y: r.y + (r.mode === 0 ? 58 : r.mode === 1 ? 22 : 18) });
      if (r.mode === 0) {
        ic.setScale(0.8);
        drawBody(ic, it, 0);
      } else {
        ic.setScale(r.mode === 1 ? 0.75 : 0.55);
        drawIcon(ic, it);
      }
      if (r.mode < 2) {
        this.add.text(r.x + r.w / 2, r.y + r.h - (r.mode === 0 ? 12 : 8), it.th, { fontFamily: FONT, fontSize: r.mode === 0 ? '10px' : '9px', color: '#e8f4f8' }).setOrigin(0.5);
      }
      const count = this.add
        .text(r.x + r.w - 2, r.y + 1, '', { fontFamily: FONT, fontSize: '11px', color: '#fff', backgroundColor: '#c0302a', padding: { x: 3, y: 0 } })
        .setOrigin(1, 0)
        .setDepth(2);
      this.coolerCells.push({ id, x: r.x, y: r.y, w: r.w, h: r.h, icon: ic, count });
    });
    this.refreshCooler();
  }

  private refreshCooler() {
    for (const c of this.coolerCells) {
      const left = this.stock[c.id] ?? 0;
      c.count.setText(String(left));
      c.icon.setAlpha(left > 0 ? 1 : 0.28);
      c.count.setBackgroundColor(left > 0 ? '#c0302a' : '#4a4a52');
    }
  }

  private coolerItemAt(x: number, y: number): string | undefined {
    return this.coolerCells.find((c) => inRect(c, x, y))?.id;
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
    for (let i = 0; i < this.n; i++) {
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
    this.btns = [];
    const bar = this.add.graphics().setDepth(90);
    bar.fillStyle(0x000000, 0.55);
    bar.fillRect(0, 0, GAME_W, HUD_H);
    const st = { fontFamily: FONT, fontSize: '13px', color: COLORS.text };
    this.hudClock = this.add.text(8, 6, '', st).setDepth(91);
    this.hudMoney = this.add.text(62, 6, '', { ...st, color: '#ffe27a' }).setDepth(91);
    this.hudStar = this.add.text(140, 6, '', st).setDepth(91);
    this.hudCombo = this.add.text(190, 6, '', { ...st, color: '#ff9a6a' }).setDepth(91);
    const btn = (x: number, label: string, fn: () => void) => {
      const t = this.add
        .text(x, 3, label, { fontFamily: FONT, fontSize: '13px', color: '#fff', backgroundColor: '#5a3a6a', padding: { x: 6, y: 3 } })
        .setOrigin(1, 0)
        .setDepth(92);
      this.btns.push({ t, fn });
      return t;
    };
    this.ringBtn = btn(356, '◎', () => {
      this.ringOn = !this.ringOn;
      this.ringBtn.setAlpha(this.ringOn ? 1 : 0.45);
    });
    this.muteBtn = btn(326, '♪', () => {
      this.sfx.muted = !this.sfx.muted;
      this.muteBtn.setAlpha(this.sfx.muted ? 0.45 : 1);
    });
    this.muteBtn.setAlpha(this.sfx.muted ? 0.45 : 1);
    this.ringBtn.setAlpha(this.ringOn ? 1 : 0.45);
  }
  private btns: { t: Phaser.GameObjects.Text; fn: () => void }[] = [];

  private buildParticles() {
    const mk = (cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      this.add.particles(0, 0, cfg.frame === 'spark' ? 'spark' : 'puff', { ...cfg, frame: undefined, emitting: false }).setDepth(60);
    this.steam = mk({ lifespan: 900, speedY: { min: -50, max: -28 }, speedX: { min: -12, max: 12 }, scale: { start: 0.5, end: 1.5 }, alpha: { start: 0.7, end: 0 }, tint: 0xffffff });
    this.smokeGrey = mk({ lifespan: 1200, speedY: { min: -45, max: -25 }, speedX: { min: -10, max: 10 }, scale: { start: 0.6, end: 1.8 }, alpha: { start: 0.55, end: 0 }, tint: 0x9a9a9a });
    this.smokeBlack = mk({ lifespan: 1600, speedY: { min: -55, max: -30 }, speedX: { min: -16, max: 16 }, scale: { start: 0.9, end: 2.6 }, alpha: { start: 0.8, end: 0 }, tint: 0x222222 });
    this.sparks = mk({ frame: 'spark', lifespan: 600, speedY: { min: -90, max: -40 }, speedX: { min: -30, max: 30 }, scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, tint: 0xffa030 });
    this.powder = mk({ frame: 'spark', lifespan: 500, speed: { min: 30, max: 90 }, gravityY: 200, scale: { start: 1, end: 0.2 }, alpha: { start: 1, end: 0 }, tint: 0xd02a1a });
    this.drip = mk({ frame: 'spark', lifespan: 450, speedX: { min: -8, max: 8 }, speedY: { min: 10, max: 40 }, gravityY: 300, scale: { start: 0.8, end: 0.3 }, alpha: { start: 1, end: 0 }, tint: 0xf0c020 });
    this.splat = mk({ frame: 'spark', lifespan: 700, speed: { min: 40, max: 130 }, gravityY: 260, scale: { start: 1.4, end: 0.3 }, alpha: { start: 1, end: 0 }, tint: 0xf0c830 });
  }

  // ---- helpers ----
  private say(msg: string, hold = 700) {
    this.toast.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: hold, duration: 400 });
  }

  // ---- brushes ----
  private brushRect(k: BrushKind) {
    return { x: POT.x + (k === 'oil' ? 0 : POT.w / 2), y: POT.y, w: POT.w / 2, h: POT.h };
  }

  private drawBrush(g: Phaser.GameObjects.Graphics, x: number, y: number, k: BrushKind, tilt: number) {
    // handle (wood) + bristles in the brush colour; (x,y) = bristle tip
    g.lineStyle(5, 0xb07a40, 1);
    g.lineBetween(x + tilt, y - 36, x + tilt * 0.3, y - 10);
    g.fillStyle(0xc8c8d0, 1);
    g.fillRect(x - 4 + tilt * 0.3, y - 12, 8, 5);
    g.fillStyle(BRUSH_COL[k], 1);
    g.fillRoundedRect(x - 6, y - 8, 12, 12, 3);
  }

  private redrawPot() {
    const g = this.potG;
    g.clear();
    g.fillStyle(0x6a4a3a, 1);
    g.fillRoundedRect(POT.x + 4, POT.y + 22, POT.w - 8, POT.h - 22, 6);
    g.fillStyle(0x8a6a56, 1);
    g.fillRoundedRect(POT.x, POT.y + 20, POT.w, 7, 3);
    (['oil', 'sauce'] as BrushKind[]).forEach((k) => {
      const r = this.brushRect(k);
      const cx = r.x + r.w / 2;
      if (this.brushMode === k) {
        g.lineStyle(3, 0xffffff, 1);
        g.strokeRoundedRect(r.x + 1, r.y - 1, r.w - 2, r.h + 2, 8);
        // brush lifted out of the pot
        g.fillStyle(0x000000, 0.35);
        g.fillRoundedRect(cx - 6, POT.y + 22, 12, 5, 2);
      } else {
        this.drawBrush(g, cx, POT.y + 16, k, k === 'oil' ? -5 : 5);
      }
    });
  }

  private setBrush(k: BrushKind | null) {
    this.brushMode = k;
    this.brushIdle = 0;
    if (k && this.waterMode) {
      this.waterMode = false;
      this.redrawBottle();
    }
    this.redrawPot();
    if (!k) this.brushG.clear();
  }

  private brushSkewer(slot: number) {
    const v = this.views[slot];
    const k = this.brushMode;
    if (!v || !k) return;
    this.brushIdle = 0;
    const sk = v.sk;
    if (k === 'oil') {
      if (!brushOil(sk)) return;
      this.drip.emitParticleAt(v.baseX, v.baseY - BODY_H * 0.3, 4);
    } else {
      if (!brushSauce(sk)) return;
      this.powder.emitParticleAt(v.baseX, v.baseY - BODY_H * 0.2, 3);
      if (sk.sauce === 'early' && !this.earlyWarned) {
        this.earlyWarned = true;
        this.say('ยังดิบอยู่ ซอสจะไหม้!', 1500);
      }
    }
    this.sfx.brush();
  }

  private qualityLabel(q: number): 'perfect' | 'ok' | 'burnt' {
    return q >= 0.95 ? 'perfect' : q >= 0.5 ? 'ok' : 'burnt';
  }

  private refreshHud() {
    const sh = this.shift;
    const avg = sh.avgStars();
    this.hudClock.setText(sh.clock());
    this.hudMoney.setText(`฿${Math.round(sh.money)}`);
    this.hudStar.setText(`⭐${avg === null ? '-' : avg.toFixed(1)}`);
    this.hudCombo.setText(sh.comboSteps > 0 ? `คอมโบ x${sh.comboSteps}` : '');
  }

  // ---- ticket rail ----
  private buildCards() {
    for (let i = 0; i < MAX_TICKETS; i++) {
      const bg = this.add.graphics().setDepth(3);
      const bar = this.add.graphics().setDepth(4);
      this.cards.push({ bg, bar, content: [], sig: '' });
    }
  }

  private txt(x: number, y: number, s: string, size: number, color: string) {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color }).setDepth(5);
    return t;
  }

  private cardSig(c: Customer | null): string {
    if (!c || !c.ticket) return 'empty';
    const filled = c.order.lines.map((l) => c.ticket!.skewers.filter((s) => s.itemId === l.itemId).length).join(',');
    return `${c.id}|${filled}|${c.ticket.shakes}|${this.shift.isComplete(c.ticketSlot ?? 0)}`;
  }

  private refreshCards(force = false) {
    for (let i = 0; i < MAX_TICKETS; i++) {
      const card = this.cards[i];
      const c = this.shift.atTicket(i);
      const sig = this.cardSig(c);
      if (!force && sig === card.sig) continue;
      card.sig = sig;
      card.content.forEach((o) => o.destroy());
      card.content = [];
      const x = cardX(i), y = CARD_Y;
      const bg = card.bg;
      bg.clear();
      if (!c || !c.ticket) {
        bg.fillStyle(0x1e1528, 1);
        bg.fillRoundedRect(x, y, CARD_W, CARD_H, 8);
        bg.lineStyle(1, 0x3a2c48, 1);
        bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 8);
        card.content.push(this.txt(x + CARD_W / 2, y + CARD_H / 2, 'ว่าง', 14, '#4a3c58').setOrigin(0.5));
        continue;
      }
      const done = this.shift.isComplete(i);
      bg.fillStyle(done ? 0x3a3a22 : 0x2f2240, 1);
      bg.fillRoundedRect(x, y, CARD_W, CARD_H, 8);
      bg.lineStyle(done ? 3 : 2, done ? 0xffd23a : 0x6a4a7a, 1);
      bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 8);
      card.content.push(this.txt(x + 6, y + 4, c.name, 13, '#f6d8a0'));
      const tag = this.txt(x + CARD_W - 5, y + 60, c.order.eatIn ? 'นั่งกิน' : 'กลับบ้าน', 10, c.order.eatIn ? '#8fd8a0' : '#9ab8f0').setOrigin(1, 0);
      card.content.push(tag);
      c.order.lines.forEach((l, k) => {
        const have = c.ticket!.skewers.filter((s) => s.itemId === l.itemId).length;
        const col = k % 2, row = Math.floor(k / 2);
        const lx = x + 4 + col * 54, ly = y + 24 + row * 24;
        const def = ITEM_BY_ID[l.itemId];
        const ic = this.add.graphics({ x: lx + 12, y: ly + 10 }).setDepth(5).setScale(0.75);
        drawIcon(ic, def);
        card.content.push(ic);
        const full = have >= l.qty;
        card.content.push(this.txt(lx + 26, ly + 2, `${Math.min(have, l.qty)}/${l.qty}`, 13, full ? '#8fe08f' : '#fff'));
      });
      const sp = c.order.spice;
      card.content.push(this.txt(x + 6, y + 58, sp === 0 ? 'ไม่เผ็ด' : '🌶'.repeat(sp), 12, '#ff9a8a'));
      const by = y + SHAKER.dy;
      bg.fillStyle(0xa02820, 1);
      bg.fillRoundedRect(x + SHAKER.dx, by, SHAKER.w, SHAKER.h, 6);
      card.content.push(this.txt(x + SHAKER.dx + SHAKER.w / 2, by + SHAKER.h / 2, 'ผง', 13, '#fff').setOrigin(0.5));
      if (sp > 0 || c.ticket.shakes > 0) {
        const okShake = c.ticket.shakes === sp;
        card.content.push(this.txt(x + SHAKER.dx + SHAKER.w + 4, by + 5, `${c.ticket.shakes}/${sp}`, 13, okShake ? '#8fe08f' : '#f0c8a0'));
      }
      if (done) {
        card.content.push(this.txt(x + CARD_W - 6, y + 4, 'ส่ง ▶', 13, '#ffe27a').setOrigin(1, 0));
      }
    }
  }

  private drawBars() {
    for (let i = 0; i < MAX_TICKETS; i++) {
      const g = this.cards[i].bar;
      g.clear();
      const c = this.shift.atTicket(i);
      if (!c || !c.ticket) continue;
      const f = Phaser.Math.Clamp(c.patience / c.patienceMax, 0, 1);
      const x = cardX(i) + 6, y = CARD_Y + CARD_H - 11, w = CARD_W - 12;
      g.fillStyle(0x000000, 0.5);
      g.fillRoundedRect(x, y, w, 6, 3);
      g.fillStyle(f > 0.6 ? 0x5ac86a : f > 0.3 ? 0xe8c040 : 0xe05040, 1);
      g.fillRoundedRect(x, y, Math.max(2, w * f), 6, 3);
    }
  }

  private cardAt(x: number, y: number): number {
    if (y < CARD_Y || y > CARD_Y + CARD_H) return -1;
    for (let i = 0; i < MAX_TICKETS; i++) if (x >= cardX(i) && x <= cardX(i) + CARD_W) return i;
    return -1;
  }

  private shakeSlot(slot: number) {
    if (!this.shift.atTicket(slot)) return;
    this.shift.shake(slot);
    this.sfx.shake();
    this.powder.emitParticleAt(cardX(slot) + SHAKER.dx + SHAKER.w / 2, CARD_Y + SHAKER.dy, 8);
    this.refreshCards();
  }

  private serveSlot(slot: number) {
    const c = this.shift.atTicket(slot);
    if (!c || !this.shift.isComplete(slot)) return;
    const eatIn = c.order.eatIn;
    const events = this.shift.serve(slot);
    this.pushEvents(events);
    this.sfx.coin();
    if (!eatIn) {
      const e = events.find((ev) => ev.type === 'served');
      if (e && e.type === 'served') this.floatText(cardX(slot) + CARD_W / 2, CARD_Y + 20, `+฿${Math.round(e.pay + e.tip + e.combo)}`, '#ffe27a');
    }
    this.refreshCards();
  }

  private floatText(x: number, y: number, s: string, color: string) {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: '18px', color, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(150);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1100, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }

  private pushEvents(events: ShiftEvent[]) {
    if (events.length === 0) return;
    this.shopView.onEvents(events, this.shift);
    for (const e of events) {
      if (e.type === 'served' && e.combo > 0) {
        const t = this.add
          .text(GAME_W / 2, 52, `คอมโบ x${this.shift.comboSteps} +฿${Math.round(e.combo)}`, { fontFamily: FONT, fontSize: '20px', color: '#ff9a6a', stroke: '#000', strokeThickness: 4 })
          .setOrigin(0.5)
          .setDepth(150);
        this.tweens.add({ targets: t, y: 36, alpha: 0, delay: 500, duration: 700, onComplete: () => t.destroy() });
      } else if (e.type === 'end') {
        this.endShift();
      }
    }
  }

  private endShift() {
    if (this.over) return;
    this.over = true;
    this.gestures.clear();
    this.fanning.clear();
    this.setBrush(null);
    for (let i = 0; i < this.n; i++) this.sfx.setSizzle(i, 0);
    // skewers still on the grill when the clock ends are wasted
    for (const sk of this.grill.slots) if (sk) this.wasted[sk.itemId] = (this.wasted[sk.itemId] ?? 0) + 1;
    const L = this.shift.ledger;
    const soldTotal = Object.values(this.sold).reduce((x, y) => x + y, 0);
    const result: ShiftResult = {
      sales: L.sales,
      tips: L.tips,
      combo: L.combo,
      served: L.served,
      walkouts: L.walkouts,
      avgStars: this.shift.avgStars(),
      sold: { ...this.sold },
      wasted: { ...this.wasted },
      xpEarned: soldTotal * PROGRESSION.xpPerSkewer + this.perfects * PROGRESSION.xpPerPerfect,
    };
    session.pendingResult = result;
    session.ratingBefore = session.s.rating;
    session.soldYesterday = { ...this.sold };
    this.time.delayedCall(900, () => this.scene.start('Summary'));
  }

  // ---- views ----
  private syncViews() {
    for (let i = 0; i < this.n; i++) {
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
    const m = effectiveMargin(sk);
    const cs = sk.sides[v.shownDown];
    let glaze: { col: number; alpha: number } | null = null;
    if (sk.sauce !== 'none') {
      const dark = Phaser.Math.Clamp((cs - (COOKING.doneAt + def.window)) / (m + 0.25), 0, 1);
      glaze = { col: mix(0x9a3a22, 0x0a0606, dark), alpha: 0.5 + 0.35 * dark };
    }
    drawBody(g, def, cs, sk.burst, { oiled: sk.oiled, glaze });
    const zones: [ReturnType<typeof sideZone>, ReturnType<typeof sideZone>] = [sideZone(sk.sides[0], def, m), sideZone(sk.sides[1], def, m)];
    drawIndicators(g, def, zones, v.shownDown, cs, this.ringOn, sk.burst, { oiled: sk.oiled, sauce: sk.sauce });
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
    for (let i = 0; i < this.n; i++) {
      if (!this.views[i]) continue;
      const c = this.cell(i);
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h - this.coalH + 8) return i;
    }
    return -1;
  }
  private cellAt(x: number, y: number): number {
    for (let i = 0; i < this.n; i++) {
      const c = this.cell(i);
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return i;
    }
    return -1;
  }

  private onDown(p: Phaser.Input.Pointer) {
    const q = pt(p);
    this.sfx.unlock();
    this.ptr.x = q.x;
    this.ptr.y = q.y;
    const g: Gesture = { mode: 'ui', sx: q.x, sy: q.y, slot: -1, dragging: false };
    const btn = this.btns.find((b) => b.t.getBounds().contains(q.x, q.y));
    if (this.over) {
      if (btn) g.ui = btn.fn;
    } else if (btn) {
      g.mode = 'ui';
      g.ui = btn.fn;
    } else if (q.y < SHOP_H) {
      if (this.shopView.signAt(q.x, q.y)) {
        this.paused = true;
        renameShop(
          this.game,
          (name) => this.shopView.setShopName(name),
          () => (this.paused = false),
        );
        return;
      }
      const id = this.shopView.billAt(q.x, q.y);
      if (id !== null) {
        this.pushEvents(this.shift.collect(id));
        this.sfx.coin();
      }
    } else if (this.cardAt(q.x, q.y) >= 0) {
      const i = this.cardAt(q.x, q.y);
      const lx = q.x - cardX(i), ly = q.y - CARD_Y;
      if (lx >= SHAKER.dx && lx <= SHAKER.dx + SHAKER.w && ly >= SHAKER.dy && ly <= SHAKER.dy + SHAKER.h) g.ui = () => this.shakeSlot(i);
      else g.ui = () => this.serveSlot(i);
    } else if (inRect(WATER, q.x, q.y)) {
      g.mode = 'bottle';
    } else if (inRect(POT, q.x, q.y)) {
      g.mode = 'pot';
      g.kind = q.x < POT.x + POT.w / 2 ? 'oil' : 'sauce';
    } else if (this.brushMode && this.skewerAt(q.x, q.y) >= 0) {
      g.mode = 'brush';
      g.done = new Set();
      const i = this.skewerAt(q.x, q.y);
      g.done.add(i);
      this.brushSkewer(i);
    } else {
      const itemId = this.coolerItemAt(q.x, q.y);
      const sIdx = this.skewerAt(q.x, q.y);
      if (itemId) {
        g.mode = 'cooler';
        g.itemId = itemId;
      } else if (sIdx >= 0) {
        g.mode = 'skewer';
        g.slot = sIdx;
      } else {
        const c = this.cellAt(q.x, q.y);
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
    const q = pt(p);
    this.ptr.x = q.x;
    this.ptr.y = q.y;
    const g = this.gestures.get(p.id);
    if (!g) return;
    if (g.mode === 'brush' && g.done) {
      const i = this.skewerAt(q.x, q.y);
      if (i >= 0 && !g.done.has(i)) {
        g.done.add(i);
        this.brushSkewer(i);
      }
      return;
    }
    if (g.mode === 'fan') {
      const c = this.cellAt(q.x, q.y);
      if (c >= 0) g.slot = c;
      return;
    }
    if (g.mode !== 'skewer') return;
    const v = this.views[g.slot];
    if (!v) return;
    if (!g.dragging && Phaser.Math.Distance.Between(q.x, q.y, g.sx, g.sy) > DRAG_PX) {
      g.dragging = true;
      this.tweens.killTweensOf(v.g);
      v.g.setScale(this.skScale() * 1.1).setAngle(0).setDepth(100);
    }
    if (g.dragging) {
      v.g.x = q.x;
      v.g.y = q.y;
    }
  }

  private onUp(p: Phaser.Input.Pointer) {
    const q = pt(p);
    const g = this.gestures.get(p.id);
    this.gestures.delete(p.id);
    this.fanning.delete(p.id);
    if (!g) return;
    if (g.mode === 'ui') {
      const d = Phaser.Math.Distance.Between(q.x, q.y, g.sx, g.sy);
      if (g.ui && d <= DRAG_PX) g.ui();
    } else if (g.mode === 'bottle') {
      this.waterMode = !this.waterMode;
      if (this.waterMode) this.setBrush(null);
      this.redrawBottle();
      if (this.waterMode) this.say('แตะไม้ที่ไฟลุก');
    } else if (g.mode === 'pot') {
      if (Phaser.Math.Distance.Between(q.x, q.y, g.sx, g.sy) <= DRAG_PX && g.kind) {
        this.setBrush(this.brushMode === g.kind ? null : g.kind);
        if (this.brushMode) {
          this.ptr.x = q.x;
          this.ptr.y = q.y;
          this.say(this.brushMode === 'oil' ? 'แปรงน้ำมัน: แตะหรือปัดผ่านไม้' : 'แปรงซอส: ทาเมื่อสุกทั้งสองด้าน', 1200);
        }
      }
    } else if (g.mode === 'cooler') {
      if (Phaser.Math.Distance.Between(q.x, q.y, g.sx, g.sy) <= DRAG_PX && g.itemId) this.placeItem(g.itemId);
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
      this.drop(g.slot, v, q.x, q.y);
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
      this.wasted[v.sk.itemId] = (this.wasted[v.sk.itemId] ?? 0) + 1;
      this.destroyView(slot);
      this.refreshHud();
      return;
    }
    const slotT = this.cardAt(x, y);
    if (slotT >= 0) {
      const q = skewerQuality(v.sk);
      if (q === null) {
        this.say(v.sk.burst ? 'แตกแล้ว! ทิ้งถังนะ' : 'ยังดิบ!');
        this.snapBack(v);
        return;
      }
      const itemId = v.sk.itemId;
      if (!this.shift.atTicket(slotT) || !this.shift.canAdd(slotT, itemId)) {
        this.say('ลูกค้าไม่ได้สั่ง');
        this.snapBack(v);
        return;
      }
      removeSkewer(this.grill, slot);
      this.destroyView(slot);
      this.shift.addSkewer(slotT, { itemId, quality: q });
      this.sfx.place();
      this.stats[this.qualityLabel(q)]++;
      this.sold[itemId] = (this.sold[itemId] ?? 0) + 1;
      if (q >= 0.95) this.perfects++;
      this.refreshCards();
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
    if ((this.stock[itemId] ?? 0) <= 0) return this.say('ของหมด!');
    const slot = this.grill.slots.findIndex((s) => s === null);
    if (slot < 0) return this.say('เตาเต็ม!');
    if (placeSkewer(this.grill, slot, itemId)) {
      this.sfx.place();
      this.stock[itemId]--;
      this.refreshCooler();
    } else this.say('วางไม่ได้');
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
    const dt = this.paused ? 0 : Math.min(deltaMs / 1000, 0.1) * DEV_SPEED;
    const fan = this.over ? undefined : [...this.gestures.values()].find((g) => g.mode === 'fan');
    const fanSlot = fan ? fan.slot : null;
    if (!this.over) {
      this.pushEvents(this.shift.tick(dt));
    }
    this.shopView.update(dt, this.shift);
    this.refreshCards();
    this.drawBars();
    this.refreshHud();
    const events = tick(this.grill, dt, Math.random, { fanSlot });
    this.syncViews();
    for (const e of events) this.handleEvent(e);
    // flames follow state (covers flare without events, e.g. after extinguish)
    for (let i = 0; i < this.n; i++) {
      const sk = this.grill.slots[i];
      if (sk && sk.flare > 0) this.addFlame(i);
      else if (this.flames[i]) this.removeFlame(i);
    }

    // held brush follows the pointer; auto-drop when idle
    this.brushG.clear();
    if (this.brushMode && !this.over) {
      this.brushIdle += dt;
      if (this.brushIdle > COOKING.brush.brushIdleDropSec) this.setBrush(null);
      else this.drawBrush(this.brushG, this.ptr.x, this.ptr.y - 6, this.brushMode, 6);
    }

    // coals
    const g = this.coalG;
    g.clear();
    for (let i = 0; i < this.n; i++) {
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
    for (let i = 0; i < this.n; i++) {
      const v = this.views[i];
      const sk = this.grill.slots[i];
      let level = 0;
      if (v && sk) {
        this.redrawView(v);
        const def = item(sk);
        const c = sk.sides[sk.down];
        level = Math.min(1, 0.2 + 0.8 * Math.min(1, c));
        const z = sideZone(c, def, effectiveMargin(sk));
        this.smokeT[i] -= dt;
        if (this.smokeT[i] <= 0 && (z === 'charred' || z === 'burnt')) {
          this.smokeT[i] = z === 'burnt' ? 0.12 : 0.3;
          (z === 'burnt' ? this.smokeBlack : this.smokeGrey).emitParticleAt(v.baseX, v.baseY - BODY_H * 0.45, 1);
        }
        if (sk.oilDrip > 0 && Math.random() < dt * 14) this.drip.emitParticleAt(v.baseX + (Math.random() - 0.5) * 24, v.baseY + BODY_H * 0.3, 1);
        if (z === 'perfect' && Math.random() < dt * 3) this.steam.emitParticleAt(v.baseX, v.baseY - BODY_H * 0.4, 1);
      }
      if (Math.abs(level - this.lastSizzle[i]) > 0.02) {
        this.lastSizzle[i] = level;
        this.sfx.setSizzle(i, level);
      }
    }
  }
}
