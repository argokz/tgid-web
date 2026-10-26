/**
 * Индексация поисковиками (этап 9): приложение за логином, поэтому цель — формальная корректность. Стенды
 * закрыты (`noindex` в meta и `Disallow: /` в robots.txt), прод открывается флагом NUXT_PUBLIC_SITE_INDEXABLE и
 * получает канонический адрес NUXT_PUBLIC_SITE_URL.
 */
export interface SiteIndexing {
  indexable: boolean;
  /** Канонический адрес приложения; пусто — без canonical */
  siteUrl?: string;
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
