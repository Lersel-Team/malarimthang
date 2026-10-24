import Phaser from 'phaser';
import { COOKING } from '../../data/balance';
import type { ItemDef } from '../../data/balance';
import { ALMOST_FROM, type Skewer, type Zone } from '../../core/cooking';

export const BODY_H = 92;
export const FONT = '"Kanit", "Noto Sans Thai", Tahoma, sans-serif';
export const FONT_FUN = '"Mali", "Kanit", sans-serif';

export const ZONE_COLOR: Record<Zone, number> = {
  raw: 0xd0708a,
  almost: 0xf2e2a0,
  perfect: 0xffc83a,
  charred: 0x8a5a30,
  burnt: 0x3a3030,
};

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t)
  );
}

/** Max cook value shown on the doneness ring. */
export function ringMax(def: ItemDef): number {
  return 1 + def.window + COOKING.burnMargin + 0.25;
}

/**
 * Maps a cook value to two art stages + crossfade (raw -> almost -> perfect -> charred -> burnt).
 * Sprites show stage `a`, with stage `b` faded in by `t`.
 */
export function cookStages(c: number, def: ItemDef, margin: number = COOKING.burnMargin): { a: Zone; b: Zone; t: number } {
  const w = def.window;
  const pts: [number, Zone][] = [
    [0, 'raw'],
    [ALMOST_FROM * 0.9, 'almost'],
    [1, 'perfect'],
    [1 + w, 'perfect'],
    [1 + w + margin * 0.6, 'charred'],
    [1 + w + margin + 0.12, 'burnt'],
  ];
  if (c <= 0) return { a: 'raw', b: 'raw', t: 0 };
  for (let i = 1; i < pts.length; i++) {
    if (c <= pts[i][0]) {
      const t = (c - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
      return { a: pts[i - 1][1], b: pts[i][1], t: t < 0.02 ? 0 : t };
    }
  }
  return { a: 'burnt', b: 'burnt', t: 0 };
}

/** LEGACY procedural icon (kept for MarketScene/art-ui until they adopt itemIcon from src/art/items.ts). */
/** One chunk of an item (fish ball, pork slab, ...) centred at (0, y); t tints a base colour for doneness. */
function drawChunk(g: Phaser.GameObjects.Graphics, id: string, y: number, t: (base: number) => number): void {
  switch (id) {
    case 'fishball':
      g.fillStyle(t(0xcfcac4), 1);
      g.fillCircle(0, y, 11);
      g.fillStyle(t(0xe6e2dc), 1);
      g.fillCircle(-3, y - 3, 4);
      break;
    case 'crabstick':
      // slim stick: orange-red skin over white
      g.fillStyle(t(0xf2ece4), 1);
      g.fillRoundedRect(-11, y - 4, 22, 8, 4);
      g.fillStyle(t(0xf0603a), 1);
      g.fillRoundedRect(-11, y - 4, 22, 4, { tl: 4, tr: 4, bl: 0, br: 0 });
      break;
    case 'enoki':
      for (let j = -2; j <= 2; j++) {
        g.fillStyle(t(0xf3e6c0), 1);
        g.fillRect(j * 3.6 - 1.2, y - 13, 2.4, 26);
        g.fillStyle(t(0xe8d49a), 1);
        g.fillCircle(j * 3.6, y - 13, 2.2);
      }
      break;
    case 'porkbelly':
      // chunky slab: rind, lean, fat, lean, fat (reads differently from the slim crab stick)
      g.fillStyle(t(0xf6e6e2), 1);
      g.fillRoundedRect(-15, y - 9, 30, 18, 4);
      g.fillStyle(t(0xd9707a), 1);
      g.fillRect(-15, y - 6, 30, 4);
      g.fillRect(-15, y + 1, 30, 4);
      g.fillStyle(t(0xb8865a), 1);
      g.fillRoundedRect(-15, y - 9, 30, 3, { tl: 4, tr: 4, bl: 0, br: 0 });
      break;
    default:
      g.fillStyle(t(0xcc9a6a), 1);
      g.fillRoundedRect(-12, y - 8, 24, 16, 5);
  }
}

/** Order-ticket icon: one raw chunk on a stub of stick, centred on (0,0), ~30 px tall at scale 1. */
export function drawIcon(g: Phaser.GameObjects.Graphics, def: ItemDef): void {
  g.fillStyle(0xc89a5a, 1);
  g.fillRect(-1.5, -15, 3, 30);
  drawChunk(g, def.id, 0, (base) => base);
}

/** Two-side indicator (down side marked) + optional doneness ring, relative to the body. */
export function drawIndicators(
  g: Phaser.GameObjects.Graphics,
  def: ItemDef,
  zones: [Zone, Zone],
  down: 0 | 1,
  downC: number,
  ring: boolean,
  burst: boolean,
  status?: { oiled: boolean; sauce: 'none' | 'good' | 'early' },
): void {
  const by = BODY_H / 2 + 16;
  if (status) {
    // tiny state dots: oil (gold) left, sauce (red) right
    const dot = (x: number, on: boolean, col: number) => {
      g.fillStyle(on ? col : 0x000000, on ? 1 : 0.35);
      g.fillCircle(x, by + 3.5, 3.5);
      g.lineStyle(1, on ? 0xffffff : 0x8a7a80, on ? 0.8 : 0.6);
      g.strokeCircle(x, by + 3.5, 3.5);
    };
    dot(-26, status.oiled, 0xf0c020);
    dot(26, status.sauce !== 'none', status.sauce === 'early' ? 0xd04010 : 0xc02020);
  }
  for (let s = 0; s < 2; s++) {
    const x = s === 0 ? -9 : 9;
    g.fillStyle(burst ? 0x555555 : ZONE_COLOR[zones[s]], 1);
    g.fillRoundedRect(x - 7, by, 14, 7, 2);
    g.lineStyle(1, 0x000000, 0.5);
    g.strokeRoundedRect(x - 7, by, 14, 7, 2);
    if (s === down) {
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(x - 3, by + 11, x + 3, by + 11, x, by + 8);
    }
  }
  if (ring) {
    const cy = -BODY_H / 2 - 24;
    g.lineStyle(4, 0x000000, 0.45);
    g.beginPath();
    g.arc(0, cy, 9, 0, Math.PI * 2);
    g.strokePath();
    const f = Math.min(1, downC / ringMax(def));
    if (f > 0.01) {
      const z = zones[down];
      g.lineStyle(4, burst ? 0x555555 : ZONE_COLOR[z], 1);
      g.beginPath();
      g.arc(0, cy, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
      g.strokePath();
    }
    // tick where "perfect" begins
    const a = -Math.PI / 2 + (Math.PI * 2) / ringMax(def);
    g.lineStyle(1.5, 0xffffff, 0.9);
    g.lineBetween(Math.cos(a) * 6.5, cy + Math.sin(a) * 6.5, Math.cos(a) * 12, cy + Math.sin(a) * 12);
  }
}

export function makeTextures(scene: Phaser.Scene): void {
  const tx = scene.textures;
  const gen = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    if (tx.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  gen('puff', 16, 16, (g) => {
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(8, 8, 5);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 2.5);
  });
  gen('spark', 6, 6, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
  });
  gen('flame', 28, 46, (g) => {
    g.fillStyle(0xe8401a, 1);
    g.fillTriangle(14, 0, 2, 30, 26, 30);
    g.fillCircle(14, 31, 13);
    g.fillStyle(0xff9a2a, 1);
    g.fillTriangle(14, 10, 6, 32, 22, 32);
    g.fillCircle(14, 33, 9);
    g.fillStyle(0xffe27a, 1);
    g.fillTriangle(14, 22, 9, 36, 19, 36);
    g.fillCircle(14, 36, 5);
  });
}

export function skewerSnapshot(s: Skewer): Skewer {
  return { ...s, sides: [s.sides[0], s.sides[1]] };
}
