/**
 * Подсветка объекта сети на карте: выбранного (карточка открыта) и под курсором.
 *
 * Раньше выбранный участок или узел на карте ничем не выделялся — найти его под открытой карточкой
 * было трудно. Подсветка — GeoJSON-оверлей поверх слоёв сети: у линии ореол и яркая ось, у узла кольцо.
 * Участок в MVT разрезан по тайлам, поэтому геометрия собирается из всех кусков объекта в источнике.
 */

export interface HighlightTarget {
  geometry: { type: string; coordinates: any } | null
  /** Источник MapLibre, слой тайла и id объекта в тайле — чтобы собрать все куски участка */
  source?: string
  sourceLayer?: string
  featureId?: string | number
}

/** Координаты похожи на долготу/широту (у WMS GetFeatureInfo геометрия бывает в метрах EPSG:3857) */
export function isLngLatGeometry(geometry: { type: string; coordinates: any } | null | undefined): boolean {
  if (!geometry?.coordinates) return false
  let pos: any = geometry.coordinates
  while (Array.isArray(pos) && Array.isArray(pos[0])) pos = pos[0]
  return Array.isArray(pos) && pos.length >= 2 && Math.abs(pos[0]) <= 180 && Math.abs(pos[1]) <= 90
}

/** Куски одного объекта (линия по тайлам) → одна геометрия; точки — первая */
export function mergeGeometries(parts: Array<{ type: string; coordinates: any }>): { type: string; coordinates: any } | null {
  const lines: any[] = []
  for (const g of parts) {
    if (!g?.coordinates) continue
    if (g.type === 'Point' || g.type === 'MultiPoint' || g.type === 'Polygon' || g.type === 'MultiPolygon') return g
    if (g.type === 'LineString') lines.push(g.coordinates)
    else if (g.type === 'MultiLineString') lines.push(...g.coordinates)
  }
  if (!lines.length) return null
  return lines.length === 1 ? { type: 'LineString', coordinates: lines[0] } : { type: 'MultiLineString', coordinates: lines }
}

export function highlightData(geometry: { type: string; coordinates: any } | null) {
  return {
    type: 'FeatureCollection',
    features: geometry && isLngLatGeometry(geometry) ? [{ type: 'Feature', properties: {}, geometry }] : [],
  }
}

const isLine = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false]
const isPoint = ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false]
const isArea = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false]

/** Слои подсветки: выбранный — яркий бирюзовый, под курсором — спокойный жёлтый ореол */
export function highlightLayers(prefix: string, kind: 'selection' | 'hover') {
  const color = kind === 'selection' ? '#00c8ff' : '#ffc400'
  const width = (k: number) => ['interpolate', ['linear'], ['zoom'], 12, 4 * k, 16, 8 * k, 20, 14 * k]
  const layers: Array<{ id: string; type: string; [key: string]: any }> = [
    {
      id: `${prefix}-halo`,
      type: 'line',
      filter: ['any', isLine, isArea],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-opacity': kind === 'selection' ? 0.35 : 0.3, 'line-width': width(kind === 'selection' ? 1.6 : 1.2), 'line-blur': 2 },
    },
    {
      id: `${prefix}-point`,
      type: 'circle',
      filter: isPoint,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 7, 16, 11, 20, 16],
        'circle-color': color,
        'circle-opacity': kind === 'selection' ? 0.25 : 0.2,
        'circle-stroke-color': color,
        'circle-stroke-width': kind === 'selection' ? 2.5 : 1.5,
      },
    },
  ]
  if (kind === 'selection') {
    layers.splice(1, 0, {
      id: `${prefix}-line`,
      type: 'line',
      filter: ['any', isLine, isArea],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.5, 16, 2.5, 20, 4] },
    })
  }
  return layers
}

/** Ключ объекта под курсором — чтобы не перерисовывать подсветку на каждом движении мыши */
export function highlightKey(target: HighlightTarget | null): string {
  if (!target?.geometry) return ''
  if (target.featureId !== undefined && target.featureId !== null) return `${target.source}|${target.sourceLayer}|${target.featureId}`
  return JSON.stringify(target.geometry.coordinates).slice(0, 200)
}
