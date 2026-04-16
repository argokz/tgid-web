# Performance Baseline

This project tracks front-end performance as part of quality gates.

## Current baseline

- `FCP`: 1.0s
- `LCP`: 2.7s
- `TBT`: 10ms
- `CLS`: 0.006
- `SpeedIndex`: 2.6s

## Runtime metrics in dev

In development mode, lightweight telemetry is logged via `utils/perf.ts`:

- `page:index:asyncData`
- `map:layers:init`
- `map:initializeMap`
- `map:setupMapLayers`
- `map:init:total`

These metrics help identify render delay and map initialization bottlenecks.

## CI budgets

`npm run perf:budget` checks built `_nuxt` JavaScript output against:

- `PERF_BUDGET_TOTAL_JS_KB` (default: `1500`)
- `PERF_BUDGET_LARGEST_JS_KB` (default: `350`)

Adjust thresholds in CI environment variables as optimization work progresses.
