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
