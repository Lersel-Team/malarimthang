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

export function item(s: Skewer): ItemDef {
  return ITEM_BY_ID[s.itemId];
}

/** Heat per slot: random 0.7–1.3, pulled toward 1.0 by evenness (0..1, 1 = perfectly even). */
export function createGrill(slotCount: number, evenness: number, rng: Rng): Grill {
  throw new Error('TODO S1-2');
}

/** Puts a fresh skewer on an empty slot. Returns null if the slot is taken or out of range. */
export function placeSkewer(grill: Grill, slot: number, itemId: string): Skewer | null {
  throw new Error('TODO S1-2');
}

/** Flips the skewer if its cooldown has passed. Returns true if it flipped. */
export function flip(s: Skewer): boolean {
  throw new Error('TODO S1-2');
}

/** Takes the skewer off the grill (to an order tray or the bin). */
export function removeSkewer(grill: Grill, slot: number): Skewer | null {
  throw new Error('TODO S1-2');
}

/** Water spray: ends a flare-up immediately. Returns true if there was one. */
export function extinguish(grill: Grill, slot: number): boolean {
  throw new Error('TODO S1-2');
}

/**
 * Advances cooking by dt seconds. Down side: c += heat × fan × flare × dt / sideTime.
 * Fatty items may start a flare (COOKING.flareChancePerSecFatty per second).
 * Returns events for zone changes, flare start/end and bursts so the scene can play effects.
 */
export function tick(grill: Grill, dt: number, rng: Rng, opts?: TickOptions): GrillEvent[] {
  throw new Error('TODO S1-2');
}

/** Zone of one side's cook value for this item (see GDD §4.1 table). */
export function sideZone(c: number, def: ItemDef): Zone {
  throw new Error('TODO S1-2');
}

/** Quality 0..1 = average of the two sides' zone quality; null if any side is raw or it burst. */
export function skewerQuality(s: Skewer): number | null {
  throw new Error('TODO S1-2');
}

export { COOKING };
