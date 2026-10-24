// Layered street + stall scenery as SVG strings. All coordinates are shop-strip coords (360 x 250);
// each layer's viewBox starts at its placement (x, y) so ShopView can place it at (stripX + x, stripY + y).
import { INK, darken, f, lighten, lin, rad, rng, svgOpen } from './util';

export interface Layer { key: string; x: number; y: number; w: number; h: number; depth: number; svg: string }

/** Sign panel the live shop-name text sits on (must equal SIGN_RECT in ShopView). */
export const SIGN = { x: 186, y: 48, w: 150, h: 26 };
export const DISPLAY_BOX = { x: 246, y: 116, w: 98, h: 32 };
export const QDISPLAY = { x: 200, y: 108, w: 32, h: 17 };
export const LANTERNS = [{ x: 240, y: 112 }, { x: 296, y: 110 }, { x: 352, y: 112 }];
export const LAMP = { x: 128, y: 67 };

type P = [number, number];
const bez = (a: P, c: P, b: P, t: number): P => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
const STRING_A: [P, P, P] = [[-6, 18], [60, 56], [127, 52]];
const STRING_B: [P, P, P] = [[129, 52], [240, 44], [366, 14]];
const BULB_COLS = ['#ff6a6a', '#ffd23a', '#6ad0ff', '#a0ff8a', '#ff9ad0'];
export const BULBS: { x: number; y: number; c: string }[] = [];
{
  let k = 0;
  for (const [s, n] of [[STRING_A, 9], [STRING_B, 13]] as const)
    for (let i = 1; i < n; i++) {
      const [x, y] = bez(s[0], s[1], s[2], i / n);
      BULBS.push({ x, y: y + 2.5, c: BULB_COLS[k++ % BULB_COLS.length] });
    }
}

const star = (x: number, y: number, r: number, o: number) =>
  `<path d="M${f(x)} ${f(y - r)} L${f(x + r * 0.28)} ${f(y - r * 0.28)} L${f(x + r)} ${f(y)} L${f(x + r * 0.28)} ${f(y + r * 0.28)} L${f(x)} ${f(y + r)} L${f(x - r * 0.28)} ${f(y + r * 0.28)} L${f(x - r)} ${f(y)} L${f(x - r * 0.28)} ${f(y - r * 0.28)} Z" fill="#fff6dc" opacity="${o}"/>`;

// ------------------------------------------------------------ sky
function sky(): Layer {
  const R = rng(11);
  let s = '';
  for (let i = 0; i < 70; i++) {
    const x = -20 + R() * 400;
    const y = R() * 120;
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.35 + R() * 0.7)}" fill="#fff6dc" opacity="${f(0.25 + R() * 0.7)}"/>`;
  }
  for (const [x, y, r] of [[100, 18, 3], [150, 52, 2.4], [208, 14, 3.4], [300, 30, 2.6], [338, 66, 2], [18, 70, 2.2]]) s += star(x, y, r, 0.85);
  let clouds = '';
  for (const [x, y, w, h, o] of [[120, 74, 90, 7, 0.22], [250, 98, 120, 8, 0.18], [-5, 100, 80, 6, 0.2], [310, 50, 70, 5, 0.16]])
    clouds += `<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${h}" fill="#7a4a96" opacity="${o}"/><ellipse cx="${x + 18}" cy="${y - 4}" rx="${w / 3.4}" ry="${h * 0.8}" fill="#8a5aa6" opacity="${o}"/>`;
  const svg = `${svgOpen(-20, 0, 400, 190)}<defs>${lin('sk', [[0, '#0b061a'], [0.4, '#22163f'], [0.78, '#5a3068'], [1, '#a65a62']])}${rad('mh', [[0, '#fff0c8', 0.55], [0.35, '#ffd9a0', 0.18], [1, '#ffd9a0', 0]])}</defs>
<rect x="-20" y="0" width="400" height="190" fill="url(#sk)"/>${s}${clouds}
<circle cx="46" cy="34" r="34" fill="url(#mh)"/><circle cx="46" cy="34" r="12.5" fill="#fff0c8"/><circle cx="41" cy="31" r="9.6" fill="#f2d8a8" opacity=".55"/>
<circle cx="50" cy="39" r="2.2" fill="#e0c090" opacity=".7"/><circle cx="43" cy="30" r="1.6" fill="#e0c090" opacity=".7"/><circle cx="52" cy="30" r="1.1" fill="#e0c090" opacity=".7"/></svg>`;
  return { key: 'shop-sky', x: -20, y: 0, w: 400, h: 190, depth: -60, svg };
}

// ------------------------------------------------------------ skyline
function skyline(near: boolean): Layer {
  const R = rng(near ? 7 : 5);
  const col = near ? '#1c1431' : '#2e2150';
  const win = near ? '#ffd68a' : '#c89a6a';
  let s = '';
  let x = -20;
  const base = 186;
  while (x < 380) {
    const w = (near ? 26 : 20) + R() * (near ? 26 : 22);
    const h = (near ? 46 : 30) + R() * (near ? 62 : 44);
    const top = base - h;
    s += `<rect x="${f(x)}" y="${f(top)}" width="${f(w)}" height="${f(h + 4)}" fill="${col}"/>`;
    if (R() < 0.45) s += `<rect x="${f(x + w * 0.3)}" y="${f(top - 6)}" width="${f(w * 0.4)}" height="7" fill="${col}"/>`;
    if (R() < 0.3) s += `<path d="M${f(x + w * 0.5)} ${f(top)} v-12" stroke="${col}" stroke-width="1"/><circle cx="${f(x + w * 0.5)}" cy="${f(top - 13)}" r="1.2" fill="#ff5a4a"/>`;
    if (near && R() < 0.3) s += `<rect x="${f(x + 3)}" y="${f(top - 9)}" width="8" height="9" rx="2" fill="${darken(col, 0.2)}"/>`;
    const cols = Math.max(2, Math.floor(w / 7));
    const rows = Math.floor(h / 9);
    for (let r = 1; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (R() < (near ? 0.34 : 0.18)) {
          const warm = R() < 0.78;
          s += `<rect x="${f(x + 3 + c * ((w - 5) / cols))}" y="${f(top + 4 + r * 9)}" width="3" height="4.2" rx=".5" fill="${warm ? win : '#9ad8ff'}" opacity="${near ? 0.85 : 0.5}"/>`;
        }
      }
    if (near && R() < 0.22) {
      const nc = ['#ff5aa0', '#4ad8e8', '#ffd23a'][Math.floor(R() * 3)];
      s += `<rect x="${f(x + 2)}" y="${f(top + 14)}" width="${f(w - 4)}" height="5" rx="2" fill="${nc}" opacity=".85"/><rect x="${f(x + 2)}" y="${f(top + 14)}" width="${f(w - 4)}" height="5" rx="2" fill="${nc}" opacity=".35" filter="url(#bl)"/>`;
    }
    x += w + (R() < 0.3 ? 3 : 0.5);
  }
  const svg = `${svgOpen(-20, 40, 400, 150)}<defs><filter id="bl" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="2.5"/></filter>${lin('fg', [[0, col, 0], [1, '#b05a6a', near ? 0.25 : 0.38]])}</defs>${s}<rect x="-20" y="40" width="400" height="150" fill="url(#fg)"/></svg>`;
  return { key: near ? 'shop-skyline-near' : 'shop-skyline-far', x: -20, y: 40, w: 400, h: 150, depth: near ? -57 : -58, svg };
}

// ------------------------------------------------------------ wires + string lights
function wires(): Layer {
  let s = '';
  const w = (a: P, c: P, b: P, col: string, sw: number, o = 1) => `<path d="M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}" fill="none" stroke="${col}" stroke-width="${sw}" opacity="${o}"/>`;
  // power lines
  s += w([-6, 26], [60, 44], [127, 62], INK, 1.1, 0.9) + w([-6, 31], [60, 49], [127, 64], INK, 1, 0.8) + w([129, 62], [250, 52], [366, 30], INK, 1.1, 0.9) + w([129, 64], [250, 58], [366, 38], INK, 1, 0.8);
  s += `<path d="M-6 26 Q60 44 127 62" fill="none" stroke="#6a5a8a" stroke-width=".4" opacity=".5"/>`;
  // pole stub at the left edge
  s += `<rect x="-2" y="20" width="4" height="36" fill="${INK}" opacity=".9"/><rect x="-6" y="24" width="12" height="2" fill="${INK}"/><rect x="-6" y="30" width="12" height="2" fill="${INK}"/>`;
  // string lights
  s += w(STRING_A[0], STRING_A[1], STRING_A[2], '#120a1e', 1);
  s += w(STRING_B[0], STRING_B[1], STRING_B[2], '#120a1e', 1);
  for (const b of BULBS)
    s += `<path d="M${f(b.x)} ${f(b.y - 3.4)} v1.4" stroke="#120a1e" stroke-width="1"/><path d="M${f(b.x - 1.2)} ${f(b.y - 2)} h2.4 v1.3 h-2.4z" fill="#3a3040"/><ellipse cx="${f(b.x)}" cy="${f(b.y)}" rx="1.9" ry="2.4" fill="${b.c}" stroke="${INK}" stroke-opacity=".6" stroke-width=".5"/><ellipse cx="${f(b.x - 0.5)}" cy="${f(b.y - 0.7)}" rx=".6" ry=".9" fill="#fff" opacity=".85"/>`;
  return { key: 'shop-wires', x: 0, y: 0, w: 360, h: 80, depth: -50, svg: `${svgOpen(0, 0, 360, 80)}${s}</svg>` };
}

// ------------------------------------------------------------ eating zone (left): wall, shutter, tarp, poles
function eatzone(): Layer {
  const R = rng(3);
  let s = '';
  // wall siding
  s += `<rect x="0" y="100" width="160" height="86" fill="url(#ew)"/>`;
  for (let y = 106; y < 182; y += 7) s += `<path d="M0 ${y} H160" stroke="#1b1230" stroke-opacity=".16" stroke-width=".8"/>`;
  // AC unit and pipe
  s += `<rect x="8" y="104" width="30" height="14" rx="2" fill="#aab2be" stroke="${INK}" stroke-opacity=".7" stroke-width="1"/><rect x="11" y="107" width="24" height="7" rx="1" fill="#7c8696"/>${[0, 1, 2, 3, 4].map((i) => `<path d="M${12 + i * 5} 107 v7" stroke="#5c6676" stroke-width=".8"/>`).join('')}<path d="M36 114 q8 2 8 14 v26" stroke="#d8d0c4" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  // rolled shutter (closed shop)
  s += `<rect x="6" y="130" width="46" height="54" fill="#6a7280" stroke="${INK}" stroke-opacity=".8" stroke-width="1.2"/>`;
  for (let y = 133; y < 182; y += 4) s += `<path d="M6 ${y} H52" stroke="#2c3240" stroke-opacity=".6" stroke-width=".9"/><path d="M6 ${y + 1.2} H52" stroke="#a8b2c0" stroke-opacity=".35" stroke-width=".6"/>`;
  s += `<rect x="6" y="126" width="46" height="6" fill="#4a5262" stroke="${INK}" stroke-opacity=".8" stroke-width="1"/><circle cx="29" cy="178" r="1.6" fill="#2a2e3a"/>`;
  // window with curtain, warm light
  s += `<rect x="66" y="116" width="46" height="36" rx="3" fill="${INK}" opacity=".85"/><rect x="68.5" y="118.5" width="41" height="31" rx="1.6" fill="url(#ewin)"/>`;
  s += `<path d="M68.5 118.5 q6 14 0 31 h8 q-4 -15 0 -31z" fill="#e8c898" opacity=".75"/><path d="M109.5 118.5 q-6 14 0 31 h-8 q4 -15 0 -31z" fill="#e8c898" opacity=".75"/><path d="M89 118.5 V149.5" stroke="${INK}" stroke-opacity=".7" stroke-width="1.2"/><rect x="64" y="151" width="50" height="3" rx="1" fill="#4a3858"/>`;
  s += `<path d="M72 126 l10 -6 M84 126 l8 -6" stroke="#fff" stroke-opacity=".25" stroke-width="1.2" stroke-linecap="round"/>`;
  // mala poster
  s += `<rect x="120" y="120" width="24" height="30" rx="1.5" fill="#d6342b" stroke="${INK}" stroke-opacity=".7" stroke-width=".9"/><rect x="123" y="123" width="18" height="12" fill="#f6e7c8" opacity=".9"/><path d="M127 136 l3 6 l3 -6" fill="#ffb24a"/><circle cx="132" cy="129" r="3.2" fill="#b01e1e"/><rect x="123" y="143" width="18" height="2" fill="#ffd9a0" opacity=".8"/><rect x="123" y="146" width="12" height="1.4" fill="#ffd9a0" opacity=".6"/>`;
  // plant
  s += `<path d="M144 184 l2 -12 h10 l2 12 z" fill="#a8582a" stroke="${INK}" stroke-opacity=".8" stroke-width="1"/><path d="M150 172 q-8 -8 -5 -16 q5 4 5 16 M150 172 q8 -10 6 -18 q-6 6 -6 18 M150 172 q0 -12 3 -18 q3 8 -3 18" fill="#3a8a5a" stroke="${INK}" stroke-opacity=".6" stroke-width=".8"/>`;
  // shadow under tarp
  s += `<rect x="0" y="108" width="160" height="50" fill="url(#esh)"/>`;
  // tarp
  const stripes = 9;
  const sw = 126 / stripes;
  let tarp = '';
  for (let i = 0; i < stripes; i++) {
    const c = i % 2 ? '#eee6d6' : '#3a7aa0';
    const x0 = -2 + i * sw;
    tarp += `<path d="M${f(x0 + 6)} 84 H${f(x0 + sw + 6)} L${f(x0 + sw)} 112 H${f(x0)} Z" fill="${c}"/><path d="M${f(x0)} 112 a${f(sw / 2)} 6 0 0 0 ${f(sw)} 0 z" fill="${c}"/>`;
  }
  s += `<g stroke="${INK}" stroke-opacity=".55" stroke-width=".9" stroke-linejoin="round">${tarp}</g>`;
  s += `<path d="M4 84 H132 L124 112 H-2 Z" fill="url(#etl)"/>`;
  s += `<path d="M-2 112 H124" stroke="#9aa2b0" stroke-width="2"/><path d="M4 84 H132" stroke="#6a7280" stroke-width="2"/>`;
  s += `<path d="M10 90 q60 8 118 -2" stroke="#fff" stroke-opacity=".12" stroke-width="3" fill="none"/>`;
  // ropes + poles
  s += `<path d="M132 84 L152 70" stroke="#d8c8a0" stroke-width="1"/>`;
  for (const px of [3, 121]) s += `<rect x="${px - 1.4}" y="112" width="2.8" height="76" fill="url(#epole)" stroke="${INK}" stroke-opacity=".7" stroke-width=".7"/><rect x="${px - 4}" y="185" width="8" height="3" rx="1.2" fill="#5a6270" stroke="${INK}" stroke-opacity=".7" stroke-width=".8"/>`;
  // bulbs under tarp hem
  for (let i = 0; i < 8; i++) {
    const bx = 10 + i * 15.5;
    s += `<circle cx="${bx}" cy="${120 + Math.sin(i * 1.4) * 1.2}" r="2.6" fill="#ffe2a0" opacity=".9"/><circle cx="${bx}" cy="${120 + Math.sin(i * 1.4) * 1.2}" r="6" fill="url(#bg)" opacity=".7"/>`;
  }
  s += `<path d="M2 118 Q60 124 122 118" stroke="#120a1e" stroke-width=".8" fill="none"/>`;
  void R;
  const svg = `${svgOpen(0, 80, 160, 110)}<defs>${lin('ew', [[0, '#3a2a52'], [1, '#2a1c3c']])}${lin('ewin', [[0, '#ffc678'], [1, '#c8743a']])}${lin('esh', [[0, '#0c0618', 0.6], [1, '#0c0618', 0]])}${lin('etl', [[0, '#1b1230', 0.35], [1, '#fff', 0.1]])}${lin('epole', [[0, '#6a7280'], [0.5, '#b4bcc8'], [1, '#4a5262']], 0, 0, 1, 0)}${rad('bg', [[0, '#ffd890', 0.9], [1, '#ffd890', 0]])}</defs>${s}</svg>`;
  return { key: 'shop-eatzone', x: 0, y: 80, w: 160, h: 110, depth: -54, svg };
}

// ------------------------------------------------------------ the stall (right)
function stall(): Layer {
  let s = '';
  // facade
  s += `<rect x="150" y="34" width="210" height="152" fill="url(#sw)"/>`;
  for (let y = 46; y < 184; y += 11) s += `<path d="M150 ${y} H360" stroke="${INK}" stroke-opacity=".12" stroke-width=".8"/>`;
  s += `<rect x="150" y="34" width="210" height="9" fill="#150c14"/><rect x="150" y="43" width="210" height="1.6" fill="#c89868" opacity=".35"/><rect x="150" y="34" width="8" height="152" fill="#1c1018" opacity=".7"/>`;
  // roof tiles hint
  for (let x = 152; x < 360; x += 9) s += `<path d="M${x} 34 q4.5 -5 9 0" fill="#2a1a22" stroke="${INK}" stroke-opacity=".6" stroke-width=".8"/>`;
  // neon skewer icon (left of sign)
  s += `<g transform="translate(166 46)"><path d="M2 28 L22 2" stroke="#d9b070" stroke-width="1.6" stroke-linecap="round" opacity=".95"/><circle cx="8.5" cy="20" r="4" fill="#d6342b" stroke="#ff9a7a" stroke-width="1"/><circle cx="13.2" cy="14" r="4" fill="#ffb24a" stroke="#ffe0a0" stroke-width="1"/><circle cx="17.8" cy="8" r="3.6" fill="#6ec28a" stroke="#c8f0d0" stroke-width="1"/></g>`;
  // serving window
  s += `<rect x="238" y="102" width="122" height="52" fill="${INK}" opacity=".9"/><rect x="240" y="104" width="120" height="48" fill="url(#int)"/>`;
  // interior back wall + shelves
  s += `<rect x="240" y="104" width="120" height="48" fill="url(#intg)"/>`;
  for (const sy of [118, 134]) {
    s += `<rect x="242" y="${sy}" width="114" height="2.4" fill="#3a2018"/><rect x="242" y="${sy + 2.4}" width="114" height="1.2" fill="#000" opacity=".3"/>`;
  }
  const jars = ['#e8c878', '#d6342b', '#6ec28a', '#e8e0d0', '#ff8a3a', '#b01e1e', '#c8a060'];
  jars.forEach((c, i) => {
    s += `<rect x="${246 + i * 15.5}" y="${109.6}" width="8.6" height="8.4" rx="1.6" fill="${c}" stroke="${INK}" stroke-opacity=".7" stroke-width=".8"/><rect x="${247 + i * 15.5}" y="${108.4}" width="6.6" height="1.8" rx=".6" fill="#3a2418"/>`;
  });
  s += `<g transform="translate(268 126)">${Array.from({ length: 6 }).map((_, i) => `<rect x="${i * 5}" y="${(i % 2) * 1}" width="4.4" height="6.4" rx="1" fill="${['#e8d0a0', '#c8402a', '#8a5a34'][i % 3]}" stroke="${INK}" stroke-opacity=".6" stroke-width=".6"/>`).join('')}</g>`;
  // hanging chili strings + ladle
  for (const cx of [256, 290]) {
    s += `<path d="M${cx} 104 V${cx === 256 ? 124 : 118}" stroke="#6a4a2a" stroke-width=".8"/>`;
    for (let i = 0; i < 4; i++) s += `<ellipse cx="${cx + (i % 2 ? 1.2 : -1.2)}" cy="${108 + i * 4.6}" rx="1.8" ry="3" fill="#c0302a" stroke="${INK}" stroke-opacity=".6" stroke-width=".6"/>`;
  }
  s += `<path d="M308 104 V122" stroke="#8c97a6" stroke-width="1"/><ellipse cx="308" cy="124" rx="3.4" ry="2.4" fill="#aab2be" stroke="${INK}" stroke-opacity=".7" stroke-width=".7"/>`;
  // steaming pot + bowls on the right
  s += `<rect x="326" y="128" width="30" height="24" fill="${INK}" opacity=".18"/><rect x="326" y="132" width="28" height="20" rx="3" fill="#2a2020" stroke="${INK}" stroke-width="1"/><ellipse cx="340" cy="132" rx="14" ry="3.6" fill="#7a2418" stroke="${INK}" stroke-width="1"/><ellipse cx="340" cy="131.6" rx="12" ry="2.6" fill="url(#brth)"/><path d="M326 137 h-3 M354 137 h3" stroke="#2a2020" stroke-width="2.4" stroke-linecap="round"/>`;
  s += `<g><ellipse cx="318" cy="150" rx="6" ry="1.6" fill="#e8dcc0" stroke="${INK}" stroke-width=".7"/><ellipse cx="318" cy="147.6" rx="6" ry="1.6" fill="#f2e8d0" stroke="${INK}" stroke-width=".7"/><ellipse cx="318" cy="145.2" rx="6" ry="1.6" fill="#e8dcc0" stroke="${INK}" stroke-width=".7"/></g>`;
  // window frame highlights
  s += `<rect x="236" y="100" width="126" height="4" fill="#4a2c1a" stroke="${INK}" stroke-opacity=".8" stroke-width="1"/><rect x="236" y="100" width="126" height="1.2" fill="#c89868" opacity=".5"/><rect x="236" y="102" width="4" height="52" fill="#3a2214"/>`;
  // counter
  s += `<rect x="236" y="154" width="124" height="30" fill="#5a3a28"/>`;
  for (let i = 0; i < 9; i++) s += `<rect x="${238 + i * 14}" y="156" width="13" height="26" rx="1" fill="${i % 2 ? '#6a4630' : '#5e3e2a'}" stroke="${INK}" stroke-opacity=".55" stroke-width=".8"/><path d="M${241 + i * 14} 160 v18 M${245 + i * 14} 162 v12" stroke="#2a1a10" stroke-opacity=".3" stroke-width=".6"/>`;
  s += `<rect x="236" y="154" width="124" height="3" fill="#8c97a6" opacity=".55"/><rect x="236" y="180" width="124" height="4" fill="#2a1a14"/>`;
  // counter top
  s += `<path d="M232 149 H360 V155.4 H234 Z" fill="url(#ctop)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
  for (const [x1, y1, x2] of [[240, 151.4, 290], [262, 153, 330], [300, 150.6, 356], [236, 154, 250]]) s += `<path d="M${x1} ${y1} H${x2}" stroke="#5c3a20" stroke-opacity=".5" stroke-width=".6"/>`;
  s += `<path d="M232 149.6 H360" stroke="#e8c898" stroke-opacity=".6" stroke-width="1"/>`;
  // glass display box
  const D = DISPLAY_BOX;
  s += `<rect x="${D.x}" y="${D.y}" width="${D.w}" height="${D.h}" rx="2" fill="#2a1810" opacity=".9"/><rect x="${D.x + 2}" y="${D.y + 2}" width="${D.w - 4}" height="${D.h - 4}" fill="url(#box)"/>`;
  s += `<rect x="${D.x + 2}" y="${D.y + 14}" width="${D.w - 4}" height="1.6" fill="#cfe8f0" opacity=".55"/><rect x="${D.x + 2}" y="${D.y + 24}" width="${D.w - 4}" height="1.6" fill="#cfe8f0" opacity=".55"/>`;
  const R = rng(9);
  const chunk = ['#c0502a', '#7a3a1c', '#d6342b', '#e8c060', '#6ec28a', '#f2e8d0'];
  for (const [ry, n] of [[D.y + 13.6, 16], [D.y + 23.4, 14], [D.y + 31.2, 0]] as const)
    for (let i = 0; i < n; i++)
      if (R() < 0.8) {
        const x = D.x + 5 + i * 5.7;
        s += `<path d="M${f(x)} ${ry} v-9" stroke="#d9b070" stroke-width=".7"/><circle cx="${f(x)}" cy="${f(ry - 2)}" r="1.5" fill="${chunk[Math.floor(R() * 6)]}"/><circle cx="${f(x)}" cy="${f(ry - 5)}" r="1.5" fill="${chunk[Math.floor(R() * 6)]}"/>`;
      }
  s += `<rect x="${D.x}" y="${D.y}" width="${D.w}" height="${D.h}" rx="2" fill="none" stroke="#a8b2c0" stroke-width="1.6"/><rect x="${D.x}" y="${D.y}" width="${D.w}" height="${D.h}" rx="2" fill="none" stroke="${INK}" stroke-opacity=".7" stroke-width=".8"/>`;
  s += `<path d="M${D.x + 8} ${D.y + 2} l16 0 l-10 ${D.h - 4} h-12 z" fill="#fff" opacity=".13"/><path d="M${D.x + 34} ${D.y + 2} l6 0 l-10 ${D.h - 4} h-6 z" fill="#fff" opacity=".1"/>`;
  s += `<rect x="${D.x - 2}" y="${D.y + D.h - 1}" width="${D.w + 4}" height="3.4" rx="1" fill="#8c97a6" stroke="${INK}" stroke-opacity=".7" stroke-width=".8"/><rect x="${D.x}" y="${D.y + 1}" width="${D.w}" height="1.6" fill="#ffd890" opacity=".7"/>`;
  // tongs tray / tissue
  s += `<rect x="348" y="141" width="9" height="8" rx="1.4" fill="#d6342b" stroke="${INK}" stroke-width=".8"/><path d="M349 141 l3 -3 l4 3" fill="#fff" stroke="${INK}" stroke-opacity=".6" stroke-width=".6"/>`;
  s += `<path d="M236 148 l4 -6 l4 6 z" fill="#aab2be" stroke="${INK}" stroke-width=".7"/>`;
  // fridge
  s += `<rect x="197" y="126" width="38" height="58" rx="3" fill="url(#fr)" stroke="${INK}" stroke-width="1.2"/><rect x="199" y="128" width="34" height="5" rx="1.4" fill="#3a7aa0"/><path d="M206 130.6 h10 M222 130.6 h6" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".8"/>`;
  s += `<rect x="201" y="135" width="30" height="40" rx="1.6" fill="url(#fglass)" stroke="${INK}" stroke-opacity=".7" stroke-width="1"/>`;
  const bc = ['#6ec28a', '#ff8a3a', '#d6342b', '#f2ece0', '#3aa0d0', '#ffd23a'];
  for (let r = 0; r < 3; r++) {
    s += `<rect x="201" y="${146 + r * 11}" width="30" height="1.6" fill="#cfe8f0" opacity=".55"/>`;
    for (let i = 0; i < 6; i++) s += `<rect x="${203 + i * 4.7}" y="${137 + r * 11}" width="3.4" height="8.6" rx="1.2" fill="${bc[(i + r * 2) % 6]}" stroke="${INK}" stroke-opacity=".55" stroke-width=".5"/><rect x="${203.7 + i * 4.7}" y="${136 + r * 11}" width="2" height="1.4" fill="#e8e0d0"/>`;
  }
  s += `<path d="M203 136 L214 136 L204 174 L203 174 Z" fill="#fff" opacity=".13"/><rect x="229" y="140" width="1.6" height="22" rx=".8" fill="#d8dee8" stroke="${INK}" stroke-opacity=".6" stroke-width=".5"/>`;
  s += `<rect x="199" y="177" width="34" height="5" rx="1" fill="#2c3240"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${202 + i * 4.6} 178 v3" stroke="#6a7280" stroke-width=".8"/>`).join('')}`;
  s += `<path d="M197 130 v50" stroke="#9ad8e8" stroke-opacity=".35" stroke-width="1"/>`;
  // queue number display
  const Q = QDISPLAY;
  s += `<path d="M${Q.x + 6} 104 V${Q.y} M${Q.x + Q.w - 6} 104 V${Q.y}" stroke="#8c97a6" stroke-width="1"/><rect x="${Q.x}" y="${Q.y}" width="${Q.w}" height="${Q.h}" rx="2.4" fill="#120a10" stroke="#8c97a6" stroke-width="1.2"/><rect x="${Q.x + 2}" y="${Q.y + 2}" width="${Q.w - 4}" height="${Q.h - 4}" rx="1.4" fill="#2a0a0c"/>`;
  s += `<path d="M${Q.x + 8} ${Q.y + 8.5} h4.5 M${Q.x + Q.w - 12.5} ${Q.y + 8.5} h4.5" stroke="#ff3a2a" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`;
  // menu board
  s += `<path d="M163 104 V110 M185 104 V110" stroke="#8c97a6" stroke-width="1"/><rect x="157" y="110" width="34" height="44" rx="2.4" fill="#4a2c1a" stroke="${INK}" stroke-width="1.2"/><rect x="159.4" y="112.4" width="29.2" height="39.2" rx="1.4" fill="#1e2e2a"/><rect x="159.4" y="112.4" width="29.2" height="8" rx="1.4" fill="#c0302a"/><circle cx="165" cy="116.4" r="2" fill="#ffd9a0"/><rect x="169" y="115" width="14" height="2.6" rx="1.2" fill="#ffd9a0" opacity=".85"/>`;
  for (let i = 0; i < 5; i++) s += `<rect x="162" y="${124 + i * 5.8}" width="${12 + (i % 3) * 3}" height="1.8" rx=".9" fill="#f2ece0" opacity=".8"/><rect x="178" y="${124 + i * 5.8}" width="7" height="1.8" rx=".9" fill="#ffd23a" opacity=".85"/>`;
  s += `<path d="M160 112 l10 40" stroke="#fff" stroke-opacity=".07" stroke-width="5"/>`;
  // sign board
  const G = SIGN;
  s += `<path d="M196 78 V84 M326 78 V84" stroke="${INK}" stroke-width="2.4"/><rect x="${G.x - 5}" y="${G.y - 4}" width="${G.w + 10}" height="${G.h + 8}" rx="9" fill="#2a1a14" stroke="${INK}" stroke-width="1.4"/><rect x="${G.x - 5}" y="${G.y - 4}" width="${G.w + 10}" height="2" rx="1" fill="#c89868" opacity=".35"/>`;
  s += `<rect x="${G.x}" y="${G.y}" width="${G.w}" height="${G.h}" rx="6" fill="url(#sgn)"/><rect x="${G.x}" y="${G.y}" width="${G.w}" height="${G.h}" rx="6" fill="url(#sglow)"/>`;
  s += `<rect x="${G.x}" y="${G.y}" width="${G.w}" height="${G.h}" rx="6" fill="none" stroke="#ff7a4a" stroke-opacity=".28" stroke-width="5"/><rect x="${G.x}" y="${G.y}" width="${G.w}" height="${G.h}" rx="6" fill="none" stroke="#ff7a4a" stroke-width="2"/><rect x="${G.x + 3}" y="${G.y + 3}" width="${G.w - 6}" height="${G.h - 6}" rx="3.4" fill="none" stroke="#ffd0a0" stroke-opacity=".5" stroke-width=".7"/>`;
  s += `<circle cx="${G.x + 3.6}" cy="${G.y + 3.6}" r="1" fill="#ffe0a0"/><circle cx="${G.x + G.w - 3.6}" cy="${G.y + 3.6}" r="1" fill="#ffe0a0"/><circle cx="${G.x + 3.6}" cy="${G.y + G.h - 3.6}" r="1" fill="#ffe0a0"/><circle cx="${G.x + G.w - 3.6}" cy="${G.y + G.h - 3.6}" r="1" fill="#ffe0a0"/>`;
  // wall shadow under awning
  s += `<rect x="150" y="104" width="210" height="22" fill="url(#ash)"/>`;
  // awning
  const n = 10;
  const aw = 210 / n;
  let aws = '';
  for (let i = 0; i < n; i++) {
    const c = i % 2 ? '#f2e6d0' : '#c0302a';
    aws += `<path d="M${150 + i * aw} 80 h${aw} v${22} h-${aw} z" fill="${c}"/><path d="M${150 + i * aw} 102 a${aw / 2} 7 0 0 0 ${aw} 0 z" fill="${c}"/>`;
  }
  s += `<g stroke="${INK}" stroke-opacity=".6" stroke-width="1" stroke-linejoin="round">${aws}</g><rect x="150" y="78" width="210" height="5" fill="#7a1c18" stroke="${INK}" stroke-opacity=".7" stroke-width="1"/><rect x="150" y="80" width="210" height="22" fill="url(#awl)"/>`;
  // bunting
  const pts: P[] = [];
  let b = '<path d="M156 108 Q254 120 356 108" fill="none" stroke="#2a1a22" stroke-width=".9"/>';
  const bcol = ['#d6342b', '#ffb24a', '#6ec28a', '#f6e7c8', '#3a7aa0'];
  for (let i = 0; i < 22; i++) {
    const t = (i + 0.5) / 22;
    const p = bez([156, 108], [254, 120], [356, 108], t);
    pts.push(p);
    b += `<path d="M${f(p[0] - 3.2)} ${f(p[1])} L${f(p[0] + 3.2)} ${f(p[1] + 0.2)} L${f(p[0])} ${f(p[1] + 8)} Z" fill="${bcol[i % 5]}" stroke="${INK}" stroke-opacity=".6" stroke-width=".7" stroke-linejoin="round"/>`;
  }
  s += b;
  // lanterns
  for (const L of LANTERNS) {
    s += `<path d="M${L.x} 102 V${L.y - 6}" stroke="#2a1a22" stroke-width=".9"/><rect x="${L.x - 2.6}" y="${L.y - 7}" width="5.2" height="2" rx=".8" fill="#d8a838" stroke="${INK}" stroke-width=".6"/><ellipse cx="${L.x}" cy="${L.y}" rx="6.4" ry="6.2" fill="url(#lan)" stroke="${INK}" stroke-width="1"/><path d="M${L.x - 3.2} ${L.y - 5.6} Q${L.x - 5} ${L.y} ${L.x - 3.2} ${L.y + 5.6} M${L.x} ${L.y - 6.2} V${L.y + 6.2} M${L.x + 3.2} ${L.y - 5.6} Q${L.x + 5} ${L.y} ${L.x + 3.2} ${L.y + 5.6}" stroke="#7a1010" stroke-opacity=".6" stroke-width=".7" fill="none"/><rect x="${L.x - 2.6}" y="${L.y + 5.8}" width="5.2" height="2" rx=".8" fill="#d8a838" stroke="${INK}" stroke-width=".6"/><path d="M${L.x} ${L.y + 7.8} v4" stroke="#ffd890" stroke-width=".8"/>`;
  }
  const defsStr = `${lin('sw', [[0, '#3c2434'], [1, '#2a1a22']])}${lin('int', [[0, '#8a4a28'], [1, '#c87838']])}${lin('intg', [[0, '#000', 0.35], [0.4, '#000', 0], [1, '#ffb24a', 0.15]])}${rad('brth', [[0, '#fff0c0'], [0.7, '#e8a050'], [1, '#c0602a']])}${lin('ctop', [[0, '#c89868'], [1, '#8a5a34']])}${lin('box', [[0, '#4a2c1c'], [1, '#2a1810']])}${lin('fr', [[0, '#7a8696'], [1, '#4a5666']], 0, 0, 1, 0)}${lin('fglass', [[0, '#e8fafc'], [1, '#8ac8d8']])}${lin('sgn', [[0, '#3a1218'], [1, '#26090f']])}${rad('sglow', [[0, '#ff6a2a', 0.42], [1, '#ff6a2a', 0]], 0.5, 0.5, 0.55)}${lin('ash', [[0, '#0c0618', 0.65], [1, '#0c0618', 0]])}${lin('awl', [[0, '#1b1230', 0.35], [1, '#fff', 0.08]])}${rad('lan', [[0, '#ff9a6a'], [0.6, '#d6342b'], [1, '#a01a1a']])}`;
  return { key: 'shop-stall', x: 150, y: 30, w: 210, h: 160, depth: -53, svg: `${svgOpen(150, 30, 210, 160)}<defs>${defsStr}</defs>${s}</svg>` };
}

// ------------------------------------------------------------ lamp post
function lamp(): Layer {
  const s = `<path d="M124 76 H133 V182 H124 Z" fill="url(#lp)" stroke="${INK}" stroke-width="1.1"/><rect x="119" y="176" width="19" height="8" rx="2" fill="#3a3048" stroke="${INK}" stroke-width="1"/><rect x="121" y="171" width="15" height="6" rx="1.4" fill="#4a3e5c" stroke="${INK}" stroke-width=".9"/>
<rect x="122" y="88" width="13" height="2.4" fill="#2a2030"/><rect x="122" y="150" width="13" height="2.4" fill="#2a2030"/>
<rect x="125.4" y="118" width="6" height="8" fill="#e8c878" opacity=".85" transform="rotate(-4 128 122)"/><rect x="125.6" y="132" width="5" height="6" fill="#6ad0ff" opacity=".7"/>
<path d="M127 86 q-8 12 -2 28 q4 6 2 10" stroke="${INK}" stroke-width="1" fill="none"/>
<path d="M114 72 Q128 54 142 72 L140 74 H116 Z" fill="#2a2030" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/><path d="M118 68 Q128 59 138 68" stroke="#6a5a7a" stroke-width="1" fill="none"/>
<path d="M120 72 Q128 78 136 72 L134 70 H122 Z" fill="#ffe8b0" stroke="${INK}" stroke-width=".8"/><ellipse cx="128" cy="71" rx="5" ry="3" fill="#fff6d0"/><rect x="126" y="72" width="4" height="4" fill="#3a3048"/><path d="M128 56 v-4" stroke="${INK}" stroke-width="1.4"/>`;
  return { key: 'shop-lamp', x: 112, y: 50, w: 34, h: 136, depth: -52, svg: `${svgOpen(112, 50, 34, 136)}<defs>${lin('lp', [[0, '#5a4c6c'], [0.4, '#7a6c8a'], [1, '#2a2030']], 0, 0, 1, 0)}</defs>${s}</svg>` };
}

// ------------------------------------------------------------ ground
function ground(): Layer {
  const R = rng(21);
  let s = `<rect x="0" y="176" width="360" height="12" fill="#1c1228"/>`;
  s += `<rect x="0" y="184" width="360" height="47" fill="url(#fp)"/>`;
  const rows: [number, number, number][] = [[184, 12, 34], [196, 15, 42], [211, 19, 56]];
  rows.forEach(([y, h, w], ri) => {
    for (let x = -(ri % 2) * (w / 2); x < 360; x += w) {
      const lt = R() * 0.1;
      s += `<rect x="${f(x + 0.6)}" y="${y + 0.6}" width="${f(w - 1.2)}" height="${h - 1.2}" rx="1" fill="#fff" opacity="${f(0.02 + lt)}"/>`;
      s += `<path d="M${f(x)} ${y} V${y + h}" stroke="#150e22" stroke-opacity=".6" stroke-width="1"/>`;
    }
    s += `<path d="M0 ${y} H360" stroke="#150e22" stroke-opacity=".65" stroke-width="1"/><path d="M0 ${y + 1} H360" stroke="#8a78a8" stroke-opacity=".12" stroke-width=".7"/>`;
  });
  // tactile strip
  s += `<rect x="0" y="222" width="360" height="5.6" fill="#c8a040" opacity=".5"/>`;
  for (let x = 3; x < 360; x += 6.5) s += `<circle cx="${x}" cy="224.8" r="1.1" fill="#6a5018" opacity=".7"/>`;
  s += `<path d="M0 230 H360" stroke="${INK}" stroke-width="1"/>`;
  // kerb
  s += `<rect x="0" y="229.5" width="360" height="3.4" fill="#76658a"/><rect x="0" y="229.5" width="360" height="1" fill="#b8a8d0" opacity=".6"/><rect x="0" y="232.9" width="360" height="5" fill="#291f38"/><path d="M0 238 H360" stroke="${INK}" stroke-width="1"/>`;
  for (let x = 22; x < 360; x += 61) s += `<path d="M${x} 229.5 V238" stroke="${INK}" stroke-opacity=".6" stroke-width=".9"/>`;
  // street
  s += `<rect x="0" y="238" width="360" height="12" fill="url(#st)"/>`;
  for (let i = 0; i < 70; i++) s += `<circle cx="${f(R() * 360)}" cy="${f(239 + R() * 11)}" r=".5" fill="#fff" opacity="${f(0.04 + R() * 0.08)}"/>`;
  for (let x = 6; x < 360; x += 52) s += `<rect x="${x}" y="246.4" width="22" height="1.6" rx=".8" fill="#f6e7c8" opacity=".28"/>`;
  // drain grate
  s += `<rect x="236" y="225.4" width="22" height="4" fill="#0c0814"/>${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${239 + i * 3.4} 225.6 v3.6" stroke="#4a4058" stroke-width="1"/>`).join('')}`;
  // puddles with reflections
  const pud = (cx: number, cy: number, rx: number, ry: number, refl: string, streak: number) =>
    `<clipPath id="pc${cx}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath><ellipse cx="${cx}" cy="${cy}" rx="${rx + 1}" ry="${ry + 0.8}" fill="#0c0618" opacity=".35"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1a1230" stroke="#8a78b0" stroke-opacity=".4" stroke-width=".8"/><g clip-path="url(#pc${cx})"><rect x="${cx - rx}" y="${cy - ry}" width="${rx * 2}" height="${ry * 2}" fill="#3a2a60" opacity=".5"/>${refl}<ellipse cx="${cx - streak}" cy="${cy}" rx="${rx * 0.5}" ry="${ry * 0.45}" fill="#fff" opacity=".1"/></g><ellipse cx="${cx + rx * 0.2}" cy="${cy + ry * 0.2}" rx="${rx * 0.28}" ry="${ry * 0.3}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width=".5"/>`;
  s += pud(126, 202, 24, 4.6, `<rect x="123" y="${197}" width="6" height="10" fill="#ffd890" opacity=".85"/><ellipse cx="126" cy="202" rx="12" ry="3" fill="#ffb24a" opacity=".35"/>`, 4);
  s += pud(58, 214, 20, 4, `<rect x="40" y="209" width="9" height="10" fill="#3a7aa0" opacity=".55"/><rect x="49" y="209" width="9" height="10" fill="#eee6d6" opacity=".4"/><rect x="58" y="209" width="9" height="10" fill="#3a7aa0" opacity=".55"/>`, 6);
  s += pud(304, 216, 28, 4.8, `<rect x="288" y="210" width="8" height="12" fill="#d6342b" opacity=".6"/><rect x="304" y="210" width="8" height="12" fill="#ff8a3a" opacity=".6"/><ellipse cx="296" cy="216" rx="18" ry="3.4" fill="#ff6a2a" opacity=".3"/>`, 8);
  s += pud(190, 226, 14, 2.8, `<ellipse cx="190" cy="226" rx="8" ry="2" fill="#ffb24a" opacity=".3"/>`, 3);
  s += pud(92, 244.4, 22, 2.8, `<rect x="84" y="241" width="10" height="7" fill="#ffd890" opacity=".3"/>`, 6);
  // litter + leaves
  s += `<path d="M34 200 l3 -1 l1 2 l-3 1 z" fill="#8a6a3a" opacity=".8"/><path d="M210 214 l2.5 -.8 l.8 1.6 l-2.5 .8 z" fill="#6a8a4a" opacity=".7"/><rect x="264" y="199" width="4" height="2" rx=".6" fill="#d8c8a0" opacity=".7"/><path d="M340 190 l2 -1 l1 1.6 l-2 1 z" fill="#8a6a3a" opacity=".8"/>`;
  return { key: 'shop-ground', x: 0, y: 176, w: 360, h: 74, depth: -55, svg: `${svgOpen(0, 176, 360, 74)}<defs>${lin('fp', [[0, '#40344f'], [1, '#2c2240']])}${lin('st', [[0, '#1a1228'], [1, '#100a1a']])}</defs>${s}</svg>` };
}

export function sceneryLayers(): Layer[] {
  return [sky(), skyline(false), skyline(true), ground(), eatzone(), stall(), lamp(), wires()];
}
void lighten;
