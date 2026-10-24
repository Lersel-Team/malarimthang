// Tiny in-memory holder for the running game: current state, save repository, hand-offs between scenes.
import type { DaySummary, GameState, ShiftResult } from './core/economy';
import { createSaveRepository, type SaveRepository } from './save';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const DEFAULT_SHOP_NAME = 'หม่าล่าริมทาง';

class Session {
  state: GameState | null = null;
  repo: SaveRepository | null = null;
  soldYesterday: Record<string, number> = {};
  lastSummary: DaySummary | null = null;
  /** Finished shift waiting for the summary screen (cleared once endDay has been applied). */
  pendingResult: ShiftResult | null = null;
  /** Rating the shop had before the day ended (for the summary). */
  ratingBefore = 3;
  private loaded = false;

  private getRepo(): SaveRepository | null {
    if (!this.repo) {
      try {
        this.repo = createSaveRepository();
      } catch {
        this.repo = null;
      }
    }
    return this.repo;
  }

  /** Loads the save once. Never throws; null = new player. */
  async init(): Promise<GameState | null> {
    if (this.loaded) return this.state;
    this.loaded = true;
    try {
      const s = await this.getRepo()?.load();
      if (s) this.state = s;
    } catch {
      /* corrupt or unavailable save: start fresh */
    }
    return this.state;
  }

  get s(): GameState {
    if (!this.state) throw new Error('no game state');
    return this.state;
  }

  /** Updates the state and autosaves; save errors never block play. */
  async commit(state: GameState): Promise<void> {
    this.state = state;
    try {
      await this.getRepo()?.save(state);
    } catch {
      /* ignore */
    }
  }
}

export const session = new Session();
