import { describe, expect, it } from 'vitest'
import {
  ExternalLayerError,
  capabilitiesUrl,
  normalizeServiceUrl,
  parseSavedExternalLayers,
  parseWmsCapabilities,
  parseWmtsCapabilities,
  wmsTileUrl,
  xyzTileUrl,
} from '~/utils/externalLayers'

const WMS_130 = `<?xml version="1.0"?>
<WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms">
  <Capability><Layer><Title>Акимат</Title><CRS>EPSG:4326</CRS><CRS>EPSG:3857</CRS>
    <Layer><Name>roads</Name><Title>Дороги</Title></Layer>
    <Layer><Name>parcels</Name><Title>Участки</Title><CRS>EPSG:32643</CRS></Layer>
  </Layer></Capability>
</WMS_Capabilities>`

const WMS_LOCAL_ONLY = `<WMT_MS_Capabilities version="1.1.1"><Capability><Layer><SRS>EPSG:28473</SRS>
  <Layer><Name>plan</Name><Title>План</Title></Layer></Layer></Capability></WMT_MS_Capabilities>`

const matrices = (prefix: string, n: number) => Array.from({ length: n }, (_, z) => `
  <TileMatrix><ows:Identifier>${prefix}${z}</ows:Identifier><ScaleDenominator>${559082264.0287178 / 2 ** z}</ScaleDenominator>
  <TopLeftCorner>-20037508.34 20037508.34</TopLeftCorner><TileWidth>256</TileWidth><TileHeight>256</TileHeight>
  <MatrixWidth>${2 ** z}</MatrixWidth><MatrixHeight>${2 ** z}</MatrixHeight></TileMatrix>`).join('')

const WMTS_GWC = `<Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1" version="1.0.0">
  <ows:OperationsMetadata><ows:Operation name="GetTile"><ows:DCP><ows:HTTP>
    <ows:Get xlink:href="https://gis.example.kz/geoserver/gwc/service/wmts?" xmlns:xlink="http://www.w3.org/1999/xlink"/>
  </ows:HTTP></ows:DCP></ows:Operation></ows:OperationsMetadata>
  <Contents>
    <Layer><ows:Title>Сети</ows:Title><ows:Identifier>city:nets</ows:Identifier>
      <Style isDefault="true"><ows:Identifier>nets_style</ows:Identifier></Style>
      <Format>image/jpeg</Format><Format>image/png</Format>
      <TileMatrixSetLink><TileMatrixSet>EPSG:4326</TileMatrixSet></TileMatrixSetLink>
      <TileMatrixSetLink><TileMatrixSet>EPSG:900913</TileMatrixSet></TileMatrixSetLink>
    </Layer>
    <TileMatrixSet><ows:Identifier>EPSG:4326</ows:Identifier><ows:SupportedCRS>urn:ogc:def:crs:EPSG::4326</ows:SupportedCRS>
      <TileMatrix><ows:Identifier>EPSG:4326:0</ows:Identifier><ScaleDenominator>279541132.0143589</ScaleDenominator>
      <TopLeftCorner>90.0 -180.0</TopLeftCorner></TileMatrix></TileMatrixSet>
    <TileMatrixSet><ows:Identifier>EPSG:900913</ows:Identifier><ows:SupportedCRS>urn:ogc:def:crs:EPSG::900913</ows:SupportedCRS>
      ${matrices('EPSG:900913:', 4)}</TileMatrixSet>
  </Contents>
</Capabilities>`

const WMTS_REST = `<Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1">
  <Contents>
    <Layer><ows:Title>Ортофото</ows:Title><ows:Identifier>ortho</ows:Identifier>
      <Style isDefault="true"><ows:Identifier>default</ows:Identifier></Style><Format>image/jpeg</Format>
      <TileMatrixSetLink><TileMatrixSet>GoogleMapsCompatible</TileMatrixSet></TileMatrixSetLink>
      <ResourceURL format="image/jpeg" resourceType="tile" template="https://ortho.example.kz/wmts/ortho/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg"/>
    </Layer>
    <TileMatrixSet><ows:Identifier>GoogleMapsCompatible</ows:Identifier><ows:SupportedCRS>urn:ogc:def:crs:EPSG:6.18.3:3857</ows:SupportedCRS>
      ${matrices('', 20).replace(/<TileMatrix><ows:Identifier>[0-2]<\/ows:Identifier>[\s\S]*?<\/TileMatrix>/g, '')}</TileMatrixSet>
  </Contents>
</Capabilities>`

const WMTS_LOCAL = `<Capabilities xmlns:ows="http://www.opengis.net/ows/1.1"><Contents>
  <Layer><ows:Identifier>plan</ows:Identifier><TileMatrixSetLink><TileMatrixSet>local</TileMatrixSet></TileMatrixSetLink></Layer>
  <TileMatrixSet><ows:Identifier>local</ows:Identifier><ows:SupportedCRS>EPSG:28473</ows:SupportedCRS>
    <TileMatrix><ows:Identifier>0</ows:Identifier><ScaleDenominator>100000</ScaleDenominator><TopLeftCorner>0 0</TopLeftCorner></TileMatrix>
  </TileMatrixSet></Contents></Capabilities>`

describe('externalLayers: адреса и шаблоны', () => {
  it('принимает только http/https', () => {
    expect(normalizeServiceUrl('  "https://gis.kz/wms"  ')).toBe('https://gis.kz/wms')
    expect(() => normalizeServiceUrl('javascript:alert(1)')).toThrow(ExternalLayerError)
    expect(() => normalizeServiceUrl('ftp://gis.kz/x')).toThrow(/http/)
    expect(() => normalizeServiceUrl('gis.kz')).toThrow(/адрес/)
  })

  it('XYZ требует {z}, {x}, {y}', () => {
    expect(xyzTileUrl('https://t.kz/{z}/{x}/{y}.png')).toBe('https://t.kz/{z}/{x}/{y}.png')
    expect(xyzTileUrl('https://t.kz/tms/{z}/{x}/{-y}.png')).toContain('{-y}')
    expect(() => xyzTileUrl('https://t.kz/tiles.png')).toThrow(/\{z\}/)
  })

  it('WMS: GetMap в 3857 с шаблоном bbox, чужие параметры из адреса убраны', () => {
    const url = wmsTileUrl('https://gis.kz/ows?service=WMS&request=GetCapabilities&map=city', 'a:roads', '1.3.0')
    expect(url).toContain('CRS=EPSG%3A3857')
    expect(url).toContain('LAYERS=a%3Aroads')
    expect(url).toContain('map=city')
    expect(url).not.toMatch(/GetCapabilities/)
    expect(url.endsWith('&BBOX={bbox-epsg-3857}')).toBe(true)
    expect(capabilitiesUrl('https://gis.kz/ows?REQUEST=GetMap', 'wmts')).toBe('https://gis.kz/ows?SERVICE=WMTS&REQUEST=GetCapabilities')
  })
})

describe('externalLayers: GetCapabilities', () => {
  it('WMS: слои с EPSG:3857, в т. ч. унаследованной', () => {
    const layers = parseWmsCapabilities(WMS_130, 'https://akimat.kz/wms')
    expect(layers.map((l) => l.name)).toEqual(['roads', 'parcels'])
    expect(layers[0].title).toBe('Дороги')
    expect(layers[0].tileUrl).toContain('VERSION=1.3.0')
  })

  it('WMS только в местной системе координат — понятная ошибка', () => {
    expect(() => parseWmsCapabilities(WMS_LOCAL_ONLY, 'https://x.kz/wms')).toThrow(/EPSG:3857/)
    expect(() => parseWmsCapabilities('<html>404</html>', 'https://x.kz/wms')).toThrow(/WMS/)
  })

  it('WMTS GeoServer: сетка EPSG:900913, уровни «EPSG:900913:N», запрос KVP, PNG', () => {
    const [layer] = parseWmtsCapabilities(WMTS_GWC, 'https://gis.example.kz/geoserver/gwc/service/wmts')
    expect(layer.name).toBe('city:nets')
    expect(layer.tileUrl).toContain('TILEMATRIXSET=EPSG%3A900913')
    expect(layer.tileUrl).toContain('FORMAT=image%2Fpng')
    expect(layer.tileUrl).toContain('STYLE=nets_style')
    expect(layer.tileUrl).toMatch(/TILEMATRIX=EPSG%3A900913%3A\{z\}&TILEROW=\{y\}&TILECOL=\{x\}$/)
    expect([layer.minzoom, layer.maxzoom]).toEqual([0, 3])
  })

  it('WMTS REST: шаблон ResourceURL, уровни с 3-го', () => {
    const [layer] = parseWmtsCapabilities(WMTS_REST, 'https://ortho.example.kz/wmts')
    expect(layer.tileUrl).toBe('https://ortho.example.kz/wmts/ortho/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg')
    expect([layer.minzoom, layer.maxzoom]).toEqual([3, 19])
  })

  it('WMTS без сетки Web Mercator — понятная ошибка', () => {
    expect(() => parseWmtsCapabilities(WMTS_LOCAL, 'https://x.kz/wmts')).toThrow(/Web Mercator/)
  })
})

describe('externalLayers: сохранённый список', () => {
  it('отбрасывает испорченные записи', () => {
    const good = { id: 'extabc1', kind: 'xyz', name: 'Орто', url: 'https://t.kz/{z}/{x}/{y}.png', tileUrl: 'https://t.kz/{z}/{x}/{y}.png', opacity: 0.8, visible: true }
    const raw = JSON.stringify([good, { ...good, id: 'bad id' }, { ...good, tileUrl: 'javascript:1' }, null])
    expect(parseSavedExternalLayers(raw)).toEqual([good])
    expect(parseSavedExternalLayers('{oops')).toEqual([])
  })
})
