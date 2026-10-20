import { describe, expect, it } from 'vitest'
import {
  dataVersionRevision,
  gwcMvtTileUrl,
  mergeViewparamFields,
  tileUrlWithViewparams,
  withTileRevision,
  wmtsLayerBounds,
  wmtsLayerGridBounds,
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

  it('границы — по пределам сетки GWC; сетка на весь мир — без границ', () => {
    const lim = (z: number, r0: number, r1: number, c0: number, c1: number) => ({
      TileMatrix: `EPSG:900913:${z}`, MinTileRow: r0, MaxTileRow: r1, MinTileCol: c0, MaxTileCol: c1,
    })
    const layer = (limits: any[]) => ({
      'ows:WGS84BoundingBox': { 'ows:LowerCorner': '39.51 55.55', 'ows:UpperCorner': '39.58 55.61' },
      TileMatrixSetLink: [
        { TileMatrixSet: 'EPSG:4326' },
        { TileMatrixSet: 'EPSG:900913', TileMatrixSetLimits: { TileMatrixLimits: limits } },
      ],
    })
    // Шатура на уровне 12: столбец 2497, строка 1277 — границы тайла вокруг 39,5° в. д., 55,6° с. ш.
    const b = wmtsLayerGridBounds(layer([lim(0, 0, 0, 0, 0), lim(12, 1277, 1277, 2497, 2497), lim(13, 2554, 2555, 4994, 4995)]))!
    expect(b[0]).toBeCloseTo(39.46, 1)
    expect(b[2]).toBeCloseTo(39.55, 1)
    expect(b[1]).toBeLessThan(b[3])
    expect(b[1] > 55 && b[3] < 56).toBe(true)
    // охват «весь мир»
    expect(wmtsLayerGridBounds(layer([lim(0, 0, 0, 0, 0), lim(12, 0, 4095, 0, 4095)]))).toBeNull()
    // пределов нет — границы слоя
    expect(wmtsLayerGridBounds(layer([]))).toEqual([39.51, 55.55, 39.58, 55.61])
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

describe('dataVersionRevision', () => {
  it('число версии — как есть, разные версии — разные rev', () => {
    expect(dataVersionRevision('123456')).toBe(123456)
    expect(dataVersionRevision('123457')).not.toBe(dataVersionRevision('123456'))
  })

  it('не число или слишком большое — стабильный ненулевой хеш', () => {
    const a = dataVersionRevision('99999999999999999999')
    expect(a).toBeGreaterThan(0)
    expect(dataVersionRevision('99999999999999999999')).toBe(a)
    expect(dataVersionRevision('0')).toBeGreaterThan(0)
  })
})
