import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/balance';

describe('balance data', () => {
  it('has the 4 starter skewers', () => {
    expect(ITEMS.filter((i) => i.unlockLevel === 1)).toHaveLength(4);
  });
});
