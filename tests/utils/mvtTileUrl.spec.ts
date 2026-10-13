import { describe, expect, it } from 'vitest'
import {
  gwcMvtTileUrl,
  mergeViewparamFields,
  tileUrlWithViewparams,
  withTileRevision,
  wmtsLayerBounds,
  wmtsLayerHasGwcMvt,
} from '~/utils/mvtTileUrl'

describe('mvtTileUrl', () => {
  it('кеш GWC — только при MVT и сетке EPSG:900913', () => {
    const formats = ['application/vnd.mapbox-vector-tile', 'image/png']
    expect(wmtsLayerHasGwcMvt({ Format: formats, TileMatrixSetLink: { TileMatrixSet: 'EPSG:900913' } })).toBe(true)
    expect(wmtsLayerHasGwcMvt({
      Format: formats,
      TileMatrixSetLink: [{ TileMatrixSet: 'EPSG:4326' }, { TileMatrixSet: 'EPSG:900913' }],
    })).toBe(true)
    expect(wmtsLayerHasGwcMvt({ Format: formats })).toBe(false)
    expect(wmtsLayerHasGwcMvt({ Format: 'image/png', TileMatrixSetLink: { TileMatrixSet: 'EPSG:900913' } })).toBe(false)
    expect(wmtsLayerHasGwcMvt(undefined)).toBe(false)
  })

  it('границы слоя из ows:WGS84BoundingBox', () => {
    const box = (lower: string, upper: string) => ({
      'ows:WGS84BoundingBox': { 'ows:LowerCorner': lower, 'ows:UpperCorner': upper },
    })
    expect(wmtsLayerBounds(box('71.32 51.03', '71.66 51.22'))).toEqual([71.32, 51.03, 71.66, 51.22])
    expect(wmtsLayerBounds(box('71.66 51.03', '71.32 51.22'))).toBeNull()
    expect(wmtsLayerBounds(box('x 51', '71 52'))).toBeNull()
    expect(wmtsLayerBounds({})).toBeNull()
  })

  it('WMTS рабочей области с шаблоном XYZ', () => {
    const url = gwcMvtTileUrl('https://itwin.kz/geoserver/', 'AstanaGIS', 'uzel')
    expect(url.startsWith('https://itwin.kz/geoserver/AstanaGIS/gwc/service/wmts?')).toBe(true)
    expect(url).toContain('LAYER=uzel&')
    expect(url).toContain('TILEMATRIX=EPSG:900913:{z}&TILEROW={y}&TILECOL={x}')
  })

  it('поля подписей слоёв одного источника объединяются без повторов', () => {
    expect(mergeViewparamFields(['name:on;dy:on', 'dy:on;p1:on;', ''])).toBe('name:on;dy:on;p1:on')
    expect(mergeViewparamFields([])).toBe('')
  })

  it('версия данных добавляется в VIEWPARAMS', () => {
    expect(withTileRevision('fragments:1_2;', 0)).toBe('fragments:1_2;')
    expect(withTileRevision('fragments:1_2;', 7)).toBe('fragments:1_2;rev:7;')
    expect(withTileRevision('nach:0', 7)).toBe('nach:0;rev:7;')
    expect(withTileRevision('', 7)).toBe('rev:7;')
  })

  it('viewparams добавляется к адресу, шаблон не кодируется', () => {
    expect(tileUrlWithViewparams('https://gs/ows?A=1&B={z}', 'x:1;')).toBe('https://gs/ows?A=1&B={z}&viewparams=x:1;')
    expect(tileUrlWithViewparams('https://gs/t/{z}/{x}/{y}.pbf', 'x:1;')).toBe('https://gs/t/{z}/{x}/{y}.pbf?viewparams=x:1;')
  })
})
