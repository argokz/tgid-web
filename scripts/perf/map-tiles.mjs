/**
 * Снимки карты по зумам и статистика тайлов по источникам (этап 11, docs/map-visual-audit.md).
 * Временный инструмент: не входит в прод-код и в `npm run check`.
 *
 *   node scripts/perf/map-tiles.mjs [--base http://localhost:3040/] [--center 76.93,43.24 (по умолчанию — центр города)]
 *        [--zooms 11,13,15,17] [--shots docs/map-audit/almaty-before] [--out file.json]
 *
 * Для каждого зума: jumpTo, ожидание тишины в сети, снимок 1440×900 и по каждому источнику —
 * число запросов, байты тела, медиана/максимум времени ответа (с учётом очереди браузера),
 * попадания в кеш GWC (заголовок geowebcache-cache-result) и Cache-Control.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const BASE = args.base || 'http://localhost:3040/';
/** Без --center — стартовый центр карты города */
let CENTER = args.center ? String(args.center).split(',').map(Number) : null;
const ZOOMS = String(args.zooms || '11,13,15,17').split(',').map(Number);
const SHOTS = args.shots ? String(args.shots) : '';
const OUT = args.out ? String(args.out) : '';

/** Ключ источника: слой GWC/WMS GeoServer или набор тайлов MapTiler */
function sourceKey(url) {
  const u = decodeURIComponent(url);
  const gwc = u.match(/\/geoserver\/([^/]+)\/gwc\/.*[?&]LAYER=([^&]+)/i);
  if (gwc) return `gwc ${gwc[1]}:${gwc[2]}`;
  const wms = u.match(/\/geoserver\/([^/]+)\/wms.*[?&]LAYERS=([^&]+)/i);
  if (wms) return `wms ${wms[2]}`;
  const mt = u.match(/api\.maptiler\.com\/(tiles|fonts|maps)\/([^/]+)/);
  if (mt) return `maptiler ${mt[1]}/${mt[2]}`;
  return null;
}

const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0);

const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  for (const p of ['', 'astana:', 'almaty:', 'shatura:']) localStorage.setItem(`${p}firstRunHints`, '2');
});
const page = await ctx.newPage();
let requests = [];
page.on('requestfinished', async (req) => {
  const key = sourceKey(req.url());
  if (!key) return;
  const [timing, sizes, resp] = await Promise.all([req.timing(), req.sizes().catch(() => null), req.response()]);
  const h = resp ? await resp.allHeaders() : {};
  requests.push({
    key,
    ms: Math.round(timing.responseEnd),
    bytes: Math.max(0, sizes?.responseBodySize ?? 0),
    gwc: h['geowebcache-cache-result'] || '',
    cacheControl: h['cache-control'] || '',
    encoding: h['content-encoding'] || '',
  });
});

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
await page.waitForSelector('.maplibregl-canvas', { timeout: 90000 });
await page.waitForTimeout(6000);
// Панель слоёв закрываем: снимок — вся карта
await page.evaluate(() => document.querySelector('[aria-label="Закрыть панель"]')?.click());
CENTER ||= await page.evaluate(() => {
  const c = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s.get('map').map.getCenter();
  return [Number(c.lng.toFixed(5)), Number(c.lat.toFixed(5))];
});

const result = { base: BASE, center: CENTER, at: new Date().toISOString(), zooms: {} };
for (const z of ZOOMS) {
  requests = [];
  // Время до idle карты (все тайлы видимой области загружены и отрисованы) — от jumpTo в странице
  await page.evaluate(([zoom, lng, lat]) => {
    const map = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s.get('map').map;
    window.__mapIdleMs = null;
    const t0 = performance.now();
    map.jumpTo({ center: [lng, lat], zoom });
    map.once('idle', () => { window.__mapIdleMs = Math.round(performance.now() - t0); });
  }, [z, CENTER[0], CENTER[1]]);
  const idleMs = await page.waitForFunction(() => window.__mapIdleMs, null, { timeout: 120000 })
    .then((h) => h.jsonValue())
    .catch(() => -1);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  if (SHOTS) {
    mkdirSync(dirname(`${SHOTS}-z${z}.jpg`), { recursive: true });
    await page.screenshot({ path: `${SHOTS}-z${z}.jpg`, type: 'jpeg', quality: 80 });
  }
  const bySource = {};
  for (const r of requests) (bySource[r.key] ||= []).push(r);
  result.zooms[z] = {
    idleMs,
    requests: requests.length,
    kib: Math.round(requests.reduce((s, r) => s + r.bytes, 0) / 1024),
    sources: Object.fromEntries(Object.entries(bySource).map(([k, list]) => [k, {
      n: list.length,
      kib: Math.round(list.reduce((s, r) => s + r.bytes, 0) / 1024),
      p50: median(list.map((r) => r.ms)),
      max: Math.max(...list.map((r) => r.ms)),
      gwcHit: list.filter((r) => r.gwc === 'HIT').length,
      cacheControl: list[0].cacheControl,
      encoding: list[0].encoding,
    }])),
  };
  console.log(`z${z}: ${requests.length} запросов, ${result.zooms[z].kib} КиБ, до idle ${idleMs} мс`);
  for (const [k, s] of Object.entries(result.zooms[z].sources)) {
    console.log(`  ${k.padEnd(44)} ${String(s.n).padStart(3)} × ${String(s.kib).padStart(5)} КиБ  p50 ${s.p50} мс  max ${s.max} мс`);
  }
}
await browser.close();
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 1)}\n`);
}
