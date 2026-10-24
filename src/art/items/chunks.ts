// One parameterised SVG per item -> 5 cook stages + oil + glaze overlays, built as one sheet.
// Chunk cell: viewBox 48x32, displayed 40x26.67 logical. Key light top-left, warm rim bottom-right.
import { PALETTE, OUTLINE } from '../palette';

export type Stage = 'raw' | 'almost' | 'perfect' | 'charred' | 'burnt';
export const STAGES: Stage[] = ['raw', 'almost', 'perfect', 'charred', 'burnt'];
export const CELL_W = 48;
export const CELL_H = 32;
/** Logical display size of one chunk. */
export const CHUNK_W = 40;
export const CHUNK_H = (CELL_H / CELL_W) * CHUNK_W;

const NIGHT = PALETTE.night.css;
const LAMP = PALETTE.lamp.css;

export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

interface Part {
  tag: string;
  fill: string;
  /** Cook tint strength multiplier (0 = never changes colour). */
  k: number;
}
const P = (tag: string, fill: string, k = 1): Part => ({ tag, fill, k });

interface Ctx {
  t: (hex: string, k?: number) => string;
  stage: Stage;
  /** deterministic random 0..1 */
  rnd: () => number;
}

interface Art {
  parts: Part[];
  /** Colour the item turns toward when perfectly cooked. */
  gold: string;
  /** Tint strength at perfect (default .5). */
  kp?: number;
  /** Surface details drawn inside the silhouette. */
  details: (c: Ctx) => string;
  /** Highlight ellipse [cx, cy, rx, ry]. */
  hl?: [number, number, number, number];
  /** Skip diagonal grill marks (shellfish etc. still get them if undefined). */
  marks?: boolean;
}

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dots = (c: Ctx, n: number, x0: number, x1: number, y0: number, y1: number, r0: number, r1: number, fill: string, op = 1) => {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + c.rnd() * (x1 - x0), y = y0 + c.rnd() * (y1 - y0), r = r0 + c.rnd() * (r1 - r0);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${fill}" opacity="${op}"/>`;
  }
  return s;
};

const ART: Record<string, Art> = {
  fishball: {
    parts: [P('circle cx="24" cy="16" r="13"', '#dcd4c6')],
    gold: '#c98a3c',
    hl: [19, 10, 5, 3.2],
    details: (c) =>
      dots(c, 16, 12, 36, 5, 27, 0.5, 1.1, c.t('#a89a86'), 0.55) +
      `<path d="M11,20 Q24,28 37,18" stroke="${c.t('#b9ab97')}" stroke-width="1" fill="none" opacity=".5"/>`,
  },
  crabstick: {
    parts: [P('rect x="4" y="9" width="40" height="14" rx="7"', '#f4eee4')],
    gold: '#d9a050',
    hl: [17, 12, 8, 2],
    details: (c) => {
      let s = `<path d="M0,0H48V15 Q38,18 28,15 T10,16 T0,15Z" fill="${c.t('#ee5538', 0.7)}"/>`;
      for (let i = 0; i < 5; i++) s += `<path d="M6,${11 + i * 2.6} Q24,${10 + i * 2.6} 42,${11.4 + i * 2.6}" stroke="${c.t('#d9cdbd')}" stroke-width=".6" fill="none" opacity=".8"/>`;
      s += `<path d="M6,13 Q24,11.5 42,13" stroke="${c.t('#c43a22')}" stroke-width=".7" fill="none" opacity=".6"/>`;
      return s;
    },
  },
  enoki: {
    parts: [
      P('rect x="10" y="9" width="32" height="14" rx="6"', '#f1e6c6'),
      P('circle cx="8.5" cy="11.5" r="5"', '#d9c28e'),
      P('circle cx="7" cy="17" r="5.5"', '#d3b983'),
      P('circle cx="9" cy="22.5" r="4.6"', '#dcc690'),
    ],
    gold: '#d8b060',
    hl: [26, 11.5, 8, 1.8],
    details: (c) => {
      let s = '';
      for (let i = 0; i < 6; i++) s += `<path d="M12,${10.5 + i * 2.3} H42" stroke="${c.t('#cbbb92')}" stroke-width=".7" opacity=".8"/>`;
      s += `<circle cx="7.5" cy="11" r="1.6" fill="${c.t('#f3e6b8')}"/><circle cx="6" cy="17" r="1.8" fill="${c.t('#f0e0ae')}"/><circle cx="8" cy="22.5" r="1.5" fill="${c.t('#f3e6b8')}"/>`;
      s += `<rect x="28" y="7" width="4.5" height="18" rx="1.5" fill="${c.t('#8a6a3a', 0.5)}"/><path d="M28.5,10 H32 M28.5,14 H32 M28.5,18 H32 M28.5,22 H32" stroke="${NIGHT}" stroke-width=".6" opacity=".5"/>`;
      return s;
    },
  },
  porkbelly: {
    parts: [P('rect x="4" y="5" width="40" height="22" rx="5"', '#f6e6e2')],
    gold: '#d89a58',
    kp: 0.55,
    hl: [14, 8, 7, 1.8],
    details: (c) =>
      `<path d="M0,0H48V10 Q36,12.5 24,10 T0,11Z" fill="${c.t('#c89260')}"/>` +
      `<path d="M0,13 Q12,11 24,13 T48,13 V17.5 Q36,19.5 24,17.5 T0,17.5Z" fill="${c.t('#d9707a')}"/>` +
      `<path d="M0,22 Q12,20 24,22 T48,22 V32 H0Z" fill="${c.t('#d2646f')}"/>` +
      `<path d="M0,10.5 Q24,13 48,10.5" stroke="${c.t('#8a5a30')}" stroke-width=".7" fill="none" opacity=".6"/>` +
      dots(c, 8, 6, 42, 6, 9, 0.5, 0.8, c.t('#9a6a40'), 0.6),
  },
  sausage: {
    parts: [P('path d="M10,8 Q24,5 38,8 Q46,10 46,16 Q46,22 38,24 Q24,27 10,24 Q2,22 2,16 Q2,10 10,8Z"', '#c24c3c')],
    gold: '#8e3220',
    hl: [17, 10.5, 10, 2],
    details: (c) => {
      let s = '';
      for (const x of [13, 22, 31]) {
        s += `<path d="M${x},7 L${x + 6},26" stroke="${c.t('#6a2018')}" stroke-width="1.6"/>`;
        s += `<path d="M${x + 1.4},7 L${x + 7.4},26" stroke="${c.t('#f0a888')}" stroke-width=".7" opacity=".6"/>`;
      }
      s += `<path d="M4,19 Q24,27 44,19" stroke="${c.t('#8a2a20')}" stroke-width="1" fill="none" opacity=".4"/>`;
      return s;
    },
  },
  tofu: {
    parts: [P('rect x="6" y="6" width="36" height="21" rx="4"', '#f2e8cb')],
    gold: '#e0a850',
    hl: [16, 9, 8, 1.8],
    details: (c) =>
      `<rect x="0" y="0" width="48" height="12" fill="#fff" opacity=".38"/>` +
      `<path d="M0,12 H48" stroke="${c.t('#cdbd94')}" stroke-width=".8" opacity=".7"/>` +
      `<rect x="0" y="23" width="48" height="10" fill="${c.t('#c9b88c')}" opacity=".45"/>` +
      dots(c, 14, 8, 40, 8, 25, 0.6, 1.3, c.t('#c7b68a'), 0.7),
  },
  babycorn: {
    parts: [P('path d="M3,16 Q9,8 24,8 Q39,8 45,16 Q39,24 24,24 Q9,24 3,16Z"', '#f7dd7e')],
    gold: '#e0a030',
    hl: [17, 11, 9, 1.8],
    details: (c) => {
      let s = '';
      for (let r = 0; r < 4; r++)
        for (let i = 0; i < 9; i++) {
          const cx = 8 + i * 4.3 + (r % 2) * 2.1, cy = 11.2 + r * 3.7;
          s += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="2" ry="1.7" fill="${c.t('#ffec9c')}" stroke="${c.t('#d6aa2e')}" stroke-width=".55"/>`;
        }
      s += `<path d="M0,16 Q4,16 8,16" stroke="${c.t('#d6aa2e')}" stroke-width=".6"/>`;
      return s;
    },
  },
  chicken: {
    parts: [P('path d="M7,18 Q4,9 15,7 Q24,4 33,7 Q44,9 42,19 Q40,27 28,26 Q17,28 7,18Z"', '#f2cba8')],
    gold: '#c8803a',
    kp: 0.6,
    hl: [16, 10, 7, 3],
    details: (c) =>
      dots(c, 26, 9, 40, 8, 25, 0.45, 0.95, c.t('#d6a07a'), 0.8) +
      `<path d="M30,10 Q38,12 39,19" stroke="${c.t('#fff4e4')}" stroke-width="2.4" fill="none" opacity=".6"/>` +
      `<path d="M9,20 Q22,29 40,21 L42,28 H6Z" fill="${c.t('#b27a50')}" opacity=".3"/>`,
  },
  quailegg: {
    parts: [P('ellipse cx="24" cy="16" rx="14.5" ry="12"', '#ece1c8')],
    gold: '#c89a50',
    hl: [17, 9.5, 5.5, 3],
    details: (c) =>
      dots(c, 22, 10, 38, 5, 27, 0.5, 1.5, c.t('#7a5636'), 0.85) +
      dots(c, 8, 10, 38, 5, 27, 1.6, 2.4, c.t('#c8aa7c'), 0.6),
  },
  cheeseball: {
    parts: [P('circle cx="23" cy="16" r="13"', '#e2b56c'), P('path d="M30,17 Q43,17 44,25 Q41,30 35,27 Q30,25 30,17Z"', '#ffd23a', 0.35)],
    gold: '#b8742a',
    hl: [17, 9.5, 5, 2.8],
    details: (c) =>
      dots(c, 26, 11, 36, 5, 27, 0.5, 1.1, c.t('#b87a34'), 0.8) +
      dots(c, 14, 11, 36, 5, 27, 0.5, 1, c.t('#f4d896'), 0.8) +
      `<path d="M27,10 Q38,9 39,17 Q37,24 28,23 Q22,17 27,10Z" fill="${c.t('#ffd23a', 0.35)}" stroke="${c.t('#c08a14', 0.4)}" stroke-width=".8"/>` +
      `<path d="M29,13 Q34,12 36,16" stroke="#fff6bc" stroke-width="1.3" fill="none" opacity=".8"/>` +
      `<path d="M38,22 Q40,27 37,29" stroke="${c.t('#ffd23a', 0.35)}" stroke-width="1.4" fill="none"/>`,
  },
  kingoyster: {
    parts: [P('rect x="7" y="8" width="37" height="17" rx="6"', '#ece0c6'), P('path d="M3,16 Q3,5 16,6 L18,27 Q3,27 3,16Z"', '#b99872')],
    gold: '#d0a060',
    hl: [26, 11, 9, 1.8],
    details: (c) => {
      let s = '';
      for (let i = 0; i < 5; i++) s += `<path d="M18,${10 + i * 3.2} H44" stroke="${c.t('#cbb894')}" stroke-width=".7" opacity=".8"/>`;
      for (let i = 0; i < 5; i++) s += `<path d="M${6 + i * 2.4},9 Q${7 + i * 2.4},16 ${6 + i * 2.4},24" stroke="${c.t('#8a6c48')}" stroke-width=".6" fill="none" opacity=".6"/>`;
      s += `<path d="M18,6 L18,27" stroke="${c.t('#7a5c3a')}" stroke-width="1" opacity=".6"/>`;
      return s;
    },
  },
  squid: {
    parts: [P('path d="M5,10 Q12,5 24,7 Q38,5 43,11 Q45,19 40,24 Q26,28 10,25 Q3,20 5,10Z"', '#f4e0dc')],
    gold: '#e0a070',
    kp: 0.55,
    hl: [15, 10, 7, 2.2],
    details: (c) => {
      let s = `<path d="M0,0H48V12 Q24,14 0,12Z" fill="${c.t('#c88aa0')}" opacity=".5"/>`;
      s += dots(c, 14, 6, 42, 6, 12, 0.4, 0.8, c.t('#9a5a78'), 0.7);
      for (let i = -3; i < 12; i++) {
        s += `<path d="M${i * 5},4 L${i * 5 + 22},34" stroke="${c.t('#b98e96')}" stroke-width=".9" opacity=".7"/>`;
        s += `<path d="M${i * 5 + 24},4 L${i * 5 + 2},34" stroke="${c.t('#b98e96')}" stroke-width=".9" opacity=".7"/>`;
      }
      return s;
    },
  },
  beef: {
    parts: [P('path d="M6,10 Q8,5 18,6 L36,5 Q43,7 42,14 L43,21 Q40,27 30,26 L14,27 Q5,25 6,18Z"', '#b23a44')],
    gold: '#7a3a20',
    kp: 0.6,
    hl: [16, 9.5, 7, 2],
    details: (c) => {
      let s = '';
      for (let i = 0; i < 5; i++) s += `<path d="M${6 + i * 8},8 Q${10 + i * 8},16 ${6 + i * 8},26" stroke="${c.t('#862230')}" stroke-width=".9" fill="none" opacity=".65"/>`;
      s += `<path d="M10,24 Q24,28 40,23" stroke="${c.t('#f3d8cf')}" stroke-width="2.2" fill="none" opacity=".85"/>`;
      s += `<path d="M14,13 q4,-2 7,1 M27,16 q4,-2 8,0" stroke="${c.t('#f2d0c8')}" stroke-width="1" fill="none" opacity=".8"/>`;
      return s;
    },
  },
  shrimp: {
    parts: [
      P('path d="M5,18 C5,8 17,4 27,6 C38,8 45,16 40,25 L35,22 C36,18 33,15.5 27,15 C21,15 17,17 15,22 Z"', '#e8b4a6'),
      P('path d="M38,22 L46,26 L45,30 L37,29 L34,22Z"', '#eb8a68', 0.8),
      P('path d="M5,18 L2,22 L8,22Z"', '#d9a090'),
    ],
    gold: '#f0783c',
    kp: 0.75,
    hl: [18, 8, 8, 1.8],
    details: (c) => {
      let s = '';
      const segs: [number, number, number, number][] = [[10, 7, 12, 13], [16, 5.2, 17, 12], [22, 5, 22, 11.5], [28, 6.2, 27, 12], [34, 9, 31, 14], [38, 14, 33, 18]];
      for (const [x1, y1, x2, y2] of segs) s += `<path d="M${x1},${y1} L${x2},${y2}" stroke="${c.t('#c4806a')}" stroke-width="1" opacity=".75"/>`;
      s += `<circle cx="9" cy="14" r="1" fill="${NIGHT}"/>`;
      s += `<path d="M5,18 Q1,14 -1,9" stroke="${c.t('#d9a090')}" stroke-width=".7" fill="none"/>`;
      s += `<path d="M42,27 L44,23 M40,28 L41,24" stroke="${c.t('#c8583a')}" stroke-width=".6"/>`;
      return s;
    },
  },
  lamb: {
    parts: [P('path d="M5,14 Q6,6 16,6 Q26,3 36,7 Q44,9 43,17 Q44,25 32,26 Q22,28 12,26 Q4,23 5,14Z"', '#c07468')],
    gold: '#8a4a2a',
    kp: 0.6,
    hl: [18, 11, 7, 2.2],
    details: (c) => {
      let s = `<path d="M0,0H48V9 Q36,12 26,9 T12,11 T0,10Z" fill="${c.t('#f6e8dc')}" opacity=".95"/>`;
      s += `<path d="M5,10 Q20,13 40,9" stroke="${c.t('#b8a090')}" stroke-width=".6" fill="none" opacity=".6"/>`;
      for (let i = 0; i < 4; i++) s += `<path d="M${8 + i * 9},14 Q${12 + i * 9},20 ${8 + i * 9},27" stroke="${c.t('#8e4a40')}" stroke-width=".9" fill="none" opacity=".6"/>`;
      s += dots(c, 22, 8, 42, 13, 26, 0.4, 0.9, c.t('#6a3a1e'), 0.8);
      return s;
    },
  },
  scallop: {
    parts: [
      P('path d="M24,28 L6,22 Q4,13 11,10 Q14,5 19,7 Q24,2 29,7 Q34,5 37,10 Q44,13 42,22 Z"', '#efb99c'),
      P('ellipse cx="24" cy="17" rx="11" ry="7.5"', '#f8f0dc', 1.2),
    ],
    gold: '#e8b868',
    kp: 0.55,
    hl: [20, 14, 5, 2.2],
    details: (c) => {
      let s = '';
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + 0.22 + (i * (Math.PI - 0.44)) / 8;
        s += `<path d="M24,28 L${(24 + Math.cos(a) * 22).toFixed(1)},${(28 + Math.sin(a) * 26).toFixed(1)}" stroke="${c.t('#c4806a')}" stroke-width=".8" opacity=".7"/>`;
      }
      s += `<path d="M17,26 H31" stroke="${c.t('#d9a080')}" stroke-width="3"/>`;
      s += `<path d="M14,18 Q24,12 34,18" stroke="${c.t('#e2d4b6')}" stroke-width=".7" fill="none"/>`;
      return s;
    },
  },
  wagyu: {
    parts: [P('path d="M5,10 Q6,5 14,6 L36,5 Q43,6 43,13 L43,21 Q42,27 34,26 L12,27 Q5,26 5,19Z"', '#d0606f')],
    gold: '#8a4a34',
    kp: 0.6,
    hl: [15, 9.5, 7, 2.2],
    details: (c) => {
      const w = c.t('#ffeee8', 0.5);
      let s = '';
      const m = [
        'M6,12 Q14,9 20,14 T34,12 T44,15',
        'M6,18 Q12,22 20,18 T32,21 T44,19',
        'M10,7 Q15,13 12,19 T16,27',
        'M26,6 Q30,12 27,17 T33,26',
        'M38,8 Q35,14 39,19 T36,26',
      ];
      m.forEach((d, i) => (s += `<path d="${d}" stroke="${w}" stroke-width="${i < 2 ? 1.7 : 1.2}" fill="none" opacity=".88" stroke-linecap="round"/>`));
      s += `<path d="M18,13 Q22,11 25,14 M30,22 Q34,20 37,23" stroke="${w}" stroke-width=".8" fill="none" opacity=".8"/>`;
      return s;
    },
  },
  friedtofu: {
    parts: [P('path d="M5,16 Q5,6 15,6 L35,6 Q43,6 43,16 Q43,26 34,27 L14,27 Q5,26 5,16Z"', '#e2a448')],
    gold: '#b87420',
    hl: [16, 10, 8, 2.4],
    details: (c) =>
      `<path d="M33,6 L44,9 L44,23 L34,27Z" fill="${c.t('#f8e8bc', 0.4)}"/>` +
      dots(c, 7, 35, 42, 10, 24, 0.5, 1.3, c.t('#d8bc80', 0.4), 0.9) +
      dots(c, 18, 8, 32, 8, 25, 0.7, 1.7, c.t('#bc7c2c'), 0.7) +
      dots(c, 12, 8, 32, 8, 25, 0.5, 1.2, c.t('#f0c070'), 0.8) +
      `<path d="M33,6 L34,27" stroke="${c.t('#a8681c')}" stroke-width=".8" opacity=".7"/>`,
  },
  nugget: {
    parts: [P('path d="M7,15 Q6,7 16,6 Q26,4 35,7 Q44,9 42,18 Q41,26 30,26 Q18,28 10,23 Q7,20 7,15Z"', '#dcae66')],
    gold: '#b0701f',
    hl: [16, 9.5, 7, 2.4],
    details: (c) =>
      dots(c, 34, 9, 40, 7, 25, 0.5, 1.2, c.t('#f2d08e'), 0.9) +
      dots(c, 26, 9, 40, 7, 25, 0.4, 1.1, c.t('#9a6226'), 0.8) +
      `<path d="M34,19 Q38,16 42,19 L40,26 L33,25Z" fill="${c.t('#f6e8cf', 0.3)}"/>` +
      `<path d="M34,19 q2,-2 4,0 q2,-2 4,0" stroke="${c.t('#c8a870', 0.5)}" stroke-width=".7" fill="none"/>`,
  },
  sweetpotato: {
    parts: [P('path d="M5,14 Q5,7 14,7 L34,7 Q43,7 43,14 Q43,22 34,25 L14,25 Q5,23 5,14Z"', '#f2a44a')],
    gold: '#c4721c',
    hl: [16, 10, 8, 2],
    details: (c) => {
      let s = `<path d="M0,21 Q24,17 48,21 V32 H0Z" fill="${c.t('#7c3d6b', 0.5)}"/>`;
      s += `<path d="M0,21 Q24,17 48,21" stroke="${c.t('#4a1e48', 0.5)}" stroke-width=".8" fill="none"/>`;
      for (let i = 0; i < 6; i++) s += `<path d="M7,${9 + i * 2} Q24,${8 + i * 2} 42,${9.5 + i * 2}" stroke="${c.t('#d8802a')}" stroke-width=".6" opacity=".7" fill="none"/>`;
      s += dots(c, 6, 9, 40, 9, 17, 0.7, 1.4, c.t('#ffd28a'), 0.7);
      return s;
    },
  },
  chickenwing: {
    parts: [
      P('rect x="3" y="13" width="12" height="6" rx="3"', '#f5efe2', 0.3),
      P('circle cx="3.6" cy="12.6" r="2.8"', '#f5efe2', 0.3),
      P('circle cx="3.6" cy="19.4" r="2.8"', '#f5efe2', 0.3),
      P('path d="M12,16 Q14,5 29,7 Q44,9 44,18 Q42,27 28,26 Q15,27 12,16Z"', '#eab984'),
    ],
    gold: '#b8691f',
    kp: 0.65,
    hl: [26, 10, 8, 2.6],
    details: (c) =>
      dots(c, 26, 16, 42, 8, 25, 0.4, 0.9, c.t('#c88a52'), 0.85) +
      `<path d="M14,17 Q22,8 38,10" stroke="${c.t('#fff0d8')}" stroke-width="1.6" fill="none" opacity=".5"/>` +
      `<path d="M16,22 Q28,29 42,22 L44,28 H14Z" fill="${c.t('#9a5a2a')}" opacity=".3"/>`,
  },
  tempurashrimp: {
    parts: [
      P('path d="M38,17 L47,12 L46.5,17 L47,22 L38,19Z"', '#ef5a30', 0.7),
      P('path d="M8,18 Q3,13 9,10 Q8,5 14,7 Q17,3 22,6 Q27,3 31,7 Q37,5 38,10 Q43,12 40,17 Q43,22 38,24 Q36,29 30,26 Q25,30 20,26 Q14,29 12,24 Q6,24 8,18Z"', '#e6c284'),
    ],
    gold: '#c47a22',
    kp: 0.6,
    hl: [17, 10, 7, 2.4],
    details: (c) =>
      dots(c, 28, 8, 40, 7, 26, 0.5, 1.4, c.t('#f6dca0'), 0.9) +
      dots(c, 20, 8, 40, 7, 26, 0.4, 1.0, c.t('#a8702c'), 0.75) +
      `<path d="M30,13 Q36,15 37,20" stroke="${c.t('#f3b090', 0.6)}" stroke-width="2.4" fill="none" opacity=".5"/>` +
      `<path d="M40,15 L45,13.5 M40,20 L45,21" stroke="${c.t('#b83a1c')}" stroke-width=".6"/>`,
  },
};

export const ITEM_IDS = Object.keys(ART);

interface StageSpec {
  k: (a: Art) => number;
  target: (a: Art) => string;
  marks: number;
  hl: number;
  blot: number;
  cracks: boolean;
}
const SPEC: Record<Stage, StageSpec> = {
  raw: { k: () => 0, target: () => '#ffffff', marks: 0, hl: 0.5, blot: 0, cracks: false },
  almost: { k: () => 0.14, target: () => '#ffe3a8', marks: 0.1, hl: 0.5, blot: 0, cracks: false },
  perfect: { k: (a) => a.kp ?? 0.5, target: (a) => a.gold, marks: 0.55, hl: 0.62, blot: 0, cracks: false },
  charred: { k: () => 0.8, target: () => '#2e1608', marks: 0.8, hl: 0.12, blot: 0.55, cracks: false },
  burnt: { k: () => 0.96, target: () => '#0c0909', marks: 0, hl: 0.06, blot: 0.5, cracks: true },
};

function partsSvg(parts: Part[], fill: (p: Part) => string, extra = ''): string {
  return parts.map((p) => `<${p.tag} fill="${fill(p)}"${extra}/>`).join('');
}

/** Cell index inside the sheet. */
const OIL = 5;
export const SHEET_CELLS = 7;

function cell(art: Art, idx: number, seed: number): string {
  const rnd = mulberry(seed);
  const oi = `c${seed}_${idx}`;
  const parts = art.parts;
  let body = '';
  const clip = `<clipPath id="${oi}k">${parts.map((p) => `<${p.tag}/>`).join('')}</clipPath>`;
  const shadow = `<g transform="translate(1.6 2.2)" opacity=".28">${partsSvg(parts, () => NIGHT, ` stroke="${NIGHT}" stroke-width="3.4"`)}</g>`;
  const outline = partsSvg(parts, () => NIGHT, ` stroke="${NIGHT}" stroke-opacity="${OUTLINE.alpha}" stroke-width="3.4" stroke-linejoin="round"`);
  const shade =
    `<linearGradient id="${oi}s" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="${NIGHT}" stop-opacity=".42"/></linearGradient>`;
  if (idx < 5) {
    const stage = STAGES[idx];
    const sp = SPEC[stage];
    const k = sp.k(art), tgt = sp.target(art);
    const t = (hex: string, kk = 1) => mixHex(hex, tgt, Math.min(1, k * kk));
    const ctx: Ctx = { t, stage, rnd };
    const fills = partsSvg(parts, (p) => t(p.fill, p.k));
    let inner = art.details(ctx);
    inner += `<rect width="48" height="32" fill="url(#${oi}s)"/>`;
    // grill marks
    if (sp.marks > 0) {
      const col = stage === 'perfect' ? '#6a3412' : '#25110a';
      let m = '';
      for (let y = 2; y < 40; y += 6.5) m += `<path d="M-10,${y} H60" stroke="${col}" stroke-width="2.3" stroke-linecap="round"/>`;
      inner += `<g transform="rotate(-32 24 16)" opacity="${sp.marks}">${m}</g>`;
    }
    if (sp.blot > 0) {
      for (let i = 0; i < 5; i++) {
        inner += `<ellipse cx="${(8 + rnd() * 32).toFixed(1)}" cy="${(7 + rnd() * 18).toFixed(1)}" rx="${(2 + rnd() * 4).toFixed(1)}" ry="${(1.5 + rnd() * 3).toFixed(1)}" fill="#120805" opacity="${sp.blot}"/>`;
      }
    }
    if (sp.cracks) {
      const cr = ['M9,13 L15,16 L13,21 L18,24', 'M26,8 L29,14 L35,13 L37,19', 'M19,20 L26,18 L31,24', 'M38,10 L41,15'];
      inner += `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${cr.map((d) => `<path d="${d}" stroke="#ff4a14" stroke-width="2.2" opacity=".28"/><path d="${d}" stroke="#ffa030" stroke-width=".95"/>`).join('')}</g>`;
    }
    if (art.hl && sp.hl > 0) {
      const [cx, cy, rx, ry] = art.hl;
      inner += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${sp.hl}" transform="rotate(-14 ${cx} ${cy})"/>`;
      if (stage === 'perfect') inner += `<ellipse cx="${cx + rx * 1.6}" cy="${cy + 2}" rx="1.6" ry=".9" fill="#fff" opacity=".7"/>`;
    }
    // warm rim (stall light) on the lower-right edge
    inner += `<mask id="${oi}m"><rect width="48" height="32" fill="#fff"/><g transform="translate(-1.7 -2)">${parts.map((p) => `<${p.tag} fill="#000"/>`).join('')}</g></mask><rect width="48" height="32" fill="${stage === 'burnt' ? '#ff6a2a' : LAMP}" opacity=".6" mask="url(#${oi}m)"/>`;
    body = `${clip}${shade}${shadow}${outline}${fills}<g clip-path="url(#${oi}k)">${inner}</g>`;
  } else if (idx === OIL) {
    const inner =
      `<rect width="48" height="32" fill="#fff" opacity=".13"/>` +
      `<path d="M10,11 Q20,6 30,9" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".75"/>` +
      `<path d="M30,21 Q36,21 40,17" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".55"/>` +
      `<ellipse cx="14" cy="17" rx="2" ry="1" fill="#fff" opacity=".7"/>` +
      `<path d="M8,14 Q12,20 18,22" stroke="#ffe27a" stroke-width="1" fill="none" opacity=".5"/>`;
    body = `${clip}<g clip-path="url(#${oi}k)">${inner}</g>`;
  } else {
    const inner =
      `<rect width="48" height="32" fill="#fff" opacity=".93"/>` +
      `<path d="M4,8 Q24,2 44,8" stroke="#000" stroke-width="4" fill="none" opacity=".12"/>` +
      `<path d="M6,26 Q24,34 46,26" stroke="#000" stroke-width="5" fill="none" opacity=".25"/>` +
      `<path d="M12,10 Q22,7 32,10" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".6"/>` +
      `<path d="M10,14 L12,22 M20,12 L22,24 M30,13 L32,21 M38,14 L40,23" stroke="#000" stroke-width="1.3" opacity=".22"/>` +
      `<ellipse cx="34" cy="12" rx="2.2" ry="1.1" fill="#fff" opacity=".8"/>`;
    body = `${clip}<g clip-path="url(#${oi}k)">${inner}</g>`;
  }
  return `<g transform="translate(${idx * CELL_W} 0)">${body}</g>`;
}

/** One sheet (raw..burnt, oil, glaze) for an item. Logical size (CELL_W*7) x CELL_H. */
export function itemSheetSvg(id: string): string {
  const art = ART[id];
  let seed = 7;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CELL_W * SHEET_CELLS} ${CELL_H}" width="${CELL_W * SHEET_CELLS}" height="${CELL_H}">`;
  for (let i = 0; i < SHEET_CELLS; i++) s += cell(art, i, seed);
  return s + '</svg>';
}

export const itemKey = (id: string, stage: Stage | 'oil' | 'glaze') => (stage === 'oil' || stage === 'glaze' ? `fx-${stage}-${id}` : `item-${id}-${stage}`);
