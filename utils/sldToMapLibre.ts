import { XMLParser } from 'fast-xml-parser'

export interface SldConversionOptions {
  workspace: string
  resourceUrl?: (workspace: string, resourcePath: string) => string
  /** Широта города — для перевода размеров в метрах (uom=metre) в пиксели по зуму */
  latitude?: number
}

/** Метаданные слоя подписи: размер шрифта в стиле задан в метрах */
export const META_TEXT_UOM = 'tgid:textUom'
/** Метаданные слоя подписи: точка подписи — внутри полигона (Geometry interiorPoint/centroid в SLD) */
export const META_LABEL_POINT = 'tgid:labelPoint'

/** Подпись в метрах на экране — не мельче и не крупнее, пикселей */
export const METRE_TEXT_MIN_PX = 10.5
export const METRE_TEXT_MAX_PX = 14
/** За сколько зумов подпись дорастает от нижней границы до верхней */
const METRE_TEXT_GROW_ZOOMS = 3

/** Метров в пикселе MapLibre (тайл 512) на нулевом зуме на экваторе */
const METRES_PER_PX_Z0 = 78271.51696402048

/**
 * Размер подписи, заданный в метрах (uom=metre), — пиксели по зуму. С зума, где размер в метрах
 * достигает METRE_TEXT_MIN_PX, подпись плавно растёт до METRE_TEXT_MAX_PX за три зума — не вдвое
 * на каждый зум, как дом: тогда подписи нагрузок налезают друг на друга и на соседние дома
 * (22.10: при 12–32 px квартал Алматы — сплошной текст).
 */
export function metreTextSize(metres: number, latitude = 45): any {
  const k = METRES_PER_PX_Z0 * Math.cos((latitude * Math.PI) / 180)
  const z0 = Math.round(Math.log2((METRE_TEXT_MIN_PX * k) / metres) * 1000) / 1000
  return ['interpolate', ['linear'], ['zoom'],
    z0, METRE_TEXT_MIN_PX,
    z0 + METRE_TEXT_GROW_ZOOMS, METRE_TEXT_MAX_PX]
}

const isMetreUom = (symbolizer: any): boolean => /metre|meter/i.test(String(symbolizer?.['@_uom'] || ''))

/** Geometry TextSymbolizer — точка внутри полигона (interiorPoint, centroid) */
function interiorLabelPoint(symbolizer: any): boolean {
  const fn = String(symbolizer?.Geometry?.Function?.['@_name'] || '')
  return /^(interiorPoint|centroid)$/i.test(fn)
}

export interface ConvertedSldStyle {
  layers: any[]
}

const SCALE_AT_ZOOM_ZERO = 559082264.0287178

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function numberValue(value: unknown, fallback?: number): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function textValue(value: any): string {
  if (value == null) return ''
  if (typeof value === 'object' && '#text' in value) return String(value['#text'])
  return String(value)
}

function cssParameters(container: any): Record<string, string | number> {
  const raw = container?.CssParameter ?? container?.SvgParameter
  const out: Record<string, string | number> = {}
  for (const parameter of asArray(raw)) {
    const name = String(parameter?.['@_name'] || '').trim()
    if (name) out[name] = parameter?.['#text'] ?? ''
  }
  return out
}

function convertComparison(name: string, value: any): any[] | null {
  const field = textValue(value?.PropertyName).trim()
  if (!field) return null
  const literal = value?.Literal?.['#text'] ?? value?.Literal
  if (literal == null || literal === 'null' || literal === 'NULL') {
    if (name === 'PropertyIsEqualTo') return ['!', ['has', field]]
    if (name === 'PropertyIsNotEqualTo') return ['has', field]
  }
  const operators: Record<string, string> = {
    PropertyIsEqualTo: '==',
    PropertyIsNotEqualTo: '!=',
    PropertyIsLessThan: '<',
    PropertyIsLessThanOrEqualTo: '<=',
    PropertyIsGreaterThan: '>',
    PropertyIsGreaterThanOrEqualTo: '>='
  }
  const operator = operators[name]
  return operator ? [operator, field, literal] : null
}

function convertFilterNode(node: any): any[] | null {
  if (!node || typeof node !== 'object') return null
  for (const [name, value] of Object.entries(node)) {
    if (name.startsWith('@_') || name === '#text') continue
    if (name === 'And' || name === 'Or') {
      const children: any[] = []
      for (const child of asArray(value as any)) {
        for (const [childName, childValue] of Object.entries(child || {})) {
          for (const item of asArray(childValue as any)) {
            const converted = convertFilterNode({ [childName]: item })
            if (converted) children.push(converted)
          }
        }
      }
      if (!children.length) return null
      return [name === 'And' ? 'all' : 'any', ...children]
    }
    if (name === 'Not') {
      const converted = convertFilterNode(value)
      return converted ? ['!', converted] : null
    }
    if (name === 'PropertyIsNull') {
      const field = textValue((value as any)?.PropertyName).trim()
      return field ? ['!', ['has', field]] : null
    }
    if (name === 'PropertyIsNotNull') {
      const field = textValue((value as any)?.PropertyName).trim()
      return field ? ['has', field] : null
    }
    const comparison = convertComparison(name, value)
    if (comparison) return comparison
  }
  return null
}

function ruleFilter(rule: any): any[] | undefined {
  if (rule?.ElseFilter != null) return undefined
  return convertFilterNode(rule?.Filter) || undefined
}

export function scaleDenominatorToZoom(scale: number): number {
  return Math.max(0, Math.min(24, Math.log2(SCALE_AT_ZOOM_ZERO / scale)))
}

function applyScaleRange(layer: any, rule: any) {
  const minScale = numberValue(rule?.MinScaleDenominator)
  const maxScale = numberValue(rule?.MaxScaleDenominator)
  if (maxScale && maxScale > 0) layer.minzoom = scaleDenominatorToZoom(maxScale)
  if (minScale && minScale > 0) layer.maxzoom = scaleDenominatorToZoom(minScale)
}

function safeId(value: unknown): string {
  return String(value || 'rule')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'rule'
}

function lineLayer(symbolizer: any): any {
  const stroke = cssParameters(symbolizer?.Stroke)
  const paint: Record<string, any> = {
    'line-color': stroke.stroke || '#3388ff',
    'line-width': numberValue(stroke['stroke-width'], 2)
  }
  const opacity = numberValue(stroke['stroke-opacity'])
  if (opacity != null) paint['line-opacity'] = opacity
  const dash = String(stroke['stroke-dasharray'] || '').trim()
  if (dash) {
    const values = dash.split(/[ ,]+/).map(Number).filter(Number.isFinite)
    if (values.length) paint['line-dasharray'] = values
  }
  return {
    type: 'line',
    paint,
    layout: {
      'line-cap': String(stroke['stroke-linecap'] || 'round'),
      'line-join': String(stroke['stroke-linejoin'] || 'round')
    }
  }
}

function workspaceResourcePath(href: string, workspace: string): string | null {
  const normalized = href.replace(/\\/g, '/')
  const marker = `/workspaces/${workspace}/`
  const index = normalized.toLowerCase().indexOf(marker.toLowerCase())
  if (index < 0) return null
  const path = normalized.slice(index + marker.length).replace(/^\/+/, '')
  if (!path.startsWith('styles/') || path.includes('..')) return null
  return path
}

function pointLayer(symbolizer: any, options: SldConversionOptions): any {
  const graphic = symbolizer?.Graphic || {}
  const size = numberValue(graphic?.Size, 12) || 12
  const externalGraphic = graphic?.ExternalGraphic
  const href = textValue(externalGraphic?.OnlineResource?.['@_href']).trim()
  const resourcePath = href ? workspaceResourcePath(href, options.workspace) : null

  if (resourcePath && options.resourceUrl) {
    const iconName = safeId(resourcePath.replace(/^styles\//, '').replace(/\.[^.]+$/, ''))
    const iconId = `geoserver-${safeId(options.workspace)}-${iconName}`
    return {
      type: 'symbol',
      layout: {
        'icon-image': iconId,
        'icon-size': size / 100,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      },
      paint: {},
      metadata: {
        geoserverIconId: iconId,
        geoserverIconUrl: options.resourceUrl(options.workspace, resourcePath)
      }
    }
  }

  const mark = graphic?.Mark || {}
  const fill = cssParameters(mark?.Fill)
  const stroke = cssParameters(mark?.Stroke)
  return {
    type: 'circle',
    paint: {
      'circle-radius': size / 2,
      'circle-color': fill.fill || '#ffffff',
      'circle-opacity': numberValue(fill['fill-opacity'], 1),
      'circle-stroke-color': stroke.stroke || '#333333',
      'circle-stroke-width': numberValue(stroke['stroke-width'], 1)
    },
    layout: {}
  }
}

function labelText(label: any): string {
  const properties = asArray(label?.PropertyName).map(textValue).map(v => v.trim()).filter(Boolean)
  if (!properties.length) return textValue(label).trim()
  const separator = properties.length > 1 ? '\n' : ' '
  return properties.map(property => `{${property}}`).join(separator)
}

function textAnchor(pointPlacement: any): string | undefined {
  const x = numberValue(pointPlacement?.AnchorPoint?.AnchorPointX, 0.5) ?? 0.5
  const y = numberValue(pointPlacement?.AnchorPoint?.AnchorPointY, 0.5) ?? 0.5
  const horizontal = x < 0.34 ? 'left' : x > 0.66 ? 'right' : ''
  const vertical = y < 0.34 ? 'top' : y > 0.66 ? 'bottom' : ''
  return [vertical, horizontal].filter(Boolean).join('-') || 'center'
}

/** VendorOption GeoServer: имя → значение */
function vendorOptions(symbolizer: any): Record<string, string> {
  const out: Record<string, string> = {}
  for (const option of asArray(symbolizer?.VendorOption)) {
    const name = String(option?.['@_name'] || '').trim()
    if (name) out[name] = textValue(option).trim()
  }
  return out
}

function textLayer(symbolizer: any, options: SldConversionOptions): any {
  const font = cssParameters(symbolizer?.Font)
  const fill = cssParameters(symbolizer?.Fill)
  const halo = cssParameters(symbolizer?.Halo?.Fill)
  const size = numberValue(font['font-size'], 12) || 12
  const metre = isMetreUom(symbolizer)
  const pointPlacement = symbolizer?.LabelPlacement?.PointPlacement
  const displacement = pointPlacement?.Displacement
  const dx = numberValue(displacement?.DisplacementX, 0) || 0
  const dy = numberValue(displacement?.DisplacementY, 0) || 0
  const layout: Record<string, any> = {
    'text-field': labelText(symbolizer?.Label),
    // uom=metre (подписи нагрузок зданий: 6 м) — размер по зуму; раньше брались пиксели — 6 px, не прочесть
    'text-size': metre ? metreTextSize(size, options.latitude) : size,
    'text-anchor': textAnchor(pointPlacement),
    'text-allow-overlap': false,
    'text-ignore-placement': false
  }
  if ((dx || dy) && !metre) layout['text-offset'] = [dx / size, dy / size]
  // spaceAround — отступ между подписями (как text-padding); conflictResolution=false — без отсева
  const vendor = vendorOptions(symbolizer)
  const spaceAround = numberValue(vendor.spaceAround)
  if (spaceAround != null) layout['text-padding'] = Math.max(0, spaceAround)
  if (vendor.conflictResolution === 'false') {
    layout['text-allow-overlap'] = true
    layout['text-ignore-placement'] = true
  }
  if (String(font['font-weight'] || '').toLowerCase() === 'bold') {
    layout['text-font'] = ['Open Sans Bold', 'Arial Unicode MS Bold']
  }
  const metadata: Record<string, string> = {}
  if (metre) metadata[META_TEXT_UOM] = 'metre'
  if (interiorLabelPoint(symbolizer)) metadata[META_LABEL_POINT] = 'interior'
  const haloRadius = numberValue(symbolizer?.Halo?.Radius, 0) || 0
  return {
    type: 'symbol',
    layout,
    paint: {
      'text-color': fill.fill || '#000000',
      'text-opacity': numberValue(fill['fill-opacity'], 1),
      'text-halo-color': halo.fill || '#ffffff',
      // ореол в метрах (0,4 м) на экране — доли пикселя; читаемый — от 2 px
      'text-halo-width': metre && haloRadius > 0 ? Math.max(2, haloRadius) : haloRadius
    },
    ...(Object.keys(metadata).length ? { metadata } : {})
  }
}

export function convertSldToMapLibre(
  sldText: string,
  options: SldConversionOptions
): ConvertedSldStyle {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    removeNSPrefix: true,
    trimValues: true
  })
  const parsed = parser.parse(sldText)
  const namedLayers = asArray(parsed?.StyledLayerDescriptor?.NamedLayer)
  const rules: any[] = []
  for (const namedLayer of namedLayers) {
    for (const userStyle of asArray(namedLayer?.UserStyle)) {
      for (const featureTypeStyle of asArray(userStyle?.FeatureTypeStyle)) {
        rules.push(...asArray(featureTypeStyle?.Rule))
      }
    }
  }

  const layers: any[] = []
  rules.forEach((rule, ruleIndex) => {
    const filter = ruleFilter(rule)
    const baseId = safeId(rule?.Name || `rule-${ruleIndex + 1}`)
    const add = (kind: string, converted: any, index: number) => {
      const layer = { id: `${baseId}-${kind}-${index + 1}`, ...converted }
      if (filter) layer.filter = filter
      applyScaleRange(layer, rule)
      layers.push(layer)
    }
    asArray(rule?.LineSymbolizer).forEach((symbolizer, index) => add('line', lineLayer(symbolizer), index))
    asArray(rule?.PolygonSymbolizer).forEach((symbolizer, index) => {
      const fill = cssParameters(symbolizer?.Fill)
      const stroke = cssParameters(symbolizer?.Stroke)
      add('fill', {
        type: 'fill',
        paint: {
          'fill-color': fill.fill || '#3388ff',
          'fill-opacity': numberValue(fill['fill-opacity'], 0.4),
          'fill-outline-color': stroke.stroke || '#3388ff'
        },
        layout: {}
      }, index)
    })
    asArray(rule?.PointSymbolizer).forEach((symbolizer, index) => add('point', pointLayer(symbolizer, options), index))
    asArray(rule?.TextSymbolizer).forEach((symbolizer, index) => add('text', textLayer(symbolizer, options), index))
  })

  return { layers: mergeIconLadders(layers) }
}

/**
 * Размер значка по зуму в SLD задают лестницей правил: тот же фильтр и значок, соседние диапазоны
 * масштаба, свой Size. Отдельные слои MapLibre дают скачок размера на каждом целом зуме; один слой
 * с icon-size по зуму (interpolate) растёт плавно. Размер ступени — на её нижней границе.
 */
export function mergeIconLadders(layers: any[]): any[] {
  const out: any[] = []
  const stops = new Map<any, Array<[number, number]>>()
  const keyOf = (layer: any) => (layer?.type === 'symbol' && layer.layout?.['icon-image'] && typeof layer.layout?.['icon-size'] === 'number'
    ? `${layer.layout['icon-image']}|${JSON.stringify(layer.filter ?? null)}`
    : null)
  for (const layer of layers) {
    const key = keyOf(layer)
    const prev = out[out.length - 1]
    if (key && prev && keyOf(prev) === key && prev.maxzoom != null && layer.minzoom != null
      && Math.abs(prev.maxzoom - layer.minzoom) < 1e-6) {
      const list = stops.get(prev) ?? [[prev.minzoom ?? 0, prev.layout['icon-size']]]
      list.push([layer.minzoom, layer.layout['icon-size']])
      stops.set(prev, list)
      prev.maxzoom = layer.maxzoom
      if (prev.maxzoom == null) delete prev.maxzoom
      // следующая ступень сравнивается по icon-size последней
      prev.layout = { ...prev.layout, 'icon-size': layer.layout['icon-size'] }
      continue
    }
    out.push(layer)
  }
  for (const [layer, list] of stops) {
    const uniq = list.filter(([z], i) => i === 0 || z > list[i - 1][0])
    layer.layout = {
      ...layer.layout,
      'icon-size': uniq.length > 1
        ? ['interpolate', ['linear'], ['zoom'], ...uniq.flatMap(([z, v]) => [Math.round(z * 1000) / 1000, v])]
        : uniq[0][1]
    }
  }
  return out
}
