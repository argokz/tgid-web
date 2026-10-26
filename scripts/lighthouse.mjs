#!/usr/bin/env node
/**
 * Lighthouse приёмки (этап 9): desktop и mobile, несколько прогонов, медиана по каждой категории против порогов
 * lighthouse.config.json. Мерить production-сборку (`nuxt build` в отдельном каталоге + превью), не dev.
 *
 *   npm run lighthouse -- [--url=http://127.0.0.1:3045/itwin-map/] [--runs=3] [--form=desktop] [--no-fail]
 *
 * Браузер — системный Chrome/Edge (CHROME_PATH, иначе chrome-launcher ищет сам). Полные отчёты JSON —
 * в lighthouse-results/ (в .gitignore), сводка — в stdout. Код выхода 1 — медиана ниже порога.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'lighthouse-results');
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const METRICS = {
  FCP: 'first-contentful-paint',
  LCP: 'largest-contentful-paint',
  TBT: 'total-blocking-time',
  CLS: 'cumulative-layout-shift',
  SI: 'speed-index',
};

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const config = JSON.parse(readFileSync(join(ROOT, 'lighthouse.config.json'), 'utf8'));
const url = String(args.url || process.env.LIGHTHOUSE_URL || config.url);
const runs = Number(args.runs || config.runs);
const formFactors = args.form ? String(args.form).split(',') : config.formFactors;
if (!Number.isInteger(runs) || runs < 1) throw new Error(`--runs: ожидалось целое ≥ 1, получено ${args.runs}`);

const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Сводка одного прогона: баллы категорий 0–100 и метрики */
function summarize(lhr) {
  const scores = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]));
  const metrics = Object.fromEntries(Object.entries(METRICS).map(([k, id]) => [k, lhr.audits[id]?.numericValue ?? NaN]));
  const failed = CATEGORIES.filter((c) => c !== 'performance').flatMap((c) =>
    lhr.categories[c].auditRefs
      .filter((r) => r.weight > 0 && (lhr.audits[r.id]?.score ?? 1) < 1)
      .map((r) => `${c}: ${r.id}`),
  );
  return { scores, metrics, failed, runtimeError: lhr.runtimeError?.message };
}

mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-first-run'] });
const report = { url, runs, date: new Date().toISOString(), formFactors: {} };
let belowThreshold = false;
try {
  for (const form of formFactors) {
    const results = [];
    for (let i = 1; i <= runs; i += 1) {
      const result = await lighthouse(
        url,
        { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: CATEGORIES },
        form === 'desktop' ? desktopConfig : undefined,
      );
      if (!result) throw new Error(`Lighthouse не вернул результат (${form}, прогон ${i})`);
      writeFileSync(join(OUT_DIR, `${stamp}-${form}-${i}.json`), result.report);
      const s = summarize(result.lhr);
      if (s.runtimeError) throw new Error(`${form}, прогон ${i}: ${s.runtimeError}`);
      results.push(s);
      process.stdout.write(`${form} №${i}: ${CATEGORIES.map((c) => `${c} ${s.scores[c]}`).join(', ')}\n`);
    }
    const scores = Object.fromEntries(CATEGORIES.map((c) => [c, median(results.map((r) => r.scores[c]))]));
    const metrics = Object.fromEntries(Object.keys(METRICS).map((k) => [k, median(results.map((r) => r.metrics[k]))]));
    const failed = [...new Set(results.flatMap((r) => r.failed))];
    const misses = CATEGORIES.filter((c) => scores[c] < config.thresholds[c]);
    if (misses.length) belowThreshold = true;
    report.formFactors[form] = { scores, metrics, failedAudits: failed, belowThreshold: misses, runs: results };
    process.stdout.write(
      `${form} медиана: ${CATEGORIES.map((c) => `${c} ${scores[c]}${scores[c] < config.thresholds[c] ? ` (< ${config.thresholds[c]})` : ''}`).join(', ')}\n`
      + `  FCP ${Math.round(metrics.FCP)} мс, LCP ${Math.round(metrics.LCP)} мс, TBT ${Math.round(metrics.TBT)} мс, `
      + `CLS ${metrics.CLS.toFixed(3)}, SI ${Math.round(metrics.SI)} мс\n`
      + (failed.length ? `  не пройдено: ${failed.join(', ')}\n` : ''),
    );
  }
} finally {
  await chrome.kill();
}
writeFileSync(join(OUT_DIR, `${stamp}-summary.json`), JSON.stringify(report, null, 2));
if (belowThreshold && !args['no-fail']) process.exitCode = 1;
