import { XMLParser } from 'fast-xml-parser'

export interface SldConversionOptions {
  workspace: string
  resourceUrl?: (workspace: string, resourcePath: string) => string
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

function textLayer(symbolizer: any): any {
  const font = cssParameters(symbolizer?.Font)
  const fill = cssParameters(symbolizer?.Fill)
  const halo = cssParameters(symbolizer?.Halo?.Fill)
  const size = numberValue(font['font-size'], 12) || 12
  const pointPlacement = symbolizer?.LabelPlacement?.PointPlacement
  const displacement = pointPlacement?.Displacement
  const dx = numberValue(displacement?.DisplacementX, 0) || 0
  const dy = numberValue(displacement?.DisplacementY, 0) || 0
  const layout: Record<string, any> = {
    'text-field': labelText(symbolizer?.Label),
    'text-size': size,
    'text-anchor': textAnchor(pointPlacement),
    'text-allow-overlap': false,
    'text-ignore-placement': false
  }
  if (dx || dy) layout['text-offset'] = [dx / size, dy / size]
  if (String(font['font-weight'] || '').toLowerCase() === 'bold') {
    layout['text-font'] = ['Open Sans Bold', 'Arial Unicode MS Bold']
  }
  return {
    type: 'symbol',
    layout,
    paint: {
      'text-color': fill.fill || '#000000',
      'text-opacity': numberValue(fill['fill-opacity'], 1),
      'text-halo-color': halo.fill || '#ffffff',
      'text-halo-width': numberValue(symbolizer?.Halo?.Radius, 0) || 0
    }
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
    asArray(rule?.TextSymbolizer).forEach((symbolizer, index) => add('text', textLayer(symbolizer), index))
  })

  return { layers }
}
