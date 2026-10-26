import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import * as mdi from '@mdi/js';
import { beforeAll, describe, expect, it } from 'vitest';
import { firstScreenMdiSvgPaths, loadLazyMdiSvgPaths, resolveMdiSvgPath, toMdiExportName } from '~/utils/mdiSvgPaths';
import { lazyMdiSvgPaths } from '~/utils/mdiSvgPathsLazy';

const ROOT = resolve(__dirname, '../..');
const SCAN_DIRS = ['components', 'pages', 'layouts', 'utils', 'composables', 'stores', 'plugins', 'services'];
const SCAN_FILES = ['app.vue', 'error.vue'];
/** Корни первого экрана: всё, что они тянут статически, рендерится до загрузки ленивого набора иконок */
const FIRST_SCREEN_ROOTS = ['app.vue', 'error.vue', 'layouts/default.vue', 'pages/index.vue'];
/** Модули с автоимпортом Nuxt: их иконки может показать любой компонент первого экрана без явного import */
const AUTO_IMPORT_DIRS = ['utils', 'composables', 'stores', 'plugins'];
const ICON_RE = /(?<![\w-])mdi-[a-z0-9]+(?:-[a-z0-9]+)*(?![\w$-])/g;

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

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Обход и чтение — один раз на файл теста: под параллельной нагрузкой vitest двойной обход упирался в таймаут */
const textCache = new Map<string, string>();
function readText(file: string): string {
  let text = textCache.get(file);
  if (text === undefined) {
    text = readFileSync(file, 'utf8');
    textCache.set(file, text);
  }
  return text;
}

let sourceFilesCache: string[] | undefined;
function sourceFiles(): string[] {
  if (sourceFilesCache) return sourceFilesCache;
  const files: string[] = [];
  for (const d of SCAN_DIRS) collectFiles(join(ROOT, d), files);
  for (const f of SCAN_FILES) if (isFile(join(ROOT, f))) files.push(join(ROOT, f));
  sourceFilesCache = files;
  return files;
}

/** Литералы `mdi-*` файла (кроме `mdi-svg` — имя набора Vuetify `vuetify/iconsets/mdi-svg`, не иконка) */
function iconsIn(file: string): string[] {
  return [...readText(file).matchAll(ICON_RE)].map((m) => m[0]).filter((name) => name !== 'mdi-svg');
}

/** Все литералы `mdi-*` из исходников (кроме префиксов, которые дописываются в рантайме: `mdi-chevron-${...}`). */
function usedIconNames(files: string[]): Map<string, string> {
  const icons = new Map<string, string>();
  for (const file of files) {
    for (const name of iconsIn(file)) if (!icons.has(name)) icons.set(name, relative(ROOT, file));
  }
  return icons;
}

/**
 * Файлы первого экрана: корни, компоненты из их шаблонов (кроме `Lazy*` — отдельный чанк), статические import
 * и так далее рекурсивно. Имя компонента Nuxt — путь в components/ в PascalCase, для вложенных папок
 * сверяем и по имени файла (Nuxt убирает повтор префикса папки).
 */
function firstScreenFiles(files: string[]): string[] {
  const componentsDir = join(ROOT, 'components');
  const byName = new Map<string, string>();
  for (const f of files) {
    const rel = relative(componentsDir, f);
    if (rel.startsWith('..') || !rel.endsWith('.vue')) continue;
    const parts = rel.replace(/\.vue$/, '').split(/[\\/]/);
    byName.set(parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(''), f);
    if (!byName.has(parts[parts.length - 1])) byName.set(parts[parts.length - 1], f);
  }
  const toPascal = (tag: string) => tag.replace(/(^|-)([a-z])/g, (_: string, __: string, c: string) => c.toUpperCase());

  const seen = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readText(file);
    const template = text.match(/<template>[\s\S]*<\/template>/)?.[0] ?? '';
    for (const m of template.matchAll(/<([A-Z][A-Za-z0-9]+|[a-z]+(?:-[a-z0-9]+)+)[\s/>]/g)) {
      const name = toPascal(m[1]);
      const target = name.startsWith('Lazy') ? undefined : byName.get(name);
      if (target) visit(target);
    }
    for (const m of text.matchAll(/^\s*import\s+(?!type\b)[^'"]*from\s+['"]((?:~|@|\.)[^'"]*)['"]/gm)) {
      const spec = m[1].replace(/^[~@]\//, `${ROOT}/`);
      const base = spec.startsWith('.') ? join(dirname(file), spec) : spec;
      const target = [base, `${base}.ts`, `${base}.vue`, join(base, 'index.ts')].find(isFile);
      if (target) visit(resolve(target));
    }
  };
  for (const root of FIRST_SCREEN_ROOTS) if (isFile(join(ROOT, root))) visit(join(ROOT, root));
  for (const f of files) {
    if (f.endsWith('.ts') && AUTO_IMPORT_DIRS.includes(relative(ROOT, f).split(/[\\/]/)[0])) seen.add(f);
  }
  return [...seen].filter((f) => !basename(f).startsWith('mdiSvgPaths'));
}

describe('mdiSvgPaths: resolveMdiSvgPath', () => {
  beforeAll(() => loadLazyMdiSvgPaths());

  it('сегменты-цифры: mdi-circle-slice-8 → mdiCircleSlice8 (QA F2)', () => {
    expect(toMdiExportName('mdi-circle-slice-8')).toBe('mdiCircleSlice8');
    expect(resolveMdiSvgPath('mdi-circle-slice-8')).not.toBe('');
    expect(resolveMdiSvgPath('mdi-circle-slice-8')).toBe(resolveMdiSvgPath('mdiCircleSlice8'));
  });

  it('kebab и export-имя дают один путь', () => {
    expect(resolveMdiSvgPath('mdi-cog')).toBe(resolveMdiSvgPath('mdiCog'));
    expect(resolveMdiSvgPath('mdi-no-such-icon')).toBe('');
  });

  it('ленивый набор резолвится после загрузки', () => {
    const [name, path] = Object.entries(lazyMdiSvgPaths)[0];
    expect(resolveMdiSvgPath(name)).toBe(path);
  });

  it('пути ленивого набора — те же, что в @mdi/js (строки там вписаны руками)', () => {
    const icons = mdi as Record<string, string>;
    const wrong = Object.entries(lazyMdiSvgPaths).filter(([name, path]) => icons[name] !== path).map(([name]) => name);
    expect(wrong).toEqual([]);
  });

  it('наборы не пересекаются', () => {
    expect(Object.keys(lazyMdiSvgPaths).filter((name) => name in firstScreenMdiSvgPaths)).toEqual([]);
  });

  it('каждая mdi-иконка из исходников резолвится в SVG-путь (новую — в utils/mdiSvgPaths.ts или mdiSvgPathsLazy.ts)', () => {
    const icons = usedIconNames(sourceFiles());
    expect(icons.size).toBeGreaterThan(50);
    const missing = [...icons].filter(([name]) => !resolveMdiSvgPath(name)).map(([name, file]) => `${name} (${file})`);
    expect(missing).toEqual([]);
  });

  it('иконки первого экрана — в utils/mdiSvgPaths.ts, не в ленивом наборе (иначе мигают до загрузки чанка)', () => {
    const files = firstScreenFiles(sourceFiles());
    expect(files.some((f) => f.endsWith('MapViewer.vue'))).toBe(true);
    const icons = usedIconNames(files);
    expect(icons.size).toBeGreaterThan(50);
    const lazy = [...icons]
      .filter(([name]) => !(toMdiExportName(name) in firstScreenMdiSvgPaths))
      .map(([name, file]) => `${name} (${file})`);
    expect(lazy).toEqual([]);
  });
});
