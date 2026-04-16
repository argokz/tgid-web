import type { Map } from 'maplibre-gl'
import {
  getMapTilerKey,
  getMapTilerContoursTilesUrl,
  getMapTilerBuildingsTilesUrl,
  getMapTilerHillshadeTilesUrl,
  getMapTilerTerrainRgbTilesUrl,
} from '~/utils/maptiler'
import { reorderPlanetBaseLayersOnMap } from '~/utils/planetV4Layers'

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
  buildings: 'context-buildings-fill',
  /** Подписи/номера на 3D-зданиях (тот же vector source, что и extrusion) */
  buildingsLabel: 'context-buildings-label',
  hillshade: 'context-hillshade',
} as const

const ALL_CONTEXT_MAP_LAYER_ID_SET = new Set(Object.values(CONTEXT_MAP_LAYER_IDS))

/** Актуальные paint/layout для подписей 3D-зданий (подхватывается и для уже созданного слоя). */
function refreshContextBuildingsLabelStyle(map: Map): void {
  const id = CONTEXT_MAP_LAYER_IDS.buildingsLabel
  if (!map.getLayer(id)) return
  try {
    map.setLayoutProperty(id, 'text-size', [
      'interpolate', ['linear'], ['zoom'],
      13, 12,
      15, 14,
      17, 16,
      19, 17,
    ])
    map.setLayoutProperty(id, 'text-font', ['Open Sans Bold', 'Arial Unicode MS Regular'])
    map.setLayoutProperty(id, 'text-allow-overlap', true)
    map.setLayoutProperty(id, 'text-ignore-placement', true)
    map.setPaintProperty(id, 'text-color', '#0a0a0a')
    map.setPaintProperty(id, 'text-halo-color', '#ffffff')
    map.setPaintProperty(id, 'text-halo-width', 2.75)
    map.setPaintProperty(id, 'text-halo-blur', 0.35)
    map.setPaintProperty(id, 'text-opacity', 1)
  } catch {
    /* ignore */
  }
}

export function getAllContextMapLayerIds(): string[] {
  return [...ALL_CONTEXT_MAP_LAYER_ID_SET]
}

export function isContextMapLayerId(id: string): boolean {
  return ALL_CONTEXT_MAP_LAYER_ID_SET.has(id)
}

function mapKeyToLayerId(key: ContextLayerKey): string {
  if (key === 'terrain3d') return ''
  return CONTEXT_MAP_LAYER_IDS[key]
}

/**
 * Идемпотентно добавляет источники и слои контекста (порядок снизу вверх: контуры, здания, hillshade).
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
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 14, 1, 18, 1.5],
        'line-opacity': 0.75,
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
      minzoom: 12,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': '#aeb8d8',
        'fill-extrusion-opacity': 0.78,
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 12],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
      },
    })
  }

  if (!map.getLayer(CONTEXT_MAP_LAYER_IDS.buildingsLabel)) {
    map.addLayer({
      id: CONTEXT_MAP_LAYER_IDS.buildingsLabel,
      type: 'symbol',
      source: CONTEXT_SOURCE_IDS.buildings,
      'source-layer': 'building',
      minzoom: 13,
      layout: {
        visibility: 'none',
        'symbol-placement': 'point',
        'text-field': [
          'coalesce',
          ['get', 'housenumber'],
          ['get', 'addr:housenumber'],
          ['get', 'name:ru'],
          ['get', 'name'],
          ['get', 'ref'],
        ],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 12, 15, 14, 17, 16, 19, 17],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Regular'],
        'text-max-angle': 45,
        'text-padding': 2,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#0a0a0a',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.75,
        'text-halo-blur': 0.35,
        'text-opacity': 1,
      },
    })
  }

  refreshContextBuildingsLabelStyle(map)

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

  const contoursId = CONTEXT_MAP_LAYER_IDS.contours
  const buildingsId = CONTEXT_MAP_LAYER_IDS.buildings
  const buildingsLabelId = CONTEXT_MAP_LAYER_IDS.buildingsLabel
  const hillId = CONTEXT_MAP_LAYER_IDS.hillshade

  if (!map.getLayer(contoursId) || !map.getLayer(buildingsId) || !map.getLayer(hillId)) return
  if (!map.getLayer(buildingsLabelId)) return

  const baseIdx = style.layers.findIndex((l) => l.id === BASE_MAP_LAYER_ID)
  if (baseIdx < 0) return

  /**
   * Первый слой над подложкой (base + planet), не входящий в блок контекста —
   * перед ним заканчивается стек контекста: контуры → hillshade → 3D-здания → подписи зданий.
   * Так экструзия и подписи остаются поверх Planet V4 и затенения, но под рабочими MVT.
   */
  const anchorLayer = style.layers.slice(baseIdx + 1).find(
    (l) => !ALL_CONTEXT_MAP_LAYER_ID_SET.has(l.id) && !l.id.startsWith('base-planet-')
  )
  const beforeId = anchorLayer?.id

  try {
    if (beforeId !== undefined) {
      map.moveLayer(buildingsLabelId, beforeId)
    } else {
      map.moveLayer(buildingsLabelId)
    }
    map.moveLayer(buildingsId, buildingsLabelId)
    map.moveLayer(hillId, buildingsId)
    map.moveLayer(contoursId, hillId)
  } catch (e) {
    console.warn('[contextMapLayers] restackContextMapLayers:', e)
  }
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
    return
  }

  if (layerKey === 'buildings') {
    const vis = visible ? 'visible' : 'none'
    for (const lid of [CONTEXT_MAP_LAYER_IDS.buildings, CONTEXT_MAP_LAYER_IDS.buildingsLabel]) {
      if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', vis)
    }
    return
  }

  const id = mapKeyToLayerId(layerKey)
  if (!id) return
  if (!map.getLayer(id)) return
  map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
}

export function applyContextLayersVisibility(map: Map, visibleKeys: Set<ContextLayerKey>): void {
  for (const k of CONTEXT_LAYER_ORDER) {
    setContextLayerVisibility(map, k, visibleKeys.has(k))
  }
}
