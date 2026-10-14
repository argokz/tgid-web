/**
 * Сервер веба ходит в GeoServer напрямую (GEOSERVER_INTERNAL_URL, например http://127.0.0.1:8085/geoserver):
 * публичный https://itwin.kz/geoserver закрыт входом (nginx auth_request по cookie пользователя),
 * а у сервера cookie нет. Браузеру по-прежнему отдаются публичные адреса.
 */
export function geoserverInternalBase(runtimeConfig: any): string {
  return String(process.env.GEOSERVER_INTERNAL_URL || runtimeConfig?.geoserverInternalUrl || '')
    .trim()
    .replace(/\/$/, '')
}

/** URL публичного GeoServer → тот же запрос на внутренний адрес (если он задан) */
export function toInternalGeoserverUrl(url: string, runtimeConfig: any): string {
  const internal = geoserverInternalBase(runtimeConfig)
  if (!internal || !url) return url
  const publicBase = String(runtimeConfig?.public?.geoserver?.url || 'https://itwin.kz/geoserver')
    .trim()
    .replace(/\/$/, '')
  for (const base of new Set([publicBase, 'https://itwin.kz/geoserver'])) {
    if (url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`)) return internal + url.slice(base.length)
  }
  return url
}
