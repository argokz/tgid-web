/**
 * Адреса векторных тайлов GeoServer.
 *
 * Тайлы через WMS GetMap GeoServer строит заново на каждый запрос (SQL view на каждый тайл).
 * Если у слоя в GeoWebCache настроена сетка EPSG:900913 и формат MVT, тайлы берутся из кеша
 * GWC через WMTS рабочей области (`/<ws>/gwc/service/wmts`: общий `/geoserver/gwc/` nginx
 * кеширует на час, а данные сети меняются). Срок жизни кеша и параметр VIEWPARAMS задаются
 * на GeoServer (scripts/geoserver/gwc_mvt_cache.py).
 */

export const GWC_MVT_GRIDSET = 'EPSG:900913'
export const MVT_FORMAT = 'application/vnd.mapbox-vector-tile'

const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])

/** Слой WMTS GetCapabilities (fast-xml-parser) отдаёт MVT в сетке EPSG:900913 */
export function wmtsLayerHasGwcMvt(wmtsLayer: any): boolean {
  if (!wmtsLayer) return false
  const formats = asArray(wmtsLayer.Format).map(String)
  if (!formats.includes(MVT_FORMAT)) return false
  return asArray(wmtsLayer.TileMatrixSetLink).some((link: any) => String(link?.TileMatrixSet ?? '') === GWC_MVT_GRIDSET)
}

/**
 * Границы слоя из WMTS GetCapabilities (ows:WGS84BoundingBox) — [west, south, east, north].
 * Кеш GWC за ними отвечает 400 TileOutOfRange (WMS отдавал пустой тайл): карте их запрашивать незачем.
 */
export function wmtsLayerBounds(wmtsLayer: any): [number, number, number, number] | null {
  const box = wmtsLayer?.['ows:WGS84BoundingBox']
  const lower = String(box?.['ows:LowerCorner'] ?? '').trim().split(/\s+/).map(Number)
  const upper = String(box?.['ows:UpperCorner'] ?? '').trim().split(/\s+/).map(Number)
  if (lower.length !== 2 || upper.length !== 2 || ![...lower, ...upper].every(Number.isFinite)) return null
  const [w, s] = lower
  const [e, n] = upper
  if (w >= e || s >= n) return null
  return [w, s, e, n]
}

/** Уровень, по пределам которого считаются границы сетки (тайл ~10 км — точности хватает) */
const GRID_BOUNDS_ZOOM = 12

const tileLat = (row: number, z: number) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / 2 ** z))) * 180) / Math.PI

/**
 * Где кеш GWC отдаёт тайлы — по пределам сетки EPSG:900913 (TileMatrixSetLimits) в WMTS
 * GetCapabilities: [west, south, east, north]; null — по всему миру (тогда границ у источника нет).
 * Пределов нет — границы слоя (wmtsLayerBounds), как раньше.
 *
 * Пределы задаёт охват сетки тайлового слоя (gridSubset): по умолчанию — границы слоя, посчитанные
 * при публикации, и тогда новый фрагмент за ними не виден, пока их не пересчитать. С охватом «весь мир»
 * (scripts/geoserver/gwc_mvt_cache.py) карта запрашивает тайлы везде — без пересчётов.
 */
export function wmtsLayerGridBounds(wmtsLayer: any): [number, number, number, number] | null {
  const link = asArray(wmtsLayer?.TileMatrixSetLink).find((l: any) => String(l?.TileMatrixSet ?? '') === GWC_MVT_GRIDSET)
  const limits = asArray(link?.TileMatrixSetLimits?.TileMatrixLimits)
  const byZoom = new Map<number, any>()
  for (const lim of limits) {
    const z = Number(String(lim?.TileMatrix ?? '').split(':').pop())
    if (Number.isInteger(z)) byZoom.set(z, lim)
  }
  const zooms = [...byZoom.keys()].filter((z) => z <= GRID_BOUNDS_ZOOM).sort((a, b) => b - a)
  if (!zooms.length) return wmtsLayerBounds(wmtsLayer)
  const z = zooms[0]!
  const lim = byZoom.get(z)
  const [r0, r1, c0, c1] = ['MinTileRow', 'MaxTileRow', 'MinTileCol', 'MaxTileCol'].map((k) => Number(lim?.[k]))
  if (![r0, r1, c0, c1].every(Number.isInteger) || r0! > r1! || c0! > c1!) return wmtsLayerBounds(wmtsLayer)
  const n = 2 ** z
  if (r0 === 0 && c0 === 0 && r1 === n - 1 && c1 === n - 1) return null
  return [(c0! / n) * 360 - 180, tileLat(r1! + 1, z), ((c1! + 1) / n) * 360 - 180, tileLat(r0!, z)]
}

/** Шаблон XYZ-тайла MVT из кеша GWC (WMTS рабочей области) */
export function gwcMvtTileUrl(baseUrl: string, workspace: string, layerName: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}/${encodeURIComponent(workspace)}/gwc/service/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile`
    + `&LAYER=${encodeURIComponent(layerName)}&STYLE=&TILEMATRIXSET=${GWC_MVT_GRIDSET}`
    + `&TILEMATRIX=${GWC_MVT_GRIDSET}:{z}&TILEROW={y}&TILECOL={x}&FORMAT=${MVT_FORMAT}`
}

/** Объединить поля подписей `a:on;b:on` нескольких слоёв одного источника тайлов (без повторов, порядок сохраняется) */
export function mergeViewparamFields(parts: string[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    for (const item of String(part || '').split(';')) {
      const v = item.trim()
      if (v && !seen.has(v)) {
        seen.add(v)
        out.push(v)
      }
    }
  }
  return out.join(';')
}

/**
 * Версия данных в VIEWPARAMS: после расчёта или правки сети тайлы запрашиваются с новой версией,
 * и кеш GWC (ключ — VIEWPARAMS) их не отдаёт. SQL view GeoServer незнакомый параметр не использует.
 */
export function withTileRevision(viewparams: string, revision: number): string {
  if (!revision) return viewparams
  const sep = viewparams && !viewparams.endsWith(';') ? ';' : ''
  return `${viewparams}${sep}rev:${revision};`
}

/**
 * Версия данных сервера («12345» — сумма счётчиков изменений таблиц) → число для rev в VIEWPARAMS.
 * Не число (или больше 2^53) — хеш строки, чтобы разные версии давали разные адреса тайлов.
 */
export function dataVersionRevision(version: string): number {
  const n = Number(version)
  if (Number.isSafeInteger(n) && n > 0) return n
  let h = 0
  for (let i = 0; i < version.length; i++) h = (h * 31 + version.charCodeAt(i)) >>> 0
  return h || 1
}

/** URL источника тайлов с VIEWPARAMS (шаблон {z}/{x}/{y} не кодируется) */
export function tileUrlWithViewparams(baseUrl: string, viewparams: string): string {
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}viewparams=${viewparams}`
}
