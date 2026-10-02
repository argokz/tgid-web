import { describe, expect, it } from 'vitest'
import { fragmentScopeItems } from '~/utils/fragmentScope'

describe('fragmentScopeItems (QA F60)', () => {
  it('lists fragments with name and id, dedups and skips bad ids', () => {
    const items = fragmentScopeItems([
      { id: 74, name: 'Центр' },
      { id: '75' },
      { id: 74, name: 'dup' },
      { id: 0, name: 'bad' },
    ])
    expect(items).toEqual([
      { value: 74, title: 'Центр (#74)' },
      { value: 75, title: 'Фрагмент #75' },
    ])
  })

  it('keeps selected ids that are not loaded yet', () => {
    const items = fragmentScopeItems([], [74])
    expect(items).toEqual([{ value: 74, title: 'Фрагмент #74' }])
  })
})
