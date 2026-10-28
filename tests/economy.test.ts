import { describe, it, expect } from 'vitest';
import { newGame, createMarket, buyPacks, suggestRefill, endDay, takeLoan, xpForLevel, type GameState, type ShiftResult, type Market } from '../src/core/economy';
import type { Rng } from '../src/core/cooking';
import { ITEM_BY_ID, SHIFT, MARKET, LOCATIONS, UPGRADES } from '../src/data/balance';
const CH = SHIFT.charcoalPerShift;

function mulberry32(a: number): Rng {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const res = (o: Partial<ShiftResult> = {}): ShiftResult => ({
  sales: 0, tips: 0, combo: 0, served: 0, walkouts: 0, avgStars: null, sold: {}, wasted: {}, xpEarned: 0, ...o,
});
const flatMarket = (st: GameState, cost = 2): Market => ({
  day: st.day, packSize: SHIFT.packSize, maxPacks: 3,
  offers: st.unlockedItems.map((itemId) => ({ itemId, unitCost: cost, deal: null })),
});
const withStock = (o: Partial<GameState>): GameState => ({ ...newGame(), ...o });
const wage = (UPGRADES.find((u) => u.id === 'helper') as any).wagePerShift as number[];

describe('newGame', () => {
  it('has defaults', () => {
    const g = newGame();
    expect(g).toMatchObject({ shopName: 'หม่าล่าริมทาง', day: 1, money: SHIFT.startingMoney, level: 1, xp: 0, rating: 3, location: 'soi', loan: 0, updatedAt: 0, stock: {} });
    expect(g.unlockedItems).toEqual(['fishball', 'crabstick', 'enoki', 'porkbelly']);
    expect(g.unlockedLocations).toEqual(['soi']);
    expect(g.streak).toEqual({ count: 0, lastDate: null });
    for (const u of UPGRADES) expect(u.id in g.upgrades).toBe(true);
    expect(g.upgrades.tables).toBe(1);
    expect(g.upgrades.grillSize).toBe(0);
  });
});

describe('createMarket', () => {
  it('is deterministic per seed', () => {
    const g = newGame();
    expect(createMarket(g, mulberry32(5))).toEqual(createMarket(g, mulberry32(5)));
    expect(createMarket(g, mulberry32(5))).not.toEqual(createMarket(g, mulberry32(6)));
  });
  it('has one cheap and one distinct dear with right multipliers', () => {
    for (let seed = 1; seed < 30; seed++) {
      const m = createMarket(newGame(), mulberry32(seed));
      const cheap = m.offers.filter((o) => o.deal === 'cheap');
      const dear = m.offers.filter((o) => o.deal === 'dear');
      expect(cheap).toHaveLength(1);
      expect(dear).toHaveLength(1);
      expect(cheap[0].itemId).not.toBe(dear[0].itemId);
      const lim = (id: string, mult: number, j: number) => ITEM_BY_ID[id].cost * mult * (1 + j);
      const j = MARKET.dailyPriceJitter;
      const c = cheap[0], d = dear[0];
      expect(c.unitCost).toBeLessThanOrEqual(Math.max(1, lim(c.itemId, MARKET.dailyDeal.cheapMult, j)) + 0.25);
      expect(c.unitCost).toBeGreaterThanOrEqual(Math.max(1, lim(c.itemId, MARKET.dailyDeal.cheapMult, -j)) - 0.25);
      expect(d.unitCost).toBeGreaterThanOrEqual(lim(d.itemId, MARKET.dailyDeal.dearMult, -j) - 0.25);
      expect(d.unitCost).toBeLessThanOrEqual(lim(d.itemId, MARKET.dailyDeal.dearMult, j) + 0.25);
    }
  });
  it('rounds to 0.5 with min 1, and maxPacks 3', () => {
    for (let seed = 1; seed < 30; seed++) {
      const m = createMarket(newGame(), mulberry32(seed));
      expect(m.maxPacks).toBe(3);
      expect(m.packSize).toBe(SHIFT.packSize);
      for (const o of m.offers) {
        expect(o.unitCost * 2).toBe(Math.round(o.unitCost * 2));
        expect(o.unitCost).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it('exact values with mid rng', () => {
    const m = createMarket(newGame(), () => 0.5); // zero jitter; cheap idx 2, dear idx 1 (rng .5 of 3 -> 1... d>=c shift)
    expect(m.offers.map((o) => o.deal).filter(Boolean)).toHaveLength(2);
    const plain = m.offers.find((o) => o.deal === null)!;
    expect(plain.unitCost).toBe(ITEM_BY_ID[plain.itemId].cost);
  });
  it('no deals with fewer than 3 items and only unlocked items', () => {
    const m = createMarket(withStock({ unlockedItems: ['fishball', 'enoki'] }), mulberry32(1));
    expect(m.offers.map((o) => o.itemId)).toEqual(['fishball', 'enoki']);
    expect(m.offers.every((o) => o.deal === null)).toBe(true);
  });
});

describe('buyPacks', () => {
  it('buys and does not mutate', () => {
    const g = newGame();
    const snap = JSON.stringify(g);
    const m = flatMarket(g, 2);
    const n = buyPacks(g, m, 'fishball', 2)!;
    expect(n.money).toBe(300 - 2 * 10 * 2);
    expect(n.stock.fishball).toBe(20);
    expect(n.bought!.fishball).toBe(2);
    expect(n.costBasis!.fishball).toBe(2);
    expect(JSON.stringify(g)).toBe(snap);
  });
  it('weighted cost basis', () => {
    const g = newGame();
    const a = buyPacks(g, flatMarket(g, 2), 'fishball', 1)!;
    const b = buyPacks(a, flatMarket(a, 4), 'fishball', 1)!;
    expect(b.costBasis!.fishball).toBe(3);
  });
  it('rejects bad cases', () => {
    const g = newGame();
    const m = flatMarket(g, 2);
    expect(buyPacks(g, m, 'fishball', 0)).toBeNull();
    expect(buyPacks(g, m, 'fishball', -1)).toBeNull();
    expect(buyPacks(g, m, 'wagyu', 1)).toBeNull();
    expect(buyPacks(withStock({ money: 19 }), m, 'fishball', 1)).toBeNull();
    expect(buyPacks(g, m, 'fishball', 4)).toBeNull();
    const a = buyPacks(g, m, 'fishball', 2)!;
    expect(buyPacks(a, m, 'fishball', 2)).toBeNull();
    expect(buyPacks(a, m, 'fishball', 1)).not.toBeNull();
  });
  it('storage cap 30, 50 with fridge', () => {
    const m = flatMarket(newGame(), 1);
    expect(buyPacks(withStock({ stock: { fishball: 10 } }), m, 'fishball', 3)).toBeNull();
    expect(buyPacks(withStock({ stock: { fishball: 10 } }), m, 'fishball', 2)).not.toBeNull();
    const f = withStock({ stock: { fishball: 20 }, upgrades: { ...newGame().upgrades, fridge: 1 } });
    expect(buyPacks(f, m, 'fishball', 3)).not.toBeNull();
  });
});

describe('suggestRefill', () => {
  it('ceil(sold*1.2/10), most sold first, caps', () => {
    const g = withStock({ money: 1000 });
    const r = suggestRefill(g, flatMarket(g, 1), { fishball: 15, enoki: 40, crabstick: 0, nope: 9 });
    expect(r).toEqual({ enoki: 3, fishball: 2 });
    expect(Object.keys(r)[0]).toBe('enoki');
  });
  it('respects storage and bought', () => {
    const g = withStock({ money: 1000, stock: { fishball: 20 }, bought: { enoki: 2 } });
    const r = suggestRefill(g, flatMarket(g, 1), { fishball: 50, enoki: 50 });
    expect(r).toEqual({ fishball: 1, enoki: 1 });
  });
  it('stops when money runs out, never negative', () => {
    const g = withStock({ money: 50 });
    const r = suggestRefill(g, flatMarket(g, 2), { enoki: 30, fishball: 30 }); // pack = 20
    expect(r).toEqual({ enoki: 2 }); // 40 spent, 10 left < 20
    const spent = Object.values(r).reduce((a, b) => a + b, 0) * 20;
    expect(spent).toBeLessThanOrEqual(50);
  });
});

describe('endDay money/profit', () => {
  it('basic math', () => {
    const g = withStock({ stock: { fishball: 20 }, costBasis: { fishball: 2 } });
    const { state, summary } = endDay(g, res({ sales: 200, tips: 10, combo: 5, sold: { fishball: 15 }, wasted: { fishball: 2 } }), '2026-01-02');
    expect(summary.revenue).toBe(215);
    expect(summary.ingredientCost).toBe(34);
    expect(summary).toMatchObject({ rent: 40, charcoal: CH, wages: 0 });
    expect(summary.spoilage).toBe(4); // 3 left, 1 kept, 2 rot at 2
    expect(summary.profit).toBeCloseTo(215 - 34 - 40 - CH - summary.spoilage, 5);
    expect(state.money).toBe(300 + 215 - 40 - CH);
    expect(state.day).toBe(2);
  });
  it('spoilage value is exact', () => {
    const g = withStock({ stock: { fishball: 3 }, costBasis: { fishball: 2 } });
    const { summary } = endDay(g, res(), 'x');
    expect(summary.spoilage).toBe(2 * 2); // floor(3*.4)=1 kept
  });
  it('charcoal discount and helper wages', () => {
    const base = newGame().upgrades;
    const a = endDay(withStock({ upgrades: { ...base, grillType: 2 } }), res(), 'x').summary;
    expect(a.charcoal).toBeCloseTo(CH * 0.6);
    const b = endDay(withStock({ upgrades: { ...base, grillType: 1, helper: 2 } }), res(), 'x').summary;
    expect(b.charcoal).toBe(CH);
    expect(b.wages).toBe(wage[2]);
    expect(endDay(withStock({ upgrades: { ...base, helper: 2 } }), res(), 'x').state.money).toBe(300 - 40 - CH - wage[2]);
  });
  it('rent per location', () => {
    for (const l of LOCATIONS) {
      expect(endDay(withStock({ location: l.id }), res(), 'x').summary.rent).toBe(l.rent);
    }
  });
  it('profit may be negative', () => {
    expect(endDay(newGame(), res(), 'x').summary.profit).toBe(-(40 + CH));
  });
  it('falls back to item cost without basis', () => {
    const g = withStock({ stock: { porkbelly: 10 } });
    expect(endDay(g, res({ sold: { porkbelly: 10 } }), 'x').summary.ingredientCost).toBe(10 * ITEM_BY_ID.porkbelly.cost);
  });
  it('clears bought and decreases stock floor 0', () => {
    const g = withStock({ stock: { enoki: 5 }, bought: { enoki: 1 } });
    const { state } = endDay(g, res({ sold: { enoki: 9 } }), 'x');
    expect(state.stock.enoki).toBeUndefined();
    expect(state.bought).toEqual({});
  });
});

describe('spoilage', () => {
  it('meat/seafood rot fully beyond fridge', () => {
    const g = withStock({ stock: { porkbelly: 10 } });
    const { state, summary } = endDay(g, res(), 'x');
    expect(state.stock).toEqual({});
    expect(summary.spoilage).toBe(10 * ITEM_BY_ID.porkbelly.cost);
  });
  it('veg/processed keep 40%', () => {
    const { state } = endDay(withStock({ stock: { enoki: 10, fishball: 20 } }), res(), 'x');
    expect(state.stock).toEqual({ enoki: 4, fishball: 8 });
  });
  it('fridge keeps priciest first', () => {
    const upgrades = { ...newGame().upgrades, fridge: 1 }; // 20 skewers
    const g = withStock({ upgrades, stock: { porkbelly: 15, fishball: 15 } });
    const { state, summary } = endDay(g, res(), 'x');
    expect(state.stock.porkbelly).toBe(15);
    expect(state.stock.fishball).toBe(5 + Math.floor(10 * 0.4));
    expect(summary.spoilage).toBe(6 * ITEM_BY_ID.fishball.cost);
  });
  it('fridge rolls over remaining space into cheaper items', () => {
    const upgrades = { ...newGame().upgrades, fridge: 1 };
    const { state } = endDay(withStock({ upgrades, stock: { porkbelly: 30 } }), res(), 'x');
    expect(state.stock.porkbelly).toBe(20);
  });
});

describe('loan repay', () => {
  it('repays 20% of profit', () => {
    const g = withStock({ loan: 200 });
    const sales = 500 + 40 + CH;
    const { state, summary } = endDay(g, res({ sales }), 'x'); // profit 500
    expect(summary.loanRepaid).toBe(100);
    expect(state.loan).toBe(100);
    expect(state.money).toBe(300 + sales - 40 - CH - 100);
  });
  it('capped at loan, none on loss', () => {
    expect(endDay(withStock({ loan: 10 }), res({ sales: 540 + CH }), 'x').summary.loanRepaid).toBe(10);
    const l = endDay(withStock({ loan: 200 }), res(), 'x');
    expect(l.summary.loanRepaid).toBe(0);
    expect(l.state.loan).toBe(200);
  });
});

describe('rating', () => {
  it('moves 30% toward avgStars', () => {
    expect(endDay(newGame(), res({ avgStars: 5 }), 'x').state.rating).toBeCloseTo(3.6);
    expect(endDay(newGame(), res({ avgStars: 1 }), 'x').state.rating).toBeCloseTo(2.4);
  });
  it('unchanged when null, clamped', () => {
    expect(endDay(newGame(), res(), 'x').state.rating).toBe(3);
    expect(endDay(withStock({ rating: 5 }), res({ avgStars: 9 }), 'x').state.rating).toBe(5);
    expect(endDay(withStock({ rating: 1 }), res({ avgStars: -3 }), 'x').state.rating).toBe(1);
  });
});

describe('xp / level', () => {
  it('xpForLevel', () => {
    expect(xpForLevel(1)).toBe(30);
    expect(xpForLevel(2)).toBe(Math.round(30 * 2 ** 1.6));
  });
  it('no level up', () => {
    const r = endDay(newGame(), res({ xpEarned: 29 }), 'x');
    expect(r.state.level).toBe(1);
    expect(r.state.xp).toBe(29);
    expect(r.summary.leveledUpTo).toBeNull();
  });
  it('single level up', () => {
    const r = endDay(newGame(), res({ xpEarned: 40 }), 'x');
    expect(r.state.level).toBe(2);
    expect(r.state.xp).toBe(10);
    expect(r.summary.leveledUpTo).toBe(2);
  });
  it('multi level up', () => {
    const need = xpForLevel(1) + xpForLevel(2) + 5;
    const r = endDay(newGame(), res({ xpEarned: need }), 'x');
    expect(r.state.level).toBe(3);
    expect(r.state.xp).toBe(5);
    expect(r.summary.leveledUpTo).toBe(3);
  });
  it('stops at max level', () => {
    const r = endDay(withStock({ level: 20 }), res({ xpEarned: 1e6 }), 'x');
    expect(r.state.level).toBe(20);
    expect(r.summary.leveledUpTo).toBeNull();
  });
});

describe('streak', () => {
  const play = (last: string | null, count: number, today: string) =>
    endDay(withStock({ streak: { count, lastDate: last } }), res(), today).state.streak;
  it('first day', () => expect(play(null, 0, '2026-03-10')).toEqual({ count: 1, lastDate: '2026-03-10' }));
  it('consecutive', () => expect(play('2026-03-09', 4, '2026-03-10')).toEqual({ count: 5, lastDate: '2026-03-10' }));
  it('month and year boundary', () => {
    expect(play('2026-02-28', 1, '2026-03-01').count).toBe(2);
    expect(play('2025-12-31', 1, '2026-01-01').count).toBe(2);
    expect(play('2024-02-29', 1, '2024-03-01').count).toBe(2);
  });
  it('same day unchanged', () => expect(play('2026-03-10', 4, '2026-03-10').count).toBe(4));
  it('gap resets', () => expect(play('2026-03-07', 9, '2026-03-10').count).toBe(1));
});

describe('takeLoan', () => {
  const poor = (o: Partial<GameState> = {}) => withStock({ money: 40, ...o });
  it('gives 200', () => {
    const g = poor({ day: 5 });
    const n = takeLoan(g)!;
    expect(n.money).toBe(240);
    expect(n.loan).toBe(200);
    expect(n.loanDay).toBe(5);
    expect(g.loan).toBe(0);
  });
  it('guards', () => {
    expect(takeLoan(withStock({ money: 100 }))).toBeNull();
    expect(takeLoan(poor({ stock: { porkbelly: 20 } }))).toBeNull(); // value 80
    expect(takeLoan(poor({ stock: { fishball: 10 } }))).not.toBeNull(); // value 20
    expect(takeLoan(poor({ loan: 50 }))).toBeNull();
  });
  it('not within 3 days of last loan', () => {
    expect(takeLoan(poor({ day: 7, loanDay: 5 }))).toBeNull();
    expect(takeLoan(poor({ day: 8, loanDay: 5 }))).not.toBeNull();
  });
});
