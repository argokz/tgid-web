/**
 * Настройки города стенда: охват, центр карты, рабочая область GeoServer схемы ТГИД.
 *
 * Один веб обслуживает одну базу (API: DB_NAME). Для другого города (Астана) задаются:
 *   NUXT_PUBLIC_CITY_BBOX="71.05,50.94,71.79,51.37"  — охват [minLon,minLat,maxLon,maxLat] (поиск адреса)
 *   NUXT_PUBLIC_MAP_CENTER="71.43,51.13"             — стартовый центр и «Домой» (иначе — центр охвата)
 *   GEOSERVER_LAYER_CATALOG                          — первый workspace каталога (AstanaGIS);
 *                                                      в сборке — NUXT_PUBLIC_GEOSERVER_LAYER_CATALOG
 *   NUXT_PUBLIC_DEFAULT_FRAGMENTS="2-46,3179"        — фрагменты, видимые при открытии карты (id и диапазоны);
 *                                                      пусто — все. В Астане варианты магистралей лежат
 *                                                      друг на друге, без выбора карта показывает все копии
 * Переменные NUXT_PUBLIC_* читаются при запуске сервера, пересборка не нужна.
 * Прод с двумя городами на одном домене — docs/geoserver-city-workspace.md.
 */

export type LonLatBBox = [number, number, number, number]

/** Охват Алматы — по умолчанию (QA F25: поиск адреса только в городе) */
export const ALMATY_BBOX: LonLatBBox = [76.70, 43.05, 77.25, 43.45]
export const ALMATY_CENTER: [number, number] = [76.946, 43.222]
export const DEFAULT_WORKSPACE = 'AlmatyGIS'

function numbers(raw: unknown, count: number): number[] | null {
  const parts = Array.isArray(raw) ? raw : String(raw ?? '').split(',')
  const nums = parts.map((v) => Number(String(v).trim()))
  return nums.length === count && nums.every(Number.isFinite) ? nums : null
}

export function parseBbox(raw: unknown): LonLatBBox | null {
  const n = numbers(raw, 4)
  return n && n[0] < n[2] && n[1] < n[3] ? (n as LonLatBBox) : null
}

export function parseCenter(raw: unknown): [number, number] | null {
  const n = numbers(raw, 2)
  return n && Math.abs(n[0]) <= 180 && Math.abs(n[1]) <= 90 ? (n as [number, number]) : null
}

/** Список id фрагментов: "2-5,48, 3179" или массив; ошибочные части пропускаются, итог — по возрастанию */
export function parseFragmentIds(raw: unknown): number[] {
  const parts = Array.isArray(raw) ? raw : String(raw ?? '').split(',')
  const ids = new Set<number>()
  for (const part of parts) {
    const m = String(part).trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!m) continue
    const from = Number(m[1])
    const to = m[2] ? Number(m[2]) : from
    if (from < 1 || to < from || to - from > 10000) continue
    for (let id = from; id <= to; id++) ids.add(id)
  }
  return [...ids].sort((a, b) => a - b)
}

export interface CityConfig {
  bbox: LonLatBBox
  center: [number, number]
  workspace: string
  /** Фрагменты, видимые при открытии карты; пусто — все */
  defaultFragments: number[]
}

export function readCityConfig(pub: Record<string, any>): CityConfig {
  const bbox = parseBbox(pub.cityBbox)
  const center = parseCenter(pub.mapCenter)
    ?? (bbox ? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] as [number, number] : ALMATY_CENTER)
  return {
    bbox: bbox ?? ALMATY_BBOX,
    center,
    workspace: String(pub.geoserver?.workspace || DEFAULT_WORKSPACE),
    defaultFragments: parseFragmentIds(pub.defaultFragments),
  }
}

/** Настройки города из runtimeConfig (вне контекста Nuxt — Алматы) */
export function getCityConfig(): CityConfig {
  try {
    return readCityConfig((useRuntimeConfig().public || {}) as Record<string, any>)
  } catch {
    return readCityConfig({})
  }
}
