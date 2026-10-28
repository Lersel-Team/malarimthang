import Phaser from 'phaser';
import { settings } from '../settings';
import { RES, pt, setupCamera } from '../engine/hidpi';
import { GAME_H, GAME_W } from '../config';
import { BALANCE, COOKING, ITEM_BY_ID, LOCATIONS, PROGRESSION, SHIFT, UPGRADES } from '../data/balance';
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
import { BODY_H, FONT, cookStages, drawIndicators, mix } from './grill/draw';
import { SkewerSprite, drawSkewerSprite, itemIcon } from '../art/items';
import { uiBanner, uiBar, uiButton, uiMoney, uiPanel, uiPill, uiToast, type UiBar, type UiButton, type UiMoney, type UiPill } from '../art/ui';

// Dev only: ?speed=0.3 slows the game for QA/playtests, ?speed=3 fast-forwards. Ignored in production builds.
const DEV_SPEED = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('speed')) || 1 : 1;

const HEAT_EVENNESS = 0.55;
const DRAG_PX = 10;

// Layout
const GRID_X = 16, GRID_W = 328, GRID_Y = 388, GRID_H = 150;
const COAL_H = 16; // coal strip along the front of the grill
const SK_FW = 34, SK_FH = 90; // skewer footprint at scale 1
const FAN_R = 52;
const COOLER = { x: 8, y: 556, w: 240, h: 150 };
const BIN = { x: 256, y: 556, w: 54, h: 54 };
const POT = { x: 256, y: 666, w: 96, h: 60 }; // brush pot below bin/water; oil brush = left half, sauce = right half
type BrushKind = 'oil' | 'sauce';
const WATER = { x: 318, y: 556, w: 34, h: 54 };
const HUD_H = 28;
const CARD_Y = SHOP_H + 4, CARD_W = 112, CARD_H = 122, CARD_GAP = 4, CARD_X0 = 8;
const cardX = (i: number) => CARD_X0 + i * (CARD_W + CARD_GAP);
const SHAKER = { dx: 4, dy: 83, w: 44, h: 22 };

/** Level index into an upgrade's values table (clamped). */
function upgradeValue(id: string, level: number): number {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return 0;
  return u.values[Math.max(0, Math.min(u.values.length - 1, level))];
}

interface Card {
  bg: Phaser.GameObjects.Graphics;
  bars: UiBar[];
  content: Phaser.GameObjects.GameObject[];
  sig: string;
}

interface View {
  sk: Skewer;
  /** Container: skewer sprite + indicator graphics (tweened/dragged as one). */
  g: SkewerSprite;
  ind: Phaser.GameObjects.Graphics;
  shownDown: 0 | 1;
  baseX: number;
  baseY: number;
}
interface Gesture {
  mode: 'skewer' | 'plate' | 'fan' | 'bottle' | 'ui' | 'pot' | 'brush';
  sx: number;
  sy: number;
  slot: number;
  itemId?: string;
  ghost?: Phaser.GameObjects.Image;
  ui?: () => void;
  kind?: BrushKind;
  hold?: boolean;
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
  private hudClock!: UiPill;
  private hudMoney!: UiMoney;
  private hudStar!: UiPill;
  private hudCombo!: UiPill;
  private hudSig = '';
  private lastToast: Phaser.GameObjects.Container | null = null;
  private powder!: Phaser.GameObjects.Particles.ParticleEmitter;
  private stats = { perfect: 0, ok: 0, burnt: 0, bin: 0 };
  private ringOn = true;
  private waterMode = false;
  private brushMode: BrushKind | null = null;
  private brushIdle = 0;
  private heldBrush!: Phaser.GameObjects.Image;
  private potG!: Phaser.GameObjects.Graphics;
  private potBrush: Record<BrushKind, Phaser.GameObjects.Image> = {} as Record<BrushKind, Phaser.GameObjects.Image>;
  private fanImg!: Phaser.GameObjects.Image;
  private drip!: Phaser.GameObjects.Particles.ParticleEmitter;
  private earlyWarned = false;
  private ptr = { x: 0, y: 0 };
  private coals: { hot: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }[] = [];
  private bottleImg!: Phaser.GameObjects.Image;
  private flames: (Phaser.GameObjects.Image | null)[] = [];
  private smokeT: number[] = [];
  private lastSizzle: number[] = [];
  private ringBtn!: UiButton;
  private muteBtn!: UiButton;
  private steam!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeGrey!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeBlack!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private splat!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fanning = new Set<number>();
  private n = 8; // max skewers on the grill (tier capacity)
  private tier = BALANCE.grillTiers[0];
  private fw = SK_FW * 0.8;
  private fh = SK_FH * 0.8;
  private rect = { x: GRID_X, y: GRID_Y, w: GRID_W, h: GRID_H };
  private pos: ({ x: number; y: number } | null)[] = [];
  private fanPos = { x: 0, y: 0 };
  private evenness = HEAT_EVENNESS;
  private heatPh: [number, number] = [0, 0];
  private coalLevel: number = SHIFT.coal.start;
  private coalAdded = 0;
  private gaugeG!: Phaser.GameObjects.Graphics;
  private gaugeSig = '';
  private menu: string[] = [];
  /** Skewers left in the fridge (refill the bar from here). */
  private stock: Record<string, number> = {};
  /** Skewers on the display bar: what customers pick from. */
  private display: Record<string, number> = {};
  private trayCap = 12;
  private sold: Record<string, number> = {};
  private wasted: Record<string, number> = {};
  private perfects = 0;
  private paused = false;
  private coolerCells: { id: string; x: number; y: number; w: number; h: number; icon: Phaser.GameObjects.Container | Phaser.GameObjects.Image; count: Phaser.GameObjects.Text; fridge: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super('Shift');
  }

  // ---- geometry ----
  private setGeometry(level: number) {
    const tiers = BALANCE.grillTiers;
    this.tier = tiers[Math.max(0, Math.min(tiers.length - 1, level))];
    this.fw = SK_FW * this.tier.scale;
    this.fh = SK_FH * this.tier.scale;
    const w = this.tier.cols * this.fw, h = this.tier.rows * this.fh + COAL_H;
    this.rect = { x: GRID_X + (GRID_W - w) / 2, y: GRID_Y + GRID_H - h, w, h };
    this.n = this.tier.cols * this.tier.rows;
  }
  private skScale() {
    return this.tier.scale;
  }
  private skPos(i: number) {
    return this.pos[i] ?? { x: this.rect.x, y: this.rect.y };
  }
  private inGrill(x: number, y: number, m = 0) {
    const r = this.rect;
    return x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
  }
  private legal(x: number, y: number, ignore: number) {
    for (let i = 0; i < this.n; i++) {
      const p = this.pos[i];
      if (!p || i === ignore) continue;
      if (Math.abs(x - p.x) < this.fw - 0.5 && Math.abs(y - p.y) < this.fh - 0.5) return false;
    }
    return true;
  }
  /** Free spot for a skewer: nearest legal one to `at`, or first fit left-to-right, top-to-bottom. Null when full. */
  private findSpot(at: { x: number; y: number } | null, ignore = -1): { x: number; y: number } | null {
    const r = this.rect, fw = this.fw, fh = this.fh;
    const x0 = r.x + fw / 2, x1 = r.x + r.w - fw / 2;
    const y0 = r.y + fh / 2, y1 = r.y + r.h - COAL_H - fh / 2 + 6;
    if (!at) {
      for (let row = 0; row < this.tier.rows; row++)
        for (let c = 0; c < this.tier.cols; c++) {
          const x = x0 + c * fw, y = y0 + row * fh;
          if (this.legal(x, y, ignore)) return { x, y };
        }
      return null;
    }
    let best: { x: number; y: number } | null = null, bd = Infinity;
    const xs: number[] = [], ys: number[] = [];
    for (let x = x0; x < x1; x += 3) xs.push(x);
    xs.push(x1);
    for (let y = y0; y < y1; y += 3) ys.push(y);
    ys.push(y1);
    for (const y of ys) for (const x of xs) {
      const d = (x - at.x) ** 2 + (y - at.y) ** 2;
      if (d < bd && this.legal(x, y, ignore)) { bd = d; best = { x, y }; }
    }
    return best ?? this.findSpot(null, ignore);
  }
  private heatAt(x: number, y: number) {
    const v = 0.6 * Math.sin(x / 41 + this.heatPh[0]) + 0.4 * Math.sin(x / 19 - y / 23 + this.heatPh[1]);
    return 1 + 0.3 * v * (1 - this.evenness);
  }
  private coalMult() {
    const c = SHIFT.coal;
    return c.heatMin + (c.heatMax - c.heatMin) * this.coalLevel;
  }
  private skewerAt(x: number, y: number): number {
    for (let i = 0; i < this.n; i++) {
      const p = this.pos[i];
      if (!p || !this.views[i]) continue;
      if (Math.abs(x - p.x) <= this.fw / 2 + 3 && Math.abs(y - p.y) <= this.fh / 2 + 3) return i;
    }
    return -1;
  }

  create() {
    setupCamera(this);
    if (settings.fx && this.renderer.type === Phaser.WEBGL) {
      this.cameras.main.postFX.addVignette(0.5, 0.5, 1.0, 0.2);
      // Bloom was tried (addBloom(0xffffff,1,1,0.5,0.18)) but washes/dims the whole frame; keep vignette only.
    }
    const st = session.s;
    this.setGeometry(st.upgrades.grillSize ?? 0);
    this.pos = Array(this.n).fill(null);
    this.evenness = upgradeValue('grillType', st.upgrades.grillType ?? 0) || HEAT_EVENNESS;
    this.heatPh = [Math.random() * 6.28, Math.random() * 6.28];
    this.coalLevel = SHIFT.coal.start;
    this.coalAdded = 0;
    this.gaugeSig = '';
    this.stock = { ...st.stock };
    const boxSlots = upgradeValue('displayBox', st.upgrades.displayBox ?? 0);
    this.trayCap = upgradeValue('tray', st.upgrades.tray ?? 0);
    this.menu = st.unlockedItems
      .filter((id) => ITEM_BY_ID[id] && (this.stock[id] ?? 0) > 0)
      .sort((a, b) => (this.stock[b] ?? 0) - (this.stock[a] ?? 0))
      .slice(0, boxSlots);
    // the bar starts full from the fridge; customers pick from it
    this.display = {};
    for (const id of this.menu) {
      const take = Math.min(this.trayCap, this.stock[id] ?? 0);
      this.display[id] = take;
      this.stock[id] -= take;
    }
    this.sold = {};
    this.wasted = {};
    this.perfects = 0;
    this.paused = false;
    const seats = upgradeValue('tables', st.upgrades.tables ?? 0) * 4;
    const wLevel = st.upgrades.waiter ?? 0;
    const waiterU = UPGRADES.find((u) => u.id === 'waiter') as { values: number[]; tripSec: number[] };
    const waiters = waiterU.values[Math.min(wLevel, waiterU.values.length - 1)];
    const waiterSec = waiterU.tripSec[Math.min(wLevel, waiterU.tripSec.length - 1)];

    this.sfx = (this.registry.get('sfx') as Sfx | undefined) ?? new Sfx();
    this.registry.set('sfx', this.sfx);
    this.sfx.stopAll();

    this.grill = createGrill(this.n, 1, Math.random);
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
      waiters,
      waiterSec,
      rating: st.rating,
      priceMult: upgradeValue('powder', st.upgrades.powder ?? 0) || 1,
      patienceMult: upgradeValue('seating', st.upgrades.seating ?? 0) || 1,
      spawnMult: upgradeValue('sign', st.upgrades.sign ?? 0) || 1,
      rng: Math.random,
      stock: this.display,
      reserve: this.stock,
    });
    this.stats = { perfect: 0, ok: 0, burnt: 0, bin: 0 };
    this.waterMode = false;
    this.brushMode = null;
    this.brushIdle = 0;
    this.earlyWarned = false;

    this.drawLowerBackdrop();
    this.shopView = new ShopView(this, 0, 0, GAME_W, SHOP_H, { seats, shopName: st.shopName });
    this.drawGrillFrame();
    this.gaugeG = this.add.graphics().setDepth(2);
    this.drawCooler();
    this.buildCoals();
    this.drawBinAndBottle();
    this.buildPot();
    this.heldBrush = this.add.image(0, 0, 'tool-brush-oil').setOrigin(0.5, 0.96).setDisplaySize(16, 46).setDepth(120).setVisible(false);
    this.fanImg = this.add.image(0, 0, 'tool-fan').setOrigin(0.5, 0.9).setDisplaySize(36, 44).setDepth(110).setVisible(false);
    this.add.text(POT.x + 24, POT.y + POT.h - 9, 'น้ำมัน', { fontFamily: FONT, fontSize: '10px', color: '#f0d890' }).setOrigin(0.5);
    this.add.text(POT.x + 72, POT.y + POT.h - 9, 'ซอส', { fontFamily: FONT, fontSize: '10px', color: '#e0a090' }).setOrigin(0.5);
    this.redrawPot();
    this.buildHud();
    this.buildParticles();
    this.buildCards();

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
    this.say('ลากไม้จากจานลงเตา → ปิ้ง → ลากใส่ถุง', 2600);
  }

  // ---- static drawing ----
  private drawLowerBackdrop() {
    this.add.image(0, SHOP_H, 'station-counter').setOrigin(0, 0).setDisplaySize(GAME_W, GAME_H - SHOP_H).setDepth(-2);
  }

  private drawGrillFrame() {
    // one open grill: skewers go wherever there is room, no marked slots
    const r = this.rect;
    this.add.image(r.x - 6, r.y - 6, 'grill-body').setOrigin(0, 0).setDisplaySize(r.w + 12, r.h + 12);
  }

  /** Heat bar above the grill: coal level (blue = cold, red = roaring). */
  private drawGauge() {
    const sig = this.coalLevel.toFixed(2);
    if (sig === this.gaugeSig) return;
    this.gaugeSig = sig;
    const r = this.rect, g = this.gaugeG, L = this.coalLevel;
    g.clear();
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(r.x - 6, r.y - 17, r.w + 12, 7, 3);
    g.fillStyle(mix(0x4a8ad0, 0xff4a1a, L), 1);
    g.fillRoundedRect(r.x - 5, r.y - 16, Math.max(2, (r.w + 10) * L), 5, 2);
  }

  private addCoal() {
    if (this.over) return;
    if (this.coalLevel >= 0.98) return this.say('ถ่านเต็มแล้ว');
    this.coalLevel = Math.min(1, this.coalLevel + SHIFT.coal.addStep);
    this.coalAdded++;
    this.sfx.place();
    for (let i = 0; i < 6; i++) this.sparks.emitParticleAt(this.rect.x + Math.random() * this.rect.w, this.rect.y + this.rect.h - COAL_H, 1);
    this.say(`เติมถ่าน (฿${SHIFT.coal.scoopCost}) ไฟแรงขึ้น`);
  }

  private addAsh() {
    if (this.over) return;
    if (this.coalLevel <= 0.02) return this.say('ไฟอ่อนสุดแล้ว');
    this.coalLevel = Math.max(0, this.coalLevel - SHIFT.coal.ashStep);
    this.sfx.brush();
    this.smokeGrey.emitParticleAt(this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h - COAL_H, 8);
    this.say('โรยเถ้า ไฟอ่อนลง');
  }

  /** Cell rect for cooler item i of n: <=4 big cards, <=8 two rows, else three rows of icons. */
  private coolerRect(i: number, n: number) {
    const x0 = COOLER.x + 12, y0 = COOLER.y + 30;
    if (n <= 4) return { x: x0 + i * 58, y: y0, w: 52, h: 112, mode: 0 };
    if (n <= 8) return { x: x0 + (i % 4) * 55, y: y0 + Math.floor(i / 4) * 58, w: 52, h: 54, mode: 1 };
    return { x: x0 + (i % 6) * 38, y: y0 + Math.floor(i / 6) * 38, w: 36, h: 36, mode: 2 };
  }

  private drawCooler() {
    this.add.image(COOLER.x, COOLER.y, 'cooler-body').setOrigin(0, 0).setDisplaySize(COOLER.w, COOLER.h);
    this.add.image(COOLER.x + 5, COOLER.y + 22, 'cooler-glass').setOrigin(0, 0).setDisplaySize(COOLER.w - 10, COOLER.h - 27).setDepth(1);
    this.add.text(COOLER.x + 10, COOLER.y + 3, 'ตู้โชว์ · แตะเพื่อเติม', { fontFamily: FONT, fontSize: '13px', color: '#10222a' });
    this.coolerCells = [];
    const ids = this.menu.slice(0, 18);
    ids.forEach((id, i) => {
      const it = ITEM_BY_ID[id];
      const r = this.coolerRect(i, ids.length);
      this.add.image(r.x, r.y, r.mode === 0 ? 'cooler-tray-l' : r.mode === 1 ? 'cooler-tray-m' : 'cooler-tray-s').setOrigin(0, 0).setDisplaySize(r.w, r.h);
      const cx = r.x + r.w / 2, cy = r.y + (r.mode === 0 ? 58 : r.mode === 1 ? 22 : 18);
      let ic: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
      if (r.mode === 0) {
        ic = drawSkewerSprite(this, it.id).setPosition(cx, cy).setScale(0.8);
      } else {
        ic = itemIcon(this, it.id, r.mode === 1 ? 40 : 32, 'raw').setPosition(cx, cy);
      }
      if (r.mode < 2) {
        this.add.text(r.x + r.w / 2, r.y + r.h - (r.mode === 0 ? 12 : 8), it.th, { fontFamily: FONT, fontSize: r.mode === 0 ? '10px' : '9px', color: '#e8f4f8' }).setOrigin(0.5);
      }
      const count = this.add
        .text(r.x + r.w - 2, r.y + 1, '', { fontFamily: FONT, fontSize: '11px', color: '#fff', backgroundColor: '#c0302a', padding: { x: 3, y: 0 } })
        .setOrigin(1, 0)
        .setDepth(2);
      const fridge = this.add
        .text(r.x + r.w - 2, r.y + r.h - 1, '', { fontFamily: FONT, fontSize: '9px', color: '#bfe6ff' })
        .setOrigin(1, 1)
        .setDepth(2);
      this.coolerCells.push({ id, x: r.x, y: r.y, w: r.w, h: r.h, icon: ic, count, fridge });
    });
    this.refreshCooler();
  }

  private refreshCooler() {
    for (const c of this.coolerCells) {
      const bar = this.display[c.id] ?? 0;
      const fr = this.stock[c.id] ?? 0;
      c.count.setText(String(bar));
      c.icon.setAlpha(bar > 0 ? 1 : 0.28);
      const low = bar <= this.trayCap * 0.3;
      c.count.setBackgroundColor(bar <= 0 ? '#4a4a52' : low ? '#e0701a' : '#c0302a');
      c.fridge.setText(fr > 0 ? `+${fr}` : '');
    }
  }

  private coolerItemAt(x: number, y: number): string | undefined {
    return this.coolerCells.find((c) => inRect(c, x, y))?.id;
  }

  /** Refills one item on the bar from the fridge, up to the tray size. */
  private refillItem(id: string) {
    if (this.over) return;
    const room = this.trayCap - (this.display[id] ?? 0);
    const take = Math.min(room, this.stock[id] ?? 0);
    if (room <= 0) return this.say('ถาดเต็มแล้ว');
    if (take <= 0) return this.say('ตู้เย็นหมดแล้ว!');
    this.display[id] = (this.display[id] ?? 0) + take;
    this.stock[id] -= take;
    this.sfx.place();
    this.refreshCooler();
    this.say(`เติม${ITEM_BY_ID[id].th} +${take}`);
  }

  private drawBinAndBottle() {
    this.add.image(BIN.x - 1, BIN.y - 4, 'tool-bin').setOrigin(0, 0).setDisplaySize(52, 62);
    this.bottleImg = this.add.image(WATER.x + WATER.w / 2, WATER.y + WATER.h / 2 + 1, 'tool-bottle').setDisplaySize(28, 54);
    this.add.text(BIN.x + BIN.w / 2, BIN.y + BIN.h + 10, 'ถังขยะ', { fontFamily: FONT, fontSize: '11px', color: '#b0a8b8' }).setOrigin(0.5);
    this.add.text(WATER.x + WATER.w / 2, WATER.y + WATER.h + 10, 'น้ำ', { fontFamily: FONT, fontSize: '11px', color: '#b0a8b8' }).setOrigin(0.5);
    this.redrawBottle();
  }

  private redrawBottle() {
    this.bottleImg.setTexture(this.waterMode ? 'tool-bottle-on' : 'tool-bottle');
  }

  private buildCoals() {
    this.coals = [];
    const r = this.rect, segW = 16, cnt = Math.ceil(r.w / segW);
    const y0 = r.y + r.h - COAL_H, h = COAL_H - 2;
    for (let i = 0; i < cnt; i++) {
      const x = r.x + i * segW, w = Math.min(segW, r.x + r.w - x) + 0.5;
      this.add.image(x, y0, 'coal-cold').setOrigin(0, 0).setDisplaySize(w, h).setDepth(1);
      const hot = this.add.image(x, y0, 'coal-hot').setOrigin(0, 0).setDisplaySize(w, h).setDepth(1.1).setAlpha(0);
      this.add.image(x, y0, 'grill-grate').setOrigin(0, 0).setDisplaySize(w, h).setDepth(1.2);
      const glow = this.add
        .image(x + w / 2, y0 - 2, 'fx-glow')
        .setDisplaySize(segW * 2.2, 30)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(1.3)
        .setAlpha(0);
      this.coals.push({ hot, glow });
    }
  }

  private buildHud() {
    this.btns = [];
    const bar = this.add.graphics().setDepth(90);
    bar.fillStyle(0x10091c, 0.7);
    bar.fillRect(0, 0, GAME_W, HUD_H);
    bar.fillStyle(0xffb24a, 0.25);
    bar.fillRect(0, HUD_H - 1, GAME_W, 1);
    this.hudClock = uiPill(this, 8, 14, '', { kind: 'dark', icon: 'clock', h: 22, anchor: 'left', minW: 60 }).setDepth(91);
    this.hudMoney = uiMoney(this, 76, 14, { h: 22, anchor: 'left' }).setDepth(91);
    this.hudStar = uiPill(this, 156, 14, '-', { kind: 'dark', icon: 'star', h: 22, anchor: 'left', minW: 46 }).setDepth(91);
    this.hudCombo = uiPill(this, 212, 14, '', { kind: 'red', icon: 'fire', h: 22, anchor: 'left' }).setDepth(91);
    const btn = (x: number, icon: 'sound' | 'gear', fn: () => void) => {
      const t = uiButton(this, x, 14, 30, 24, '', { variant: 'icon', icon, interactive: false }).setDepth(92);
      this.btns.push({ t, fn });
      return t;
    };
    this.ringBtn = btn(344, 'gear', () => {
      this.ringOn = !this.ringOn;
      this.ringBtn.setAlpha(this.ringOn ? 1 : 0.45);
    });
    this.muteBtn = btn(310, 'sound', () => {
      this.sfx.muted = !this.sfx.muted;
      this.muteBtn.setAlpha(this.sfx.muted ? 0.45 : 1);
    });
    this.muteBtn.setAlpha(this.sfx.muted ? 0.45 : 1);
    this.ringBtn.setAlpha(this.ringOn ? 1 : 0.45);
    const tool = (x: number, label: string, variant: 'primary' | 'secondary', fn: () => void) => {
      const t = uiButton(this, x, 642, 46, 28, label, { variant, interactive: false }).setDepth(92);
      this.btns.push({ t, fn });
    };
    tool(281, 'ถ่าน', 'primary', () => this.addCoal());
    tool(333, 'เถ้า', 'secondary', () => this.addAsh());
  }
  private btns: { t: Phaser.GameObjects.Container; fn: () => void }[] = [];

  private buildParticles() {
    const mk = (cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) => {
      const spark = cfg.frame === 'spark';
      const k = (spark ? 6 / 8 : 16 / 24) / RES; // art textures are RESx; keep the old on-screen size
      const sc = cfg.scale as { start: number; end: number };
      return this.add
        .particles(0, 0, spark ? 'fx-spark' : 'fx-puff', { ...cfg, scale: { start: sc.start * k, end: sc.end * k }, frame: undefined, emitting: false })
        .setDepth(60);
    };
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
    this.lastToast?.destroy();
    this.lastToast = uiToast(this, msg, { y: 372, hold });
  }

  // ---- brushes ----
  private brushRect(k: BrushKind) {
    return { x: POT.x + (k === 'oil' ? 0 : POT.w / 2), y: POT.y, w: POT.w / 2, h: POT.h };
  }

  private buildPot() {
    this.add.image(POT.x, POT.y, 'tool-pot').setOrigin(0, 0).setDisplaySize(POT.w, POT.h).setDepth(0.1);
    (['oil', 'sauce'] as BrushKind[]).forEach((k) => {
      const r = this.brushRect(k);
      this.potBrush[k] = this.add
        .image(r.x + r.w / 2, POT.y + 30, `tool-brush-${k}`)
        .setOrigin(0.5, 0.96)
        .setDisplaySize(16, 46)
        .setAngle(k === 'oil' ? -8 : 8)
        .setDepth(0.2);
    });
    this.add.image(POT.x, POT.y, 'tool-pot-front').setOrigin(0, 0).setDisplaySize(POT.w, POT.h).setDepth(0.3);
    this.potG = this.add.graphics().setDepth(0.4);
  }

  private redrawPot() {
    const g = this.potG;
    g.clear();
    (['oil', 'sauce'] as BrushKind[]).forEach((k) => {
      const r = this.brushRect(k);
      this.potBrush[k].setVisible(this.brushMode !== k);
      if (this.brushMode === k) {
        g.lineStyle(3, 0xffffff, 1);
        g.strokeRoundedRect(r.x + 1, r.y - 1, r.w - 2, r.h + 2, 8);
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
    this.heldBrush.setVisible(!!k);
    if (k) this.heldBrush.setTexture(`tool-brush-${k}`);
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
    const sig = `${sh.clock()}|${avg === null ? '-' : avg.toFixed(1)}|${sh.comboSteps}`;
    if (sig !== this.hudSig) {
      this.hudSig = sig;
      this.hudClock.setText(sh.clock());
      this.hudStar.setText(avg === null ? '-' : avg.toFixed(1));
      this.hudCombo.setText(`x${sh.comboSteps}`).setVisible(sh.comboSteps > 0);
    }
    this.hudMoney.setValue(Math.round(sh.money));
  }

  // ---- ticket rail ----
  private buildCards() {
    for (let i = 0; i < MAX_TICKETS; i++) {
      const bg = this.add.graphics().setDepth(3);
      const bars = (['green', 'xp', 'red'] as const).map((kind) =>
        uiBar(this, cardX(i) + CARD_W / 2, CARD_Y + CARD_H - 13, CARD_W - 26, { h: 10, kind, shine: false }).setDepth(4).setVisible(false),
      );
      this.cards.push({ bg, bars, content: [], sig: '' });
    }
  }

  private txt(x: number, y: number, s: string, size: number, color: string) {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color }).setDepth(5);
    return t;
  }

  private cardSig(c: Customer | null): string {
    if (!c || !c.ticket) return 'empty';
    const filled = c.order.lines.map((l) => c.ticket!.skewers.filter((s) => s.itemId === l.itemId).length).join(',');
    const t = c.ticket;
    const plate = c.order.lines.map((l) => `${t.picked[l.itemId] ?? 0}.${t.grilled[l.itemId] ?? 0}`).join(',');
    return `${c.id}|${filled}|${plate}|${t.shakes}|${this.shift.isComplete(c.ticketSlot ?? 0)}`;
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
      const eatIn = c.order.eatIn;
      const panel = uiPanel(this, x, y, CARD_W, CARD_H, 'ticket', { origin: 'topLeft', tape: false, notch: 0.15, accent: done ? 0x3f9a62 : 0xd6342b, seed: c.id }).setDepth(3);
      card.content.push(panel);
      card.content.push(this.txt(x + 10, y + 7, c.name, 12, '#3a2a20'));
      // eat-in orders go on a plate to the table, takeaway orders in a bag
      const chip = this.add.graphics().setDepth(4);
      chip.fillStyle(eatIn ? 0x2f7a48 : 0x2a5aa8, 1);
      chip.fillRoundedRect(x + CARD_W - 50, y + 7, 42, 14, 7);
      card.content.push(chip);
      card.content.push(this.txt(x + CARD_W - 29, y + 14, eatIn ? 'นั่งกิน' : 'กลับบ้าน', 9, '#fff').setOrigin(0.5));
      // tray: raw skewers the customer picked, waiting for the grill
      const tray = this.add.graphics().setDepth(4);
      tray.fillStyle(0xe9dfcc, 0.9);
      tray.fillRoundedRect(x + 6, y + 23, CARD_W - 12, 30, 7);
      tray.lineStyle(1, 0xc4b8a4, 1);
      tray.strokeRoundedRect(x + 6, y + 23, CARD_W - 12, 30, 7);
      card.content.push(tray);
      this.plateLayout(i).forEach((it) => {
        tray.lineStyle(1.2, 0x9a7a4a, 1);
        tray.lineBetween(it.x - it.size * 0.62, it.y, it.x + it.size * 0.62, it.y);
        card.content.push(itemIcon(this, it.itemId, it.size, 'raw').setPosition(it.x, it.y).setDepth(5));
      });
      // serving container: bag or plate, fills as grilled skewers are dropped in
      const total = c.order.lines.reduce((n, l) => n + l.qty, 0);
      const sk = c.ticket.skewers;
      const frac = total > 0 ? Math.min(1, sk.length / total) : 0;
      const cx = x + 46, cy = y + 66;
      const box = this.add.graphics().setDepth(4);
      if (eatIn) {
        box.fillStyle(0x000000, 0.18);
        box.fillEllipse(cx + 1, cy + 3, 80, 22);
        box.fillStyle(0xf8f6f0, 1);
        box.fillEllipse(cx, cy, 80, 22);
        box.lineStyle(2, done ? 0x3f9a62 : 0xb8b0a0, 1);
        box.strokeEllipse(cx, cy, 80, 22);
        box.lineStyle(1, 0xd8d2c4, 1);
        box.strokeEllipse(cx, cy, 62, 15);
      } else {
        box.lineStyle(2, 0x8a6a3a, 1);
        box.beginPath();
        box.arc(cx - 11, cy - 10, 7, Math.PI, 0);
        box.arc(cx + 11, cy - 10, 7, Math.PI, 0);
        box.strokePath();
        box.fillStyle(0xc9a064, 1);
        box.fillRoundedRect(cx - 28, cy - 10, 56, 24, 3);
        box.fillStyle(0xe8c47c, 1);
        box.fillRect(cx - 27, cy - 9, 54 * frac, 22);
        box.lineStyle(done ? 3 : 1.5, done ? 0x3f9a62 : 0x8a6a3a, 1);
        box.strokeRoundedRect(cx - 28, cy - 10, 56, 24, 3);
        box.lineStyle(1, 0x8a6a3a, 0.6);
        box.lineBetween(cx - 28, cy - 4, cx + 28, cy - 4);
      }
      card.content.push(box);
      if (eatIn) {
        sk.slice(0, 10).forEach((k, n) => {
          const px = cx - 32 + (n % 5) * 16, py = cy - 4 + Math.floor(n / 5) * 8;
          card.content.push(itemIcon(this, k.itemId, 10).setPosition(px, py).setDepth(5));
        });
      }
      if (sk.length === 0) card.content.push(this.txt(cx, cy + (eatIn ? 0 : 3), eatIn ? 'วางจาน' : 'ใส่ถุง', 10, '#9a8a70').setOrigin(0.5));
      else if (!eatIn) card.content.push(this.txt(cx, cy + 3, `${sk.length}/${total}`, 12, '#3a2a20').setOrigin(0.5));
      card.content.push(this.txt(x + CARD_W - 8, cy - 4, done ? 'ส่ง ▶' : eatIn ? `${sk.length}/${total}` : '', 12, done ? '#b0580a' : '#6a5a48').setOrigin(1, 0));
      const sp = c.order.spice;
      const by = y + SHAKER.dy;
      card.content.push(this.add.image(x + SHAKER.dx, by, 'tool-shaker').setOrigin(0, 0).setDisplaySize(SHAKER.w, SHAKER.h).setDepth(4));
      card.content.push(this.txt(x + SHAKER.dx + SHAKER.w / 2, by + SHAKER.h / 2, 'ผง', 12, '#fff').setOrigin(0.5));
      if (sp > 0 || c.ticket.shakes > 0) {
        const okShake = c.ticket.shakes === sp;
        card.content.push(this.txt(x + SHAKER.dx + SHAKER.w + 5, by + 3, `${c.ticket.shakes}/${sp}`, 13, okShake ? '#2f7a48' : '#8a5a30'));
      }
      card.content.push(this.txt(x + CARD_W - 8, by + 4, sp === 0 ? 'ไม่เผ็ด' : `🌶×${sp}`, 11, '#b02a1a').setOrigin(1, 0));
    }
  }

  private drawBars() {
    for (let i = 0; i < MAX_TICKETS; i++) {
      const bars = this.cards[i].bars;
      const c = this.shift.atTicket(i);
      if (!c || !c.ticket) {
        bars.forEach((b) => b.setVisible(false));
        continue;
      }
      const f = Phaser.Math.Clamp(c.patience / c.patienceMax, 0, 1);
      const k = f > 0.6 ? 0 : f > 0.3 ? 1 : 2;
      bars.forEach((b, j) => b.setVisible(j === k));
      if (Math.abs(bars[k].value - f) > 0.004) bars[k].setValue(f, false);
    }
  }

  private cardAt(x: number, y: number): number {
    if (y < CARD_Y || y > CARD_Y + CARD_H) return -1;
    for (let i = 0; i < MAX_TICKETS; i++) if (x >= cardX(i) && x <= cardX(i) + CARD_W) return i;
    return -1;
  }

  /** Positions of the raw skewers on ticket `slot`'s plate (shared by drawing and hit-testing). */
  private plateLayout(slot: number): { itemId: string; x: number; y: number; size: number; hw: number; hh: number }[] {
    const c = this.shift.atTicket(slot);
    if (!c) return [];
    const ids: string[] = [];
    for (const l of c.order.lines) for (let k = this.shift.onPlate(slot, l.itemId); k > 0; k--) ids.push(l.itemId);
    const m = ids.length;
    const [cols, dx, dy, size] = m <= 10 ? [5, 18, 14, 14] : m <= 20 ? [10, 9.6, 13, 10] : [12, 8, 10, 9];
    const x0 = cardX(slot) + CARD_W / 2 - ((Math.min(cols, m) - 1) * dx) / 2;
    const y0 = CARD_Y + 30;
    return ids.map((itemId, k) => ({ itemId, x: x0 + (k % cols) * dx, y: y0 + Math.floor(k / cols) * dy, size, hw: dx / 2 + 1, hh: dy / 2 + 1 }));
  }

  /** Raw skewer on a plate under the pointer. */
  private plateItemAt(x: number, y: number): { slot: number; itemId: string } | null {
    const i = this.cardAt(x, y);
    if (i < 0) return null;
    let best: { slot: number; itemId: string } | null = null, bd = Infinity;
    for (const it of this.plateLayout(i)) {
      const d = (it.x - x) ** 2 + (it.y - y) ** 2;
      if (d < bd && Math.abs(it.x - x) <= it.hw && Math.abs(it.y - y) <= it.hh) { bd = d; best = { slot: i, itemId: it.itemId }; }
    }
    return best;
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
    this.lastToast?.destroy();
    uiBanner(this, GAME_W / 2, 372, 'หมดเวลาแล้ว!').setDepth(400);
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
      extraCharcoal: this.coalAdded,
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
        this.pos[i] = null;
      }
      if (sk && !this.views[i]) {
        const p = this.skPos(i);
        const g = drawSkewerSprite(this, sk.itemId, { compact: this.tier.scale < 0.7 }).setPosition(p.x, p.y).setScale(this.skScale()).setDepth(5);
        const ind = this.add.graphics();
        g.add(ind);
        g.y = p.y - 30;
        this.tweens.add({ targets: g, y: p.y, duration: 140, ease: 'Back.Out' });
        this.views[i] = { sk, g, ind, shownDown: sk.down, baseX: p.x, baseY: p.y };
      }
    }
  }

  private redrawView(v: View) {
    const sk = v.sk;
    const def = item(sk);
    const g = v.g;
    const m = effectiveMargin(sk);
    const cs = sk.sides[v.shownDown];
    const { a, b, t } = cookStages(cs, def, m);
    g.setStage(a, b, t).setOiled(sk.oiled).setBurst(sk.burst);
    if (sk.sauce !== 'none') {
      const dark = Phaser.Math.Clamp((cs - (COOKING.doneAt + def.window)) / (m + 0.25), 0, 1);
      g.setSauce(sk.sauce, mix(0xb04a2a, 0x1a0c08, dark), 0.5 + 0.35 * dark);
    } else g.setSauce('none');
    const zones: [ReturnType<typeof sideZone>, ReturnType<typeof sideZone>] = [sideZone(sk.sides[0], def, m), sideZone(sk.sides[1], def, m)];
    v.ind.clear();
    drawIndicators(v.ind, def, zones, v.shownDown, cs, this.ringOn, sk.burst, { oiled: sk.oiled, sauce: sk.sauce });
    // with a brush in hand, ring the skewers that can take it (green = good to go, orange = too early for sauce)
    if (this.brushMode) {
      let col = 0;
      if (this.brushMode === 'oil' && !sk.oiled) col = 0xffd24a;
      else if (this.brushMode === 'sauce' && sk.sauce === 'none') col = zones.includes('raw') ? 0xff8a3a : 0x7ae07a;
      if (col) {
        v.ind.lineStyle(3, col, 0.55 + 0.35 * Math.sin(this.time.now / 160));
        v.ind.strokeRoundedRect(-26, -BODY_H / 2 - 30, 52, BODY_H + 52, 12);
      }
    }
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
      const line = this.plateItemAt(q.x, q.y);
      if (lx >= SHAKER.dx && lx <= SHAKER.dx + SHAKER.w && ly >= SHAKER.dy && ly <= SHAKER.dy + SHAKER.h) g.ui = () => this.shakeSlot(i);
      else if (line) {
        g.mode = 'plate';
        g.slot = line.slot;
        g.itemId = line.itemId;
      } else g.ui = () => this.serveSlot(i);
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
      const sIdx = this.skewerAt(q.x, q.y);
      const coolerId = this.coolerItemAt(q.x, q.y);
      if (coolerId) {
        g.mode = 'ui';
        g.ui = () => this.refillItem(coolerId);
      } else if (sIdx >= 0) {
        g.mode = 'skewer';
        g.slot = sIdx;
      } else {
        if (this.inGrill(q.x, q.y, 6)) {
          g.mode = 'fan';
          this.fanPos.x = q.x;
          this.fanPos.y = q.y;
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
    if (g.mode === 'pot' && g.kind && Phaser.Math.Distance.Between(q.x, q.y, g.sx, g.sy) > DRAG_PX) {
      // dragging a brush out of the pot: it follows the finger and paints what it crosses
      this.setBrush(g.kind);
      g.mode = 'brush';
      g.hold = true;
      g.done = new Set();
      this.say(g.kind === 'oil' ? 'ปัดผ่านไม้เพื่อทาน้ำมัน' : 'ปัดผ่านไม้ที่สุกแล้วเพื่อทาซอส', 1200);
    }
    if (g.mode === 'brush' && g.done) {
      if (g.hold) this.brushIdle = 0;
      const i = this.skewerAt(q.x, q.y);
      if (i >= 0 && !g.done.has(i)) {
        g.done.add(i);
        this.brushSkewer(i);
      }
      return;
    }
    if (g.mode === 'fan') {
      this.fanPos.x = q.x;
      this.fanPos.y = q.y;
      return;
    }
    if (g.mode === 'plate' && g.itemId) {
      if (!g.dragging && Phaser.Math.Distance.Between(q.x, q.y, g.sx, g.sy) > DRAG_PX) {
        g.dragging = true;
        g.ghost = itemIcon(this, g.itemId, 34, 'raw').setDepth(120);
      }
      g.ghost?.setPosition(q.x, q.y);
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
    } else if (g.mode === 'brush') {
      if (g.hold) this.setBrush(null);
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
    } else if (g.mode === 'plate') {
      g.ghost?.destroy();
      if (!g.itemId) return;
      if (!g.dragging) this.placeFromPlate(g.slot, g.itemId, null);
      else if (this.inGrill(q.x, q.y, 14)) this.placeFromPlate(g.slot, g.itemId, q);
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
      // the customer whose plate it came from picks a replacement
      for (let t = 0; t < MAX_TICKETS; t++) {
        const tk = this.shift.atTicket(t)?.ticket;
        if (tk && (tk.grilled[v.sk.itemId] ?? 0) > tk.skewers.filter((x) => x.itemId === v.sk.itemId).length) {
          this.shift.replacePicked(t, v.sk.itemId);
          break;
        }
      }
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
    if (this.inGrill(x, y, 14)) {
      const spot = this.findSpot({ x, y }, slot);
      if (spot) {
        this.pos[slot] = spot;
        v.baseX = spot.x;
        v.baseY = spot.y;
        this.grill.heat[slot] = this.heatAt(spot.x, spot.y);
        v.g.setDepth(5);
        this.tweens.add({ targets: v.g, x: spot.x, y: spot.y, scale: this.skScale(), duration: 120, ease: 'Back.Out' });
        this.sfx.place();
        return;
      }
    }
    this.snapBack(v);
  }

  private destroyView(slot: number) {
    this.views[slot]?.g.destroy();
    this.views[slot] = null;
    this.pos[slot] = null;
    this.removeFlame(slot);
  }

  /** Moves one raw skewer from a customer's plate to the grill: nearest free spot to `at`, else the first free one. */
  private placeFromPlate(ticket: number, itemId: string, at: { x: number; y: number } | null) {
    const slot = this.grill.slots.findIndex((x) => x === null);
    const spot = slot < 0 ? null : this.findSpot(at);
    if (!spot) return this.say('เตาเต็ม!');
    if (!this.shift.takeFromPlate(ticket, itemId)) return;
    this.pos[slot] = spot;
    this.grill.heat[slot] = this.heatAt(spot.x, spot.y);
    placeSkewer(this.grill, slot, itemId);
    this.sfx.place();
    this.refreshCards();
  }

  // ---- flames / fx ----
  private addFlame(slot: number) {
    if (this.flames[slot]) return;
    const c = this.skPos(slot);
    const k = this.tier.scale;
    const f = this.add.image(c.x, c.y + this.fh / 2 + 4, 'fx-flame').setOrigin(0.5, 1).setDepth(8).setDisplaySize(28 * k * 1.3, 46 * k * 1.3);
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
    const top = p.y - BODY_H * 0.4 * this.tier.scale;
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
    const fanSlots = new Set<number>();
    if (fan) for (let i = 0; i < this.n; i++) {
      const p = this.pos[i];
      if (p && this.grill.slots[i] && Math.hypot(p.x - this.fanPos.x, p.y - this.fanPos.y) <= FAN_R) fanSlots.add(i);
    }
    if (!this.over) {
      this.coalLevel = Math.max(0, this.coalLevel - dt * SHIFT.coal.burnPerSec);
      this.pushEvents(this.shift.tick(dt));
      this.refreshCooler();
    }
    this.shopView.update(dt, this.shift);
    this.refreshCards();
    this.drawBars();
    this.refreshHud();
    const mult = this.coalMult();
    for (let i = 0; i < this.n; i++) {
      const p = this.pos[i];
      if (p) this.grill.heat[i] = this.heatAt(p.x, p.y) * mult;
    }
    this.drawGauge();
    const events = tick(this.grill, dt, Math.random, { fanSlots });
    this.syncViews();
    for (const e of events) this.handleEvent(e);
    // flames follow state (covers flare without events, e.g. after extinguish)
    for (let i = 0; i < this.n; i++) {
      const sk = this.grill.slots[i];
      if (sk && sk.flare > 0) this.addFlame(i);
      else if (this.flames[i]) this.removeFlame(i);
    }

    // held brush follows the pointer; auto-drop when idle
    if (this.brushMode && !this.over) {
      this.brushIdle += dt;
      if (this.brushIdle > COOKING.brush.brushIdleDropSec) this.setBrush(null);
      else this.heldBrush.setPosition(this.ptr.x, this.ptr.y - 2).setAngle(14);
    }

    // coals: heat crossfades cold -> hot, glow + flicker
    const r = this.rect;
    const flaring = this.grill.slots.some((x) => x && x.flare > 0);
    this.coals.forEach((cs, i) => {
      const cx = r.x + i * 16 + 8;
      let b = Phaser.Math.Clamp((this.heatAt(cx, r.y) * mult - 0.5) / 0.9, 0, 1);
      if (fan && Math.abs(cx - this.fanPos.x) < FAN_R) b = Math.min(1, b + 0.35);
      if (flaring && this.grill.slots.some((x, k) => x && x.flare > 0 && Math.abs((this.pos[k]?.x ?? -999) - cx) < 20)) b = 1;
      const fl = 0.85 + 0.15 * Math.sin(time / 130 + i * 1.7) * Math.sin(time / 310 + i);
      cs.hot.setAlpha(Math.min(1, b * fl + 0.03));
      cs.glow.setAlpha((0.06 + 0.55 * b) * fl);
      if (fan && Math.abs(cx - this.fanPos.x) < FAN_R && Math.random() < 0.08) this.sparks.emitParticleAt(cx + (Math.random() - 0.5) * 12, r.y + r.h - COAL_H + 4, 1);
    });
    if (fan) {
      const fx = Phaser.Math.Clamp(this.fanPos.x, r.x, r.x + r.w);
      this.fanImg.setVisible(true).setPosition(fx + 14, r.y + r.h - COAL_H - 10).setAngle(-25 + Math.sin(time / 60) * 22);
    } else this.fanImg.setVisible(false);

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
          (z === 'burnt' ? this.smokeBlack : this.smokeGrey).emitParticleAt(v.baseX, v.baseY - BODY_H * 0.45 * this.tier.scale, 1);
        }
        if (sk.oilDrip > 0 && Math.random() < dt * 14) this.drip.emitParticleAt(v.baseX + (Math.random() - 0.5) * 24 * this.tier.scale, v.baseY + BODY_H * 0.3 * this.tier.scale, 1);
        if (z === 'perfect' && Math.random() < dt * 3) this.steam.emitParticleAt(v.baseX, v.baseY - BODY_H * 0.4 * this.tier.scale, 1);
      }
      if (Math.abs(level - this.lastSizzle[i]) > 0.02) {
        this.lastSizzle[i] = level;
        this.sfx.setSizzle(i, level);
      }
    }
  }
}
