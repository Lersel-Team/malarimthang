import { SAVE_VERSION, type GameState } from '../core/economy';
import { ITEM_BY_ID } from '../data/balance';
import type { SaveRepository } from './SaveRepository';

export const SAVE_KEY = 'malarimthang_save_v1';
export const CORRUPT_PREFIX = 'malarimthang_save_corrupt_';
const KEEP_BACKUPS = 2;
const DEFAULT_SHOP = 'หม่าล่าริมทาง';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & Partial<Pick<Storage, 'key' | 'length'>>;

/** localStorage-backed save under key 'malarimthang_save_v1'. */
export class LocalSave implements SaveRepository {
  constructor(readonly storage: StorageLike = globalThis.localStorage) {}

  async load(): Promise<GameState | null> {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(SAVE_KEY);
    } catch (e) {
      console.warn('LocalSave: read failed', e);
      return null;
    }
    if (raw === null) return null;
    let state: GameState | null = null;
    try {
      state = migrate(JSON.parse(raw));
    } catch {
      state = null;
    }
    if (!state) this.backupCorrupt(raw);
    return state;
  }

  async save(state: GameState): Promise<void> {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify({ ...state, updatedAt: Date.now() }));
    } catch (e) {
      console.warn('LocalSave: save failed', e);
    }
  }

  async clear(): Promise<void> {
    try {
      this.storage.removeItem(SAVE_KEY);
    } catch (e) {
      console.warn('LocalSave: clear failed', e);
    }
  }

  private backupCorrupt(raw: string): void {
    try {
      let ts = Date.now();
      while (this.storage.getItem(CORRUPT_PREFIX + ts) !== null) ts++;
      this.storage.setItem(CORRUPT_PREFIX + ts, raw);
      if (!this.storage.key || this.storage.length === undefined) return;
      const keys: string[] = [];
      for (let i = 0; i < this.storage.length; i++) {
        const k = this.storage.key(i);
        if (k && k.startsWith(CORRUPT_PREFIX)) keys.push(k);
      }
      keys.sort((a, b) => Number(a.slice(CORRUPT_PREFIX.length)) - Number(b.slice(CORRUPT_PREFIX.length)));
      for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_BACKUPS))) this.storage.removeItem(k);
    } catch (e) {
      console.warn('LocalSave: backup failed', e);
    }
  }
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * migrations[v] upgrades a save at version v to version v + 1.
 * Example, when v2 adds a `tips` counter:
 *   1: (s) => ({ ...s, version: 2, tips: 0 }),
 * Bump SAVE_VERSION to 2 and add that single entry; the chain runs 1 -> 2 -> ... -> SAVE_VERSION.
 */
export const migrations: Record<number, Migration> = {};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
function numRec(v: unknown, validKey?: (k: string) => boolean, min = 0): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [k, x] of Object.entries(v)) {
    if (typeof x !== 'number' || !Number.isFinite(x)) continue;
    if (validKey && !validKey(k)) continue;
    out[k] = Math.max(min, x);
  }
  return out;
}

function sanitise(r: Record<string, unknown>): GameState {
  const name = typeof r.shopName === 'string' ? Array.from(r.shopName.trim()).slice(0, 24).join('').trim() : '';
  const locs = strArr(r.unlockedLocations);
  if (!locs.includes('soi')) locs.unshift('soi');
  const st = isObj(r.streak) ? r.streak : {};
  return {
    version: SAVE_VERSION,
    shopName: name || DEFAULT_SHOP,
    day: Math.max(1, Math.floor(num(r.day, 1))),
    money: Math.max(0, num(r.money, 0)),
    level: clamp(Math.floor(num(r.level, 1)), 1, 20),
    xp: Math.max(0, num(r.xp, 0)),
    rating: clamp(num(r.rating, 3), 1, 5),
    location: typeof r.location === 'string' && r.location ? r.location : 'soi',
    unlockedItems: strArr(r.unlockedItems).filter((id) => !!ITEM_BY_ID[id]),
    unlockedLocations: locs,
    upgrades: numRec(r.upgrades),
    stock: numRec(r.stock, (k) => !!ITEM_BY_ID[k]),
    loan: Math.max(0, num(r.loan, 0)),
    streak: {
      count: Math.max(0, Math.floor(num(st.count, 0))),
      lastDate: typeof st.lastDate === 'string' ? st.lastDate : null,
    },
    updatedAt: num(r.updatedAt, 0),
  };
}

/** Upgrades older saves to SAVE_VERSION and sanitises. Unknown/future versions return null. */
export function migrate(raw: unknown): GameState | null {
  if (!isObj(raw) || typeof raw.version !== 'number' || !Number.isInteger(raw.version)) return null;
  let cur: Record<string, unknown> = raw;
  let v = raw.version;
  if (v > SAVE_VERSION || v < 1) return null;
  while (v < SAVE_VERSION) {
    const step = migrations[v];
    if (!step) return null;
    try {
      cur = step(cur);
    } catch {
      return null;
    }
    v++;
    if (!isObj(cur) || cur.version !== v) return null;
  }
  return sanitise(cur);
}
