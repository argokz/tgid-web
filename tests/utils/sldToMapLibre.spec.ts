import { describe, expect, it } from 'vitest'
import { convertSldToMapLibre, scaleDenominatorToZoom } from '../../utils/sldToMapLibre'

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
})
