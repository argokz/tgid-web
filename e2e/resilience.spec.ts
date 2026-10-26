import { test, expect, type Page } from '@playwright/test';
import { mapEval, openMap, openTool } from './helpers';

/**
 * Надёжность (этап 9, раздел 14 плана): сбои подставляются в браузере (page.route), до сервера запросы не
 * доходят — база не меняется. Проверяется: карта живёт, видна причина и «Повторить», черновик формы не теряется.
 */

/** Карта продолжает отвечать: камера двигается, участки на месте */
async function expectMapAlive(page: Page) {
  const moved = await mapEval<boolean>(
    page,
    'const z = map.getZoom(); map.jumpTo({ zoom: z + 0.5 }); const ok = Math.abs(map.getZoom() - z - 0.5) < 1e-6; map.jumpTo({ zoom: z }); return ok;',
  );
  expect(moved).toBe(true);
}

/** Открытый журнал по заголовку карточки (у панели «Инструменты» тоже есть слова «нарушения», «шурфовки») */
function journalDialog(page: Page, title: string) {
  return page.locator('.v-overlay--active .v-card').filter({ has: page.getByText(title, { exact: true }) }).first();
}

test.describe('Сбои API и сети', () => {
  test.beforeEach(async ({ page }) => {
    await openMap(page);
  });

  test('API 500 на список журнала: причина и «Повторить», после восстановления — данные', async ({ page }) => {
    await page.route('**/api/defects?**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"boom"}' }));
    await openTool(page, 'Нарушения');
    const dialog = journalDialog(page, 'Журнал нарушений');
    const retry = dialog.getByRole('button', { name: 'Повторить' });
    await expect(retry).toBeVisible();
    await expect(dialog.locator('.state-view--error')).toBeVisible();
    await expectMapAlive(page);

    await page.unroute('**/api/defects?**');
    await retry.click();
    await expect(dialog.locator('.state-view--error')).toHaveCount(0);
    await expect(dialog.locator('.state-view--loading')).toHaveCount(0, { timeout: 60_000 });
  });

  test('таймаут и обрыв сети на списке: сообщение без зависания', async ({ page }) => {
    await page.route('**/api/defects?**', (route) => route.abort('timedout'));
    await openTool(page, 'Нарушения');
    const dialog = journalDialog(page, 'Журнал нарушений');
    await expect(dialog.locator('.state-view--error')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Повторить' })).toBeVisible();

    await page.route('**/api/defects?**', (route) => route.abort('internetdisconnected'));
    await dialog.getByRole('button', { name: 'Повторить' }).click();
    await expect(dialog.locator('.state-view--error')).toBeVisible();
    await expectMapAlive(page);
  });

  test('обрыв сети на середине сохранения: ошибка видна, правка в форме осталась', async ({ page }) => {
    await openTool(page, 'Шурфовки');
    const dialog = journalDialog(page, 'Журнал шурфовок');
    const firstRow = dialog.locator('tbody tr').first();
    await expect(dialog.locator('.state-view--loading')).toHaveCount(0, { timeout: 60_000 });
    test.skip(await dialog.locator('.state-view--empty').isVisible(), 'в журнале нет записей для правки');
    await firstRow.click();
    // карточка записи — своё окно поверх списка
    const record = page.locator('.v-dialog.v-overlay--active').last();
    const edit = record.getByRole('button', { name: 'Редактировать' });
    const canEdit = await edit.waitFor({ timeout: 15_000 }).then(() => true, () => false);
    test.skip(!canEdit, 'правка выключена (роль или MUTATIONS_ENABLED=false)');
    await edit.click();

    const field = record.getByRole('textbox', { name: 'Номер дома' });
    await expect(field).toBeVisible();
    const marker = ` e2e-${Date.now()}`;
    await field.click();
    await field.press('End');
    await field.pressSequentially(marker);

    // запись не уходит на сервер: запрос обрывается в браузере
    let writes = 0;
    await page.route('**/api/**', (route) => {
      if (['POST', 'PUT', 'PATCH'].includes(route.request().method())) {
        writes += 1;
        return route.abort('internetdisconnected');
      }
      return route.continue();
    });
    await record.getByRole('button', { name: 'Сохранить' }).click();
    await expect.poll(() => writes).toBeGreaterThan(0);
    await expect(page.locator('.v-snackbar, [role="alert"]').filter({ hasText: /недоступ|подключ|ошибк|сохран/i }).first()).toBeVisible();
    await expect(field).toHaveValue(new RegExp(`${marker.trim()}$`));
    await expect(record.getByRole('button', { name: 'Сохранить' })).toBeEnabled();

    await page.unroute('**/api/**');
    await record.getByRole('button', { name: 'Отмена' }).click();
    await expectMapAlive(page);
  });

  test('устаревший чанк после выкатки: предложение обновить страницу, карта работает', async ({ page }) => {
    // панель «Инструменты» загружаем заранее, затем любой ещё не загруженный ленивый чанк отвечает 404 —
    // как после замены сборки на сервере
    await page.getByRole('button', { name: 'Инструменты', exact: true }).click();
    const item = page.locator('.tools-panel__item[aria-label="Справочники"]');
    await expect(item).toBeVisible();
    await page.route(/\/_nuxt\/[^/]+\.js$/, (route) => route.fulfill({ status: 404, body: 'Not Found' }));
    await item.click();
    await expect(page.locator('.v-snackbar').filter({ hasText: /обновлено на сервере/i }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.v-snackbar').getByRole('button', { name: 'Обновить' })).toBeVisible();
    await expectMapAlive(page);
  });
});
