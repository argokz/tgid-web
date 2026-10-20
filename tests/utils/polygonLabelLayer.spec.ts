import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachPolygonLabelPoints, interiorLabelLayout, labelPointsSourceId } from '../../utils/polygonLabelLayer'

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
  it('без наложений, крупные дома первыми, текст раскрывается с зумом', () => {
    const layout = interiorLabelLayout({ 'text-field': '{txt}', 'text-allow-overlap': true, 'text-ignore-placement': true }, 16.77)
    expect(layout['text-allow-overlap']).toBe(false)
    expect(layout['text-ignore-placement']).toBe(false)
    expect(layout['symbol-sort-key']).toEqual(['-', 0, ['coalesce', ['get', '__area'], 0]])
    const tf = layout['text-field']
    expect(tf[0]).toBe('step')
    expect(tf[2]).toEqual(['coalesce', ['get', 'txt__short'], ['get', 'txt'], ''])
    expect(tf[3]).toBe(18)
    expect(tf[4]).toEqual(['coalesce', ['get', 'txt__mid'], ['get', 'txt'], ''])
    expect(tf[5]).toBe(19)
    expect(tf[6]).toEqual(['coalesce', ['get', 'txt'], ''])
    // подпись из нескольких полей — как в стиле
    expect(interiorLabelLayout({ 'text-field': '{a}\n{b}' })['text-field']).toBe('{a}\n{b}')
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
