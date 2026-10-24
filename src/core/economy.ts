// Day-to-day economy: persistent game state, morning market, end-of-day costs, levels.
// Pure logic, no Phaser. Spec: docs/GDD.md §7, §8, §13. Numbers: data/balance.json (shift, market, locations, progression, reputation).
import type { Rng } from './cooking';

export const SAVE_VERSION = 1;

export interface GameState {
  version: number;
  shopName: string; // default 'หม่าล่าริมทาง', max 24 chars
  day: number; // 1-based, the day about to be played
  money: number;
  level: number;
  xp: number;
  rating: number; // 1..5 rolling
  location: string; // LOCATIONS id
  unlockedItems: string[]; // item ids the player may stock
  unlockedLocations: string[];
  upgrades: Record<string, number>; // upgrade id -> level owned (0 = none)
  /** Skewers in stock per item id (carried overnight only up to fridge capacity; the rest spoils). */
  stock: Record<string, number>;
  /** Mum's loan outstanding (GDD §7.5), repaid as 20% of daily profit. */
  loan: number;
  /** Consecutive-day login streak and last played date (YYYY-MM-DD, local). */
  streak: { count: number; lastDate: string | null };
  updatedAt: number; // epoch ms, set by the save layer
}

export function newGame(): GameState {
  throw new Error('TODO S3-1');
}

export interface MarketOffer {
  itemId: string;
  /** Cost per skewer today (balance cost × jitter × deal mult), rounded to 0.5. */
  unitCost: number;
  deal: 'cheap' | 'dear' | null;
}

export interface Market {
  day: number;
  offers: MarketOffer[]; // unlocked items only
  packSize: number; // SHIFT.packSize
  /** Max packs per item per day (3). */
  maxPacks: number;
}

/** Seeded by day (use a day-derived rng) so the same day shows the same prices on every device. */
export function createMarket(state: GameState, rng: Rng): Market {
  throw new Error('TODO S3-1');
}

/** Buys `packs` packs. Returns the new state or null if not enough money / over maxPacks / storage cap. */
export function buyPacks(state: GameState, market: Market, itemId: string, packs: number): GameState | null {
  throw new Error('TODO S3-1');
}

/** "ซื้อเหมือนเมื่อวาน ×1.2": packs to refill what sold yesterday, within money and caps. */
export function suggestRefill(state: GameState, market: Market, soldYesterday: Record<string, number>): Record<string, number> {
  throw new Error('TODO S3-1');
}

export interface ShiftResult {
  sales: number;
  tips: number;
  combo: number;
  served: number;
  walkouts: number;
  avgStars: number | null;
  sold: Record<string, number>; // skewers sold per item
  wasted: Record<string, number>; // burnt/binned skewers per item
  xpEarned: number;
}

export interface DaySummary {
  revenue: number; // sales + tips + combo
  ingredientCost: number; // cost of skewers used (sold + wasted) at the prices paid
  rent: number;
  charcoal: number;
  wages: number;
  spoilage: number; // value of stock that rotted overnight
  profit: number;
  loanRepaid: number;
  leveledUpTo: number | null;
}

/**
 * Applies a finished shift: costs, spoilage (meat/seafood 1 night, veg 2, processed 3 unless fridge), loan repayment,
 * rating update (rolling toward avgStars), XP/levels, streak, day + 1. Returns the next state and the summary for the receipt.
 */
export function endDay(state: GameState, result: ShiftResult, today: string): { state: GameState; summary: DaySummary } {
  throw new Error('TODO S3-1');
}

/** Mum's loan offer when money < 100 ฿ at the market and nothing stocked (once per 3 days). Returns new state or null. */
export function takeLoan(state: GameState): GameState | null {
  throw new Error('TODO S3-1');
}

/** XP needed to leave level L: round(30 × L^1.6). */
export function xpForLevel(level: number): number {
  return Math.round(30 * Math.pow(level, 1.6));
}
