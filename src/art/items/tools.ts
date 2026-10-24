// Grill, tools, containers and fx as SVG. Light from top-left, warm rim bottom-right, outline #1b1230.
import { PALETTE } from '../palette';

const N = PALETTE.night.css;
const ol = (w = 1.5) => `stroke="${N}" stroke-opacity=".85" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

export interface ToolArt {
  key: string;
  w: number;
  h: number;
  svg: string;
}
const S = (key: string, w: number, h: number, body: string, defs = ''): ToolArt => ({
  key,
  w,
  h,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`,
});
const lg = (id: string, stops: [number, string, number?][], x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a ?? 1}"/>`).join('')}</linearGradient>`;
const rg = (id: string, stops: [number, string, number?][], cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a ?? 1}"/>`).join('')}</radialGradient>`;

function rnd(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// ---------- skewer stick, burst ----------
const stick = S(
  'skewer-stick',
  6,
  116,
  `<path d="M1.6,0 H4.4 V106 L3,115.5 L1.6,106Z" fill="url(#sg)" ${ol(1)}/>
   <path d="M2,6 V104" stroke="#fff" stroke-opacity=".35" stroke-width=".6"/>
   <path d="M1.7,30 H4.3 M1.7,64 H4.3 M1.7,90 H4.3" stroke="#8a5a2a" stroke-width=".5" opacity=".6"/>`,
  lg('sg', [[0, '#f0d49a'], [0.5, '#d4a866'], [1, '#a8763a']], 0, 0, 1, 0),
);

const burst = S(
  'fx-burst',
  36,
  20,
  `<path d="M3,10 Q2,3 10,3 Q18,0 26,3 Q34,3 33,10 Q35,17 26,17 Q20,20 14,17 Q4,17 3,10Z" fill="url(#bg)" ${ol()}/>
   <ellipse cx="13" cy="7" rx="5" ry="2" fill="#fff" opacity=".6"/>
   <path d="M9,10 Q14,13 20,10 T30,11" stroke="#d99a10" stroke-width=".8" fill="none"/>
   <circle cx="30" cy="14" r="1.6" fill="#ffd23a"/>`,
  rg('bg', [[0, '#fff2a0'], [1, '#f0b020']], 0.4, 0.3, 0.8),
);

// ---------- coals / grate / grill body ----------
function coalLumps(hot: boolean): string {
  const r = rnd(11);
  let s = '';
  const lumps: string[] = [];
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 9; i++) {
      const cx = 5 + i * 8.8 + (row % 2) * 4 + (r() - 0.5) * 3;
      const cy = 6 + row * 8.5 + (r() - 0.5) * 2;
      const rx = 5.4 + r() * 2, ry = 4 + r() * 1.6;
      const rot = (r() - 0.5) * 50;
      const pts = [0, 1, 2, 3, 4, 5].map((k) => {
        const a = (k / 6) * Math.PI * 2 + (r() - 0.5) * 0.5;
        const rr = 0.8 + r() * 0.3;
        return `${(Math.cos(a) * rx * rr).toFixed(1)},${(Math.sin(a) * ry * rr).toFixed(1)}`;
      });
      lumps.push(`<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot.toFixed(0)})"><polygon points="${pts.join(' ')}" fill="${hot ? '#4a1c10' : '#2c211f'}" stroke="${hot ? '#2a0e08' : '#150f10'}" stroke-width=".9" stroke-linejoin="round"/>
        <polygon points="${pts.slice(0, 3).join(' ')}" fill="${hot ? '#7a2c14' : '#4e403c'}" opacity=".7"/>
        ${hot ? `<path d="M${-rx * 0.5},${ry * 0.1} L0,${-ry * 0.2} L${rx * 0.5},${ry * 0.3}" stroke="#ffa030" stroke-width="1" fill="none" opacity=".95"/><path d="M${-rx * 0.6},${ry * 0.5} L${rx * 0.2},${ry * 0.6}" stroke="#ff6a2a" stroke-width=".7" fill="none"/>` : `<circle cx="${-rx * 0.3}" cy="${-ry * 0.3}" r="1.1" fill="#8a807a" opacity=".6"/>`}</g>`);
    }
  }
  s = lumps.join('');
  return s;
}
const coalCold = S(
  'coal-cold',
  80,
  30,
  `<rect width="80" height="30" fill="#1a1112"/>${coalLumps(false)}
   <ellipse cx="22" cy="12" rx="9" ry="3" fill="#9a928c" opacity=".35"/><ellipse cx="58" cy="20" rx="12" ry="3.5" fill="#8a827c" opacity=".3"/>
   <circle cx="40" cy="8" r="1" fill="#b46a3a" opacity=".7"/><circle cx="10" cy="24" r="1" fill="#b46a3a" opacity=".6"/><circle cx="68" cy="9" r="1.2" fill="#b46a3a" opacity=".7"/>`,
);
const coalHot = S(
  'coal-hot',
  80,
  30,
  `<rect width="80" height="30" fill="url(#hg)"/>${coalLumps(true)}`,
  lg('hg', [[0, '#d8501a'], [1, '#8a2410']]),
);
const glow = S('fx-glow', 64, 32, `<ellipse cx="32" cy="18" rx="32" ry="16" fill="url(#gl)"/>`, rg('gl', [[0, '#ffb24a', 0.9], [0.5, '#ff6a2a', 0.35], [1, '#ff6a2a', 0]]));
const grate = S(
  'grill-grate',
  80,
  30,
  [4, 13, 22]
    .map(
      (y) => `<rect x="0" y="${y + 1.6}" width="80" height="3.4" fill="#000" opacity=".4"/>
      <rect x="0" y="${y}" width="80" height="3.6" rx="1.6" fill="url(#rod)" stroke="${N}" stroke-opacity=".8" stroke-width=".8"/>
      <rect x="0" y="${y + 0.5}" width="80" height="0.9" fill="#fff" opacity=".35"/>`,
    )
    .join('') + [8, 24, 40, 56, 72].map((x) => `<rect x="${x}" y="2" width="2.6" height="26" rx="1.2" fill="url(#rodv)" stroke="${N}" stroke-opacity=".7" stroke-width=".7"/>`).join(''),
  lg('rod', [[0, '#8e8a90'], [0.45, '#4a4448'], [1, '#2a2528']]) + lg('rodv', [[0, '#7a757a'], [1, '#2a2528']], 0, 0, 1, 0),
);
const grillBody = S(
  'grill-body',
  340,
  162,
  `<rect x="0" y="0" width="340" height="162" rx="10" fill="url(#gb)" ${ol()}/>
   <rect x="1.5" y="1.5" width="337" height="159" rx="9" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1"/>
   <rect x="6" y="4" width="328" height="154" rx="6" fill="#120c0c" stroke="#000" stroke-opacity=".6" stroke-width="1.5"/>
   <path d="M7,5 H333" stroke="#000" stroke-opacity=".5" stroke-width="3"/>
   <path d="M332,8 V156" stroke="#ff8a3a" stroke-opacity=".18" stroke-width="2"/>
   ${[[5, 5], [335, 5], [5, 157], [335, 157]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#6a6468" stroke="${N}" stroke-width=".8"/><circle cx="${x - 0.6}" cy="${y - 0.6}" r=".7" fill="#fff" opacity=".6"/>`).join('')}`,
  lg('gb', [[0, '#5a5256'], [0.5, '#3a3436'], [1, '#262022']]),
);

// ---------- fan ----------
const fan = S(
  'tool-fan',
  44,
  54,
  `<rect x="20" y="30" width="4.4" height="22" rx="2" fill="url(#fh)" ${ol(1.2)}/>
   <path d="M22,34 L4,16 Q-1,4 12,2 Q22,-1 32,2 Q45,5 40,16Z" fill="url(#ff)" ${ol()}/>
   ${[0, 1, 2, 3, 4, 5].map((i) => { const a = Math.PI * (1.12 + i * 0.15); return `<path d="M22,34 L${(22 + Math.cos(a) * 30).toFixed(1)},${(34 + Math.sin(a) * 33).toFixed(1)}" stroke="#a8742c" stroke-width=".8" opacity=".7"/>`; }).join('')}
   <path d="M7,10 Q22,2 37,10" stroke="#fff" stroke-opacity=".5" stroke-width="1.6" fill="none"/>
   <path d="M4,16 Q22,20 40,16" stroke="#8a5a1e" stroke-width="1.6" fill="none" opacity=".6"/>`,
  lg('fh', [[0, '#d9a866'], [1, '#8a5a2e']], 0, 0, 1, 0) + lg('ff', [[0, '#f6dca0'], [1, '#c8943c']], 0, 0, 1, 1),
);

// ---------- cooler / trays ----------
const cooler = S(
  'cooler-body',
  240,
  150,
  `<rect x="0" y="0" width="240" height="150" rx="10" fill="url(#cb)" ${ol()}/>
   <rect x="1.5" y="1.5" width="237" height="147" rx="9" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>
   <rect x="5" y="22" width="230" height="123" rx="6" fill="url(#cg)" stroke="${N}" stroke-opacity=".8" stroke-width="1.5"/>
   <path d="M6,23 H234" stroke="#000" stroke-opacity=".5" stroke-width="3"/>
   <rect x="168" y="5" width="62" height="11" rx="5" fill="#5f8696" stroke="${N}" stroke-opacity=".7" stroke-width="1"/>
   <rect x="170" y="6" width="58" height="3" rx="1.5" fill="#fff" opacity=".35"/>
   <path d="M5,100 H235" stroke="#9ad0e0" stroke-opacity=".15" stroke-width="1"/>`,
  lg('cb', [[0, '#a6c8d4'], [0.5, '#7fa8b8'], [1, '#5c8494']]) + lg('cg', [[0, '#2c4048'], [1, '#1a2a30']]),
);
const coolerGlass = S(
  'cooler-glass',
  230,
  123,
  `<path d="M20,0 H70 L30,123 H-20Z" fill="#fff" opacity=".07"/><path d="M95,0 H108 L68,123 H55Z" fill="#fff" opacity=".07"/>
   <path d="M160,0 H200 L170,123 H130Z" fill="#fff" opacity=".05"/>
   <rect x="0" y="108" width="230" height="15" fill="url(#fr)"/>`,
  lg('fr', [[0, '#cfeaf2', 0], [1, '#cfeaf2', 0.25]]),
);
function tray(key: string, w: number, h: number) {
  return S(
    key,
    w,
    h,
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="6" fill="url(#tr)" stroke="${N}" stroke-opacity=".75" stroke-width="1.2"/>
     <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="5" fill="none" stroke="#9ad0e0" stroke-opacity=".28" stroke-width="1"/>
     <rect x="3" y="${h - 7}" width="${w - 6}" height="4" rx="2" fill="#000" opacity=".28"/>
     <path d="M5,3 H${w - 5}" stroke="#fff" stroke-opacity=".22" stroke-width="1.2" stroke-linecap="round"/>`,
    lg('tr', [[0, '#4a6470'], [1, '#2e414a']]),
  );
}

// ---------- bin, bottle, brushes, pot, shaker ----------
const bin = S(
  'tool-bin',
  60,
  78,
  `<path d="M7,14 H53 L50,76 H10Z" fill="url(#bn)" ${ol()}/>
   ${[18, 26, 34, 42].map((x) => `<path d="M${x},20 L${x - 0.6 + (x - 30) * 0.03},70" stroke="#2a2a32" stroke-width="2" opacity=".6"/>`).join('')}
   <path d="M9,22 H51 M10,66 H50" stroke="#fff" stroke-opacity=".18" stroke-width="1.2"/>
   <path d="M51,16 L48,74" stroke="#ffa24a" stroke-opacity=".35" stroke-width="1.6"/>
   <rect x="2" y="5" width="56" height="12" rx="4" fill="url(#bl)" ${ol()}/>
   <rect x="4" y="6" width="52" height="3" rx="1.5" fill="#fff" opacity=".4"/>
   <rect x="22" y="0.8" width="16" height="6" rx="3" fill="#9a9aa6" ${ol(1.2)}/>`,
  lg('bn', [[0, '#7a7a86'], [0.55, '#55555e'], [1, '#3a3a42']], 0, 0, 1, 0) + lg('bl', [[0, '#a8a8b4'], [1, '#6a6a76']]),
);
function bottle(on: boolean) {
  return S(
    on ? 'tool-bottle-on' : 'tool-bottle',
    40,
    76,
    `${on ? `<rect x="1.5" y="1.5" width="37" height="73" rx="10" fill="none" stroke="#fff" stroke-width="2.4"/><rect x="1.5" y="1.5" width="37" height="73" rx="10" fill="#7ad8ff" opacity=".18"/>` : ''}
     <path d="M9,32 Q9,28 14,27 H28 Q33,28 33,32 V68 Q33,72 28,72 H14 Q9,72 9,68Z" fill="url(#bb)" ${ol()}/>
     <path d="M11,${on ? 36 : 42} H31 V68 Q31,70.5 28,70.5 H14 Q11,70.5 11,68Z" fill="${on ? '#9ae4ff' : '#3a9ad8'}" opacity=".85"/>
     <path d="M12,34 V66" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>
     <path d="M16,48 q2,4 0,6 q-2,-2 0,-6Z" fill="#fff" opacity=".55"/>
     <rect x="15" y="19" width="12" height="9" rx="2" fill="#e6e6ea" ${ol(1.2)}/>
     <rect x="9" y="9" width="24" height="11" rx="4" fill="url(#bh)" ${ol()}/>
     <path d="M9,13 H2 L1,16 H9" fill="#e8504a" ${ol(1.2)}/>
     <path d="M26,20 Q34,22 33,30" stroke="#c83a34" stroke-width="3" fill="none" stroke-linecap="round"/>
     <rect x="10" y="10" width="20" height="3" rx="1.5" fill="#fff" opacity=".4"/>`,
    lg('bb', [[0, on ? '#9ae4ff' : '#6ab8ee'], [1, on ? '#4ab0e8' : '#2a6ea8']], 0, 0, 1, 0) + lg('bh', [[0, '#ff7a6a'], [1, '#c8342c']]),
  );
}
function brush(kind: 'oil' | 'sauce') {
  const col = kind === 'oil' ? ['#ffe27a', '#e0a810'] : ['#b05a3a', '#6a2a18'];
  return S(
    `tool-brush-${kind}`,
    16,
    46,
    `<rect x="6" y="0.5" width="4" height="30" rx="2" fill="url(#bw)" ${ol(1.1)}/>
     <path d="M7.2,3 V28" stroke="#fff" stroke-opacity=".4" stroke-width=".7"/>
     <rect x="4.2" y="28" width="7.6" height="6" rx="1.4" fill="url(#bf)" ${ol(1.1)}/>
     <path d="M4.5,32 H11.5" stroke="#444" stroke-width=".6" opacity=".6"/>
     <path d="M3.4,34 H12.6 L13,43 Q8,46 3,43Z" fill="url(#bc)" ${ol(1.1)}/>
     <path d="M5.5,36 V42 M8,36 V43 M10.5,36 V42" stroke="${col[1]}" stroke-width=".7" opacity=".7"/>
     <path d="M5,35.5 H8" stroke="#fff" stroke-opacity=".5" stroke-width="1"/>`,
    lg('bw', [[0, '#d9a066'], [1, '#8a5a2a']], 0, 0, 1, 0) + lg('bf', [[0, '#e6e6ee'], [1, '#8a8a96']], 0, 0, 1, 0) + lg('bc', [[0, col[0]], [1, col[1]]]),
  );
}
const potBack = S(
  'tool-pot',
  96,
  60,
  `<rect x="4" y="22" width="88" height="36" rx="6" fill="url(#pb)" ${ol()}/>
   <ellipse cx="24" cy="25" rx="19" ry="4.5" fill="#d9a010" ${ol(1)}/>
   <ellipse cx="72" cy="25" rx="19" ry="4.5" fill="#6a2412" ${ol(1)}/>
   <ellipse cx="20" cy="24.3" rx="8" ry="1.3" fill="#fff" opacity=".5"/>
   <ellipse cx="68" cy="24.3" rx="8" ry="1.3" fill="#e0805a" opacity=".5"/>`,
  lg('pb', [[0, '#7a5a48'], [1, '#4a3226']]),
);
const potFront = S(
  'tool-pot-front',
  96,
  60,
  `<path d="M4,27 H92 V52 Q92,58 86,58 H10 Q4,58 4,52Z" fill="url(#pf)" ${ol()}/>
   <rect x="0" y="22" width="96" height="7" rx="3.5" fill="url(#pr)" ${ol()}/>
   <rect x="3" y="23" width="90" height="2" rx="1" fill="#fff" opacity=".35"/>
   <path d="M48,28 V57" stroke="${N}" stroke-opacity=".6" stroke-width="1.5"/>
   <path d="M89,30 V54" stroke="#ff9a4a" stroke-opacity=".35" stroke-width="1.6"/>
   <path d="M8,31 V52" stroke="#fff" stroke-opacity=".2" stroke-width="2"/>`,
  lg('pf', [[0, '#8a6652'], [1, '#4a3226']]) + lg('pr', [[0, '#b08a72'], [1, '#6a4a3a']]),
);
const shaker = S(
  'tool-shaker',
  46,
  26,
  `<rect x="1" y="1" width="44" height="24" rx="7" fill="url(#sk)" ${ol()}/>
   <rect x="1" y="1" width="12" height="24" rx="6" fill="url(#sc)" ${ol(1.2)}/>
   ${[[5, 8], [8, 11], [5, 13], [8, 16], [5, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="#2a1410"/>`).join('')}
   <rect x="15" y="5" width="26" height="16" rx="4" fill="#f6e7c8" opacity=".18"/>
   <path d="M4,4 H42" stroke="#fff" stroke-opacity=".4" stroke-width="1.4" stroke-linecap="round"/>
   <path d="M43,6 V20" stroke="#ff8a3a" stroke-opacity=".4" stroke-width="1.6"/>`,
  lg('sk', [[0, '#d83a30'], [1, '#8a1c18']]) + lg('sc', [[0, '#f0c070'], [1, '#b0782a']]),
);

// ---------- flame, puffs ----------
const flame = S(
  'fx-flame',
  28,
  46,
  `<path d="M14,1 Q17,12 23,18 Q28,26 25,34 Q22,44 14,44.5 Q5,44 3,34 Q1,26 7,19 Q8,24 11,23 Q8,12 14,1Z" fill="url(#f1)" stroke="#8a1c10" stroke-opacity=".6" stroke-width="1"/>
   <path d="M14,11 Q16,20 20,24 Q24,30 21,36 Q19,43 14,43 Q8,43 7,36 Q6,30 10,25 Q12,28 13,26 Q11,19 14,11Z" fill="url(#f2)"/>
   <path d="M14,25 Q16,30 17,34 Q18,40 14,41 Q10,40 11,34 Q12,30 14,25Z" fill="url(#f3)"/>`,
  lg('f1', [[0, '#ff5a1a'], [1, '#c8200c']]) + lg('f2', [[0, '#ffb030'], [1, '#ff6a1a']]) + lg('f3', [[0, '#fff2a0'], [1, '#ffd040']]),
);
const puff = S('fx-puff', 24, 24, `<circle cx="12" cy="12" r="12" fill="url(#pf)"/>`, rg('pf', [[0, '#fff', 0.9], [0.55, '#fff', 0.4], [1, '#fff', 0]]));
const spark = S('fx-spark', 8, 8, `<circle cx="4" cy="4" r="4" fill="url(#sp)"/>`, rg('sp', [[0, '#fff', 1], [0.5, '#fff', 0.85], [1, '#fff', 0]]));
const bubble = S('fx-bubble', 10, 10, `<circle cx="5" cy="5" r="4" fill="#fff6c0" fill-opacity=".35" stroke="#fff" stroke-opacity=".85" stroke-width=".9"/><circle cx="3.6" cy="3.6" r="1.1" fill="#fff"/>`);

// ---------- station counter ----------
function counter(): ToolArt {
  const r = rnd(5);
  const W = 360, H = 500;
  let planks = '';
  const ph = 46;
  for (let i = 0; i * ph < H; i++) {
    const y = i * ph;
    const shade = ['#3c2a22', '#42302a', '#38261f'][i % 3];
    planks += `<rect x="0" y="${y}" width="${W}" height="${ph}" fill="${shade}"/>`;
    for (let k = 0; k < 7; k++) {
      const yy = y + 4 + r() * (ph - 8);
      planks += `<path d="M${(r() * 80).toFixed(0)},${yy.toFixed(1)} q40,${(r() * 4 - 2).toFixed(1)} ${(80 + r() * 140).toFixed(0)},0" stroke="#1c110e" stroke-width=".8" opacity=".5" fill="none"/>`;
    }
    const sx = (i * 97 + 40) % W;
    planks += `<path d="M${sx},${y} V${y + ph}" stroke="#150c0a" stroke-width="1.4" opacity=".8"/>`;
    planks += `<path d="M0,${y} H${W}" stroke="#150c0a" stroke-width="1.4"/><path d="M0,${y + 1.5} H${W}" stroke="#fff" stroke-opacity=".05" stroke-width="1"/>`;
    planks += `<circle cx="${sx + 6}" cy="${y + 8}" r="1" fill="#6a5448" opacity=".7"/><circle cx="${sx - 6}" cy="${y + ph - 8}" r="1" fill="#6a5448" opacity=".7"/>`;
  }
  return S(
    'station-counter',
    W,
    H,
    `${planks}<rect width="${W}" height="${H}" fill="url(#cl)"/><rect width="${W}" height="${H}" fill="url(#cv)"/>
     <rect x="0" y="0" width="${W}" height="5" fill="#8a5a34"/><rect x="0" y="0" width="${W}" height="1.6" fill="#ffd9a0" opacity=".5"/><rect x="0" y="5" width="${W}" height="3" fill="#000" opacity=".4"/>`,
    lg('cl', [[0, '#ffb24a', 0.22], [0.45, '#ffb24a', 0]]) + rg('cv', [[0.55, '#000', 0], [1, '#10091c', 0.45]], 0.5, 0.35, 0.75),
  );
}

// ---------- Sprint 5 containers ----------
const cup = S(
  'box-cup',
  30,
  40,
  `<path d="M3,6 H27 L24.5,37 Q24,39 22,39 H8 Q6,39 5.5,37Z" fill="url(#cu)" ${ol()}/>
   <ellipse cx="15" cy="6" rx="12" ry="3" fill="#fff" fill-opacity=".45" ${ol(1.2)}/>
   <path d="M6,12 L8,34" stroke="#fff" stroke-opacity=".6" stroke-width="2.2" stroke-linecap="round"/>
   <rect x="9" y="17" width="12" height="12" rx="2.5" fill="#f6e7c8" stroke="${N}" stroke-opacity=".75" stroke-width="1"/>
   <path d="M5.8,35.5 H24.2" stroke="#000" stroke-opacity=".12" stroke-width="3"/>
   <path d="M25,10 L23.5,34" stroke="#ff9a4a" stroke-opacity=".35" stroke-width="1.4"/>`,
  lg('cu', [[0, '#d8f0f8', 0.55], [1, '#8ac4d8', 0.6]], 0, 0, 1, 1),
);
const bucket = S(
  'box-bucket',
  44,
  52,
  `<path d="M8,16 Q22,-6 36,16" stroke="#1b1230" stroke-opacity=".85" stroke-width="4.2" fill="none" stroke-linecap="round"/><path d="M8,16 Q22,-6 36,16" stroke="#b8b8c4" stroke-width="2" fill="none" stroke-linecap="round"/>
   <path d="M4,12 H40 L36,48 Q35.5,50.5 33,50.5 H11 Q8.5,50.5 8,48Z" fill="url(#bk)" ${ol()}/>
   <ellipse cx="22" cy="12" rx="18" ry="3.6" fill="#8a1c18" ${ol(1.2)}/>
   <rect x="3" y="11" width="38" height="5" rx="2.5" fill="#e8504a" ${ol(1.2)}/>
   <path d="M7,19 L10,46" stroke="#fff" stroke-opacity=".4" stroke-width="2.4" stroke-linecap="round"/>
   <rect x="13" y="24" width="18" height="15" rx="3" fill="#f6e7c8" stroke="${N}" stroke-opacity=".75" stroke-width="1.1"/>
   <path d="M38,18 L35,46" stroke="#ffa24a" stroke-opacity=".35" stroke-width="1.6"/>`,
  lg('bk', [[0, '#f0584a'], [1, '#b42820']], 0, 0, 1, 0),
);
const displayBox = S(
  'box-display',
  150,
  104,
  `<rect x="0" y="0" width="150" height="104" rx="8" fill="url(#dw)" ${ol()}/>
   <rect x="6" y="14" width="138" height="84" rx="4" fill="url(#dg)" stroke="${N}" stroke-opacity=".8" stroke-width="1.5"/>
   <rect x="5" y="3" width="140" height="8" rx="3" fill="#ffd27a" opacity=".85"/><rect x="7" y="4" width="136" height="2" fill="#fff" opacity=".7"/>
   ${[44, 72].map((y) => `<rect x="8" y="${y}" width="134" height="4" rx="1.5" fill="#9a9aa6" ${ol(1)}/><rect x="8" y="${y}" width="134" height="1.2" fill="#fff" opacity=".5"/>`).join('')}
   ${[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => `<rect x="${14 + c * 32}" y="${28 + r * 28}" width="24" height="14" rx="3" fill="#3a4e58" stroke="${N}" stroke-opacity=".6" stroke-width="1"/>`).join('')).join('')}
   <path d="M30,14 L60,14 L30,98 L6,98Z" fill="#fff" opacity=".07"/><path d="M90,14 L104,14 L74,98 L60,98Z" fill="#fff" opacity=".06"/>
   <rect x="6" y="90" width="138" height="8" fill="#000" opacity=".25"/>
   <rect x="2" y="98" width="146" height="5" rx="2" fill="#4a2a14" opacity=".7"/>`,
  lg('dw', [[0, '#a87848'], [1, '#6a4424']]) + lg('dg', [[0, '#3a5058'], [1, '#202e34']]),
);
const fryer = S(
  'tool-fryer',
  116,
  58,
  `<path d="M2,24 H114 Q113,52 92,56 H24 Q3,52 2,24Z" fill="url(#fy)" ${ol()}/>
   <ellipse cx="58" cy="24" rx="56" ry="13" fill="#2a2a30" ${ol()}/>
   <ellipse cx="58" cy="25" rx="51" ry="10.5" fill="url(#oil)"/>
   <ellipse cx="46" cy="22" rx="22" ry="3.4" fill="#fff" opacity=".4"/>
   <rect x="110" y="20" width="22" height="7" rx="3.5" transform="rotate(8 110 22)" fill="#6a4a2a" ${ol(1.2)} opacity="0"/>
   <path d="M4,28 Q10,48 26,53" stroke="#fff" stroke-opacity=".18" stroke-width="2" fill="none"/>
   <path d="M110,30 Q104,48 90,54" stroke="#ff9a4a" stroke-opacity=".35" stroke-width="1.6" fill="none"/>
   <rect x="-0" y="20" width="9" height="7" rx="2" fill="#4a4448" ${ol(1.2)}/><rect x="107" y="20" width="9" height="7" rx="2" fill="#4a4448" ${ol(1.2)}/>
   ${[[30, 26, 3], [48, 28, 2.2], [66, 24, 3.4], [84, 27, 2.6], [58, 22, 1.8], [96, 24, 2], [38, 22, 1.6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff3b0" fill-opacity=".45" stroke="#fff" stroke-opacity=".85" stroke-width=".8"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.3}" fill="#fff"/>`).join('')}`,
  lg('fy', [[0, '#5a5458'], [1, '#26222a']]) + rg('oil', [[0, '#ffd23a'], [0.7, '#e09a10'], [1, '#a8640a']], 0.4, 0.4, 0.7),
);
const batter = S(
  'tool-batter',
  58,
  38,
  `<path d="M3,12 H55 Q54,34 40,36 H18 Q4,34 3,12Z" fill="url(#bw2)" ${ol()}/>
   <ellipse cx="29" cy="12" rx="26" ry="6" fill="#f6e4b0" ${ol(1.2)}/>
   <ellipse cx="29" cy="12" rx="22" ry="4" fill="#ffefc0"/>
   <path d="M20,11 Q26,13 34,10" stroke="#fff" stroke-width="1.4" fill="none" opacity=".8"/>
   <path d="M6,18 Q8,28 16,32" stroke="#fff" stroke-opacity=".5" stroke-width="2" fill="none"/>
   <path d="M5,22 H53" stroke="#2a6ea8" stroke-width="2" opacity=".55"/>
   <path d="M52,16 Q51,30 42,34" stroke="#ff9a4a" stroke-opacity=".35" stroke-width="1.4" fill="none"/>
   <path d="M42,2 L36,12" stroke="#c8943c" stroke-width="3" stroke-linecap="round"/><path d="M42,2 L36,12" stroke="#f6dca0" stroke-width="1.2" stroke-linecap="round"/>
   <path d="M44,13 q1,4 0,6" stroke="#f6e4b0" stroke-width="2" fill="none"/>`,
  lg('bw2', [[0, '#f4f0e6'], [1, '#b8b0a0']], 0, 0, 1, 1),
);

export const TOOL_ART: ToolArt[] = [
  stick, burst, coalCold, coalHot, glow, grate, grillBody, fan, cooler, coolerGlass,
  tray('cooler-tray-s', 36, 36), tray('cooler-tray-m', 52, 54), tray('cooler-tray-l', 52, 112),
  bin, bottle(false), bottle(true), brush('oil'), brush('sauce'), potBack, potFront, shaker,
  flame, puff, spark, bubble, counter(), cup, bucket, displayBox, fryer, batter,
];
