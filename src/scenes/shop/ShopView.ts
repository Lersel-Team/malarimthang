// Side-on 2.5D shop on the top of the shift screen: street, passers-by, queue, counter, tables.
// Renders the Shift model (src/core/shift.ts); never changes it. Spec: docs/GDD.md §6.1.
import Phaser from 'phaser';
import { MAX_QUEUE, MAX_TICKETS } from '../../core/shift';
import type { Customer, Shift, ShiftEvent } from '../../core/shift';
import type { ArchetypeId } from '../../data/balance';
import { FONT } from '../grill/draw';
import { RES } from '../../engine/hidpi';
import { BULBS, LAMP, LANTERNS, sceneryLayers } from '../../art/shop';
import { ARCHS, ORIGIN_Y, frameRef, variantOf, walkFrame } from './people';
import type { FrameName } from './people';

/** Height of the shop strip in the 360×740 layout (y = 0..SHOP_H). */
export const SHOP_H = 250;

export interface ShopViewOptions {
  /** Number of seats (tables × 4 chairs) to draw. */
  seats: number;
  /** Text on the neon sign (default 'หม่าล่าริมทาง'). */
  shopName?: string;
}

/** Sign board rectangle in shop-strip coords (tap target for renaming). */
export const SIGN_RECT = { x: 186, y: 48, w: 150, h: 26 };

// ---- layout (local coords, strip is 360×250; feet baseline of each spot) ----
export const TICKET_SPOTS = [
  { x: 322, y: 200 },
  { x: 288, y: 200 },
  { x: 254, y: 200 },
];
export const QUEUE_SPOTS = Array.from({ length: MAX_QUEUE }, (_, i) => ({ x: 220 - 28 * i, y: 218 }));
/** Up to 6 tables, 4 chairs each. */
const TABLES = [
  { x: 28, y: 202 },
  { x: 84, y: 202 },
  { x: 28, y: 172 },
  { x: 84, y: 172 },
  { x: 140, y: 202 },
  { x: 140, y: 172 },
];
export const CHAIRS_PER_TABLE = 4;
/** Chairs: left, right, then two behind the table. `side` 1 = faces left. */
export function seatSpot(i: number): { x: number; y: number; tx: number; ty: number; side: number } {
  const t = TABLES[Math.floor(i / CHAIRS_PER_TABLE) % TABLES.length];
  const k = i % CHAIRS_PER_TABLE;
  const dx = [-17, 17, -6, 6][k], dy = [0, 0, -9, -9][k];
  return { x: t.x + dx, y: t.y + dy, tx: t.x, ty: t.y, side: k === 0 || k === 2 ? 0 : 1 };
}
/** Where waiters stand while idle (behind the queue, beside the counter). */
export const WAITER_HOME = (i: number) => ({ x: 236 - 20 * i, y: 194 });
const STREET_Y = 238;
/** Waiting bench (Sprint 5 waiting area) and the shop cat, strip coords (feet baseline). */
export const BENCH = { x: 174, y: 192 };
const CAT = { x: 164, y: 214 };

interface Spr {
  id: number;
  arch: ArchetypeId;
  img: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  bubble: Phaser.GameObjects.Text;
  bill: Phaser.GameObjects.Image | null;
  x: number;
  y: number;
  phase: string;
  barKey: number;
  bubbleStr: string;
  shake: number;
  happyT: number;
  angryT: number;
  phaseSeen: string;
  moving: boolean;
  faceLeft: boolean;
  bobT: number;
  fade: number;
  lastSeat: number | null;
  billX: number;
  billY: number;
  stomp: Phaser.GameObjects.Text | null;
  variant: number;
  walkPhase: number;
  frame: string;
  lastX: number;
  lastY: number;
}

interface Passer {
  img: Phaser.GameObjects.Image;
  beam?: Phaser.GameObjects.Image;
  phase: number;
  vx: number;
  x: number;
  y: number;
  t: number;
  moto: boolean;
}

export class ShopView {
  private sprs = new Map<number, Spr>();
  private passers: Passer[] = [];
  private fx = new Set<Phaser.GameObjects.GameObject>();
  private owned: Phaser.GameObjects.GameObject[] = [];
  private time = 0;
  private passTimer = 1;
  private motoTimer = 8 + Math.random() * 8;
  private destroyed = false;
  private signText!: Phaser.GameObjects.Text;

  /** Redraws the sign text, shrinking the font so it fits the board. */
  setShopName(name: string) {
    const t = this.signText;
    if (!t) return;
    t.setText(name);
    let fs = 15;
    t.setFontSize(fs);
    while (t.width > SIGN_RECT.w - 14 && fs > 7) t.setFontSize(--fs);
  }

  /** True if (x, y) in scene coords hits the shop sign. */
  signAt(x: number, y: number): boolean {
    const r = SIGN_RECT;
    return x >= this.x + r.x && x <= this.x + r.x + r.w && y >= this.y + r.y && y <= this.y + r.y + r.h;
  }

  constructor(
    readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    readonly w: number,
    readonly h: number,
    readonly opts: ShopViewOptions,
  ) {
    this.buildBackdrop();
    this.buildFurniture();
    this.buildAmbientStatic();
  }

  // ---------------------------------------------------------------- helpers
  private own<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.owned.push(o);
    return o;
  }

  private img(key: string, x: number, y: number, depth: number, ox = 0, oy = 0): Phaser.GameObjects.Image {
    return this.own(this.scene.add.image(this.x + x, this.y + y, key).setOrigin(ox, oy).setScale(1 / RES).setDepth(depth));
  }

  /** Soft light blob (additive), `w`/`h` in logical px. */
  private light(x: number, y: number, w: number, h: number, tint: number, alpha: number, depth = -48): Phaser.GameObjects.Image {
    return this.own(
      this.scene.add.image(this.x + x, this.y + y, 'shop-glow').setDisplaySize(w, h).setTint(tint).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth),
    );
  }

  // ---------------------------------------------------------------- static art
  private layerImgs: { img: Phaser.GameObjects.Image; x: number; k: number }[] = [];

  /** Shifts the far scenery layers horizontally (parallax-ready: sky 0.1, far skyline 0.2, near skyline 0.35). px in logical px. */
  setParallax(px: number): void {
    for (const l of this.layerImgs) l.img.x = this.x + l.x + px * l.k;
  }

  private buildBackdrop() {
    const K: Record<string, number> = { 'shop-sky': 0.1, 'shop-skyline-far': 0.2, 'shop-skyline-near': 0.35 };
    for (const l of sceneryLayers()) {
      const img = this.img(l.key, l.x, l.y, l.depth);
      this.layerImgs.push({ img, x: l.x, k: K[l.key] ?? 0 });
    }

    // sign text, drawn live on the clean glowing board
    const sign = (this.signText = this.own(
      this.scene.add
        .text(this.x + SIGN_RECT.x + SIGN_RECT.w / 2, this.y + SIGN_RECT.y + SIGN_RECT.h / 2, this.opts.shopName ?? 'หม่าล่าริมทาง', { fontFamily: FONT, fontSize: '15px', color: '#ffd9a0', stroke: '#ff5a2a', strokeThickness: 1 })
        .setOrigin(0.5)
        .setDepth(-49),
    ));
    this.setShopName(this.opts.shopName ?? 'หม่าล่าริมทาง');
    this.scene.tweens.add({ targets: sign, alpha: 0.82, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // light: lamp halo, sign, interior, ground pools, lantern + bulb glows
    const lampHalo = this.light(LAMP.x, LAMP.y, 150, 150, 0xffa850, 0.55);
    this.scene.tweens.add({ targets: lampHalo, alpha: 0.46, duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.light(LAMP.x, LAMP.y, 16, 16, 0xfff0c0, 1);
    this.light(261, 61, 200, 70, 0xff6a3a, 0.22);
    this.light(300, 128, 150, 70, 0xffa050, 0.28);
    this.light(215, 156, 60, 70, 0x9ad8e8, 0.12);
    this.light(128, 198, 210, 54, 0xffa050, 0.34);
    this.light(298, 204, 230, 50, 0xff8a40, 0.3);
    this.light(60, 196, 150, 40, 0xffd890, 0.16);
    this.light(60, 120, 150, 40, 0xffd890, 0.16);
    this.light(180, 200, 70, 30, 0xffd890, 0.1);
    this.light(190, 226, 40, 10, 0xffb24a, 0.2);
    this.light(60, 130, 130, 50, 0xffe0a0, 0.1, 280);
    this.light(298, 200, 220, 46, 0xffa050, 0.07, 280);
    LANTERNS.forEach((l, i) => {
      const g = this.light(l.x, l.y, 46, 46, 0xff5a3a, 0.45);
      this.scene.tweens.add({ targets: g, alpha: 0.3, duration: 1100 + i * 270, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: i * 200 });
    });
    BULBS.forEach((b, i) => {
      const c = parseInt(b.c.slice(1), 16);
      const g = this.light(b.x, b.y, 26, 26, c, 0.55, -47);
      this.scene.tweens.add({ targets: g, alpha: 0.2, duration: 700 + (i % 4) * 300, yoyo: true, repeat: -1, delay: i * 90 });
    });
    this.light(184, 70, 40, 40, 0xff7a4a, 0.25);
  }

  private buildFurniture() {
    const n = Math.max(0, Math.min(TABLES.length * CHAIRS_PER_TABLE, this.opts.seats));
    const tablesNeeded = Math.ceil(n / CHAIRS_PER_TABLE);
    for (let t = 0; t < tablesNeeded; t++) {
      const tb = TABLES[t];
      this.img('shop-table', tb.x, tb.y + 3, tb.y + 3, 0.5, 1);
    }
    for (let i = 0; i < n; i++) {
      const s = seatSpot(i);
      this.img('shop-stool', s.x, s.y + 1, s.y - 0.5, 0.5, 1);
    }
    // waiting bench against the stall wall (Sprint 5 waiting area)
    this.img('shop-bench', BENCH.x, BENCH.y, BENCH.y, 0.5, 1);
  }

  private cat?: Phaser.GameObjects.Image;
  private catZ?: Phaser.GameObjects.Text;
  private catT = 12;
  private catAwake = false;
  private moths: { img: Phaser.GameObjects.Image; a: number; r: number; sp: number; ph: number }[] = [];
  private wisps: Phaser.GameObjects.Image[] = [];
  private rain: { img: Phaser.GameObjects.Image; vx: number; vy: number }[] = [];
  private raining = false;

  private buildAmbientStatic() {
    this.cat = this.img('shop-cat-sleep', CAT.x, CAT.y, CAT.y, 0.5, 1);
    this.catZ = this.own(this.scene.add.text(this.x + CAT.x + 8, this.y + CAT.y - 14, 'z', { fontFamily: FONT, fontSize: '9px', color: '#d8cce8' }).setDepth(260));
    this.scene.tweens.add({ targets: this.catZ, y: this.catZ.y - 8, alpha: { from: 1, to: 0 }, duration: 1800, repeat: -1 });
    this.scene.tweens.add({ targets: this.cat, scaleY: (1 / RES) * 1.05, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    for (let i = 0; i < 3; i++) {
      const img = this.own(this.scene.add.image(this.x + LAMP.x, this.y + LAMP.y, 'shop-moth').setScale(1 / RES).setDepth(-46));
      this.moths.push({ img, a: Math.random() * 6.28, r: 9 + Math.random() * 12, sp: 1.6 + Math.random() * 1.8, ph: Math.random() * 6 });
    }
    for (let i = 0; i < 5; i++) {
      const w = this.own(this.scene.add.image(0, 0, 'shop-wisp').setScale(0.5 / RES * 2).setAlpha(0).setDepth(-45));
      this.wisps.push(w);
      this.scene.tweens.add({
        targets: w, y: { from: this.y + 130, to: this.y + 96 }, x: { from: this.x + 338, to: this.x + 350 + (i % 2) * 6 },
        alpha: { from: 0.7, to: 0 }, scale: { from: 0.4, to: 1.0 }, duration: 3400, repeat: -1, delay: i * 680, ease: 'Sine.out',
      });
    }
    // rain streaks (off by default)
    for (let i = 0; i < 46; i++) {
      const img = this.own(this.scene.add.image(0, 0, 'shop-rain').setScale(1 / RES).setAlpha(0.45).setDepth(340).setVisible(false));
      img.setRotation(0.12);
      this.rain.push({ img, vx: -26, vy: 300 + Math.random() * 120 });
      img.setPosition(this.x + Math.random() * this.w, this.y + Math.random() * 240);
    }
  }

  /** Cheap rain overlay (46 streaks). Off by default. */
  setRain(on: boolean): void {
    this.raining = on;
    for (const r of this.rain) r.img.setVisible(on);
  }

  // ---------------------------------------------------------------- Sprint 5 hooks (no-ops for now)
  /**
   * Sprint 5: shows what is in the glass display box on the counter (DISPLAY_BOX in src/art/shop.ts, shop-strip
   * coords 246,116,98x32). `trays` = one entry per item type with its stock; the view will draw skewers on the shelves.
   */
  showDisplayBox(_trays: { itemId: string; count: number }[]): void {}

  /**
   * Sprint 5: customer `id` walks to the display box and reaches in to pick skewers (uses the `pick` frame of the
   * sheet: lean + arm toward the box) before they take their numbered glass to the waiting area.
   */
  customerPicks(_id: number): void {}

  /**
   * Sprint 5: lights the queue-number display (QDISPLAY in src/art/shop.ts, 200,108,32x17) with number `n`
   * and plays a short ding highlight. The frame is drawn empty (dim dashes) for now.
   */
  callNumber(_n: number): void {}

  // ---------------------------------------------------------------- customers
  private queueRank(shift: Shift): Map<number, number> {
    const m = new Map<number, number>();
    let r = 0;
    for (const c of shift.customers) {
      if (c.phase === 'walkIn' || c.phase === 'queue') m.set(c.id, r++);
    }
    return m;
  }

  private targetFor(c: Customer, rank: Map<number, number>, s: Spr): { x: number; y: number; speed: number } {
    switch (c.phase) {
      case 'walkIn':
      case 'queue': {
        const sp = QUEUE_SPOTS[Math.min(rank.get(c.id) ?? 0, MAX_QUEUE - 1)];
        const d = Math.hypot(sp.x - s.x, sp.y - s.y);
        return { ...sp, speed: c.phase === 'walkIn' ? Phaser.Math.Clamp(d / Math.max(c.phaseT, 0.25), 45, 260) : 90 };
      }
      case 'ordered': {
        if (c.seat !== null) {
          const st = seatSpot(c.seat);
          return { x: st.x, y: st.y, speed: 100 };
        }
        const sp = TICKET_SPOTS[Math.min(c.ticketSlot ?? 0, MAX_TICKETS - 1)];
        return { ...sp, speed: 100 };
      }
      case 'toSeat':
      case 'delivering':
      case 'eating':
      case 'bill': {
        const sp = seatSpot(c.seat ?? s.lastSeat ?? 0);
        const d = Math.hypot(sp.x - s.x, sp.y - s.y);
        return { x: sp.x, y: sp.y, speed: c.phase === 'toSeat' ? Phaser.Math.Clamp(d / Math.max(c.phaseT, 0.25), 45, 200) : 90 };
      }
      default: {
        const edge = s.x < this.w / 2 ? -26 : this.w + 26;
        return { x: edge, y: STREET_Y, speed: 110 };
      }
    }
  }

  private makeSpr(c: Customer, rank: Map<number, number>): Spr {
    const variant = variantOf(c);
    const fr = frameRef(this.scene, c.archetype, variant, 'idle');
    const img = this.scene.add.image(0, 0, fr.key, fr.frame).setOrigin(0.5, ORIGIN_Y).setScale(1 / RES);
    const bar = this.scene.add.graphics();
    const bubble = this.scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '10px', color: '#2a1a14', backgroundColor: '#fff3d6', padding: { x: 3, y: 1 } })
      .setOrigin(0.5, 1);
    const s: Spr = {
      id: c.id, arch: c.archetype, img, bar, bubble, bill: null, x: 0, y: 0, phase: c.phase, barKey: -1, bubbleStr: '#',
      shake: 0, happyT: 0, angryT: 0, phaseSeen: c.phase, moving: false, faceLeft: false, bobT: Math.random() * 6, fade: 0,
      lastSeat: c.seat, billX: 0, billY: 0, stomp: null, variant, walkPhase: Math.random() * 4, frame: 'idle', lastX: 0, lastY: 0,
    };
    if (c.phase === 'walkIn') {
      s.x = c.id % 2 ? this.w + 24 : -24;
      s.y = STREET_Y;
    } else {
      const t = this.targetFor(c, rank, s);
      s.x = t.x;
      s.y = t.y;
    }
    this.sprs.set(c.id, s);
    return s;
  }

  update(dt: number, shift: Shift): void {
    if (this.destroyed) return;
    if (dt > 5) dt /= 1000;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const rank = this.queueRank(shift);
    const seen = new Set<number>();
    for (const c of shift.customers) {
      if (c.phase === 'gone') continue;
      seen.add(c.id);
      const s = this.sprs.get(c.id) ?? this.makeSpr(c, rank);
      this.updateCustomer(s, c, rank, dt);
    }
    for (const [id, s] of this.sprs) {
      if (seen.has(id)) continue;
      s.fade += dt * 4;
      s.img.setAlpha(Math.max(0, 1 - s.fade));
      s.bar.clear();
      s.bubble.setVisible(false);
      s.bill?.setVisible(false);
      if (s.fade >= 1) this.killSpr(s), this.sprs.delete(id);
    }
    this.updateWaiters(shift, dt);
    this.updateAmbient(dt);
  }

  private waiterSprs: { img: Phaser.GameObjects.Image; plate: Phaser.GameObjects.Text; x: number; y: number; wp: number; frame: string }[] = [];

  /** Waiters carry the plate to the table, then walk back to their spot by the counter. */
  private updateWaiters(shift: Shift, dt: number) {
    while (this.waiterSprs.length < shift.waiters.length) {
      const i = this.waiterSprs.length;
      const fr = frameRef(this.scene, 'office', 2 + i, 'idle');
      const img = this.own(this.scene.add.image(0, 0, fr.key, fr.frame).setOrigin(0.5, ORIGIN_Y).setScale(1 / RES));
      const plate = this.own(this.scene.add.text(0, 0, '🍽', { fontSize: '12px' }).setOrigin(0.5, 1).setVisible(false));
      const h = WAITER_HOME(i);
      this.waiterSprs.push({ img, plate, x: h.x, y: h.y, wp: 0, frame: 'idle' });
    }
    shift.waiters.forEach((w, i) => {
      const sp = this.waiterSprs[i];
      const home = WAITER_HOME(i);
      const cust = w.id === null ? null : shift.customers.find((c) => c.id === w.id);
      let tx = home.x, ty = home.y, carry = false;
      if (cust && cust.seat !== null) {
        const seat = seatSpot(cust.seat);
        const p = 1 - w.t / w.total;
        carry = p < 0.5;
        tx = seat.tx + (seat.side ? 22 : -22);
        ty = seat.ty + 6;
        if (!carry) { tx = home.x; ty = home.y; }
      }
      const d = Math.hypot(tx - sp.x, ty - sp.y);
      const step = Math.min(d, 120 * dt);
      if (d > 0.01) { sp.x += ((tx - sp.x) / d) * step; sp.y += ((ty - sp.y) / d) * step; sp.wp += step / 7; }
      const moving = d - step > 0.6;
      let frame: FrameName = 'idle';
      if (moving) frame = walkFrame(sp.wp);
      if (frame !== sp.frame) {
        const fr = frameRef(this.scene, 'office', 2 + i, frame);
        sp.img.setTexture(fr.key, fr.frame);
        sp.frame = frame;
      }
      if (moving) sp.img.setFlipX(tx < sp.x);
      sp.img.setPosition(this.x + sp.x, this.y + sp.y).setDepth(sp.y + 1);
      sp.plate.setVisible(carry && cust !== null).setPosition(this.x + sp.x + (sp.img.flipX ? -8 : 8), this.y + sp.y - 20).setDepth(sp.y + 2);
    });
  }

  private killSpr(s: Spr) {
    s.img.destroy();
    s.bar.destroy();
    s.bubble.destroy();
    s.bill?.destroy();
    s.stomp?.destroy();
  }

  private updateCustomer(s: Spr, c: Customer, rank: Map<number, number>, dt: number) {
    if (c.seat !== null) s.lastSeat = c.seat;
    s.phase = c.phase;
    const t = this.targetFor(c, rank, s);
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, t.speed * dt);
    if (d > 0.01) {
      s.x += (dx / d) * step;
      s.y += (dy / d) * step;
    }
    s.moving = d - step > 0.6;
    if (s.moving && Math.abs(dx) > 1) s.faceLeft = dx < 0;
    const seated = c.phase === 'eating' || c.phase === 'bill' || c.phase === 'delivering' || ((c.phase === 'toSeat' || (c.phase === 'ordered' && c.seat !== null)) && !s.moving);
    if (seated && !s.moving) {
      const sp = seatSpot(c.seat ?? s.lastSeat ?? 0);
      s.faceLeft = sp.side === 1;
    } else if (!s.moving && (c.phase === 'ordered' || c.phase === 'queue')) s.faceLeft = false;
    if (c.phase === 'ordered' && c.seat !== null && !s.moving) s.faceLeft = seatSpot(c.seat).side === 1;
    s.bobT += dt;
    s.happyT = Math.max(0, s.happyT - dt);
    s.angryT = Math.max(0, s.angryT - dt);
    s.shake = Math.max(0, s.shake - dt);

    // frame: walk cycle paced by distance travelled, eat loop, happy / angry reactions
    const moved = Math.hypot(s.x - s.lastX, s.y - s.lastY);
    s.lastX = s.x;
    s.lastY = s.y;
    let frame: FrameName = 'idle';
    const angry = s.angryT > 0 || (c.phase === 'leaving' && c.mood === 'angry');
    if (s.moving) {
      s.walkPhase += Math.min(moved / 7, 12 * dt);
      frame = angry ? (Math.floor(this.time / 0.13 + s.id) & 1 ? 'angry1' : 'angry0') : s.happyT > 0 ? 'happy' : walkFrame(s.walkPhase);
    } else if (seated) {
      frame = c.phase === 'eating' ? (Math.floor(this.time / 0.45 + s.id) & 1 ? 'eat1' : 'eat0') : 'sit';
    } else if (angry) frame = Math.floor(this.time / 0.2 + s.id) & 1 ? 'angry1' : 'angry0';
    else if (s.happyT > 0) frame = 'happy';
    if (frame !== s.frame || s.img.frame.name !== frame) {
      const fr = frameRef(this.scene, s.arch, s.variant, frame);
      s.img.setTexture(fr.key, fr.frame);
      s.frame = frame;
    }
    s.img.setFlipX(s.faceLeft);

    // bob / shake
    let oy = 0;
    let ox = 0;
    if (s.moving) oy = frame.startsWith('walk') ? 0 : -Math.abs(Math.sin(s.bobT * 14)) * 2;
    else if (!seated) oy = frame === 'happy' ? -Math.abs(Math.sin(s.bobT * 9)) * 2.5 : Math.sin(s.bobT * 2.5) * 0.5;
    if (s.shake > 0) ox = Math.sin(s.shake * 70) * 2.5;
    s.img.setPosition(this.x + s.x + ox, this.y + s.y + oy);
    s.img.setDepth(s.y);

    // stomp mark for angry leaving
    const stomp = c.phase === 'leaving' && (c.mood === 'angry' || s.angryT > 0);
    if (stomp && !s.stomp) {
      s.stomp = this.scene.add.text(0, 0, '💢', { fontSize: '13px' }).setOrigin(0.5).setDepth(270);
    }
    if (s.stomp) s.stomp.setPosition(this.x + s.x + 9, this.y + s.y - 40 + Math.sin(this.time * 16) * 2).setVisible(stomp);

    // patience bar + order bubble
    const showBar = c.phase === 'queue' || c.phase === 'ordered';
    if (showBar) {
      const r = Phaser.Math.Clamp(c.patience / Math.max(c.patienceMax, 0.001), 0, 1);
      const key = Math.round(r * 24);
      if (key !== s.barKey) {
        s.barKey = key;
        const col = r > 0.6 ? 0x6ad06a : r > 0.3 ? 0xf2c230 : 0xe0483a;
        s.bar.clear();
        s.bar.fillStyle(0x000000, 0.6);
        s.bar.fillRoundedRect(-13, 0, 26, 5, 2);
        s.bar.fillStyle(col, 1);
        s.bar.fillRoundedRect(-12, 1, Math.max(1, 24 * r), 3, 1);
      }
      s.bar.setPosition(this.x + s.x, this.y + s.y - 46).setDepth(300).setVisible(true);
    } else {
      s.bar.setVisible(false);
      s.barKey = -1;
    }
    let str = '';
    if (c.phase === 'ordered') {
      const qty = c.order.lines.reduce((a, l) => a + l.qty, 0);
      str = `🍢${qty}` + (c.order.spice > 0 ? ` 🌶${c.order.spice}` : '');
    }
    if (str !== s.bubbleStr) {
      s.bubbleStr = str;
      s.bubble.setText(str);
    }
    s.bubble.setVisible(str !== '' && s.fade === 0).setPosition(this.x + s.x, this.y + s.y - 50).setDepth(301);

    // bill icon
    if (c.phase === 'bill') {
      const sp = seatSpot(c.seat ?? s.lastSeat ?? 0);
      if (!s.bill) s.bill = this.scene.add.image(0, 0, 'shop-bill').setOrigin(0.5, 1).setScale(1 / RES).setDepth(290);
      s.billX = sp.tx + (sp.side ? 7 : -7);
      s.billY = sp.ty - 14 + Math.sin(this.time * 5 + s.id) * 2.5;
      s.bill.setVisible(true).setPosition(this.x + s.billX, this.y + s.billY).setDepth(sp.ty + 20);
      s.bill.setScale((1 + Math.sin(this.time * 5 + s.id) * 0.06) / RES);
    } else if (s.bill) s.bill.setVisible(false);
  }

  // ---------------------------------------------------------------- ambient
  private updateAmbient(dt: number) {
    this.passTimer -= dt;
    const walkers = this.passers.filter((p) => !p.moto).length;
    if (this.passTimer <= 0) {
      this.passTimer = 2 + Math.random() * 4;
      if (walkers < 3) {
        const arch = ARCHS[Math.floor(Math.random() * ARCHS.length)];
        const dir = Math.random() < 0.5 ? 1 : -1;
        const y = 243 + Math.random() * 5;
        const fr = frameRef(this.scene, arch, Math.floor(Math.random() * 8), 'walk0');
        // dark street silhouettes: tinted down so they read as people walking past in the dark
        const img = this.scene.add.image(0, 0, fr.key, fr.frame).setOrigin(0.5, ORIGIN_Y).setScale(0.92 / RES).setFlipX(dir < 0).setTint(0x6a5a8a).setAlpha(0.85);
        this.passers.push({ img, phase: Math.random() * 4, vx: dir * (28 + Math.random() * 22), x: dir > 0 ? -24 : this.w + 24, y, t: Math.random() * 6, moto: false });
      }
    }
    this.motoTimer -= dt;
    if (this.motoTimer <= 0) {
      this.motoTimer = 12 + Math.random() * 14;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const img = this.scene.add.image(0, 0, 'shop-moto').setOrigin(0.5, 0.95).setScale(1 / RES).setFlipX(dir < 0);
      const beam = this.scene.add.image(0, 0, 'shop-moto-beam').setOrigin(dir > 0 ? 0 : 1, 0.5).setScale(1 / RES).setFlipX(dir < 0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
      this.passers.push({ img, beam, phase: 0, vx: dir * 170, x: dir > 0 ? -34 : this.w + 34, y: 241, t: 0, moto: true });
    }
    for (let i = this.passers.length - 1; i >= 0; i--) {
      const p = this.passers[i];
      p.x += p.vx * dt;
      p.t += dt;
      let bob: number;
      if (p.moto) {
        bob = Math.sin(p.t * 40) * 0.5;
        if (p.beam) p.beam.setPosition(this.x + p.x + Math.sign(p.vx) * 24, this.y + p.y + bob - 17).setDepth(p.y + 1);
      } else {
        p.phase += Math.min(Math.abs(p.vx) / 7, 12) * dt;
        const fr = walkFrame(p.phase);
        if (p.img.frame.name !== fr) p.img.setFrame(fr);
        bob = 0;
      }
      p.img.setPosition(this.x + p.x, this.y + p.y + bob).setDepth(p.y);
      if (p.x < -50 || p.x > this.w + 50) {
        p.img.destroy();
        p.beam?.destroy();
        this.passers.splice(i, 1);
      }
    }
    // moths flutter around the lamp
    for (const m of this.moths) {
      m.a += m.sp * dt;
      const r = m.r + Math.sin(this.time * 1.3 + m.ph) * 4;
      m.img.setPosition(this.x + LAMP.x + Math.cos(m.a) * r, this.y + LAMP.y + Math.sin(m.a * 1.3 + m.ph) * r * 0.55 + 2);
      m.img.setScale(1 / RES, (1 / RES) * (0.5 + 0.5 * Math.abs(Math.sin(this.time * 28 + m.ph))));
    }
    // cat sleeps, wakes up now and then
    this.catT -= dt;
    if (this.catT <= 0 && this.cat) {
      this.catAwake = !this.catAwake;
      this.catT = this.catAwake ? 5 + Math.random() * 4 : 14 + Math.random() * 12;
      this.cat.setTexture(this.catAwake ? 'shop-cat-awake' : 'shop-cat-sleep');
      this.catZ?.setVisible(!this.catAwake);
    }
    if (this.raining)
      for (const r of this.rain) {
        const im = r.img;
        im.x += r.vx * dt;
        im.y += r.vy * dt;
        if (im.y > this.y + 244) im.setPosition(this.x + Math.random() * (this.w + 30), this.y - 8);
      }
  }

  // ---------------------------------------------------------------- events
  private fxText(x: number, y: number, str: string, style: Phaser.Types.GameObjects.Text.TextStyle, rise = 22, dur = 1200) {
    const t = this.scene.add.text(this.x + x, this.y + y, str, { fontFamily: FONT, ...style }).setOrigin(0.5).setDepth(320);
    this.fx.add(t);
    this.scene.tweens.add({
      targets: t,
      y: t.y - rise,
      alpha: { from: 1, to: 0 },
      duration: dur,
      ease: 'Sine.out',
      onComplete: () => {
        this.fx.delete(t);
        t.destroy();
      },
    });
  }

  private speech(s: Spr, str: string) {
    const t = this.scene.add
      .text(this.x + s.x, this.y + s.y - 54, str, { fontFamily: FONT, fontSize: '11px', color: '#2a1a14', backgroundColor: '#ffffff', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 1)
      .setDepth(330);
    this.fx.add(t);
    this.scene.tweens.add({
      targets: t,
      y: t.y - 6,
      alpha: { from: 1, to: 0 },
      delay: 900,
      duration: 500,
      onComplete: () => {
        this.fx.delete(t);
        t.destroy();
      },
    });
  }

  onEvents(events: ShiftEvent[], _shift: Shift): void {
    if (this.destroyed) return;
    for (const e of events) {
      if (!('id' in e)) continue;
      const s = this.sprs.get(e.id);
      if (!s) continue;
      switch (e.type) {
        case 'served': {
          const emo = e.stars >= 5 ? '😋' : e.stars === 4 ? '🙂' : e.stars === 3 ? '😐' : '😠';
          this.fxText(s.x, s.y - 50, emo, { fontSize: '18px' }, 18, 1300);
          if (e.stars >= 4) s.happyT = 1.6;
          else if (e.stars <= 2) s.angryT = 1.6;
          if (!e.eatIn) this.fxText(s.x, s.y - 64, `+฿${e.pay + e.tip}`, { fontSize: '13px', color: '#ffe36a', stroke: '#3a2a00', strokeThickness: 3 }, 20, 1300);
          break;
        }
        case 'walkout':
          this.fxText(s.x, s.y - 50, '😡', { fontSize: '18px' }, 14, 1300);
          s.shake = 0.6;
          s.angryT = 2.5;
          break;
        case 'collected': {
          const small = e.auto;
          const bx = s.bill ? s.billX : s.x;
          const by = s.bill ? s.billY - 14 : s.y - 30;
          this.fxText(bx, by, `+฿${e.amount}`, small
            ? { fontSize: '10px', color: '#b8b0c0', stroke: '#1a1420', strokeThickness: 2 }
            : { fontSize: '15px', color: '#ffe36a', stroke: '#5a3a00', strokeThickness: 3 }, small ? 18 : 34, small ? 900 : 1100);
          if (!small) {
            const coin = this.scene.add.image(this.x + bx, this.y + by + 10, 'shop-bill').setScale(1 / RES).setDepth(320);
            this.fx.add(coin);
            this.scene.tweens.add({
              targets: coin, y: coin.y - 36, alpha: 0, scale: 1.3 / RES, duration: 700, ease: 'Cubic.out',
              onComplete: () => (this.fx.delete(coin), coin.destroy()),
            });
          }
          break;
        }
        case 'extraOrder':
          this.speech(s, 'สั่งเพิ่ม!');
          break;
        case 'noSeat':
          this.speech(s, 'ไม่มีที่นั่ง');
          break;
        default:
          break;
      }
    }
  }

  /** Customer id whose table money is under (x, y) in scene coords, or null. The scene then calls shift.collect(id). */
  billAt(px: number, py: number): number | null {
    let best: number | null = null;
    let bd = Infinity;
    for (const s of this.sprs.values()) {
      if (!s.bill || !s.bill.visible || s.phase !== 'bill') continue;
      const cx = this.x + s.billX;
      const cy = this.y + s.billY - 9;
      const dx = Math.abs(px - cx);
      const dy = Math.abs(py - cy);
      if (dx <= 20 && dy <= 24) {
        const d = dx * dx + dy * dy;
        if (d < bd) (bd = d), (best = s.id);
      }
    }
    return best;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const tw = this.scene.tweens;
    for (const o of this.owned) {
      tw.killTweensOf(o);
      o.destroy();
    }
    for (const o of this.fx) {
      tw.killTweensOf(o);
      o.destroy();
    }
    for (const s of this.sprs.values()) this.killSpr(s);
    for (const p of this.passers) (p.img.destroy(), p.beam?.destroy());
    this.owned = [];
    this.fx.clear();
    this.sprs.clear();
    this.passers = [];
  }
}
