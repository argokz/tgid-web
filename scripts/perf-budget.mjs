/* eslint-env node */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const budgetTotalJsKb = Number(process.env.PERF_BUDGET_TOTAL_JS_KB || 1500);
const budgetLargestJsKb = Number(process.env.PERF_BUDGET_LARGEST_JS_KB || 350);

const nuxtDir = join(process.cwd(), '.output', 'public', '_nuxt');

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
const sizes = files.map((file) => ({ file, size: statSync(file).size }));
const totalKb = sizes.reduce((sum, file) => sum + file.size, 0) / 1024;
const largest = sizes.sort((a, b) => b.size - a.size)[0];
const largestKb = largest ? largest.size / 1024 : 0;

console.log(`[perf-budget] JS files: ${files.length}`);
console.log(`[perf-budget] Total JS size: ${totalKb.toFixed(2)} KiB (budget ${budgetTotalJsKb} KiB)`);
if (largest) {
  console.log(`[perf-budget] Largest JS: ${largest.file} -> ${largestKb.toFixed(2)} KiB (budget ${budgetLargestJsKb} KiB)`);
}

if (totalKb > budgetTotalJsKb || largestKb > budgetLargestJsKb) {
  console.error('[perf-budget] Budget exceeded');
  process.exit(1);
}

console.log('[perf-budget] Budget check passed');
