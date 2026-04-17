import type { Map as MapLibreMap } from 'maplibre-gl'

/**
 * MapLibre symbol layers may render text only, icons only, or both.
 * Setting icon-opacity on a text-only bucket triggers internal errors
 * ("Length of new data is N, which doesn't match current length of 0") during placement/redraw.
 */
function layoutPropertyActive(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false
  if (typeof value === 'string') return value.length > 0
  if (Array.isArray(value)) {
    if (value.length === 0) return false
    if (value[0] === 'literal') {
      const lit = value[1]
      return lit !== '' && lit !== false && lit != null
    }
    return true
  }
  return true
}

export function setMapSubLayerOpacity(map: MapLibreMap, subId: string, opacity: number): void {
  try {
    const layer = map.getLayer(subId)
    if (!layer) return

    const type = layer.type
    if (type === 'line') {
      map.setPaintProperty(subId, 'line-opacity', opacity)
      return
    }
    if (type === 'fill') {
      map.setPaintProperty(subId, 'fill-opacity', opacity)
      return
    }
    if (type === 'circle') {
      map.setPaintProperty(subId, 'circle-opacity', opacity)
      return
    }
    if (type !== 'symbol') return

    let hasText = false
    let hasIcon = false
    try {
      hasText = layoutPropertyActive(map.getLayoutProperty(subId, 'text-field'))
    } catch {
      hasText = false
    }
    try {
      hasIcon = layoutPropertyActive(map.getLayoutProperty(subId, 'icon-image'))
    } catch {
      hasIcon = false
    }

    if (hasText) map.setPaintProperty(subId, 'text-opacity', opacity)
    if (hasIcon) map.setPaintProperty(subId, 'icon-opacity', opacity)
  } catch (e) {
    if (import.meta.dev) console.warn('[setMapSubLayerOpacity]', subId, e)
  }
}
