/**
 * Кто может показывать страницы ТГИД во фрейме (защита от подмены кликов — clickjacking).
 *
 * Приложение — только на своём сайте: Content-Security-Policy frame-ancestors 'self' и X-Frame-Options SAMEORIGIN.
 * Исключения для чужих сайтов: /embed — встраиваемая карта (сайты проверяет сама страница по ключу встраивания,
 * utils/embedProtocol.ts) и /outages — публичная карта отключений для порталов акиматов. Обе только читают.
 * Путь считается от app.baseURL, который задаётся при запуске (NUXT_APP_BASE_URL=/tgid/almaty/).
 */

export const EMBEDDABLE_PAGES = ['embed', 'outages'] as const;

export interface FrameHeaders {
  'Content-Security-Policy': string;
  'X-Frame-Options'?: string;
}

/** Путь запроса без baseURL и без параметров: «/tgid/almaty/embed?key=…» → «embed» */
export function appRelativePath(path: string, baseURL: string): string {
  const pathname = (path.split(/[?#]/, 1)[0] ?? '').replace(/\/{2,}/g, '/');
  const base = `/${baseURL.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\/+/, '');
  return rest.replace(/\/+$/, '');
}

export function frameHeaders(path: string, baseURL: string): FrameHeaders {
  const page = appRelativePath(path, baseURL);
  if ((EMBEDDABLE_PAGES as readonly string[]).includes(page)) {
    return { 'Content-Security-Policy': 'frame-ancestors *' };
  }
  return { 'Content-Security-Policy': "frame-ancestors 'self'", 'X-Frame-Options': 'SAMEORIGIN' };
}
