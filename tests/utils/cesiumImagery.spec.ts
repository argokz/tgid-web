import { describe, expect, it } from 'vitest'
import { buildNetworkWmsOverlays, buildWmsProbeUrl, probeWmsOverlay, resolve3dBaseImagery } from '~/utils/cesiumImagery'

const layers = [
  { id: 'stadia', url: 'https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=K', maxZoom: 22 },
  { id: 'planet-v4', url: 'https://api.maptiler.com/tiles/v4/{z}/{x}/{y}.pbf?key=K', maxZoom: 15 },
  { id: 'hybrid-v4', url: 'https://api.maptiler.com/maps/hybrid-v4/256/{z}/{x}/{y}@2x.jpg?key=K', maxZoom: 22 },
  { id: '2gis', url: 'http://tile1.maps.2gis.com/tiles?x={x}&y={y}&z={z}', maxZoom: 18 },
  { id: 'osm', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 }
]

describe('resolve3dBaseImagery', () => {
  it('берёт растровую подложку 2D как есть', () => {
    expect(resolve3dBaseImagery('hybrid-v4', layers, 'K')).toEqual({ url: layers[2].url, maximumLevel: 22 })
  })

  it('векторную и http-подложку без CORS заменяет на MapTiler streets', () => {
    expect(resolve3dBaseImagery('planet-v4', layers, 'K').url).toBe(layers[0].url)
    expect(resolve3dBaseImagery('2gis', layers, 'K').url).toBe(layers[0].url)
  })

  it('без ключа MapTiler откатывается на OSM', () => {
    expect(resolve3dBaseImagery('stadia', layers, '').url).toContain('openstreetmap.org')
  })
})

describe('buildNetworkWmsOverlays', () => {
  const all = [
    { layerId: 'pipes', sourceLayer: 'heatpipesections', zIndex: 2 },
    { layerId: 'nodes', sourceLayer: 'nodes', workspace: 'AlmatyGIS', zIndex: 5 },
    { layerId: 'hidden', sourceLayer: 'contours', zIndex: 1 }
  ]

  it('только видимые слои, снизу вверх, WMS workspace-эндпоинт', () => {
    const res = buildNetworkWmsOverlays(all, ['nodes', 'pipes'], [], () => 'https://itwin.kz/geoserver/')
    expect(res.map((o) => o.layers)).toEqual(['AlmatyGIS:heatpipesections', 'AlmatyGIS:nodes'])
    expect(res[0].url).toBe('https://itwin.kz/geoserver/AlmatyGIS/wms')
    expect(res[0].cqlFilter).toBeUndefined()
  })

  it('фильтр фрагментов в CQL и в ключе (смена фрагмента пересоздаёт слой)', () => {
    const res = buildNetworkWmsOverlays(all, ['pipes'], [74, 75], () => 'https://g')
    expect(res[0].cqlFilter).toBe(`"fileid" IN ('74','75')`)
    expect(res[0].key).toContain('74')
  })
})

describe('probeWmsOverlay', () => {
  const overlay = { key: 'k', url: 'https://g/AlmatyGIS/wms', layers: 'AlmatyGIS:realconsumers', cqlFilter: `"fileid" IN ('74')` }
  const respond = (status: number, type: string) =>
    (async () => new Response('x', { status, headers: { 'content-type': type } })) as unknown as typeof fetch

  it('в пробный GetMap попадают слой и CQL-фильтр', () => {
    const url = buildWmsProbeUrl(overlay)
    expect(url.startsWith('https://g/AlmatyGIS/wms?SERVICE=WMS')).toBe(true)
    expect(url).toContain('LAYERS=AlmatyGIS%3Arealconsumers')
    expect(url).toContain('CQL_FILTER=')
  })

  it('картинка — слой рабочий; XML-ошибка GeoServer (200) и 404 — нет', async () => {
    expect(await probeWmsOverlay(overlay, respond(200, 'image/png'))).toBe(true)
    expect(await probeWmsOverlay(overlay, respond(200, 'application/vnd.ogc.se_xml;charset=UTF-8'))).toBe(false)
    expect(await probeWmsOverlay(overlay, respond(404, 'text/html'))).toBe(false)
  })

  it('сетевая ошибка не выкидывает слой', async () => {
    const failing = (async () => { throw new TypeError('network') }) as unknown as typeof fetch
    expect(await probeWmsOverlay(overlay, failing)).toBe(true)
  })
})
