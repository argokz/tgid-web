import { describe, expect, it } from 'vitest'
import { highlightData, highlightKey, highlightLayers, isLngLatGeometry, mergeGeometries } from '~/utils/selectionHighlight'
import { buildingsLayerVisibility, CONTEXT_MAP_LAYER_IDS } from '~/utils/contextMapLayers'

describe('подсветка объекта на карте', () => {
  it('куски участка из разных тайлов собираются в одну линию', () => {
    const a = { type: 'LineString', coordinates: [[71.4, 51.1], [71.41, 51.1]] }
    const b = { type: 'LineString', coordinates: [[71.41, 51.1], [71.42, 51.11]] }
    expect(mergeGeometries([a])).toEqual(a)
    expect(mergeGeometries([a, b])).toEqual({ type: 'MultiLineString', coordinates: [a.coordinates, b.coordinates] })
    const p = { type: 'Point', coordinates: [71.4, 51.1] }
    expect(mergeGeometries([p, p])).toEqual(p)
    expect(mergeGeometries([])).toBeNull()
  })

  it('геометрия в метрах (WMS) не подсвечивается', () => {
    expect(isLngLatGeometry({ type: 'Point', coordinates: [71.4, 51.1] })).toBe(true)
    expect(isLngLatGeometry({ type: 'Point', coordinates: [7951000, 6640000] })).toBe(false)
    expect(highlightData({ type: 'Point', coordinates: [7951000, 6640000] }).features).toEqual([])
    expect(highlightData(null).features).toEqual([])
  })

  it('слои: у выбранного ось и ореол, у объекта под курсором — только ореол', () => {
    expect(highlightLayers('s', 'selection').map((l) => l.id)).toEqual(['s-halo', 's-line', 's-point'])
    expect(highlightLayers('h', 'hover').map((l) => l.id)).toEqual(['h-halo', 'h-point'])
  })

  it('ключ объекта под курсором — по источнику и id', () => {
    const g = { type: 'Point', coordinates: [71.4, 51.1] }
    expect(highlightKey({ geometry: g, source: 'src', sourceLayer: 'uzel', featureId: 5 })).toBe('src|uzel|5')
    expect(highlightKey(null)).toBe('')
  })
})

describe('здания MapTiler и рельеф', () => {
  it('без рельефа — объёмы, с рельефом — плоские контуры под сетью', () => {
    expect(buildingsLayerVisibility(true, false)).toEqual({
      [CONTEXT_MAP_LAYER_IDS.buildings]: true,
      [CONTEXT_MAP_LAYER_IDS.buildingsFlat]: false,
      [CONTEXT_MAP_LAYER_IDS.buildingsLabel]: true,
    })
    expect(buildingsLayerVisibility(true, true)[CONTEXT_MAP_LAYER_IDS.buildings]).toBe(false)
    expect(buildingsLayerVisibility(true, true)[CONTEXT_MAP_LAYER_IDS.buildingsFlat]).toBe(true)
    expect(Object.values(buildingsLayerVisibility(false, true)).every((v) => !v)).toBe(true)
  })
})
