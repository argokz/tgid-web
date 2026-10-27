import { describe, expect, it } from 'vitest'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import {
  PLANET_PALETTE,
  PLANET_V4_LAYERS,
  PLANET_V4_SOURCE_PAINT_ORDER,
} from '~/utils/planetV4Layers'

const SOURCE_ID = 'base-planet-source'

function allLayers() {
  return PLANET_V4_LAYERS.flatMap((def) => def.buildLayers(SOURCE_ID).map((l) => ({ ...l, source: SOURCE_ID })))
}

describe('подложка MapTiler Planet v4', () => {
  it('все слои — валидный стиль MapLibre', () => {
    const style = {
      version: 8,
      glyphs: 'https://example.test/fonts/{fontstack}/{range}.pbf',
      sources: { [SOURCE_ID]: { type: 'vector', tiles: ['https://example.test/{z}/{x}/{y}.pbf'] } },
      layers: allLayers(),
    }
    expect(validateStyleMin(style as any)).toEqual([])
  })

  it('каждый source-layer стоит в порядке отрисовки, id не повторяются', () => {
    for (const def of PLANET_V4_LAYERS) expect(PLANET_V4_SOURCE_PAINT_ORDER).toContain(def.sourceLayer)
    const ids = allLayers().map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('по умолчанию — детальная подложка: зелень, землепользование, водотоки, ж/д, районы, номера домов', () => {
    const on = new Set(PLANET_V4_LAYERS.filter((d) => d.defaultVisible).map((d) => d.sourceLayer))
    for (const sl of ['water', 'waterway', 'grass', 'wood', 'leisure', 'residential', 'industrial', 'road',
      'road_label', 'railway', 'place_label', 'building_number', 'poi_healthcare']) {
      expect(on.has(sl), sl).toBe(true)
    }
    // Плоские здания подложки — дубль «Зданий» контекста
    expect(on.has('building')).toBe(false)
    // Цветные POI-категории и шумные слои по умолчанию выключены
    expect(on.has('poi_food')).toBe(false)
    expect(on.has('tree')).toBe(false)
  })

  it('дороги без кричащих цветов: магистрали — из палитры, не #ffa35c', () => {
    const road = allLayers().find((l) => l.id === 'base-planet-road') as any
    const colors = JSON.stringify(road.paint['line-color'])
    expect(colors).toContain(PLANET_PALETTE.roadMotorway)
    expect(colors).not.toContain('#ffa35c')
  })

  it('POI — серые точки с z16, кроме станций', () => {
    const poi = allLayers().filter((l: any) => l['source-layer']?.startsWith('poi_') && l.type === 'circle') as any[]
    expect(poi.length).toBeGreaterThan(5)
    for (const l of poi) {
      expect(l.paint['circle-color']).toBe(PLANET_PALETTE.poi)
      if (l['source-layer'] !== 'poi_station') expect(l.minzoom).toBe(16)
    }
  })
})
