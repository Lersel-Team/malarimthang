import { test, expect } from '@playwright/test';

test('shop art is baked at boot: scenery, props and 5x8 customer sheets with 12 frames each', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?speed=8');
  await expect.poll(() => page.evaluate(() => !!(window as any).__game?.scene.getScenes(true)[0])).toBe(true);
  const r = await page.evaluate(async () => {
    const g = (window as any).__game;
    const scene = g.scene.getScenes(true)[0];
    const shop = await import('/src/art/shop.ts');
    const tex = g.textures;
    const keys = ['shop-sky', 'shop-skyline-far', 'shop-skyline-near', 'shop-ground', 'shop-eatzone', 'shop-stall', 'shop-lamp', 'shop-wires', 'shop-stool', 'shop-table', 'shop-bench', 'shop-bill', 'shop-cat-sleep', 'shop-cat-awake', 'shop-moto', 'shop-glow'];
    const sheets: string[] = [];
    for (const a of shop.ARCH_LIST) for (let v = 0; v < 8; v++) sheets.push(`cust-${a}-${v}`);
    void scene;
    return {
      missing: [...keys, ...sheets].filter((k) => !tex.exists(k)),
      frames: sheets.filter((k) => tex.exists(k)).every((k) => tex.get(k).getFrameNames().length === 12),
      total: (window as any).__artBoot?.total ?? 0,
    };
  });
  expect(r.missing).toEqual([]);
  expect(r.frames).toBe(true);
  expect(r.total).toBeGreaterThan(0);
  expect(r.total).toBeLessThan(1500); // target < 500 ms on a desktop; generous for CI
  expect(errors).toEqual([]);
});

test('shop demo renders customers without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/shop-demo.html?speed=6');
  await page.waitForTimeout(6000);
  expect(errors).toEqual([]);
  const ms = await page.evaluate(() => (window as any).__bootMs?.total);
  expect(ms).toBeGreaterThan(0);
});
