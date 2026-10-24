// Tiny SVG icon set, 32x32 viewBox, 2 unit outline (= ~1.5 px at 24 px display).
const O = '#1b1230';
const S = `stroke="${O}" stroke-opacity=".9" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

function gearPath(): string {
  const cx = 16, cy = 16, teeth = 8, ro = 13, ri = 9.5;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const w = (Math.PI * 2) / teeth;
    const p = (r: number, da: number) => `${(cx + Math.cos(a + da) * r).toFixed(2)},${(cy + Math.sin(a + da) * r).toFixed(2)}`;
    pts.push(p(ri, 0), p(ro, w * 0.12), p(ro, w * 0.38), p(ri, w * 0.5));
  }
  return pts.join(' ');
}

const body: Record<string, string> = {
  money: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#e8921c"/></linearGradient></defs>
    <circle cx="16" cy="16" r="13" fill="url(#g)" ${S}/><circle cx="16" cy="16" r="9" fill="none" stroke="#b86a10" stroke-width="1.6"/>
    <path d="M13 10v12M13 11h4.2a2.6 2.6 0 010 5.2H13m0 0h4.8a2.7 2.7 0 010 5.4H13" fill="none" stroke="#8a4a08" stroke-width="2" stroke-linecap="round"/>
    <path d="M7 11a10 10 0 018-5" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.8" stroke-linecap="round"/>`,
  star: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffec8a"/><stop offset="1" stop-color="#f2a722"/></linearGradient></defs>
    <path d="M16 3.2l3.7 7.6 8.3 1.2-6 5.9 1.4 8.3L16 22l-7.4 3.9 1.4-8.3-6-5.9 8.3-1.2z" fill="url(#g)" ${S}/>
    <path d="M10 11.6l4-.7" stroke="#fff" stroke-opacity=".7" stroke-width="1.8" stroke-linecap="round"/>`,
  level: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a52"/><stop offset="1" stop-color="#b01e1e"/></linearGradient></defs>
    <path d="M16 3l11 4v8c0 7-5 11.5-11 14C10 26.500 5 22 5 15V7z" fill="url(#g)" ${S}/>
    <path d="M10.500 17l5.500-5.500 5.500 5.500M10.500 22l5.500-5.500 5.500 5.500" fill="none" stroke="#f6e7c8" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/>`,
  clock: `<circle cx="16" cy="16" r="13" fill="#f6e7c8" ${S}/><circle cx="16" cy="16" r="10" fill="none" stroke="#d9c39a" stroke-width="1.4"/>
    <path d="M16 8.500V16l5 3" fill="none" stroke="#3a2a20" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="16" r="1.600" fill="#d6342b"/>`,
  chili: `<path d="M20 7c1-2.500 3-3.500 5-3-1 1.500-1.500 3-1.500 4.500" fill="#6ec28a" ${S}/>
    <path d="M17 8c6 0 10 5 7.500 12S12 29 5 28c6-3 6-8 6-12 0-4 2.500-8 6-8z" fill="#d6342b" ${S}/>
    <path d="M18 11c3 1 4.500 4 3.600 7" fill="none" stroke="#ff8a7a" stroke-width="1.800" stroke-linecap="round" opacity=".8"/>`,
  fire: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb24a"/><stop offset="1" stop-color="#e8401a"/></linearGradient></defs>
    <path d="M16 3c1 5 8 8 8 15a8 8 0 01-16 0c0-3 1.500-5 3-6.500 0 2 1 3 2 3.500C13 11 14 7 16 3z" fill="url(#g)" ${S}/>
    <path d="M16 15c1.500 2.500 4 3.500 4 6.500a4 4 0 01-8 0c0-2 2-3 4-6.500z" fill="#ffe27a"/>`,
  cart: `<path d="M3 5h4l3 14h14l3-10H8.500" fill="#f6e7c8" ${S}/><path d="M11 12h14M12 16h11" stroke="#b9a37a" stroke-width="1.400"/>
    <circle cx="12" cy="25" r="2.600" fill="#8c97a6" ${S}/><circle cx="23" cy="25" r="2.600" fill="#8c97a6" ${S}/>`,
  gear: `<polygon points="${gearPath()}" fill="#aab3c0" ${S}/><circle cx="16" cy="16" r="4.200" fill="#2a1d47" ${S}/>
    <path d="M9 11a8 8 0 014-3" stroke="#fff" stroke-opacity=".6" stroke-width="1.600" fill="none" stroke-linecap="round"/>`,
  sound: `<path d="M5 12h5l7-6v20l-7-6H5z" fill="#f6e7c8" ${S}/><path d="M21 11.500a6 6 0 010 9M24 8a10.500 10.500 0 010 16" fill="none" stroke="#ffb24a" stroke-width="2.200" stroke-linecap="round"/>`,
  brush: `<path d="M24 3l5 5-12 12-5-5z" fill="#c89a5a" ${S}/><path d="M12 15l5 5c0 5-4 8-10 8 2-2 1.500-4 1.500-6 0-2 1.500-3.500 3.500-7z" fill="#d6342b" ${S}/>
    <path d="M22 5l5 5" stroke="#8a5a34" stroke-width="1.400"/>`,
  skewer: `<path d="M4 28L28 4" stroke="#c89a5a" stroke-width="3" stroke-linecap="round"/><path d="M4 28L28 4" stroke="${O}" stroke-opacity=".5" stroke-width="1" stroke-linecap="round" transform="translate(.8 .8)"/>
    <circle cx="23.500" cy="8.500" r="4.800" fill="#f6e7c8" ${S}/><circle cx="16" cy="16" r="5" fill="#d6342b" ${S}/><circle cx="8.500" cy="23.500" r="4.600" fill="#6ec28a" ${S}/>
    <circle cx="22" cy="7" r="1.400" fill="#fff" opacity=".8"/><circle cx="14.500" cy="14.500" r="1.400" fill="#fff" opacity=".5"/>`,
  plus: `<path d="M16 7v18M7 16h18" stroke="#fff" stroke-width="4.500" stroke-linecap="round"/>`,
  minus: `<path d="M7 16h18" stroke="#fff" stroke-width="4.500" stroke-linecap="round"/>`,
  check: `<path d="M7 17l6 6 12-13" fill="none" stroke="#fff" stroke-width="4.500" stroke-linecap="round" stroke-linejoin="round"/>`,
  close: `<path d="M8 8l16 16M24 8L8 24" stroke="#fff" stroke-width="4.500" stroke-linecap="round"/>`,
  lock: `<rect x="7" y="14" width="18" height="14" rx="3.500" fill="#8c97a6" ${S}/><path d="M11 14v-3a5 5 0 0110 0v3" fill="none" ${S}/><circle cx="16" cy="21" r="2" fill="#2a1d47"/>`,
};

export const ICON_NAMES = Object.keys(body) as UiIconName[];
export type UiIconName =
  | 'money' | 'star' | 'level' | 'clock' | 'chili' | 'fire' | 'cart' | 'gear' | 'sound' | 'brush'
  | 'skewer' | 'plus' | 'minus' | 'check' | 'close' | 'lock';

export const iconSvg = (n: UiIconName): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${body[n]}</svg>`;
