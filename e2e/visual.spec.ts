import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';

const PINIA = "document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s";

/**
 * Карта открыта и прошла первый кадр (экран загрузки ушёл). Участки сети не ждём: на узком экране в стартовый кадр
 * фрагмент может не попасть, а холст карты всё равно замаскирован.
 */
async function openShell(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('firstRunHints', '1'); } catch { /* без хранилища подсказка просто покажется */ }
  });
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => page.evaluate(`${PINIA}.get('map').firstFrameShown === true`), { timeout: 90_000 }).toBe(true);
}

/** Журнал через палитру команд: кнопка «Инструменты» на телефоне спрятана в меню */
async function openViaPalette(page: Page, label: string) {
  await page.keyboard.press('Control+k');
  await expect(page.locator('.command-palette__card')).toBeVisible();
  await page.keyboard.type(label);
  await page.locator('.command-palette__card [role="option"]').filter({ hasText: label }).first().click();
}

/**
 * Визуальная регрессия (этап 9, раздел 14 плана): ключевые экраны в пяти ширинах, портрет и альбом для 375 и 768.
 * Эталоны — e2e/visual.spec.ts-snapshots/ (в репозитории), порог различий 0,1 %. Окна снимаются сами по себе,
 * экран карты — целиком без холста. Обновить эталоны после намеренной правки:
 *   npx playwright test e2e/visual.spec.ts --update-snapshots
 */
const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '375-land', width: 812, height: 375 },
  { name: '768', width: 768, height: 1024 },
  { name: '768-land', width: 1024, height: 768 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
];

/**
 * Холст карты (тайлы и подложка меняются от загрузки к загрузке) и масштабная линейка скрыты стилем на время снимка
 * (e2e/visual-hide-map.css):
 * маска Playwright легла бы поверх панелей и кнопок, лежащих над картой
 */
const SHOT = {
  maxDiffPixelRatio: 0.001,
  animations: 'disabled' as const,
  caret: 'hide' as const,
  stylePath: fileURLToPath(new URL('./visual-hide-map.css', import.meta.url)),
};

for (const vp of VIEWPORTS) {
  test.describe(`экраны ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' });

    test.beforeEach(async ({ page }) => {
      await openShell(page);
    });

    test('карта', async ({ page }) => {
      await expect(page).toHaveScreenshot(`map-${vp.name}.png`, SHOT);
    });

    test('палитра команд', async ({ page }) => {
      await page.keyboard.press('Control+k');
      const palette = page.locator('.command-palette__card');
      await expect(palette).toBeVisible();
      await expect(palette).toHaveScreenshot(`palette-${vp.name}.png`, SHOT);
    });

    test('журнал нарушений', async ({ page }) => {
      await openViaPalette(page, 'Нарушения');
      const dialog = page.locator('.v-overlay--active .v-card').filter({ has: page.getByText('Журнал нарушений', { exact: true }) }).first();
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.state-view--loading')).toHaveCount(0, { timeout: 60_000 });
      await expect(dialog).toHaveScreenshot(`defects-${vp.name}.png`, SHOT);
    });
  });
}
