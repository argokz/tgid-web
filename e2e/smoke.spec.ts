import { test, expect } from '@playwright/test';
import { FRAGMENT_ID, focusFragmentPipe, mapEval, openMap, openTool } from './helpers';

/**
 * Smoke по ключевым сценариям на копии БД. Только чтение: ничего не пишет
 * (анализ режима, пьезометр и каталог отчётов — GET/POST без изменений данных).
 */
let hydrationWarnings: string[] = [];

test.describe('ITwin Map smoke', () => {
  test.beforeEach(async ({ page }) => {
    hydrationWarnings = [];
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    page.on('console', (m) => {
      if (/hydration/i.test(m.text())) hydrationWarnings.push(m.text().slice(0, 200));
    });
    await openMap(page);
  });

  test('карта грузится со слоями участков и узлов', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Инструменты', exact: true })).toBeVisible();
    // регресс: SSR и первый клиентский рендер шапки совпадают
    expect(hydrationWarnings).toEqual([]);
    // регресс: слой узлов не должен падать по таймауту ожидания стиля
    await expect
      .poll(() => mapEval<boolean>(page, "return map.getStyle().layers.some(l => l.id.startsWith('mvt__AlmatyGIS__uzel'))"), {
        timeout: 60_000,
      })
      .toBe(true);
  });

  test('клик по участку открывает карточку', async ({ page }) => {
    const pipe = await focusFragmentPipe(page);
    await page.mouse.click(pipe.mid.x, pipe.mid.y);
    const card = page.locator('.ap-card');
    // несколько объектов под курсором (участок в нескольких фрагментах) → «Выберите объект»
    const menuItem = page.getByText(`ID: ${FRAGMENT_ID}`, { exact: true }).or(page.getByText(/^ID: \d+$/)).first();
    await expect(card.or(menuItem)).toBeVisible();
    if (!(await card.isVisible())) await menuItem.click();
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Участок|участок/);
  });

  test(`«Анализ режима» по фрагменту ${FRAGMENT_ID}`, async ({ page }) => {
    await openTool(page, 'Анализ режима');
    const dialog = page.locator('.v-overlay--active .v-card').filter({ hasText: 'Анализ режима' }).first();
    await expect(dialog).toBeVisible();
    const fragmentInput = dialog.getByRole('combobox').first();
    await fragmentInput.click();
    await page.keyboard.type(String(FRAGMENT_ID));
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: `#${FRAGMENT_ID}` }).first().click();
    const response = page.waitForResponse((r) => r.url().includes('/api/analysis/regime/') && r.request().method() === 'GET');
    await dialog.getByRole('button', { name: 'Выполнить' }).click();
    expect((await response).status()).toBe(200);
    await expect(dialog.locator('table tbody tr').first().or(dialog.getByText('Записей нет.'))).toBeVisible();
  });

  test('пьезометрический график по двум узлам', async ({ page }) => {
    const pipe = await focusFragmentPipe(page);
    await page.getByRole('button', { name: 'Пьезометрический график' }).click();
    const panel = page.locator('[aria-label="Построение маршрута пьезометра"]');
    await expect(panel).toBeVisible();
    await page.mouse.click(pipe.start.x, pipe.start.y);
    await page.mouse.click(pipe.end.x, pipe.end.y);
    await expect(panel.locator('.v-chip')).toHaveCount(2);
    const response = page.waitForResponse((r) => r.url().includes('piezometer/route'));
    await panel.getByRole('button', { name: 'Построить график' }).click();
    expect((await response).status()).toBe(200);
    const modal = page.locator('.v-overlay--active').filter({ has: page.getByText('Пьезометрический график', { exact: true }) }).first();
    await expect(modal).toBeVisible();
    await modal.getByRole('tab', { name: 'Таблица узлов' }).click();
    await expect(modal.locator('.piezo-table tbody tr').first()).toBeVisible();
  });

  test('открываются «Отчёты Excel» с каталогом', async ({ page }) => {
    const catalog = page.waitForResponse((r) => r.url().includes('/api/reports/catalog'));
    await openTool(page, 'Отчёты Excel');
    expect((await catalog).status()).toBe(200);
    const dialog = page.locator('.v-overlay--active .v-card').filter({ hasText: 'Отчёты Excel' }).first();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.v-list-item').first()).toBeVisible();
  });
});
