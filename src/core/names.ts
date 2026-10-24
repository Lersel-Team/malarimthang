// Customer display names, all in Thai script. ~10% of locals get a foreign name; tourists mostly do.
import NAMES from '../../data/names.json';
import type { ArchetypeId } from '../data/balance';
import type { Rng } from './cooking';

export type NameOrigin = 'thai' | keyof typeof NAMES.foreign;

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

export function rollName(rng: Rng, archetype: ArchetypeId): { name: string; origin: NameOrigin } {
  const foreign = rng() < (archetype === 'tourist' ? NAMES.touristForeignChance : NAMES.foreignChance);
  if (!foreign) return { name: pick(rng, NAMES.thai), origin: 'thai' };
  const origin = pick(rng, Object.keys(NAMES.foreign) as (keyof typeof NAMES.foreign)[]);
  return { name: pick(rng, NAMES.foreign[origin]), origin };
}
