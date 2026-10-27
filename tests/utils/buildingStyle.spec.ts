import { describe, expect, it } from 'vitest'
import {
  BUILDING_CLASS_COLORS,
  BUILDING_DEFAULT_COLOR,
  BUILDING_OPACITY,
  BUILDINGS_3D_MIN_PITCH,
  buildingColorExpression,
  buildingExtrusionPaint,
  buildingFlatColorExpression,
  contextHoverSummary,
  lightenTowardsBackground,
} from '~/utils/buildingStyle'
import {
  applyBuildingsPitchMode,
  buildingsOpacity,
  CONTEXT_MAP_LAYER_IDS,
  contextKeyLayerIds,
  isBuildings3dPitch,
} from '~/utils/contextMapLayers'

describe('здания MapTiler', () => {
  it('высота — из height/height_min тайлов MapTiler, цвет — по назначению', () => {
    const paint = buildingExtrusionPaint(0.8)
    expect(paint['fill-extrusion-height'][1]).toEqual(['get', 'height'])
    expect(paint['fill-extrusion-base'][1]).toEqual(['get', 'height_min'])
    const color = buildingColorExpression()
    expect(color.slice(0, 2)).toEqual(['match', ['get', 'class']])
    expect(color[color.indexOf('medical') + 1]).toBe(BUILDING_CLASS_COLORS.medical)
    expect(color[color.length - 1]).toBe(BUILDING_DEFAULT_COLOR)
  })

  it('с рельефом 3D объёмы остаются, но полупрозрачные', () => {
    expect(buildingsOpacity(false)).toBe(BUILDING_OPACITY.flat)
    expect(buildingsOpacity(true)).toBe(BUILDING_OPACITY.terrain)
    expect(BUILDING_OPACITY.terrain).toBeLessThan(BUILDING_OPACITY.flat)
    expect(contextKeyLayerIds('buildings')).toEqual([
      CONTEXT_MAP_LAYER_IDS.buildingsFlat, CONTEXT_MAP_LAYER_IDS.buildings, CONTEXT_MAP_LAYER_IDS.buildingsLabel,
    ])
    expect(contextKeyLayerIds('contours')).toContain(CONTEXT_MAP_LAYER_IDS.contoursLabel)
    expect(contextKeyLayerIds('terrain3d')).toEqual([])
  })

  it('в плане цвет назначения осветлён к фону подложки', () => {
    expect(lightenTowardsBackground('#000000', 1)).toBe('#f0ede6')
    expect(lightenTowardsBackground('#cfc6b4', 0)).toBe('#cfc6b4')
    expect(lightenTowardsBackground('rgb(0,0,0)')).toBe('rgb(0,0,0)')
    const flat = buildingFlatColorExpression()
    const residential = flat[flat.indexOf('residential') + 1]
    expect(residential).toBe(lightenTowardsBackground(BUILDING_CLASS_COLORS.residential))
    expect(residential).not.toBe(BUILDING_CLASS_COLORS.residential)
  })

  it('объём — только при наклоне карты, в плане — заливка', () => {
    expect(isBuildings3dPitch(0)).toBe(false)
    expect(isBuildings3dPitch(BUILDINGS_3D_MIN_PITCH)).toBe(true)
    const visibility: Record<string, string> = {}
    let pitch = 0
    const map = {
      getPitch: () => pitch,
      getLayer: () => ({}),
      setLayoutProperty: (id: string, _k: string, v: string) => { visibility[id] = v },
    } as any
    applyBuildingsPitchMode(map, true)
    expect(visibility[CONTEXT_MAP_LAYER_IDS.buildingsFlat]).toBe('visible')
    expect(visibility[CONTEXT_MAP_LAYER_IDS.buildings]).toBe('none')
    pitch = 45
    applyBuildingsPitchMode(map, true)
    expect(visibility[CONTEXT_MAP_LAYER_IDS.buildingsFlat]).toBe('none')
    expect(visibility[CONTEXT_MAP_LAYER_IDS.buildings]).toBe('visible')
    applyBuildingsPitchMode(map, false)
    expect(visibility[CONTEXT_MAP_LAYER_IDS.buildings]).toBe('none')
  })

  it('подсказка здания: назначение, высота и этажность, крыша', () => {
    const s = contextHoverSummary({
      sourceLayer: 'building',
      properties: { class: 'residential', subclass: 'apartments', height: 45, height_min: 0, roof_shape: 'hipped', facade_color: '#DFD5B9' },
    })!
    expect(s.title).toBe('Здание')
    expect(s.rows.map((r) => `${r.label}: ${r.value}`)).toEqual([
      'Назначение: Жилое, многоквартирный дом',
      'Высота: 45 м (≈15 эт.)',
      'Крыша: вальмовая',
      'Фасад: #DFD5B9',
    ])
  })

  it('подсказка изолинии: высота и предупреждение о точности', () => {
    const s = contextHoverSummary({ sourceLayer: 'contour', properties: { height: 820, nth_line: 10 } })!
    expect(s.rows).toEqual([{ label: 'Высота', value: '820 м' }])
    expect(s.note).toMatch(/отметок земли/)
    expect(contextHoverSummary({ sourceLayer: 'water', properties: {} })).toBeNull()
  })
})
