// Day-to-day economy: persistent game state, morning market, end-of-day costs, levels.
// Pure logic, no Phaser. Spec: docs/GDD.md §7, §8, §13. Numbers: data/balance.json (shift, market, locations, progression, reputation).
import type { Rng } from './cooking';
import { ITEMS, ITEM_BY_ID, LOCATIONS, MARKET, PROGRESSION, REPUTATION, SHIFT, UPGRADES } from '../data/balance';

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
  /** Packs bought today per item id (cap MAX_PACKS); cleared by endDay. */
  bought?: Record<string, number>;
  /** Average paid cost per skewer in stock per item id; falls back to item.cost. */
  costBasis?: Record<string, number>;
  /** Day number the last loan was taken (one per 3 days). */
  loanDay?: number;
}

export const MAX_PACKS = 3;
export const STORAGE_CAP = 30;
export const STORAGE_CAP_FRIDGE = 50;
/** Share of over-capacity veg/processed stock that survives the night (simplification of the 2/3-night rule). */
export const KEEP_SHARE = 0.4;

const upg = (id: string) => UPGRADES.find((u) => u.id === id)!;
const basis = (st: GameState, id: string) => st.costBasis?.[id] ?? ITEM_BY_ID[id].cost;
const storageCap = (st: GameState) => ((st.upgrades.fridge ?? 0) >= 1 ? STORAGE_CAP_FRIDGE : STORAGE_CAP);

export function newGame(): GameState {
  const upgrades: Record<string, number> = {};
  for (const u of UPGRADES) upgrades[u.id] = 0;
  upgrades.tables = 1; // 2 stools to start
  return {
    version: SAVE_VERSION,
    shopName: 'หม่าล่าริมทาง',
    day: 1,
    money: SHIFT.startingMoney,
    level: 1,
    xp: 0,
    rating: REPUTATION.start,
    location: 'soi',
    unlockedItems: ITEMS.filter((i) => i.unlockCost === 0).map((i) => i.id),
    unlockedLocations: ['soi'],
    upgrades,
    stock: {},
    loan: 0,
    streak: { count: 0, lastDate: null },
    updatedAt: 0,
  };
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

const roundHalf = (x: number) => Math.max(1, Math.round(x * 2) / 2);

/** Seeded by day (use a day-derived rng) so the same day shows the same prices on every device. */
export function createMarket(state: GameState, rng: Rng): Market {
  const ids = state.unlockedItems.filter((id) => ITEM_BY_ID[id]);
  const mult = ids.map(() => 1 + (rng() * 2 - 1) * MARKET.dailyPriceJitter);
  const deal: ('cheap' | 'dear' | null)[] = ids.map(() => null);
  if (ids.length >= 3) {
    const c = Math.floor(rng() * ids.length);
    let d = Math.floor(rng() * (ids.length - 1));
    if (d >= c) d++;
    deal[c] = 'cheap';
    deal[d] = 'dear';
  }
  const offers = ids.map((id, i) => {
    const m = mult[i] * (deal[i] === 'cheap' ? MARKET.dailyDeal.cheapMult : deal[i] === 'dear' ? MARKET.dailyDeal.dearMult : 1);
    return { itemId: id, unitCost: roundHalf(ITEM_BY_ID[id].cost * m), deal: deal[i] };
  });
  return { day: state.day, offers, packSize: SHIFT.packSize, maxPacks: MAX_PACKS };
}

/** Buys `packs` packs. Returns the new state or null if not enough money / over maxPacks / storage cap. */
export function buyPacks(state: GameState, market: Market, itemId: string, packs: number): GameState | null {
  const offer = market.offers.find((o) => o.itemId === itemId);
  if (!offer || !Number.isInteger(packs) || packs <= 0) return null;
  const done = state.bought?.[itemId] ?? 0;
  if (done + packs > market.maxPacks) return null;
  const skewers = packs * market.packSize;
  const have = state.stock[itemId] ?? 0;
  if (have + skewers > storageCap(state)) return null;
  const cost = offer.unitCost * skewers;
  if (cost > state.money) return null;
  const avg = (have * basis(state, itemId) + skewers * offer.unitCost) / (have + skewers);
  return {
    ...state,
    money: state.money - cost,
    stock: { ...state.stock, [itemId]: have + skewers },
    costBasis: { ...state.costBasis, [itemId]: avg },
    bought: { ...state.bought, [itemId]: done + packs },
  };
}

/** "ซื้อเหมือนเมื่อวาน ×1.2": packs to refill what sold yesterday, within money and caps. */
export function suggestRefill(state: GameState, market: Market, soldYesterday: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  let money = state.money;
  const order = Object.keys(soldYesterday).filter((id) => soldYesterday[id] > 0).sort((a, b) => soldYesterday[b] - soldYesterday[a]);
  for (const id of order) {
    const offer = market.offers.find((o) => o.itemId === id);
    if (!offer) continue;
    let packs = Math.ceil((soldYesterday[id] * MARKET.refillYesterdayMult) / market.packSize);
    packs = Math.min(packs, market.maxPacks - (state.bought?.[id] ?? 0));
    packs = Math.min(packs, Math.floor((storageCap(state) - (state.stock[id] ?? 0)) / market.packSize));
    packs = Math.min(packs, Math.floor(money / (offer.unitCost * market.packSize)));
    if (packs <= 0) continue;
    out[id] = packs;
    money -= packs * offer.unitCost * market.packSize;
  }
  return out;
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

const pad = (n: number) => String(n).padStart(2, '0');
/** Day before a local YYYY-MM-DD, by pure calendar arithmetic. */
function prevDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/**
 * Applies a finished shift: costs, spoilage, loan repayment, rating update (rolling toward avgStars), XP/levels,
 * streak, day + 1. Returns the next state and the summary for the receipt.
 * Spoilage simplification: the fridge keeps `values[level]` skewers overnight (priciest first). Of the rest,
 * meat/seafood rot fully; veg/processed keep KEEP_SHARE (floor) and rot the remainder. No per-item age tracking.
 * XP is progress within the current level: leveling subtracts xpForLevel(level).
 */
export function endDay(state: GameState, result: ShiftResult, today: string): { state: GameState; summary: DaySummary } {
  const revenue = result.sales + result.tips + result.combo;
  const stock: Record<string, number> = { ...state.stock };
  let ingredientCost = 0;
  for (const id of new Set([...Object.keys(result.sold), ...Object.keys(result.wasted)])) {
    const used = (result.sold[id] ?? 0) + (result.wasted[id] ?? 0);
    ingredientCost += used * basis(state, id);
    if (id in stock) stock[id] = Math.max(0, stock[id] - used);
  }
  const rent = LOCATIONS.find((l) => l.id === state.location)?.rent ?? 0;
  const charcoal = SHIFT.charcoalPerShift * ((state.upgrades.grillType ?? 0) >= 2 ? 0.6 : 1);
  const wages = (upg('helper') as { wagePerShift?: number[] }).wagePerShift?.[state.upgrades.helper ?? 0] ?? 0;

  // overnight: fridge first (priciest first), then the category rules
  let room = (upg('fridge').values as number[])[state.upgrades.fridge ?? 0] ?? 0;
  let spoilage = 0;
  const kept: Record<string, number> = {};
  const ids = Object.keys(stock).filter((id) => stock[id] > 0 && ITEM_BY_ID[id]).sort((a, b) => basis(state, b) - basis(state, a));
  for (const id of ids) {
    const inFridge = Math.min(room, stock[id]);
    room -= inFridge;
    const rest = stock[id] - inFridge;
    const cat = ITEM_BY_ID[id].cat;
    const survive = cat === 'meat' || cat === 'seafood' ? 0 : Math.floor(rest * KEEP_SHARE);
    spoilage += (rest - survive) * basis(state, id);
    if (inFridge + survive > 0) kept[id] = inFridge + survive;
  }
  const costBasis: Record<string, number> = {};
  for (const id of Object.keys(kept)) costBasis[id] = basis(state, id);

  const profit = revenue - ingredientCost - rent - charcoal - wages - spoilage;
  let money = state.money + revenue - rent - charcoal - wages;
  let loan = state.loan;
  const loanRepaid = Math.min(loan, Math.round(0.2 * Math.max(0, profit) * 100) / 100, Math.max(0, money));
  money -= loanRepaid;
  loan -= loanRepaid;

  let rating = state.rating;
  if (result.avgStars != null) rating = Math.min(5, Math.max(1, rating + (result.avgStars - rating) * 0.3));

  let level = state.level;
  let xp = state.xp + result.xpEarned;
  while (level < PROGRESSION.maxLevel && xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
  }

  const last = state.streak.lastDate;
  const count = last === today ? state.streak.count : last === prevDate(today) ? state.streak.count + 1 : 1;

  const next: GameState = {
    ...state, day: state.day + 1, money, level, xp, rating, loan, stock: kept, costBasis,
    streak: { count, lastDate: today }, bought: {},
  };
  return { state: next, summary: { revenue, ingredientCost, rent, charcoal, wages, spoilage, profit, loanRepaid, leveledUpTo: level > state.level ? level : null } };
}

/** Mum's loan offer when money < 100 ฿ at the market and nothing stocked (once per 3 days). Returns new state or null. */
export function takeLoan(state: GameState): GameState | null {
  const value = Object.entries(state.stock).reduce((a, [id, n]) => a + n * (ITEM_BY_ID[id] ? basis(state, id) : 0), 0);
  if (state.money >= 100 || value >= 50 || state.loan !== 0) return null;
  if (state.loanDay !== undefined && state.day - state.loanDay < 3) return null;
  return { ...state, money: state.money + 200, loan: 200, loanDay: state.day };
}

/** XP needed to leave level L: round(30 × L^1.6). */
export function xpForLevel(level: number): number {
  return Math.round(30 * Math.pow(level, 1.6));
}
