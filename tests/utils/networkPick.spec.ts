import { describe, expect, it } from 'vitest'
import {
  collectNetworkCandidates,
  describeMenuFeature,
  getNetworkFeatureKind,
  pickNetworkFeature,
} from '../../utils/networkFeature'

// QA F53/F28: в точке узла 535475 (ф74, «2-76») MVT `uzel` отдаёт копии узла из фрагментов
// 4/74/89/1/99, а `heatpipesections` — копии участков. Первый под курсором — узел 13402 ф4.
const uzel = (id: number, fileid: number, layer = 'mvt__AlmatyGIS__uzel-6-rule-7-point-1', tab = 'generalizedconsumers') => ({
  id,
  layer: { id: layer, 'source-layer': 'uzel' },
  sourceLayer: 'uzel',
  properties: { code: 'PO', fileid, tab, name: '2-76' },
  geometry: { type: 'Point', coordinates: [76.8928, 43.23295] },
})
const pipe = (id: number, fileid: number) => ({
  id,
  layer: { id: 'mvt__AlmatyGIS__heatpipesections-2-Магистральные подземные', 'source-layer': 'heatpipesections' },
  sourceLayer: 'heatpipesections',
  properties: { code: 'UT', fileid, name: 'М2 2-76 - М2 2-77' },
  geometry: { type: 'LineString', coordinates: [[76.8928, 43.23295], [76.892, 43.2329]] },
})
const AT_NODE_535475 = [
  uzel(13402, 4),
  uzel(13402, 4, 'mvt__AlmatyGIS__uzel-7-rule-8-text-1'), // подпись того же узла
  uzel(535475, 74),
  uzel(584834, 89),
  uzel(888, 1),
  uzel(604090, 99),
  pipe(11483, 4),
  pipe(387490, 99),
  pipe(381, 1),
  pipe(324388, 74),
  pipe(370367, 89),
]

describe('getNetworkFeatureKind', () => {
  it('узлы и участки только слоёв сети; прочие точки/линии и оверлеи — нет', () => {
    expect(getNetworkFeatureKind(uzel(1, 74))).toBe('node')
    expect(getNetworkFeatureKind(pipe(1, 74))).toBe('line')
    expect(getNetworkFeatureKind({ layer: { id: 'mvt__Almaty2__ns_tep' }, geometry: { type: 'Point' } })).toBeNull()
    expect(getNetworkFeatureKind({ layer: { id: 'mvt__AlmatyGIS__zdaniya_2' }, geometry: { type: 'Polygon' } })).toBeNull()
    expect(getNetworkFeatureKind({ layer: { id: 'piezo-route-nodes' }, geometry: { type: 'Point' } })).toBeNull()
    expect(getNetworkFeatureKind({ layer: { id: 'topology-vertex-points' }, geometry: { type: 'Point' } })).toBeNull()
  })
})

describe('collectNetworkCandidates', () => {
  it('по одному кандидату на объект, в порядке отрисовки, с фрагментом и ролью', () => {
    const nodes = collectNetworkCandidates(AT_NODE_535475, 'node')
    expect(nodes.map((c) => c.id)).toEqual([13402, 535475, 584834, 888, 604090])
    expect(nodes[1]).toMatchObject({ kind: 'node', fragmentId: 74, tab: 'generalizedconsumers' })
    expect(collectNetworkCandidates(AT_NODE_535475, 'line').map((c) => c.id)).toEqual([11483, 387490, 381, 324388, 370367])
  })

  it('feature query-слоя id_* (id чужой таблицы) не кандидат', () => {
    const q = { ...pipe(141949, 74), sourceLayer: 'id_heatpipesections', layer: { id: 'id_heatpipesections' } }
    expect(collectNetworkCandidates([q], 'line')).toEqual([])
  })
})

describe('pickNetworkFeature', () => {
  it('без контекста копии в нескольких фрагментах — неоднозначно (меню), а не первый под курсором', () => {
    const res = pickNetworkFeature(AT_NODE_535475, { kind: 'node' })
    expect(res.status).toBe('ambiguous')
    expect(res.candidates).toHaveLength(5)
  })

  it('активный фрагмент 74: узел 535475 и участок 324388 (QA F28, F53)', () => {
    const node = pickNetworkFeature(AT_NODE_535475, { kind: 'node', fragmentIds: [74] })
    expect(node.status).toBe('single')
    expect(node.candidate?.id).toBe(535475)
    const line = pickNetworkFeature(AT_NODE_535475, { kind: 'line', fragmentIds: [74], strictFragment: true })
    expect(line.candidate?.id).toBe(324388)
  })

  it('строгий режим: только объекты чужих фрагментов — отказ с перечнем', () => {
    const res = pickNetworkFeature(AT_NODE_535475, { kind: 'node', fragmentIds: [50], strictFragment: true })
    expect(res.status).toBe('none')
    if (res.status !== 'none') return
    expect(res.reason).toBe('other-fragment')
    expect(res.others.map((c) => c.fragmentId)).toEqual([4, 74, 89, 1, 99])
  })

  it('нестрогий режим: вне контекста — все кандидаты', () => {
    const res = pickNetworkFeature([uzel(13402, 4)], { kind: 'node', fragmentIds: [74] })
    expect(res.status).toBe('single')
    expect(res.candidate?.id).toBe(13402)
  })

  it('исключение ролей узла и пустой результат', () => {
    const plain = uzel(700, 74, 'mvt__AlmatyGIS__uzel-0-rule-1-point-1', 'nodes')
    const res = pickNetworkFeature([uzel(535475, 74), plain], {
      kind: 'node', fragmentIds: [74], excludeTabs: ['generalizedconsumers'],
    })
    expect(res.candidate?.id).toBe(700)
    expect(pickNetworkFeature([], { kind: 'line' })).toMatchObject({ status: 'none', reason: 'empty' })
    expect(pickNetworkFeature(AT_NODE_535475.filter((f) => f.geometry.type === 'Point'), { kind: 'line' }).status).toBe('none')
  })
})

describe('подписи меню выбора (QA F69)', () => {
  it('нормализованный MVT-feature: id из _sourceId, а не id (= fileid)', () => {
    const normalized = { ...pipe(324388, 74), id: 74, _sourceId: 324388 }
    expect(describeMenuFeature(normalized)).toEqual(['Фрагмент 74', 'участок 324388'])
    expect(describeMenuFeature({ ...uzel(535475, 74), id: 74, _sourceId: 535475 })).toEqual(['Фрагмент 74', 'узел 535475'])
  })

  it('identify хранит feature без геометрии — вид по типу стилевого слоя', () => {
    const { geometry, ...rest } = pipe(387490, 99)
    const normalized = { ...rest, layer: { ...rest.layer, type: 'line' }, id: 99, _sourceId: 387490 }
    expect(geometry.type).toBe('LineString')
    expect(describeMenuFeature(normalized)).toEqual(['Фрагмент 99', 'участок 387490'])
  })

  it('WMS/query-слой: таблица и id строки', () => {
    const wms = { id: 'generalizedconsumers.22397', _sourceId: 'generalizedconsumers.22397', properties: { fileid: 74 } }
    expect(describeMenuFeature(wms)).toEqual(['Фрагмент 74', 'Таблица: generalizedconsumers', 'ID: 22397'])
  })
})
