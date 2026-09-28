/**
 * Подложка VISICOM (в десктопе gid6/gid8 — ID_VISICOM_MAP, TMS с перевёрнутой осью Y,
 * поддомены tms1..tms4). Адрес и ключ задаются только конфигом (runtimeConfig/env):
 *   NUXT_PUBLIC_VISICOM_TILES_URL — шаблон с {z}/{x}/{y}, опционально {s} и {key};
 *   NUXT_PUBLIC_VISICOM_KEY       — ключ API;
 *   NUXT_PUBLIC_VISICOM_SCHEME    — tms (по умолчанию, как в десктопе) или xyz.
 * Без ключа или шаблона подложка не показывается и запросов к VISICOM нет.
 */

export const VISICOM_BASE_LAYER_ID = 'visicom'

/** Поддомены {s} — в десктопе tms1..tms4. */
export const VISICOM_SUBDOMAINS = ['1', '2', '3', '4']

export interface VisicomConfig {
  tilesUrl: string
  key: string
  scheme: 'tms' | 'xyz'
  attribution: string
  maxzoom: number
}

export function readVisicomConfig(publicConfig: Record<string, unknown> | null | undefined): VisicomConfig {
  const cfg = publicConfig || {}
  const scheme = String(cfg.visicomScheme || 'tms').trim().toLowerCase() === 'xyz' ? 'xyz' : 'tms'
  const maxzoom = Number(cfg.visicomMaxZoom)
  return {
    tilesUrl: String(cfg.visicomTilesUrl || '').trim(),
    key: String(cfg.visicomKey || '').trim(),
    scheme,
    attribution: String(cfg.visicomAttribution || '').trim() || '© VISICOM',
    maxzoom: Number.isFinite(maxzoom) && maxzoom > 0 ? Math.min(maxzoom, 22) : 19
  }
}

export function isVisicomEnabled(cfg: VisicomConfig): boolean {
  return Boolean(cfg.tilesUrl && cfg.key)
}

/**
 * Список URL тайлов для MapLibre: {s} разворачивается в поддомены, {key} подставляется,
 * а если в шаблоне нет {key} — добавляется параметр key=. Без ключа — пустой список.
 */
export function buildVisicomTiles(cfg: VisicomConfig): string[] {
  if (!isVisicomEnabled(cfg)) return []
  const encodedKey = encodeURIComponent(cfg.key)
  let template = cfg.tilesUrl
  if (template.includes('{key}')) {
    template = template.split('{key}').join(encodedKey)
  } else {
    template += `${template.includes('?') ? '&' : '?'}key=${encodedKey}`
  }
  if (!template.includes('{s}')) return [template]
  return VISICOM_SUBDOMAINS.map((sub) => template.split('{s}').join(sub))
}

export function buildVisicomSource(cfg: VisicomConfig) {
  const tiles = buildVisicomTiles(cfg)
  if (!tiles.length) return null
  return {
    type: 'raster' as const,
    tiles,
    tileSize: 256,
    scheme: cfg.scheme,
    attribution: cfg.attribution,
    minzoom: 0,
    maxzoom: cfg.maxzoom
  }
}

function getRuntimePublicSafe(): Record<string, unknown> {
  try {
    return (useRuntimeConfig().public || {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Конфиг VISICOM из runtimeConfig текущего приложения. */
export function getVisicomConfig(): VisicomConfig {
  return readVisicomConfig(getRuntimePublicSafe())
}
