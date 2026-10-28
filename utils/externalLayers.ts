/**
 * Внешние слои пользователя: подложки и данные чужих серверов (ГИС «Панорама», ЕЭКО, акиматы,
 * ArcGIS) поверх карты ТГИД. Три вида:
 *   xyz  — шаблон тайлов с {z}/{x}/{y};
 *   wms  — WMS GetMap тайлами 256×256 в EPSG:3857;
 *   wmts — слой из WMTS GetCapabilities, только сетка Web Mercator (GoogleMapsCompatible,
 *          EPSG:3857/900913). Местные системы координат MapLibre не показывает — понятная ошибка.
 * Здесь только чистые функции (проверка адреса, шаблоны, разбор GetCapabilities);
 * карта и хранение — stores/externalLayerStore.ts.
 */
import { XMLParser } from 'fast-xml-parser'

export type ExternalLayerKind = 'xyz' | 'wms' | 'wmts'

export interface ExternalLayer {
  id: string
  kind: ExternalLayerKind
  name: string
  /** адрес сервиса (WMS/WMTS) или шаблон XYZ, как ввёл пользователь */
  url: string
  /** имя слоя на сервере (WMS/WMTS) */
  layer?: string
  /** готовый шаблон тайлов для MapLibre */
  tileUrl: string
  opacity: number
  visible: boolean
  minzoom?: number
  maxzoom?: number
}

export interface ServiceLayerOption {
  name: string
  title: string
  tileUrl: string
  minzoom?: number
  maxzoom?: number
}

export class ExternalLayerError extends Error {}

/** Масштаб уровня 0 сетки Web Mercator (OGC WMTS, GoogleMapsCompatible) */
const GOOGLE_Z0_SCALE = 559082264.0287178
const MERCATOR_EXTENT = 20037508.342789244
const WEB_MERCATOR_CRS = /(EPSG(::|:)?(3857|900913|102100|102113))|GoogleMapsCompatible|GoogleMaps/i

/** Адрес сервиса: только http/https; кавычки и пробелы вокруг убираем. */
export function normalizeServiceUrl(raw: string): string {
  const text = raw.trim().replace(/^["']|["']$/g, '')
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new ExternalLayerError('Это не адрес сервиса. Пример: https://example.kz/geoserver/wms')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ExternalLayerError('Поддерживаются только адреса http:// и https://')
  }
  return url.toString()
}

/** Шаблон XYZ: обязательно {z}, {x}, {y} ({-y} — схема TMS). */
export function xyzTileUrl(raw: string): string {
  const url = normalizeServiceUrl(raw).replace(/%7B/gi, '{').replace(/%7D/gi, '}')
  if (!/\{z\}/.test(url) || !/\{x\}/.test(url) || !/\{-?y\}/.test(url)) {
    throw new ExternalLayerError('В шаблоне XYZ должны быть {z}, {x} и {y}, например https://tile.example.kz/{z}/{x}/{y}.png')
  }
  return url
}

/** Адрес без параметров OGC (SERVICE, REQUEST, …): к нему добавляем свои. */
function serviceBase(raw: string): URL {
  const url = new URL(normalizeServiceUrl(raw))
  for (const key of [...url.searchParams.keys()]) {
    if (/^(service|request|version|layers?|styles?|format|bbox|width|height|srs|crs|transparent|tilematrix\w*|tilerow|tilecol)$/i.test(key)) {
      url.searchParams.delete(key)
    }
  }
  return url
}

export function capabilitiesUrl(raw: string, kind: 'wms' | 'wmts'): string {
  const url = serviceBase(raw)
  url.searchParams.set('SERVICE', kind.toUpperCase())
  url.searchParams.set('REQUEST', 'GetCapabilities')
  return url.toString()
}

/** WMS GetMap тайлами для MapLibre ({bbox-epsg-3857} подставляет сама карта). */
export function wmsTileUrl(raw: string, layer: string, version: '1.1.1' | '1.3.0' = '1.1.1'): string {
  const url = serviceBase(raw)
  const params: Record<string, string> = {
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: version,
    LAYERS: layer,
    STYLES: '',
    FORMAT: 'image/png',
    TRANSPARENT: 'true',
    WIDTH: '256',
    HEIGHT: '256',
    [version === '1.3.0' ? 'CRS' : 'SRS']: 'EPSG:3857',
  }
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  // BBOX — без кодирования фигурных скобок, иначе MapLibre не узнает шаблон
  return `${url.toString()}&BBOX={bbox-epsg-3857}`
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  removeNSPrefix: true,
  isArray: (name) => ['Layer', 'TileMatrixSet', 'TileMatrix', 'TileMatrixSetLink', 'ResourceURL', 'Style', 'CRS', 'SRS', 'Format', 'Get', 'Operation', 'DCP'].includes(name),
})

const text = (v: unknown): string => {
  if (v == null) return ''
  // isArray ниже делает массивом и одиночный элемент (TileMatrixSet внутри TileMatrixSetLink)
  if (Array.isArray(v)) return text(v[0])
  if (typeof v === 'object') return String((v as Record<string, unknown>)['#text'] ?? '')
  return String(v)
}

function parseXml(xml: string): Record<string, any> {
  try {
    return parser.parse(xml)
  } catch {
    throw new ExternalLayerError('Сервер вернул не XML — проверьте адрес сервиса')
  }
}

/** WMS GetCapabilities → слои с именем, у которых есть EPSG:3857 (свой или унаследованный). */
export function parseWmsCapabilities(xml: string, serviceUrl: string): ServiceLayerOption[] {
  const doc = parseXml(xml)
  const root = doc.WMS_Capabilities ?? doc.WMT_MS_Capabilities
  if (!root) throw new ExternalLayerError('Это не ответ WMS GetCapabilities')
  const version: '1.1.1' | '1.3.0' = String(root['@version'] ?? '').startsWith('1.3') ? '1.3.0' : '1.1.1'
  const out: ServiceLayerOption[] = []
  const walk = (layers: any[] | undefined, inheritedCrs: string[]) => {
    for (const layer of layers ?? []) {
      const crs = [...inheritedCrs, ...(layer.CRS ?? []).map(text), ...(layer.SRS ?? []).map(text)]
      const name = text(layer.Name)
      if (name && crs.some((c) => WEB_MERCATOR_CRS.test(c))) {
        out.push({ name, title: text(layer.Title) || name, tileUrl: wmsTileUrl(serviceUrl, name, version) })
      }
      walk(layer.Layer, crs)
    }
  }
  walk(root.Capability?.Layer, [])
  if (!out.length) {
    throw new ExternalLayerError('На сервере нет слоёв в EPSG:3857 (Web Mercator): карта их не покажет')
  }
  return out
}

interface MercatorMatrixSet {
  id: string
  /** zoom → идентификатор матрицы */
  zoomIds: Map<number, string>
}

/** Сетка совместима с картой: Web Mercator, угол (-20037508, 20037508), масштабы — степени двойки. */
function mercatorMatrixSet(set: any): MercatorMatrixSet | null {
  const crs = text(set.SupportedCRS)
  if (!WEB_MERCATOR_CRS.test(crs) && !WEB_MERCATOR_CRS.test(text(set.Identifier))) return null
  const zoomIds = new Map<number, string>()
  for (const m of set.TileMatrix ?? []) {
    const scale = Number(text(m.ScaleDenominator))
    const corner = text(m.TopLeftCorner).trim().split(/\s+/).map(Number)
    if (!(scale > 0) || corner.length !== 2) return null
    const z = Math.log2(GOOGLE_Z0_SCALE / scale)
    if (Math.abs(z - Math.round(z)) > 0.01) return null
    // ось x — восток (у некоторых серверов для 3857 порядок осей y,x)
    const [a, b] = corner
    const okCorner =
      (Math.abs(a + MERCATOR_EXTENT) < 1 && Math.abs(b - MERCATOR_EXTENT) < 1) ||
      (Math.abs(b + MERCATOR_EXTENT) < 1 && Math.abs(a - MERCATOR_EXTENT) < 1)
    if (!okCorner) return null
    zoomIds.set(Math.round(z), text(m.Identifier))
  }
  return zoomIds.size ? { id: text(set.Identifier), zoomIds } : null
}

/** Идентификаторы уровней — «префикс + номер» (0, 1… или EPSG:900913:0…): тогда шаблон {z} работает. */
function zoomPrefix(zoomIds: Map<number, string>): string | null {
  let prefix: string | null = null
  for (const [z, id] of zoomIds) {
    if (!id.endsWith(String(z))) return null
    const p = id.slice(0, id.length - String(z).length)
    if (prefix !== null && p !== prefix) return null
    prefix = p
  }
  return prefix
}

/** WMTS GetCapabilities → слои с сеткой Web Mercator и готовым шаблоном тайлов. */
export function parseWmtsCapabilities(xml: string, serviceUrl: string): ServiceLayerOption[] {
  const doc = parseXml(xml)
  const root = doc.Capabilities
  if (!root?.Contents) throw new ExternalLayerError('Это не ответ WMTS GetCapabilities')
  const sets = new Map<string, MercatorMatrixSet>()
  for (const set of root.Contents.TileMatrixSet ?? []) {
    const ok = mercatorMatrixSet(set)
    if (ok) sets.set(ok.id, ok)
  }
  const getTile = (root.OperationsMetadata?.Operation ?? []).find((op: any) => op['@name'] === 'GetTile')
  const kvpHref = (getTile?.DCP ?? [])
    .flatMap((d: any) => d.HTTP?.Get ?? [])
    .map((g: any) => String(g['@href'] ?? ''))
    .find((h: string) => h) || serviceBase(serviceUrl).toString()

  const out: ServiceLayerOption[] = []
  let anyLayer = false
  for (const layer of root.Contents.Layer ?? []) {
    anyLayer = true
    const name = text(layer.Identifier)
    const style = text((layer.Style ?? []).find((s: any) => s['@isDefault'] === 'true')?.Identifier) || text(layer.Style?.[0]?.Identifier)
    const formats = (layer.Format ?? []).map(text)
    const format = formats.find((f: string) => /png/i.test(f)) ?? formats.find((f: string) => /jpe?g/i.test(f)) ?? formats[0] ?? 'image/png'
    const link = (layer.TileMatrixSetLink ?? []).map((l: any) => text(l.TileMatrixSet)).find((id: string) => sets.has(id))
    if (!name || !link) continue
    const set = sets.get(link)!
    const prefix = zoomPrefix(set.zoomIds)
    if (prefix === null) continue
    const zooms = [...set.zoomIds.keys()]
    const rest = (layer.ResourceURL ?? []).find((r: any) => r['@resourceType'] === 'tile' && (!format || r['@format'] === format))
      ?? (layer.ResourceURL ?? []).find((r: any) => r['@resourceType'] === 'tile')
    let tileUrl: string
    if (rest?.['@template']) {
      tileUrl = String(rest['@template'])
        .replace(/\{TileMatrixSet\}/gi, encodeURIComponent(set.id))
        .replace(/\{TileMatrix\}/gi, `${prefix}{z}`)
        .replace(/\{TileRow\}/gi, '{y}')
        .replace(/\{TileCol\}/gi, '{x}')
        .replace(/\{Style\}/gi, encodeURIComponent(style || 'default'))
    } else {
      const url = new URL(kvpHref, serviceUrl)
      for (const key of [...url.searchParams.keys()]) if (/^(service|request)$/i.test(key)) url.searchParams.delete(key)
      const params = { SERVICE: 'WMTS', REQUEST: 'GetTile', VERSION: '1.0.0', LAYER: name, STYLE: style, TILEMATRIXSET: set.id, FORMAT: format }
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
      tileUrl = `${url.toString()}&TILEMATRIX=${encodeURIComponent(prefix)}{z}&TILEROW={y}&TILECOL={x}`
    }
    out.push({ name, title: text(layer.Title) || name, tileUrl, minzoom: Math.min(...zooms), maxzoom: Math.max(...zooms) })
  }
  if (!out.length) {
    throw new ExternalLayerError(
      anyLayer
        ? 'У слоёв сервера нет сетки Web Mercator (EPSG:3857/900913) — карта их не покажет. Попросите владельца сервера включить её'
        : 'На сервере нет слоёв WMTS',
    )
  }
  return out
}

export function newExternalLayerId(): string {
  return `ext${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Сохранённый список (localStorage) → только корректные записи. */
export function parseSavedExternalLayers(raw: string | null): ExternalLayer[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  return data.filter((l): l is ExternalLayer =>
    l && typeof l === 'object'
    && typeof l.id === 'string' && /^ext[\w]{1,40}$/.test(l.id)
    && ['xyz', 'wms', 'wmts'].includes(l.kind)
    && typeof l.name === 'string'
    && typeof l.tileUrl === 'string' && /^https?:\/\//i.test(l.tileUrl)
    && typeof l.opacity === 'number' && typeof l.visible === 'boolean',
  )
}
