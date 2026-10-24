export const APP_TITLE = 'ITwin Map';

/** Разделитель частей заголовка вкладки */
const SEPARATOR = ' — ';

/**
 * Заголовок вкладки браузера по состоянию: «Инструменты — Алматы — ITwin Map», «Фрагмент 74 — Алматы — ITwin Map».
 * Контекст — открытая панель или текущий фрагмент; город — из сессии. Пустые части пропускаются.
 */
export function buildPageTitle(parts: { context?: string | null; city?: string | null }): string {
  return [parts.context, parts.city, APP_TITLE]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(SEPARATOR);
}
