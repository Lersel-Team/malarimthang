// Dev harness: ShopView alone, driven by a real Shift and a fake bot. Open /shop-demo.html (?speed=4 for fast-forward).
import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W } from '../../config';
import { Shift } from '../../core/shift';
import type { Customer, ShiftEvent } from '../../core/shift';
import { ITEMS, LOCATIONS } from '../../data/balance';
import { RES, pt, setupCamera } from '../../engine/hidpi';
import { FONT } from '../grill/draw';
import { bootTimings, preloadShop } from '../../art/shop';
import { SHOP_H, ShopView } from './ShopView';

const speed = Number(new URLSearchParams(location.search).get('speed')) || 1;

class DemoScene extends Phaser.Scene {
  private shift!: Shift;
  private view!: ShopView;
  private hud!: Phaser.GameObjects.Text;
  private ready = new Map<number, { at: number; order: Customer['order'] }>();
  private billSeen = new Map<number, number>();

  constructor() {
    super('demo');
  }

  private ready_ = false;

  create() {
    setupCamera(this);
    this.cameras.main.setBackgroundColor(COLORS.night);
    void preloadShop(this).then(() => {
      (window as unknown as { __bootMs: typeof bootTimings }).__bootMs = { ...bootTimings };
      this.newShift();
      this.ready_ = true;
    });
    this.hud = this.add.text(8, SHOP_H + 8, '', { fontFamily: FONT, fontSize: '14px', color: COLORS.text }).setDepth(500);
    this.add.text(8, SHOP_H + 60, 'tap bills on tables to collect\nbot serves tickets after 3-10 s', { fontFamily: FONT, fontSize: '11px', color: '#8a7a90' });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.ready_) return;
      const q = pt(p);
      const id = this.view.billAt(q.x, q.y);
      if (id !== null) this.feed(this.shift.collect(id));
    });
  }

  private newShift() {
    this.view?.destroy();
    this.ready.clear();
    this.billSeen.clear();
    const menu = ITEMS.filter((i) => i.unlockLevel <= 1).map((i) => i.id);
    this.shift = new Shift({ location: LOCATIONS[0], menu, seats: 2, rating: 3, rng: Math.random });
    this.view = new ShopView(this, 0, 0, GAME_W, SHOP_H, { seats: 2 });
  }

  private feed(ev: ShiftEvent[]) {
    this.view.onEvents(ev, this.shift);
  }

  update(_t: number, ms: number) {
    if (!this.ready_) return;
    const dt = (ms / 1000) * speed;
    const sh = this.shift;
    this.feed(sh.tick(dt));
    for (const c of sh.customers) {
      if (c.phase === 'ordered' && c.ticketSlot !== null) {
        let r = this.ready.get(c.id);
        if (!r || r.order !== c.order) {
          r = { at: sh.time + 3 + Math.random() * 7, order: c.order };
          this.ready.set(c.id, r);
        }
        if (sh.time >= r.at) this.cook(c);
      } else if (c.phase === 'bill') {
        const t0 = this.billSeen.get(c.id) ?? sh.time;
        this.billSeen.set(c.id, t0);
        if (c.id % 2 === 0 && sh.time - t0 > 1.5) this.feed(sh.collect(c.id)); // bot taps half of them
      }
    }
    this.view.update(dt, sh);
    this.hud.setText(`${sh.clock()}   ฿${Math.round(sh.money)}   x${speed}`);
    if (sh.ended) this.newShift();
  }

  private cook(c: Customer) {
    const slot = c.ticketSlot as number;
    for (const l of c.order.lines)
      for (let i = 0; i < l.qty; i++) this.shift.addSkewer(slot, { itemId: l.itemId, quality: 0.6 + Math.random() * 0.4 });
    for (let i = 0; i < c.order.spice; i++) this.shift.shake(slot);
    if (this.shift.isComplete(slot)) this.feed(this.shift.serve(slot));
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W * RES,
  height: GAME_H * RES,
  backgroundColor: COLORS.night,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [DemoScene],
});

(window as unknown as { __game: Phaser.Game }).__game = game;
