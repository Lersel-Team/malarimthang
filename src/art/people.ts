// Customer art: 5 archetypes x 8 variants, each baked as ONE sprite sheet (12 frames) from a parameterised SVG.
// Facing right, ~40 px tall, warm rim light on the right (stall) edge, cool moon rim on the left.
import type Phaser from 'phaser';
import type { ArchetypeId } from '../data/balance';
import { RES } from '../engine/hidpi';
import { loadSvg } from './svg';
import { INK, LAMP, darken, f, hash32, lighten, lin, svgOpen } from './shop/util';

export type NameOrigin = string;
export const ARCH_LIST: ArchetypeId[] = ['student', 'office', 'family', 'tourist', 'nightowl'];
export const VARIANTS = 8;
export const CW = 48;
export const CH = 54;
/** Feet baseline inside a frame (frame origin y = FEET_Y / CH, x = 0.5). */
export const FEET_Y = 49;
export const FRAMES = ['walk0', 'walk1', 'walk2', 'walk3', 'idle', 'pick', 'sit', 'eat0', 'eat1', 'happy', 'angry0', 'angry1'] as const;
export type FrameName = (typeof FRAMES)[number];
const COLS = 4;

export const sheetKey = (a: ArchetypeId, v: number) => `cust-${a}-${v}`;

/** Variant 0..7 for a customer id. 0-4 Thai looks, 5 east-asian, 6 western, 7 malay. */
export function variantFor(id: number, origin: NameOrigin | undefined): number {
  const h = hash32(id * 7919 + 13);
  switch (origin) {
    case 'english':
      return 6;
    case 'mandarin':
    case 'cantonese':
      return 5;
    case 'malay':
      return 7;
    default:
      return h % 5;
  }
}

// ------------------------------------------------------------------ looks
type Hair = 'short' | 'buzz' | 'spiky' | 'bob' | 'long' | 'pony' | 'bun' | 'curly' | 'hijab' | 'side';
type Acc =
  | 'glasses' | 'sunglasses' | 'cap' | 'bucket' | 'straw' | 'beanie' | 'headphones' | 'mask'
  | 'lanyard' | 'tie' | 'backpack' | 'camera' | 'scarf' | 'hood' | 'pattern';
type Item = 'none' | 'bag' | 'brief' | 'shopbag' | 'cup';

interface Look {
  skin: string; hair: string; hs: Hair; top: string; bottom: string; shoe: string;
  skirt: boolean; longSleeve: boolean; longPants: boolean; acc: Acc[]; item: Item; accent: string; sleepy: boolean; kid: boolean; blush: string;
}

const SKIN = ['#f3c9a0', '#e0a574', '#c58a5b', '#e9b98a', '#9c6639', '#fde3c8', '#f6d2bd', '#b9794a'];
const HAIR = ['#1a1418', '#2a1f22', '#3a2418', '#161a2a', '#4a2c1a'];
const FEMALE: Hair[] = ['bob', 'long', 'pony', 'bun', 'hijab'];

interface Row { hs: Hair; acc: Acc[]; top: string; bottom: string; item?: Item; hair?: string; accent?: string; shoe?: string }
const ROWS: Record<ArchetypeId, Row[]> = {
  student: [
    { hs: 'short', acc: ['backpack'], top: '#f4f1ea', bottom: '#1f2d6a', accent: '#3a6ac0' },
    { hs: 'bob', acc: ['backpack', 'scarf'], top: '#f4f1ea', bottom: '#1f2d6a', accent: '#c0302a' },
    { hs: 'pony', acc: ['backpack', 'glasses'], top: '#eef0f4', bottom: '#2a2a3a', accent: '#d6342b' },
    { hs: 'buzz', acc: ['backpack'], top: '#f4f1ea', bottom: '#1f2d6a', accent: '#6ec28a' },
    { hs: 'long', acc: ['backpack'], top: '#f6f1e6', bottom: '#1f2d6a', accent: '#ffb24a' },
    { hs: 'side', acc: ['backpack', 'glasses'], top: '#f4f1ea', bottom: '#2a2a3a', accent: '#3a6ac0' },
    { hs: 'spiky', acc: ['backpack'], top: '#e8eef8', bottom: '#44506a', hair: '#d9a441', accent: '#d6342b' },
    { hs: 'hijab', acc: ['backpack'], top: '#f4f1ea', bottom: '#1f2d6a', hair: '#e8d9c4', accent: '#3a6ac0' },
  ],
  office: [
    { hs: 'short', acc: ['tie'], top: '#cfe0f2', bottom: '#2c2f3e', item: 'brief', accent: '#c0302a' },
    { hs: 'bob', acc: ['lanyard'], top: '#f6f2ec', bottom: '#2c2f3e', item: 'bag', accent: '#3a6ac0' },
    { hs: 'long', acc: ['lanyard', 'glasses'], top: '#f4c6cc', bottom: '#3a3446', item: 'bag', accent: '#d6342b' },
    { hs: 'side', acc: ['lanyard', 'glasses'], top: '#d6cdf0', bottom: '#2c2f3e', item: 'brief', accent: '#6ec28a' },
    { hs: 'pony', acc: ['lanyard'], top: '#bfe6d4', bottom: '#2c3a46', item: 'bag', accent: '#ffb24a' },
    { hs: 'short', acc: ['tie', 'glasses'], top: '#eef3f8', bottom: '#2a3350', item: 'brief', accent: '#3a6ac0' },
    { hs: 'side', acc: ['tie'], top: '#f2ece4', bottom: '#3a3a4a', item: 'brief', hair: '#a64a28', accent: '#6a2a8a' },
    { hs: 'hijab', acc: ['lanyard'], top: '#e6dcf0', bottom: '#2a2a46', item: 'bag', hair: '#2a2a46', accent: '#d6342b' },
  ],
  family: [
    { hs: 'short', acc: [], top: '#3aa0a0', bottom: '#33405a', item: 'shopbag', accent: '#f2c230' },
    { hs: 'bun', acc: [], top: '#e0a030', bottom: '#33405a', item: 'shopbag', accent: '#d6342b' },
    { hs: 'pony', acc: [], top: '#e8705a', bottom: '#2c3a4a', item: 'bag', accent: '#3a7a9a' },
    { hs: 'buzz', acc: ['glasses'], top: '#5a8a4a', bottom: '#3a3a4a', item: 'shopbag', accent: '#ffb24a' },
    { hs: 'curly', acc: [], top: '#8a5aa8', bottom: '#33405a', item: 'bag', accent: '#f2c230' },
    { hs: 'side', acc: [], top: '#4a78b8', bottom: '#3a3a4a', item: 'shopbag', accent: '#d6342b' },
    { hs: 'bun', acc: [], top: '#d8e8f0', bottom: '#3a4a6a', item: 'bag', hair: '#a64a28', accent: '#6ec28a' },
    { hs: 'hijab', acc: [], top: '#c4586a', bottom: '#2a2a46', item: 'bag', hair: '#3f8f7a', accent: '#f2c230' },
  ],
  tourist: [
    { hs: 'short', acc: ['bucket', 'camera', 'pattern'], top: '#ff8a3a', bottom: '#d8c8a0', accent: '#fff0c0' },
    { hs: 'long', acc: ['straw', 'camera', 'pattern'], top: '#3fb0b0', bottom: '#e8d8b0', accent: '#ff7a8a' },
    { hs: 'short', acc: ['cap', 'backpack'], top: '#f2c230', bottom: '#5a6a8a', accent: '#d6342b' },
    { hs: 'bob', acc: ['bucket', 'sunglasses', 'camera'], top: '#e86a8a', bottom: '#d8c8a0', accent: '#fff0c0' },
    { hs: 'curly', acc: ['backpack', 'pattern'], top: '#6ec28a', bottom: '#c8b890', accent: '#fff0c0' },
    { hs: 'short', acc: ['cap', 'mask', 'camera'], top: '#e8e8f0', bottom: '#3a3a4a', accent: '#3a6ac0' },
    { hs: 'side', acc: ['straw', 'sunglasses', 'backpack', 'pattern'], top: '#ff6a4a', bottom: '#e8d8b0', hair: '#d9a441', accent: '#fff0c0' },
    { hs: 'hijab', acc: ['backpack', 'camera'], top: '#e8a05a', bottom: '#5a4a6a', hair: '#e8d9c4', accent: '#fff0c0' },
  ],
  nightowl: [
    { hs: 'short', acc: ['hood', 'headphones'], top: '#2a2a38', bottom: '#33405a', item: 'cup', accent: '#ff6a2a' },
    { hs: 'bob', acc: ['beanie', 'mask'], top: '#3a2a4a', bottom: '#222230', accent: '#6ec28a' },
    { hs: 'spiky', acc: ['hood'], top: '#44304a', bottom: '#33405a', item: 'cup', hair: '#8a4aa8', accent: '#ff6a2a' },
    { hs: 'long', acc: ['headphones'], top: '#222a3a', bottom: '#2a2a38', item: 'cup', accent: '#3a6ac0' },
    { hs: 'buzz', acc: ['cap', 'mask'], top: '#1e1e26', bottom: '#33405a', accent: '#d6342b' },
    { hs: 'side', acc: ['hood'], top: '#2c3446', bottom: '#222230', item: 'cup', accent: '#ffb24a' },
    { hs: 'short', acc: ['beanie', 'hood'], top: '#3a4a3a', bottom: '#33405a', item: 'cup', hair: '#7a5230', accent: '#ff6a2a' },
    { hs: 'bun', acc: ['cap', 'headphones'], top: '#2a2a46', bottom: '#222230', item: 'cup', hair: '#1a1418', accent: '#6ec28a' },
  ],
};
const CAPCOL = ['#c0302a', '#3a6ac0', '#2a2a38', '#e8d8b0', '#6ec28a'];

function skinFor(v: number, a: number) {
  return v < 5 ? SKIN[(v + a) % 5 === 4 ? 4 : (v + a) % 5] : SKIN[v];
}

export function lookFor(arch: ArchetypeId, v: number): Look {
  const a = ARCH_LIST.indexOf(arch);
  const r = ROWS[arch][v];
  const female = FEMALE.includes(r.hs);
  const hair = r.hair ?? (v === 6 ? ['#d9a441', '#a64a28', '#7a5230'][a % 3] : HAIR[(v * 2 + a) % HAIR.length]);
  const skirt = female && r.hs !== 'hijab' && (arch === 'student' || arch === 'office') && v !== 0;
  const hij = r.hs === 'hijab';
  return {
    skin: skinFor(v, a), hair, hs: r.hs, top: r.top, bottom: r.bottom,
    shoe: arch === 'student' ? '#f2f2f2' : arch === 'tourist' ? '#b89868' : arch === 'nightowl' ? (v % 2 ? '#f2f2f2' : '#6a2a2a') : '#23202c',
    skirt: skirt || (hij && (arch === 'student' || arch === 'office')),
    longSleeve: hij || arch === 'office' && v % 2 === 0 || arch === 'nightowl',
    longPants: hij || arch === 'office' && !skirt || arch === 'nightowl' || arch === 'family' || (arch === 'student' && v === 6),
    acc: r.acc, item: r.item ?? 'none', accent: r.accent ?? '#ffb24a', sleepy: arch === 'nightowl', kid: false,
    blush: v === 6 ? '#ff6a6a' : '#ff7a7a',
  };
}

export function kidLookFor(v: number): Look {
  const tops = ['#f2c230', '#ff8aa0', '#6ab8e8', '#9ad870', '#ff8a3a', '#c8a0f0', '#f2c230', '#ff8aa0'];
  const base = lookFor('family', v);
  const girl = v % 2 === 1;
  return {
    ...base, skin: v < 5 ? SKIN[(v + 2) % 5] : base.skin, hair: base.hs === 'hijab' ? '#1a1418' : HAIR[(v + 1) % HAIR.length],
    hs: girl ? (v === 7 ? 'bob' : 'pony') : 'short', top: tops[v], bottom: girl ? '#c05a8a' : '#4a5a8a',
    skirt: girl, longSleeve: false, longPants: false, acc: v % 3 === 0 && !girl ? ['cap'] : [], item: 'none', shoe: '#f2f2f2', sleepy: false, kid: true,
  };
}

// ------------------------------------------------------------------ drawing
type Face = 'neutral' | 'happy' | 'angry' | 'eatOpen' | 'eatShut' | 'pick';
interface Spec {
  legs: 'walk' | 'stand' | 'sit' | 'stomp';
  p?: number; // walk phase
  dy?: number; // upper body vertical shift
  lean?: number; // degrees
  front: [number, number]; // hand targets relative to shoulder
  back: [number, number];
  face: Face;
  skewer?: { ang: number; n: number };
  keepItem?: boolean;
  fx?: 'sparkle' | 'steam0' | 'steam1';
  jump?: number;
}

const HX = 25;
const HY = 19.5;
const SH: [number, number] = [24.5, 30.2];
const ol = (w = 1.1) => `stroke="${INK}" stroke-opacity=".85" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

function ik(s: [number, number], h: [number, number], bend: number): { e: [number, number]; h: [number, number] } {
  const L = 4.7;
  let dx = h[0] - s[0];
  let dy = h[1] - s[1];
  let d = Math.hypot(dx, dy);
  if (d > 2 * L - 0.05) {
    const k = (2 * L - 0.05) / d;
    dx *= k;
    dy *= k;
    d = 2 * L - 0.05;
    h = [s[0] + dx, s[1] + dy];
  }
  const hh = Math.sqrt(Math.max(0, L * L - (d / 2) ** 2));
  return { e: [s[0] + dx / 2 + (-dy / d) * hh * bend, s[1] + dy / 2 + (dx / d) * hh * bend], h };
}

function defs(L: Look, p: string): string {
  const g = (id: string, c: string) =>
    lin(id, [[0, lighten(c, 0.16)], [0.55, c], [1, darken(c, 0.2)]], 0, 0, 0.8, 1);
  return g(`${p}s`, L.skin) + g(`${p}h`, L.hair) + g(`${p}t`, L.top) + g(`${p}b`, L.bottom) + g(`${p}a`, L.accent);
}

function limb(pts: [number, number][], col: string, w: number): string {
  const d = 'M' + pts.map((q) => `${f(q[0])} ${f(q[1])}`).join(' L');
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-opacity=".85" stroke-width="${f(w + 1.3)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function arm(L: Look, _p: string, s: [number, number], target: [number, number], back: boolean, bend = 1): { svg: string; h: [number, number] } {
  const r = ik(s, [s[0] + target[0], s[1] + target[1]], bend);
  const sleeve = back ? darken(L.top, 0.25) : L.top;
  const skin = back ? darken(L.skin, 0.2) : L.skin;
  let svg = limb([s, r.e], sleeve, 3.5);
  svg += limb([r.e, r.h], L.longSleeve ? sleeve : skin, L.longSleeve ? 3.2 : 2.7);
  svg += `<circle cx="${f(r.h[0])}" cy="${f(r.h[1])}" r="1.8" fill="${skin}" ${ol(0.9)}/>`;
  return { svg, h: r.h };
}

function leg(L: Look, p: string, ang: number, back: boolean, y0 = 39.2, len = 9.8): string {
  const bot = back ? darken(L.bottom, 0.25) : `url(#${p}b)`;
  const skinc = back ? darken(L.skin, 0.2) : L.skin;
  const shoe = back ? darken(L.shoe, 0.25) : L.shoe;
  const short = !L.longPants && !L.skirt ? 4.2 : L.skirt ? 2.2 : len;
  return `<g transform="translate(24 ${y0}) rotate(${f(ang)})">
<rect x="-2.1" y="-0.5" width="4.2" height="${f(len + 0.5)}" rx="1.6" fill="${skinc}" ${ol()}/>
<rect x="-2.3" y="-0.8" width="4.6" height="${f(short + 0.8)}" rx="1.6" fill="${bot}" ${ol()}/>
<path d="M-2.5 ${f(len - 1.6)} h4.6 q2.4 .1 2.6 1.9 v.6 q0 .5 -.5 .5 h-6.7 z" fill="${shoe}" ${ol()}/></g>`;
}

function seatedLeg(L: Look, p: string, back: boolean): string {
  const o = back ? 1.6 : 0;
  const bot = back ? darken(L.bottom, 0.25) : `url(#${p}b)`;
  const skinc = back ? darken(L.skin, 0.2) : L.skin;
  const shoe = back ? darken(L.shoe, 0.25) : L.shoe;
  const thighCol = L.longPants || L.skirt ? bot : bot;
  return `<g transform="translate(${f(o)} ${f(back ? -0.4 : 0)})">
<rect x="31" y="41.3" width="3.8" height="${L.longPants ? 7.6 : 7.6}" rx="1.5" fill="${L.longPants ? bot : skinc}" ${ol()}/>
${!L.longPants ? `<rect x="31" y="41.3" width="3.8" height="2.4" rx="1.2" fill="${bot}" ${ol(0.7)}/>` : ''}
<rect x="22.4" y="39.6" width="12.4" height="4" rx="1.9" fill="${thighCol}" ${ol()}/>
<path d="M30.6 46.8 h4.6 q2.6 .1 2.8 2 v.5 q0 .5 -.5 .5 h-6.9 z" fill="${shoe}" ${ol()}/></g>`;
}

function headSvg(L: Look, p: string, face: Face, hairBackOnly = false): { back: string; front: string } {
  const sleepy = L.sleepy && (face === 'neutral' || face === 'pick');
  const hc = `url(#${p}h)`;
  let back = '';
  let front = '';
  const o = ol(1);
  switch (L.hs) {
    case 'bob':
      back = `<path d="M16.2 16 C14.6 25 16 30 21 30.6 L27 30.6 L27 14 Z" fill="${hc}" ${o}/>`;
      break;
    case 'long':
      back = `<path d="M16.2 15 C13.8 26 15 36 19.4 39 L28 39 L28 14 Z" fill="${hc}" ${o}/>`;
      break;
    case 'pony':
      back = `<path d="M17.4 13.5 C10 12.4 7.4 20 10.8 28.6 C12.2 22.6 14.4 19.4 18.6 19.2 Z" fill="${hc}" ${o}/><path d="M17.6 14.2 q-1.2 1.2 -.4 3.6" stroke="${L.accent}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
      break;
    case 'curly':
      back = `<circle cx="22.4" cy="17.4" r="10.6" fill="${hc}" ${o}/><circle cx="16" cy="22" r="4.4" fill="${hc}" ${o}/>`;
      break;
    case 'hijab':
      back = `<path d="M14.6 21 C13.4 9.4 21 7.6 26 7.8 C32 8 35 12.6 34.4 19 C34.4 26 33 30.8 30 33.4 L21 34 C16.4 31 15 26.4 14.6 21Z" fill="${hc}" ${o}/>`;
      break;
    default:
  }
  const skin = `<ellipse cx="${HX}" cy="${HY}" rx="8" ry="8.3" fill="url(#${p}s)" ${o}/>`;
  const nose = `<path d="M32.4 19.8 q1.1 1 .1 2 q-.8 .1 -1.4 -.2" fill="${L.skin}" stroke="${INK}" stroke-opacity=".7" stroke-width=".8" stroke-linejoin="round"/>`;
  const ear = `<ellipse cx="22.4" cy="21.2" rx="1.2" ry="1.6" fill="${darken(L.skin, 0.1)}" stroke="${INK}" stroke-opacity=".35" stroke-width=".6"/>`;
  switch (L.hs) {
    case 'short':
      front = `<path d="M16.6 20.4 C15.6 11.6 21 9.4 25.8 9.6 C30.8 9.8 34 13.4 33 18.2 C31.2 15.4 27.6 14.6 24.6 16.2 C22.4 17.4 20.6 17.2 19 20.6 L19.6 24 C17.8 23.8 16.8 22.6 16.6 20.4Z" fill="${hc}" ${o}/>`;
      break;
    case 'side':
      front = `<path d="M16.4 21 C15 11.4 21 9 26 9.4 C31.6 9.8 34.6 14 33.4 19.4 C32.4 15.8 29.4 14.4 26.6 15.4 C23 16.6 20.4 17.4 18.8 22 L19.4 25 C17.6 24.6 16.6 23 16.4 21Z" fill="${hc}" ${o}/><path d="M21.6 12.4 q3.2 -1.2 7.2 0.4" stroke="${lighten(L.hair, 0.3)}" stroke-opacity=".5" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
      break;
    case 'buzz':
      front = `<path d="M17 19 C16.4 12.8 21 10.8 25.6 10.8 C30.4 10.8 33.4 13.6 33 17.2 C30.6 15 20.6 14.6 17 19Z" fill="${hc}" fill-opacity=".92" ${ol(0.8)}/>`;
      break;
    case 'spiky':
      front = `<path d="M16.6 20 L15.4 12.8 L19.4 14 L20.2 8.6 L23.6 12 L26.4 7.8 L28.6 12.2 L32.2 9.8 L32.6 14.4 L34 15.6 C32 15.2 28.4 14.8 25 16.4 C22.4 17.6 20.6 17.4 19 21 Z" fill="${hc}" ${o}/>`;
      break;
    case 'bob':
    case 'long':
    case 'pony':
      front = `<path d="M16.4 21 C15.2 11.6 21 9.2 26 9.4 C31.4 9.6 34.4 13.6 33.2 18.8 C31.6 15.6 28 14.6 25 16 C22.6 17.2 20.4 17.6 18.6 22 L19 26 C17.4 25.2 16.6 23.2 16.4 21Z" fill="${hc}" ${o}/>`;
      break;
    case 'bun':
      front = `<circle cx="22" cy="9.4" r="3.6" fill="${hc}" ${o}/><path d="M16.6 20.4 C15.6 11.6 21 9.8 25.8 10 C30.8 10.2 34 13.6 33 18.2 C31.2 15.6 27.6 14.8 24.6 16.2 C22.4 17.2 20.6 17.2 19 20.6 L19.6 24 C17.8 23.8 16.8 22.6 16.6 20.4Z" fill="${hc}" ${o}/>`;
      break;
    case 'curly':
      front = `<circle cx="20" cy="11.4" r="4.2" fill="${hc}" ${o}/><circle cx="26" cy="10" r="4.4" fill="${hc}" ${o}/><circle cx="31" cy="12.8" r="3.6" fill="${hc}" ${o}/>`;
      break;
    case 'hijab':
      front = `<path d="M16.6 17.6 C18 9.4 28 8.4 33.6 15.4 L32.6 17.6 C28.6 14.2 22.4 14.4 18.8 19.6 Z" fill="${hc}" ${o}/><path d="M16.6 24 C20 29.6 28.6 30 33 24.6 L33 27.4 C28.4 33 20 32.6 16.8 27 Z" fill="${hc}" ${o}/>`;
      break;
  }
  // face
  const ex = 28.8;
  const ey = 19.6;
  const ink = INK;
  let eye = '';
  let brow = '';
  let mouth = '';
  const hasMask = L.acc.includes('mask');
  if (face === 'happy') {
    eye = `<path d="M${ex - 1.7} ${ey + 0.6} q1.7 -2.4 3.4 0" stroke="${ink}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
    mouth = `<path d="M27.8 23.2 q2.2 3.6 4.4 0 z" fill="#7a2230" stroke="${ink}" stroke-width=".7" stroke-linejoin="round"/><path d="M28.8 24.6 q1.2 .9 2.2 0" stroke="#ff8a8a" stroke-width=".9" fill="none"/>`;
  } else if (face === 'angry') {
    eye = `<ellipse cx="${ex}" cy="${ey + 0.3}" rx="1.1" ry="1.3" fill="${ink}"/><circle cx="${ex + 0.3}" cy="${ey - 0.2}" r=".4" fill="#fff"/>`;
    brow = `<path d="M${ex - 2.6} ${ey - 3.6} L${ex + 2.4} ${ey - 1.8}" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>`;
    mouth = `<path d="M28.4 25.4 q1.6 -1.8 3.2 -.2" stroke="#6a1c28" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  } else if (sleepy) {
    eye = `<ellipse cx="${ex}" cy="${ey + 0.5}" rx="1.25" ry="1.1" fill="${ink}"/><path d="M${ex - 2} ${ey - 0.3} h4" stroke="${ink}" stroke-width="1.1" stroke-linecap="round"/><path d="M${ex - 1.8} ${ey + 2.3} q1.6 .7 3.2 0" stroke="#7a4a7a" stroke-opacity=".5" stroke-width=".8" fill="none"/>`;
    mouth = `<path d="M30 24 h2.2" stroke="#7a2a2a" stroke-width="1" stroke-linecap="round"/>`;
  } else {
    eye = `<ellipse cx="${ex}" cy="${ey}" rx="1.15" ry="1.65" fill="${ink}"/><circle cx="${ex + 0.4}" cy="${ey - 0.6}" r=".5" fill="#fff"/>`;
    mouth =
      face === 'eatOpen'
        ? `<ellipse cx="30" cy="24.2" rx="1.4" ry="1.7" fill="#7a2230" stroke="${ink}" stroke-width=".6"/>`
        : face === 'eatShut'
          ? `<path d="M28.6 24.2 q1.2 1 2.4 0" stroke="#7a2a2a" stroke-width="1" fill="none" stroke-linecap="round"/><ellipse cx="28.6" cy="23" rx="2.1" ry="1.5" fill="${L.skin}" opacity=".5"/>`
          : face === 'pick'
            ? `<ellipse cx="30" cy="24" rx=".9" ry="1" fill="#7a2230"/>`
            : `<path d="M28.6 23.9 q1.2 1 2.4 0" stroke="#7a2a2a" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }
  const blush = `<ellipse cx="27.2" cy="22.4" rx="1.8" ry="1.1" fill="${face === 'angry' ? '#e0302a' : L.blush}" opacity="${face === 'angry' ? 0.55 : 0.32}"/>`;
  const angryTint = face === 'angry' ? `<ellipse cx="${HX}" cy="${HY}" rx="7.6" ry="7.9" fill="#ff3a2a" opacity=".28"/>` : '';
  // head wear
  let wear = '';
  let wearBack = '';
  const cap = CAPCOL[(hash32(L.top.length * 31 + L.top.charCodeAt(2)) >>> 0) % CAPCOL.length];
  for (const ac of L.acc) {
    if (ac === 'glasses')
      wear += `<circle cx="${ex + 0.2}" cy="${ey + 0.1}" r="3" fill="#bfe6ff" fill-opacity=".22" stroke="${ink}" stroke-width=".9"/><path d="M${ex - 2.8} ${ey - 0.4} L22.8 19.4" stroke="${ink}" stroke-width=".8"/>`;
    if (ac === 'sunglasses')
      wear += `<path d="M${ex - 3.2} ${ey - 1.8} h6.4 q.4 3.2 -2 3.8 q-2.6 .2 -3.6 -1.2 z" fill="#1b1230" stroke="${ink}" stroke-width=".6"/><path d="M${ex - 3.2} ${ey - 1.2} L22.8 19" stroke="${ink}" stroke-width=".9"/><path d="M${ex - 2} ${ey - 1.1} l1.6 0" stroke="#fff" stroke-opacity=".5" stroke-width=".7"/>`;
    if (ac === 'cap') {
      wear += `<path d="M16.8 17.6 C16.2 9.8 21.6 8 26 8 C31 8 34 11.4 33.4 16.6 Z" fill="${cap}" ${o}/><path d="M30 15.2 L38.4 16.6 C38.8 17.4 38.2 18.2 37.2 18.2 L29.6 17.2Z" fill="${darken(cap, 0.15)}" ${o}/><circle cx="26" cy="8.2" r="1" fill="${darken(cap, 0.3)}"/>`;
    }
    if (ac === 'bucket')
      wear += `<path d="M17.4 14.8 C17.4 9 21.4 8 25.6 8 C29.6 8 32.8 9.2 33.2 14.8 Z" fill="#efe2c0" ${o}/><path d="M13.6 15 Q25 12.2 37 15.2 Q25.6 18.6 13.6 15 Z" fill="#e2d2a8" ${o}/><path d="M17.4 12.6 H33" stroke="${L.accent}" stroke-width="1.5"/>`;
    if (ac === 'straw')
      wear += `<path d="M18.4 14.2 C18.4 8.4 22 7.4 25.6 7.4 C29.2 7.4 32.4 8.6 32.6 14.2 Z" fill="#e8c878" ${o}/><ellipse cx="25.6" cy="14.6" rx="13" ry="2.8" fill="#dcb868" ${o}/><path d="M18.4 12.2 H32.6" stroke="#c0302a" stroke-width="1.5"/><path d="M14.6 14.4 q3 1.4 6.4 1.6 M28 16.6 q4 -.2 8.6 -1.8" stroke="#b08a40" stroke-width=".6" fill="none"/>`;
    if (ac === 'beanie')
      wear += `<path d="M16.8 16.4 C16.4 9 21.4 7.6 25.8 7.6 C30.6 7.6 33.6 10.6 33.2 15.6 Z" fill="${L.accent}" ${o}/><rect x="16.4" y="14.2" width="17.2" height="3.4" rx="1.6" fill="${darken(L.accent, 0.18)}" ${o}/><circle cx="25.4" cy="6.8" r="2" fill="${lighten(L.accent, 0.3)}" ${o}/>`;
    if (ac === 'headphones')
      wearBack += '';
    if (ac === 'mask')
      wear += `<path d="M26.4 21.4 L33.2 21 L32.8 26.6 Q29.6 28.6 26.2 26.8 Z" fill="#eef4f8" ${ol(0.8)}/><path d="M26.8 23.4 h6 M26.8 25 h5.6" stroke="#b8c8d8" stroke-width=".5"/><path d="M26.4 21.8 L22.6 20.6" stroke="#eef4f8" stroke-width=".8"/>`;
  }
  if (L.acc.includes('headphones'))
    wear += `<path d="M18 17.6 C17 8.4 33.6 8 33 17.4" stroke="#33384a" stroke-width="1.9" fill="none" stroke-linecap="round"/><path d="M18 17.6 C17 8.4 33.6 8 33 17.4" stroke="#6c7690" stroke-width=".6" fill="none" transform="translate(0 -.4)"/><ellipse cx="23.2" cy="21" rx="2.3" ry="3.4" fill="${L.accent}" ${ol(0.9)}/><ellipse cx="22.8" cy="20.2" rx=".8" ry="1.4" fill="#fff" opacity=".35"/>`;
  const faceUnder = hasMask ? '' : mouth;
  const bits = `${nose}${ear}${blush}${angryTint}${eye}${brow}${faceUnder}`;
  // rim lights over the head
  const rim = `<path d="M32.3 13.4 Q34.4 19.6 31.6 25.4" stroke="${LAMP}" stroke-opacity=".7" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M17.2 15.4 Q15.6 20 17.4 25" stroke="#8fb0ff" stroke-opacity=".3" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
  const hairBelow = L.hs === 'hijab' ? '' : '';
  void hairBelow;
  const faceOnly = L.hs === 'hijab' ? `<ellipse cx="25.6" cy="20.2" rx="7.4" ry="7.6" fill="url(#${p}s)" ${o}/>` : skin;
  if (hairBackOnly) return { back, front: '' };
  return { back: back + wearBack, front: `${faceOnly}${bits}${front}${wear}${rim}` };
}

function skewerSvg(hx: number, hy: number, ang: number, n: number): string {
  const r = (ang * Math.PI) / 180;
  const dx = Math.sin(r);
  const dy = -Math.cos(r);
  const t0: [number, number] = [hx - dx * 3, hy - dy * 3];
  const t1: [number, number] = [hx + dx * 10.5, hy + dy * 10.5];
  const cols = ['#c0502a', '#7a3a1c', '#d6342b', '#e8c060'];
  let s = `<path d="M${f(t0[0])} ${f(t0[1])} L${f(t1[0])} ${f(t1[1])}" stroke="#d9b070" stroke-width="1" stroke-linecap="round"/>`;
  for (let i = 0; i < n; i++) {
    const t = 6 + i * 2.2;
    const cx = hx + dx * t;
    const cy = hy + dy * t;
    s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="1.75" fill="${cols[i % 4]}" ${ol(0.7)}/><circle cx="${f(cx - 0.5)}" cy="${f(cy - 0.6)}" r=".5" fill="#fff" opacity=".45"/>`;
  }
  return s;
}

function itemSvg(L: Look, h: [number, number]): string {
  const [x, y] = h;
  switch (L.item) {
    case 'brief':
      return `<rect x="${f(x - 4.4)}" y="${f(y + 0.6)}" width="9" height="6.4" rx="1" fill="#4a3a30" ${ol(0.9)}/><path d="M${f(x - 1.6)} ${f(y + 0.6)} v-1.2 h3.2 v1.2" stroke="#2a2018" stroke-width=".9" fill="none"/><rect x="${f(x - 0.6)}" y="${f(y + 2.6)}" width="1.2" height="1" fill="#d9b070"/>`;
    case 'bag':
      return `<path d="M${f(x - 1.8)} ${f(y + 0.4)} q1.8 -3 3.6 0" stroke="${L.accent}" stroke-width=".9" fill="none"/><path d="M${f(x - 4.4)} ${f(y + 1)} h8.8 l-.8 6.6 h-7.2 z" fill="${L.accent}" ${ol(0.9)}/><path d="M${f(x - 3.6)} ${f(y + 2.4)} h7.2" stroke="#fff" stroke-opacity=".3" stroke-width=".8"/>`;
    case 'shopbag':
      return `<path d="M${f(x - 2)} ${f(y + 0.4)} q2 -3 4 0" stroke="#e8e0cc" stroke-width=".9" fill="none"/><path d="M${f(x - 4)} ${f(y + 1)} h8 l-.6 7.4 h-6.8 z" fill="#f6e7c8" ${ol(0.9)}/><path d="M${f(x - 3.4)} ${f(y + 3.6)} h6.8" stroke="${L.accent}" stroke-width="1.6"/><circle cx="${f(x + 1)}" cy="${f(y + 0.1)}" r=".001" />`;
    case 'cup':
      return `<path d="M${f(x - 2.2)} ${f(y - 2.8)} h4.4 l-.7 6 h-3 z" fill="#c8e8f0" fill-opacity=".85" ${ol(0.8)}/><path d="M${f(x - 1.9)} ${f(y - 0.4)} h3.8 l-.4 3.6 h-3 z" fill="#c0702a" fill-opacity=".9"/><path d="M${f(x + 0.4)} ${f(y - 2.8)} l1.4 -2.8" stroke="#6ec28a" stroke-width=".9"/>`;
    default:
      return '';
  }
}

function personSvg(L: Look, sp: Spec, uid: string, cx: number, sc: number, withShadow = true): string {
  const p = uid;
  const dy = (sp.dy ?? 0) + (sp.jump ?? 0);
  const sit = sp.legs === 'sit';
  let legs = '';
  const ph = sp.p ?? 0;
  if (sp.legs === 'walk') {
    const A = 27 * Math.cos(ph);
    legs = leg(L, p, A, true) + leg(L, p, -A, false);
  } else if (sp.legs === 'stand') legs = leg(L, p, 5, true) + leg(L, p, -4, false);
  else if (sp.legs === 'stomp') legs = leg(L, p, 6, true) + leg(L, p, -22, false, 39.2 + (sp.jump ?? 0) * 0, 9.8);
  else legs = seatedLeg(L, p, true) + seatedLeg(L, p, false);
  if (L.skirt) {
    const sy = sit ? 39.2 : 36.6;
    const hem = sit ? 43.4 : L.longPants ? 46 : 43.2;
    legs += `<path d="M18.6 ${sy} L29.6 ${sy} L${f(31.6 + (sit ? 3 : 0))} ${hem} L${f(16.8)} ${hem} Z" fill="url(#${p}b)" ${ol()}/><path d="M21 ${sy + 1} L20 ${hem - 0.6} M24 ${sy + 1} L24 ${hem - 0.4} M27 ${sy + 1} L28 ${hem - 0.6}" stroke="${INK}" stroke-opacity=".18" stroke-width=".7"/>`;
  }
  const hd = headSvg(L, p, sp.face);
  const bend = sp.front[1] < -3 ? 1 : 1;
  const fa = arm(L, p, [SH[0], SH[1]], sp.front, false, bend);
  const ba = arm(L, p, [SH[0] - 1.6, SH[1]], sp.back, true, 1);
  const hasHood = L.acc.includes('hood');
  // back accessories
  let backAcc = '';
  if (L.acc.includes('backpack'))
    backAcc += `<rect x="12.4" y="28.6" width="8" height="12.6" rx="2.6" fill="${L.accent}" ${ol()}/><rect x="13.2" y="35" width="6.4" height="4.6" rx="1.4" fill="${darken(L.accent, 0.2)}" ${ol(0.7)}/><path d="M13.6 31 h5.2" stroke="#fff" stroke-opacity=".35" stroke-width=".9"/>`;
  if (hasHood) backAcc += `<path d="M17.4 29.8 C16.4 25.6 19.8 25.6 22.2 26.4 L26 29 Z" fill="${darken(L.top, 0.1)}" ${ol()}/>`;
  const torso = `<path d="M18.8 30.2 Q18.8 27.6 21.6 27.4 L27.4 27.4 Q30.2 27.6 30.2 30.2 L29.8 ${sit ? 39.6 : 39.6} L19.2 ${sit ? 39.6 : 39.6} Z" fill="url(#${p}t)" ${ol()}/>`;
  let front = '';
  if (L.acc.includes('pattern')) {
    for (let i = 0; i < 7; i++) front += `<circle cx="${f(20.4 + (i % 3) * 3.4 + (Math.floor(i / 3) % 2) * 1.5)}" cy="${f(31 + Math.floor(i / 3) * 3.2)}" r="1.05" fill="${L.accent}" opacity=".9"/>`;
  }
  if (L.acc.includes('tie')) front += `<path d="M26 27.6 L28.4 27.8 L27.6 35.6 L26.6 36.6 L25.6 35.6 Z" fill="${L.accent}" ${ol(0.7)}/><path d="M24.4 27.5 L26.4 29.4 L28.4 27.6" fill="#fff" ${ol(0.6)}/>`;
  if (L.acc.includes('lanyard'))
    front += `<path d="M22.6 27.6 L26.2 36 L28.8 27.6" fill="none" stroke="${L.accent}" stroke-width="1.1"/><rect x="24.4" y="35.4" width="3.8" height="4.8" rx=".8" fill="#fff" ${ol(0.7)}/><rect x="25.1" y="36.2" width="2.4" height="1.6" fill="${L.accent}"/>`;
  if (L.acc.includes('scarf')) front += `<path d="M21.6 27.6 L28.4 27.8 L25.8 31.8 Z" fill="${L.accent}" ${ol(0.7)}/>`;
  if (L.acc.includes('camera'))
    front += `<path d="M22.4 27.6 L27.4 34 M29 27.8 L27.8 34" stroke="#2a2030" stroke-width=".9"/><rect x="24.6" y="33.6" width="7.4" height="5" rx="1" fill="#26232e" ${ol(0.8)}/><circle cx="29.6" cy="36.2" r="1.7" fill="#6aa0c0" ${ol(0.7)}/><circle cx="29.2" cy="35.7" r=".5" fill="#fff"/>`;
  if (hasHood) front += `<path d="M24.6 38.4 h4.4" stroke="${INK}" stroke-opacity=".25" stroke-width=".8"/><path d="M26 28 v4" stroke="#e8e0d0" stroke-width=".7"/>`;
  // collar for office
  const rimT = `<path d="M30 29.6 L29.6 38.8" stroke="${LAMP}" stroke-opacity=".6" stroke-width="1.1" stroke-linecap="round"/><path d="M18.9 30.4 L19.2 38" stroke="#8fb0ff" stroke-opacity=".3" stroke-width=".9" stroke-linecap="round"/>`;
  const hand = sp.keepItem ? itemSvg(L, fa.h) : '';
  const sk = sp.skewer ? skewerSvg(fa.h[0], fa.h[1], sp.skewer.ang, sp.skewer.n) : '';
  let fx = '';
  if (sp.fx === 'sparkle')
    fx = [[35, 10, 2.4], [13.5, 8.5, 1.8], [36.6, 22, 1.5]]
      .map(([x, y, r]) => `<path d="M${x} ${y - r} L${x + r * 0.35} ${y - r * 0.35} L${x + r} ${y} L${x + r * 0.35} ${y + r * 0.35} L${x} ${y + r} L${x - r * 0.35} ${y + r * 0.35} L${x - r} ${y} L${x - r * 0.35} ${y - r * 0.35} Z" fill="#fff3b0" stroke="${LAMP}" stroke-width=".5"/>`)
      .join('');
  if (sp.fx === 'steam0' || sp.fx === 'steam1') {
    const o = sp.fx === 'steam0' ? 0 : 1.6;
    fx = `<g fill="#f2eef8" fill-opacity=".85" stroke="#b8a8d0" stroke-width=".6"><circle cx="${f(15 + o)}" cy="${f(11 - o)}" r="2.6"/><circle cx="${f(18 + o)}" cy="${f(8.4 - o)}" r="2"/><circle cx="${f(36 - o)}" cy="${f(10 + o * 0.5)}" r="2.4"/><circle cx="${f(33.4 - o)}" cy="${f(6.6 - o)}" r="1.8"/></g><path d="M31.6 8.6 l2.2 2.2 m0 -2.2 l-2.2 2.2" stroke="#e0302a" stroke-width="1.4" stroke-linecap="round"/>`;
  }
  const lean = sp.lean ? `rotate(${sp.lean} 24 39.5)` : '';
  const upper = `<g transform="${lean} translate(0 ${f(dy)})">${backAcc}${hd.back}${ba.svg}${torso}${front}${rimT}${hd.front}${fa.svg}${hand}${sk}</g>`;
  const shadow = withShadow ? `<ellipse cx="25.4" cy="49.4" rx="${sit ? 10 : 9.2}" ry="2.2" fill="${INK}" fill-opacity=".34"/>` : '';
  const kid = L.kid;
  const t = `translate(${f(cx)} 49.4) scale(${f(sc)}) translate(-24 -49.4)`;
  // kid: bigger head
  const body = kid
    ? `<g transform="${lean} translate(0 ${f(dy)})">${backAcc}<g transform="translate(25 27) scale(1.22) translate(-25 -27)">${hd.back}</g>${ba.svg}${torso}${front}${rimT}<g transform="translate(25 27) scale(1.22) translate(-25 -27)">${hd.front}</g>${fa.svg}${hand}${sk}</g>`
    : upper;
  return `<g transform="${t}">${shadow}${legs}${body}${fx}</g>`;
}

// ------------------------------------------------------------------ frame specs
function adultSpec(fr: FrameName, L: Look, kidPhase = 0): { spec: Spec; kidSpec: Spec } {
  const idxW = (n: number) => ({ legs: 'walk' as const, p: ((n + kidPhase) % 4) * (Math.PI / 2) });
  const ph = (n: number) => (n * Math.PI) / 2;
  let spec: Spec;
  let kidSpec: Spec;
  const walk = (n: number): Spec => {
    const c = Math.cos(ph(n));
    const bob = -Math.abs(Math.sin(ph(n))) * 1.2;
    return {
      legs: 'walk', p: ph(n), dy: bob, front: [-3.6 * c, 8.2], back: [3.6 * c, 8.2], face: 'neutral', keepItem: true,
    };
  };
  switch (fr) {
    case 'walk0': case 'walk1': case 'walk2': case 'walk3': {
      const n = Number(fr[4]);
      spec = walk(n);
      kidSpec = walk((n + 1) % 4);
      kidSpec.keepItem = false;
      break;
    }
    case 'pick':
      spec = { legs: 'stand', lean: 6, front: [12.2, -1.2], back: [-2.4, 8], face: 'pick' };
      kidSpec = { ...spec, front: [11.4, -0.4] };
      break;
    case 'sit':
      spec = { legs: 'sit', dy: 2, front: [8, 7.4], back: [5, 7], face: 'neutral', keepItem: false };
      kidSpec = { legs: 'stand', front: [4.6, 8], back: [-2, 8], face: 'neutral' };
      break;
    case 'eat0':
      spec = { legs: 'sit', dy: 2, front: [7.2, 4.4], back: [5, 7], face: 'eatShut', skewer: { ang: 18, n: 3 } };
      kidSpec = { legs: 'stand', front: [6.4, 2.2], back: [-2, 8], face: 'eatShut', skewer: { ang: 18, n: 2 } };
      break;
    case 'eat1':
      spec = { legs: 'sit', dy: 2, front: [6.6, -2.2], back: [5, 7], face: 'eatOpen', skewer: { ang: 40, n: 3 } };
      kidSpec = { legs: 'stand', front: [6.2, -2.8], back: [-2, 8], face: 'eatOpen', skewer: { ang: 40, n: 2 } };
      break;
    case 'happy':
      spec = { legs: 'stand', jump: -2.2, front: [9.6, -8], back: [-8, -8], face: 'happy', fx: 'sparkle' };
      kidSpec = { ...spec, fx: undefined };
      break;
    case 'angry0':
      spec = { legs: 'stand', front: [8.4, -1.2], back: [-6.8, 0.2], face: 'angry', fx: 'steam0' };
      kidSpec = { ...spec, fx: undefined };
      break;
    case 'angry1':
      spec = { legs: 'stomp', dy: 0.6, front: [8.8, -2.6], back: [-7.2, -1.4], face: 'angry', fx: 'steam1' };
      kidSpec = { ...spec, fx: undefined, legs: 'stand' };
      break;
    default:
      spec = { legs: 'stand', front: [-2.4, 8.4], back: [2.6, 8.2], face: 'neutral', keepItem: true };
      kidSpec = { ...spec, keepItem: false, front: [-1, 8.2] };
  }
  void idxW;
  void L;
  return { spec, kidSpec };
}

export function sheetSvg(arch: ArchetypeId, v: number): string {
  const L = lookFor(arch, v);
  const K = arch === 'family' ? kidLookFor(v) : null;
  const W = CW * COLS;
  const H = CH * Math.ceil(FRAMES.length / COLS);
  let body = '';
  const d = defs(L, 'a') + (K ? defs(K, 'k') : '');
  FRAMES.forEach((fr, i) => {
    const ox = (i % COLS) * CW;
    const oy = Math.floor(i / COLS) * CH;
    const { spec, kidSpec } = adultSpec(fr, L);
    let g: string;
    if (K) {
      const seated = spec.legs === 'sit';
      const kx = seated ? 8 : 37;
      const pcx = seated ? 28 : 17;
      // kid behind parent when seated, beside when standing
      const kidG = personSvg(K, kidSpec, 'k', kx, 0.7);
      const parent = personSvg(L, spec, 'a', pcx, 1);
      g = seated ? kidG + parent : parent + kidG;
    } else g = personSvg(L, spec, 'a', 24, 1);
    body += `<g transform="translate(${ox} ${oy})">${g}</g>`;
  });
  return `${svgOpen(0, 0, W, H)}<defs>${d}</defs>${body}</svg>`;
}

// ------------------------------------------------------------------ texture cache
const frameCache = new Map<string, boolean>();
export function hasSheet(scene: Phaser.Scene, a: ArchetypeId, v: number): boolean {
  return scene.textures.exists(sheetKey(a, v));
}

export async function bakeSheet(scene: Phaser.Scene, a: ArchetypeId, v: number): Promise<void> {
  const key = sheetKey(a, v);
  if (scene.textures.exists(key) && frameCache.has(key + scene.game.config.gameTitle)) return;
  const rows = Math.ceil(FRAMES.length / COLS);
  await loadSvg(scene, key, sheetSvg(a, v), CW * COLS, CH * rows);
  const tex = scene.textures.get(key);
  FRAMES.forEach((fr, i) => {
    if (!tex.has(fr)) tex.add(fr, 0, (i % COLS) * CW * RES, Math.floor(i / COLS) * CH * RES, CW * RES, CH * RES);
  });
}

/** Bakes all archetypes x variants (in parallel). */
export async function preloadPeople(scene: Phaser.Scene, variants = VARIANTS): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const a of ARCH_LIST) for (let v = 0; v < variants; v++) jobs.push(bakeSheet(scene, a, v));
  await Promise.all(jobs);
}

export function frameRef(scene: Phaser.Scene, a: ArchetypeId, v: number, fr: FrameName): { key: string; frame: string } {
  const key = hasSheet(scene, a, v) ? sheetKey(a, v) : sheetKey(a, 0);
  return { key, frame: fr };
}
