import { describe, expect, it } from 'vitest'
import { combineWithFragmentFilter, fragmentFilterFor, isExpressionFilter } from '~/utils/mapFragmentFilter'

describe('фильтр фрагмента MVT (QA F23)', () => {
  it('распознаёт синтаксис исходного фильтра', () => {
    expect(isExpressionFilter(['==', ['get', 'type'], 2])).toBe(true)
    expect(isExpressionFilter(['==', 'type', 2])).toBe(false)
    expect(isExpressionFilter(['in', 'fileID', 1, 2])).toBe(false)
    expect(isExpressionFilter(['all', ['>=', ['zoom'], 14], ['has', 'name']])).toBe(true)
  })

  it('к выражению (zdaniya_2) приклеивается фильтр-выражение, к legacy — legacy', () => {
    const expr = combineWithFragmentFilter(['==', ['get', 'kind'], 'house'], [74])
    expect(expr[0]).toBe('all')
    expect(isExpressionFilter(expr)).toBe(true)
    expect(expr[2][1]).toEqual(['in', ['to-string', ['get', 'fileID']], ['literal', ['74']]])
    const legacy = combineWithFragmentFilter(['==', 'kind', 'house'], [74])
    expect(isExpressionFilter(legacy[2])).toBe(false)
    expect(legacy[2][1]).toEqual(['in', 'fileID', 74, '74'])
  })

  it('без исходного фильтра и без фрагментов', () => {
    expect(combineWithFragmentFilter(null, [])).toBeNull()
    expect(combineWithFragmentFilter(null, [5])).toEqual(fragmentFilterFor([5], false))
  })
})
