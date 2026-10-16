import { describe, expect, it } from 'vitest'
import { defaultFragments, keepExistingFragments, parseSavedFragments } from '~/utils/fragmentSelection'

describe('fragmentSelection', () => {
  it('keepExistingFragments: только существующие, без повторов, по возрастанию', () => {
    expect(keepExistingFragments([3243, 3252, 3252, 7], [3252, 7])).toEqual([7, 3252])
    expect(keepExistingFragments(['5', 0, -1, 'x'], [5])).toEqual([5])
    expect(keepExistingFragments(null, [1])).toEqual([])
  })

  it('parseSavedFragments: испорченное сохранение — пусто', () => {
    expect(parseSavedFragments('[3, 1, 3]')).toEqual([1, 3])
    expect(parseSavedFragments('{')).toEqual([])
    expect(parseSavedFragments(null)).toEqual([])
    expect(parseSavedFragments('"7"')).toEqual([])
  })

  it('defaultFragments: фрагменты города, если они есть', () => {
    expect(defaultFragments([1, 2, 3], [2, 9], [{ fileid: 3, has_results: true }])).toEqual([2])
  })

  it('defaultFragments: удалённый фрагмент города — фрагмент последнего расчёта с результатами', () => {
    const calcs = [
      { fileid: 3243, has_results: true }, // фрагмент удалён
      { fileid: 3252, has_results: false },
      { fileid: 3260, has_results: true },
    ]
    expect(defaultFragments([3252, 3260], [3243], calcs)).toEqual([3260])
  })

  it('defaultFragments: без результатов — последний расчёт, без расчётов — первый фрагмент', () => {
    expect(defaultFragments([10, 20], [], [{ fileid: 20, has_results: false }])).toEqual([20])
    expect(defaultFragments([10, 20], [], [])).toEqual([10])
    expect(defaultFragments([], [1], [{ fileid: 1, has_results: true }])).toEqual([])
  })
})
