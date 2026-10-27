import { describe, expect, it } from 'vitest'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import {
  CASING_COLOR,
  CASING_ID_PREFIX,
  casingForPipe,
  isMagistralLayer,
  tuneNetworkStyleLayers,
  widenLineWidth,
  type StyleSubLayer,
} from '~/utils/networkStyleTuning'

const anyEq = (field: string, v: 0 | 1) => ['any', ['==', field, String(v)], ['==', field, v], ['==', field, v === 1]]

/** Подслои как в heatpipesections_gid после sanitize (server/api/geoserver-layers.ts) */
const highlight: StyleSubLayer = {
  id: 'Подсветка', type: 'line', minzoom: 9, filter: anyEq('warning', 1),
  paint: { 'line-color': '#ffff00', 'line-width': { stops: [[9, 3], [14, 6]] } },
}
const supplyDistribution: StyleSubLayer = {
  id: 'Подача распределительная', type: 'line', minzoom: 12,
  filter: ['all', anyEq('pod', 1), anyEq('mag_gid', 0)],
  layout: { 'line-join': 'round', 'line-cap': 'butt' },
  paint: {
    'line-color': '#7f0000',
    'line-width': { stops: [[12, 0.5], [16, 1.2]] },
    'line-offset': { stops: [[12, 0], [15, -0.9]] },
    'line-opacity': { stops: [[12, 0.55], [15, 1]] },
  },
}
const returnMagistral: StyleSubLayer = {
  id: 'Обратка магистральная надземная', type: 'line', minzoom: 9,
  filter: ['all', anyEq('obr', 1), anyEq('mag_gid', 1)],
  paint: {
    'line-color': '#00007f', 'line-width': { stops: [[9, 1], [16, 3]] },
    'line-offset': { stops: [[9, 0], [16, 2]] }, 'line-dasharray': [2, 1],
  },
}
const label: StyleSubLayer = {
  id: 'Ду', type: 'symbol', minzoom: 14, filter: ['>', ['to-number', ['get', 'du'], 0], 0],
  layout: { 'text-field': 'Ду {du}' }, paint: { 'text-color': '#3a3a3a' },
}

describe('подача линий сети', () => {
  it('ширина обводки — для числа, legacy stops и interpolate/step по зуму', () => {
    expect(widenLineWidth(1.5, 2)).toBe(3.5)
    expect(widenLineWidth({ stops: [[9, 1], [14, 2.4]] }, 2)).toEqual({ stops: [[9, 3], [14, 4.4]] })
    expect(widenLineWidth(['interpolate', ['linear'], ['zoom'], 10, 1, 16, 4], 2))
      .toEqual(['interpolate', ['linear'], ['zoom'], 10, 3, 16, 6])
    expect(widenLineWidth(['step', ['zoom'], 1, 14, 2], 2)).toEqual(['step', ['zoom'], 3, 14, 4])
    // Ширина по атрибуту — не угадываем, обводку не строим
    expect(widenLineWidth(['get', 'w'], 2)).toBeNull()
  })

  it('обводка повторяет фильтр, зумы и смещение, без пунктира; цвет трубы не меняется', () => {
    const casing = casingForPipe(returnMagistral)!
    expect(casing.id).toBe(`${CASING_ID_PREFIX}${returnMagistral.id}`)
    expect(casing.filter).toEqual(returnMagistral.filter)
    expect(casing.minzoom).toBe(9)
    expect(casing.paint!['line-color']).toBe(CASING_COLOR)
    expect(casing.paint!['line-offset']).toEqual(returnMagistral.paint!['line-offset'])
    expect(casing.paint!['line-width']).toEqual({ stops: [[9, 3], [16, 5]] })
    expect(casing.paint!['line-dasharray']).toBeUndefined()
    expect(returnMagistral.paint!['line-color']).toBe('#00007f')
    // Бледные на z12 распределительные — обводка так же бледная
    expect(casingForPipe(supplyDistribution)!.paint!['line-opacity']).toEqual(supplyDistribution.paint!['line-opacity'])
  })

  it('порядок: подсветка ПТС → обводки → распределительные → магистрали → подписи', () => {
    expect(isMagistralLayer(returnMagistral)).toBe(true)
    expect(isMagistralLayer(supplyDistribution)).toBe(false)
    const out = tuneNetworkStyleLayers([highlight, returnMagistral, supplyDistribution, label])
    expect(out.map((l) => l.id)).toEqual([
      'Подсветка',
      `${CASING_ID_PREFIX}Обратка магистральная надземная`,
      `${CASING_ID_PREFIX}Подача распределительная`,
      'Подача распределительная',
      'Обратка магистральная надземная',
      'Ду',
    ])
    // Исходные подслои — те же объекты, без изменений
    expect(out).toContain(returnMagistral)
  })

  it('стиль без линий подачи/обратки (здания, узлы) не трогается', () => {
    const fill: StyleSubLayer = { id: 'zd', type: 'fill', paint: { 'fill-color': '#eee' } }
    const layers = [fill, label]
    expect(tuneNetworkStyleLayers(layers)).toBe(layers)
  })

  it('результат — валидный стиль MapLibre', () => {
    const layers = tuneNetworkStyleLayers([highlight, returnMagistral, supplyDistribution, label])
    const style = {
      version: 8,
      glyphs: 'https://example.test/{fontstack}/{range}.pbf',
      sources: { s: { type: 'vector', tiles: ['https://example.test/{z}/{x}/{y}.pbf'] } },
      layers: layers.map((l, i) => ({ ...l, id: `l${i}`, source: 's', 'source-layer': 'heatpipesections' })),
    }
    expect(validateStyleMin(style as any)).toEqual([])
  })
})
