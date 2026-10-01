import { describe, expect, it } from 'vitest'
import { heatConsumptionRows } from '~/utils/heatConsumption'

describe('heatConsumptionRows (Zap3/4/5, QA F34)', () => {
  it('нагрузка n_* в Гкал/ч, расход q_* в т/ч, как в TeplopotrBox десктопа', () => {
    const rows = heatConsumptionRows({ n_otz: 44, q_otz: 32627 })
    expect(rows).toHaveLength(14)
    const byKey = Object.fromEntries(rows.map(r => [r.key, r]))
    expect(byKey.n_otz.label).toBe('Нагрузка на отопление, зависимое присоед., Гкал/ч')
    expect(byKey.n_otz.value).toBe(44)
    expect(byKey.q_otz.label).toBe('Расход на отопление, зависимое присоед., т/ч')
    expect(byKey.q_otz.value).toBe(32627)
    for (const r of rows) {
      expect(r.label.endsWith(r.key.startsWith('n_') ? 'Гкал/ч' : 'т/ч')).toBe(true)
    }
  })

  it('отсутствующие итоги — null', () => {
    expect(heatConsumptionRows(null).every(r => r.value === null)).toBe(true)
  })
})
