import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../src/core/economy';
import { SAVE_VERSION } from '../src/core/economy';
import { ITEMS } from '../src/data/balance';
import { CORRUPT_PREFIX, LocalSave, SAVE_KEY, migrate } from '../src/save/LocalSave';
import { pickNewer } from '../src/save/SaveRepository';

class FakeStorage {
  m = new Map<string, string>();
  failSet = false;
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) {
    if (this.failSet) throw new DOMException('full', 'QuotaExceededError');
    this.m.set(k, v);
  }
  removeItem(k: string) { this.m.delete(k); }
  backups() { return [...this.m.keys()].filter((k) => k.startsWith(CORRUPT_PREFIX)); }
}

const id0 = ITEMS[0].id;
const fx = (o: Partial<GameState> = {}): GameState => ({
  version: SAVE_VERSION, shopName: 'ร้านทดสอบ', day: 3, money: 120, level: 2, xp: 10, rating: 3.5,
  location: 'soi', unlockedItems: [id0], unlockedLocations: ['soi'], upgrades: { fridge: 1 },
  stock: { [id0]: 4 }, loan: 0, streak: { count: 2, lastDate: '2026-01-01' }, updatedAt: 1, ...o,
});
const mk = () => { const s = new FakeStorage(); return { s, ls: new LocalSave(s as unknown as Storage) }; };

afterEach(() => vi.restoreAllMocks());

describe('LocalSave', () => {
  it('returns null for a new player', async () => {
    expect(await mk().ls.load()).toBeNull();
  });
  it('round-trips and stamps updatedAt on a copy', async () => {
    const { ls } = mk();
    vi.spyOn(Date, 'now').mockReturnValue(5555);
    const st = fx();
    await ls.save(st);
    expect(st.updatedAt).toBe(1);
    expect(await ls.load()).toEqual({ ...st, updatedAt: 5555 });
  });
  it('corrupt JSON -> null, backup written, only newest 2 kept', async () => {
    const { s, ls } = mk();
    let t = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => t++);
    for (let i = 0; i < 4; i++) {
      s.setItem(SAVE_KEY, '{bad' + i);
      expect(await ls.load()).toBeNull();
    }
    const b = s.backups();
    expect(b).toHaveLength(2);
    expect(b.map((k) => s.getItem(k)).sort()).toEqual(['{bad2', '{bad3']);
  });
  it('version too new -> null with backup', async () => {
    const { s, ls } = mk();
    s.setItem(SAVE_KEY, JSON.stringify(fx({ version: SAVE_VERSION + 1 })));
    expect(await ls.load()).toBeNull();
    expect(s.backups()).toHaveLength(1);
  });
  it('quota error does not throw', async () => {
    const { s, ls } = mk();
    const w = vi.spyOn(console, 'warn').mockImplementation(() => {});
    s.failSet = true;
    await expect(ls.save(fx())).resolves.toBeUndefined();
    expect(w).toHaveBeenCalled();
  });
  it('clear removes the save', async () => {
    const { ls } = mk();
    await ls.save(fx());
    await ls.clear();
    expect(await ls.load()).toBeNull();
  });
});

describe('migrate', () => {
  it('rejects non-objects and bad versions', () => {
    for (const v of [null, 5, 'x', [], {}, { version: '1' }, { version: 0 }, { version: SAVE_VERSION + 1 }]) {
      expect(migrate(v)).toBeNull();
    }
  });
  it('older version without migration entry -> null', () => {
    // only meaningful when SAVE_VERSION > 1
    if (SAVE_VERSION > 1) expect(migrate({ version: 1 })).toBeNull();
  });
  it('clamps numbers', () => {
    const r = migrate(fx({ money: -5, level: 99, rating: 9, day: 0 }))!;
    expect([r.money, r.level, r.rating, r.day]).toEqual([0, 20, 5, 1]);
    const r2 = migrate(fx({ level: 0, rating: 0 }))!;
    expect([r2.level, r2.rating]).toEqual([1, 1]);
  });
  it('shopName rules', () => {
    expect(migrate(fx({ shopName: '   ' }))!.shopName).toBe('หม่าล่าริมทาง');
    expect(migrate({ ...fx(), shopName: 42 })!.shopName).toBe('หม่าล่าริมทาง');
    expect(migrate(fx({ shopName: '  abc  ' }))!.shopName).toBe('abc');
    expect(migrate(fx({ shopName: 'x'.repeat(40) }))!.shopName).toHaveLength(24);
  });
  it('fills missing arrays/records', () => {
    const r = migrate({ version: SAVE_VERSION })!;
    expect(r.unlockedItems).toEqual([]);
    expect(r.stock).toEqual({});
    expect(r.upgrades).toEqual({});
    expect(r.unlockedLocations).toContain('soi');
    expect(r.streak).toEqual({ count: 0, lastDate: null });
  });
  it('drops unknown item ids and ensures soi', () => {
    const r = migrate(fx({ unlockedItems: [id0, 'nope'], stock: { [id0]: 2, nope: 3 }, unlockedLocations: ['market'] }))!;
    expect(r.unlockedItems).toEqual([id0]);
    expect(r.stock).toEqual({ [id0]: 2 });
    expect(r.unlockedLocations).toEqual(['soi', 'market']);
  });
});

describe('pickNewer', () => {
  it('handles nulls, newer wins, tie keeps a', () => {
    const a = fx({ updatedAt: 10 }), b = fx({ updatedAt: 20 });
    expect(pickNewer(null, null)).toBeNull();
    expect(pickNewer(a, null)).toBe(a);
    expect(pickNewer(null, b)).toBe(b);
    expect(pickNewer(a, b)).toBe(b);
    expect(pickNewer(b, a)).toBe(b);
    const c = fx({ updatedAt: 10 });
    expect(pickNewer(a, c)).toBe(a);
  });
});
