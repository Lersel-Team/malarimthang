import raw from '../../data/balance.json';

export type Category = 'processed' | 'veg' | 'meat' | 'seafood';

export interface ItemDef {
  id: string;
  th: string;
  cat: Category;
  cost: number;
  price: number;
  sideTime: number;
  window: number;
  fatty: boolean;
  unlockLevel: number;
  unlockCost: number;
  rawIsDangerous?: boolean;
  burstsWhenBurnt?: boolean;
}

export const BALANCE = raw;
export const ITEMS: ItemDef[] = raw.items as ItemDef[];
export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const COOKING = raw.cooking;

export type ArchetypeId = 'student' | 'office' | 'family' | 'tourist' | 'nightowl';

export interface ArchetypeDef {
  th: string;
  size: [number, number];
  maxSpend: number;
  patienceSec: number;
  tipRate: number;
  prefs: Partial<Record<Category, number>>;
  spice: [number, number];
}

export interface LocationDef {
  id: string;
  th: string;
  rent: number;
  customersPerMin: number;
  mix: Partial<Record<ArchetypeId, number>>;
  unlockLevel: number;
  unlockCost: number;
}

export const ARCHETYPES = raw.archetypes as Record<ArchetypeId, ArchetypeDef>;
export const LOCATIONS: LocationDef[] = raw.locations as LocationDef[];
export const SERVICE = raw.service;
export const EAT_IN = raw.eatIn;
export const SHIFT = raw.shift;
export const SPICE = raw.spice;
