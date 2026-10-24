import { test, expect } from '@playwright/test';

test('canvas is RES x logical size and loadSvg rasterises at RES x', async ({ page }) => {
  await page.goto('/?speed=8');
  await expect.poll(() => page.evaluate(() => !!(window as any).__game?.scene.getScenes(true)[0])).toBe(true);
  const r = await page.evaluate(async () => {
    const g = (window as any).__game;
    const { loadSvg } = await import('/src/art/svg.ts');
    const { RES } = await import('/src/engine/hidpi.ts');
    const scene = g.scene.getScenes(true)[0];
    const svg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#d6342b" stroke="#1b1230" stroke-width="1.5"/></svg>';
    await loadSvg(scene, 'test-dot', svg, 24, 24);
    await loadSvg(scene, 'test-dot', svg, 24, 24); // cached
    const f = scene.textures.get('test-dot').getSourceImage();
    return { RES, cw: g.canvas.width, ch: g.canvas.height, tw: f.width, th: f.height };
  });
  expect(r.cw).toBe(360 * r.RES);
  expect(r.ch).toBe(740 * r.RES);
  expect(r.tw).toBe(24 * r.RES);
  expect(r.th).toBe(24 * r.RES);
});
