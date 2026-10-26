import { test, expect, type Page } from '@playwright/test';
import { openMap, openTool } from './helpers';

/**
 * Права (этап 9, раздел 14 плана): интерфейс под viewer, editor и с выключенной записью на сервере. Стенд работает
 * без входа (auth_disabled, роль admin) — роль и флаги подставляются в ответы /auth/config и /auth/me в браузере;
 * сервер при этом ничего не разрешает сверх своего (права проверяет API). Только чтение.
 */
type AuthPatch = Record<string, unknown>;

/** Неподписанный JWT с exp через час: клиент проверяет только срок, подпись проверяет сервер */
function fakeToken(role: string) {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({ sub: `e2e-${role}`, role, exp: Math.floor(Date.now() / 1000) + 3600 })}.e2e`;
}

/**
 * Подменить роль и флаги. При auth_disabled стенд всегда даёт admin (utils/permissions effectiveRole), поэтому
 * для роли auth_disabled снимается и подкладывается сессия с ролью; до API заголовок Authorization не доходит —
 * стенд отвечает как без входа, данные настоящие.
 */
async function withAuth(page: Page, patch: AuthPatch) {
  const role = typeof patch.role === 'string' ? patch.role : null;
  if (role) {
    const token = fakeToken(role);
    await page.addInitScript(([t, r]) => {
      localStorage.setItem('itwin_access_token', t);
      localStorage.setItem('itwin_user_role', r);
      localStorage.setItem('itwin_username', `e2e-${r}`);
    }, [token, role]);
    patch = { auth_disabled: false, username: `e2e-${role}`, sub: `e2e-${role}`, ...patch };
  }
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const headers = { ...route.request().headers() };
    delete headers.authorization;
    if (!/\/api\/v1\/auth\/(config|me)$/.test(new URL(url).pathname)) return route.continue({ headers });
    const response = await route.fetch({ headers });
    await route.fulfill({ response, json: { ...(await response.json()), ...patch } });
  });
}

function journal(page: Page, title: string) {
  return page.locator('.v-overlay--active .v-card').filter({ has: page.getByText(title, { exact: true }) }).first();
}

async function openDefects(page: Page) {
  await openTool(page, 'Нарушения');
  const dialog = journal(page, 'Журнал нарушений');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.state-view--loading')).toHaveCount(0, { timeout: 60_000 });
  return dialog;
}

async function toolsVisible(page: Page, labels: string[]) {
  await page.getByRole('button', { name: 'Инструменты', exact: true }).click();
  await expect(page.locator('.tools-panel__item').first()).toBeVisible();
  const result: Record<string, boolean> = {};
  for (const label of labels) result[label] = await page.locator(`.tools-panel__item[aria-label="${label}"]`).count() > 0;
  // панель остаётся открытой: закрытая уезжает за край, но остаётся в DOM, и openTool счёл бы её видимой
  return result;
}

const ADMIN_TOOLS = ['Групповые установщики', 'Справочники', 'Пользователи', 'Журнал действий'];

test.describe('Права в интерфейсе', () => {
  test('viewer: журналы только для чтения, правки и администрирования нет', async ({ page }) => {
    await withAuth(page, { role: 'viewer', caps: [], permissions: null });
    await openMap(page);
    expect(await toolsVisible(page, ADMIN_TOOLS)).toEqual({
      'Групповые установщики': false, 'Справочники': false, 'Пользователи': false, 'Журнал действий': false,
    });
    const dialog = await openDefects(page);
    await expect(dialog.getByRole('button', { name: 'Создать' })).toHaveCount(0);
  });

  test('editor: запись в журналы есть, администрирования нет', async ({ page }) => {
    await withAuth(page, { role: 'editor', caps: [], permissions: null });
    await openMap(page);
    const tools = await toolsVisible(page, ADMIN_TOOLS);
    expect(tools['Пользователи']).toBe(false);
    expect(tools['Журнал действий']).toBe(false);
    expect(tools['Групповые установщики']).toBe(true);
    const dialog = await openDefects(page);
    await expect(dialog.getByRole('button', { name: 'Создать' })).toBeVisible();
  });

  test('MUTATIONS_ENABLED=false: даже admin не видит записи', async ({ page }) => {
    await withAuth(page, { mutations_enabled: false, topology_mutations_enabled: false });
    await openMap(page);
    const dialog = await openDefects(page);
    await expect(dialog.getByRole('button', { name: 'Создать' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await openTool(page, 'Шурфовки');
    const shurfs = journal(page, 'Журнал шурфовок');
    await expect(shurfs.locator('.state-view--loading')).toHaveCount(0, { timeout: 60_000 });
    await expect(shurfs.getByRole('button', { name: 'Создать' })).toHaveCount(0);
    await expect(shurfs.getByRole('button', { name: 'Утвердить план' })).toHaveCount(0);
  });
});
