/**
 * Единый каталог GeoServer из env GEOSERVER_LAYER_CATALOG:
 * workspace в UI + список слоёв с подписью и режимами MVT / WMS.
 */

export interface GeoCatalogLayerEntry {
  /** Имя слоя в GeoServer (без workspace:) */
  source: string
  /** Подпись в интерфейсе */
  label: string
  /** Векторные тайлы (нужны MBStyle на сервере) */
  mvt?: boolean
  /** Растровый WMS GetMap */
  wms?: boolean
  /** Если оба включены — формат после загрузки */
  defaultRenderFormat?: 'mvt' | 'wms'
}

export interface GeoWorkspaceCatalogEntry {
  id: string
  /** Название схемы в сайдбаре */
  name: string
  /** Базовый URL GeoServer (иначе NUXT_PUBLIC_GEOSERVER_URL) */
  url?: string
  workspace: string
  groupName?: string
  enabled?: boolean
  order?: number
  center?: [number, number]
  zoom?: number
  layers: GeoCatalogLayerEntry[]
}

export function parseGeoserverLayerCatalog(raw: unknown): GeoWorkspaceCatalogEntry[] | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  try {
    const parsed = JSON.parse(s) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const out: GeoWorkspaceCatalogEntry[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const id = String(o.id || o.workspace || '').trim()
      const workspace = String(o.workspace || '').trim()
      if (!id || !workspace) continue
      const name = String(o.name || workspace)
      const layersRaw = o.layers
      if (!Array.isArray(layersRaw) || layersRaw.length === 0) continue
      const layers: GeoCatalogLayerEntry[] = []
      for (const lr of layersRaw) {
        if (!lr || typeof lr !== 'object') continue
        const L = lr as Record<string, unknown>
        const source = String(L.source || '').trim()
        const label = String(L.label || source)
        const mvt = L.mvt === true
        const wms = L.wms === true
        if (!source) continue
        if (!mvt && !wms) continue
        let defaultRenderFormat = L.defaultRenderFormat as string | undefined
        if (defaultRenderFormat !== 'mvt' && defaultRenderFormat !== 'wms') defaultRenderFormat = undefined
        if (defaultRenderFormat === 'mvt' && !mvt) defaultRenderFormat = undefined
        if (defaultRenderFormat === 'wms' && !wms) defaultRenderFormat = undefined
        layers.push({
          source,
          label,
          mvt,
          wms,
          defaultRenderFormat: defaultRenderFormat as 'mvt' | 'wms' | undefined
        })
      }
      if (layers.length === 0) continue
      out.push({
        id,
        name,
        url: o.url ? String(o.url).replace(/\/$/, '') : undefined,
        workspace,
        groupName: o.groupName != null && String(o.groupName).trim() ? String(o.groupName) : workspace,
        enabled: o.enabled !== false,
        order: typeof o.order === 'number' ? o.order : undefined,
        center: Array.isArray(o.center) && o.center.length === 2
          ? [Number(o.center[0]), Number(o.center[1])]
          : undefined,
        zoom: typeof o.zoom === 'number' ? o.zoom : undefined,
        layers
      })
    }
    return out.length ? out.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)) : null
  } catch {
    return null
  }
}
