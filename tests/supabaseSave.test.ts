import { describe, it, expect, vi, afterEach } from 'vitest';
import { SupabaseSave } from '../src/save/SupabaseSave';
import type { SaveRepository } from '../src/save/SaveRepository';
import type { GameState } from '../src/core/economy';

const st = (updatedAt: number, day = 1) => ({ version: 1, day, updatedAt }) as unknown as GameState;

function fakeClient(opts: { remote?: GameState | null; delay?: number; failUpsert?: boolean } = {}) {
  const upsert = vi.fn(async () => {
    if (opts.failUpsert) throw new Error('offline');
    return { error: null };
  });
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            new Promise((res) => setTimeout(() => res({ data: opts.remote ? { data: opts.remote } : null, error: null }), opts.delay ?? 0)),
        }),
      }),
      upsert,
    }),
  };
  return { client: client as never, upsert };
}

function fakeLocal(s: GameState | null): SaveRepository & { saved: GameState[] } {
  const saved: GameState[] = [];
  return { saved, load: async () => s, save: async (x) => void saved.push(x), clear: async () => {} };
}

afterEach(() => vi.useRealTimers());

describe('SupabaseSave', () => {
  it('remote newer wins', async () => {
    const { client } = fakeClient({ remote: st(200) });
    expect((await new SupabaseSave(client, fakeLocal(st(100))).load())?.updatedAt).toBe(200);
  });
  it('local newer wins', async () => {
    const { client } = fakeClient({ remote: st(100) });
    expect((await new SupabaseSave(client, fakeLocal(st(300))).load())?.updatedAt).toBe(300);
  });
  it('falls back to local on timeout', async () => {
    const { client } = fakeClient({ remote: st(999), delay: 200 });
    const repo = new SupabaseSave(client, fakeLocal(st(100)), { timeoutMs: 20 });
    expect((await repo.load())?.updatedAt).toBe(100);
  });
  it('debounce batches writes into one upsert with the latest state', async () => {
    vi.useFakeTimers();
    const { client, upsert } = fakeClient();
    const local = fakeLocal(null);
    const repo = new SupabaseSave(client, local, { debounceMs: 15000 });
    await repo.save(st(1, 1));
    await repo.save(st(2, 2));
    await repo.save(st(3, 3));
    expect(local.saved).toHaveLength(3);
    expect(upsert).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15000);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect((upsert.mock.calls[0] as unknown as [{ day: number }])[0].day).toBe(3);
  });
  it('save never throws on remote error', async () => {
    vi.useFakeTimers();
    const { client } = fakeClient({ failUpsert: true });
    const repo = new SupabaseSave(client, fakeLocal(null), { debounceMs: 10 });
    await expect(repo.save(st(1))).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(50);
    await expect(repo.flush()).resolves.toBeUndefined();
  });
});
