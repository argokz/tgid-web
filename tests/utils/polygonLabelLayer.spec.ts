import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachPolygonLabelPoints, interiorLabelLayout, labelPointsSourceId, zoomValue } from '../../utils/polygonLabelLayer'

function fakeMap(zoom: number) {
  const sources: Record<string, any> = {}
  const layers: Record<string, any> = {}
  const handlers: Record<string, Set<(e?: any) => void>> = {}
  const piece = {
    id: 7,
    properties: { txt: 'a\r\nb' },
    geometry: { type: 'Polygon', coordinates: [[[76.9, 43.2], [76.901, 43.2], [76.901, 43.201], [76.9, 43.201], [76.9, 43.2]]] },
  }
  return {
    sources, layers,
    zoom,
    getZoom() { return this.zoom },
    getSource: (id: string) => sources[id],
    addSource: (id: string, spec: any) => { sources[id] = { spec, data: spec.data, setData(d: any) { this.data = d } } },
    getLayer: (id: string) => layers[id],
    getLayoutProperty: (id: string, p: string) => layers[id]?.layout?.[p],
    querySourceFeatures: vi.fn(() => [piece]),
    on: (ev: string, fn: (e?: any) => void) => { (handlers[ev] ??= new Set()).add(fn) },
    off: (ev: string, fn: (e?: any) => void) => { handlers[ev]?.delete(fn) },
    fire: (ev: string, e?: any) => { for (const fn of handlers[ev] ?? []) fn(e) },
    handlers,
  }
}

describe('раскладка подписей по точкам', () => {
  it('без наложений, крупные дома первыми, на зуме — самый полный вариант, что помещается в доме', () => {
    const size = ['interpolate', ['linear'], ['zoom'], 16.67, 11, 19.67, 15]
    const layout = interiorLabelLayout({ 'text-field': '{txt}', 'text-size': size, 'text-allow-overlap': true, 'text-ignore-placement': true }, 16.77)
    expect(layout['text-allow-overlap']).toBe(false)
    expect(layout['text-ignore-placement']).toBe(false)
    expect(layout['symbol-sort-key']).toEqual(['-', 0, ['coalesce', ['get', '__area'], 0]])
    const tf = layout['text-field']
    expect(tf[0]).toBe('step')
    // зумы 16, 17, 18, 19 — выбор по месту в доме; с 20-го — целиком
    expect(tf.filter((v: any) => typeof v === 'number')).toEqual([17, 18, 19, 20])
    expect(tf[tf.length - 1]).toEqual(['coalesce', ['get', 'txt'], ''])
    const at16 = tf[2]
    expect(at16[0]).toBe('case')
    expect(at16[1][1]).toEqual(['coalesce', ['get', 'txt__fit'], 0])
    expect(at16[3][1]).toEqual(['coalesce', ['get', 'txt__wide__fit'], 0])
    expect(at16[5][1]).toEqual(['coalesce', ['get', 'txt__mid__fit'], 0])
    expect(at16[at16.length - 1]).toEqual(['coalesce', ['get', 'txt__short'], ['coalesce', ['get', 'txt'], '']])
    // порог: шрифт на зуме (м меркатора) с запасом 15% — на 17-м вдвое меньше, чем на 16-м (шрифт почти тот же)
    const need16 = at16[1][2]
    const at17 = tf[4]
    expect(at17[1][2]).toBeLessThan(need16 / 1.8)
    expect(need16).toBeCloseTo(11 * 78271.517 / (2 ** 16.25 * 1.15), 1)
    // на 18-м меньше адреса и Qсум не бывает, на 19-м — все данные (целиком или в три строки)
    expect(tf[6][tf[6].length - 1]).toEqual(['coalesce', ['get', 'txt__mid'], ['coalesce', ['get', 'txt'], '']])
    const at19 = tf[8]
    expect(at19).toHaveLength(6)
    expect(at19[5]).toEqual(['coalesce', ['get', 'txt__wide'], ['coalesce', ['get', 'txt'], '']])
    // подпись из нескольких полей — как в стиле
    expect(interiorLabelLayout({ 'text-field': '{a}\n{b}' })['text-field']).toBe('{a}\n{b}')
  })

  it('размер шрифта на зуме', () => {
    expect(zoomValue(13, 5)).toBe(13)
    expect(zoomValue(['interpolate', ['linear'], ['zoom'], 10, 10, 20, 20], 15)).toBe(15)
    expect(zoomValue(['interpolate', ['linear'], ['zoom'], 10, 10, 20, 20], 25)).toBe(20)
    expect(zoomValue({ stops: [[10, 8], [12, 12]] }, 11)).toBe(10)
    expect(zoomValue(['get', 'x'], 11, 7)).toBe(7)
  })
})

describe('слой подписей по точкам полигонов', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('точки пересчитываются, пока подписи видны; без слоя — отписка', () => {
    const map = fakeMap(17.5)
    map.layers.lbl = { minzoom: 16.8, layout: {} }
    const sid = attachPolygonLabelPoints(map as any, { vectorSourceId: 'vec', sourceLayer: 'zdaniya_2', layerId: 'lbl' })
    expect(sid).toBe(labelPointsSourceId('vec', 'zdaniya_2'))
    // второй слой подписи того же источника — тот же источник, без второй подписки
    expect(attachPolygonLabelPoints(map as any, { vectorSourceId: 'vec', sourceLayer: 'zdaniya_2', layerId: 'lbl2' })).toBe(sid)
    expect(map.handlers.moveend.size).toBe(1)

    vi.advanceTimersByTime(200)
    expect(map.sources[sid].data.features).toHaveLength(1)
    expect(map.sources[sid].data.features[0].properties.txt).toBe('a\nb')

    // мелкий зум — точки убираются, тайлы не перебираются
    map.querySourceFeatures.mockClear()
    map.zoom = 14
    map.fire('moveend')
    vi.advanceTimersByTime(200)
    expect(map.sources[sid].data.features).toHaveLength(0)
    expect(map.querySourceFeatures).not.toHaveBeenCalled()

    // слои подписи удалены — контроллер отписывается
    delete map.layers.lbl
    map.fire('moveend')
    vi.advanceTimersByTime(200)
    expect(map.handlers.moveend.size).toBe(0)
  })
})
