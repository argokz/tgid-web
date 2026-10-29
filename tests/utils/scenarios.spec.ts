import { describe, expect, it } from 'vitest'
import type { ScenarioRegimeItem } from '~/services/api/types'
import { resolveMdiSvgPath } from '~/utils/mdiSvgPaths'
import {
  SCENARIO_KIND_META,
  SCENARIO_REGIME_META,
  formatScenarioValue,
  isScenarioEdit,
  scenarioFieldsText,
  scenarioKindCounts,
  scenarioObjectTitle,
  scenarioRegimeText,
  scenarioRegimeTitle,
  scenarioTableLabel,
} from '~/utils/scenarios'

describe('scenarios', () => {
  it('текст отличий: подписи полей, пустые значения, новые объекты', () => {
    expect(scenarioFieldsText({ diametercondit: [300, 400], nodeid2: [2, 'новый #150'], memo: [null, 'x'] }))
      .toBe('Ду: 300 → 400; узел конца: 2 → новый #150; memo: — → x')
    expect(scenarioFieldsText(null)).toBe('')
    expect(formatScenarioValue(0.1 + 0.2)).toBe('0.3')
    expect(formatScenarioValue('')).toBe('—')
  })

  it('заголовок объекта: номер основы, у нового — номер в сценарии', () => {
    expect(scenarioObjectTitle({ table: 'linesobj', base_id: 324074, copy_id: 397216, name: null }))
      .toBe('Участок №324074')
    expect(scenarioObjectTitle({ table: 'nodes', base_id: null, copy_id: 610001, name: 'ТК-5' }))
      .toBe('Узел №610001 (новый) «ТК-5»')
    expect(scenarioTableLabel('unknown_table')).toBe('unknown_table')
  })

  it('счётчики по видам — в порядке правки сценария → основа, без нулей', () => {
    const rows = scenarioKindCounts({ base_changed: 2, changed: 5, conflict: 0, removed: 1 })
    expect(rows.map((r) => [r.kind, r.count])).toEqual([['changed', 5], ['removed', 1], ['base_changed', 2]])
    expect(scenarioKindCounts(undefined)).toEqual([])
  })

  it('правки сценария отличаются от изменений основы', () => {
    expect(isScenarioEdit('conflict')).toBe(true)
    expect(isScenarioEdit('base_added')).toBe(false)
  })

  it('все иконки зарегистрированы', () => {
    for (const meta of Object.values(SCENARIO_KIND_META)) {
      expect(resolveMdiSvgPath(meta.icon), meta.icon).toBeTruthy()
    }
  })
})

describe('scenarios: режим', () => {
  it('текст потребителя и участка, нет результата — прочерк', () => {
    const consumer: ScenarioRegimeItem = {
      object: 'consumer', kind: 'lost', base_id: 536426, copy_id: 606565, anchor_type: 'node', anchor_id: 606565,
      name: 'ТК-5', head: [30.04, null], supply: [105.2, null], flow: [10, null], lat: null, lng: null,
    }
    expect(scenarioRegimeText(consumer)).toBe('напор 30 → — м · обеспеченность 105 → — % · расход 10 → — т/ч')
    expect(scenarioRegimeTitle(consumer)).toBe('Потребитель, узел №536426 «ТК-5»')
    const line: ScenarioRegimeItem = {
      object: 'line', kind: 'changed', base_id: null, copy_id: 404768, anchor_type: 'line', anchor_id: 404768,
      name: null, flow: [952.06, 900.5], velocity: [0.334, 0.31], loss: [1, 0.9], lat: null, lng: null,
    }
    expect(scenarioRegimeTitle(line)).toBe('Участок №404768 (новый)')
    expect(scenarioRegimeText(line)).toBe('расход 952,1 → 900,5 т/ч · скорость 0,33 → 0,31 м/с · потери 1 → 0,9 Па/м')
  })

  it('иконки видов режима зарегистрированы', () => {
    for (const meta of Object.values(SCENARIO_REGIME_META)) {
      expect(resolveMdiSvgPath(meta.icon), meta.icon).toBeTruthy()
    }
  })
})
