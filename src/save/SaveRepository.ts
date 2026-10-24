// Persistence boundary. LocalSave now; SupabaseSave later behind the same interface.
// Spec: docs/GDD.md §11 (Save, Cloud sync).
import type { GameState } from '../core/economy';

export interface SaveRepository {
  /** null if nothing saved (new player). Runs migrations for older versions. Never throws on corrupt data (returns null and keeps a backup copy). */
  load(): Promise<GameState | null>;
  /** Stamps updatedAt = Date.now() and persists. */
  save(state: GameState): Promise<void>;
  /** Deletes the save (settings → reset). Keeps nothing. */
  clear(): Promise<void>;
}

/** Cloud conflict rule (later sprint): newest updatedAt wins; if both differ by > 1 minute ask the player. */
export function pickNewer(a: GameState | null, b: GameState | null): GameState | null {
  if (!a) return b;
  if (!b) return a;
  return a.updatedAt >= b.updatedAt ? a : b;
}
