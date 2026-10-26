import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { clickAndChooseFragment, focusFragmentPipe, openMap, openTool } from './helpers';

/**
 * Доступность (этап 9, раздел 14 плана): axe на главной, инспекторе, журнале каждого типа и палитре команд.
 * Порог — 0 нарушений уровня critical; serious и ниже попадают в отчёт приёмки (аннотации теста).
 * Холст карты (WebGL) axe не проверяет — исключён.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function audit(page: Page, name: string, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS).exclude('canvas.maplibregl-canvas');
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  for (const v of violations) {
    test.info().annotations.push({
      type: `axe ${v.impact}`,
      description: `${name}: ${v.id} (${v.nodes.length}) — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('; ')}`,
    });
  }
  const critical = violations.filter((v) => v.impact === 'critical');
  expect(critical.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`), `${name}: critical`).toEqual([]);
  return violations;
}

/** Журналы и реестры по типам: операционный, оборудование, анализ, справочник, история */
const JOURNALS: Array<{ label: string; dialog: RegExp }> = [
  { label: 'Нарушения', dialog: /Нарушения|Журнал нарушений/ },
  { label: 'Запорная арматура', dialog: /арматура/i },
  { label: 'Анализ режима', dialog: /Анализ режима/ },
  { label: 'Справочники', dialog: /Справочники/ },
  { label: 'История правок', dialog: /История правок/ },
];

test.describe('Доступность (axe)', () => {
  test.beforeEach(async ({ page }) => {
    await openMap(page);
  });

  test('главная', async ({ page }) => {
    await audit(page, 'главная');
  });

  test('сводка и инспектор объекта', async ({ page }) => {
    const pipe = await focusFragmentPipe(page);
    const popover = page.locator('.map-popover');
    await clickAndChooseFragment(page, pipe.mid, popover);
    await audit(page, 'поповер', '.map-popover');
    await popover.getByRole('button', { name: 'Карточка' }).click();
    await expect(page.locator('.inspector')).toBeVisible();
    await audit(page, 'инспектор', '.inspector');
  });

  test('палитра команд', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.locator('.command-palette__card')).toBeVisible();
    await page.keyboard.type('узел');
    await audit(page, 'палитра', '.command-palette__card');
  });

  for (const j of JOURNALS) {
    test(`журнал «${j.label}»`, async ({ page }) => {
      await openTool(page, j.label);
      const dialog = page.getByRole('dialog').filter({ hasText: j.dialog }).last();
      await expect(dialog).toBeVisible();
      // дождаться данных или пустого состояния, а не скелетона
      await expect(dialog.locator('.v-skeleton-loader, .state-view--loading')).toHaveCount(0, { timeout: 60_000 });
      await audit(page, j.label, '.v-overlay--active');
    });
  }
});
