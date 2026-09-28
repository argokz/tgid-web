/**
 * 3D Tiles сети для Cesium: разбор адреса из runtimeConfig и понятные сообщения об ошибках.
 * Адрес задаётся NUXT_PUBLIC_NETWORK_TILESET_URL (см. docs/deploy-3d.md); пусто — слой выключен.
 */

export type TilesetStatus = 'disabled' | 'loading' | 'ready' | 'error'

/**
 * Абсолютный http(s)-адрес и путь от корня сайта («/tiles/network/tileset.json») остаются как есть;
 * относительный («tiles/network/tileset.json») считается от app.baseURL (например, /itwin-map/),
 * а не от текущей страницы — иначе на вложенных маршрутах адрес «уезжает».
 */
export function resolveTilesetUrl(raw: unknown, appBaseUrl = '/'): string {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith('/')) return value
  const base = appBaseUrl.endsWith('/') ? appBaseUrl : `${appBaseUrl}/`
  return `${base}${value.replace(/^\.\//, '')}`
}

/** Сообщение для пользователя по ошибке Cesium3DTileset.fromUrl (404, CORS, не JSON, версия). */
export function describeTilesetError(error: unknown): string {
  const anyErr = error as { statusCode?: number, message?: string } | null
  const status = anyErr?.statusCode
  if (status === 404) return 'tileset.json не найден (404) — проверьте путь выкладки'
  if (status === 401 || status === 403) return `доступ к тайлсету запрещён (${status})`
  if (typeof status === 'number' && status >= 400) return `сервер тайлсета ответил ${status}`
  const message = String(anyErr?.message || error || '').trim()
  if (/json/i.test(message)) return 'по адресу тайлсета пришёл не JSON (проверьте путь и MIME-тип)'
  if (!status && /request|network|fetch|cors/i.test(message)) {
    return 'тайлсет недоступен по сети (сервер, CORS или смешанный http/https)'
  }
  return message || 'неизвестная ошибка загрузки тайлсета'
}
