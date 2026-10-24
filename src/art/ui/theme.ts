// Shared UI constants: radii, paddings, text styles, colours. Import from '../art/ui'.
import { PALETTE } from '../palette';
import { FONT, FONT_FUN } from '../../scenes/grill/draw';

export { FONT, FONT_FUN };

const css = (k: keyof typeof PALETTE) => PALETTE[k].css;

/** Padding keeps Thai tone marks / vowels from being clipped by Phaser's text canvas. */
const PAD = { left: 2, right: 2, top: 5, bottom: 3 };

export const uiTheme = {
  /** Corner radii (logical px). */
  radius: { sm: 8, md: 14, lg: 20 },
  /** Paddings / gaps (logical px). */
  pad: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  /** Minimum tap target (logical px). */
  minTap: 44,
  /** Z depths: toasts and modals sit above any scene content. */
  depth: { toast: 500, modal: 400 },
  color: {
    night: css('night'),
    night2: css('night2'),
    ink: css('ink'),
    lamp: css('lamp'),
    ember: css('ember'),
    mala: css('mala'),
    chili: css('chili'),
    cream: css('cream'),
    wood: css('wood'),
    woodDark: css('woodDark'),
    tea: css('tea'),
    text: css('text'),
    textDim: css('textDim'),
    gold: '#ffe27a',
    good: '#8fd8a0',
    bad: '#ff8a7a',
    /** Dark text on paper / cream surfaces. */
    paperInk: '#3a2a20',
    paperDim: '#7a6552',
  },
  /** Phaser text styles. Spread and override: `{ ...uiTheme.text.body, color: '#fff' }`. */
  text: {
    title: { fontFamily: FONT_FUN, fontStyle: 'bold', fontSize: '30px', color: css('cream') , padding: PAD },
    heading: { fontFamily: FONT_FUN, fontStyle: 'bold', fontSize: '20px', color: css('lamp') , padding: PAD },
    sign: { fontFamily: FONT_FUN, fontStyle: 'bold', fontSize: '38px', color: '#fff4dc' , padding: PAD },
    body: { fontFamily: FONT, fontSize: '16px', color: css('text') , padding: PAD },
    bodyBold: { fontFamily: FONT, fontStyle: 'bold', fontSize: '16px', color: css('text') , padding: PAD },
    small: { fontFamily: FONT, fontSize: '13px', color: css('textDim') , padding: PAD },
    tiny: { fontFamily: FONT, fontSize: '11px', color: css('textDim') , padding: PAD },
    button: { fontFamily: FONT, fontStyle: 'bold', fontSize: '18px', color: '#fff7ea' , padding: PAD },
    number: { fontFamily: FONT, fontStyle: 'bold', fontSize: '20px', color: '#ffe27a' , padding: PAD },
    paper: { fontFamily: FONT, fontSize: '15px', color: '#3a2a20' , padding: PAD },
    paperBold: { fontFamily: FONT, fontStyle: 'bold', fontSize: '15px', color: '#3a2a20' , padding: PAD },
  },
} as const;

export type UiSoundKind = 'tap' | 'confirm' | 'back' | 'toast' | 'coin' | 'stamp' | 'levelup' | 'error';
let soundHook: ((kind: UiSoundKind) => void) | null = null;
/** Wire UI sounds once (e.g. to Sfx). Buttons call it on press (`tap`/`confirm`), toasts and stamps too. */
export function setUiSound(fn: ((kind: UiSoundKind) => void) | null): void {
  soundHook = fn;
}
export function uiSound(kind: UiSoundKind): void {
  try {
    soundHook?.(kind);
  } catch {
    /* sound must never break UI */
  }
}
