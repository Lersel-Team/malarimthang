import type { GameState } from '../core/economy';
import type { SaveRepository } from './SaveRepository';

/** localStorage-backed save under key 'malarimthang_save_v1'. */
export class LocalSave implements SaveRepository {
  constructor(readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = globalThis.localStorage) {}

  async load(): Promise<GameState | null> {
    throw new Error('TODO S3-3');
  }
  async save(_state: GameState): Promise<void> {
    throw new Error('TODO S3-3');
  }
  async clear(): Promise<void> {
    throw new Error('TODO S3-3');
  }
}

/** Upgrades older saves to SAVE_VERSION. Unknown/future versions return null. */
export function migrate(_raw: unknown): GameState | null {
  throw new Error('TODO S3-3');
}
