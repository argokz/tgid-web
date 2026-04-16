/**
 * Ленивая загрузка maplibre-gl — отдельный async-чанк, сторы не тянут GL в начальный бандл.
 */
let cached: typeof import('maplibre-gl').default | null = null
let loading: Promise<typeof import('maplibre-gl').default> | null = null

export async function getMaplibreDefault(): Promise<typeof import('maplibre-gl').default> {
  if (cached) return cached
  if (!loading) {
    loading = import('maplibre-gl').then((m) => {
      cached = m.default
      return cached
    })
  }
  return loading
}
