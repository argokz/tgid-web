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

export const useNominatim = () => {
  const searchAddress = async (query: string): Promise<NominatimResult[]> => {
    if (typeof window === 'undefined') return []
    if (!query || query.trim().length < 3) return []

    const url = `https://nominatim.openstreetmap.org/search?` +
      `format=json&` +
      `q=${encodeURIComponent(query)}&` +
      `limit=10&` +
      `addressdetails=1&` +
      `countrycodes=kz`

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
