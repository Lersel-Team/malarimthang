// Scene backdrops: night street skyline (Boot/Name) and market wall with string lights (Market).
import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../../config';
import { PALETTE } from '../palette';

export interface Backdrop {
  /** Shifts the layers by different amounts for a subtle parallax; p is any scroll-like value in px. */
  setParallax(p: number): void;
}

function sky(scene: Phaser.Scene, top: number, bottom: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(0, 0, GAME_W, GAME_H);
  return g;
}

function stars(scene: Phaser.Scene, n: number, maxY: number, seed = 5): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  let a = seed;
  const r = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) {
    g.fillStyle(0xf6e7c8, 0.25 + r() * 0.55);
    g.fillCircle(r() * GAME_W, r() * maxY, 0.5 + r() * 0.9);
  }
  return g;
}

function skyline(scene: Phaser.Scene, baseY: number, color: number, seed: number, minH: number, maxH: number, lit: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  let a = seed;
  const r = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let x = -10; x < GAME_W + 10; ) {
    const w = 30 + r() * 38, h = minH + r() * (maxH - minH);
    g.fillStyle(color, 1).fillRect(x, baseY - h, w, h + 300);
    g.fillStyle(0xffffff, 0.04).fillRect(x, baseY - h, w, 2);
    for (let wy = baseY - h + 8; wy < baseY - 6; wy += 11) {
      for (let wx = x + 5; wx < x + w - 6; wx += 9) {
        if (r() < lit) {
          g.fillStyle(r() < 0.7 ? PALETTE.lamp.hex : 0xff9a5a, 0.25 + r() * 0.4).fillRect(wx, wy, 4, 5);
        }
      }
    }
    x += w + 1 + r() * 4;
  }
  return g;
}

/** Soft glow sprite (additive) at logical position. */
export function uiGlow(scene: Phaser.Scene, x: number, y: number, size: number, alpha = 0.55): Phaser.GameObjects.Image {
  return scene.add.image(x, y, 'ui-glow').setDisplaySize(size, size).setBlendMode(Phaser.BlendModes.ADD).setAlpha(alpha);
}

/** Sagging wire with hanging bulbs between (x0,y0) and (x1,y1). Bulbs sway; glows pulse. Returns the container. */
export function uiStringLights(scene: Phaser.Scene, x0: number, x1: number, y: number, sag: number, count: number, seed = 3): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.lineStyle(1.4, 0x10091c, 0.9);
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    pts.push(new Phaser.Math.Vector2(x0 + (x1 - x0) * t, y + Math.sin(t * Math.PI) * sag));
  }
  g.strokePoints(pts, false);
  c.add(g);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const bx = x0 + (x1 - x0) * t, by = y + Math.sin(t * Math.PI) * sag;
    const glow = uiGlow(scene, bx, by + 10, 56 + ((i + seed) % 3) * 8, 0.5);
    const bulb = scene.add.image(bx, by + 8, 'ui-bulb').setDisplaySize(9, 14);
    c.add([glow, bulb]);
    scene.tweens.add({ targets: glow, alpha: 0.32, scale: glow.scale * 0.92, duration: 1300 + ((i * 377 + seed * 91) % 900), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: bulb, angle: { from: -4, to: 4 }, duration: 1800 + ((i * 211) % 700), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  return c;
}

/** Night street: sky, stars, moon, two skyline layers and a warm ground haze. For Boot / Name. */
export function nightStreet(scene: Phaser.Scene): Backdrop {
  const far = scene.add.container(0, 0);
  far.add(sky(scene, 0x130b22, 0x3a2456));
  far.add(stars(scene, 60, 360));
  const moon = scene.add.graphics();
  moon.fillStyle(0xf6e7c8, 0.1).fillCircle(290, 110, 34).fillStyle(0xf6e7c8, 0.95).fillCircle(290, 110, 17);
  moon.fillStyle(0x2a1d47, 0.9).fillCircle(297, 106, 15);
  far.add(moon);
  const midHaze = scene.add.graphics();
  midHaze.fillGradientStyle(0xff6a2a, 0xff6a2a, 0xff6a2a, 0xff6a2a, 0, 0, 0.3, 0.3);
  midHaze.fillRect(0, GAME_H * 0.45, GAME_W, GAME_H * 0.55);
  far.add(midHaze);
  const l1 = scene.add.container(0, 0, [skyline(scene, GAME_H * 0.62, 0x241838, 11, 90, 220, 0.18)]);
  const ground = scene.add.graphics();
  ground.fillGradientStyle(0x2a1d47, 0x2a1d47, 0x0e0818, 0x0e0818, 1);
  ground.fillRect(0, GAME_H * 0.8, GAME_W, GAME_H * 0.2);
  ground.fillStyle(PALETTE.lamp.hex, 0.35).fillRect(0, GAME_H * 0.8, GAME_W, 2);
  const l2 = scene.add.container(0, 0, [skyline(scene, GAME_H * 0.74, 0x180f28, 29, 60, 160, 0.3), ground]);
  const lights = uiStringLights(scene, -10, GAME_W + 10, 22, 22, 7, 2);
  return {
    setParallax(p: number) {
      far.x = p * 0.02;
      l1.x = p * 0.05;
      l2.x = p * 0.09;
      lights.x = p * 0.13;
    },
  };
}

/** Wooden plank counter strip (for bottom action areas). Centre-based like all kit widgets? No: top-left. */
export function uiCounter(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x7a4c28, 0x7a4c28, 0x4a2c16, 0x4a2c16, 1);
  g.fillRect(0, 0, w, h);
  g.fillStyle(0xffd9a0, 0.45).fillRect(0, 0, w, 2);
  g.fillStyle(0x1b1230, 0.85).fillRect(0, -1.5, w, 1.5);
  g.lineStyle(1, 0x2a1608, 0.45);
  for (let py = 22; py < h; py += 24) g.lineBetween(0, py, w, py);
  let a = 17;
  const r = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.lineStyle(1, 0xc89a5a, 0.12);
  for (let i = 0; i < 26; i++) {
    const gx = r() * w, gy = r() * h;
    g.lineBetween(gx, gy, gx + 20 + r() * 40, gy);
  }
  g.fillStyle(0x2a1608, 0.9);
  for (let px = 18; px < w; px += 108) g.fillCircle(px, 8, 1.6);
  const shade = scene.add.graphics();
  shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.35, 0.35, 0, 0);
  shade.fillRect(0, -14, w, 14);
  return scene.add.container(x, y, [shade, g]);
}

/** Market wall: plank wall with a warm glow from the top and sagging lamps. */
export function marketWall(scene: Phaser.Scene): Backdrop {
  const wall = scene.add.graphics();
  wall.fillGradientStyle(0x2a1d47, 0x2a1d47, 0x160e26, 0x160e26, 1);
  wall.fillRect(-20, 0, GAME_W + 40, GAME_H);
  wall.lineStyle(1, 0x000000, 0.28);
  for (let x = 10; x < GAME_W + 20; x += 36) wall.lineBetween(x, 0, x, GAME_H);
  wall.lineStyle(1, 0xffffff, 0.04);
  for (let x = 11; x < GAME_W + 20; x += 36) wall.lineBetween(x, 0, x, GAME_H);
  const warm = scene.add.graphics();
  warm.fillGradientStyle(0xffb24a, 0xffb24a, 0xffb24a, 0xffb24a, 0.28, 0.28, 0, 0);
  warm.fillRect(0, 60, GAME_W, 260);
  const props = scene.add.graphics();
  const crate = (x: number, y: number, w: number, h: number, a = 0.9) => {
    props.fillStyle(0x4a2c16, a).fillRoundedRect(x, y, w, h, 3);
    props.fillStyle(0x6b4426, a).fillRect(x + 3, y + 3, w - 6, h - 6);
    props.lineStyle(1.5, 0x1b1230, 0.8).strokeRoundedRect(x, y, w, h, 3);
    props.lineStyle(1, 0x2a1608, 0.7);
    for (let ly = y + 14; ly < y + h - 4; ly += 13) props.lineBetween(x + 3, ly, x + w - 3, ly);
    props.fillStyle(0xffd9a0, 0.18).fillRect(x + 3, y + 3, w - 6, 2);
    props.fillStyle(0x2a1608, 0.9).fillCircle(x + 7, y + 7, 1.4).fillCircle(x + w - 7, y + 7, 1.4).fillCircle(x + 7, y + h - 7, 1.4).fillCircle(x + w - 7, y + h - 7, 1.4);
  };
  crate(12, 504, 74, 52);
  crate(26, 456, 52, 48);
  crate(92, 526, 52, 30);
  // sack
  props.fillStyle(0xb89560, 0.85).fillEllipse(318, 536, 62, 44).fillRoundedRect(300, 498, 36, 30, 8);
  props.lineStyle(1.5, 0x1b1230, 0.8).strokeEllipse(318, 536, 62, 44);
  props.fillStyle(0x6b4426, 0.9).fillRect(302, 504, 32, 4);
  props.fillStyle(0xffffff, 0.12).fillEllipse(306, 530, 18, 10);
  // chili string
  props.lineStyle(1.4, 0x10091c, 0.8).lineBetween(336, 100, 336, 150);
  for (let i = 0; i < 4; i++) {
    props.fillStyle(PALETTE.mala.hex, 0.9).fillEllipse(336 + (i % 2 ? 5 : -5), 112 + i * 11, 6, 13);
  }
  const shade = scene.add.graphics();
  shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.45, 0.45);
  shade.fillRect(0, 380, GAME_W, 176);
  const wallC = scene.add.container(0, 0, [wall, warm, props, shade]);
  const lights = uiStringLights(scene, -10, GAME_W + 10, 92, 14, 6, 4);
  return {
    setParallax(p: number) {
      wallC.y = -p * 0.04;
      lights.y = -p * 0.1;
    },
  };
}
