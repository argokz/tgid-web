/**
 * Замеры S1–S9 по методике этапа 0 (docs/ui-modernization-prompt.md).
 * Временный инструмент: не входит в прод-код и в `npm run check`.
 *
 *   node scripts/perf/measure.mjs [--base http://127.0.0.1:3045/itwin-map/] [--cpu 4] [--only S1,S4] [--runs 2] [--out file.json]
 *
 * Стенд: API 8040 на копии БД (auth_disabled), production-сборка на отдельном порту.
 * Браузер — системный Chrome (channel: 'chrome'), окно 1440×900, CPU-троттлинг через CDP.
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const BASE = args.base || 'http://127.0.0.1:3040/itwin-map/';
const CPU = Number(args.cpu || 4);
const RUNS = Number(args.runs || 2);
const ONLY = args.only ? String(args.only).split(',') : null;
let FRAGMENT = Number(args.fragment || 74);
/** --context-off=terrain3d,buildings — выключить слои контекста перед сценариями (A/B рельефа и зданий) */
const CONTEXT_OFF = args['context-off'] ? String(args['context-off']).split(',') : [];
const OUT = args.out || `scripts/perf/results-${new Date().toISOString().slice(0, 10)}.json`;

const PINIA = "document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s";
const MAP = `${PINIA}.get('map').map`;

/* ---------- инструментирование страницы ---------- */
const INIT_SCRIPT = `
(() => {
  // подсказка первого запуска (этап 8) не должна попадать в замеры
  try { localStorage.setItem('firstRunHints', '1'); } catch {}
  const P = (window.__perf = { longTasks: [], frames: [], counters: {}, recording: false, rafId: 0, last: 0 });
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (P.recording) P.longTasks.push({ start: e.startTime, dur: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  P.start = () => {
    P.longTasks = []; P.frames = []; P.stacks = {}; P.recording = true; P.last = performance.now();
    for (const k of Object.keys(P.counters)) P.counters[k] = 0;
    const tick = (t) => { if (!P.recording) return; P.frames.push(t - P.last); P.last = t; P.rafId = requestAnimationFrame(tick); };
    P.rafId = requestAnimationFrame(tick);
  };
  P.stop = () => {
    P.recording = false; cancelAnimationFrame(P.rafId);
    const f = P.frames.slice(1); const dur = f.reduce((a, b) => a + b, 0);
    const sorted = [...f].sort((a, b) => a - b);
    const p = (q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
    return {
      ms: Math.round(dur), frames: f.length, fps: dur ? +(1000 * f.length / dur).toFixed(1) : 0,
      frameP50: +p(0.5).toFixed(1), frameP95: +p(0.95).toFixed(1), frameMax: +(sorted.at(-1) ?? 0).toFixed(1),
      longTasks: P.longTasks.length, longTaskMs: Math.round(P.longTasks.reduce((a, t) => a + t.dur, 0)),
      longTaskMax: Math.round(Math.max(0, ...P.longTasks.map((t) => t.dur))),
      counters: { ...P.counters },
      repaintStacks: Object.entries(P.stacks || {}).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  };
  P.wrap = (obj, name, label) => {
    if (!obj || typeof obj[name] !== 'function' || obj[name].__perfWrapped) return;
    const orig = obj[name];
    const w = function (...a) { P.counters[label] = (P.counters[label] || 0) + 1; return orig.apply(this, a); };
    w.__perfWrapped = true; obj[name] = w; P.counters[label] = 0;
  };
})();`;

const INSTRUMENT_MAP = `
(() => {
  const P = window.__perf; const map = ${MAP}; if (!map || map.__perfHooked) return false;
  map.__perfHooked = true;
  for (const m of ['setFilter','setLayoutProperty','setPaintProperty','addLayer','removeLayer','addSource','removeSource','easeTo','jumpTo','flyTo','setPadding','resize','triggerRepaint','setFeatureState','queryRenderedFeatures']) P.wrap(map, m, 'map.' + m);
  const src = Object.values(map.style.sourceCaches || {}).map((c) => c._source).find((s) => s && s.type === 'geojson');
  if (src) P.wrap(Object.getPrototypeOf(src), 'setData', 'geojson.setData');
  map.on('render', () => { P.counters['map.render'] = (P.counters['map.render'] || 0) + 1; });
  // Откуда зовут triggerRepaint: верхние кадры стека (минифицированные, но с файлом:строкой чанка)
  P.stacks = {};
  const origTR = map.triggerRepaint;
  map.triggerRepaint = function (...a) {
    if (P.recording) {
      const st = (new Error().stack || '').split(String.fromCharCode(10)).slice(2, 6).map((l) => l.trim().replace(/^at /, '').replace(/https?:[^ ]*_nuxt[/]/, '')).join(' < ');
      P.stacks[st] = (P.stacks[st] || 0) + 1;
    }
    return origTR.apply(this, a);
  };
  return true;
})()`;

/* ---------- утилиты ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

async function cdpMetrics(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const get = (n) => metrics.find((m) => m.name === n)?.value ?? 0;
  return {
    recalcStyle: get('RecalcStyleCount'), recalcStyleMs: get('RecalcStyleDuration') * 1000,
    layout: get('LayoutCount'), layoutMs: get('LayoutDuration') * 1000,
    scriptMs: get('ScriptDuration') * 1000, taskMs: get('TaskDuration') * 1000,
    nodes: get('Nodes'), heapMb: get('JSHeapUsedSize') / 1048576,
  };
}
const diff = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, +(b[k] - a[k]).toFixed(k.endsWith('Mb') ? 1 : 0)]));

async function measure(page, cdp, name, fn) {
  const before = await cdpMetrics(cdp);
  await page.evaluate('window.__perf.start()');
  const t0 = Date.now();
  let extra = {};
  try { extra = (await fn()) || {}; } catch (e) { extra = { error: String(e.message || e).slice(0, 200) }; }
  const wall = Date.now() - t0;
  const frames = await page.evaluate('window.__perf.stop()');
  const after = await cdpMetrics(cdp);
  const d = diff(before, after);
  const r = { name, wallMs: wall, ...frames, cdp: { ...d, nodes: after.nodes, heapMb: after.heapMb.toFixed(1) }, ...extra };
  log(`  ${name}${extra.items != null ? ` [${extra.items} пунктов]` : ''}: ${wall} ms, ${r.fps} fps (p95 ${r.frameP95} ms, max ${r.frameMax}), long tasks ${r.longTasks}/${r.longTaskMs} ms, style ${d.recalcStyle}/${d.recalcStyleMs} ms, layout ${d.layout}/${d.layoutMs} ms, script ${d.scriptMs} ms`, JSON.stringify(r.counters || {}), extra.error ? 'ERR ' + extra.error : '');
  return r;
}

const mapEval = (page, body, arg) => page.evaluate(([expr, b, a]) => new Function('map', 'arg', b)((0, eval)(expr), a), [MAP, body, arg]);
const piniaEval = (page, body, arg) => page.evaluate(([expr, b, a]) => new Function('s', 'arg', b)((0, eval)(expr), a), [PINIA, body, arg]);
const waitIdle = (page, ms = 15000) => mapEval(page, `return new Promise(r => { if (map.loaded() && !map.isMoving()) setTimeout(r, 200); else map.once('idle', () => r()); setTimeout(r, ${ms}); })`);

async function openMap(page) {
  const t0 = Date.now();
  await page.goto('./', { waitUntil: 'load' });
  await page.locator('canvas.maplibregl-canvas').waitFor({ timeout: 90000 });
  for (let i = 0; i < 180; i++) {
    const n = await mapEval(page, "return map ? map.queryRenderedFeatures().filter(f => f.layer.id.includes('heatpipesections')).length : 0").catch(() => 0);
    if (n > 0) break;
    await sleep(500);
  }
  await page.evaluate(INSTRUMENT_MAP);
  const loadMs = Date.now() - t0;
  if (CONTEXT_OFF.length) {
    await piniaEval(page, "for (const k of arg) s.get('layer').setContextLayerVisible(k, false); return true", CONTEXT_OFF);
    await waitIdle(page, 30000);
  }
  // Фрагмент сценариев: запрошенный, если он есть в базе, иначе видимый по умолчанию
  const st = await piniaEval(page, "const f = s.get('fragment'); return { visible: [...f.visibleFragments], ids: f.fragments.map(x => x.id) }");
  if (!st.visible.includes(FRAGMENT)) {
    if (st.ids.includes(FRAGMENT)) {
      await piniaEval(page, "s.get('fragment').applyVisibleFragmentsSelection(arg, true); return true", [FRAGMENT]);
      await waitIdle(page, 30000);
    } else {
      FRAGMENT = st.visible[0];
      log(`  фрагмента ${args.fragment || 74} нет в базе — сценарии на видимом по умолчанию ${FRAGMENT}`);
    }
  }
  return loadMs;
}


/** Пиксель рядом с проекцией точки, где хит-тест находит нужный слой (рельеф 3D сдвигает project()) */
const FIND_PIXEL = `
  const [lngLat, kind, fr] = [arg.lngLat, arg.kind, arg.fr];
  const p = map.project(lngLat);
  const test = (x, y) => map.queryRenderedFeatures([x, y]).some((f) =>
    kind === 'node' ? /uzel|node/i.test(f.layer.id) && (!fr || Number(f.properties.fileid) === fr || f.properties.fileid == null)
                    : f.layer.id.includes('heatpipesections') && Number(f.properties.fileid) === fr);
  if (test(p.x, p.y)) return { x: p.x, y: p.y, d: 0 };
  for (let r = 4; r <= 60; r += 4) for (let a = 0; a < 360; a += 30) {
    const x = p.x + r * Math.cos(a * Math.PI / 180), y = p.y + r * Math.sin(a * Math.PI / 180);
    if (test(x, y)) return { x, y, d: r };
  }
  return null;`;
const findPixel = (page, lngLat, kind) => mapEval(page, FIND_PIXEL, { lngLat, kind, fr: FRAGMENT });

async function focusPipe(page) {
  let target = null;
  for (let i = 0; i < 120 && !target; i++) {
    target = await mapEval(page, `const pipes = map.queryRenderedFeatures().filter(f => f.layer.id.includes('heatpipesections') && Number(f.properties.fileid) === arg && f.geometry.type === 'LineString');
      const len = (g) => Math.hypot(g[0][0] - g[g.length-1][0], g[0][1] - g[g.length-1][1]);
      pipes.sort((x, y) => Math.abs(len(x.geometry.coordinates) - 0.001) - Math.abs(len(y.geometry.coordinates) - 0.001));
      const f = pipes[0]; if (!f) return null; const c = f.geometry.coordinates; return { a: c[0], b: c[c.length-1] };`, FRAGMENT);
    if (!target) await sleep(500);
  }
  if (!target) throw new Error(`нет участков фрагмента ${FRAGMENT}`);
  await mapEval(page, 'map.jumpTo({ center: [(arg.a[0]+arg.b[0])/2, (arg.a[1]+arg.b[1])/2], zoom: 17 }); return true;', target);
  await waitIdle(page);
  const c = target;
  const mid = [(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2];
  let m = null, st = null, en = null;
  for (let i = 0; i < 5 && !m; i++) { m = await findPixel(page, mid, 'pipe'); if (!m) await sleep(1500); }
  if (!m) throw new Error('не нашёл участок с попаданием по пикселю');
  st = await findPixel(page, c.a, 'node');
  en = await findPixel(page, c.b, 'node');
  const box = await page.locator('canvas.maplibregl-canvas').boundingBox();
  const abs = (p) => ({ x: box.x + p.x, y: box.y + p.y });
  const proj = async (ll) => { const p = await mapEval(page, 'const q = map.project(arg); return { x: q.x, y: q.y };', ll); return p; };
  return { mid: abs(m), start: abs(st || await proj(c.a)), end: abs(en || await proj(c.b)), nodesHit: !!(st && en) };
}

async function clickChoose(page, pt, doneSel) {
  await page.mouse.click(pt.x, pt.y);
  const menu = page.locator('.feature-menu');
  const done = page.locator(doneSel);
  await done.or(menu).first().waitFor({ timeout: 30000 });
  if (await menu.isVisible()) {
    await menu.locator('.menu-item').filter({ hasText: new RegExp(`Фрагмент ${FRAGMENT}\\b`) }).first().click();
    await menu.waitFor({ state: 'hidden' });
  }
}

async function openTool(page, label) {
  const item = page.locator(`.tools-panel__item[aria-label="${label}"]`);
  const open = await piniaEval(page, "return s.get('ui').toolsPanelOpen").catch(() => false);
  if (!open) {
    await page.getByRole('button', { name: 'Инструменты', exact: true }).click();
    await sleep(400);
  }
  await item.waitFor({ state: 'visible', timeout: 15000 });
  await item.click();
}
async function closeOverlays(page) {
  for (let i = 0; i < 4; i++) {
    if (!(await page.locator('.v-overlay--active').first().isVisible().catch(() => false))) break;
    await page.keyboard.press('Escape');
    await sleep(300);
  }
  await piniaEval(page, "s.get('ui').closeAll(); return true").catch(() => {});
}

/** Сетевые чанки _nuxt за время действия */
function chunkRecorder(page) {
  const chunks = [];
  const handler = async (res) => {
    const u = res.url();
    if (!u.includes('/_nuxt/')) return;
    const len = Number(res.headers()['content-length']) || (await res.body().then((b) => b.length).catch(() => 0));
    chunks.push({ file: u.split('/_nuxt/')[1], kb: +(len / 1024).toFixed(1) });
  };
  page.on('response', handler);
  return () => { page.off('response', handler); return chunks; };
}

/* ---------- сценарии ---------- */
const scenarios = {
  async S1(page, cdp) {
    const pan = () => mapEval(page, `return new Promise((done) => {
        const c = map.getCenter(); const z = map.getZoom(); const t0 = performance.now(); let i = 0;
        const step = () => {
          if (performance.now() - t0 > 10000) { map.easeTo({ center: c, zoom: z, duration: 300 }); return done(true); }
          const dx = (i % 2 ? -1 : 1) * 0.004, dz = i % 4 === 3 ? -0.6 : i % 4 === 1 ? 0.6 : 0;
          map.easeTo({ center: [c.lng + dx * (i % 3), c.lat + dx], zoom: z + dz, duration: 900 });
          map.once('moveend', () => { i++; step(); });
        }; step(); })`);
    const a = await measure(page, cdp, 'S1a панорамирование 10 с (карта + панель слоёв, как при открытии)', pan);
    await page.locator('[aria-label="Закрыть панель"]').first().click().catch(() => {});
    await sleep(800);
    const sidebarOpen = await page.locator('text=Видимость и порядок').isVisible().catch(() => false);
    const b = await measure(page, cdp, `S1b панорамирование 10 с (${sidebarOpen ? 'панель слоёв не закрылась' : 'только карта'})`, pan);
    if (!sidebarOpen) { await page.locator('[aria-label="Открыть панель слоёв"]').click().catch(() => {}); await sleep(800); }
    await openTool(page, 'Запорная арматура');
    await page.locator('.v-overlay--active table tbody tr').first().waitFor({ timeout: 60000 });
    await sleep(500);
    const c = await measure(page, cdp, 'S1c панорамирование 10 с (панель слоёв + журнал арматуры)', pan);
    await closeOverlays(page);
    return [a, b, c];
  },

  async S2(page, cdp) {
    await openTool(page, 'Нарушения');
    // .v-dialog: последним активным оверлеем бывает подсказка кнопки
    const dlg = page.locator('.v-dialog.v-overlay--active').last();
    const field = dlg.getByRole('searchbox').first();
    await field.waitFor({ timeout: 60000 });
    await field.click();
    const r = await measure(page, cdp, 'S2 ввод 20 символов в поле журнала «Нарушения»', async () => {
      await page.keyboard.type('Тестовая запись 1234', { delay: 60 });
    });
    await closeOverlays(page);
    return r;
  },

  async S3(page, cdp) {
    const pipe = await focusPipe(page);
    const stopA = chunkRecorder(page);
    // с этапа 5 клик открывает сводку у точки, карточка — из неё («Карточка»)
    const a = await measure(page, cdp, 'S3a открыть карточку участка (клик → сводка → «Карточка»)', async () => {
      await clickChoose(page, pipe.mid, '.map-popover');
      await page.locator('.map-popover').getByRole('button', { name: 'Карточка' }).click();
      await page.locator('.inspector').waitFor();
      await sleep(300);
    });
    a.chunks = stopA();
    a.chunksKb = +a.chunks.reduce((s, c) => s + c.kb, 0).toFixed(1);
    await page.locator('.inspector [aria-label="Закрыть"]').first().click().catch(() => {});
    await sleep(500);
    const stopB = chunkRecorder(page);
    const b = await measure(page, cdp, 'S3b открыть журнал «Диафрагмы» (первый раз)', async () => {
      await openTool(page, 'Диафрагмы');
      await page.locator('.v-overlay--active .journal-table tbody tr, .v-overlay--active table tbody tr').first().waitFor({ timeout: 60000 });
      await sleep(300);
    });
    b.chunks = stopB();
    b.chunksKb = +b.chunks.reduce((s, c) => s + c.kb, 0).toFixed(1);
    await closeOverlays(page);
    return [a, b];
  },

  async S4(page, cdp) {
    if (!(await page.locator('.inspector').isVisible().catch(() => false))) {
      const pipe = await focusPipe(page);
      await clickChoose(page, pipe.mid, '.map-popover');
      await page.locator('.map-popover').getByRole('button', { name: 'Карточка' }).click();
    }
    const handle = page.locator('.oc-resize--left');
    await handle.waitFor({ timeout: 10000 });
    const hb = await handle.boundingBox();
    const a = await measure(page, cdp, 'S4a изменение ширины панели (60 шагов)', async () => {
      await page.mouse.move(hb.x + 2, hb.y + 200);
      await page.mouse.down();
      for (let i = 1; i <= 60; i++) { await page.mouse.move(hb.x + 2 - i * 4, hb.y + 200); }
      for (let i = 60; i >= 0; i--) { await page.mouse.move(hb.x + 2 - i * 4, hb.y + 200); }
      await page.mouse.up();
    });
    await page.locator('[aria-label="Открепить в отдельное окно"]').click();
    const header = page.locator('[data-card-drag]').first();
    await header.waitFor();
    const box = await header.boundingBox();
    const b = await measure(page, cdp, 'S4b перетаскивание окна карточки (120 шагов)', async () => {
      await page.mouse.move(box.x + 40, box.y + box.height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 60; i++) await page.mouse.move(box.x + 40 - i * 5, box.y + box.height / 2 + i * 2);
      for (let i = 60; i >= 0; i--) await page.mouse.move(box.x + 40 - i * 5, box.y + box.height / 2 + i * 2);
      await page.mouse.up();
    });
    await page.locator('[aria-label="Закрепить панелью справа"]').click().catch(() => {});
    await page.locator('.inspector [aria-label="Закрыть"]').first().click().catch(() => {});
    await sleep(300);
    return [a, b];
  },

  async S5(page, cdp) {
    const pipe = await focusPipe(page);
    log(`  S5: концы участка по хит-тесту узлов: ${pipe.nodesHit}`);
    await page.getByRole('button', { name: 'Пьезометрический график' }).click();
    const panel = page.locator('[aria-label="Построение маршрута пьезометра"]');
    await panel.waitFor();
    await clickChoose(page, pipe.start, '[aria-label="Построение маршрута пьезометра"] .v-chip');
    await clickChoose(page, pipe.end, '[aria-label="Построение маршрута пьезометра"] .v-chip >> nth=1');
    await panel.getByRole('button', { name: 'Построить график' }).click();
    // с этапа 6 график пьезометра — в ChartDock (не диалог)
    const canvas = page.locator('.chart-dock canvas').first();
    await canvas.waitFor({ timeout: 60000 });
    await sleep(1000);
    const box = await canvas.boundingBox();
    const r = await measure(page, cdp, 'S5 курсор по графику пьезометра (150 шагов)', async () => {
      for (let i = 0; i <= 150; i++) await page.mouse.move(box.x + 60 + (box.width - 120) * (i / 150), box.y + box.height / 2);
      await sleep(200);
    });
    await closeOverlays(page);
    await page.getByRole('button', { name: 'Пьезометрический график' }).click().catch(() => {});
    return r;
  },

  async S6(page, cdp) {
    await focusPipe(page);
    await piniaEval(page, "s.get('ui').toggleDrawPanel(true); return true");
    const tool = page.locator('[aria-label="Расстояние"]');
    if ((await tool.getAttribute('aria-pressed')) !== 'true') await tool.click();
    const box = await page.locator('canvas.maplibregl-canvas').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.click(cx - 150, cy - 80);
    const nodes = await mapEval(page, "return map.queryRenderedFeatures().filter(f => /uzel|node/i.test(f.layer.id)).length");
    const r = await measure(page, cdp, `S6 ведение линии с привязкой (200 шагов, узлов в кадре ${nodes})`, async () => {
      for (let i = 0; i <= 200; i++) await page.mouse.move(cx - 150 + i * 1.5, cy - 80 + Math.sin(i / 10) * 60);
      await sleep(200);
    });
    r.nodesOnScreen = nodes;
    await page.keyboard.press('Escape');
    await piniaEval(page, "s.get('ui').toggleDrawPanel(false); return true");
    return r;
  },

  async S7(page, cdp) {
    await openTool(page, 'Запорная арматура');
    const table = page.locator('.v-overlay--active table').first();
    await table.locator('tbody tr').first().waitFor({ timeout: 60000 });
    const rows = await table.locator('tbody tr').count();
    const domNodes = await page.locator('.v-dialog.v-overlay--active').last().evaluate((el) => el.querySelectorAll('*').length);
    const wrap = table.locator('xpath=..');
    const box = await wrap.boundingBox();
    const r = await measure(page, cdp, `S7 прокрутка журнала арматуры (страница ${rows} строк, DOM-узлов в окне ${domNodes})`, async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 300); await sleep(50); }
      for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, -300); await sleep(50); }
    });
    r.rows = rows; r.domNodes = domNodes;
    await closeOverlays(page);
    return r;
  },

  async S8(page, cdp) {
    const visible = await piniaEval(page, "return [...s.get('fragment').visibleFragments]");
    const all = await piniaEval(page, "return s.get('fragment').fragments.map(f => f.id ?? f.fragment_id ?? f.fileid).filter(Boolean)");
    const other = all.find((id) => !visible.includes(id)) ?? visible[0];
    const a = await measure(page, cdp, `S8a смена набора фрагментов (${visible.length} → +1 → назад)`, async () => {
      await piniaEval(page, "s.get('fragment').applyVisibleFragmentsSelection(arg, false); return true", [...visible, other]);
      await waitIdle(page);
      await piniaEval(page, "s.get('fragment').applyVisibleFragmentsSelection(arg, false); return true", visible);
      await waitIdle(page);
    });
    const layers = await piniaEval(page, "return [...s.get('layer').visibleGeoServerLayers]");
    const b = await measure(page, cdp, `S8b выключить и включить слой (${layers.length} видимых)`, async () => {
      await piniaEval(page, "return s.get('layer').applyVisibleLayersSelection(arg)", layers.slice(1));
      await waitIdle(page);
      await piniaEval(page, "return s.get('layer').applyVisibleLayersSelection(arg)", layers);
      await waitIdle(page);
    });
    return [a, b];
  },

  async S9(page, cdp) {
    await openTool(page, 'Опрессовки');
    const dlg = page.locator('.v-dialog.v-overlay--active').last();
    await dlg.locator('.v-select').first().waitFor({ timeout: 60000 });
    const selects = dlg.locator('.v-select .v-field, .v-autocomplete .v-field');
    const n = await selects.count();
    const results = [];
    for (let i = 0; i < n; i++) {
      const label = (await selects.nth(i).locator('label').first().textContent().catch(() => '')) || `#${i}`;
      const r = await measure(page, cdp, `S9 открыть список «${label.trim()}»`, async () => {
        await selects.nth(i).click();
        const list = page.locator('.v-overlay--active .v-list').last();
        await list.waitFor({ timeout: 5000 });
        await sleep(300);
        const items = await list.locator('.v-list-item').count();
        await page.keyboard.press('Escape');
        await sleep(200);
        return { items };
      });
      results.push(r);
    }
    await closeOverlays(page);
    return results;
  },
};

/* ---------- запуск ---------- */
// Headless Chrome 154 ограничивает кадры 30 fps даже на пустой странице (26.10.2026); флаги возвращают ~60,
// как при базовых замерах 23.10, иначе FPS разных дат несравнимы
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: BASE, locale: 'ru-RU' });
await context.addInitScript(INIT_SCRIPT);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error' || /hydration/i.test(m.text())) errors.push(`[${m.type()}] ${m.text().slice(0, 200)}`); });
const cdp = await context.newCDPSession(page);
await cdp.send('Performance.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

const all = { base: BASE, cpu: CPU, runs: RUNS, contextOff: CONTEXT_OFF, date: new Date().toISOString(), results: [] };
for (let run = 1; run <= RUNS; run++) {
  log(`\n=== прогон ${run}/${RUNS}, CPU ×${CPU} ===`);
  const loadMs = await openMap(page);
  log(`  загрузка карты до первых участков: ${loadMs} ms`);
  all.results.push({ run, name: 'load', wallMs: loadMs });
  let first = true;
  for (const key of Object.keys(scenarios)) {
    if (ONLY && !ONLY.includes(key)) continue;
    try {
      if (!first) { await page.goto('about:blank'); await openMap(page); }
      first = false;
      const r = await scenarios[key](page, cdp);
      for (const x of [].concat(r)) all.results.push({ run, ...x });
    } catch (e) {
      log(`  ${key}: ОШИБКА ${String(e.message || e).slice(0, 300)}`);
      all.results.push({ run, name: key, error: String(e.message || e).slice(0, 300) });
      await closeOverlays(page).catch(() => {});
    }
  }
  if (run < RUNS) await page.goto('about:blank');
}
all.consoleErrors = [...new Set(errors)];
writeFileSync(OUT, JSON.stringify(all, null, 2));
log(`\nошибки консоли: ${all.consoleErrors.length}`, all.consoleErrors.slice(0, 10));
log(`результаты: ${OUT}`);
await browser.close();
