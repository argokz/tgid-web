#!/usr/bin/env node
// Иконки приложения из знака ITwin Map (docs/brand/logo-a-network-m.svg, этап 8): favicon.ico 16/32,
// apple-touch-icon 180, иконки manifest 192/512 (и maskable 512). Растр — через браузер Playwright (Edge/Chrome
// системы, отдельный Chromium не нужен), ICO собирается из PNG-кадров. Запуск после правки знака:
//   node scripts/brand/render-icons.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PUBLIC = join(ROOT, 'public');

const PRIMARY = '#1565c0';
const ACCENT = '#d97706';
/** На синей плашке акцент светлее — контраст с primary */
const ACCENT_ON_PRIMARY = '#fbbf24';

/** Знак на сетке 24: трасса M, четыре узла, источник в центре */
const mark = (line, accent) => `
  <path d="M4 20V6l8 8 8-8v14" stroke="${line}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <g fill="${line}"><circle cx="4" cy="20" r="2.25"/><circle cx="4" cy="6" r="2.25"/><circle cx="20" cy="6" r="2.25"/><circle cx="20" cy="20" r="2.25"/></g>
  <circle cx="12" cy="14" r="3" fill="${accent}"/>`;

/** Прозрачный фон: favicon */
const bare = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${mark(PRIMARY, ACCENT)}</svg>`;

/**
 * Плашка primary со знаком: scale — доля знака от стороны; rounded — скругление (иконка «any»), без него —
 * квадрат на всю площадь (apple-touch: iOS скругляет сам; maskable: знак в безопасной зоне 80 %)
 */
const plate = (scale, rounded) => {
  const size = 24 / scale;
  const off = (size - 24) / 2;
  const rx = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-off} ${-off} ${size} ${size}">
    <rect x="${-off}" y="${-off}" width="${size}" height="${size}" rx="${rx}" fill="${PRIMARY}"/>${mark('#ffffff', ACCENT_ON_PRIMARY)}</svg>`;
};

const targets = [
  { file: 'favicon-16.png', svg: bare(), px: 16, ico: true },
  { file: 'favicon-32.png', svg: bare(), px: 32, ico: true },
  { file: 'apple-touch-icon.png', svg: plate(0.62, false), px: 180 },
  { file: 'icon-192.png', svg: plate(0.6, true), px: 192 },
  { file: 'icon-512.png', svg: plate(0.6, true), px: 512 },
  { file: 'icon-maskable-512.png', svg: plate(0.5, false), px: 512 },
];

/** ICO из PNG-кадров (Vista+ читает PNG внутри ICO) */
function buildIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  const dir = Buffer.alloc(16 * frames.length);
  let offset = 6 + dir.length;
  frames.forEach(({ px, png }, i) => {
    const e = i * 16;
    dir.writeUInt8(px >= 256 ? 0 : px, e);
    dir.writeUInt8(px >= 256 ? 0 : px, e + 1);
    dir.writeUInt8(0, e + 2);
    dir.writeUInt8(0, e + 3);
    dir.writeUInt16LE(1, e + 4);
    dir.writeUInt16LE(32, e + 6);
    dir.writeUInt32LE(png.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...frames.map((f) => f.png)]);
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const icoFrames = [];
  for (const t of targets) {
    await page.setViewportSize({ width: t.px, height: t.px });
    await page.setContent(`<html><body style="margin:0;background:transparent">${t.svg.replace('<svg ', `<svg width="${t.px}" height="${t.px}" `)}</body></html>`);
    const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t.px, height: t.px } });
    if (t.ico) icoFrames.push({ px: t.px, png });
    else writeFileSync(join(PUBLIC, t.file), png);
    process.stdout.write(`${t.file} ${png.length} B\n`);
  }
  const ico = buildIco(icoFrames);
  writeFileSync(join(PUBLIC, 'favicon.ico'), ico);
  process.stdout.write(`favicon.ico ${ico.length} B\n`);
} finally {
  await browser.close();
}
