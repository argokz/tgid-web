import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import { FIRST_RUN_STORAGE_KEY, FIRST_RUN_VERSION } from '../utils/firstRunHints';

/**
 * Телефоны и планшеты (этап 9, раздел 14 плана): проекты iphone, ipad (WebKit, тач, DPR 2–3) и pixel (Chromium) в
 * playwright.config.ts. Настольные наборы рассчитаны на шапку и панели 1600×900, здесь — то, что видит палец:
 * карта, главное меню, панель слоёв, палитра и журнал, доступность главной, эталонный снимок экрана.
 */
const PINIA = "document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s";
const SHOT = {
  maxDiffPixelRatio: 0.001,
  animations: 'disabled' as const,
  caret: 'hide' as const,
  stylePath: fileURLToPath(new URL('./visual-hide-map.css', import.meta.url)),
};

async function openShell(page: Page) {
  await page.addInitScript(([key, version]) => {
    try { localStorage.setItem(key, version); } catch { /* без хранилища подсказка просто покажется */ }
  }, [FIRST_RUN_STORAGE_KEY, FIRST_RUN_VERSION] as const);
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => page.evaluate(`${PINIA}.get('map').firstFrameShown === true`), { timeout: 90_000 }).toBe(true);
}

test.describe('Телефон и планшет', () => {
  test.beforeEach(async ({ page }) => {
    await openShell(page);
  });

  test('карта: эталонный снимок, без горизонтальной прокрутки, доступность без critical', async ({ page }, info) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'горизонтальная прокрутка страницы').toBeLessThanOrEqual(0);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('canvas.maplibregl-canvas')
      .analyze();
    for (const v of violations) info.annotations.push({ type: `axe ${v.impact}`, description: `${v.id} (${v.nodes.length})` });
    expect(violations.filter((v) => v.impact === 'critical').map((v) => v.id)).toEqual([]);
    await expect(page).toHaveScreenshot('map.png', SHOT);
  });

  test('главное меню и панель слоёв открываются пальцем', async ({ page, isMobile }) => {
    const menu = page.getByRole('button', { name: 'Открыть меню' });
    if (await menu.isVisible()) {
      await menu.tap();
      await expect(page.getByRole('navigation', { name: 'Главное меню' }).or(page.locator('[aria-label="Главное меню"]')).first()).toBeVisible();
      await page.keyboard.press('Escape');
    } else {
      // планшет: разделы в шапке
      expect(isMobile).toBe(true);
      await expect(page.getByRole('button', { name: 'Инструменты', exact: true })).toBeVisible();
    }
    const layers = page.locator('.sidebar-toggle').first();
    if (await layers.isVisible()) {
      await layers.tap();
      await expect(page.getByText('Видимость и порядок').first()).toBeVisible();
    } else {
      await expect(page.getByText('Видимость и порядок').first()).toBeVisible();
    }
  });

  test('журнал через палитру команд', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const palette = page.locator('.command-palette__card');
    await expect(palette).toBeVisible();
    await page.keyboard.type('Нарушения');
    await palette.locator('[role="option"]').filter({ hasText: 'Нарушения' }).first().tap();
    const dialog = page.locator('.v-overlay--active .v-card').filter({ has: page.getByText('Журнал нарушений', { exact: true }) }).first();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.state-view--loading')).toHaveCount(0, { timeout: 60_000 });
    const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, 'журнал шире экрана').toBeLessThanOrEqual(0);
  });
});
