import { describe, expect, it } from 'vitest'
import { pumpModelOptions, withCurrentOption } from '~/utils/pumpModels'

describe('pump model options (QA F49)', () => {
  it('builds catalog options with type, name and producer', () => {
    const options = pumpModelOptions([
      { id: 58, pump_type: 'Д2500-60', name: 'насос', producer: 'Сумской' },
      { id: 6, pump_type: 'Д2000-100', name: null },
      { id: 0, pump_type: 'bad' },
      { id: 7 },
    ])
    expect(options).toEqual([
      { id: 6, name: 'Д2000-100' },
      { id: 58, name: 'Д2500-60 · насос (Сумской)' },
      { id: 7, name: 'Модель №7' },
    ])
  })

  it('keeps the current model before the catalog is loaded', () => {
    expect(withCurrentOption([], 6, 'Д2000-100')).toEqual([{ id: 6, name: 'Д2000-100' }])
    expect(withCurrentOption([{ id: 6, name: 'x' }], 6)).toEqual([{ id: 6, name: 'x' }])
    expect(withCurrentOption([], null)).toEqual([])
  })
})
