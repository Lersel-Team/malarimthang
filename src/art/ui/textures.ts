// 9-slice-ready SVG textures. Keys are `ui-*`; slice insets are in SLICE below (logical px of the source art).
import type Phaser from 'phaser';
import { loadSvg } from '../svg';
import { ICON_NAMES, iconSvg } from './icons';

const O = '#1b1230';
const OUT = `stroke="${O}" stroke-opacity=".85" stroke-width="1.5"`;
const svg = (w: number, h: number, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
const grad = (id: string, stops: [number, string, number?][], dir: 'v' | 'h' = 'v') =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${dir === 'h' ? 1 : 0}" y2="${dir === 'v' ? 1 : 0}">${stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`)
    .join('')}</linearGradient>`;

/** Slice insets [left,right,top,bottom] for each 9-slice texture, plus source size. */
export const SLICE = {
  'ui-shadow': { w: 64, h: 64, s: [28, 28, 28, 28] },
  'ui-panel-wood': { w: 96, h: 96, s: [24, 24, 24, 24] },
  'ui-panel-glass': { w: 96, h: 96, s: [20, 20, 20, 20] },
  'ui-panel-cream': { w: 96, h: 96, s: [20, 20, 20, 20] },
  'ui-pill': { w: 48, h: 32, s: [15, 15, 15, 15] },
  'ui-bar-track': { w: 32, h: 14, s: [6, 6, 6, 6] },
  'ui-bar-fill': { w: 32, h: 14, s: [6, 6, 6, 6] },
  'ui-btn': { w: 64, h: 52, s: [22, 22, 21, 21] },
} as const;

// ---- shadow (blurred rounded rect with 14 px margin) ----
const shadow = svg(
  64, 64,
  `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4.500"/></filter></defs>
   <rect x="14" y="14" width="36" height="36" rx="12" fill="#0a0612" filter="url(#b)"/>`,
);

// ---- panels ----
const woodPanel = svg(
  96, 96,
  `<defs>${grad('g', [[0, '#a2693a'], [0.5, '#82522c'], [1, '#5c3a20']])}</defs>
   <rect x="1" y="1" width="94" height="94" rx="16" fill="url(#g)" ${OUT}/>
   <rect x="4.500" y="4.500" width="87" height="87" rx="12.500" fill="none" stroke="#3d2412" stroke-opacity=".38" stroke-width="1.200"/>
   <path d="M17 2.600h62" stroke="#ffd9a0" stroke-opacity=".5" stroke-width="1.600" stroke-linecap="round"/>
   <path d="M17 93.400h62" stroke="#2a1608" stroke-opacity=".35" stroke-width="1.400" stroke-linecap="round"/>
   ${[[11, 11], [85, 11], [11, 85], [85, 85]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.300" fill="#3d2412"/><circle cx="${x - 0.6}" cy="${y - 0.7}" r="0.9" fill="#d9a56a"/>`).join('')}`,
);
const glassPanel = svg(
  96, 96,
  `<defs>${grad('g', [[0, '#35275c', 0.94], [1, '#1b1230', 0.96]])}${grad('r', [[0, '#ffb24a', 0.55], [1, '#ffb24a', 0.08]])}</defs>
   <rect x="1" y="1" width="94" height="94" rx="16" fill="url(#g)" ${OUT}/>
   <rect x="2.600" y="2.600" width="90.800" height="90.800" rx="14.500" fill="none" stroke="url(#r)" stroke-width="1.100"/>
   <path d="M17 3.400h62" stroke="#fff" stroke-opacity=".28" stroke-width="1.400" stroke-linecap="round"/>`,
);
const creamPanel = svg(
  96, 96,
  `<defs>${grad('g', [[0, '#fff6df'], [1, '#ecd5a6']])}</defs>
   <rect x="1" y="1" width="94" height="94" rx="16" fill="url(#g)" ${OUT}/>
   <rect x="4" y="4" width="88" height="88" rx="13" fill="none" stroke="#b89560" stroke-opacity=".45" stroke-width="1" stroke-dasharray="3 3"/>
   <path d="M17 2.600h62" stroke="#fff" stroke-opacity=".9" stroke-width="1.600" stroke-linecap="round"/>`,
);

// ---- pills ----
function pill(a: string, b: string, rim = '#ffffff', rimA = 0.32): string {
  return svg(
    48, 32,
    `<defs>${grad('g', [[0, a], [1, b]])}</defs>
     <rect x="1" y="1" width="46" height="30" rx="15" fill="url(#g)" ${OUT}/>
     <path d="M15 3.200h18" stroke="${rim}" stroke-opacity="${rimA}" stroke-width="1.400" stroke-linecap="round"/>`,
  );
}
export const PILL_KINDS = {
  dark: pill('#3a2a5e', '#1e1535'),
  lamp: pill('#ffd27a', '#e8921c', '#fff', 0.6),
  red: pill('#f0523f', '#b01e1e', '#fff', 0.45),
  green: pill('#7fd99a', '#3f9a62', '#fff', 0.5),
  cream: pill('#fff6df', '#e6cf9e', '#fff', 0.9),
} as const;
export type PillKind = keyof typeof PILL_KINDS;

// ---- buttons (52 tall: 48 body + 4 lip when up) ----
function btn(o: { top: string; bot: string; lip: string; rim?: string; gloss?: boolean; down?: boolean; dashed?: boolean; fillA?: number }): string {
  const dy = o.down ? 2 : 0;
  const bodyH = o.down ? 49 : 47;
  return svg(
    64, 52,
    `<defs>${grad('g', [[0, o.top, o.fillA ?? 1], [1, o.bot, o.fillA ?? 1]])}${grad('gl', [[0, '#fff', 0.5], [1, '#fff', 0]])}</defs>
     ${o.lip === 'none' ? '' : `<rect x="1" y="${4.5 - (o.down ? 1.5 : 0)}" width="62" height="${o.down ? 46 : 46.5}" rx="15" fill="${o.lip}" ${OUT}/>`}
     <rect x="1" y="${1 + dy}" width="62" height="${bodyH}" rx="15" fill="url(#g)" ${OUT}${o.dashed ? ' stroke-dasharray="4 3"' : ''}/>
     ${o.rim ? `<rect x="2.600" y="${2.600 + dy}" width="58.800" height="${bodyH - 3.2}" rx="13.500" fill="none" stroke="${o.rim}" stroke-opacity=".5" stroke-width="1"/>` : ''}
     ${o.gloss ? `<path d="M10 ${3.200 + dy}h44a10 10 0 019 7 52 52 0 01-31 6C20 17 8 15 1.500 12.500A10 10 0 0110 ${3.200 + dy}z" fill="url(#gl)" opacity=".62"/><path d="M16 ${3.200 + dy}h32" stroke="#fff" stroke-opacity=".7" stroke-width="1.400" stroke-linecap="round"/>` : ''}`,
  );
}
export const BTN_KINDS = {
  primary: btn({ top: '#ff6a52', bot: '#c92a22', lip: '#7e1814', gloss: true }),
  'primary-down': btn({ top: '#d9402f', bot: '#a8221b', lip: '#7e1814', down: true }),
  secondary: btn({ top: '#5e4590', bot: '#3a2866', lip: '#1e1535', rim: '#ffb24a', gloss: true }),
  'secondary-down': btn({ top: '#4a3578', bot: '#2e1f54', lip: '#1e1535', rim: '#ffb24a', down: true }),
  green: btn({ top: '#7fd99a', bot: '#3f9a62', lip: '#235a3a', gloss: true }),
  'green-down': btn({ top: '#58b878', bot: '#2f7a4c', lip: '#235a3a', down: true }),
  ghost: btn({ top: '#2a1d47', bot: '#2a1d47', lip: 'none', rim: '#f6e7c8', fillA: 0.35, dashed: false }),
  'ghost-down': btn({ top: '#f6e7c8', bot: '#f6e7c8', lip: 'none', rim: '#f6e7c8', fillA: 0.18 }),
  disabled: btn({ top: '#53486a', bot: '#40374f', lip: '#2a2238' }),
} as const;
export type BtnKind = keyof typeof BTN_KINDS;

// ---- bars ----
const barTrack = svg(
  32, 14,
  `<rect x=".75" y=".75" width="30.500" height="12.500" rx="6.250" fill="#10091c" ${OUT}/>
   <path d="M6 2.400h20" stroke="#000" stroke-opacity=".5" stroke-width="1.600" stroke-linecap="round"/>`,
);
function barFill(a: string, b: string): string {
  return svg(
    32, 14,
    `<defs>${grad('g', [[0, a], [1, b]])}</defs>
     <rect x=".75" y=".75" width="30.500" height="12.500" rx="6.250" fill="url(#g)" ${OUT}/>
     <path d="M6 3.200h20" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>`,
  );
}
export const BAR_KINDS = {
  xp: barFill('#ffd27a', '#ee7a1a'),
  green: barFill('#9be8b0', '#3f9a62'),
  red: barFill('#ff7a62', '#b01e1e'),
} as const;
export type BarKind = keyof typeof BAR_KINDS;

// ---- misc sprites ----
const starOff = svg(
  32, 32,
  `<path d="M16 3.200l3.700 7.600 8.300 1.200-6 5.900 1.400 8.300L16 22l-7.400 3.900 1.400-8.300-6-5.900 8.300-1.200z" fill="#2a1d47" stroke="${O}" stroke-opacity=".7" stroke-width="2" stroke-linejoin="round"/>`,
);
const glow = svg(
  128, 128,
  `<defs><radialGradient id="r"><stop offset="0" stop-color="#ffd27a" stop-opacity=".95"/><stop offset=".35" stop-color="#ffb24a" stop-opacity=".45"/><stop offset="1" stop-color="#ff6a2a" stop-opacity="0"/></radialGradient></defs>
   <circle cx="64" cy="64" r="64" fill="url(#r)"/>`,
);
const shine = svg(
  24, 14,
  `<defs>${grad('g', [[0, '#fff', 0], [0.5, '#fff', 0.7], [1, '#fff', 0]], 'h')}</defs><path d="M6 0h18l-6 14H0z" fill="url(#g)"/>`,
);
const spark = svg(
  16, 16,
  `<path d="M8 0c.6 4.500 3 7 8 8-5 1-7.400 3.500-8 8-.6-4.500-3-7-8-8 5-1 7.400-3.500 8-8z" fill="#fff"/>`,
);
const confetti = (c: string) => svg(10, 6, `<rect width="10" height="6" rx="1.200" fill="${c}"/>`);
const tape = svg(
  48, 18,
  `<path d="M0 2l3 2-3 2 3 2-3 2 3 2-3 2v0h48l-3-2 3-2-3-2 3-2-3-2 3-2z" fill="#f2d98a" fill-opacity=".85" stroke="${O}" stroke-opacity=".35" stroke-width="1"/>
   <path d="M6 5h36M6 9h36M6 13h36" stroke="#fff" stroke-opacity=".25" stroke-width="1"/>`,
);
const hole = svg(
  16, 16,
  `<circle cx="8" cy="8" r="5.500" fill="#2a1d47" stroke="${O}" stroke-opacity=".7" stroke-width="1.200"/><circle cx="8" cy="8" r="3.600" fill="#10091c"/>`,
);

const lamp = svg(
  24, 40,
  `<defs><radialGradient id="b" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="#ffc861"/><stop offset="1" stop-color="#ee8a1c"/></radialGradient></defs>
   <path d="M12 0v10" stroke="${O}" stroke-opacity=".8" stroke-width="1.400"/>
   <rect x="8" y="8" width="8" height="7" rx="1.800" fill="#5c3a20" ${OUT}/>
   <circle cx="12" cy="25" r="10.500" fill="url(#b)" ${OUT}/>
   <path d="M6 22a7 7 0 013-5" stroke="#fff" stroke-opacity=".8" stroke-width="1.800" fill="none" stroke-linecap="round"/>`,
);
const bulb = svg(
  14, 22,
  `<defs><radialGradient id="b" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff6c8"/><stop offset=".55" stop-color="#ffc861"/><stop offset="1" stop-color="#ee8a1c"/></radialGradient></defs>
   <rect x="4.500" y="0" width="5" height="5" rx="1.200" fill="#5c3a20" ${OUT}/>
   <circle cx="7" cy="13.500" r="6" fill="url(#b)" ${OUT}/><circle cx="5" cy="11.500" r="1.400" fill="#fff" opacity=".8"/>`,
);

export async function preloadUiTextures(scene: Phaser.Scene): Promise<void> {
  const jobs: Promise<string>[] = [];
  const add = (key: string, s: string, w: number, h: number) => jobs.push(loadSvg(scene, key, s, w, h));
  add('ui-shadow', shadow, 64, 64);
  add('ui-panel-wood', woodPanel, 96, 96);
  add('ui-panel-glass', glassPanel, 96, 96);
  add('ui-panel-cream', creamPanel, 96, 96);
  for (const [k, s] of Object.entries(PILL_KINDS)) add(`ui-pill-${k}`, s, 48, 32);
  for (const [k, s] of Object.entries(BTN_KINDS)) add(`ui-btn-${k}`, s, 64, 52);
  add('ui-bar-track', barTrack, 32, 14);
  for (const [k, s] of Object.entries(BAR_KINDS)) add(`ui-bar-${k}`, s, 32, 14);
  add('ui-star-off', starOff, 32, 32);
  add('ui-glow', glow, 128, 128);
  add('ui-shine', shine, 24, 14);
  add('ui-spark', spark, 16, 16);
  for (const [k, c] of Object.entries({ r: '#d6342b', a: '#ffb24a', g: '#6ec28a', c: '#f6e7c8', p: '#a07ad8' })) add(`ui-confetti-${k}`, confetti(c), 10, 6);
  add('ui-tape', tape, 48, 18);
  add('ui-lamp', lamp, 24, 40);
  add('ui-bulb', bulb, 14, 22);
  add('ui-hole', hole, 16, 16);
  for (const n of ICON_NAMES) add(`ui-ic-${n}`, iconSvg(n), 48, 48);
  await Promise.all(jobs);
}
