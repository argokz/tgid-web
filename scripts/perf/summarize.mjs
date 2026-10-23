/**
 * Сводка results-*.json из measure.mjs в markdown-таблицу: по каждому сценарию — лучший из прогонов
 * (минимальное время стены), плюс разброс между прогонами.
 *   node scripts/perf/summarize.mjs scripts/perf/results-2026-10-23.json
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const data = JSON.parse(readFileSync(file, 'utf8'));
const byName = new Map();
for (const r of data.results) {
  if (!byName.has(r.name)) byName.set(r.name, []);
  byName.get(r.name).push(r);
}
const nz = (c = {}) => Object.entries(c).filter(([, v]) => v).map(([k, v]) => `${k.replace('map.', '')} ${v}`).join(', ');
console.log(`Стенд: ${data.base}, CPU ×${data.cpu}, прогонов ${data.runs}, ${data.date.slice(0, 16)}\n`);
console.log('| Сценарий | Время, мс (прогоны) | FPS | Кадр p95 / max, мс | Long tasks: число / мс | Style / Layout, мс | Вызовы MapLibre | Прочее |');
console.log('|---|---|---|---|---|---|---|---|');
for (const [name, rs] of byName) {
  const ok = rs.filter((r) => !r.error);
  if (!ok.length) { console.log(`| ${name} | ОШИБКА: ${rs[0].error} | | | | | | |`); continue; }
  const best = ok.reduce((a, b) => (b.wallMs < a.wallMs ? b : a));
  const walls = ok.map((r) => r.wallMs).join(' / ');
  const extra = [];
  if (best.items != null) extra.push(`${best.items} пунктов`);
  if (best.chunksKb != null) extra.push(`чанков ${best.chunks.length} на ${best.chunksKb} KiB`);
  if (best.rows != null) extra.push(`строк ${best.rows}, DOM ${best.domNodes}`);
  if (best.nodesOnScreen != null) extra.push(`узлов в кадре ${best.nodesOnScreen}`);
  if (best.cdp?.nodes) extra.push(`DOM всего ${best.cdp.nodes}, heap ${best.cdp.heapMb} MB`);
  if (best.fps == null) { console.log(`| ${name} | ${walls} | | | | | | ${extra.join('; ')} |`); continue; }
  console.log(`| ${name} | ${walls} | ${best.fps} | ${best.frameP95} / ${best.frameMax} | ${best.longTasks} / ${best.longTaskMs} | ${best.cdp.recalcStyleMs} / ${best.cdp.layoutMs} | ${nz(best.counters)} | ${extra.join('; ')} |`);
}
console.log('\nСтеки triggerRepaint (топ по сценариям с перерисовками):');
for (const [name, rs] of byName) {
  const best = rs.find((r) => r.repaintStacks?.length);
  if (!best) continue;
  console.log(`- ${name}:`);
  for (const [st, n] of best.repaintStacks.slice(0, 3)) console.log(`  - ${n}× ${st}`);
}
if (data.consoleErrors?.length) console.log('\nОшибки консоли:', data.consoleErrors);
