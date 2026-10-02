/**
 * Composable для работы с Nominatim API (поиск адресов OpenStreetMap)
 */

export interface NominatimResult {
  place_id: number
  licence: string
  osm_type: string
  osm_id: number
  boundingbox: [string, string, string, string]
  lat: string
  lon: string
  display_name: string
  class: string
  type: string
  importance: number
  icon?: string
}

/** Охват Алматы [minLon, minLat, maxLon, maxLat] — поиск адреса по умолчанию только в городе (QA F25) */
export const ALMATY_BBOX: [number, number, number, number] = [76.70, 43.05, 77.25, 43.45]

/** URL поиска Nominatim, ограниченный охватом (viewbox + bounded=1) */
export const nominatimSearchUrl = (query: string, bbox: [number, number, number, number] = ALMATY_BBOX): string =>
  `https://nominatim.openstreetmap.org/search?` +
  `format=json&` +
  `q=${encodeURIComponent(query)}&` +
  `limit=10&` +
  `addressdetails=1&` +
  `countrycodes=kz&` +
  `viewbox=${bbox.join(',')}&` +
  `bounded=1`

export const useNominatim = () => {
  const searchAddress = async (query: string, bbox: [number, number, number, number] = ALMATY_BBOX): Promise<NominatimResult[]> => {
    if (typeof window === 'undefined') return []
    if (!query || query.trim().length < 3) return []

    const url = nominatimSearchUrl(query, bbox)

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'web-itwin-map/1.0' }
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      console.error('Nominatim search error:', error)
      return []
    }
  }

  const reverseGeocode = async (lat: number, lon: number): Promise<NominatimResult | null> => {
    if (typeof window === 'undefined') return null
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'web-itwin-map/1.0' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      console.error('Nominatim reverse error:', error)
      return null
    }
  }

  return { searchAddress, reverseGeocode }
}
