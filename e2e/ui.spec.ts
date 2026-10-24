import { test, expect, type Page } from '@playwright/test';

async function seed(page: Page, o: { money?: number; stock?: Record<string, number> } = {}) {
  await page.goto('/package.json');
  await page.evaluate(async (o) => {
    const eco = await import('/src/core/economy.ts');
    const s = eco.newGame();
    s.money = o.money ?? 1000;
    s.stock = o.stock ?? {};
    localStorage.setItem('malarimthang_save_v1', JSON.stringify(s));
  }, o);
}
const activeScene = (page: Page) => page.evaluate(() => (window as any).__game?.scene.getScenes(true)[0]?.scene.key ?? '');
const sessionState = (page: Page) =>
  page.evaluate(async () => {
    const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/src\/session\.ts/.test(n))!;
    const { session } = await import(/* @vite-ignore */ u);
    return { money: session.state.money as number, stock: session.state.stock as Record<string, number> };
  });

test('market: buy, undo, refuse to open with no stock, then open the shift', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await expect.poll(() => activeScene(page), { timeout: 15_000 }).toBe('Market');
  await page.waitForTimeout(600);
  const m0 = (await sessionState(page)).money;
  await page.mouse.click(180, 692); // เปิดร้าน with no stock: stays on Market
  await page.waitForTimeout(500);
  expect(await activeScene(page)).toBe('Market');
  await page.mouse.click(330, 131); // + on the first card
  await page.waitForTimeout(300);
  const a = await sessionState(page);
  expect(a.money).toBeLessThan(m0);
  await page.mouse.click(246, 131); // - undoes exactly
  await page.waitForTimeout(300);
  expect((await sessionState(page)).money).toBe(m0);
  await page.mouse.click(330, 131);
  await page.waitForTimeout(300);
  await page.mouse.click(180, 692);
  await expect.poll(() => activeScene(page), { timeout: 5000 }).toBe('Shift');
});

test('first launch shows the name card with the DOM input', async ({ page }) => {
  await page.goto('/package.json');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.locator('input.mrt-input')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('button.mrt-btn')).toHaveCount(1);
  await page.waitForTimeout(500); // card pop-in animation
  const box = await page.locator('button.mrt-btn').boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.locator('button.mrt-btn').click();
  await expect.poll(() => activeScene(page), { timeout: 8000 }).toBe('Market');
});

test('ui kit sheet renders without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && !(m.location().url ?? '').match(/favicon|package\.json/) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/ui-kit.html');
  await expect.poll(() => page.evaluate(() => (window as any).__sheetMax ?? 0), { timeout: 10_000 }).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
