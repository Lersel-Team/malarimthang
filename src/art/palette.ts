// Night-street palette. Hex numbers for Phaser, css strings for Text/DOM. See docs/ART.md.
const defs = {
  night: '#1b1230', // deep indigo, also the outline colour
  night2: '#2a1d47',
  lamp: '#ffb24a', // warm lamp light
  ember: '#ff6a2a',
  mala: '#d6342b',
  chili: '#b01e1e',
  cream: '#f6e7c8',
  wood: '#8a5a34',
  woodDark: '#5c3a20',
  steel: '#8c97a6',
  tea: '#6ec28a',
  // UI neutrals
  ink: '#10091c',
  text: '#f6d8a0',
  textDim: '#9a8aa8',
  panel: '#2a1d36',
  white: '#ffffff',
  black: '#000000',
} as const;

export type PaletteKey = keyof typeof defs;
const num = (h: string) => parseInt(h.slice(1), 16);

export const PALETTE = Object.fromEntries(
  Object.entries(defs).map(([k, v]) => [k, { hex: num(v), css: v }]),
) as Record<PaletteKey, { hex: number; css: string }>;

/** Outline: night indigo at 85% alpha, 1.5 logical px. */
export const OUTLINE = { color: num(defs.night), alpha: 0.85, width: 1.5 } as const;
