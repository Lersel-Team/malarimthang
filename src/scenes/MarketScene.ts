import Phaser from 'phaser';
import { pt, setupCamera } from '../engine/hidpi';
import { GAME_H, GAME_W } from '../config';
import { bulkOff, buyPacks, createMarket, packPrice, suggestRefill, takeLoan, type GameState, type Market } from '../core/economy';
import { ITEM_BY_ID } from '../data/balance';
import { mulberry32, session } from '../session';
import { renameShop } from './nameInput';
import { baht, toastAt } from './ui';
import {
  fitText, marketWall, uiButton, uiCounter, uiFadeIn, uiGoto, uiIcon, uiItemPic, uiMoney, uiPanel, uiPill, uiRibbon, uiShadow, uiTheme,
  type Backdrop, type UiButton, type UiMoney, type UiPill,
} from '../art/ui';

const LIST_Y = 100, LIST_H = 456;
const ROW_H = 76, CARD_H = 70, ROW_W = 344, ROW_X = 8;
const DRAG_PX = 8;
const COUNTER_Y = 556;
const T = uiTheme;

interface Hit { x: number; y: number; w: number; h: number; fn: () => void }
/** Per-item purchases made this visit: what to restore so [-] undoes exactly. */
interface Bought { money: number; stock: number; basis: number | undefined; bought: number }
interface Row {
  itemId: string;
  minus: UiButton;
  plus: UiButton;
  count: Phaser.GameObjects.Text;
  cap: Phaser.GameObjects.Text;
  pack: Phaser.GameObjects.Text;
  stock: Phaser.GameObjects.Text;
  full: UiPill;
}

export class MarketScene extends Phaser.Scene {
  private market!: Market;
  private bought: Record<string, Bought[]> = {};
  private list!: Phaser.GameObjects.Container;
  private rows: Row[] = [];
  private hits: Hit[] = [];
  private scroll = 0;
  private drag: { y0: number; s0: number; moved: boolean } | null = null;
  private headName!: Phaser.GameObjects.Text;
  private nameIcon!: Phaser.GameObjects.Image;
  private money!: UiMoney;
  private dayPill!: UiPill;
  private lvlPill!: UiPill;
  private ratePill!: UiPill;
  private refillBtn!: UiButton;
  private loanBtn!: UiButton;
  private openBtn!: UiButton;
  private wall!: Backdrop;
  private shownMoney = -1;
  private modal = false;

  constructor() {
    super('Market');
  }

  private get st(): GameState {
    return session.s;
  }

  create() {
    setupCamera(this);
    uiFadeIn(this);
    this.bought = {};
    this.scroll = 0;
    this.hits = [];
    this.rows = [];
    this.modal = false;
    this.shownMoney = -1;
    this.market = createMarket(this.st, mulberry32(this.st.day * 7919));

    this.wall = marketWall(this);

    // list first (below the header/counter so their shadows overlap the cards)
    this.list = this.add.container(0, 0);
    const mask = this.make.graphics({ x: 0, y: 0 }, false);
    mask.fillRect(0, LIST_Y, GAME_W, LIST_H);
    this.list.setMask(mask.createGeometryMask());
    this.buildList();

    // bottom counter (wooden plank) with the action buttons
    uiCounter(this, 0, COUNTER_Y, GAME_W, GAME_H - COUNTER_Y);
    this.refillBtn = uiButton(this, GAME_W / 2, 588, 336, 44, '', {
      variant: 'secondary', icon: 'cart', fontSize: 16, onClick: () => this.refill(), onDisabledClick: () => this.refill(),
    });
    this.loanBtn = uiButton(this, GAME_W / 2, 636, 336, 44, 'แม่ให้ยืม 200 ฿', { variant: 'green', icon: 'money', fontSize: 16, onClick: () => this.loan() });
    this.openBtn = uiButton(this, GAME_W / 2, 692, 336, 56, 'เปิดร้าน', {
      variant: 'primary', icon: 'fire', fontSize: 26, onClick: () => this.openShop(), onDisabledClick: () => this.openShop(),
    });

    // header board
    uiPanel(this, 4, -24, 352, 108, 'wood', { origin: 'topLeft' });
    this.headName = this.add.text(20, 22, '', { ...T.text.heading, fontSize: '21px', color: T.color.cream, stroke: '#2a1608', strokeThickness: 4 }).setOrigin(0, 0.5);
    this.nameIcon = uiIcon(this, 0, 22, 'brush', 18).setAlpha(0.85);
    this.add
      .zone(0, 0, 10, 44)
      .setOrigin(0, 0.5)
      .setName('nameHit')
      .setPosition(8, 22)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.rename());
    this.money = uiMoney(this, 346, 22, { value: this.st.money, h: 32, anchor: 'right' });
    this.dayPill = uiPill(this, 0, 60, '', { icon: 'clock', anchor: 'left', h: 26 });
    this.lvlPill = uiPill(this, 0, 60, '', { icon: 'level', kind: 'lamp', anchor: 'left', h: 26 });
    this.ratePill = uiPill(this, 0, 60, '', { icon: 'star', kind: 'cream', anchor: 'left', h: 26 });
    this.add.text(346, 60, 'ตลาดเช้า', { ...T.text.small, fontFamily: T.text.heading.fontFamily, fontStyle: 'bold', color: '#ffd9a0', stroke: '#2a1608', strokeThickness: 3 }).setOrigin(1, 0.5);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.setScroll(this.scroll + dy));
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('pointerupoutside', this.onUp, this);
    });
    this.renderAll();
  }

  private maxPacks() {
    return this.market.maxPacks;
  }
  private totalStock() {
    return Object.values(this.st.stock).reduce((a, b) => a + (b || 0), 0);
  }

  private rename() {
    if (this.modal) return;
    this.modal = true;
    renameShop(this.game, () => this.renderAll(), () => (this.modal = false));
  }

  // ---- actions ----
  private buy(itemId: string): boolean {
    const before = this.st;
    const next = buyPacks(before, this.market, itemId, 1);
    if (!next) return false;
    (this.bought[itemId] ??= []).push({
      money: before.money - next.money,
      stock: before.stock[itemId] ?? 0,
      basis: before.costBasis?.[itemId],
      bought: before.bought?.[itemId] ?? 0,
    });
    void session.commit(next);
    return true;
  }

  private unbuy(itemId: string) {
    const d = this.bought[itemId]?.pop();
    if (!d) return;
    const s = this.st;
    const costBasis = { ...s.costBasis };
    if (d.basis === undefined) delete costBasis[itemId];
    else costBasis[itemId] = d.basis;
    void session.commit({
      ...s,
      money: s.money + d.money,
      stock: { ...s.stock, [itemId]: d.stock },
      costBasis,
      bought: { ...s.bought, [itemId]: d.bought },
    });
  }

  private refill() {
    const plan = suggestRefill(this.st, this.market, session.soldYesterday);
    let n = 0;
    for (const [id, packs] of Object.entries(plan)) for (let i = 0; i < packs; i++) if (this.buy(id)) n++;
    toastAt(this, GAME_W / 2, 530, n > 0 ? `ซื้อแล้ว ${n} แพ็ค` : 'ไม่มีอะไรให้เติม', n > 0 ? 'cart' : 'close');
    this.renderAll();
  }

  private loan() {
    const next = takeLoan(this.st);
    if (!next) return;
    void session.commit(next);
    toastAt(this, GAME_W / 2, 530, 'แม่ให้ยืมแล้ว 200 ฿', 'money');
    this.renderAll();
  }

  private openShop() {
    if (this.totalStock() <= 0) {
      toastAt(this, GAME_W / 2, 530, 'ยังไม่มีของ ซื้อก่อนนะ', 'close');
      return;
    }
    uiGoto(this, 'Shift');
  }

  // ---- render ----
  private renderAll() {
    const s = this.st;
    this.headName.setText(s.shopName).setFontSize(21);
    fitText(this.headName, 168, 11);
    this.nameIcon.setPosition(this.headName.x + this.headName.width + 14, 22);
    (this.children.getByName('nameHit') as Phaser.GameObjects.Zone).setSize(this.headName.width + 40, 44);
    const animate = this.shownMoney >= 0;
    this.money.setValue(s.money, animate);
    this.shownMoney = s.money;
    let px = 12;
    for (const [p, label] of [[this.dayPill, `วันที่ ${s.day}`], [this.lvlPill, `เลเวล ${s.level}`], [this.ratePill, s.rating.toFixed(1)]] as const) {
      p.setText(label).setX(px);
      px += p.pillWidth + 6;
    }
    const plan = suggestRefill(s, this.market, session.soldYesterday);
    const n = Object.values(plan).reduce((a, b) => a + b, 0);
    this.refillBtn.setLabel(`ซื้อเหมือนเมื่อวาน ×1.2${n > 0 ? `  (${n} แพ็ค)` : ''}`).setEnabled(n > 0);
    const loan = takeLoan(s) !== null;
    this.loanBtn.setVisible(loan);
    this.refillBtn.y = loan ? 588 : 598;
    this.openBtn.y = loan ? 692 : 680;
    this.openBtn.setEnabled(this.totalStock() > 0);
    this.updateRows();
  }

  private buildList() {
    this.hits = [];
    this.rows = [];
    const offers = this.market.offers;
    offers.forEach((o, i) => {
      const def = ITEM_BY_ID[o.itemId];
      if (!def) return;
      const y = LIST_Y + 4 + i * ROW_H;
      const cy = y + CARD_H / 2;
      const objs: Phaser.GameObjects.GameObject[] = [];
      const card = uiPanel(this, ROW_X + ROW_W / 2, cy, ROW_W, CARD_H, 'tag');
      objs.push(card);
      if (o.deal) {
        const g = this.add.graphics();
        g.lineStyle(2.5, o.deal === 'cheap' ? 0x3fa062 : 0xd6342b, 0.95).strokeRoundedRect(ROW_X + 1, y + 1, ROW_W - 2, CARD_H - 2, 15);
        objs.push(g);
      }
      // picture plate
      const plate = this.add.graphics();
      plate.fillStyle(0x2a1d47, 1).fillCircle(ROW_X + 38, cy + 2, 25);
      plate.lineStyle(1.5, 0x1b1230, 0.85).strokeCircle(ROW_X + 38, cy + 2, 25);
      plate.lineStyle(1.2, 0xffb24a, 0.5).strokeCircle(ROW_X + 38, cy + 2, 22.5);
      plate.fillStyle(0xffffff, 0.08).fillEllipse(ROW_X + 38, cy - 10, 30, 10);
      objs.push(plate);
      const pic = uiItemPic(this, o.itemId, 40);
      pic.setPosition(ROW_X + 38, cy + 2);
      objs.push(pic);
      const tx = (x: number, yy: number, str: string, size: number, color: string, bold = false) =>
        this.add.text(x, yy, str, { ...T.text.body, fontStyle: bold ? 'bold' : 'normal', fontSize: `${size}px`, color });
      const name = tx(ROW_X + 70, y + 3, def.th, 17, T.color.paperInk, true);
      fitText(name, 150, 12);
      const price = tx(ROW_X + 70, y + 25, `${o.unitCost}฿/ไม้`, 13, '#9a4e08', true);
      const stock = tx(ROW_X + 70, y + 44, '', 12, '#256b40');
      objs.push(name, price, stock);
      if (o.deal) {
        const r = uiRibbon(this, ROW_X + 70 + price.width + 8 + 44, y + 39, o.deal === 'cheap' ? 'ถูกวันนี้' : 'แพงวันนี้', o.deal);
        r.x = ROW_X + 70 + price.width + 10 + r.pillWidth / 2;
        objs.push(r);
      }
      // stepper
      const cx = ROW_X + ROW_W - 64;
      // visuals are 40 px; the hit areas below are 46 px wide and 50 tall (>= 44)
      const minus = uiButton(this, cx - 42, y + 27, 40, 40, '', { variant: 'icon', icon: 'minus', interactive: false });
      const plus = uiButton(this, cx + 42, y + 27, 40, 40, '', { variant: 'icon', icon: 'plus', interactive: false });
      const count = tx(cx + 1, y + 27, '0', 21, T.color.paperInk, true).setOrigin(1, 0.5);
      const cap = tx(cx + 2, y + 31, `/${this.maxPacks()}`, 11, T.color.paperDim).setOrigin(0, 0.5);
      const pack = tx(cx, y + 59, '', 10.5, T.color.paperDim).setOrigin(0.5);
      const full = uiPill(this, cx, y + 59, 'เต็ม', { kind: 'red', h: 16, minW: 34, style: { fontSize: '10px' } }).setVisible(false);
      objs.push(minus, plus, count, cap, pack, full);
      this.list.add(objs);
      this.rows.push({ itemId: o.itemId, minus, plus, count, cap, pack, stock, full });
      const packCost = packPrice(this.market, o.itemId, (this.st.bought?.[o.itemId] ?? 0) + 1);
      this.hits.push({
        x: cx - 66, y: y + 2, w: 48, h: 50,
        fn: () => {
          if ((this.bought[o.itemId]?.length ?? 0) === 0) return;
          minus.press();
          this.unbuy(o.itemId);
          this.renderAll();
        },
      });
      const buy5 = uiButton(this, cx + 42, y + 56, 40, 16, '+5', { variant: 'secondary', interactive: false });
      objs.push(buy5);
      this.hits.push({
        x: cx + 18, y: y + 44, w: 48, h: 22,
        fn: () => {
          buy5.press();
          let n = 0;
          while (n < 5 && this.buy(o.itemId)) n++;
          if (n === 0) toastAt(this, GAME_W / 2, 530, this.st.money < packCost ? 'เงินไม่พอ' : (this.st.bought?.[o.itemId] ?? 0) >= this.maxPacks() ? `ซื้อได้วันละ ${this.maxPacks()} แพ็คต่อชนิด` : 'ช่องในตู้เย็นเต็ม', 'close');
          this.renderAll();
        },
      });
      this.hits.push({
        x: cx + 18, y: y + 2, w: 48, h: 42,
        fn: () => {
          plus.press();
          if (!this.buy(o.itemId)) {
            const why = this.st.money < packCost ? 'เงินไม่พอ' : (this.st.bought?.[o.itemId] ?? 0) >= this.maxPacks() ? `ซื้อได้วันละ ${this.maxPacks()} แพ็คต่อชนิด` : 'ที่เก็บของเต็ม';
            toastAt(this, GAME_W / 2, 530, why, 'close');
          }
          this.renderAll();
        },
      });
    });
    this.applyScroll();
  }

  private updateRows() {
    const s = this.st;
    for (const r of this.rows) {
      const have = s.stock[r.itemId] ?? 0;
      const cnt = s.bought?.[r.itemId] ?? 0;
      const full = cnt >= this.maxPacks();
      r.stock.setText(have > 0 ? `มี ${have} ไม้` : 'ยังไม่มี').setColor(have > 0 ? '#256b40' : T.color.paperDim);
      r.count.setText(`${cnt}`);
      const next = cnt + 1;
      const off = bulkOff(next);
      r.pack.setText(`แพ็ค ${this.market.packSize} · ${baht(packPrice(this.market, r.itemId, next))}${off > 0 ? ` (-${Math.round(off * 100)}%)` : ''}`).setVisible(!full);
      r.full.setVisible(full);
      r.minus.setEnabled((this.bought[r.itemId]?.length ?? 0) > 0);
      r.plus.setEnabled(!full);
    }
  }

  private maxScroll() {
    return Math.max(0, this.market.offers.length * ROW_H + 8 - LIST_H);
  }
  private setScroll(v: number) {
    this.scroll = Phaser.Math.Clamp(v, 0, this.maxScroll());
    this.applyScroll();
  }
  private applyScroll() {
    this.scroll = Phaser.Math.Clamp(this.scroll, 0, this.maxScroll());
    this.list.y = -this.scroll;
    this.wall.setParallax(this.scroll);
  }

  // ---- input (manual so drag-scroll and taps don't fight) ----
  private inList(y: number) {
    return y >= LIST_Y && y <= LIST_Y + LIST_H;
  }
  private onDown(p: Phaser.Input.Pointer) {
    const q = pt(p);
    if (this.modal || !this.inList(q.y)) return;
    this.drag = { y0: q.y, s0: this.scroll, moved: false };
  }
  private onMove(p: Phaser.Input.Pointer) {
    const q = pt(p);
    if (!this.drag || !p.isDown) return;
    if (Math.abs(q.y - this.drag.y0) > DRAG_PX) this.drag.moved = true;
    if (this.drag.moved) this.setScroll(this.drag.s0 - (q.y - this.drag.y0));
  }
  private onUp(p: Phaser.Input.Pointer) {
    const q = pt(p);
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved || this.modal || !this.inList(q.y)) return;
    const cy = q.y + this.scroll;
    const h = this.hits.find((h) => q.x >= h.x && q.x <= h.x + h.w && cy >= h.y && cy <= h.y + h.h);
    h?.fn();
  }
}
void uiShadow;
