/**
 * Подача линий теплосети поверх стиля GeoServer (heatpipesections_gid, scripts/geoserver/gid_desktop_style.py).
 * Цвета и смысл линий — как в десктопе (подача #7f0000, обратка #00007f, закрытые #808000): здесь их не
 * трогаем, а добавляем белую обводку под трубами и порядок «магистрали поверх распределительных».
 *
 * Работает на уровне подслоёв пакета стиля (mbLayers) в server/api/geoserver-layers.ts: обводка — обычный
 * подслой со своим индексом, поэтому фильтр фрагментов, видимость и прозрачность слоя (stores/layerStore)
 * применяются к ней так же, как к трубам.
 */

export interface StyleSubLayer {
  id?: string
  type?: string
  filter?: unknown
  minzoom?: number
  maxzoom?: number
  layout?: Record<string, unknown>
  paint?: Record<string, unknown>
  [key: string]: unknown
}

/** Префикс id подслоя-обводки */
export const CASING_ID_PREFIX = 'casing-'
/** На сколько пикселей обводка шире трубы (по 1 px с каждой стороны) */
export const CASING_EXTRA_WIDTH_PX = 2
export const CASING_COLOR = '#ffffff'
export const CASING_OPACITY = 0.85

const filterText = (filter: unknown): string => JSON.stringify(filter ?? null)

/** Линия трубы (подача/обратка) — фильтр по полям pod/obr view участков */
export function isPipeLineLayer(layer: StyleSubLayer): boolean {
  return layer.type === 'line' && /"(pod|obr)"/.test(filterText(layer.filter)) && !isHighlightLayer(layer)
}

/** Подсветка ПТС (warning = 1) — широкая жёлтая подложка, остаётся ниже всех линий */
export function isHighlightLayer(layer: StyleSubLayer): boolean {
  return layer.type === 'line' && /"warning"/.test(filterText(layer.filter))
}

/**
 * В фильтре есть сравнение `field == 1` — в любой форме: legacy ["==", "f", "1"], выражение
 * ["==", ["get", "f"], 1] или варианты типа после sanitize ("1", 1, true внутри "any").
 */
function filterHasTrueEquality(filter: unknown, field: string): boolean {
  if (!Array.isArray(filter)) return false
  if (filter[0] === '==' && filter.length === 3) {
    const key = filter[1]
    const isField = key === field || (Array.isArray(key) && key[0] === 'get' && key[1] === field)
    if (isField && (filter[2] === 1 || filter[2] === '1' || filter[2] === true)) return true
  }
  return filter.some((part) => filterHasTrueEquality(part, field))
}

/** Магистраль (mag_gid = 1) */
export function isMagistralLayer(layer: StyleSubLayer): boolean {
  return filterHasTrueEquality(layer.filter, 'mag_gid')
}

/**
 * Ширина + `extra` px для любой формы, которую отдаёт GeoServer: число, legacy `{ stops }`
 * или `interpolate`/`step` по зуму с числовыми значениями. Иначе null — обводку не строим.
 */
export function widenLineWidth(width: unknown, extra: number): unknown {
  if (typeof width === 'number') return width + extra
  if (width && typeof width === 'object' && !Array.isArray(width)) {
    const fn = width as { stops?: unknown; base?: number }
    if (Array.isArray(fn.stops) && fn.stops.every((s) => Array.isArray(s) && typeof s[1] === 'number')) {
      return { ...fn, stops: (fn.stops as [number, number][]).map(([z, w]) => [z, w + extra]) }
    }
    return null
  }
  if (!Array.isArray(width)) return null
  const [op] = width
  const isZoomInput = (input: unknown) => JSON.stringify(input) === '["zoom"]'
  if (op === 'interpolate' && isZoomInput(width[2])) {
    const out = width.slice(0, 3)
    for (let i = 3; i < width.length; i += 2) {
      if (typeof width[i + 1] !== 'number') return null
      out.push(width[i], (width[i + 1] as number) + extra)
    }
    return out
  }
  if (op === 'step' && isZoomInput(width[1]) && typeof width[2] === 'number') {
    const out: unknown[] = ['step', width[1], (width[2] as number) + extra]
    for (let i = 3; i < width.length; i += 2) {
      if (typeof width[i + 1] !== 'number') return null
      out.push(width[i], (width[i + 1] as number) + extra)
    }
    return out
  }
  return null
}

/** Обводка трубы: тот же фильтр, зумы и смещение (подача слева, обратка справа), белая и шире */
export function casingForPipe(layer: StyleSubLayer): StyleSubLayer | null {
  const paint = layer.paint ?? {}
  const width = widenLineWidth(paint['line-width'] ?? 1, CASING_EXTRA_WIDTH_PX)
  if (width == null) return null
  const casingPaint: Record<string, unknown> = {
    'line-color': CASING_COLOR,
    'line-width': width,
    // Прозрачность труб по зуму (распределительные бледнее на z12) повторяем, иначе — постоянная
    'line-opacity': paint['line-opacity'] ?? CASING_OPACITY,
  }
  if (paint['line-offset'] != null) casingPaint['line-offset'] = paint['line-offset']
  const casing: StyleSubLayer = {
    ...layer,
    id: `${CASING_ID_PREFIX}${layer.id ?? 'line'}`,
    // Сплошная, без пунктира: у надземных участков разрывы пунктира остаются белыми
    paint: casingPaint,
  }
  delete casing.metadata
  return casing
}

/**
 * Подслои стиля участков в порядке отрисовки (снизу вверх): подсветка ПТС → обводки → распределительные
 * трубы → магистрали → остальное (подписи) в исходном порядке. Стиль без линий подачи/обратки
 * возвращается как есть.
 */
export function tuneNetworkStyleLayers<T extends StyleSubLayer>(layers: T[]): T[] {
  const pipes = layers.filter(isPipeLineLayer)
  if (pipes.length === 0) return layers
  const highlight = layers.filter(isHighlightLayer)
  const casings = pipes.map(casingForPipe).filter((c): c is StyleSubLayer => c != null) as T[]
  const distribution = pipes.filter((l) => !isMagistralLayer(l))
  const magistral = pipes.filter(isMagistralLayer)
  const rest = layers.filter((l) => !isPipeLineLayer(l) && !isHighlightLayer(l))
  return [...highlight, ...casings, ...distribution, ...magistral, ...rest]
}
