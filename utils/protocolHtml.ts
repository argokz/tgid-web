import DOMPurify from 'dompurify';
import { escapeHtml } from '~/utils/escapeHtml';

/**
 * Очистка HTML-вывода расчёта sety перед v-html (протокол расчёта).
 * В выводе — цвета и жирный (sety/any/colors.py: <span style="color:…">, <b>), ссылки на объекты
 * (sety/w_print.py: <a name='node|line|line2' id|id1|id2 href>), а между ними — имена объектов из базы, которые
 * сервер не экранирует. Оставляем только эту разметку; стиль — только цвет и начертание (без url(), позиции и т. п.).
 */
const ALLOWED_TAGS = ['span', 'b', 'i', 'u', 'br', 'a'];
const ALLOWED_ATTR = ['style', 'name', 'id', 'id1', 'id2', 'href'];
const ALLOWED_STYLE = new Set(['color', 'font-weight', 'font-style', 'text-decoration']);
/** Значение свойства: слова, #hex, числа — без скобок (url(), expression()) и кавычек */
const SAFE_STYLE_VALUE = /^[#\w\s.%-]+$/;

let purifier: ReturnType<typeof DOMPurify> | null = null;

function safeStyle(style: string): string {
  return style
    .split(';')
    .map((decl) => {
      const i = decl.indexOf(':');
      if (i < 0) return '';
      const prop = decl.slice(0, i).trim().toLowerCase();
      const value = decl.slice(i + 1).trim();
      return ALLOWED_STYLE.has(prop) && SAFE_STYLE_VALUE.test(value) ? `${prop}:${value}` : '';
    })
    .filter(Boolean)
    .join(';');
}

function getPurifier(): ReturnType<typeof DOMPurify> | null {
  if (purifier) return purifier;
  if (typeof window === 'undefined') return null;
  const p = DOMPurify(window);
  if (!p.isSupported) return null;
  p.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName !== 'style') return;
    data.attrValue = safeStyle(data.attrValue);
    if (!data.attrValue) data.keepAttr = false;
  });
  purifier = p;
  return p;
}

export function sanitizeProtocolHtml(html: string): string {
  const p = getPurifier();
  // без DOM (SSR, старый браузер) разметку не доверяем — показываем текстом
  if (!p) return escapeHtml(html);
  return p.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?!\s*(?:javascript|data|vbscript):)/i,
  });
}
