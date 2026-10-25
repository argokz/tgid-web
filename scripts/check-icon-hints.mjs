#!/usr/bin/env node
// Этап 8 (docs/ui-modernization-prompt.md, раздел 13): у каждой кнопки-иконки — подсказка.
// Кнопка-иконка: <v-btn icon …> или v-btn, в котором кроме <v-icon> нет текста. Подсказка: обёртка HintTip / v-tooltip
// (кнопка внутри активатора) или атрибут title. aria-label — для читалок экрана, видимой подсказкой не считается.
// Запуск: node scripts/check-icon-hints.mjs [--list] — без подсказки выход с кодом 1.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIRS = ['components', 'pages', 'layouts', 'app.vue'];
const HINT_WRAPPERS = new Set(['hinttip', 'hint-tip', 'v-tooltip', 'vtooltip']);
const BUTTONS = new Set(['v-btn', 'vbtn']);
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'col', 'area', 'wbr']);

const TAG = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][\w.-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;

function* vueFiles(path) {
  const st = statSync(path);
  if (st.isFile()) {
    if (path.endsWith('.vue')) yield path;
    return;
  }
  for (const name of readdirSync(path)) yield* vueFiles(join(path, name));
}

/** Шаблон SFC: от первого <template> до последнего </template> перед <script>/<style> */
function templateOf(src) {
  const start = src.indexOf('<template');
  if (start < 0) return null;
  const tail = src.search(/^<(script|style)\b/m);
  const end = src.lastIndexOf('</template>', tail > start ? tail : src.length);
  return end > start ? { text: src.slice(0, end + '</template>'.length), offset: 0 } : null;
}

const hasAttr = (attrs, name) => new RegExp(`(?:^|\\s)(?::|v-bind:)?${name}(?=[\\s=]|$)`).test(attrs);

function check(file) {
  const src = readFileSync(file, 'utf8');
  const tpl = templateOf(src);
  if (!tpl) return { total: 0, missing: [] };
  const stack = [];
  const missing = [];
  let total = 0;
  const lineAt = (i) => src.slice(0, i).split('\n').length;

  const judge = (btn, inner) => {
    const iconAttr = hasAttr(btn.attrs, 'icon');
    const textAttr = hasAttr(btn.attrs, 'text');
    let iconOnly = iconAttr;
    if (!iconOnly && inner != null && !textAttr) {
      const rest = inner
        .replace(/<v-icon\b[\s\S]*?<\/v-icon>/g, '')
        .replace(/<v-icon\b[^>]*\/>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '');
      const hasIcon = /<v-icon\b/.test(inner) || hasAttr(btn.attrs, 'prepend-icon') || hasAttr(btn.attrs, 'append-icon');
      iconOnly = hasIcon && !/[^\s]/.test(rest.replace(/<[^>]+>/g, ''));
      // текст через v-badge/вложенные элементы с интерполяцией — уже не только иконка
      if (/\{\{/.test(rest)) iconOnly = false;
    }
    if (!iconOnly) return;
    total += 1;
    // подсказка внутри кнопки: <v-tooltip activator="parent">
    const innerTip = inner != null && /<v-tooltip\b[^>]*activator="parent"/.test(inner);
    const covered = btn.covered || innerTip || hasAttr(btn.attrs, 'title') || /\sv-tooltip\b/.test(btn.attrs);
    if (!covered) missing.push(`${relative(ROOT, file).replace(/\\/g, '/')}:${btn.line}`);
  };

  for (const m of tpl.text.matchAll(TAG)) {
    if (m[0].startsWith('<!--')) continue;
    const [, closing, rawName, attrs = '', selfClose] = m;
    const name = rawName.toLowerCase();
    if (closing) {
      // снять со стека до парного открытия
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].name !== name) continue;
        const [open] = stack.splice(i);
        if (BUTTONS.has(name)) judge(open, tpl.text.slice(open.end, m.index));
        break;
      }
      continue;
    }
    const covered = stack.some((t) => HINT_WRAPPERS.has(t.name));
    const entry = { name, attrs, line: lineAt(m.index), end: m.index + m[0].length, covered };
    if (selfClose || VOID.has(name)) {
      if (BUTTONS.has(name)) judge(entry, null);
      continue;
    }
    stack.push(entry);
  }
  return { total, missing };
}

let total = 0;
const missing = [];
for (const dir of DIRS) {
  const path = join(ROOT, dir);
  try {
    statSync(path);
  } catch {
    continue;
  }
  for (const file of vueFiles(path)) {
    const r = check(file);
    total += r.total;
    missing.push(...r.missing);
  }
}

const covered = total - missing.length;
const pct = total ? Math.round((covered / total) * 1000) / 10 : 100;
if (process.argv.includes('--list')) for (const m of missing) process.stdout.write(`${m}\n`);
process.stdout.write(`Кнопки-иконки: ${total}, с подсказкой ${covered} (${pct} %), без подсказки ${missing.length}\n`);
process.exit(missing.length ? 1 : 0);
