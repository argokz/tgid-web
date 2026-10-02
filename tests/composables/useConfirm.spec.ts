import { afterEach, describe, expect, it } from 'vitest'
import { confirmAction, confirmState, settleConfirm, useConfirm } from '~/composables/useConfirm'
import { pluralRu } from '~/utils/pluralRu'

describe('useConfirm (QA F45)', () => {
  afterEach(() => settleConfirm(false))

  it('показывает вопрос и возвращает true по кнопке действия', async () => {
    const answer = confirmAction({ text: 'Удалить запись №123?', action: 'Удалить' })
    expect(confirmState.visible).toBe(true)
    expect(confirmState.text).toBe('Удалить запись №123?')
    expect(confirmState.color).toBe('error')
    settleConfirm(true)
    await expect(answer).resolves.toBe(true)
    expect(confirmState.visible).toBe(false)
  })

  it('отмена (кнопка, Esc, клик мимо) → false', async () => {
    const answer = useConfirm().confirm('Утвердить 2 плана?')
    expect(confirmState.color).toBe('primary')
    expect(confirmState.title).toBe('Подтверждение')
    settleConfirm(false)
    await expect(answer).resolves.toBe(false)
  })

  it('новый вопрос поверх открытого отменяет прежний', async () => {
    const first = confirmAction('Первый?')
    const second = confirmAction('Второй?')
    await expect(first).resolves.toBe(false)
    expect(confirmState.text).toBe('Второй?')
    settleConfirm(true)
    await expect(second).resolves.toBe(true)
  })

  it('не использует window.confirm', async () => {
    const native = window.confirm
    let called = false
    window.confirm = () => { called = true; return true }
    const answer = confirmAction('Удалить?')
    settleConfirm(true)
    await answer
    window.confirm = native
    expect(called).toBe(false)
  })
})

describe('pluralRu (QA F68)', () => {
  it.each([
    [1, 'план'], [2, 'плана'], [5, 'планов'], [11, 'планов'], [21, 'план'], [22, 'плана'], [112, 'планов'],
  ])('%i → %s', (n, word) => {
    expect(pluralRu(n, ['план', 'плана', 'планов'])).toBe(word)
  })
})
