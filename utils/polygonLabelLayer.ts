/**
 * Слой подписей полигонов по точкам в середине объектов (utils/polygonLabelPoints.ts).
 *
 * Подписи рисуются из GeoJSON-источника точек; точки пересчитываются из загруженных векторных
 * тайлов после сдвига карты и догрузки тайлов — пока подписи видны (зум слоя, видимость).
 */
import type { Map as MapLibreMap } from 'maplibre-gl'
import { computeLabelPoints, type LabelPieceInput } from '~/utils/polygonLabelPoints'

interface Controller {
  layerIds: Set<string>
  detach: () => void
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const registry = new WeakMap<MapLibreMap, Map<string, Controller>>()

/** id GeoJSON-источника точек подписей векторного источника */
export const labelPointsSourceId = (vectorSourceId: string, sourceLayer: string): string =>
  `${vectorSourceId}--labelpts--${sourceLayer}`

const toPiece = (f: any): LabelPieceInput => {
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
