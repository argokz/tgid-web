/**
 * Ленивая загрузка maplibre-gl — отдельный async-чанк, сторы не тянут GL в начальный бандл.
 */
type MapLibreModule = typeof import('maplibre-gl')

let cached: MapLibreModule | null = null
let loading: Promise<MapLibreModule> | null = null

export async function getMaplibreDefault(): Promise<MapLibreModule> {
  if (cached) return cached
  if (!loading) {
    loading = import('maplibre-gl').then((m) => {
      cached = ((m as unknown as { default?: MapLibreModule }).default || m)
      return cached
    })
  }
  return loading
}
