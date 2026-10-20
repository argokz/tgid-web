/**
 * Слой подписей полигонов по точкам в середине объектов (utils/polygonLabelPoints.ts).
 *
 * Подписи рисуются из GeoJSON-источника точек; точки пересчитываются из загруженных векторных
 * тайлов после сдвига карты и догрузки тайлов — пока подписи видны (зум слоя, видимость).
 */
import type { Map as MapLibreMap } from 'maplibre-gl'
import {
  computeLabelPoints, LABEL_AREA_PROP, LABEL_FIT_SUFFIX, LABEL_MID_SUFFIX, LABEL_SHORT_SUFFIX, LABEL_WIDE_SUFFIX,
  type LabelPieceInput,
} from '~/utils/polygonLabelPoints'

interface Controller {
  layerIds: Set<string>
  detach: () => void
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const registry = new WeakMap<MapLibreMap, Map<string, Controller>>()

/** id GeoJSON-источника точек подписей векторного источника */
export const labelPointsSourceId = (vectorSourceId: string, sourceLayer: string): string =>
  `${vectorSourceId}--labelpts--${sourceLayer}`

/** Пикселей на метр меркатора на нулевом зуме (тайл 512) */
const PX_PER_MERC_M_Z0 = 1 / 78271.51696402048
/** Подпись может выйти за стены дома не больше чем на столько (доля размера) */
const FIT_TOLERANCE = 1.15
/** С этого зума показываются все данные (целиком или в три строки), с FULL_ZOOM — целиком всегда */
const ALL_DATA_ZOOM = 19
const FULL_ZOOM = 20

/** Значение размера шрифта на зуме: число или interpolate linear / stops по зуму */
export function zoomValue(value: any, zoom: number, fallback = 12): number {
  if (typeof value === 'number') return value
  let stops: Array<[number, number]> | null = null
  if (Array.isArray(value) && value[0] === 'interpolate' && Array.isArray(value[2]) && value[2][0] === 'zoom') {
    stops = []
    for (let i = 3; i + 1 < value.length; i += 2) stops.push([value[i], value[i + 1]])
  } else if (value && Array.isArray(value.stops)) {
    stops = value.stops
  }
  if (!stops?.length || !stops.every(s => typeof s[0] === 'number' && typeof s[1] === 'number')) return fallback
  if (zoom <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    const [z1, v1] = stops[i]
    if (zoom <= z1) {
      const [z0, v0] = stops[i - 1]
      return v0 + (v1 - v0) * (zoom - z0) / (z1 - z0)
    }
  }
  return stops[stops.length - 1][1]
}

/**
 * Раскладка подписи по точкам: без наложений (подписи, которым нет места, скрываются; первыми —
 * крупные дома). Многострочная подпись на каждом зуме — самый полный вариант, который помещается
 * в своём доме (textFit в polygonLabelPoints): целиком → все данные в три строки → адрес и Qсум →
 * Qсум. Так подпись не наезжает на соседний дом и ясно, к какому дому она относится; крупные дома
 * получают все данные раньше. С 19-го зума — все данные всегда, с 20-го — целиком.
 */
export function interiorLabelLayout(layout: Record<string, any>, minzoom = 16): Record<string, any> {
  const out: Record<string, any> = {
    ...layout,
    'text-allow-overlap': false,
    'text-ignore-placement': false,
    'text-padding': 2,
    'text-max-width': 30,
    'text-line-height': 1.15,
    'symbol-sort-key': ['-', 0, ['coalesce', ['get', LABEL_AREA_PROP], 0]],
  }
  const field = typeof layout['text-field'] === 'string' ? /^\{([^{}]+)\}$/.exec(layout['text-field'].trim())?.[1] : undefined
  if (!field) return out
  const text = (suffix: string): any[] => ['get', field + suffix]
  const fit = (suffix: string): any[] => ['coalesce', ['get', field + suffix + LABEL_FIT_SUFFIX], 0]
  const full = ['coalesce', ['get', field], '']
  // text-field считается на целом зуме тайла z, а виден до z+1 — размер дома берём на z+0,25
  const choose = (z: number): any => {
    const zz = z + 0.25
    const need = Math.round(zoomValue(layout['text-size'], zz) / (PX_PER_MERC_M_Z0 * 2 ** zz * FIT_TOLERANCE) * 100) / 100
    const variants: Array<[string, any]> = [['', full], [LABEL_WIDE_SUFFIX, ['coalesce', text(LABEL_WIDE_SUFFIX), full]]]
    if (z < ALL_DATA_ZOOM) variants.push([LABEL_MID_SUFFIX, ['coalesce', text(LABEL_MID_SUFFIX), full]])
    const fallback = z < ALL_DATA_ZOOM - 1
      ? ['coalesce', text(LABEL_SHORT_SUFFIX), full]
      : z < ALL_DATA_ZOOM ? ['coalesce', text(LABEL_MID_SUFFIX), full] : ['coalesce', text(LABEL_WIDE_SUFFIX), full]
    const expr: any[] = ['case']
    for (const [suffix, value] of variants) expr.push(['>=', fit(suffix), need], value)
    expr.push(fallback)
    return expr
  }
  const z0 = Math.max(0, Math.floor(minzoom))
  const stepExpr: any[] = ['step', ['zoom'], choose(z0)]
  for (let z = z0 + 1; z < FULL_ZOOM; z++) stepExpr.push(z, choose(z))
  stepExpr.push(Math.max(FULL_ZOOM, z0 + 1), full)
  out['text-field'] = stepExpr
  return out
}

const toPiece =(f: any): LabelPieceInput => {
  const vtf = f?._vectorTileFeature
  const tile = vtf && Number.isFinite(vtf._z) ? { z: vtf._z, x: vtf._x, y: vtf._y } : null
  return { id: f.id, properties: f.properties || {}, geometry: f.geometry, tile }
}

/**
 * Источник точек (создаётся при первом вызове) и пересчёт для слоя подписи layerId.
 * → id источника — его ставить слою подписи вместо векторного (без source-layer).
 */
export function attachPolygonLabelPoints(
  map: MapLibreMap,
  opts: { vectorSourceId: string; sourceLayer: string; layerId: string }
): string {
  const sourceId = labelPointsSourceId(opts.vectorSourceId, opts.sourceLayer)
  if (!map.getSource(sourceId)) map.addSource(sourceId, { type: 'geojson', data: EMPTY })
  let byMap = registry.get(map)
  if (!byMap) registry.set(map, (byMap = new Map()))
  const existing = byMap.get(sourceId)
  if (existing) {
    existing.layerIds.add(opts.layerId)
    return sourceId
  }

  const layerIds = new Set([opts.layerId])
  let timer: ReturnType<typeof setTimeout> | null = null
  let hasData = false

  const active = (): boolean => {
    const zoom = map.getZoom()
    for (const id of layerIds) {
      const layer: any = map.getLayer(id)
      if (!layer || map.getLayoutProperty(id, 'visibility') === 'none') continue
      // запас ползума — точки готовы к появлению подписей
      if (zoom >= (layer.minzoom ?? 0) - 0.5 && zoom < (layer.maxzoom ?? 99)) return true
    }
    return false
  }

  const update = () => {
    timer = null
    const source: any = map.getSource(sourceId)
    if (!source || ![...layerIds].some(id => map.getLayer(id))) {
      detach()
      return
    }
    if (!active()) {
      if (hasData) source.setData(EMPTY)
      hasData = false
      return
    }
    const pieces = map.querySourceFeatures(opts.vectorSourceId, { sourceLayer: opts.sourceLayer }).map(toPiece)
    source.setData(computeLabelPoints(pieces))
    hasData = true
  }
  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(update, 120)
  }
  // видимость слоя меняется через стиль; пересчёт — только если подписи появились или скрылись
  const onStyleData = () => {
    if (active() !== hasData) schedule()
  }
  const onSourceData = (e: any) => {
    if (e?.sourceId === opts.vectorSourceId && e.isSourceLoaded) schedule()
  }

  function detach() {
    if (timer) clearTimeout(timer)
    timer = null
    map.off('moveend', schedule)
    map.off('styledata', onStyleData)
    map.off('sourcedata', onSourceData)
    byMap!.delete(sourceId)
  }

  map.on('moveend', schedule)
  map.on('styledata', onStyleData)
  map.on('sourcedata', onSourceData)
  byMap.set(sourceId, { layerIds, detach })
  schedule()
  return sourceId
}
