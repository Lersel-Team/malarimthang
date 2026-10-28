import { describe, it, expect } from 'vitest';
import {
  Shift, repMult, patienceBand, rollOrder, MAX_TICKETS, MAX_QUEUE, WALK_IN_SEC, WALK_OUT_SEC,
  WALK_SEAT_SEC, type ShiftOptions, type Customer, type ShiftEvent,
} from '../src/core/shift';
import { ARCHETYPES, LOCATIONS, ITEM_BY_ID, SERVICE, EAT_IN, SHIFT } from '../src/data/balance';
import type { Rng } from '../src/core/cooking';

function mulberry32(a: number): Rng {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Base price of the standard 2x porkbelly test order. */
const BASE = 2 * ITEM_BY_ID.porkbelly.price;
const soi = LOCATIONS.find((l) => l.id === 'soi')!;
const MENU = ['fishball', 'crabstick', 'enoki', 'porkbelly'];
const mk = (o: Partial<ShiftOptions> = {}, seed = 1) =>
  new Shift({ location: soi, menu: MENU, seats: 2, rating: 3, rng: mulberry32(seed), ...o });
const types = (ev: ShiftEvent[]) => ev.map((e) => e.type);

/** Runs until the first customer exists; returns it. */
function spawnOne(s: Shift): Customer {
  while (!s.customers.length) s.tick(0.25);
  return s.customers[0];
}
/** Force-fills a customer's ticket with perfect skewers and the right spice. */
function fill(s: Shift, c: Customer, q = 1, spice = c.order.spice) {
  for (const l of c.order.lines) for (let i = 0; i < l.qty; i++) s.addSkewer(c.ticketSlot!, { itemId: l.itemId, quality: q });
  for (let i = 0; i < spice; i++) s.shake(c.ticketSlot!);
}
/** Spawns one customer, with deterministic eat-in flag, and moves it to the counter. */
function atCounter(eatIn: boolean, o: Partial<ShiftOptions> = {}) {
  const s = mk(o);
  let c = spawnOne(s);
  c.order.eatIn = eatIn;
  while (c.phase !== 'ordered') s.tick(0.25);
  c = s.customers.find((x) => x.id === c.id)!;
  return { s, c };
}

describe('helpers', () => {
  it('repMult interpolates and clamps', () => {
    expect(repMult(1)).toBeCloseTo(0.6);
    expect(repMult(0)).toBeCloseTo(0.6);
    expect(repMult(2)).toBeCloseTo(0.8);
    expect(repMult(3)).toBeCloseTo(1.0);
    expect(repMult(3.5)).toBeCloseTo(1.1);
    expect(repMult(5)).toBeCloseTo(1.45);
    expect(repMult(9)).toBeCloseTo(1.45);
  });
  it('patienceBand edges', () => {
    expect(patienceBand(10, 10)).toBe(0);
    expect(patienceBand(6.1, 10)).toBe(0);
    expect(patienceBand(6, 10)).toBe(1);
    expect(patienceBand(3.1, 10)).toBe(1);
    expect(patienceBand(3, 10)).toBe(2);
    expect(patienceBand(0, 10)).toBe(2);
  });
  it('rollOrder respects size, maxSpend, at least 1', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 50; i++) {
      const lines = rollOrder(rng, 'student', MENU, 4);
      const n = lines.reduce((a, l) => a + l.qty, 0);
      const spend = lines.reduce((a, l) => a + l.qty * ITEM_BY_ID[l.itemId].price, 0);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
      expect(spend).toBeLessThanOrEqual(50);
    }
    expect(rollOrder(rng, 'student', ['wagyu'], 3).reduce((a, l) => a + l.qty, 0)).toBe(1); // 79 > 50 but min 1
  });
  it('rollOrder prefers liked categories', () => {
    const rng = mulberry32(2);
    const cnt: Record<string, number> = {};
    for (let i = 0; i < 300; i++) for (const l of rollOrder(rng, 'student', ['fishball', 'porkbelly'], 3)) cnt[l.itemId] = (cnt[l.itemId] ?? 0) + l.qty;
    expect(cnt.fishball).toBeGreaterThan(cnt.porkbelly * 1.8);
  });
});

describe('spawning', () => {
  it('first arrival at t=1', () => {
    const s = mk();
    expect(types(s.tick(0.9))).not.toContain('arrive');
    expect(types(s.tick(0.2))).toContain('arrive');
    const c = s.customers[0];
    expect(c.phase).toBe('walkIn');
    expect(c.patience).toBe(c.patienceMax);
  });
  it('rate scales with rating', () => {
    const count = (rating: number) => {
      let n = 0;
      for (let seed = 1; seed <= 5; seed++) {
        const s = mk({ rating }, seed);
        for (let t = 0; t < 60; t += 0.25) {
          n += s.tick(0.25).filter((e) => e.type === 'arrive').length;
          // keep the queue clear so MAX_QUEUE never blocks
          s.customers.length = 0;
        }
      }
      return n;
    };
    const expected = soi.customersPerMin * repMult(3);
    const lo = count(1), mid = count(3), hi = count(5);
    expect(lo).toBeLessThan(mid);
    expect(mid).toBeLessThan(hi);
    expect(mid / 5).toBeGreaterThan(expected * 0.75);
    expect(mid / 5).toBeLessThan(expected * 1.35 + 1); // +1: the first arrival at t=1 always lands inside the 60 s window
  });
  it('spawnMult speeds arrivals', () => {
    const count = (spawnMult: number) => {
      const s = mk({ spawnMult }, 3);
      let n = 0;
      for (let t = 0; t < 90; t += 0.25) { n += s.tick(0.25).filter((e) => e.type === 'arrive').length; s.customers.length = 0; }
      return n;
    };
    expect(count(2)).toBeGreaterThan(count(1));
  });
  it('skips spawns when walkIn+queue is full', () => {
    const s = mk({ rating: 5, patienceMult: 100 });
    // block all ticket slots by never serving: customers pile up
    for (let t = 0; t < 240; t += 0.25) s.tick(0.25);
    const waiting = s.customers.filter((c) => c.phase === 'walkIn' || c.phase === 'queue').length;
    expect(waiting).toBeLessThanOrEqual(MAX_QUEUE);
    expect(waiting).toBe(MAX_QUEUE);
  });
  it('no spawning after the shift length', () => {
    const s = mk();
    s.tick(SHIFT.lengthSec);
    const ids = s.customers.map((c) => c.id);
    s.customers.length = 0;
    const ev = s.tick(30);
    expect(types(ev)).not.toContain('arrive');
    expect(ids.length).toBeGreaterThanOrEqual(0);
  });
  it('archetype follows location mix', () => {
    const s = mk({ location: LOCATIONS.find((l) => l.id === 'khaosan')!, rating: 5 }, 9);
    const seen = new Set<string>();
    for (let t = 0; t < 170; t += 0.25) { s.tick(0.25); s.customers.forEach((c) => seen.add(c.archetype)); s.customers.length = 0; }
    expect([...seen].sort()).toEqual(['nightowl', 'tourist']);
  });
  it('order spice within archetype range and patience uses patienceMult', () => {
    const s = mk({ patienceMult: 1.5 });
    const c = spawnOne(s);
    const total = c.order.lines.reduce((n, l) => n + l.qty, 0);
    const base = ARCHETYPES[c.archetype as 'student'].patienceSec + total * SERVICE.patiencePerSkewerSec;
    expect(c.patienceMax).toBeCloseTo(base * 1.5 * (c.order.eatIn ? EAT_IN.patienceMult : 1));
    expect(c.order.spice).toBeGreaterThanOrEqual(0);
    expect(c.order.spice).toBeLessThanOrEqual(4);
  });
});

describe('queue and tickets', () => {
  it('walkIn goes to ticket slot, then queue when full, FIFO on free', () => {
    const s = mk({ rating: 5, patienceMult: 100 });
    const ev: ShiftEvent[] = [];
    for (let t = 0; t < 120 && s.customers.filter((c) => c.phase === 'queue').length < 2; t += 0.25) ev.push(...s.tick(0.25));
    const ordered = s.customers.filter((c) => c.phase === 'ordered');
    expect(ordered.length).toBe(MAX_TICKETS);
    expect(ordered.map((c) => c.ticketSlot).sort()).toEqual([0, 1, 2]);
    expect(types(ev).filter((x) => x === 'toCounter').length).toBe(MAX_TICKETS);
    const queue = s.customers.filter((c) => c.phase === 'queue').sort((a, b) => a.queueSeq - b.queueSeq);
    expect(queue.length).toBeGreaterThanOrEqual(2);
    // free slot 1 by a serve
    const c1 = s.atTicket(1)!;
    fill(s, c1);
    s.serve(1);
    const ev2 = s.tick(0.01);
    expect(s.atTicket(1)!.id).toBe(queue[0].id);
    expect(ev2).toContainEqual({ type: 'toCounter', id: queue[0].id, ticketSlot: 1 });
    expect(s.customers.find((c) => c.id === queue[1].id)!.phase).toBe('queue');
  });
  it('patience only drains in queue and ordered', () => {
    const s = mk();
    const c = spawnOne(s);
    s.tick(1);
    expect(c.patience).toBe(c.patienceMax); // walkIn
    while (c.phase !== 'ordered') s.tick(0.25);
    const p = c.patience;
    s.tick(2);
    expect(c.patience).toBeCloseTo(p - 2, 5);
  });
  it('walk-out: stars, ledger, combo reset, slot freed, then leaves', () => {
    const s = mk();
    const c = spawnOne(s);
    s.comboSteps = 3;
    const ev: ShiftEvent[] = [];
    while (c.phase !== 'leaving') ev.push(...s.tick(0.25));
    expect(types(ev)).toContain('walkout');
    expect(c.mood).toBe('angry');
    expect(s.ledger.walkouts).toBe(1);
    expect(s.ledger.stars).toEqual([SERVICE.walkoutStars]);
    expect(s.comboSteps).toBe(0);
    expect(c.ticketSlot).toBeNull(); // slot freed (another customer may already have taken it)
    const ev2 = s.tick(WALK_OUT_SEC + 0.3);
    expect(ev2).toContainEqual({ type: 'leave', id: c.id });
    expect(s.customers.find((x) => x.id === c.id)).toBeUndefined();
  });
});

describe('ticket handling', () => {
  it('canAdd / addSkewer / isComplete', () => {
    const { s, c } = atCounter(false);
    const l = c.order.lines[0];
    expect(s.canAdd(c.ticketSlot!, 'wagyu')).toBe(false);
    expect(s.canAdd(2, l.itemId)).toBe(s.atTicket(2) !== null);
    expect(s.isComplete(c.ticketSlot!)).toBe(false);
    expect(s.serve(c.ticketSlot!)).toEqual([]);
    for (let i = 0; i < l.qty; i++) expect(s.addSkewer(c.ticketSlot!, { itemId: l.itemId, quality: 1 })).toBe(true);
    expect(s.addSkewer(c.ticketSlot!, { itemId: l.itemId, quality: 1 })).toBe(false);
    fill(s, c);
    expect(s.isComplete(c.ticketSlot!)).toBe(true);
  });
  it('shake caps at 9; empty slot is harmless', () => {
    const { s, c } = atCounter(false);
    for (let i = 0; i < 15; i++) s.shake(c.ticketSlot!);
    expect(c.ticket!.shakes).toBe(9);
    expect(() => s.shake(2)).not.toThrow();
    expect(s.isComplete(2)).toBe(false);
    expect(s.canAdd(2, 'fishball')).toBe(false);
  });
});

describe('serve math', () => {
  const setup = (arch: 'tourist' | 'student', eatIn = false) => {
    const { s, c } = atCounter(eatIn);
    c.archetype = arch;
    c.order = { lines: [{ itemId: 'porkbelly', qty: 2 }], spice: 2, eatIn };
    return { s, c };
  };
  it('takeaway pay, tip and stars (calm, perfect)', () => {
    const { s, c } = setup('tourist');
    c.patience = c.patienceMax;
    fill(s, c, 1);
    const ev = s.serve(c.ticketSlot!);
    const e = ev[0] as Extract<ShiftEvent, { type: 'served' }>;
    expect(e.pay).toBe(BASE);
    expect(e.tip).toBe(Math.round(BASE * 0.12));
    expect(e.stars).toBe(5);
    expect(e.combo).toBe(0);
    expect(s.money).toBe(BASE + Math.round(BASE * 0.12));
    expect(c.phase).toBe('leaving');
    expect(c.mood).toBe('happy');
    expect(s.ledger).toMatchObject({ served: 1, sales: BASE, tips: Math.round(BASE * 0.12), combo: 0, stars: [5] });
    expect(s.avgStars()).toBe(5);
    expect(s.atTicket(0)).toBeNull();
  });
  it('priceMult scales base', () => {
    const { s, c } = (() => {
      const r = atCounter(false, { priceMult: 1.1 });
      r.c.archetype = 'tourist';
      r.c.order = { lines: [{ itemId: 'porkbelly', qty: 2 }], spice: 0, eatIn: false };
      return r;
    })();
    fill(s, c);
    const e = s.serve(c.ticketSlot!)[0] as Extract<ShiftEvent, { type: 'served' }>;
    expect(e.pay).toBeCloseTo(BASE * 1.1);
  });
  it('band and quality reduce tip and stars', () => {
    const { s, c } = setup('tourist');
    c.patience = c.patienceMax * 0.5; // band 1
    fill(s, c, 0.5);
    const e = s.serve(c.ticketSlot!)[0] as Extract<ShiftEvent, { type: 'served' }>;
    expect(e.tip).toBe(Math.round(BASE * 0.12 * 0.35 * 0.5));
    expect(e.stars).toBe(4 - 1);
    expect(c.mood).toBe('sad');
  });
  it('band 2 gives no tip, 3 stars', () => {
    const { s, c } = setup('tourist');
    c.patience = c.patienceMax * 0.2;
    fill(s, c, 1);
    const e = s.serve(c.ticketSlot!)[0] as Extract<ShiftEvent, { type: 'served' }>;
    expect(e.tip).toBe(0);
    expect(e.stars).toBe(3);
  });
  it('wrong spice: tip penalty, -1 star (too few and too many)', () => {
    for (const shakes of [1, 3]) {
      const { s, c } = setup('tourist');
      c.patience = c.patienceMax;
      fill(s, c, 1, shakes);
      const e = s.serve(c.ticketSlot!)[0] as Extract<ShiftEvent, { type: 'served' }>;
      expect(e.tip).toBe(Math.round(BASE * 0.12 * 0.65));
      expect(e.stars).toBe(4);
    }
  });
  it('stars clamp to 1 and mood angry', () => {
    const { s, c } = setup('student');
    c.patience = c.patienceMax * 0.1;
    fill(s, c, 0.1, 0); // band 2 (3) -1 -1 = 1
    const e = s.serve(c.ticketSlot!)[0] as Extract<ShiftEvent, { type: 'served' }>;
    expect(e.stars).toBe(1);
    expect(c.mood).toBe('angry');
  });
  it('combo grows within window, resets outside, caps', () => {
    const s = mk({ rating: 5, patienceMult: 100, spawnMult: 8, location: LOCATIONS[2] });
    const results: number[] = [];
    const serveOne = () => {
      let c: Customer | null = null;
      while (!(c = s.atTicket(0) ?? s.atTicket(1) ?? s.atTicket(2))) s.tick(0.1);
      c.order.eatIn = false;
      fill(s, c);
      results.push((s.serve(c.ticketSlot!)[0] as Extract<ShiftEvent, { type: 'served' }>).combo);
    };
    serveOne();
    for (let i = 0; i < 2; i++) { s.tick(1); serveOne(); }
    expect(results.slice(0, 3)).toEqual([0, 5, 10]);
    s.tick(SERVICE.comboWindowSec + 1);
    serveOne();
    expect(results[3]).toBe(0);
    expect(s.ledger.combo).toBe(15);
    s.comboSteps = 20;
    (s as unknown as { lastServe: number }).lastServe = s.time;
    serveOne();
    expect(results[4]).toBe(SERVICE.comboCap);
  });
});

describe('eat-in', () => {
  it('seats the customer, pays on manual collect (bill incl tip bonus)', () => {
    const { s, c } = atCounter(true);
    c.archetype = 'family';
    c.order = { lines: [{ itemId: 'porkbelly', qty: 2 }], spice: 0, eatIn: true };
    c.patience = c.patienceMax;
    fill(s, c);
    const ev = s.serve(c.ticketSlot!);
    expect(types(ev)).toEqual(['served', 'toSeat']);
    const tip = Math.round(BASE * (0.03 + EAT_IN.tipBonus));
    expect(c.seat).toBe(0);
    expect(c.bill).toBe(BASE + tip);
    expect(s.money).toBe(0);
    expect(c.phase).toBe('toSeat');
    s.tick(WALK_SEAT_SEC + 0.3);
    expect(c.phase).toBe('eating');
    let bill: ShiftEvent | undefined;
    for (let t = 0; t < 10 && c.phase !== 'bill'; t += 0.25) {
      c.extraDone = true;
      bill = s.tick(0.25).find((e) => e.type === 'bill') ?? bill;
    }
    expect(bill).toEqual({ type: 'bill', id: c.id, seat: 0, amount: BASE + tip });
    expect(c.phaseT).toBeCloseTo(SERVICE.autoCollectSec, 0);
    const ev2 = s.collect(c.id);
    expect(ev2).toEqual([{ type: 'collected', id: c.id, amount: BASE + tip, auto: false }]);
    expect(s.money).toBe(BASE + tip);
    expect(c.phase).toBe('leaving');
    expect(c.seat).toBeNull();
    expect(s.collect(c.id)).toEqual([]);
  });
  it('auto-collect pays base only', () => {
    const { s, c } = atCounter(true);
    c.archetype = 'tourist';
    c.order = { lines: [{ itemId: 'porkbelly', qty: 2 }], spice: 0, eatIn: true };
    c.extraDone = true;
    fill(s, c);
    s.serve(c.ticketSlot!);
    expect(c.bill).toBeGreaterThan(BASE);
    let auto: ShiftEvent | undefined;
    for (let t = 0; t < 40 && !auto; t += 0.25) auto = s.tick(0.25).find((e) => e.type === 'collected');
    expect(auto).toEqual({ type: 'collected', id: c.id, amount: BASE, auto: true });
    expect(s.money).toBe(BASE);
  });
  it('seat indices are distinct; no free seat falls back to takeaway with reduced tip', () => {
    const s = mk({ seats: 1, rating: 5, patienceMult: 100, location: LOCATIONS[2] });
    const done: Customer[] = [];
    const out: ShiftEvent[][] = [];
    while (!(s.atTicket(0) && s.atTicket(1))) s.tick(0.1);
    for (let k = 0; k < 2; k++) {
      const c = s.atTicket(k)!;
      c.archetype = 'tourist';
      c.order = { lines: [{ itemId: 'porkbelly', qty: 2 }], spice: 0, eatIn: true };
      c.patience = c.patienceMax;
      fill(s, c);
      out.push(s.serve(c.ticketSlot!));
      done.push(c);
    }
    expect(done[0].seat).toBe(0);
    expect(types(out[1])).toEqual(['noSeat', 'served']);
    const e = out[1][1] as Extract<ShiftEvent, { type: 'served' }>;
    expect(e.eatIn).toBe(false);
    expect(e.tip).toBe(Math.round(BASE * (0.12 + EAT_IN.tipBonus) * EAT_IN.noSeatSatisfactionMult));
    expect(done[1].phase).toBe('leaving');
    expect(done[1].seat).toBeNull();
  });
  it('seats=0 means always takeaway', () => {
    const { s, c } = atCounter(true, { seats: 0 });
    fill(s, c);
    expect(types(s.serve(c.ticketSlot!))).toEqual(['noSeat', 'served']);
  });
  it('extra order: back to ordered, bill grows, short eating, then bill', () => {
    const { s, c } = atCounter(true);
    c.archetype = 'family';
    c.order = { lines: [{ itemId: 'porkbelly', qty: 2 }], spice: 1, eatIn: true };
    c.patience = c.patienceMax;
    fill(s, c);
    s.serve(c.ticketSlot!);
    const bill0 = c.bill;
    // force extra order: rng below chance for the first draw is not controllable, so retry seeds via monkey rng
    (s.opts as { rng: Rng }).rng = () => 0;
    let ev: ShiftEvent[] = [];
    for (let t = 0; t < 15 && c.phase !== 'ordered'; t += 0.25) ev = ev.concat(s.tick(0.25));
    expect(types(ev)).toContain('extraOrder');
    expect(c.phase).toBe('ordered');
    expect(c.seat).toBe(0);
    expect(c.patience).toBe(c.patienceMax);
    expect(c.order.spice).toBe(1);
    const n = c.order.lines.reduce((a, l) => a + l.qty, 0);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(3);
    fill(s, c);
    const sv = s.serve(c.ticketSlot!);
    expect(types(sv)).toEqual(['served']);
    expect(c.bill).toBeGreaterThan(bill0);
    expect(c.phase).toBe('eating');
    expect(c.phaseT).toBeCloseTo(2);
    expect(c.seat).toBe(0);
    let billEv: ShiftEvent | undefined;
    for (let t = 0; t < 5 && !billEv; t += 0.25) billEv = s.tick(0.25).find((e) => e.type === 'bill');
    expect(billEv).toBeDefined(); // only one extra order per customer
  });
  it('no extra order when no ticket slot is free', () => {
    const s = mk({ rating: 5, patienceMult: 100, location: LOCATIONS[2] });
    while (!(s.atTicket(0) && s.atTicket(1) && s.atTicket(2) && s.customers.some((x) => x.phase === 'queue'))) s.tick(0.1);
    const c = s.atTicket(0)!;
    c.order = { lines: [{ itemId: 'porkbelly', qty: 1 }], spice: 0, eatIn: true };
    fill(s, c);
    s.serve(0);
    (s.opts as { rng: Rng }).rng = () => 0;
    let ev: ShiftEvent[] = [];
    for (let t = 0; t < 8; t += 0.25) ev = ev.concat(s.tick(0.25));
    expect(types(ev)).not.toContain('extraOrder');
    expect(c.phase).not.toBe('ordered');
  });
});

describe('clock and end', () => {
  it('clock strings', () => {
    const s = mk();
    const L = SHIFT.lengthSec;
    expect(s.clock()).toBe('18:00');
    s.time = L / 12; expect(s.clock()).toBe('18:30');
    s.time = L / 6 - 0.1; expect(s.clock()).toBe('18:50');
    s.time = L / 2; expect(s.clock()).toBe('21:00');
    s.time = L - 0.1; expect(s.clock()).toBe('23:50');
    s.time = L; expect(s.clock()).toBe('24:00');
    s.time = L * 3; expect(s.clock()).toBe('24:00');
  });
  it('end fires once, only after everyone is done', () => {
    const s = mk({ rating: 1 }, 4);
    let ends = 0;
    for (let t = 0; t < 400; t += 0.25) {
      const ev = s.tick(0.25);
      ends += ev.filter((e) => e.type === 'end').length;
      if (s.ended) expect(s.customers.every((c) => c.phase === 'leaving')).toBe(true);
    }
    expect(ends).toBe(1);
    expect(s.ended).toBe(true);
    expect(types(s.tick(5))).not.toContain('end');
  });
  it('does not end while a customer is still waiting', () => {
    const s = mk();
    s.tick(2);
    s.time = SHIFT.lengthSec;
    s.tick(0.25);
    expect(s.ended).toBe(false);
  });
});

describe('full simulated shift with a bot', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed} runs and ends`, () => {
      const rng = mulberry32(seed * 101);
      const s = new Shift({ location: LOCATIONS[2], menu: MENU, seats: 4, rating: 3, rng: mulberry32(seed) });
      let ends = 0, ticks = 0;
      const evs: ShiftEvent[] = [];
      while (!s.ended && ticks++ < 5000) {
        evs.push(...s.tick(0.1));
        for (let slot = 0; slot < MAX_TICKETS; slot++) {
          const c = s.atTicket(slot);
          if (!c || rng() < 0.97) continue; // bot is slowish
          fill(s, c, rng());
          evs.push(...s.serve(slot));
        }
        for (const c of s.customers) if (c.phase === 'bill' && rng() < 0.3) evs.push(...s.collect(c.id));
        expect(s.customers.filter((c) => c.phase === 'ordered').length).toBeLessThanOrEqual(MAX_TICKETS);
        expect(s.customers.filter((c) => c.phase === 'queue' || c.phase === 'walkIn').length).toBeLessThanOrEqual(MAX_QUEUE);
      }
      ends = evs.filter((e) => e.type === 'end').length;
      expect(s.ended).toBe(true);
      expect(ends).toBe(1);
      expect(s.ledger.served + s.ledger.walkouts).toBeGreaterThan(5);
      expect(s.money).toBeGreaterThan(0);
      expect(s.ledger.stars.length).toBe(s.ledger.served + s.ledger.walkouts);
      expect(s.avgStars()).not.toBeNull();
      s.tick(WALK_OUT_SEC + 0.5);
      expect(s.customers.length).toBe(0);
      expect(WALK_IN_SEC).toBeGreaterThan(0);
    });
  }
});

describe('self-service plate', () => {
  it('customer picks the ordered skewers onto the plate over time, taking from stock', () => {
    const stock = { fishball: 50, crabstick: 50, enoki: 50, porkbelly: 50 };
    const { s, c } = atCounter(false, { stock });
    const total = c.order.lines.reduce((n, l) => n + l.qty, 0);
    expect(Object.values(c.ticket!.picked).reduce((a, b) => a + b, 0)).toBe(0);
    for (let i = 0; i < 80; i++) s.tick(0.25);
    expect(Object.values(c.ticket!.picked).reduce((a, b) => a + b, 0)).toBe(total);
    const taken = s.customers.reduce((n, x) => n + Object.values(x.ticket?.picked ?? {}).reduce((a, b) => a + b, 0), 0);
    expect(50 * 4 - Object.values(stock).reduce((a, b) => a + b, 0)).toBe(taken);
  });
  it('plate skewers can be taken once each, and a binned one is re-picked', () => {
    const { s, c } = atCounter(false);
    for (let i = 0; i < 80; i++) s.tick(0.25);
    const id = c.order.lines[0].itemId;
    const n = s.onPlate(c.ticketSlot!, id);
    expect(n).toBe(c.order.lines[0].qty);
    expect(s.takeFromPlate(c.ticketSlot!, id)).toBe(true);
    expect(s.onPlate(c.ticketSlot!, id)).toBe(n - 1);
    s.replacePicked(c.ticketSlot!, id);
    for (let i = 0; i < 20; i++) s.tick(0.25);
    expect(s.onPlate(c.ticketSlot!, id)).toBe(n);
  });
  it('sold-out items shrink the order; an empty order sends the customer away', () => {
    const { s, c } = atCounter(false, { stock: { fishball: 0, crabstick: 0, enoki: 0, porkbelly: 0 } });
    for (let i = 0; i < 8; i++) s.tick(0.25);
    expect(s.customers.find((x) => x.id === c.id)?.phase ?? 'gone').toMatch(/leaving|gone/);
  });
  it('a customer stops picking an item the bar ran out of and buys what they got', () => {
    const stock = { fishball: 1, crabstick: 50, enoki: 50, porkbelly: 50 };
    const { s, c } = atCounter(false, { stock });
    c.order.lines = [{ itemId: 'fishball', qty: 4 }, { itemId: 'enoki', qty: 2 }];
    for (let i = 0; i < 60; i++) s.tick(0.25);
    expect(c.order.lines).toEqual([{ itemId: 'fishball', qty: 1 }, { itemId: 'enoki', qty: 2 }]);
    expect(c.ticket!.picked).toEqual({ fishball: 1, enoki: 2 });
    expect(s.isComplete(c.ticketSlot!) || c.phase !== 'ordered').toBe(false);
  });
  it('a walk-out returns the raw skewers still on their plate (not the ones already grilled)', () => {
    const { s, c } = atCounter(false, { patienceMult: 1 });
    c.order.lines = [{ itemId: 'enoki', qty: 3 }];
    for (let i = 0; i < 20; i++) s.tick(0.25);
    expect(s.takeFromPlate(c.ticketSlot!, 'enoki')).toBe(true);
    c.patience = 0.1;
    const ev: ShiftEvent[] = [];
    for (let i = 0; i < 4; i++) ev.push(...s.tick(0.25));
    expect(ev).toContainEqual({ type: 'returned', id: c.id, itemId: 'enoki', qty: 2 });
  });
  it('eat-in customers wait longer than takeaway ones', () => {
    const arch = ARCHETYPES;
    let eat = 0, take = 0;
    for (let seed = 1; seed < 200 && (!eat || !take); seed++) {
      const s = mk({}, seed);
      const c = spawnOne(s);
      const base = arch[c.archetype].patienceSec;
      if (c.order.eatIn) eat = c.patienceMax / base; else take = c.patienceMax / base;
    }
    expect(eat).toBeGreaterThan(take);
  });
});
