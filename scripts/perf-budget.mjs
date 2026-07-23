/* eslint-env node */
/**
 * Performance budget по клиентскому JS.
 *
 * Считаем раздельно:
 *  - критический путь (entry + статический import-граф страницы карты) —
 *    это то, что браузер обязан скачать до интерактивности;
 *  - отложенные чанки (Cesium, ECharts, журнальные диалоги и пр.) —
 *    загружаются лениво при первом использовании и бюджетируются мягче.
 *
 * Раньше скрипт суммировал весь _nuxt/*.js, из-за чего ленивый Cesium (~4.7 MB)
 * делал бюджет бессмысленным. Если client.manifest недоступен, скрипт
 * откатывается к старому «всё подряд» поведению.
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const budgetCriticalTotalKb = Number(process.env.PERF_BUDGET_TOTAL_JS_KB || 1500);
const budgetCriticalLargestKb = Number(process.env.PERF_BUDGET_LARGEST_JS_KB || 900);
// Cesium один даёт ~4.7 MB — бюджет ловит только неконтролируемый рост lazy-чанков
const budgetDeferredTotalKb = Number(process.env.PERF_BUDGET_DEFERRED_JS_KB || 7500);

const nuxtDir = join(process.cwd(), '.output', 'public', '_nuxt');
const manifestPath = join(process.cwd(), '.output', 'server', 'chunks', 'build', 'client.manifest.mjs');

const collectJsFiles = (dir) => {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectJsFiles(fullPath));
      continue;
    }
    if (entry.name.endsWith('.js')) {
      result.push(fullPath);
    }
  }
  return result;
};

const files = collectJsFiles(nuxtDir);
const sizeByBase = new Map(files.map((file) => [basename(file), { file, size: statSync(file).size }]));
const kb = (bytes) => bytes / 1024;

/** Возвращает Set базовых имён .js-файлов критического пути или null, если manifest не прочитался. */
const resolveCriticalFiles = async () => {
  if (!existsSync(manifestPath)) return null;
  try {
    const mod = await import(pathToFileURL(manifestPath).href);
    const manifest = mod.default || mod.client_manifest || null;
    if (!manifest || typeof manifest !== 'object') return null;

    const roots = Object.entries(manifest)
      .filter(([key, value]) => value?.isEntry || key === 'pages/index.vue' || key === 'app.vue')
      .map(([key]) => key);
    if (!roots.length) return null;

    const visited = new Set();
    const criticalFiles = new Set();
    const walk = (key) => {
      if (visited.has(key)) return;
      visited.add(key);
      const entry = manifest[key];
      if (!entry) return;
      if (entry.file?.endsWith('.js')) criticalFiles.add(basename(entry.file));
      for (const dep of entry.imports || []) walk(dep); // только статические импорты
    };
    roots.forEach(walk);
    return criticalFiles;
  } catch (error) {
    console.warn(`[perf-budget] Не удалось разобрать client.manifest: ${error.message}`);
    return null;
  }
};

const criticalNames = await resolveCriticalFiles();
const all = [...sizeByBase.values()];
const totalAllKb = kb(all.reduce((sum, f) => sum + f.size, 0));

let failed = false;
const check = (label, valueKb, budgetKb) => {
  const over = valueKb > budgetKb;
  if (over) failed = true;
  console.log(`[perf-budget] ${label}: ${valueKb.toFixed(2)} KiB (budget ${budgetKb} KiB)${over ? ' — ПРЕВЫШЕН' : ''}`);
};

console.log(`[perf-budget] JS files: ${all.length}; всего: ${totalAllKb.toFixed(2)} KiB`);

if (criticalNames) {
  const critical = all.filter((f) => criticalNames.has(basename(f.file)));
  const deferred = all.filter((f) => !criticalNames.has(basename(f.file)));
  const criticalTotalKb = kb(critical.reduce((sum, f) => sum + f.size, 0));
  const deferredTotalKb = kb(deferred.reduce((sum, f) => sum + f.size, 0));
  const largestCritical = critical.sort((a, b) => b.size - a.size)[0];

  check('Критический JS (entry + карта)', criticalTotalKb, budgetCriticalTotalKb);
  if (largestCritical) {
    console.log(`[perf-budget] Крупнейший критический чанк: ${basename(largestCritical.file)} -> ${kb(largestCritical.size).toFixed(2)} KiB`);
    check('Крупнейший критический чанк', kb(largestCritical.size), budgetCriticalLargestKb);
  }
  check('Отложенный JS (lazy-чанки)', deferredTotalKb, budgetDeferredTotalKb);
} else {
  console.warn('[perf-budget] client.manifest недоступен — проверяю суммарный JS (legacy-режим)');
  const largest = all.sort((a, b) => b.size - a.size)[0];
  check('Total JS', totalAllKb, budgetCriticalTotalKb + budgetDeferredTotalKb);
  if (largest) check('Largest JS', kb(largest.size), Math.max(budgetCriticalLargestKb, 5000));
}

if (failed) {
  console.error('[perf-budget] Budget exceeded');
  process.exit(1);
}

console.log('[perf-budget] Budget check passed');
