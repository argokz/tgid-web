import { expect, type Locator, type Page } from '@playwright/test';

export const FRAGMENT_ID = Number(process.env.E2E_FRAGMENT_ID || 74);

/** maplibre Map из Pinia (mapStore.map) — только для тестов */
const MAP_EXPR = "document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s.get('map').map";

export async function mapEval<T, A = undefined>(page: Page, fn: string, arg?: A): Promise<T> {
  // fn — тело функции (map, arg) => ..., передаётся строкой, чтобы не тащить типы maplibre в браузер
  return page.evaluate(
    ([expr, body, a]) => {
      const map = (0, eval)(expr);
      return new Function('map', 'arg', body)(map, a);
    },
    [MAP_EXPR, fn, arg] as const,
  ) as Promise<T>;
}

/** Открыть карту и дождаться, пока участки сети отрисуются */
export async function openMap(page: Page) {
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(
      () => mapEval<number>(page, "return map ? map.queryRenderedFeatures().filter(f => f.layer.id.includes('heatpipesections')).length : 0"),
      { timeout: 90_000, message: 'участки сети не отрисовались' },
    )
    .toBeGreaterThan(0);
}

async function waitIdle(page: Page) {
  await mapEval(page, "return new Promise(r => { if (map.loaded()) setTimeout(r, 300); else map.once('idle', () => r()); setTimeout(r, 20000); })");
}

function findPipe(page: Page, fragmentId: number) {
  return mapEval<{ a: number[]; b: number[]; name: string } | null, number>(
    page,
    `const pipes = map.queryRenderedFeatures().filter(f => f.layer.id.includes('heatpipesections')
       && Number(f.properties.fileid) === arg && f.geometry.type === 'LineString');
     // участок ~100 м: на z17 концы (узлы) разойдутся на ~100 px и оба будут на экране
     const len = (g) => Math.hypot(g[0][0] - g[g.length-1][0], g[0][1] - g[g.length-1][1]);
     pipes.sort((x, y) => Math.abs(len(x.geometry.coordinates) - 0.001) - Math.abs(len(y.geometry.coordinates) - 0.001));
     const f = pipes[0];
     if (!f) return null;
     const c = f.geometry.coordinates;
     return { a: c[0], b: c[c.length - 1], name: String(f.properties.name || '') };`,
    fragmentId,
  );
}

export interface PipeOnScreen {
  mid: { x: number; y: number };
  start: { x: number; y: number };
  end: { x: number; y: number };
  name: string;
}

/**
 * Найти участок фрагмента на карте, приблизиться к нему (узлы видны с ~z16)
 * и вернуть экранные координаты середины и концов (концы = узлы).
 */
export async function focusFragmentPipe(page: Page, fragmentId = FRAGMENT_ID): Promise<PipeOnScreen> {
  // тайлы грузятся не сразу — ждём, пока участки фрагмента появятся в видимой области
  let target: { a: number[]; b: number[]; name: string } | null = null;
  await expect
    .poll(async () => (target = await findPipe(page, fragmentId)) !== null, {
      timeout: 90_000,
      message: `на карте нет участков фрагмента ${fragmentId}`,
    })
    .toBe(true);
  const { a, b } = target!;
  await mapEval<boolean, { a: number[]; b: number[] }>(page, 'map.jumpTo({ center: [(arg.a[0] + arg.b[0]) / 2, (arg.a[1] + arg.b[1]) / 2], zoom: 17 }); return true;', { a, b });
  await waitIdle(page);
  const px = await mapEval<{ s: { x: number; y: number }; e: { x: number; y: number } }, { a: number[]; b: number[] }>(
    page,
    'const s = map.project(arg.a), e = map.project(arg.b); return { s: { x: s.x, y: s.y }, e: { x: e.x, y: e.y } };',
    { a, b },
  );
  const box = (await page.locator('canvas.maplibregl-canvas').boundingBox())!;
  const abs = (p: { x: number; y: number }) => ({ x: box.x + p.x, y: box.y + p.y });
  return {
    start: abs(px.s),
    end: abs(px.e),
    mid: abs({ x: (px.s.x + px.e.x) / 2, y: (px.s.y + px.e.y) / 2 }),
    name: target!.name,
  };
}

/**
 * Клик по карте, после которого может открыться меню «Выберите объект»: участки и узлы
 * фрагментов лежат друг на друге (копии сети в 1/74/89/99), и без контекстного фрагмента
 * выбор неоднозначен (QA F53, F28). Если меню открылось — выбрать объект нужного фрагмента
 * (подзаголовок «Фрагмент N · участок/узел id»). `done` — признак, что клик уже обработан
 * без меню (карточка открылась, точка маршрута добавилась).
 */
export async function clickAndChooseFragment(
  page: Page,
  point: { x: number; y: number },
  done: Locator,
  fragmentId = FRAGMENT_ID,
) {
  await page.mouse.click(point.x, point.y);
  const menu = page.locator('.feature-menu');
  await expect(done.or(menu).first()).toBeVisible();
  if (await menu.isVisible()) {
    await menu
      .locator('.menu-item')
      .filter({ hasText: new RegExp(`Фрагмент ${fragmentId}\\b`) })
      .first()
      .click();
    await expect(menu).toBeHidden();
  }
}

/** Открыть инструмент из панели «Инструменты» шапки */
export async function openTool(page: Page, label: string) {
  const panelItem = page.getByRole('listitem', { name: label }).or(page.locator(`[aria-label="${label}"]`)).first();
  if (!(await panelItem.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Инструменты', exact: true }).click();
  }
  await page.locator(`.tools-panel__item[aria-label="${label}"]`).click();
}
