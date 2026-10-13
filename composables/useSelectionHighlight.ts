import { getCurrentInstance, onBeforeUnmount } from 'vue'
import { isStyleMutable } from '~/services/mapService'
import {
  highlightData,
  highlightLayers,
  mergeGeometries,
  type HighlightTarget,
} from '~/utils/selectionHighlight'

/**
 * Оверлей подсветки (выбранный объект или объект под курсором): один GeoJSON-источник и его слои
 * поверх карты. Обновление — setData, без пересоздания слоёв (подсветка под курсором меняется часто).
 */
export function useSelectionHighlight(getMap: () => any, prefix: string, kind: 'selection' | 'hover') {
  const sourceId = `${prefix}-src`
  const layers = highlightLayers(prefix, kind)

  /** Все куски объекта в источнике (участок разрезан по тайлам); не нашлось — исходная геометрия */
  const fullGeometry = (map: any, target: HighlightTarget) => {
    if (target.source && target.featureId !== undefined && target.featureId !== null && map.getSource(target.source)) {
      try {
        const parts = map.querySourceFeatures(target.source, {
          sourceLayer: target.sourceLayer || undefined,
          filter: ['==', ['id'], target.featureId],
        })
        const merged = mergeGeometries(parts.map((f: any) => f.geometry))
        if (merged) return merged
      } catch {
        // источник без id у объектов — остаётся исходная геометрия
      }
    }
    return target.geometry
  }

  const ensure = (map: any) => {
    if (!map.getSource(sourceId)) map.addSource(sourceId, { type: 'geojson', data: highlightData(null) })
    for (const layer of layers) {
      if (!map.getLayer(layer.id)) map.addLayer({ ...layer, source: sourceId })
      // Слои сети могли переупорядочиться (updateLayerOrder) — подсветка всегда сверху
      else map.moveLayer(layer.id)
    }
  }

  const show = (target: HighlightTarget | null) => {
    const map = getMap()
    if (!map || !isStyleMutable(map)) return
    try {
      const geometry = target?.geometry ? fullGeometry(map, target) : null
      if (!geometry && !map.getSource(sourceId)) return
      ensure(map)
      map.getSource(sourceId).setData(highlightData(geometry))
    } catch {
      // стиль перезагружается — подсветка появится при следующем выборе
    }
  }

  const clear = () => show(null)

  const remove = () => {
    const map = getMap()
    if (!map) return
    for (const layer of [...layers].reverse()) {
      if (map.getLayer(layer.id)) map.removeLayer(layer.id)
    }
    if (map.getSource(sourceId)) map.removeSource(sourceId)
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      try {
        remove()
      } catch {
        // карта уже уничтожена
      }
    })
  }

  return { show, clear, remove, layerIds: layers.map((l) => l.id), sourceId }
}
