import { test, expect } from '@playwright/test';

test('item art: 22 items x 5 stages + overlays + tools are rasterised at RES x', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?speed=8');
  await expect.poll(() => page.evaluate(() => !!(window as any).__game?.scene.getScenes(true)[0]), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).__game.textures.exists('item-wagyu-burnt')), { timeout: 15_000 }).toBe(true);
  const r = await page.evaluate(async () => {
    const g = (window as any).__game;
    const a = await import('/src/art/items.ts');
    const { RES } = await import('/src/engine/hidpi.ts');
    const missing: string[] = [];
    for (const id of a.ITEM_IDS) for (const st of a.STAGES) if (!g.textures.exists(a.itemTex(id, st))) missing.push(id + st);
    const img = g.textures.get('item-fishball-perfect').getSourceImage();
    return { n: a.ITEM_IDS.length, missing, tool: g.textures.exists('tool-fryer') && g.textures.exists('box-cup'), w: img.width, RES };
  });
  expect(r.n).toBe(22);
  expect(r.missing).toEqual([]);
  expect(r.tool).toBe(true);
  expect(r.w).toBe(40 * r.RES);
  expect(errors).toEqual([]);
});
