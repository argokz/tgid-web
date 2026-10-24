/**
 * Снимок карты в фиксированном виде — для сравнения отрисовки до/после правок стиля.
 *   node scripts/perf/snapshot.mjs --out=a.png [--base=http://127.0.0.1:3040/itwin-map/] [--center=76.893,43.233] [--zoom=16] [--fragment=74]
 */
import { chromium } from '@playwright/test';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const BASE = args.base || 'http://127.0.0.1:3040/itwin-map/';
const [lng, lat] = String(args.center || '76.8932,43.2332').split(',').map(Number);
const ZOOM = Number(args.zoom || 16);
const FRAGMENT = Number(args.fragment || 74);
const OUT = args.out || 'scripts/perf/snapshot.png';
const PINIA = "document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s";

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage();
await page.goto(BASE, { waitUntil: 'load' });
await page.locator('canvas.maplibregl-canvas').waitFor({ timeout: 90000 });
await page.waitForTimeout(8000);
await page.evaluate(([P, fr, c, z]) => {
  const s = (0, eval)(P);
  const f = s.get('fragment');
  if (!f.visibleFragments.includes(fr) && f.fragments.some((x) => x.id === fr)) f.applyVisibleFragmentsSelection([fr], false);
  s.get('map').map.jumpTo({ center: c, zoom: z, pitch: 0, bearing: 0 });
}, [PINIA, FRAGMENT, [lng, lat], ZOOM]);
await page.evaluate((P) => new Promise((r) => { const map = (0, eval)(P).get('map').map; map.once('idle', r); setTimeout(r, 30000); }), PINIA);
await page.waitForTimeout(1500);
const layers = await page.evaluate((P) => (0, eval)(P).get('map').map.getStyle().layers.filter((l) => l.id.includes('heatpipesections')).length, PINIA);
await page.locator('[aria-label="Закрыть панель"]').click().catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: OUT, clip: { x: 340, y: 56, width: 1000, height: 800 } });
console.log(`снимок: ${OUT}; слоёв участков в стиле: ${layers}`);
await browser.close();
