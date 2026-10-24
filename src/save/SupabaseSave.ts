// SaveRepository that mirrors LocalSave to Supabase (table `saves`). Local is always the source of truth offline.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameState } from '../core/economy';
import { pickNewer, type SaveRepository } from './SaveRepository';

export const REMOTE_TIMEOUT_MS = 6000;
export const SYNC_DEBOUNCE_MS = 15000;

export class SupabaseSave implements SaveRepository {
  private pending: GameState | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly client: SupabaseClient,
    private readonly local: SaveRepository,
    private readonly opts: { timeoutMs?: number; debounceMs?: number } = {},
  ) {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void this.flush();
      });
    }
    if (typeof window !== 'undefined') window.addEventListener('pagehide', () => void this.flush());
  }

  async load(): Promise<GameState | null> {
    let local: GameState | null = null;
    try {
      local = await this.local.load();
    } catch {
      local = null;
    }
    const remote = await this.fetchRemote();
    return pickNewer(local, remote);
  }

  async save(state: GameState): Promise<void> {
    try {
      await this.local.save(state);
    } catch {
      /* local failure must not break the game */
    }
    this.pending = state;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.opts.debounceMs ?? SYNC_DEBOUNCE_MS);
  }

  async clear(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    try {
      await this.local.clear();
    } catch {
      /* ignore */
    }
    try {
      const uid = await this.userId();
      if (uid) await this.client.from('saves').delete().eq('user_id', uid);
    } catch {
      /* offline: ignore */
    }
  }

  /** Pushes the latest pending state now. Never throws. */
  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const state = this.pending;
    if (!state) return;
    this.pending = null;
    try {
      const uid = await this.userId();
      if (!uid) return;
      await this.client
        .from('saves')
        .upsert({ user_id: uid, data: state, version: state.version, day: state.day, updated_at: new Date(state.updatedAt).toISOString() });
    } catch {
      /* offline: next save retries */
    }
  }

  private async userId(): Promise<string | null> {
    const { data } = await this.client.auth.getSession();
    return data.session?.user?.id ?? null;
  }

  private async fetchRemote(): Promise<GameState | null> {
    const work = (async () => {
      const uid = await this.userId();
      if (!uid) return null;
      const { data, error } = await this.client.from('saves').select('data').eq('user_id', uid).maybeSingle();
      if (error || !data) return null;
      return (data as { data: GameState }).data ?? null;
    })().catch(() => null);
    let t: ReturnType<typeof setTimeout>;
    const timeout = new Promise<null>((res) => {
      t = setTimeout(() => res(null), this.opts.timeoutMs ?? REMOTE_TIMEOUT_MS);
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(t!);
    }
  }
}
