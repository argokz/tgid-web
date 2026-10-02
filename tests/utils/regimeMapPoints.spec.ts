import { describe, expect, it } from 'vitest'
import { regimePoints } from '~/utils/regimeMapPoints'

describe('regimePoints (QA F39)', () => {
  it('собирает точки с координатами и охват, строки без координат пропускает', () => {
    const res = regimePoints([
      { latitude: 43.2, longitude: 76.9 },
      { latitude: null, longitude: 76.8 },
      { latitude: 43.3, longitude: 77.0 },
    ])
    expect(res.data.features).toHaveLength(2)
    expect(res.bounds).toEqual([[76.9, 43.2], [77.0, 43.3]])
  })

  it('пустой результат — без охвата', () => {
    expect(regimePoints([]).bounds).toBeNull()
  })
})
