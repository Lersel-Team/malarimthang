import Phaser from 'phaser';
import { pt, setupCamera } from '../engine/hidpi';
import { COLORS, GAME_H, GAME_W } from '../config';
import { buyPacks, createMarket, suggestRefill, takeLoan, type GameState, type Market } from '../core/economy';
import { ITEM_BY_ID } from '../data/balance';
import { mulberry32, session } from '../session';
import { FONT, drawIcon } from './grill/draw';
import { renameShop } from './nameInput';
import { baht, makeBtn, toastAt } from './ui';

const LIST_Y = 84, LIST_H = 476;
const ROW_H = 68, ROW_W = 344, ROW_X = 8;
const DRAG_PX = 8;

interface Hit { x: number; y: number; w: number; h: number; fn: () => void }
/** Per-item purchases made this visit: what to restore so [-] undoes exactly. */
interface Bought { money: number; stock: number; basis: number | undefined; bought: number }

export class MarketScene extends Phaser.Scene {
  private market!: Market;
  private bought: Record<string, Bought[]> = {};
  private list!: Phaser.GameObjects.Container;
  private hits: Hit[] = [];
  private scroll = 0;
  private drag: { y0: number; s0: number; moved: boolean } | null = null;
  private headName!: Phaser.GameObjects.Text;
  private headMoney!: Phaser.GameObjects.Text;
  private loanBtn!: Phaser.GameObjects.Text;
  private openBtn!: Phaser.GameObjects.Text;
  private modal = false;

  constructor() {
    super('Market');
  }

  private get st(): GameState {
    return session.s;
  }

  create() {
    setupCamera(this);
    this.bought = {};
    this.scroll = 0;
    this.hits = [];
    this.modal = false;
    this.market = createMarket(this.st, mulberry32(this.st.day * 7919));

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x140d1c).setOrigin(0);
    const bar = this.add.graphics();
    bar.fillStyle(0x2a1d36, 1);
    bar.fillRect(0, 0, GAME_W, 76);
    bar.fillStyle(0x1c1426, 1);
    bar.fillRect(0, 566, GAME_W, GAME_H - 566);
    this.add.text(GAME_W / 2, 8, 'ตลาดเช้า', { fontFamily: FONT, fontSize: '13px', color: '#9a8aa8' }).setOrigin(0.5, 0);
    this.headName = this.add
      .text(12, 26, '', { fontFamily: FONT, fontSize: '19px', color: '#ffd9a0' })
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.rename());
    this.headMoney = this.add.text(GAME_W - 12, 28, '', { fontFamily: FONT, fontSize: '20px', color: '#ffe27a' }).setOrigin(1, 0);
    this.add.text(12, 54, '', { fontFamily: FONT, fontSize: '13px', color: COLORS.text }).setName('sub');

    this.list = this.add.container(0, 0);
    const mask = this.make.graphics({ x: 0, y: 0 }, false);
    mask.fillRect(0, LIST_Y, GAME_W, LIST_H);
    this.list.setMask(mask.createGeometryMask());

    makeBtn(this, GAME_W / 2, 590, '', '#5a3a6a', () => this.refill(), 15, { x: 10, y: 7 }).setName('refill');
    this.loanBtn = makeBtn(this, GAME_W / 2, 630, 'แม่ให้ยืม 200 ฿', '#2f6a4a', () => this.loan(), 15, { x: 10, y: 6 });
    this.openBtn = makeBtn(this, GAME_W / 2, 686, 'เปิดร้าน ▶', '#c0302a', () => this.openShop(), 28, { x: 40, y: 12 });

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
    toastAt(this, GAME_W / 2, 540, n > 0 ? `ซื้อแล้ว ${n} แพ็ค` : 'ไม่มีอะไรให้เติม');
    this.renderAll();
  }

  private loan() {
    const next = takeLoan(this.st);
    if (!next) return;
    void session.commit(next);
    toastAt(this, GAME_W / 2, 540, 'แม่ให้ยืมแล้ว 200 ฿');
    this.renderAll();
  }

  private openShop() {
    if (this.totalStock() <= 0) {
      toastAt(this, GAME_W / 2, 540, 'ยังไม่มีของ ซื้อก่อนนะ');
      return;
    }
    this.scene.start('Shift');
  }

  // ---- render ----
  private renderAll() {
    const s = this.st;
    this.headName.setText(s.shopName);
    this.headName.setFontSize(19);
    for (let fs = 19; this.headName.width > 200 && fs > 11; fs--) this.headName.setFontSize(fs);
    this.headMoney.setText(baht(s.money));
    (this.children.getByName('sub') as Phaser.GameObjects.Text).setText(`วันที่ ${s.day}  ·  เลเวล ${s.level}  ·  ⭐ ${s.rating.toFixed(1)}`);
    const refill = this.children.getByName('refill') as Phaser.GameObjects.Text;
    const plan = suggestRefill(s, this.market, session.soldYesterday);
    const n = Object.values(plan).reduce((a, b) => a + b, 0);
    refill.setText(`ซื้อเหมือนเมื่อวาน ×1.2${n > 0 ? `  (${n} แพ็ค)` : ''}`).setAlpha(n > 0 ? 1 : 0.5);
    this.loanBtn.setVisible(takeLoan(s) !== null);
    this.openBtn.setAlpha(this.totalStock() > 0 ? 1 : 0.55);
    this.renderList();
  }

  private renderList() {
    this.list.removeAll(true);
    this.hits = [];
    const s = this.st;
    const offers = this.market.offers;
    offers.forEach((o, i) => {
      const def = ITEM_BY_ID[o.itemId];
      if (!def) return;
      const y = LIST_Y + 4 + i * ROW_H;
      const g = this.add.graphics();
      g.fillStyle(0x2f2240, 1);
      g.fillRoundedRect(ROW_X, y, ROW_W, ROW_H - 4, 8);
      g.lineStyle(o.deal ? 2 : 1, o.deal === 'cheap' ? 0x5ac86a : o.deal === 'dear' ? 0xe05040 : 0x4a3a5a, 1);
      g.strokeRoundedRect(ROW_X, y, ROW_W, ROW_H - 4, 8);
      const ic = this.add.graphics({ x: ROW_X + 26, y: y + 30 }).setScale(1.05);
      drawIcon(ic, def);
      const T = (x: number, yy: number, str: string, size: number, color: string) =>
        this.add.text(x, yy, str, { fontFamily: FONT, fontSize: `${size}px`, color });
      const stock = s.stock[o.itemId] ?? 0;
      const cnt = s.bought?.[o.itemId] ?? 0;
      const packCost = o.unitCost * this.market.packSize;
      const objs: Phaser.GameObjects.GameObject[] = [
        g, ic,
        T(ROW_X + 52, y + 5, def.th, 16, '#f6d8a0'),
        T(ROW_X + 52, y + 27, `${o.unitCost}฿/ไม้`, 13, '#ffe27a'),
        T(ROW_X + 52, y + 43, `มี ${stock} ไม้`, 12, stock > 0 ? '#8fd8a0' : '#7a6a88'),
      ];
      if (o.deal) {
        const b = this.add.text(ROW_X + 130, y + 28, o.deal === 'cheap' ? 'ถูกวันนี้ 🔥' : 'แพงวันนี้', {
          fontFamily: FONT, fontSize: '11px', color: '#fff', backgroundColor: o.deal === 'cheap' ? '#2f8a4a' : '#a03028', padding: { x: 4, y: 1 },
        });
        objs.push(b);
      }
      // stepper: [-] n/max [+]
      const cx = ROW_X + ROW_W - 62;
      const stepBtn = (bx: number, label: string, on: boolean, fn: () => void) => {
        const r = this.add.graphics();
        r.fillStyle(on ? 0x6a4a7a : 0x2a2034, 1);
        r.fillRoundedRect(bx - 16, y + 8, 32, 30, 8);
        objs.push(r, T(bx, y + 22, label, 20, on ? '#fff' : '#5a4a68').setOrigin(0.5));
        if (on) this.hits.push({ x: bx - 20, y: y + 4, w: 40, h: 38, fn });
      };
      stepBtn(cx - 38, '−', (this.bought[o.itemId]?.length ?? 0) > 0, () => {
        this.unbuy(o.itemId);
        this.renderAll();
      });
      stepBtn(cx + 38, '+', true, () => {
        if (!this.buy(o.itemId)) {
          const why = this.st.money < packCost ? 'เงินไม่พอ' : (this.st.bought?.[o.itemId] ?? 0) >= this.maxPacks() ? 'ซื้อได้วันละ 3 แพ็คต่อชนิด' : 'ที่เก็บของเต็ม';
          toastAt(this, GAME_W / 2, 540, why);
        }
        this.renderAll();
      });
      objs.push(T(cx, y + 22, `${cnt}`, 18, '#fff').setOrigin(0.5));
      objs.push(T(cx, y + 45, `แพ็ค ${this.market.packSize} · ${baht(packCost)}${cnt >= this.maxPacks() ? ' เต็ม' : ''}`, 10, '#b8a8c8').setOrigin(0.5, 0.5));
      this.list.add(objs);
    });
    this.applyScroll();
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
