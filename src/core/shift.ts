// One 3-minute shift: customer arrivals, queue, orders, serving, seats, money.
// Pure logic, no Phaser. The scene renders `customers` and reacts to the returned events.
// Spec: docs/GDD.md §6, §6.1, §13. Numbers: data/balance.json → archetypes, locations, service, eatIn, shift, spice.
import { ARCHETYPES, BALANCE, EAT_IN, ITEM_BY_ID, ITEMS, SERVICE, SHIFT, SPICE, type ArchetypeId, type LocationDef } from '../data/balance';
import type { Rng } from './cooking';
import { rollName, type NameOrigin } from './names';

const nameFields = (n: { name: string; origin: NameOrigin }) => ({ name: n.name, nameOrigin: n.origin });

/** Seconds a customer takes to walk from the street to the counter / to a seat / out. Views tween over these. */
export const WALK_IN_SEC = 2.5;
export const WALK_SEAT_SEC = 1.5;
export const WALK_OUT_SEC = 2.5;
/** Orders being taken at the counter at once (= ticket slots). Others wait in the queue behind. */
export const MAX_TICKETS = 3;
export const MAX_QUEUE = 4;

export type Phase =
  | 'walkIn' // walking from the street to the queue
  | 'queue' // standing in line, no ticket yet (patience runs)
  | 'ordered' // has a ticket at the counter (patience runs)
  | 'toSeat' // eat-in, walking to the seat
  | 'delivering' // seated, waiting for a waiter to bring the plate
  | 'eating' // seated, eating
  | 'bill' // eat-in finished, money waiting on the table
  | 'leaving' // walking out
  | 'gone';

export interface OrderLine {
  itemId: string;
  qty: number;
}

export interface Order {
  lines: OrderLine[];
  /** 0..4 = SPICE.levels index; number of shaker taps required. */
  spice: number;
  eatIn: boolean;
}

/** A skewer put on a ticket: which item and its cook quality 0..1 (from skewerQuality). */
export interface TicketSkewer {
  itemId: string;
  quality: number;
}

export interface Ticket {
  /** Cooked skewers already packed in the customer's bag. */
  skewers: TicketSkewer[];
  shakes: number;
  /** Raw skewers the customer has picked from the cooler onto their plate so far, per item. */
  picked: Record<string, number>;
  /** Skewers the player moved from the plate onto the grill, per item. */
  grilled: Record<string, number>;
  /** Seconds until the customer picks the next skewer. */
  pickT: number;
}

export interface Customer {
  id: number;
  archetype: ArchetypeId;
  order: Order;
  phase: Phase;
  /** Seconds left in the current phase (walks, eating, bill auto-collect). */
  phaseT: number;
  /** Patience left / max, seconds. Only drains in 'queue' and 'ordered'. */
  patience: number;
  patienceMax: number;
  /** Ticket slot 0..MAX_TICKETS-1 while 'ordered'. */
  ticketSlot: number | null;
  ticket: Ticket | null;
  /** Seat index while toSeat/eating/bill. */
  seat: number | null;
  /** Money waiting on the table ('bill'), or paid at the counter for takeaway. */
  bill: number;
  mood: 'happy' | 'ok' | 'sad' | 'angry' | null;
  /** Display name in Thai script (src/core/names.ts). */
  name: string;
  nameOrigin: NameOrigin;
  /** Pre-tip/combo amount of the bill (what auto-collect pays). */
  billBase: number;
  /** True once the seated customer has placed their one extra order. */
  extraDone: boolean;
  /** True while the current order is the extra one. */
  isExtra: boolean;
  /** Order in which they joined the queue (FIFO). */
  queueSeq: number;
  /** Order in which the plate was handed to the waiters (FIFO); null until then. */
  deliverSeq: number | null;
  /** Eating time to start once the plate arrives (extra orders eat briefly). */
  deliverEatSec: number | null;
}

export interface Ledger {
  sales: number;
  tips: number;
  combo: number;
  served: number;
  walkouts: number;
  /** stars given this shift (1..5), in order */
  stars: number[];
}

export type ShiftEvent =
  | { type: 'arrive'; id: number }
  | { type: 'pick'; id: number; itemId: string } // customer put a raw skewer on their plate
  | { type: 'toCounter'; id: number; ticketSlot: number }
  | { type: 'walkout'; id: number }
  | { type: 'served'; id: number; pay: number; tip: number; combo: number; stars: number; eatIn: boolean }
  | { type: 'toSeat'; id: number; seat: number }
  | { type: 'sit'; id: number; seat: number } // eat-in customer took a table while their order is being grilled
  | { type: 'delivered'; id: number }
  | { type: 'noSeat'; id: number } // eat-in customer took it away instead
  | { type: 'extraOrder'; id: number } // seated customer ordered more: back to 'ordered' with a new small order
  | { type: 'bill'; id: number; seat: number; amount: number }
  | { type: 'collected'; id: number; amount: number; auto: boolean }
  | { type: 'leave'; id: number }
  | { type: 'end' };

export interface ShiftOptions {
  location: LocationDef;
  /** Item ids the stall sells today. */
  menu: string[];
  seats: number;
  rating: number; // 1..5, scales spawn rate (reputation.spawnMultAt)
  priceMult?: number; // mala powder upgrade
  patienceMult?: number; // seat grade
  spawnMult?: number; // sign
  rng: Rng;
  /** Waiters who carry plates to tables (0 = legacy: customer eats right after being served). */
  waiters?: number;
  /** Seconds a waiter needs for one delivery. */
  waiterSec?: number;
  /** Cooler stock per item; customers take from it as they pick (mutated in place). Omit for unlimited. */
  stock?: Record<string, number>;
  /** Separate stream for cosmetic rolls (names) so they don't shift gameplay randomness. Default Math.random. */
  nameRng?: Rng;
}

export const MAX_SHAKES = 9;
const EXTRA_BACK_TO_EAT_SEC = 2;
const STEP = 0.25;

/** Spawn-rate multiplier for a shop rating: piecewise linear over reputation.spawnMultAt, clamped. */
export function repMult(rating: number): number {
  const pts = Object.entries(BALANCE.reputation.spawnMultAt)
    .map(([k, v]) => [Number(k), v as number] as const)
    .sort((a, b) => a[0] - b[0]);
  if (rating <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (rating <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (rating - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

/** 0 = calm (>60% left), 1 = hurried (>30%), 2 = about to leave. */
export function patienceBand(patience: number, patienceMax: number): 0 | 1 | 2 {
  const f = patienceMax > 0 ? patience / patienceMax : 0;
  const [a, b] = SERVICE.patienceBands;
  return f > a ? 0 : f > b ? 1 : 2;
}

const randint = (rng: Rng, [lo, hi]: [number, number]) => lo + Math.floor(rng() * (hi - lo + 1));

/** Rolls skewers for an order: weighted by archetype taste, stops before maxSpend, at least 1. */
export function rollOrder(
  rng: Rng, arch: ArchetypeId, menu: string[], size: number, priceMult = 1,
): OrderLine[] {
  const a = ARCHETYPES[arch];
  const ids = menu.filter((id) => ITEM_BY_ID[id]);
  const pool = ids.length ? ids : [ITEMS[0].id];
  const w = pool.map((id) => a.prefs[ITEM_BY_ID[id].cat] ?? 0.1);
  const total = w.reduce((x, y) => x + y, 0);
  const qty = new Map<string, number>();
  let spend = 0;
  let n = 0;
  while (n < size) {
    let r = rng() * total;
    let k = 0;
    while (k < pool.length - 1 && r >= w[k]) r -= w[k++];
    const price = ITEM_BY_ID[pool[k]].price * priceMult;
    if (n >= 1 && spend + price > a.maxSpend) break;
    spend += price;
    n++;
    qty.set(pool[k], (qty.get(pool[k]) ?? 0) + 1);
  }
  return [...qty].map(([itemId, q]) => ({ itemId, qty: q }));
}

export class Shift {
  /** Seconds elapsed, 0..SHIFT.lengthSec. */
  time = 0;
  money = 0;
  ended = false;
  customers: Customer[] = [];
  ledger: Ledger = { sales: 0, tips: 0, combo: 0, served: 0, walkouts: 0, stars: [] };
  /** Current combo steps (serves within SERVICE.comboWindowSec of each other). */
  comboSteps = 0;

  private nextId = 1;
  private seq = 0;
  private nextSpawn = 1;
  private lastServe = -Infinity;
  private pm: number;
  /** One entry per waiter: the customer being served, seconds left and trip length. */
  waiters: { id: number | null; t: number; total: number }[];

  constructor(readonly opts: ShiftOptions) {
    this.pm = opts.priceMult ?? 1;
    this.waiters = Array.from({ length: opts.waiters ?? 0 }, () => ({ id: null, t: 0, total: opts.waiterSec ?? 3 }));
  }

  /** In-game clock "18:00".."24:00". */
  clock(): string {
    const f = Math.min(1, this.time / SHIFT.lengthSec);
    const mins = Math.floor((360 * f) / 10) * 10;
    const h = 18 + Math.floor(mins / 60);
    return `${String(h).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }

  /** Advances time: spawns, walks, patience, walk-outs, eating, bill auto-collect, end of shift. */
  tick(dt: number): ShiftEvent[] {
    const ev: ShiftEvent[] = [];
    let left = dt;
    while (left > 1e-9) {
      const d = Math.min(STEP, left);
      left -= d;
      this.step(d, ev);
    }
    return ev;
  }

  private step(dt: number, ev: ShiftEvent[]): void {
    const L = SHIFT.lengthSec;
    this.time = Math.min(L, this.time + dt);
    const o = this.opts;
    while (this.time < L && this.time >= this.nextSpawn) {
      const at = this.nextSpawn;
      const waiting = this.customers.filter((c) => c.phase === 'walkIn' || c.phase === 'queue').length;
      if (waiting < MAX_QUEUE) this.spawn(ev);
      const rate = (o.location.customersPerMin * (o.spawnMult ?? 1) * repMult(o.rating)) / 60;
      this.nextSpawn = at + (1 / rate) * (0.7 + 0.6 * o.rng());
    }
    for (const c of [...this.customers]) this.stepCustomer(c, dt, ev);
    this.stepWaiters(dt, ev);
    this.customers = this.customers.filter((c) => c.phase !== 'gone');
    this.fillTickets(ev);
    if (
      this.time >= L && !this.ended &&
      !this.customers.some((c) => c.phase !== 'leaving' && c.phase !== 'gone')
    ) {
      this.ended = true;
      ev.push({ type: 'end' });
    }
  }

  private spawn(ev: ShiftEvent[]): void {
    const o = this.opts;
    const mix = Object.entries(o.location.mix) as [ArchetypeId, number][];
    const tw = mix.reduce((s, [, w]) => s + w, 0);
    let r = o.rng() * tw;
    let arch = mix[mix.length - 1][0];
    for (const [id, w] of mix) {
      if (r < w) { arch = id; break; }
      r -= w;
    }
    const a = ARCHETYPES[arch];
    const size = randint(o.rng, a.size);
    const lines = rollOrder(o.rng, arch, o.menu, size, this.pm);
    const spice = randint(o.rng, a.spice);
    const eatIn = o.rng() < (EAT_IN.rateByArchetype[arch] ?? 0);
    const total = lines.reduce((n, l) => n + l.qty, 0);
    const pMax = (a.patienceSec + total * SERVICE.patiencePerSkewerSec) * (o.patienceMult ?? 1) * (eatIn ? EAT_IN.patienceMult : 1);
    this.customers.push({
      ...nameFields(rollName(this.opts.nameRng ?? Math.random, arch)),
      id: this.nextId++, archetype: arch, order: { lines, spice, eatIn }, phase: 'walkIn',
      phaseT: WALK_IN_SEC, patience: pMax, patienceMax: pMax, ticketSlot: null, ticket: null,
      seat: null, bill: 0, mood: null, billBase: 0, extraDone: false, isExtra: false, queueSeq: 0, deliverSeq: null, deliverEatSec: null,
    });
    ev.push({ type: 'arrive', id: this.nextId - 1 });
  }

  /** Waiters pick up plates in the order they were handed over. The customer starts eating when the waiter
   *  arrives (half the trip); the waiter then walks back before taking the next plate. */
  private stepWaiters(dt: number, ev: ShiftEvent[]): void {
    const trip = this.opts.waiterSec ?? 3;
    for (const w of this.waiters) {
      if (w.id !== null) {
        w.t -= dt;
        const c = this.customers.find((x) => x.id === w.id);
        if (c && c.phase === 'delivering' && w.t <= w.total / 2) {
          c.phase = 'eating';
          c.phaseT = c.deliverEatSec ?? this.eatSec();
          c.deliverSeq = null;
          c.deliverEatSec = null;
          ev.push({ type: 'delivered', id: c.id });
        }
        if (w.t > 0) continue;
        w.id = null;
      }
      const next = this.customers
        .filter((x) => x.phase === 'delivering' && x.deliverSeq !== null && !this.waiters.some((o) => o.id === x.id))
        .sort((p, q) => (p.deliverSeq as number) - (q.deliverSeq as number))[0];
      if (next) { w.id = next.id; w.t = w.total = trip; }
    }
  }

  private handOverPlate(c: Customer, eatSec: number | null): void {
    c.phase = 'delivering';
    c.phaseT = 1e9;
    c.deliverSeq = this.seq++;
    c.deliverEatSec = eatSec;
  }

  /** Eat-in customers whose whole order is on the plate take a free table while it is grilled. */
  private trySit(c: Customer, ev: ShiftEvent[]): void {
    if (!this.waiters.length || !c.order.eatIn || c.isExtra || c.seat !== null) return;
    const used = new Set(this.customers.map((x) => x.seat));
    for (let i = 0; i < this.opts.seats; i++) {
      if (used.has(i)) continue;
      c.seat = i;
      ev.push({ type: 'sit', id: c.id, seat: i });
      return;
    }
  }

  private freeSlot(): number | null {
    for (let i = 0; i < MAX_TICKETS; i++) if (!this.atTicket(i)) return i;
    return null;
  }

  private takeTicket(c: Customer, slot: number): void {
    c.phase = 'ordered';
    c.ticketSlot = slot;
    c.ticket = { skewers: [], shakes: 0, picked: {}, grilled: {}, pickT: SERVICE.pickFirstSec };
  }

  /** Customers at the counter pick their own skewers from the cooler onto a plate, one at a time. */
  private pickItems(c: Customer, dt: number, ev: ShiftEvent[]): void {
    const t = c.ticket;
    if (!t) return;
    t.pickT -= dt;
    if (t.pickT > 0 && c.seat === null && c.order.lines.every((l) => (t.picked[l.itemId] ?? 0) >= l.qty)) this.trySit(c, ev);
    while (t.pickT <= 0) {
      const line = c.order.lines.find((l) => (t.picked[l.itemId] ?? 0) < l.qty);
      if (!line) { this.trySit(c, ev); return; }
      const left = this.opts.stock ? (this.opts.stock[line.itemId] ?? 0) : Infinity;
      if (left <= 0) {
        // the bar is out of this item: the customer stops picking it and settles for what they already have
        line.qty = t.picked[line.itemId] ?? 0;
        c.order.lines = c.order.lines.filter((l) => l.qty > 0);
        if (c.order.lines.length === 0) { c.mood = 'sad'; this.startLeaving(c); return; }
        continue;
      }
      if (this.opts.stock) this.opts.stock[line.itemId]--;
      t.picked[line.itemId] = (t.picked[line.itemId] ?? 0) + 1;
      t.pickT += SERVICE.pickSec;
      ev.push({ type: 'pick', id: c.id, itemId: line.itemId });
    }
  }

  /** Raw skewers of `itemId` on the customer's plate, ready to go on the grill. */
  onPlate(slot: number, itemId: string): number {
    const t = this.atTicket(slot)?.ticket;
    if (!t) return 0;
    const used = Math.max(t.grilled[itemId] ?? 0, t.skewers.filter((s) => s.itemId === itemId).length);
    return Math.max(0, (t.picked[itemId] ?? 0) - used);
  }

  /** Player takes one raw skewer off the plate to grill it. False if none is there. */
  takeFromPlate(slot: number, itemId: string): boolean {
    if (this.onPlate(slot, itemId) <= 0) return false;
    const t = this.atTicket(slot)!.ticket!;
    t.grilled[itemId] = (t.grilled[itemId] ?? 0) + 1;
    return true;
  }

  /** A grilled skewer was thrown away: the customer picks a replacement. */
  replacePicked(slot: number, itemId: string): void {
    const t = this.atTicket(slot)?.ticket;
    if (!t || (t.grilled[itemId] ?? 0) <= 0) return;
    t.grilled[itemId]--;
    t.picked[itemId] = Math.max(0, (t.picked[itemId] ?? 0) - 1);
    t.pickT = Math.min(t.pickT, 0);
  }

  private fillTickets(ev: ShiftEvent[]): void {
    for (;;) {
      const slot = this.freeSlot();
      if (slot === null) return;
      let best: Customer | null = null;
      for (const c of this.customers) if (c.phase === 'queue' && (!best || c.queueSeq < best.queueSeq)) best = c;
      if (!best) return;
      this.takeTicket(best, slot);
      ev.push({ type: 'toCounter', id: best.id, ticketSlot: slot });
    }
  }

  private startLeaving(c: Customer): void {
    c.phase = 'leaving';
    c.phaseT = WALK_OUT_SEC;
    c.seat = null;
    c.ticketSlot = null;
    c.ticket = null;
  }

  private stepCustomer(c: Customer, dt: number, ev: ShiftEvent[]): void {
    if (c.phase === 'queue' || c.phase === 'ordered') {
      c.patience = Math.max(0, c.patience - dt);
      if (c.phase === 'ordered') this.pickItems(c, dt, ev);
      if ((c.phase as Phase) !== 'leaving' && c.patience <= 0) {
        if (c.bill > 0) this.money += c.billBase; // seated customer with a pending bill still pays
        this.startLeaving(c);
        c.mood = 'angry';
        this.ledger.walkouts++;
        this.ledger.stars.push(SERVICE.walkoutStars);
        this.comboSteps = 0;
        this.lastServe = -Infinity;
        ev.push({ type: 'walkout', id: c.id });
      }
      return;
    }
    c.phaseT -= dt;
    if (c.phaseT > 0) return;
    switch (c.phase) {
      case 'walkIn': {
        c.queueSeq = this.seq++;
        const slot = this.freeSlot();
        if (slot === null) { c.phase = 'queue'; break; }
        this.takeTicket(c, slot);
        ev.push({ type: 'toCounter', id: c.id, ticketSlot: slot });
        break;
      }
      case 'toSeat':
        if (this.waiters.length) this.handOverPlate(c, null);
        else {
          c.phase = 'eating';
          c.phaseT = this.eatSec();
        }
        break;
      case 'eating': {
        const slot = this.freeSlot();
        if (!c.extraDone) {
          c.extraDone = true;
          if (slot !== null && this.opts.rng() < EAT_IN.extraOrderChance) {
            c.order = {
              lines: rollOrder(this.opts.rng, c.archetype, this.opts.menu, 1 + Math.floor(this.opts.rng() * 3), this.pm),
              spice: c.order.spice, eatIn: true,
            };
            c.isExtra = true;
            c.patience = c.patienceMax;
            this.takeTicket(c, slot);
            ev.push({ type: 'extraOrder', id: c.id });
            break;
          }
        }
        c.phase = 'bill';
        c.phaseT = SERVICE.autoCollectSec;
        ev.push({ type: 'bill', id: c.id, seat: c.seat as number, amount: c.bill });
        break;
      }
      case 'bill':
        this.money += c.billBase;
        ev.push({ type: 'collected', id: c.id, amount: c.billBase, auto: true });
        this.startLeaving(c);
        break;
      case 'leaving':
        c.phase = 'gone';
        ev.push({ type: 'leave', id: c.id });
        break;
    }
  }

  private eatSec(): number {
    const [lo, hi] = EAT_IN.eatSec;
    return lo + this.opts.rng() * (hi - lo);
  }

  /** Customer holding ticket slot `slot`, if any. */
  atTicket(slot: number): Customer | null {
    return this.customers.find((c) => c.phase === 'ordered' && c.ticketSlot === slot) ?? null;
  }

  private needed(c: Customer, itemId: string): boolean {
    const line = c.order.lines.find((l) => l.itemId === itemId);
    if (!line || !c.ticket) return false;
    return c.ticket.skewers.filter((s) => s.itemId === itemId).length < line.qty;
  }

  /** Can this skewer go on that ticket? (item still needed by the order). */
  canAdd(slot: number, itemId: string): boolean {
    const c = this.atTicket(slot);
    return !!c && this.needed(c, itemId);
  }

  /** Puts a cooked skewer on the ticket. False if not needed. */
  addSkewer(slot: number, sk: TicketSkewer): boolean {
    if (!this.canAdd(slot, sk.itemId)) return false;
    this.atTicket(slot)!.ticket!.skewers.push(sk);
    return true;
  }

  /** One shaker tap of mala powder on the ticket. */
  shake(slot: number): void {
    const c = this.atTicket(slot);
    if (c?.ticket) c.ticket.shakes = Math.min(MAX_SHAKES, c.ticket.shakes + 1);
  }

  /** All ordered skewers are on the ticket. */
  isComplete(slot: number): boolean {
    const c = this.atTicket(slot);
    if (!c?.ticket) return false;
    return c.order.lines.every((l) => !this.needed(c, l.itemId));
  }

  /** Hands the ticket over. Takeaway pays now; eat-in goes to a seat (or takes away if none free). */
  serve(slot: number): ShiftEvent[] {
    if (!this.isComplete(slot)) return [];
    const c = this.atTicket(slot)!;
    const t = c.ticket!;
    const ev: ShiftEvent[] = [];
    const base = t.skewers.reduce((s, k) => s + ITEM_BY_ID[k.itemId].price * this.pm, 0);
    const q = t.skewers.reduce((s, k) => s + k.quality, 0) / t.skewers.length;
    const wrong = t.shakes !== c.order.spice * SPICE.shakesPerLevel;
    const band = patienceBand(c.patience, c.patienceMax);
    const eat = c.order.eatIn;
    let tip = base * (ARCHETYPES[c.archetype].tipRate + (eat ? EAT_IN.tipBonus : 0)) *
      SERVICE.tipByBand[band] * q * (wrong ? 1 - SPICE.wrongSpicePenalty : 1);
    let seat = -1;
    const seatedAlready = !c.isExtra && c.seat !== null;
    if (seatedAlready) seat = c.seat as number;
    else if (eat && !c.isExtra) {
      const used = new Set(this.customers.map((x) => x.seat));
      for (let i = 0; i < this.opts.seats; i++) if (!used.has(i)) { seat = i; break; }
      if (seat < 0) {
        ev.push({ type: 'noSeat', id: c.id });
        tip *= EAT_IN.noSeatSatisfactionMult;
      }
    }
    tip = Math.round(tip);
    let stars = SERVICE.starsByBand[band] - (q < 0.6 ? 1 : 0) - (wrong ? 1 : 0);
    stars = Math.max(1, Math.min(5, stars));
    this.comboSteps = this.time - this.lastServe <= SERVICE.comboWindowSec ? this.comboSteps + 1 : 0;
    this.lastServe = this.time;
    const combo = Math.min(SERVICE.comboCap, SERVICE.comboStep * this.comboSteps);
    c.mood = stars >= 5 ? 'happy' : stars === 4 ? 'ok' : stars === 3 ? 'sad' : 'angry';
    const L = this.ledger;
    L.served++; L.sales += base; L.tips += tip; L.combo += combo; L.stars.push(stars);
    c.ticketSlot = null;
    c.ticket = null;
    const total = base + tip + combo;
    const sv: ShiftEvent = { type: 'served', id: c.id, pay: base, tip, combo, stars, eatIn: eat && (c.isExtra || seat >= 0) };
    if (c.isExtra) {
      c.bill += total;
      c.billBase += base;
      c.isExtra = false;
      if (this.waiters.length) this.handOverPlate(c, EXTRA_BACK_TO_EAT_SEC);
      else {
        c.phase = 'eating';
        c.phaseT = EXTRA_BACK_TO_EAT_SEC;
      }
      ev.push(sv);
    } else if (eat && seat >= 0) {
      c.bill = total;
      c.billBase = base;
      c.seat = seat;
      if (seatedAlready) {
        this.handOverPlate(c, null);
        ev.push(sv);
      } else {
        c.phase = 'toSeat';
        c.phaseT = WALK_SEAT_SEC;
        ev.push(sv, { type: 'toSeat', id: c.id, seat });
      }
    } else {
      this.money += total;
      c.bill = total;
      c.billBase = base;
      this.startLeaving(c);
      ev.push(sv);
    }
    return ev;
  }

  /** Player tapped the money on a table. */
  collect(customerId: number): ShiftEvent[] {
    const c = this.customers.find((x) => x.id === customerId);
    if (!c || c.phase !== 'bill') return [];
    this.money += c.bill;
    this.startLeaving(c);
    return [{ type: 'collected', id: c.id, amount: c.bill, auto: false }];
  }

  /** Average stars this shift (or null if none). */
  avgStars(): number | null {
    const s = this.ledger.stars;
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
  }
}
