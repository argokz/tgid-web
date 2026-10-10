import { describe, expect, it, vi } from 'vitest'
import { nearestGroup, queryRenderedNear, screenDistance } from '../../utils/mapPick'

// Координаты в тестах — сразу пиксели экрана (project — тождество)
const project = ([x, y]: [number, number]) => ({ x, y })

const node = (id: number, x: number, y: number, layerType = 'symbol') => ({
  id,
  layer: { id: 'mvt__AstanaGIS__uzel-51-US-17-point-1', type: layerType },
  geometry: { type: 'Point', coordinates: [x, y] },
})
const pipe = (id: number, coords: number[][]) => ({
  id,
  layer: { id: 'mvt__AstanaGIS__heatpipesections-3-Подача', type: 'line' },
  geometry: { type: 'LineString', coordinates: coords },
})
const building = (id: number) => ({
  id,
  layer: { id: 'zdaniya', type: 'fill' },
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]] },
})

const mapWith = (inBox: any[], atPoint: any[] = []) => ({
  queryRenderedFeatures: vi.fn((where: any) => (Array.isArray(where[0]) ? inBox : atPoint)),
  project: vi.fn(project),
})

describe('screenDistance', () => {
  it('узел: попадание в пределах значка — 0, дальше — расстояние от края значка', () => {
    expect(screenDistance({ type: 'Point', coordinates: [50, 50] }, { x: 54, y: 50 }, project, 8)).toBe(0)
    expect(screenDistance({ type: 'Point', coordinates: [50, 50] }, { x: 60, y: 50 }, project, 8)).toBe(4)
  })

  it('участок: расстояние до ближайшего отрезка за вычетом толщины линии', () => {
    const line = { type: 'LineString', coordinates: [[0, 0], [100, 0]] }
    expect(screenDistance(line, { x: 50, y: 2 }, project, 8)).toBe(0)
    expect(screenDistance(line, { x: 50, y: 7 }, project, 8)).toBe(4)
    // за концом отрезка — до конечной точки
    expect(screenDistance(line, { x: 106, y: 8 }, project, 8)).toBe(7)
  })

  it('полигон под курсором — в конце очереди (radius): сеть поверх зданий важнее', () => {
    expect(screenDistance(building(1).geometry, { x: 50, y: 50 }, project, 8)).toBe(8)
  })
})

describe('queryRenderedNear', () => {
  it('ищет в квадрате ±radius, отбрасывает дальние и сортирует по расстоянию', () => {
    const far = node(3, 70, 70)
    const map = mapWith([pipe(10, [[0, 55], [100, 55]]), node(2, 52, 50), far, building(7)])
    const found = queryRenderedNear(map, { x: 50, y: 50 }, { radius: 8 })
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith([[42, 42], [58, 58]])
    expect(found.map((f) => f.id)).toEqual([2, 10, 7])
    expect(found.map((f) => f._pickDistance)).toEqual([0, 2, 8])
  })

  it('клик по тексту подписи узла выбирает узел, даже если точка узла дальше допуска', () => {
    const label = node(5, 80, 50)
    const sameLabelAtPoint = node(5, 80, 50)
    const map = mapWith([label], [sameLabelAtPoint])
    const found = queryRenderedNear(map, { x: 50, y: 50 }, { radius: 8 })
    expect(found.map((f) => [f.id, f._pickDistance])).toEqual([[5, 0]])
  })
})

describe('nearestGroup', () => {
  it('на значке узла — только узлы (концы участков под значком не дают меню)', () => {
    const features = [
      { ...node(1, 0, 0), _pickDistance: 0 },
      { ...pipe(10, []), _pickDistance: 0 },
      { ...pipe(11, []), _pickDistance: 0 },
    ]
    expect(nearestGroup(features).map((f) => f.id)).toEqual([1])
  })

  it('без попадания в значок — ближайший и равноудалённые с ним (копии во фрагментах)', () => {
    const features = [
      { ...pipe(10, []), _pickDistance: 1 },
      { ...pipe(11, []), _pickDistance: 2.5 },
      { ...node(1, 0, 0), _pickDistance: 6 },
    ]
    expect(nearestGroup(features).map((f) => f.id)).toEqual([10, 11])
    expect(nearestGroup([])).toEqual([])
  })
})
