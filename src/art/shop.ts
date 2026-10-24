// Street, stall and customer art (owner: art-shop agent). Everything is SVG rasterised at RES x at boot.
import type Phaser from 'phaser';
import { loadSvg } from './svg';
import { preloadPeople } from './people';
import { PROPS } from './shop/props';
import { sceneryLayers } from './shop/scenery';

export { BULBS, DISPLAY_BOX, LANTERNS, LAMP, QDISPLAY, SIGN, sceneryLayers } from './shop/scenery';
export { ARCH_LIST, FEET_Y, CW, CH, frameRef, variantFor } from './people';
export type { FrameName } from './people';

/** Milliseconds the last preloadShop call took (scenery, props, people), for the boot-time budget. */
export const bootTimings = { scenery: 0, props: 0, people: 0, total: 0 };

export async function preloadShop(scene: Phaser.Scene): Promise<void> {
  const t0 = performance.now();
  const layers = sceneryLayers();
  const a = Promise.all(layers.map((l) => loadSvg(scene, l.key, l.svg, l.w, l.h))).then(() => (bootTimings.scenery = performance.now() - t0));
  const b = Promise.all(PROPS.map((p) => loadSvg(scene, p.key, p.svg, p.w, p.h))).then(() => (bootTimings.props = performance.now() - t0));
  const c = preloadPeople(scene).then(() => (bootTimings.people = performance.now() - t0));
  await Promise.all([a, b, c]);
  bootTimings.total = performance.now() - t0;
  (globalThis as { __artBoot?: typeof bootTimings }).__artBoot = { ...bootTimings };
}
