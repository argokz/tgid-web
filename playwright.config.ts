import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * e2e-smoke по живому стенду: dev-сервер Nuxt :3040 + API :8040 на КОПИИ БД
 * (almatygid_copy). В CI не запускается — нужна БД. См. docs/e2e-smoke.md.
 *
 * Браузер не скачивается: берётся уже установленный Chromium Playwright
 * (%LOCALAPPDATA%\ms-playwright\chromium-<rev>) либо PW_CHROMIUM_PATH,
 * иначе системный Chrome (channel: 'chrome').
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3040/itwin-map/';
const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:8040';

function chromiumExecutable(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  const root = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : '';
  // ревизия под @playwright/test 1.63.0 (закреплён точной версией в package.json)
  const candidate = root && join(root, 'chromium-1243', 'chrome-win64', 'chrome.exe');
  return candidate && existsSync(candidate) ? candidate : undefined;
}

const executablePath = chromiumExecutable();
/** Chromium — установленный Chromium Playwright или системный Chrome (см. шапку файла) */
const chromium = {
  launchOptions: executablePath ? { executablePath } : undefined,
  channel: executablePath ? undefined : 'chrome',
};
/** Сценарии для телефонов и планшетов: настольные наборы рассчитаны на шапку и панели 1600×900 */
const DEVICE_SPEC = /devices\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1600, height: 900 },
    headless: process.env.E2E_HEADED ? false : true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // Матрица этапа 9 (docs/ui-modernization-prompt.md, раздел 14). npm run e2e — только chromium, как раньше;
  // npm run e2e:all — все проекты (Firefox и WebKit — браузеры Playwright: npx playwright install firefox webkit)
  projects: [
    { name: 'chromium', use: { ...chromium }, testIgnore: DEVICE_SPEC },
    // Сборка Firefox от Playwright на Windows этой машины не стартует (SxS: mozglue), поэтому по умолчанию —
    // установленный Firefox через WebDriver BiDi; PW_FIREFOX_CHANNEL= (пусто) — вернуть сборку Playwright
    {
      name: 'firefox',
      use: { browserName: 'firefox', channel: process.env.PW_FIREFOX_CHANNEL ?? 'moz-firefox' },
      testIgnore: DEVICE_SPEC,
    },
    { name: 'webkit', use: { browserName: 'webkit' }, testIgnore: DEVICE_SPEC },
    { name: 'iphone', use: { ...devices['iPhone 15'] }, testMatch: DEVICE_SPEC },
    { name: 'ipad', use: { ...devices['iPad Pro 11'] }, testMatch: DEVICE_SPEC },
    { name: 'pixel', use: { ...devices['Pixel 7'], ...chromium }, testMatch: DEVICE_SPEC },
  ],
  metadata: { apiUrl: API_URL },
  webServer: {
    // Поднимает dev-сервер, если :3040 ещё не слушает (иначе переиспользует)
    command: 'npx nuxt dev --port 3040',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 240_000,
    env: {
      // Права на правку web берёт из API (/auth/config), публичных флагов нет
      NUXT_PUBLIC_MAP_API_BASE_URL: API_URL,
    },
  },
});
