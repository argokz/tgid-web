import { defineConfig } from '@playwright/test';
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
    launchOptions: executablePath ? { executablePath } : undefined,
    channel: executablePath ? undefined : 'chrome',
  },
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
