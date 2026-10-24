import { describe, expect, it } from 'vitest';
import NAMES from '../data/names.json';
import { rollName } from '../src/core/names';

const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const THAI_ONLY = /^[฀-๿]+$/;

describe('customer names', () => {
  it('every name in every pool is Thai script', () => {
    const all = [...NAMES.thai, ...Object.values(NAMES.foreign).flat()];
    for (const n of all) expect(n).toMatch(THAI_ONLY);
  });

  it('about 10% of locals get a foreign name, tourists mostly foreign', () => {
    const rng = mulberry32(7);
    const share = (arch: 'student' | 'tourist') => {
      let f = 0;
      for (let i = 0; i < 20000; i++) if (rollName(rng, arch).origin !== 'thai') f++;
      return f / 20000;
    };
    expect(share('student')).toBeCloseTo(0.1, 1);
    expect(share('tourist')).toBeCloseTo(0.85, 1);
  });

  it('uses all four foreign pools', () => {
    const rng = mulberry32(3);
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(rollName(rng, 'tourist').origin);
    expect(seen).toEqual(new Set(['thai', 'english', 'mandarin', 'cantonese', 'malay']));
  });
});
