import Phaser from 'phaser';
import { COOKING } from '../../data/balance';
import type { ItemDef } from '../../data/balance';
import { ALMOST_FROM, type Skewer, type Zone } from '../../core/cooking';

export const BODY_H = 92;
export const FONT = '"Noto Sans Thai", Tahoma, sans-serif';

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

/** Cook colour + blend strength for a cook value (raw -> golden -> charred -> black). */
function cookTint(c: number, def: ItemDef): { col: number; k: number } {
  const w = def.window;
  const bm = COOKING.burnMargin;
  const pts: [number, number, number][] = [
    [0, 0, 0xffffff],
    [ALMOST_FROM, 0.15, 0xffe9b0],
    [1, 0.5, 0xe8b04a],
    [1 + w, 0.55, 0xd9a040],
    [1 + w + bm, 0.85, 0x4a2a14],
    [ringMax(def), 1, 0x0c0a0a],
  ];
  if (c <= 0) return { col: pts[0][2], k: 0 };
  for (let i = 1; i < pts.length; i++) {
    if (c <= pts[i][0]) {
      const t = (c - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
      return { col: mix(pts[i - 1][2], pts[i][2], t), k: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t };
    }
  }
  return { col: pts[pts.length - 1][2], k: 1 };
}

/** Draws the chunks + stick, centred on (0,0), showing the given cook value. */
export function drawBody(g: Phaser.GameObjects.Graphics, def: ItemDef, c: number, burst = false): void {
  const { col, k } = cookTint(c, def);
  const t = (base: number) => mix(base, col, k);
  // stick
  g.fillStyle(0xc89a5a, 1);
  g.fillRect(-1.5, -BODY_H / 2 - 14, 3, BODY_H + 14);
  g.fillTriangle(-1.5, BODY_H / 2, 1.5, BODY_H / 2, 0, BODY_H / 2 + 8);
  const n = def.id === 'enoki' ? 3 : 4;
  const pitch = (BODY_H - 24) / (n - 1);
  for (let i = 0; i < n; i++) {
    const y = -BODY_H / 2 + 12 + i * pitch;
    if (burst) {
      g.fillStyle(0xe8c040, 0.9);
      g.fillEllipse(0, y, 30, 9);
      continue;
    }
    switch (def.id) {
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
): void {
  const by = BODY_H / 2 + 16;
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
