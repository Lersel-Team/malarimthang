import { LocalSave } from './LocalSave';
import type { SaveRepository } from './SaveRepository';

export type { SaveRepository } from './SaveRepository';
export { pickNewer } from './SaveRepository';
export { LocalSave, migrate } from './LocalSave';

/** The later Supabase layer will wrap this. */
export function createSaveRepository(): SaveRepository {
  return new LocalSave();
}
