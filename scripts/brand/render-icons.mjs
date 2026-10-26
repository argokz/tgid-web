#!/usr/bin/env node
// Иконки приложения из знака ITwin Map (docs/brand/itwin-map-mark.svg, этап 8): favicon.ico 16/32,
// apple-touch-icon 180, иконки manifest 192/512 (и maskable 512). Растр — через браузер Playwright (Edge/Chrome
// системы, отдельный Chromium не нужен), ICO собирается из PNG-кадров. Запуск после правки знака:
//   node scripts/brand/render-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PUBLIC = join(ROOT, 'public');

/** Знак — слои ГИС (docs/brand/itwin-map-mark.svg, вырезан из docs/brand/itwin-map-logo.svg без надписи) */
const MARK = readFileSync(join(ROOT, 'docs/brand/itwin-map-mark.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const MARK_VIEWBOX = MARK.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const markInner = MARK.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** Прозрачный фон: favicon */
const bare = () => MARK;

/**
 * Белая плашка со знаком (знак цветной, с градиентами — на primary не читается): scale — доля ширины знака от
 * стороны; rounded — скругление (иконка «any»), без него — квадрат на всю площадь (apple-touch: iOS скругляет сам;
 * maskable: знак в безопасной зоне 80 %)
 */
const plate = (scale, rounded) => {
  const [vx, vy, vw, vh] = MARK_VIEWBOX;
  const side = vw / scale;
  const x0 = vx - (side - vw) / 2;
  const y0 = vy - (side - vh) / 2;
  const rx = rounded ? side * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${side} ${side}">
    <rect x="${x0}" y="${y0}" width="${side}" height="${side}" rx="${rx}" fill="#ffffff"/>${markInner}</svg>`;
};

const targets = [
  { file: 'favicon-16.png', svg: bare(), px: 16, ico: true },
  { file: 'favicon-32.png', svg: bare(), px: 32, ico: true },
  { file: 'apple-touch-icon.png', svg: plate(0.78, false), px: 180 },
  { file: 'icon-192.png', svg: plate(0.8, true), px: 192 },
  { file: 'icon-512.png', svg: plate(0.8, true), px: 512 },
  { file: 'icon-maskable-512.png', svg: plate(0.66, false), px: 512 },
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
