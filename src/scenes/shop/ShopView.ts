// Side-on 2.5D shop on the top of the shift screen: street, passers-by, queue, counter, tables.
// Renders the Shift model (src/core/shift.ts); never changes it. Spec: docs/GDD.md §6.1.
import Phaser from 'phaser';
import { MAX_QUEUE, MAX_TICKETS } from '../../core/shift';
import type { Customer, Shift, ShiftEvent } from '../../core/shift';
import type { ArchetypeId } from '../../data/balance';
import { FONT, mix } from '../grill/draw';
import { ARCHS, FEET_Y, TEX_H, makePeopleTextures, personKey } from './people';
import type { Pose } from './people';

/** Height of the shop strip in the 360×740 layout (y = 0..SHOP_H). */
export const SHOP_H = 250;

export interface ShopViewOptions {
  /** Number of seats (tables × chairs) to draw; 2 in Sprint 2. */
  seats: number;
}

// ---- layout (local coords, strip is 360×250; feet baseline of each spot) ----
export const TICKET_SPOTS = [
  { x: 322, y: 200 },
  { x: 288, y: 200 },
  { x: 254, y: 200 },
];
export const QUEUE_SPOTS = Array.from({ length: MAX_QUEUE }, (_, i) => ({ x: 220 - 28 * i, y: 218 }));
const TABLES = [
  { x: 30, y: 174 },
  { x: 92, y: 174 },
  { x: 30, y: 200 },
  { x: 92, y: 200 },
];
export function seatSpot(i: number): { x: number; y: number; tx: number; ty: number; side: number } {
  const t = TABLES[(i >> 1) % TABLES.length];
  const side = i & 1;
  return { x: t.x + (side ? 17 : -17), y: t.y, tx: t.x, ty: t.y, side };
}
const STREET_Y = 238;
const ORIGIN_Y = FEET_Y / TEX_H;

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
}

interface Passer {
  img: Phaser.GameObjects.Image;
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

  constructor(
    readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    readonly w: number,
    readonly h: number,
    readonly opts: ShopViewOptions,
  ) {
    makePeopleTextures(scene);
    this.buildBackdrop();
    this.buildFurniture();
    this.buildAmbientStatic();
  }

  // ---------------------------------------------------------------- helpers
  private own<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.owned.push(o);
    return o;
  }

  private addG(depth: number, blend?: Phaser.BlendModes): Phaser.GameObjects.Graphics {
    const g = this.own(this.scene.add.graphics({ x: this.x, y: this.y }).setDepth(depth));
    if (blend !== undefined) g.setBlendMode(blend);
    return g;
  }

  private glow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, col: number, a: number) {
    for (let i = r; i > 6; i -= 8) {
      g.fillStyle(col, a);
      g.fillCircle(cx, cy, i);
    }
  }

  // ---------------------------------------------------------------- static art
  private buildBackdrop() {
    const g = this.addG(-50);
    const { w } = this;
    // sky
    for (let i = 0; i < 16; i++) {
      g.fillStyle(mix(0x120a1e, 0x5a3068, i / 15), 1);
      g.fillRect(0, i * 10, w, 10);
    }
    g.fillStyle(0xfff0c8, 0.9);
    g.fillCircle(46, 34, 12);
    g.fillStyle(0x2a1840, 0.4);
    g.fillCircle(42, 31, 10);
    // skyline (left)
    g.fillStyle(0x1c1426, 1);
    for (let xx = 0, i = 0; xx < 160; xx += 34, i++) g.fillRect(xx, 62 + ((i * 37) % 36), 31, 120);
    g.fillStyle(0xf6c870, 0.75);
    for (let i = 0; i < 9; i++) g.fillRect(6 + ((i * 41) % 140), 80 + ((i * 29) % 60), 3, 4);
    // wall behind eating area
    g.fillStyle(0x2a1e30, 1);
    g.fillRect(0, 124, 156, 56);
    g.fillStyle(0x3a2a40, 1);
    g.fillRect(0, 124, 156, 3);
    // tarp over eating area
    for (let i = 0; i < 6; i++) {
      g.fillStyle(i % 2 ? 0xe8e0d0 : 0x3a7a9a, 1);
      g.fillRect(i * 26, 104, 26, 14);
      g.fillTriangle(i * 26, 118, i * 26 + 26, 118, i * 26 + 13, 128);
    }
    // shop building
    g.fillStyle(0x2a1a22, 1);
    g.fillRect(156, 44, w - 156, 140);
    // warm interior
    g.fillStyle(0x6a3a22, 1);
    g.fillRect(166, 102, w - 166, 56);
    g.fillStyle(0xa8642e, 0.7);
    g.fillRect(166, 128, w - 166, 30);
    // shelves + hanging skewers silhouette
    g.fillStyle(0x3a2018, 1);
    g.fillRect(172, 116, 70, 3);
    g.fillRect(172, 134, 70, 3);
    for (let i = 0; i < 8; i++) {
      g.fillStyle(i % 2 ? 0xd9a040 : 0xe8d0a0, 1);
      g.fillRect(176 + i * 8, 108 + (i % 3), 3, 7);
      g.fillRect(176 + i * 8, 124, 5, 10);
    }
    g.fillStyle(0x201410, 1);
    g.fillRect(300, 110, 44, 36); // pot
    g.fillStyle(0xe8d0a0, 0.5);
    g.fillEllipse(322, 110, 42, 6);
    // awning stripes
    for (let i = 0; i < 7; i++) {
      g.fillStyle(i % 2 ? 0xf2e6d0 : 0xc0302a, 1);
      g.fillRect(156 + i * 30, 80, 30, 18);
      g.fillCircle(156 + i * 30 + 15, 98, 15 * 0.0 + 1);
      g.fillTriangle(156 + i * 30, 98, 156 + i * 30 + 30, 98, 156 + i * 30 + 15, 108);
    }
    g.fillStyle(0x7a1c18, 1);
    g.fillRect(156, 77, w - 156, 4);
    // sign board
    g.fillStyle(0x1a0e14, 1);
    g.fillRoundedRect(186, 48, 150, 26, 6);
    g.lineStyle(2, 0xff7a4a, 1);
    g.strokeRoundedRect(186, 48, 150, 26, 6);
    // ground: footpath, curb, street
    g.fillStyle(0x2c2236, 1);
    g.fillRect(0, 180, w, 52);
    g.fillStyle(0x362a42, 1);
    for (let xx = 0; xx < w; xx += 40) g.fillRect(xx, 182, 38, 22);
    for (let xx = 20; xx < w; xx += 40) g.fillRect(xx, 206, 38, 24);
    g.fillStyle(0x4a3e52, 1);
    g.fillRect(0, 230, w, 5);
    g.fillStyle(0x181220, 1);
    g.fillRect(0, 235, w, this.h - 235);
    g.fillStyle(0x3a3046, 1);
    for (let xx = 8; xx < w; xx += 48) g.fillRect(xx, 246, 20, 2);
    // counter
    g.fillStyle(0x5a3a28, 1);
    g.fillRect(196, 156, w - 196, 28);
    g.fillStyle(0x8a5a38, 1);
    g.fillRect(190, 150, w - 190, 8);
    g.fillStyle(0xb88458, 0.6);
    g.fillRect(190, 150, w - 190, 2);
    g.fillStyle(0x3a2418, 1);
    for (let xx = 206; xx < w; xx += 22) g.fillRect(xx, 160, 2, 24);
    // lamp post + glass
    g.fillStyle(0x2a2030, 1);
    g.fillRect(126, 70, 3, 110);
    g.fillRect(118, 68, 14, 3);
    // spot markers on the floor
    g.lineStyle(1, 0xf6c870, 0.18);
    for (const s of TICKET_SPOTS) g.strokeEllipse(s.x, s.y, 26, 8);

    // sign text
    const sign = this.own(
      this.scene.add
        .text(this.x + 261, this.y + 61, 'หม่าล่าริมทาง', { fontFamily: FONT, fontSize: '15px', color: '#ffd9a0', stroke: '#ff5a2a', strokeThickness: 1 })
        .setOrigin(0.5)
        .setDepth(-49),
    );
    this.scene.tweens.add({ targets: sign, alpha: 0.82, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // light
    const l = this.addG(-48, Phaser.BlendModes.ADD);
    this.glow(l, 128, 66, 70, 0xf6a04a, 0.045);
    this.glow(l, 261, 61, 80, 0xff6a3a, 0.035);
    this.glow(l, 262, 130, 90, 0xffa050, 0.04);
    l.fillStyle(0xffe0a0, 0.9);
    l.fillCircle(128, 66, 4);
    l.fillStyle(0xffa050, 0.05);
    l.fillEllipse(262, 205, 220, 40);
    l.fillEllipse(70, 190, 130, 30);

    // string lights
    const sl = this.addG(-47);
    sl.lineStyle(1, 0x120a1e, 1);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 12; i++) {
      const px = (i / 12) * w;
      pts.push({ x: px, y: 22 + 10 * Math.sin((i / 12) * Math.PI * 3) + 6 });
    }
    for (let i = 0; i < pts.length - 1; i++) sl.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    const cols = [0xff6a6a, 0xffd23a, 0x6ad0ff, 0xa0ff8a];
    pts.forEach((p, i) => {
      const c = this.own(this.scene.add.circle(this.x + p.x, this.y + p.y + 2, 2.4, cols[i % 4], 1).setDepth(-46));
      this.scene.tweens.add({ targets: c, alpha: 0.35, duration: 700 + (i % 4) * 300, yoyo: true, repeat: -1, delay: i * 90 });
    });
  }

  private buildFurniture() {
    const n = Math.max(0, Math.min(8, this.opts.seats));
    const tablesNeeded = Math.ceil(n / 2);
    for (let t = 0; t < tablesNeeded; t++) {
      const tb = TABLES[t];
      this.own(this.scene.add.image(this.x + tb.x, this.y + tb.y + 3, 'shop_table').setOrigin(0.5, 1).setDepth(tb.y + 3));
    }
    for (let i = 0; i < n; i++) {
      const s = seatSpot(i);
      this.own(this.scene.add.image(this.x + s.x, this.y + s.y + 1, 'shop_stool').setOrigin(0.5, 1).setDepth(s.y - 0.5));
    }
  }

  private cat?: Phaser.GameObjects.Image;
  private buildAmbientStatic() {
    this.cat = this.own(this.scene.add.image(this.x + 152, this.y + 194, 'shop_cat').setOrigin(0.5, 1).setDepth(194));
    const z = this.own(
      this.scene.add.text(this.x + 160, this.y + 172, 'z', { fontFamily: FONT, fontSize: '9px', color: '#d8cce8' }).setDepth(260),
    );
    this.scene.tweens.add({ targets: z, y: z.y - 8, alpha: { from: 1, to: 0 }, duration: 1800, repeat: -1 });
    this.scene.tweens.add({ targets: this.cat, scaleY: 1.06, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

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
        const sp = TICKET_SPOTS[Math.min(c.ticketSlot ?? 0, MAX_TICKETS - 1)];
        return { ...sp, speed: 100 };
      }
      case 'toSeat':
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
    const img = this.scene.add.image(0, 0, personKey(c.archetype, 'stand')).setOrigin(0.5, ORIGIN_Y);
    const bar = this.scene.add.graphics();
    const bubble = this.scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '10px', color: '#2a1a14', backgroundColor: '#fff3d6', padding: { x: 3, y: 1 } })
      .setOrigin(0.5, 1);
    const s: Spr = {
      id: c.id, arch: c.archetype, img, bar, bubble, bill: null, x: 0, y: 0, phase: c.phase, barKey: -1, bubbleStr: '#',
      shake: 0, happyT: 0, angryT: 0, phaseSeen: c.phase, moving: false, faceLeft: false, bobT: Math.random() * 6, fade: 0,
      lastSeat: c.seat, billX: 0, billY: 0, stomp: null,
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
    this.updateAmbient(dt);
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
    const seated = c.phase === 'eating' || c.phase === 'bill' || (c.phase === 'toSeat' && !s.moving);
    if (seated && !s.moving) {
      const sp = seatSpot(c.seat ?? s.lastSeat ?? 0);
      s.faceLeft = sp.side === 1;
    } else if (!s.moving && (c.phase === 'ordered' || c.phase === 'queue')) s.faceLeft = false;
    s.bobT += dt;
    s.happyT = Math.max(0, s.happyT - dt);
    s.angryT = Math.max(0, s.angryT - dt);
    s.shake = Math.max(0, s.shake - dt);

    // pose
    let pose: Pose = 'stand';
    if (seated && !s.moving) pose = c.phase === 'eating' ? (Math.floor(this.time / 0.38 + s.id) % 2 ? 'sit1' : 'sit0') : 'sit0';
    if (!seated || s.moving) {
      if (s.happyT > 0) pose = 'happy';
      if (s.angryT > 0 || (c.phase === 'leaving' && c.mood === 'angry')) pose = 'angry';
    } else if (c.phase === 'bill' && s.happyT > 0) pose = 'sit0';
    s.img.setTexture(personKey(s.arch, pose));
    s.img.setFlipX(s.faceLeft);

    // bob / shake
    let oy = 0;
    let ox = 0;
    if (s.moving) {
      const angry = pose === 'angry';
      oy = -Math.abs(Math.sin(s.bobT * (angry ? 14 : 11))) * (angry ? 3.5 : 2);
    } else if (!seated) oy = Math.sin(s.bobT * 2.5) * 0.5;
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
      if (!s.bill) s.bill = this.scene.add.image(0, 0, 'shop_bill').setOrigin(0.5, 1).setDepth(290);
      s.billX = sp.tx + (sp.side ? 7 : -7);
      s.billY = sp.ty - 14 + Math.sin(this.time * 5 + s.id) * 2.5;
      s.bill.setVisible(true).setPosition(this.x + s.billX, this.y + s.billY).setDepth(sp.ty + 20);
      s.bill.setScale(1 + Math.sin(this.time * 5 + s.id) * 0.06);
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
        const img = this.scene.add.image(0, 0, personKey(arch, 'stand')).setOrigin(0.5, ORIGIN_Y).setFlipX(dir < 0).setTint(0xa898b8).setAlpha(0.9);
        this.passers.push({ img, vx: dir * (28 + Math.random() * 22), x: dir > 0 ? -24 : this.w + 24, y, t: Math.random() * 6, moto: false });
      }
    }
    this.motoTimer -= dt;
    if (this.motoTimer <= 0) {
      this.motoTimer = 12 + Math.random() * 14;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const img = this.scene.add.image(0, 0, 'shop_moto').setOrigin(0.5, 0.95).setFlipX(dir < 0);
      this.passers.push({ img, vx: dir * 170, x: dir > 0 ? -30 : this.w + 30, y: 240, t: 0, moto: true });
    }
    for (let i = this.passers.length - 1; i >= 0; i--) {
      const p = this.passers[i];
      p.x += p.vx * dt;
      p.t += dt;
      const bob = p.moto ? Math.sin(p.t * 40) * 0.6 : -Math.abs(Math.sin(p.t * 9)) * 2;
      p.img.setPosition(this.x + p.x, this.y + p.y + bob).setDepth(p.y);
      if (p.x < -40 || p.x > this.w + 40) {
        p.img.destroy();
        this.passers.splice(i, 1);
      }
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
            const coin = this.scene.add.image(this.x + bx, this.y + by + 10, 'shop_bill').setDepth(320);
            this.fx.add(coin);
            this.scene.tweens.add({
              targets: coin, y: coin.y - 36, alpha: 0, scale: 1.3, duration: 700, ease: 'Cubic.out',
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
    for (const p of this.passers) p.img.destroy();
    this.owned = [];
    this.fx.clear();
    this.sprs.clear();
    this.passers = [];
  }
}
