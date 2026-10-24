// Grill rules: two-sided skewers, per-slot heat, flare-ups. Pure logic, no Phaser.
// Spec: docs/GDD.md §4. Numbers: data/balance.json → cooking.
import { COOKING, ITEM_BY_ID, type ItemDef } from '../data/balance';

export type Zone = 'raw' | 'almost' | 'perfect' | 'charred' | 'burnt';

/** Lower edge of the "almost" zone, as a fraction of doneAt. */
export const ALMOST_FROM = 0.85;

export interface Skewer {
  id: number;
  itemId: string;
  /** Cook value per side. 0 = raw, COOKING.doneAt = just cooked. */
  sides: [number, number];
  /** Index of the side facing the coals. */
  down: 0 | 1;
  /** Seconds until the next flip is allowed. */
  flipCooldown: number;
  /** Seconds of flare-up left on this skewer (0 = none). */
  flare: number;
  /** Cheese ball popped after burning: cannot be served. */
  burst: boolean;
  /** Brushed with oil (else the skewer is dry: quality x dryMult). */
  oiled: boolean;
  /** Mala sauce: 'good' = applied once both sides were cooked, 'early' = applied too soon (burns sooner). */
  sauce: 'none' | 'good' | 'early';
  /** Seconds of oil drip left (can cause flare-ups). */
  oilDrip: number;
}

export interface Grill {
  slots: (Skewer | null)[];
  /** Heat multiplier per slot, ~0.7–1.3 on charcoal; 1.0 everywhere on a perfect grill. */
  heat: number[];
}

export type GrillEvent =
  | { type: 'zone'; slot: number; side: 0 | 1; zone: Zone }
  | { type: 'flareStart'; slot: number }
  | { type: 'flareEnd'; slot: number }
  | { type: 'burst'; slot: number };

export interface TickOptions {
  /** Slot being fanned this tick (heat × 1.5), if any. */
  fanSlot?: number | null;
}

/** Deterministic RNG in [0, 1). Pass Math.random in the game, a seeded one in tests. */
export type Rng = () => number;

let nextId = 1;

/** Quality of a single zone (COOKING.quality). */
export function zoneQuality(z: Zone): number {
  const q = COOKING.quality;
  return z === 'perfect' ? q.perfect : z === 'almost' ? q.ok : z === 'charred' ? q.slightlyBurnt : 0;
}

export function item(s: Skewer): ItemDef {
  return ITEM_BY_ID[s.itemId];
}

/** Heat per slot: random 0.7–1.3, pulled toward 1.0 by evenness (0..1, 1 = perfectly even). */
export function createGrill(slotCount: number, evenness: number, rng: Rng): Grill {
  const heat: number[] = [];
  for (let i = 0; i < slotCount; i++) heat.push(1 + (rng() * 0.6 - 0.3) * (1 - evenness));
  return { slots: Array.from({ length: slotCount }, () => null), heat };
}

/** Puts a fresh skewer on an empty slot. Returns null if the slot is taken or out of range. */
export function placeSkewer(grill: Grill, slot: number, itemId: string): Skewer | null {
  if (!Number.isInteger(slot) || slot < 0 || slot >= grill.slots.length) return null;
  if (grill.slots[slot] || !ITEM_BY_ID[itemId]) return null;
  const s: Skewer = { id: nextId++, itemId, sides: [0, 0], down: 0, flipCooldown: 0, flare: 0, burst: false, oiled: false, sauce: 'none', oilDrip: 0 };
  grill.slots[slot] = s;
  return s;
}

/** Flips the skewer if its cooldown has passed. Returns true if it flipped. */
export function flip(s: Skewer): boolean {
  if (s.flipCooldown > 0) return false;
  s.down = s.down === 0 ? 1 : 0;
  s.flipCooldown = COOKING.flipCooldownSec;
  return true;
}

/** Brushes oil on. Returns false if already oiled. Starts the drip window. */
export function brushOil(s: Skewer): boolean {
  if (s.oiled) return false;
  s.oiled = true;
  s.oilDrip = COOKING.brush.oilDripSec;
  return true;
}

/** Brushes mala sauce on (once). 'good' if both sides are at least almost-cooked, else 'early'. */
export function brushSauce(s: Skewer): boolean {
  if (s.sauce !== 'none') return false;
  const def = item(s);
  const raw = sideZone(s.sides[0], def) === 'raw' || sideZone(s.sides[1], def) === 'raw';
  s.sauce = raw ? 'early' : 'good';
  return true;
}

/** Burn margin this skewer actually has (halved by sauce put on too early). */
export function effectiveMargin(s: Skewer): number {
  return COOKING.burnMargin * (s.sauce === 'early' ? COOKING.brush.earlySauceBurnMarginMult : 1);
}

/** Takes the skewer off the grill (to an order tray or the bin). */
export function removeSkewer(grill: Grill, slot: number): Skewer | null {
  const s = grill.slots[slot] ?? null;
  if (s) grill.slots[slot] = null;
  return s;
}

/** Water spray: ends a flare-up immediately. Returns true if there was one. */
export function extinguish(grill: Grill, slot: number): boolean {
  const s = grill.slots[slot];
  if (!s || s.flare <= 0) return false;
  s.flare = 0;
  return true;
}

/**
 * Advances cooking by dt seconds. Down side: c += heat × fan × flare × dt / sideTime.
 * Fatty items may start a flare (COOKING.flareChancePerSecFatty per second).
 * Returns events for zone changes, flare start/end and bursts so the scene can play effects.
 */
export function tick(grill: Grill, dt: number, rng: Rng, opts?: TickOptions): GrillEvent[] {
  const events: GrillEvent[] = [];
  const fanSlot = opts?.fanSlot ?? null;
  grill.slots.forEach((s, slot) => {
    if (!s) return;
    const def = item(s);
    s.flipCooldown = Math.max(0, s.flipCooldown - dt);
    // flare timer
    if (s.flare > 0) {
      s.flare = Math.max(0, s.flare - dt);
      if (s.flare === 0) events.push({ type: 'flareEnd', slot });
    }
    // cook the down side
    const d = s.down;
    const margin = effectiveMargin(s);
    const before = sideZone(s.sides[d], def, margin);
    const fan = fanSlot === slot ? 1.5 : 1;
    const fl = s.flare > 0 ? COOKING.flareHeatMult : 1;
    s.sides[d] += (grill.heat[slot] * fan * fl * dt) / def.sideTime;
    const after = sideZone(s.sides[d], def, margin);
    if (after !== before) {
      events.push({ type: 'zone', slot, side: d, zone: after });
      if (after === 'burnt' && def.burstsWhenBurnt && !s.burst) {
        s.burst = true;
        events.push({ type: 'burst', slot });
      }
    }
    // flare chance: fatty items once cooking; oil drip raises it (and lets lean items flare)
    const dripping = s.oilDrip > 0;
    if (dripping) s.oilDrip = Math.max(0, s.oilDrip - dt);
    const B = COOKING.brush;
    const chance = dripping
      ? def.fatty ? COOKING.flareChancePerSecFatty * B.oilDripFlareMult : B.oilDripBaseChance
      : def.fatty && s.sides[d] > 0.2 ? COOKING.flareChancePerSecFatty : 0;
    if (chance > 0 && s.flare <= 0 && rng() < 1 - Math.pow(1 - chance, dt)) {
      s.flare = COOKING.flareDurationSec;
      events.push({ type: 'flareStart', slot });
    }
  });
  return events;
}

/** Zone of one side's cook value for this item (see GDD §4.1 table). */
export function sideZone(c: number, def: ItemDef, margin: number = COOKING.burnMargin): Zone {
  const done = COOKING.doneAt;
  if (c < ALMOST_FROM * done) return 'raw';
  if (c < done) return 'almost';
  if (c < done + def.window) return 'perfect';
  if (c < done + def.window + margin) return 'charred';
  return 'burnt';
}

/** Quality 0..1 = average of the two sides' zone quality; null if any side is raw or it burst. */
export function skewerQuality(s: Skewer): number | null {
  if (s.burst) return null;
  const def = item(s);
  const m = effectiveMargin(s);
  const zs = [sideZone(s.sides[0], def, m), sideZone(s.sides[1], def, m)];
  if (zs.includes('raw')) return null;
  const B = COOKING.brush;
  return ((zoneQuality(zs[0]) + zoneQuality(zs[1])) / 2) * (s.oiled ? 1 : B.dryMult) * (s.sauce === 'good' ? 1 : B.unsaucedMult);
}

export { COOKING };
