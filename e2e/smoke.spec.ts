import { test, expect } from '@playwright/test';

test('boots with ?speed=8, renders canvas, no console errors', async ({ page }) => {
  const errors: string[] = [];
  // favicon.ico 404 is known (no icon in index.html); ignore only that.
  page.on('console', (m) => m.type() === 'error' && !(m.location().url ?? '').endsWith('/favicon.ico') && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/?speed=8');
  await expect(page).toHaveTitle(/.+/);
  console.log('title:', await page.title());
  await expect(page.locator('canvas')).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => (window as any).__game?.scene.getScenes(true)[0]?.scene.key ?? ''), { timeout: 10_000 })
    .not.toBe('');

  await page.waitForTimeout(15_000);
  expect(errors).toEqual([]);
});

test('dev ?speed param is read', async ({ page }) => {
  await page.goto('/?speed=8');
  const speed = await page.evaluate(async () => {
    const m = await import('/src/devhooks.ts');
    return m.readDevSpeed(location.search);
  });
  expect(speed).toBe(8);
});
