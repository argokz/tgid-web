/**
 * Подложка и слои сети для 3D (Cesium). Cesium не умеет MVT и стиль MapLibre, поэтому:
 * - подложка — растровый XYZ того же провайдера, что выбран в 2D (векторная planet-v4 и
 *   http-подложки без CORS заменяются на растровую MapTiler/OSM);
 * - сеть — WMS GetMap GeoServer по видимым слоям (тот же слой, что MVT/WMS в 2D), с фильтром фрагментов.
 */

export interface BaseLayerLike {
  id: string
  url: string
  maxZoom?: number
}

export interface Cesium3dBaseImagery {
  url: string
  maximumLevel: number
}

/** Подложки, которые Cesium может взять как растр XYZ с CORS */
const RASTER_OK = new Set(['stadia', 'streets-v4', 'hybrid-v4', 'osm'])
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

export function resolve3dBaseImagery(
  selectedId: string | null | undefined,
  layers: BaseLayerLike[],
  mapTilerKey: string
): Cesium3dBaseImagery {
  const byId = (id: string) => layers.find((l) => l.id === id)
  const usable = (l: BaseLayerLike | undefined) =>
    !!l && !!l.url && (!l.url.includes('api.maptiler.com') || !!mapTilerKey)
  let layer = selectedId ? byId(selectedId) : undefined
  if (!layer || !(RASTER_OK.has(layer.id) || layer.id === 'visicom') || !usable(layer)) {
    layer = usable(byId('stadia')) ? byId('stadia') : undefined
  }
  if (!layer) return { url: OSM_URL, maximumLevel: 19 }
  return { url: layer.url.replace(/^http:\/\//, 'https://'), maximumLevel: layer.maxZoom ?? 19 }
}

export interface NetworkLayerLike {
  layerId: string
  sourceLayer: string
  workspace?: string
  workspaceBaseUrl?: string
  zIndex?: number
}

export interface Cesium3dWmsOverlay {
  key: string
  url: string
  layers: string
  cqlFilter?: string
}

/** Видимые слои сети → WMS-оверлеи Cesium, снизу вверх (по zIndex, как в панели слоёв) */
export function buildNetworkWmsOverlays(
  allLayers: NetworkLayerLike[],
  visibleIds: string[],
  visibleFragments: Array<string | number>,
  resolveBaseUrl: (workspace: string, layer: NetworkLayerLike) => string
): Cesium3dWmsOverlay[] {
  const visible = new Set(visibleIds)
  let cqlFilter: string | undefined
  if (visibleFragments.length > 0) {
    const ids = [...new Set(visibleFragments.map((id) => String(id)))]
    cqlFilter = `"fileid" IN (${ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(',')})`
  }
  return allLayers
    .filter((l) => visible.has(l.layerId) && l.sourceLayer)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((l) => {
      const ws = l.workspace || 'AlmatyGIS'
      const name = l.sourceLayer.includes(':') ? l.sourceLayer : `${ws}:${l.sourceLayer}`
      const base = resolveBaseUrl(ws, l).replace(/\/$/, '')
      return { key: `${l.layerId}|${cqlFilter || ''}`, url: `${base}/${ws}/wms`, layers: name, cqlFilter }
    })
}
