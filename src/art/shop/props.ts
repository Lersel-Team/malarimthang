// Props and ambient sprites (stool, table, bench, cat, motorbike, moth, steam, glow, rain, bill).
import { INK, lin, rad, svgOpen } from './util';

export interface Prop { key: string; w: number; h: number; svg: string }
const o = (w = 1) => `stroke="${INK}" stroke-opacity=".85" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

const stool: Prop = {
  key: 'shop-stool', w: 18, h: 15,
  svg: `${svgOpen(0, 0, 18, 15)}<defs>${lin('st', [[0, '#ff7a6a'], [0.5, '#d6342b'], [1, '#a01e22']])}</defs>
<path d="M4 6 L2.6 14 M14 6 L15.4 14 M9 7 V14" stroke="#7a1c1c" stroke-width="1.8" stroke-linecap="round"/><path d="M3.4 11 Q9 12.6 14.6 11" stroke="#7a1c1c" stroke-width="1.2" fill="none"/>
<path d="M1.6 5.4 Q1.4 3.6 3.2 3.6 H14.8 Q16.6 3.6 16.4 5.4 Q16.4 7.6 14.6 7.6 H3.4 Q1.6 7.6 1.6 5.4Z" fill="url(#st)" ${o()}/>
<ellipse cx="9" cy="3.8" rx="7" ry="2" fill="#ff9a8a" ${o(0.8)}/><ellipse cx="6.6" cy="3.4" rx="3" ry=".7" fill="#fff" opacity=".6"/><path d="M15.4 4.6 Q16.4 6 14.8 7.2" stroke="#ffb24a" stroke-opacity=".7" stroke-width=".9" fill="none"/></svg>`,
};

const table: Prop = {
  key: 'shop-table', w: 34, h: 26,
  svg: `${svgOpen(0, 0, 34, 26)}<defs>${lin('tt', [[0, '#f8f0dc'], [1, '#d8cca8']])}</defs>
<path d="M14 11 V24 M20 11 V24 M9 25 H25" stroke="#5a4a54" stroke-width="2.2" stroke-linecap="round"/><path d="M14 19 H20" stroke="#5a4a54" stroke-width="1.3"/>
<ellipse cx="17" cy="11.4" rx="15.6" ry="4.8" fill="#a89870" ${o()}/><ellipse cx="17" cy="9.8" rx="15.6" ry="4.8" fill="url(#tt)" ${o()}/>
<ellipse cx="17" cy="9.8" rx="11.6" ry="3" fill="none" stroke="#c8402a" stroke-opacity=".35" stroke-width=".8" stroke-dasharray="2 1.6"/><ellipse cx="11" cy="8.2" rx="5" ry=".9" fill="#fff" opacity=".6"/>
<g><rect x="18.6" y="5.2" width="6.2" height="4" rx="1" fill="#e8dcc0" ${o(0.8)}/><rect x="19.4" y="2.8" width="1.6" height="2.8" rx=".6" fill="#d6342b" ${o(0.5)}/><rect x="21.6" y="3.4" width="1.6" height="2.2" rx=".6" fill="#6ec28a" ${o(0.5)}/><rect x="23.6" y="2.4" width="1.1" height="3" rx=".4" fill="#c8a060" ${o(0.4)}/></g>
<rect x="7.8" y="6.8" width="4" height="3.2" rx=".8" fill="#fff" opacity=".9" ${o(0.7)}/></svg>`,
};

const bench: Prop = {
  key: 'shop-bench', w: 46, h: 24,
  svg: `${svgOpen(0, 0, 46, 24)}<defs>${lin('bw', [[0, '#b88458'], [1, '#8a5a34']])}</defs>
<path d="M5 12 V22 M41 12 V22 M5 22 H41" stroke="#2a2030" stroke-width="2.2" stroke-linecap="round"/><path d="M3 22.8 h6 M37 22.8 h6" stroke="#2a2030" stroke-width="2"/>
<g><rect x="2" y="3" width="42" height="3.6" rx="1.2" fill="url(#bw)" ${o()}/><rect x="2" y="7.4" width="42" height="3.6" rx="1.2" fill="url(#bw)" ${o()}/>
<rect x="1" y="11.6" width="44" height="3.6" rx="1.2" fill="url(#bw)" ${o()}/><rect x="1" y="16" width="44" height="3.4" rx="1.2" fill="#6a4226" ${o()}/></g>
<path d="M5 4.4 h14 M8 8.8 h10 M10 13.2 h16" stroke="#e8c898" stroke-opacity=".5" stroke-width=".7"/><path d="M44 5 V19" stroke="#ffb24a" stroke-opacity=".5" stroke-width="1"/></svg>`,
};

const bill: Prop = {
  key: 'shop-bill', w: 24, h: 22,
  svg: `${svgOpen(0, 0, 24, 22)}<defs>${lin('bn', [[0, '#8ad89a'], [1, '#3f8a5a']])}${lin('cn', [[0, '#fff3b0'], [1, '#e0a010']])}</defs>
<g transform="rotate(-8 9 12)"><rect x="1.4" y="7.4" width="17" height="10" rx="1.6" fill="url(#bn)" ${o()}/><circle cx="9.9" cy="12.4" r="3" fill="#d8f4d8" ${o(0.7)}/><circle cx="9.9" cy="12.4" r="1.2" fill="#3f8a5a"/><rect x="3" y="9" width="3" height="1.4" fill="#d8f4d8" opacity=".8"/><rect x="14" y="14.2" width="3" height="1.4" fill="#d8f4d8" opacity=".8"/></g>
<ellipse cx="18" cy="17.6" rx="5" ry="2.2" fill="#b8860b" ${o(0.8)}/><ellipse cx="18" cy="15.8" rx="5" ry="2.2" fill="url(#cn)" ${o(0.8)}/><ellipse cx="18" cy="14" rx="5" ry="2.2" fill="url(#cn)" ${o(0.8)}/><ellipse cx="17" cy="13.6" rx="2.6" ry=".8" fill="#fff" opacity=".7"/>
<path d="M20 4 l1 2.4 l2.4 1 l-2.4 1 l-1 2.4 l-1 -2.4 l-2.4 -1 l2.4 -1 z" fill="#fff6c0" opacity=".9"/></svg>`,
};

const catSleep: Prop = {
  key: 'shop-cat-sleep', w: 28, h: 14,
  svg: `${svgOpen(0, 0, 28, 14)}<defs>${lin('cf', [[0, '#9a8a80'], [1, '#6a5a52']])}</defs>
<path d="M3 12 Q0 6 6 3.6 Q14 0.6 22 3 Q27 5 26 10 Q25 13 20 13 H8 Q4 13 3 12Z" fill="url(#cf)" ${o()}/>
<path d="M8 3.4 q1 3 0 6 M13 2.6 q1 3.4 0 7 M18 3 q1 3 0 6" stroke="#4a3a34" stroke-opacity=".5" stroke-width="1" fill="none"/>
<path d="M19 6.2 Q21 3.4 24 4.6 Q26.6 6.4 25.6 9.6 Q23 11.2 20 10 Z" fill="#a89a90" ${o(0.9)}/><path d="M20.4 4.6 L20.8 1.4 L23 3.6 M23.6 3.8 L25.4 1.8 L25.8 5" fill="#a89a90" ${o(0.8)}/>
<path d="M21.6 7.4 q1 .8 2 0 M24 7.8 q.8 .6 1.6 0" stroke="${INK}" stroke-width=".8" fill="none" stroke-linecap="round"/><path d="M3.4 11.6 Q1 12.6 4 13" stroke="#6a5a52" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path d="M25 6 Q26.6 8 25.4 10" stroke="#ffb24a" stroke-opacity=".7" stroke-width="1" fill="none"/></svg>`,
};

const catAwake: Prop = {
  key: 'shop-cat-awake', w: 24, h: 24,
  svg: `${svgOpen(0, 0, 24, 24)}<defs>${lin('cf', [[0, '#9a8a80'], [1, '#6a5a52']])}</defs>
<path d="M4 23 Q0 14 6 9 Q9 6 13 6 Q18 7 18 14 L18 23 Z" fill="url(#cf)" ${o()}/>
<path d="M3 22 Q-2 18 1 12 Q3 9 5 11" stroke="#6a5a52" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<ellipse cx="14" cy="9" rx="6" ry="5.2" fill="#a89a90" ${o()}/><path d="M9.4 6.2 L9.8 1.6 L13 4.6 M15.2 4.4 L18.4 1.6 L19 6.6" fill="#a89a90" ${o(0.9)}/>
<ellipse cx="16.4" cy="8.4" rx="1" ry="1.5" fill="#6ec28a" ${o(0.5)}/><ellipse cx="16.4" cy="8.4" rx=".4" ry="1.2" fill="${INK}"/><ellipse cx="12" cy="8.6" rx="1" ry="1.5" fill="#6ec28a" ${o(0.5)}/><ellipse cx="12" cy="8.6" rx=".4" ry="1.2" fill="${INK}"/>
<path d="M18.6 10 l2.6 -.6 M18.6 11 l2.4 .8" stroke="#e8dcc8" stroke-width=".5"/><path d="M5 15 q2 -2 1 -5 M8 14 q2 -2 1 -4" stroke="#4a3a34" stroke-opacity=".5" stroke-width="1" fill="none"/><path d="M17.4 6 Q19.2 10 17 14" stroke="#ffb24a" stroke-opacity=".6" stroke-width="1" fill="none"/></svg>`,
};

const moto: Prop = {
  key: 'shop-moto', w: 60, h: 36,
  svg: `${svgOpen(0, 0, 60, 36)}<defs>${lin('mb', [[0, '#5a9ad0'], [1, '#2a5a90']])}${rad('hl', [[0, '#fff8d0'], [1, '#ffd23a']])}</defs>
<ellipse cx="29" cy="34.6" rx="24" ry="1.8" fill="${INK}" opacity=".4"/>
<g><circle cx="12" cy="28" r="6.4" fill="#141018" ${o()}/><circle cx="12" cy="28" r="3.4" fill="#4a4258"/><circle cx="12" cy="28" r="1.2" fill="#8c97a6"/><circle cx="46" cy="28" r="6.4" fill="#141018" ${o()}/><circle cx="46" cy="28" r="3.4" fill="#4a4258"/><circle cx="46" cy="28" r="1.2" fill="#8c97a6"/></g>
<path d="M12 28 L22 20 H34 L46 28 M34 20 L40 12" stroke="#2a2030" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path d="M14 20 Q14 16 20 16 H34 Q40 16 40 22 L38 26 H20 Q14 26 14 20Z" fill="url(#mb)" ${o()}/><path d="M18 18 H34" stroke="#fff" stroke-opacity=".4" stroke-width="1"/>
<rect x="9" y="14" width="14" height="4" rx="2" fill="#3a2a30" ${o(0.8)}/><rect x="3" y="3" width="14" height="12" rx="2" fill="#6ec28a" ${o()}/><rect x="5" y="5" width="10" height="3" fill="#fff" opacity=".3"/><path d="M6 11 h8" stroke="#2a6a4a" stroke-width="1"/>
<path d="M38 12 L44 11 M40 12 L41 22" stroke="#2a2030" stroke-width="2.2" stroke-linecap="round"/><path d="M36 12 h8" stroke="#2a2030" stroke-width="2.4" stroke-linecap="round"/>
<path d="M46 14 Q52 14 52 19 Q52 22 48 22 Z" fill="#3a4a60" ${o(0.9)}/><ellipse cx="53" cy="18" rx="3.2" ry="2.8" fill="url(#hl)" ${o(0.8)}/>
<path d="M22 15 Q20 8 24 5 Q30 4 31 8 L31 15 Z" fill="#3a2a4a" ${o()}/><path d="M30 8 Q35 9 37 13 L37 16" stroke="#3a2a4a" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M26 14 L34 22 L32 26" stroke="#2a3a5a" stroke-width="3.6" fill="none" stroke-linecap="round"/>
<circle cx="27" cy="2.6" r="4.4" fill="#ffb24a" ${o()}/><path d="M26 2.4 Q31 1 31.4 4.4 Q29 5.8 26 5 Z" fill="#1b1230" opacity=".85"/><path d="M23 1 Q26 -1 29 0.4" stroke="#fff" stroke-opacity=".6" stroke-width="1" fill="none"/></svg>`,
};

const beam: Prop = {
  key: 'shop-moto-beam', w: 72, h: 26,
  svg: `${svgOpen(0, 0, 72, 26)}<defs>${lin('bm', [[0, '#fff0b0', 0.75], [1, '#fff0b0', 0]], 0, 0, 1, 0)}</defs><path d="M0 11 L72 0 V26 L0 15 Z" fill="url(#bm)"/></svg>`,
};

const moth: Prop = {
  key: 'shop-moth', w: 8, h: 6,
  svg: `${svgOpen(0, 0, 8, 6)}<path d="M4 3 Q1 0 .4 2.4 Q1 4.6 4 3Z M4 3 Q7 0 7.6 2.4 Q7 4.6 4 3Z" fill="#f2ead8" opacity=".9"/><rect x="3.5" y="1.6" width="1" height="3.4" rx=".5" fill="#8a7a6a"/></svg>`,
};

const wisp: Prop = {
  key: 'shop-wisp', w: 28, h: 28,
  svg: `${svgOpen(0, 0, 28, 28)}<defs>${rad('w', [[0, '#fff', 0.55], [0.5, '#f0e8f8', 0.22], [1, '#e8e0f0', 0]])}</defs><circle cx="14" cy="14" r="14" fill="url(#w)"/></svg>`,
};

const glow: Prop = {
  key: 'shop-glow', w: 128, h: 128,
  svg: `${svgOpen(0, 0, 128, 128)}<defs>${rad('g', [[0, '#fff', 1], [0.25, '#fff', 0.55], [0.55, '#fff', 0.2], [1, '#fff', 0]])}</defs><rect width="128" height="128" fill="url(#g)"/></svg>`,
};

const rain: Prop = {
  key: 'shop-rain', w: 4, h: 16,
  svg: `${svgOpen(0, 0, 4, 16)}<defs>${lin('r', [[0, '#cfe0ff', 0], [1, '#cfe0ff', 0.85]])}</defs><path d="M3 0 L1 16" stroke="url(#r)" stroke-width="1.2" stroke-linecap="round"/></svg>`,
};

export const PROPS: Prop[] = [stool, table, bench, bill, catSleep, catAwake, moto, beam, moth, wisp, glow, rain];
