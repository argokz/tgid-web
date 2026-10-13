import type { Map } from 'maplibre-gl'
import {
  getMapTilerKey,
  getMapTilerContoursTilesUrl,
  getMapTilerBuildingsTilesUrl,
  getMapTilerHillshadeTilesUrl,
  getMapTilerTerrainRgbTilesUrl,
} from '~/utils/maptiler'
import { reorderPlanetBaseLayersOnMap } from '~/utils/planetV4Layers'
import { BUILDING_FILTER, BUILDING_OPACITY, buildingExtrusionPaint } from '~/utils/buildingStyle'

/** Логические ключи для UI и localStorage */
export type ContextLayerKey = 'contours' | 'buildings' | 'hillshade' | 'terrain3d'

export const CONTEXT_LAYER_ORDER: ContextLayerKey[] = ['contours', 'buildings', 'hillshade', 'terrain3d']

export const BASE_MAP_LAYER_ID = 'base-layer'

export const CONTEXT_SOURCE_IDS = {
  contours: 'context-contours-src',
  buildings: 'context-buildings-src',
  hillshade: 'context-hillshade-src',
  terrain3d: 'context-terrain-rgb-src',
} as const

/** Id слоёв MapLibre (для identify / moveLayer) */
export const CONTEXT_MAP_LAYER_IDS = {
  contours: 'context-contours-line',
  /** Подписи высот на основных изолиниях (каждая 5-я и 10-я) */
  contoursLabel: 'context-contours-label',
  /**
   * Объёмы зданий. С рельефом 3D MapLibre натягивает плоские слои (линии сети) на поверхность и рисует
   * объёмы поверх — здания тогда полупрозрачные, чтобы трубы под ними оставались видны.
   */
  buildings: 'context-buildings-fill',
  /** Названия зданий (слой building_label тех же тайлов) */
  buildingsLabel: 'context-buildings-label',
  hillshade: 'context-hillshade',
} as const

/** Подслои ключа панели «Контекст» (видимость включается вместе) */
const CONTEXT_KEY_LAYERS: Record<Exclude<ContextLayerKey, 'terrain3d'>, string[]> = {
  contours: [CONTEXT_MAP_LAYER_IDS.contours, CONTEXT_MAP_LAYER_IDS.contoursLabel],
  buildings: [CONTEXT_MAP_LAYER_IDS.buildings, CONTEXT_MAP_LAYER_IDS.buildingsLabel],
  hillshade: [CONTEXT_MAP_LAYER_IDS.hillshade],
}

const ALL_CONTEXT_MAP_LAYER_ID_SET = new Set<string>(Object.values(CONTEXT_MAP_LAYER_IDS))

export function getAllContextMapLayerIds(): string[] {
  return [...ALL_CONTEXT_MAP_LAYER_ID_SET]
}

export function isContextMapLayerId(id: string): boolean {
  return ALL_CONTEXT_MAP_LAYER_ID_SET.has(id)
}

/**
 * Идемпотентно добавляет источники и слои контекста (порядок снизу вверх: hillshade, изолинии, здания).
 */
export function ensureContextMapLayers(map: Map): boolean {
  const key = getMapTilerKey()
  if (!key) return false

  const contoursUrl = getMapTilerContoursTilesUrl()
  const buildingsUrl = getMapTilerBuildingsTilesUrl()
  const hillshadeUrl = getMapTilerHillshadeTilesUrl()
  const terrainRgbUrl = getMapTilerTerrainRgbTilesUrl()

  if (!map.getSource(CONTEXT_SOURCE_IDS.contours)) {
    map.addSource(CONTEXT_SOURCE_IDS.contours, {
      type: 'vector',
      tiles: [contoursUrl],
      minzoom: 9,
      // contours are available only for z9-z14
      maxzoom: 14,
    })
  }

  if (!map.getLayer(CONTEXT_MAP_LAYER_IDS.contours)) {
    map.addLayer({
      id: CONTEXT_MAP_LAYER_IDS.contours,
      type: 'line',
      source: CONTEXT_SOURCE_IDS.contours,
      'source-layer': 'contour',
      minzoom: 9,
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#8b7355',
        // Основные изолинии (каждая 5-я и 10-я, nth_line ≥ 5) толще — по ним подписи высот
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          10, ['case', ['>=', ['get', 'nth_line'], 5], 0.9, 0.35],
          14, ['case', ['>=', ['get', 'nth_line'], 5], 1.8, 0.8],
          18, ['case', ['>=', ['get', 'nth_line'], 5], 2.4, 1.2],
        ],
        'line-opacity': 0.75,
      },
    })
  }

  if (!map.getLayer(CONTEXT_MAP_LAYER_IDS.contoursLabel)) {
    map.addLayer({
      id: CONTEXT_MAP_LAYER_IDS.contoursLabel,
      type: 'symbol',
      source: CONTEXT_SOURCE_IDS.contours,
      'source-layer': 'contour',
      minzoom: 12,
      filter: ['>=', ['get', 'nth_line'], 5],
      layout: {
        visibility: 'none',
        'symbol-placement': 'line',
        'text-field': ['concat', ['to-string', ['get', 'height']], ' м'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 12],
        'symbol-spacing': 320,
        'text-max-angle': 30,
        'text-padding': 4,
      },
      paint: {
        'text-color': '#6b5236',
        'text-halo-color': 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.6,
      },
    })
  }

  if (!map.getSource(CONTEXT_SOURCE_IDS.buildings)) {
    map.addSource(CONTEXT_SOURCE_IDS.buildings, {
      type: 'vector',
      tiles: [buildingsUrl],
      minzoom: 0,
      // buildings are available for z0-z15
      maxzoom: 15,
    })
  }

  if (!map.getLayer(CONTEXT_MAP_LAYER_IDS.buildings)) {
    map.addLayer({
      id: CONTEXT_MAP_LAYER_IDS.buildings,
      type: 'fill-extrusion',
      source: CONTEXT_SOURCE_IDS.buildings,
      'source-layer': 'building',
      minzoom: 13,
      filter: BUILDING_FILTER,
      layout: { visibility: 'none' },
      // Высота (height) в тайлах только с z15, до этого — условная; цвет — по назначению (class)
      paint: buildingExtrusionPaint(buildingsOpacity(Boolean(map.getTerrain()))) as any,
    })
  }

  if (!map.getLayer(CONTEXT_MAP_LAYER_IDS.buildingsLabel)) {
    map.addLayer({
      id: CONTEXT_MAP_LAYER_IDS.buildingsLabel,
      type: 'symbol',
      source: CONTEXT_SOURCE_IDS.buildings,
      // Названия — в отдельном слое тайлов зданий (в building их нет); rank — важность
      'source-layer': 'building_label',
      minzoom: 15,
      layout: {
        visibility: 'none',
        'symbol-placement': 'point',
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
        'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 15, 11, 18, 13],
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
        'text-max-width': 9,
        'text-padding': 3,
      },
      paint: {
        'text-color': '#3a3f4b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.6,
      },
    })
  }

  if (!map.getSource(CONTEXT_SOURCE_IDS.hillshade)) {
    map.addSource(CONTEXT_SOURCE_IDS.hillshade, {
      type: 'raster',
      tiles: [hillshadeUrl],
      tileSize: 256,
      minzoom: 0,
      // hillshading is available for z0-z12
      maxzoom: 12,
    })
  }

  if (!map.getLayer(CONTEXT_MAP_LAYER_IDS.hillshade)) {
    map.addLayer({
      id: CONTEXT_MAP_LAYER_IDS.hillshade,
      type: 'raster',
      source: CONTEXT_SOURCE_IDS.hillshade,
      layout: { visibility: 'none' },
      paint: {
        'raster-opacity': 0.42,
      },
    })
  }

  if (!map.getSource(CONTEXT_SOURCE_IDS.terrain3d)) {
    map.addSource(CONTEXT_SOURCE_IDS.terrain3d, {
      type: 'raster-dem',
      tiles: [terrainRgbUrl],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 14,
      encoding: 'mapbox',
    })
  }

  return true
}

/**
 * Держит блок контекста сразу над base-layer и под первым прочим слоем.
 */
function isBasemapLayerId(id: string): boolean {
  return id === BASE_MAP_LAYER_ID || id.startsWith('base-planet-')
}

/**
 * Id слоя, перед которым должен заканчиваться стек Planet v4: самый «низкий» в стиле среди
 * контекстных слоёв и любых прочих (MVT и т.д.) — чтобы подложка всегда была под всем этим блоком.
 */
export function getPlanetLayersInsertBeforeId(map: Map): string | undefined {
  const layers = map.getStyle()?.layers
  if (!layers?.length) return undefined

  const candidates: string[] = []
  for (const l of layers) {
    if (isBasemapLayerId(l.id)) continue
    candidates.push(l.id)
  }
  if (candidates.length === 0) return undefined

  let bestIdx = layers.length
  let bestId: string | undefined
  for (const id of candidates) {
    const idx = layers.findIndex((l) => l.id === id)
    if (idx >= 0 && idx < bestIdx) {
      bestIdx = idx
      bestId = id
    }
  }
  return bestId
}

/**
 * Переносит все слои MapTiler Planet v4 сразу над base-layer и строго под контекстом / рабочими слоями,
 * с фиксированным порядком наложения (подписи и границы выше дорог и заливок).
 */
export function restackPlanetLayersBelowOverlays(map: Map): void {
  const insertBefore = getPlanetLayersInsertBeforeId(map)
  reorderPlanetBaseLayersOnMap(map, insertBefore)
}

export function restackContextMapLayers(map: Map): void {
  const style = map.getStyle()
  if (!style?.layers?.length) return

  const ids = CONTEXT_MAP_LAYER_IDS
  if (!Object.values(ids).every((id) => map.getLayer(id))) return

  const baseIdx = style.layers.findIndex((l) => l.id === BASE_MAP_LAYER_ID)
  if (baseIdx < 0) return

  /**
   * Первый слой над подложкой (base + planet), не входящий в блок контекста —
   * перед ним заканчивается стек контекста: hillshade → изолинии → подписи высот → здания → названия.
   * Так экструзия и подписи остаются поверх Planet V4 и затенения, но под рабочими MVT.
   */
  const anchorLayer = style.layers.slice(baseIdx + 1).find(
    (l) => !ALL_CONTEXT_MAP_LAYER_ID_SET.has(l.id) && !l.id.startsWith('base-planet-')
  )
  const beforeId = anchorLayer?.id

  try {
    if (beforeId !== undefined) {
      map.moveLayer(ids.buildingsLabel, beforeId)
    } else {
      map.moveLayer(ids.buildingsLabel)
    }
    map.moveLayer(ids.buildings, ids.buildingsLabel)
    map.moveLayer(ids.contoursLabel, ids.buildings)
    map.moveLayer(ids.contours, ids.contoursLabel)
    map.moveLayer(ids.hillshade, ids.contours)
  } catch (e) {
    console.warn('[contextMapLayers] restackContextMapLayers:', e)
  }
}

/** Прозрачность объёмов зданий: с рельефом 3D сеть натянута на рельеф, и здания закрывали бы её */
export function buildingsOpacity(terrainOn: boolean): number {
  return terrainOn ? BUILDING_OPACITY.terrain : BUILDING_OPACITY.flat
}

/** Подслои MapLibre ключа панели «Контекст» (рельеф 3D — не слой, а terrain карты) */
export function contextKeyLayerIds(key: ContextLayerKey): string[] {
  return key === 'terrain3d' ? [] : CONTEXT_KEY_LAYERS[key]
}

export function setContextLayerVisibility(map: Map, layerKey: ContextLayerKey, visible: boolean): void {
  if (layerKey === 'terrain3d') {
    if (!map.getSource(CONTEXT_SOURCE_IDS.terrain3d)) return
    if (visible) {
      map.setTerrain({
        source: CONTEXT_SOURCE_IDS.terrain3d,
        exaggeration: 1,
      })
    } else {
      map.setTerrain(null)
    }
    if (map.getLayer(CONTEXT_MAP_LAYER_IDS.buildings)) {
      map.setPaintProperty(CONTEXT_MAP_LAYER_IDS.buildings, 'fill-extrusion-opacity', buildingsOpacity(visible))
    }
    return
  }
  for (const id of contextKeyLayerIds(layerKey)) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  }
}

export function applyContextLayersVisibility(map: Map, visibleKeys: Set<ContextLayerKey>): void {
  for (const k of CONTEXT_LAYER_ORDER) {
    setContextLayerVisibility(map, k, visibleKeys.has(k))
  }
}
