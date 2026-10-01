import { describe, expect, it } from 'vitest'
import { tnRangeHint, tnValidationError } from '~/utils/calcTemperature'

const almaty = { t_or: -25, t_vnew: 8 }

describe('tnValidationError', () => {
  it('принимает Tн в диапазоне системы теплоснабжения', () => {
    expect(tnValidationError('-25', almaty)).toBeNull()
    expect(tnValidationError('8', almaty)).toBeNull()
    expect(tnValidationError('0', almaty)).toBeNull()
  })

  it('отклоняет -32 при t_or = -25 (QA F26), как sety', () => {
    expect(tnValidationError('-32', almaty)).toMatch('от -25 до 8')
    expect(tnValidationError('9', almaty)).toMatch('от -25 до 8')
  })

  it('летний режим и неизвестный диапазон проверяет только по абсолютным границам', () => {
    expect(tnValidationError('-32', almaty, true)).toBeNull()
    expect(tnValidationError('-32', null)).toBeNull()
    expect(tnValidationError('-61', null)).toMatch('от -60 до 50')
    expect(tnValidationError('', almaty)).toMatch('числом')
    expect(tnValidationError('abc', almaty, true)).toMatch('числом')
  })

  it('подсказка с диапазоном', () => {
    expect(tnRangeHint(almaty)).toBe('Допустимо от -25 до 8 °C (система теплоснабжения)')
    expect(tnRangeHint(null)).toBe('')
  })
})
