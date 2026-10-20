import { describe, expect, it } from 'vitest'
import {
  convertSldToMapLibre, mergeIconLadders, scaleDenominatorToZoom,
  META_LABEL_POINT, META_TEXT_UOM, METRE_TEXT_MAX_PX, METRE_TEXT_MIN_PX, metreTextSize,
} from '../../utils/sldToMapLibre'
import { readableTextLayout, scaleTextLayout, scaleZoomValue } from '../../utils/mapStyleScale'

const wrapRules = (rules: string) => `
<sld:StyledLayerDescriptor xmlns:sld="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">
  <sld:NamedLayer><sld:UserStyle><sld:FeatureTypeStyle>${rules}</sld:FeatureTypeStyle></sld:UserStyle></sld:NamedLayer>
</sld:StyledLayerDescriptor>`

describe('SLD to MapLibre conversion', () => {
  it('converts line rules, filters, scale and dash styles', () => {
    const sld = wrapRules(`
      <sld:Rule>
        <sld:Name>main-line</sld:Name>
        <ogc:Filter><ogc:And>
          <ogc:PropertyIsEqualTo><ogc:PropertyName>mag</ogc:PropertyName><ogc:Literal>1</ogc:Literal></ogc:PropertyIsEqualTo>
          <ogc:PropertyIsEqualTo><ogc:PropertyName>zakr</ogc:PropertyName><ogc:Literal>0</ogc:Literal></ogc:PropertyIsEqualTo>
        </ogc:And></ogc:Filter>
        <sld:MaxScaleDenominator>250000</sld:MaxScaleDenominator>
        <sld:LineSymbolizer><sld:Stroke>
          <sld:CssParameter name="stroke">#ff0000</sld:CssParameter>
          <sld:CssParameter name="stroke-width">3</sld:CssParameter>
          <sld:CssParameter name="stroke-dasharray">8 4</sld:CssParameter>
        </sld:Stroke></sld:LineSymbolizer>
      </sld:Rule>`)

    const { layers } = convertSldToMapLibre(sld, { workspace: 'AlmatyGIS' })
    expect(layers).toHaveLength(1)
    expect(layers[0]).toMatchObject({
      id: 'main-line-line-1',
      type: 'line',
      filter: ['all', ['==', 'mag', 1], ['==', 'zakr', 0]],
      paint: {
        'line-color': '#ff0000',
        'line-width': 3,
        'line-dasharray': [8, 4]
      }
    })
    expect(layers[0].minzoom).toBeCloseTo(scaleDenominatorToZoom(250000), 6)
  })

  it('proxies workspace SVG resources and converts text labels', () => {
    const sld = wrapRules(`
      <sld:Rule>
        <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>code</ogc:PropertyName><ogc:Literal>US</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
        <sld:MinScaleDenominator>3000</sld:MinScaleDenominator>
        <sld:MaxScaleDenominator>7000</sld:MaxScaleDenominator>
        <sld:PointSymbolizer><sld:Graphic><sld:ExternalGraphic>
          <sld:OnlineResource href="file:/C:/ProgramData/GeoServer/workspaces/AlmatyGIS/styles/svg/us.svg" />
        </sld:ExternalGraphic><sld:Size>32</sld:Size></sld:Graphic></sld:PointSymbolizer>
      </sld:Rule>
      <sld:Rule>
        <sld:TextSymbolizer>
          <sld:Label><ogc:PropertyName>name</ogc:PropertyName>
<ogc:PropertyName>text</ogc:PropertyName></sld:Label>
          <sld:Font><sld:CssParameter name="font-size">16</sld:CssParameter></sld:Font>
          <sld:Halo><sld:Radius>3</sld:Radius><sld:Fill><sld:CssParameter name="fill">#ffffff</sld:CssParameter></sld:Fill></sld:Halo>
          <sld:Fill><sld:CssParameter name="fill">#000000</sld:CssParameter></sld:Fill>
        </sld:TextSymbolizer>
      </sld:Rule>`)

    const { layers } = convertSldToMapLibre(sld, {
      workspace: 'AlmatyGIS',
      resourceUrl: (workspace, path) => `/icons/${workspace}/${path}`
    })

    expect(layers[0]).toMatchObject({
      type: 'symbol',
      filter: ['==', 'code', 'US'],
      layout: {
        'icon-image': 'geoserver-AlmatyGIS-svg-us',
        'icon-size': 0.32
      },
      metadata: {
        geoserverIconUrl: '/icons/AlmatyGIS/styles/svg/us.svg'
      }
    })
    expect(layers[1].layout['text-field']).toBe('{name}\n{text}')
    expect(layers[1].paint).toMatchObject({
      'text-color': '#000000',
      'text-halo-color': '#ffffff',
      'text-halo-width': 3
    })
  })

  it('лестница размеров значка — один слой с плавным icon-size', () => {
    const scale = (z: number) => (559082264.0287178 / 2 ** z).toFixed(2)
    const rule = (zmin: number, zmax: number | null, size: number) => `
      <sld:Rule>
        <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>code</ogc:PropertyName><ogc:Literal>IS</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
        ${zmax != null ? `<sld:MinScaleDenominator>${scale(zmax)}</sld:MinScaleDenominator>` : ''}
        <sld:MaxScaleDenominator>${scale(zmin)}</sld:MaxScaleDenominator>
        <sld:PointSymbolizer><sld:Graphic><sld:ExternalGraphic>
          <sld:OnlineResource href="file:/C:/gs/workspaces/AstanaGIS/styles/svg/is.svg" />
        </sld:ExternalGraphic><sld:Size>${size}</sld:Size></sld:Graphic></sld:PointSymbolizer>
      </sld:Rule>`
    const sld = wrapRules(rule(9, 12, 16) + rule(12, 13, 18) + rule(13, null, 20))
    const { layers } = convertSldToMapLibre(sld, { workspace: 'AstanaGIS', resourceUrl: (w, p) => `/${w}/${p}` })
    expect(layers).toHaveLength(1)
    expect(layers[0].minzoom).toBeCloseTo(9, 3)
    expect(layers[0].maxzoom).toBeUndefined()
    expect(layers[0].layout['icon-size']).toEqual(['interpolate', ['linear'], ['zoom'], 9, 0.16, 12, 0.18, 13, 0.2])
  })

  it('разные значки или разрыв диапазонов не склеиваются', () => {
    const base = { type: 'symbol', filter: ['==', 'code', 'TK'] }
    const a = { ...base, id: 'a', minzoom: 13, maxzoom: 14, layout: { 'icon-image': 'tk', 'icon-size': 0.1 } }
    const b = { ...base, id: 'b', minzoom: 15, layout: { 'icon-image': 'tk', 'icon-size': 0.12 } }
    const c = { ...base, id: 'c', minzoom: 14, layout: { 'icon-image': 'us', 'icon-size': 0.12 } }
    expect(mergeIconLadders([a, b]).map((l) => l.id)).toEqual(['a', 'b'])
    expect(mergeIconLadders([{ ...a }, c]).map((l) => l.id)).toEqual(['a', 'c'])
  })

  it('VendorOption подписи: spaceAround → text-padding, conflictResolution=false → без отсева', () => {
    const sld = wrapRules(`
      <sld:Rule><sld:TextSymbolizer>
        <sld:Label><ogc:PropertyName>label</ogc:PropertyName></sld:Label>
        <sld:VendorOption name="spaceAround">10</sld:VendorOption>
        <sld:VendorOption name="conflictResolution">false</sld:VendorOption>
      </sld:TextSymbolizer></sld:Rule>`)
    const { layers } = convertSldToMapLibre(sld, { workspace: 'AlmatyGIS' })
    expect(layers[0].layout).toMatchObject({ 'text-padding': 10, 'text-allow-overlap': true, 'text-ignore-placement': true })
  })

  it('подпись в метрах (нагрузки зданий Алматы): размер по зуму, точка внутри дома', () => {
    const sld = wrapRules(`
      <sld:Rule><sld:TextSymbolizer uom="http://www.opengeospatial.org/se/units/metre">
        <sld:Geometry><ogc:Function name="interiorPoint"><ogc:PropertyName>shape</ogc:PropertyName></ogc:Function></sld:Geometry>
        <sld:Label><ogc:PropertyName>txt</ogc:PropertyName></sld:Label>
        <sld:Font><sld:CssParameter name="font-size">6</sld:CssParameter></sld:Font>
        <sld:Halo><sld:Radius>0.4</sld:Radius></sld:Halo>
      </sld:TextSymbolizer></sld:Rule>`)
    const { layers } = convertSldToMapLibre(sld, { workspace: 'AlmatyGIS', latitude: 43.24 })
    const size = layers[0].layout['text-size']
    expect(size.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']])
    expect(size[4]).toBe(METRE_TEXT_MIN_PX)
    expect(size[6]).toBe(METRE_TEXT_MAX_PX)
    // 6 м достигают 11 px у широты Алматы чуть раньше 17-го зума; дальше рост до 15 px за три зума
    expect(size[3]).toBeGreaterThan(16.5)
    expect(size[3]).toBeLessThan(17)
    expect(size[5] - size[3]).toBe(3)
    expect(layers[0].paint['text-halo-width']).toBe(2)
    expect(layers[0].metadata).toEqual({ [META_TEXT_UOM]: 'metre', [META_LABEL_POINT]: 'interior' })
    expect(metreTextSize(6)).not.toEqual(size)
  })

  it('подпись в пикселях — без метаданных', () => {
    const sld = wrapRules(`
      <sld:Rule><sld:TextSymbolizer>
        <sld:Label><ogc:PropertyName>label</ogc:PropertyName></sld:Label>
        <sld:Font><sld:CssParameter name="font-size">10</sld:CssParameter></sld:Font>
      </sld:TextSymbolizer></sld:Rule>`)
    const { layers } = convertSldToMapLibre(sld, { workspace: 'AlmatyGIS' })
    expect(layers[0].layout['text-size']).toBe(10)
    expect(layers[0].metadata).toBeUndefined()
  })
})

describe('масштаб шрифта стилей', () => {
  it('умножаются значения, а не ступени зума', () => {
    expect(scaleZoomValue(15, 0.8)).toBe(12)
    expect(scaleZoomValue(['interpolate', ['linear'], ['zoom'], 10, 12, 18, 16], 0.5))
      .toEqual(['interpolate', ['linear'], ['zoom'], 10, 6, 18, 8])
    expect(scaleZoomValue(['step', ['zoom'], 10, 14, 20], 0.5)).toEqual(['step', ['zoom'], 5, 14, 10])
    expect(scaleZoomValue({ stops: [[12, 10], [16, 20]] }, 0.5)).toEqual({ stops: [[12, 5], [16, 10]] })
    expect(scaleZoomValue(['get', 'size'], 0.5)).toEqual(['get', 'size'])
  })

  it('смещение подписи в пикселях сохраняется', () => {
    const layout = scaleTextLayout({ 'text-size': 20, 'text-offset': [0, -1] }, 0.8)
    expect(layout['text-size']).toBe(16)
    expect(layout['text-offset'][1] * layout['text-size']).toBeCloseTo(-20, 6)
    expect(scaleTextLayout({ 'text-field': 'x' }, 0.8)).toEqual({ 'text-field': 'x' })
  })

  it('подписи узлов и диаметров: шрифт растёт с зумом, не мельче 11 px', () => {
    expect(readableTextLayout({ 'text-size': 14, 'text-offset': [0, -0.5] })).toEqual({
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 12.6, 15, 14, 18, 17.5],
      'text-offset': [0, -0.5],
    })
    expect(readableTextLayout({ 'text-size': 10 })['text-size']).toEqual(['interpolate', ['linear'], ['zoom'], 13, 11, 15, 11, 18, 12.5])
    const zoomed = ['interpolate', ['linear'], ['zoom'], 10, 12, 18, 16]
    expect(readableTextLayout({ 'text-size': zoomed })['text-size']).toBe(zoomed)
  })
})
