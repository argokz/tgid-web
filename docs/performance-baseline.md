# Performance Baseline

This project tracks front-end performance as part of quality gates.

## Current baseline

- `FCP`: 1.0s
- `LCP`: 2.7s
- `TBT`: 10ms
- `CLS`: 0.006
- `SpeedIndex`: 2.6s

## Bundle snapshot (2026-07-23, после ленивой загрузки диалогов)

- Критический JS (entry + статический граф страницы карты): **~458 KiB**
- Крупнейший критический чанк: ~248 KiB (vuetify)
- Отложенный JS (Cesium ~4.7 MB, ECharts ~545 KiB, maplibre ~784 KiB, журнальные диалоги по 15–30 KiB) — грузится при первом использовании

## Runtime metrics in dev

In development mode, lightweight telemetry is logged via `utils/perf.ts`:

- `page:index:asyncData`
- `map:layers:init`
- `map:initializeMap`
- `map:setupMapLayers`
- `map:init:total`

These metrics help identify render delay and map initialization bottlenecks.

## CI budgets

`npm run perf:budget` разбирает `client.manifest` сборки и проверяет раздельно:

- **Критический путь** (entry + статические импорты страницы карты):
  - `PERF_BUDGET_TOTAL_JS_KB` (default: `1500`)
  - `PERF_BUDGET_LARGEST_JS_KB` (default: `900`)
- **Отложенные lazy-чанки** (Cesium, ECharts, журналы):
  - `PERF_BUDGET_DEFERRED_JS_KB` (default: `7500`)

Если manifest недоступен, скрипт откатывается к суммарной проверке всего `_nuxt/*.js`.
Adjust thresholds in CI environment variables as optimization work progresses.
