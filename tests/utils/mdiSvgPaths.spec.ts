import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveMdiSvgPath } from '~/utils/mdiSvgPaths';

const ROOT = resolve(__dirname, '../..');
const SCAN_DIRS = ['components', 'pages', 'layouts', 'utils', 'composables', 'stores', 'plugins', 'services'];
const SCAN_FILES = ['app.vue', 'error.vue'];

function collectFiles(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectFiles(full, out);
    else if (/\.(vue|ts)$/.test(name)) out.push(full);
  }
}

/** Все литералы `mdi-*` из исходников (кроме префиксов, которые дописываются в рантайме: `mdi-chevron-${...}`). */
function usedIconNames(): Map<string, string> {
  const files: string[] = [];
  for (const d of SCAN_DIRS) collectFiles(join(ROOT, d), files);
  for (const f of SCAN_FILES) {
    try {
      if (statSync(join(ROOT, f)).isFile()) files.push(join(ROOT, f));
    } catch {
      /* нет файла */
    }
  }
  const icons = new Map<string, string>();
  const re = /(?<![\w-])mdi-[a-z0-9]+(?:-[a-z0-9]+)*(?![\w$-])/g;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(re)) {
      // `mdi-svg` — имя набора Vuetify (`vuetify/iconsets/mdi-svg`), не иконка
      if (m[0] === 'mdi-svg') continue;
      if (!icons.has(m[0])) icons.set(m[0], file.slice(ROOT.length + 1));
    }
  }
  return icons;
}

describe('mdiSvgPaths: resolveMdiSvgPath', () => {
  it('сегменты-цифры: mdi-circle-slice-8 → mdiCircleSlice8 (QA F2)', () => {
    expect(resolveMdiSvgPath('mdi-circle-slice-8')).not.toBe('');
    expect(resolveMdiSvgPath('mdi-circle-slice-8')).toBe(resolveMdiSvgPath('mdiCircleSlice8'));
  });

  it('kebab и export-имя дают один путь', () => {
    expect(resolveMdiSvgPath('mdi-cog')).toBe(resolveMdiSvgPath('mdiCog'));
    expect(resolveMdiSvgPath('mdi-no-such-icon')).toBe('');
  });

  it('каждая mdi-иконка из исходников резолвится в SVG-путь', () => {
    const icons = usedIconNames();
    expect(icons.size).toBeGreaterThan(50);
    const missing = [...icons].filter(([name]) => !resolveMdiSvgPath(name)).map(([name, file]) => `${name} (${file})`);
    expect(missing).toEqual([]);
  });
});
