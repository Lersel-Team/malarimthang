import { describe, it, expect } from 'vitest';
import {
  createGrill, placeSkewer, flip, removeSkewer, extinguish, tick, sideZone, skewerQuality,
  zoneQuality, brushOil, brushSauce, effectiveMargin, ALMOST_FROM, COOKING, item, type Grill, type Rng,
} from '../src/core/cooking';
import { ITEM_BY_ID } from '../src/data/balance';
const ST = (id: string) => ITEM_BY_ID[id].sideTime;

function mulberry32(a: number): Rng {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const never: Rng = () => 0.999999;
const always: Rng = () => 0;
const flat = (n = 4): Grill => createGrill(n, 1, never);

describe('createGrill', () => {
  it('evenness 1 gives heat 1.0 everywhere', () => {
    const g = createGrill(6, 1, mulberry32(1));
    expect(g.heat).toEqual([1, 1, 1, 1, 1, 1]);
    expect(g.slots).toEqual([null, null, null, null, null, null]);
  });
  it('evenness 0 spans 0.7..1.3', () => {
    expect(createGrill(1, 0, always).heat[0]).toBeCloseTo(0.7);
    expect(createGrill(1, 0, never).heat[0]).toBeCloseTo(1.3, 3);
  });
  it('evenness 0.5 halves the spread', () => {
    expect(createGrill(1, 0.5, always).heat[0]).toBeCloseTo(0.85);
  });
  it('seeded heat stays in range', () => {
    const g = createGrill(200, 0, mulberry32(7));
    for (const h of g.heat) { expect(h).toBeGreaterThanOrEqual(0.7); expect(h).toBeLessThanOrEqual(1.3); }
  });
});

describe('placeSkewer / removeSkewer', () => {
  it('places a fresh skewer with unique ids', () => {
    const g = flat();
    const a = placeSkewer(g, 0, 'fishball')!;
    const b = placeSkewer(g, 1, 'fishball')!;
    expect(a.id).not.toBe(b.id);
    expect(b.id).toBeGreaterThan(a.id);
    expect(a).toMatchObject({ itemId: 'fishball', sides: [0, 0], down: 0, flipCooldown: 0, flare: 0, burst: false });
    expect(g.slots[0]).toBe(a);
  });
  it('rejects occupied, out of range and unknown', () => {
    const g = flat();
    placeSkewer(g, 0, 'fishball');
    expect(placeSkewer(g, 0, 'crabstick')).toBeNull();
    expect(placeSkewer(g, -1, 'fishball')).toBeNull();
    expect(placeSkewer(g, 4, 'fishball')).toBeNull();
    expect(placeSkewer(g, 1.5, 'fishball')).toBeNull();
    expect(placeSkewer(g, 1, 'nope')).toBeNull();
    expect(g.slots[1]).toBeNull();
  });
  it('removeSkewer returns and clears', () => {
    const g = flat();
    const s = placeSkewer(g, 2, 'fishball');
    expect(removeSkewer(g, 2)).toBe(s);
    expect(g.slots[2]).toBeNull();
    expect(removeSkewer(g, 2)).toBeNull();
    expect(removeSkewer(g, 99)).toBeNull();
  });
});

describe('sideZone boundaries', () => {
  for (const id of ['enoki', 'tofu', 'cheeseball']) {
    const def = ITEM_BY_ID[id];
    const d = COOKING.doneAt, w = def.window, m = COOKING.burnMargin;
    const e = 1e-6;
    it(`${id} (window ${w})`, () => {
      expect(sideZone(0, def)).toBe('raw');
      expect(sideZone(ALMOST_FROM * d - e, def)).toBe('raw');
      expect(sideZone(ALMOST_FROM * d, def)).toBe('almost');
      expect(sideZone(d - e, def)).toBe('almost');
      expect(sideZone(d, def)).toBe('perfect');
      expect(sideZone(d + w - e, def)).toBe('perfect');
      expect(sideZone(d + w, def)).toBe('charred');
      expect(sideZone(d + w + m - e, def)).toBe('charred');
      expect(sideZone(d + w + m, def)).toBe('burnt');
      expect(sideZone(10, def)).toBe('burnt');
    });
  }
});

describe('quality', () => {
  const mk = (a: number, b: number) => {
    const g = flat(); const s = placeSkewer(g, 0, 'fishball')!; s.sides = [a, b]; s.oiled = true; s.sauce = 'good'; return s;
  }; // mk is oiled + well-sauced so the zone-average expectations below are unchanged by the brush multipliers
  it('zoneQuality values', () => {
    expect(zoneQuality('perfect')).toBe(1);
    expect(zoneQuality('almost')).toBe(0.7);
    expect(zoneQuality('charred')).toBe(0.4);
    expect(zoneQuality('burnt')).toBe(0);
    expect(zoneQuality('raw')).toBe(0);
  });
  it('averages sides', () => {
    expect(skewerQuality(mk(1.1, 1.1))).toBe(1);
    expect(skewerQuality(mk(1.1, 0.9))).toBeCloseTo(0.85);
    expect(skewerQuality(mk(1.1, 1.6))).toBeCloseTo(0.7);   // fishball: charred 1.45..1.75
    expect(skewerQuality(mk(1.1, 3))).toBeCloseTo(0.5);
    expect(skewerQuality(mk(3, 3))).toBe(0);
  });
  it('null when any side raw', () => {
    expect(skewerQuality(mk(1.1, 0))).toBeNull();
    expect(skewerQuality(mk(0.5, 1.1))).toBeNull();
  });
  it('null when burst', () => {
    const s = mk(1.1, 1.1); s.burst = true;
    expect(skewerQuality(s)).toBeNull();
  });
});

describe('flip', () => {
  it('toggles and sets cooldown', () => {
    const g = flat(); const s = placeSkewer(g, 0, 'fishball')!;
    expect(flip(s)).toBe(true);
    expect(s.down).toBe(1);
    expect(s.flipCooldown).toBe(COOKING.flipCooldownSec);
    expect(flip(s)).toBe(false);
    expect(s.down).toBe(1);
  });
  it('allowed again after cooldown ticks away', () => {
    const g = flat(); const s = placeSkewer(g, 0, 'fishball')!;
    flip(s);
    tick(g, COOKING.flipCooldownSec / 2, never);
    expect(flip(s)).toBe(false);
    tick(g, COOKING.flipCooldownSec, never);
    expect(s.flipCooldown).toBe(0);
    expect(flip(s)).toBe(true);
    expect(s.down).toBe(0);
  });
});

describe('tick cooking', () => {
  it('only the down side cooks', () => {
    const g = flat(); const s = placeSkewer(g, 0, 'fishball')!;
    tick(g, 1, never);
    expect(s.sides[0]).toBeCloseTo(1 / ST('fishball'));
    expect(s.sides[1]).toBe(0);
    flip(s);
    tick(g, 1, never);
    expect(s.sides[0]).toBeCloseTo(1 / ST('fishball'));
    expect(s.sides[1]).toBeCloseTo(1 / ST('fishball'));
  });
  it('reaches doneAt after sideTime', () => {
    const g = flat(); const s = placeSkewer(g, 0, 'crabstick')!;
    tick(g, ST('crabstick'), never);
    expect(s.sides[0]).toBeCloseTo(COOKING.doneAt);
  });
  it('heat multiplier scales cooking', () => {
    const g = createGrill(2, 0, always); // 0.7
    g.heat[1] = 1.3;
    const a = placeSkewer(g, 0, 'crabstick')!, b = placeSkewer(g, 1, 'crabstick')!;
    tick(g, 1, never);
    expect(a.sides[0]).toBeCloseTo(0.7 / ST('crabstick'));
    expect(b.sides[0]).toBeCloseTo(1.3 / ST('crabstick'));
  });
  it('fan gives x1.5 to the fanned slot only', () => {
    const g = flat();
    const a = placeSkewer(g, 0, 'crabstick')!, b = placeSkewer(g, 1, 'crabstick')!;
    tick(g, 1, never, { fanSlot: 1 });
    expect(a.sides[0]).toBeCloseTo(1 / ST('crabstick'));
    expect(b.sides[0]).toBeCloseTo(1.5 / ST('crabstick'));
    tick(g, 1, never, { fanSlot: null });
    expect(a.sides[0]).toBeCloseTo(2 / ST('crabstick'));
  });
  it('flare multiplies heat', () => {
    const g = flat(); const s = placeSkewer(g, 0, 'crabstick')!;
    s.flare = 5;
    tick(g, 1, never);
    expect(s.sides[0]).toBeCloseTo(COOKING.flareHeatMult / ST('crabstick'));
  });
  it('heat, fan and flare combine', () => {
    const g = flat(); g.heat[0] = 0.8;
    const s = placeSkewer(g, 0, 'crabstick')!; s.flare = 5;
    tick(g, 0.5, never, { fanSlot: 0 });
    expect(s.sides[0]).toBeCloseTo((0.8 * 1.5 * COOKING.flareHeatMult * 0.5) / ST('crabstick'));
  });
  it('empty slots are ignored', () => {
    expect(tick(flat(), 1, never)).toEqual([]);
  });
});

describe('tick zone events', () => {
  it('emits each zone change once on the down side', () => {
    const g = flat(); placeSkewer(g, 0, 'crabstick'); 
    const zones: string[] = [];
    for (let i = 0; i < 400; i++) {
      for (const e of tick(g, 0.05, never)) if (e.type === 'zone') {
        expect(e.slot).toBe(0); expect(e.side).toBe(0); zones.push(e.zone);
      }
    }
    expect(zones).toEqual(['almost', 'perfect', 'charred', 'burnt']);
  });
  it('reports the flipped side', () => {
    const g = flat(); const s = placeSkewer(g, 0, 'crabstick')!;
    flip(s);
    const ev = tick(g, ST('crabstick') * ALMOST_FROM / 1 + 0.05, never); // just past the almost threshold
    expect(ev).toEqual([{ type: 'zone', slot: 0, side: 1, zone: 'almost' }]);
  });
  it('no event when zone is unchanged', () => {
    const g = flat(); placeSkewer(g, 0, 'crabstick');
    expect(tick(g, 0.1, never)).toEqual([]);
  });
});

describe('flares', () => {
  it('never on non-fatty items', () => {
    const g = flat(); placeSkewer(g, 0, 'fishball');
    let flares = 0;
    for (let i = 0; i < 20000; i++) {
      for (const e of tick(g, 0.1, always)) if (e.type === 'flareStart') flares++;
    }
    expect(flares).toBe(0);
  });
  it('not while the down side is nearly raw', () => {
    const g = flat(); placeSkewer(g, 0, 'porkbelly');
    const ev = tick(g, 0.1, always); // c ~0.018
    expect(ev.some((e) => e.type === 'flareStart')).toBe(false);
  });
  it('starts, lasts flareDurationSec, ends naturally', () => {
    const g = flat(); const s = placeSkewer(g, 0, 'porkbelly')!;
    s.sides[0] = 0.5;
    const ev = tick(g, 0.1, always);
    expect(ev).toContainEqual({ type: 'flareStart', slot: 0 });
    expect(s.flare).toBe(COOKING.flareDurationSec);
    // no restart while flaring; ends after duration
    const all: string[] = [];
    for (let i = 0; i < 25; i++) for (const e of tick(g, 0.1, never)) all.push(e.type);
    expect(all.filter((t) => t === 'flareStart')).toEqual([]);
    expect(all.filter((t) => t === 'flareEnd')).toHaveLength(1);
    expect(s.flare).toBe(0);
  });
  it('probability matches config over many ticks (fatty)', () => {
    const rng = mulberry32(42);
    const g = flat(1);
    let starts = 0, seconds = 0;
    const s = placeSkewer(g, 0, 'porkbelly')!;
    for (let i = 0; i < 200000; i++) {
      s.sides[0] = 0.5; s.flare = 0; // hold state: cooking, not flaring
      const ev = tick(g, 0.1, rng);
      seconds += 0.1;
      if (ev.some((e) => e.type === 'flareStart')) starts++;
    }
    const rate = starts / seconds;
    expect(rate).toBeGreaterThan(COOKING.flareChancePerSecFatty * 0.9);
    expect(rate).toBeLessThan(COOKING.flareChancePerSecFatty * 1.1);
  });
  it('extinguish ends flare without flareEnd event', () => {
    const g = flat(); const s = placeSkewer(g, 0, 'porkbelly')!;
    s.flare = 1.5;
    expect(extinguish(g, 0)).toBe(true);
    expect(s.flare).toBe(0);
    expect(extinguish(g, 0)).toBe(false);
    expect(tick(g, 0.1, never).some((e) => e.type === 'flareEnd')).toBe(false);
  });
  it('extinguish on empty/out of range is false', () => {
    const g = flat();
    expect(extinguish(g, 0)).toBe(false);
    expect(extinguish(g, 50)).toBe(false);
  });
});

describe('burst', () => {
  it('cheeseball bursts once when burnt', () => {
    const g = flat(); const s = placeSkewer(g, 0, 'cheeseball')!;
    expect(item(s).burstsWhenBurnt).toBe(true);
    let bursts = 0;
    for (let i = 0; i < 400; i++) for (const e of tick(g, 0.05, never)) if (e.type === 'burst') bursts++;
    expect(bursts).toBe(1);
    expect(s.burst).toBe(true);
    expect(skewerQuality(s)).toBeNull();
  });
  it('burst follows the burnt zone event', () => {
    const g = flat(); const s = placeSkewer(g, 0, 'cheeseball')!;
    s.sides[0] = COOKING.doneAt + ITEM_BY_ID.cheeseball.window + COOKING.burnMargin - 0.01;
    const ev = tick(g, 0.1, never);
    expect(ev).toEqual([
      { type: 'zone', slot: 0, side: 0, zone: 'burnt' },
      { type: 'burst', slot: 0 },
    ]);
  });
  it('other items do not burst', () => {
    const g = flat(); const s = placeSkewer(g, 0, 'crabstick')!;
    s.sides[0] = 5;
    for (let i = 0; i < 20; i++) tick(g, 0.1, never);
    expect(s.burst).toBe(false);
  });
});

describe('brushing', () => {
  const fresh = (id = 'fishball') => { const g = flat(1); return { g, s: placeSkewer(g, 0, id)! }; };
  const B = COOKING.brush;
  it('place initialises brush state', () => {
    const { s } = fresh();
    expect([s.oiled, s.sauce, s.oilDrip]).toEqual([false, 'none', 0]);
  });
  it('brushOil / brushSauce return false on a second brush', () => {
    const { s } = fresh();
    expect(brushOil(s)).toBe(true); expect(brushOil(s)).toBe(false);
    s.sides = [1.1, 1.1];
    expect(brushSauce(s)).toBe(true); expect(brushSauce(s)).toBe(false);
  });
  it('oil starts the drip timer and it counts down', () => {
    const { g, s } = fresh();
    brushOil(s);
    expect(s.oilDrip).toBe(B.oilDripSec);
    tick(g, 0.5, never);
    expect(s.oilDrip).toBeCloseTo(B.oilDripSec - 0.5);
    tick(g, 5, never);
    expect(s.oilDrip).toBe(0);
  });
  function flareRate(id: string, dripping: boolean): number {
    const rng = mulberry32(7);
    const { g, s } = fresh(id);
    let starts = 0, secs = 0;
    for (let i = 0; i < 100000; i++) {
      s.sides[0] = 0.5; s.flare = 0; s.oilDrip = dripping ? 1000 : 0;
      if (tick(g, 0.1, rng).some((e) => e.type === 'flareStart')) starts++;
      secs += 0.1;
    }
    return starts / secs;
  }
  it('fatty flare rate during drip = base x oilDripFlareMult', () => {
    const r = flareRate('porkbelly', true);
    const e = (1 - Math.pow(1 - COOKING.flareChancePerSecFatty * B.oilDripFlareMult, 0.1)) / 0.1; // per-tick rate
    expect(r).toBeGreaterThan(e * 0.92); expect(r).toBeLessThan(e * 1.08);
  });
  it('lean item flares at oilDripBaseChance only during drip', () => {
    const r = flareRate('fishball', true);
    expect(r).toBeGreaterThan(B.oilDripBaseChance * 0.9); expect(r).toBeLessThan(B.oilDripBaseChance * 1.1);
    expect(flareRate('fishball', false)).toBe(0);
  });
  it('no extra flares once the drip has ended', () => {
    const { g, s } = fresh('fishball');
    brushOil(s);
    tick(g, B.oilDripSec + 0.1, never);
    let n = 0;
    for (let i = 0; i < 20000; i++) for (const e of tick(g, 0.1, always)) if (e.type === 'flareStart') n++;
    expect(n).toBe(0);
  });
  it('sauce is good when both sides are at least almost, early otherwise', () => {
    const a = fresh().s; a.sides = [0.9, 1.1]; brushSauce(a); expect(a.sauce).toBe('good');
    const b = fresh().s; b.sides = [1.1, 0.2]; brushSauce(b); expect(b.sauce).toBe('early');
    const c = fresh().s; brushSauce(c); expect(c.sauce).toBe('early');
  });
  it('early sauce halves the burn margin, so it burns sooner', () => {
    const def = ITEM_BY_ID['fishball'];
    const c = COOKING.doneAt + def.window + COOKING.burnMargin * 0.6; // charred normally, burnt with halved margin
    const a = fresh().s; const b = fresh().s;
    brushSauce(b);
    expect(effectiveMargin(a)).toBe(COOKING.burnMargin);
    expect(effectiveMargin(b)).toBeCloseTo(COOKING.burnMargin * B.earlySauceBurnMarginMult);
    a.sides = [1.1, c]; b.sides = [1.1, c]; a.sauce = 'good';
    expect(skewerQuality(a)).toBeCloseTo(0.7 * B.dryMult); // (1+0.4)/2, dry, good sauce
    expect(skewerQuality(b)).toBeCloseTo(0.5 * B.dryMult * B.unsaucedMult); // (1+0)/2
  });
  it('tick emits burnt zone event sooner with early sauce', () => {
    const { g, s } = fresh(); brushSauce(s);
    const def = item(s);
    s.sides[0] = COOKING.doneAt + def.window + COOKING.burnMargin * B.earlySauceBurnMarginMult - 0.001;
    expect(tick(g, 0.3, never)).toContainEqual({ type: 'zone', slot: 0, side: 0, zone: 'burnt' });
  });
  it('quality multipliers: perfect + oil + good sauce = 1.0, dry and unsauced scale down', () => {
    const s = fresh().s; s.sides = [1.1, 1.1];
    expect(skewerQuality(s)).toBeCloseTo(B.dryMult * B.unsaucedMult);
    brushOil(s); expect(skewerQuality(s)).toBeCloseTo(B.unsaucedMult);
    brushSauce(s); expect(s.sauce).toBe('good');
    expect(skewerQuality(s)).toBe(1);
  });
  it('sideZone default margin unchanged', () => {
    const def = ITEM_BY_ID['fishball'];
    const x = COOKING.doneAt + def.window + 0.2;
    expect(sideZone(x, def)).toBe('charred');
    expect(sideZone(x, def, 0.1)).toBe('burnt');
  });
});
