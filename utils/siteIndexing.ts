/**
 * Индексация поисковиками (этап 9): приложение за логином, поэтому цель — формальная корректность. Стенды
 * закрыты `noindex` в meta (главная защита) и `Disallow: /` в robots.txt; прод открывается флагом
 * NUXT_PUBLIC_SITE_INDEXABLE=true и получает канонический адрес NUXT_PUBLIC_SITE_URL.
 *
 * robots.txt отдаётся под путём приложения (`/itwin-map/robots.txt`): поисковики читают только корень домена, а он
 * принадлежит nginx. Поэтому на стенде полагаться можно только на meta noindex; корневой robots.txt стенда
 * с `Disallow: /` закрыл бы роботу и сами страницы, и он не увидел бы noindex — так не делать.
 */
export interface SiteIndexing {
  indexable: boolean;
  /** Канонический адрес приложения; пусто — без canonical */
  siteUrl?: string;
}

/**
 * Флаг индексации строго: только `true` или строка `'true'`. Рантайм-переопределение Nuxt приводит значения
 * (`1`, `yes` — истина при `Boolean`), и опечатка на стенде открыла бы его поисковикам — закрыто по умолчанию.
 */
export function parseIndexable(value: unknown): boolean {
  return value === true || value === 'true';
}

/** Значение флага задано, но не распознано (не true/false) — о нём стоит предупредить при запуске */
export function isUnrecognizedIndexable(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === false || value === 'false') return false;
  return !parseIndexable(value);
}

/** Содержимое meta robots: null — тег не нужен (индексация разрешена) */
export function robotsMetaContent({ indexable }: SiteIndexing): string | null {
  return indexable ? null : 'noindex, nofollow';
}

/** Канонический адрес: абсолютный http(s) с завершающим «/», иначе null */
export function canonicalUrl({ siteUrl }: SiteIndexing): string | null {
  const url = (siteUrl ?? '').trim();
  if (!/^https?:\/\/[^/\s]+/i.test(url)) return null;
  return url.replace(/\/?$/, '/');
}

/** Текст robots.txt для пути приложения (basePath — app.baseURL) */
export function robotsTxt(site: SiteIndexing, basePath: string): string {
  const base = basePath.replace(/\/?$/, '/');
  const lines = ['User-agent: *', site.indexable ? `Allow: ${base}` : 'Disallow: /'];
  return `${lines.join('\n')}\n`;
}

/** Предупреждения конфигурации индексации для журнала сервера при запуске */
export function siteIndexingWarnings(rawIndexable: unknown, siteUrl: unknown): string[] {
  const warnings: string[] = [];
  if (isUnrecognizedIndexable(rawIndexable)) {
    warnings.push(`NUXT_PUBLIC_SITE_INDEXABLE=${String(rawIndexable)} не распознан (ожидается true/false) — сайт закрыт от индексации`);
  }
  if (parseIndexable(rawIndexable) && !canonicalUrl({ indexable: true, siteUrl: String(siteUrl ?? '') })) {
    warnings.push(`NUXT_PUBLIC_SITE_URL="${String(siteUrl ?? '')}" — не абсолютный http(s)-адрес, canonical не выводится`);
  }
  return warnings;
}
