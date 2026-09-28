# e2e-smoke (Playwright)

Сквозные проверки ключевых сценариев по живому стенду. **В CI не запускаются**:
нужен API с базой (копия `almatygid_copy`) и GeoServer с тайлами сети.
Тесты только читают данные (ничего не пишут в БД).

## Сценарии (`e2e/smoke.spec.ts`)

| Тест | Что проверяет |
|---|---|
| карта грузится | карта и участки отрисованы, слой узлов `mvt__AlmatyGIS__uzel` добавлен, нет предупреждений гидратации SSR |
| карточка участка | клик по участку фрагмента 74 → «Выберите объект» (если объектов несколько) → карточка `.ap-card` |
| «Анализ режима» | выбор фрагмента 74, «Выполнить» → `GET /api/analysis/regime/…` 200, таблица или «Записей нет» |
| пьезометр по двум узлам | режим трассировки, клик по двум концам участка (узлы), «Построить график» → `POST /piezometer/route` 200, таблица узлов |
| «Отчёты Excel» | `GET /api/reports/catalog` 200, список отчётов в диалоге |

## Запуск

1. API на копии БД: `http://127.0.0.1:8040` (uvicorn из `itwin-api/itwin-api` с `.env` + `.env.copy`).
2. Dev-сервер web на `:3040` с API `:8040`. Если он не запущен, `playwright.config.ts`
   поднимет его сам (`npx nuxt dev --port 3040` с `NUXT_PUBLIC_MAP_API_BASE_URL`);
   запущенный переиспользуется. То же вручную (PowerShell):

   ```powershell
   $env:NUXT_PUBLIC_MAP_API_BASE_URL='http://127.0.0.1:8040'; npx nuxt dev --port 3040
   ```

3. Из `web-itwin`:

   ```bash
   npm run e2e                      # все сценарии, headless
   npx playwright test -g "пьезо"   # один сценарий
   E2E_HEADED=1 npm run e2e         # с окном браузера
   ```

Первый запуск dev-сервера компилирует страницу до минуты — это укладывается в таймауты.

## Браузер

Браузеры Playwright **не скачиваются** (`npx playwright install` не нужен). Порядок выбора:

1. `PW_CHROMIUM_PATH` — явный путь к `chrome.exe`;
2. `%LOCALAPPDATA%\ms-playwright\chromium-1243\chrome-win64\chrome.exe` — ревизия под
   `@playwright/test` 1.63.0 (версия закреплена точно; при обновлении пакета сверить ревизию
   в `node_modules/playwright-core/browsers.json`);
3. иначе системный Google Chrome (`channel: 'chrome'`).

## Переменные

| Переменная | По умолчанию |
|---|---|
| `E2E_BASE_URL` | `http://127.0.0.1:3040/itwin-map/` |
| `E2E_API_URL` | `http://127.0.0.1:8040` (для автозапуска dev-сервера) |
| `E2E_FRAGMENT_ID` | `74` |
| `PW_CHROMIUM_PATH` | — |

Отчёты о падениях (скриншот, trace) — в `test-results/` (в `.gitignore`);
открыть trace: `npx playwright show-trace test-results/<тест>/trace.zip`.

## Как устроено

Карта (maplibre) доступна тестам через Pinia (`mapStore.map`) — `e2e/helpers.ts`:
поиск участка фрагмента среди отрисованных объектов, `jumpTo` на z17 и перевод
координат концов участка в пиксели для кликов. От данных зависят только номер
фрагмента и наличие у него участков и расчёта.
