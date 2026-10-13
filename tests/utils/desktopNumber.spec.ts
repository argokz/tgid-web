import { describe, expect, it } from 'vitest'
import { formatDesktopNumber } from '~/utils/desktopNumber'

describe('formatDesktopNumber — как QLocale("ru_RU").toString(double) в десктопе', () => {
  it('6 значащих цифр, запятая, без хвостовых нулей', () => {
    expect(formatDesktopNumber(3.1461942190349745)).toBe('3,14619')
    expect(formatDesktopNumber(106.80047389631034)).toBe('106,8')
    expect(formatDesktopNumber(39.49538721147914)).toBe('39,4954')
    expect(formatDesktopNumber(0.5)).toBe('0,5')
    expect(formatDesktopNumber(-12.3456789)).toBe('-12,3457')
    expect(formatDesktopNumber(9.9999996)).toBe('10')
  })

  it('экспонента, как у формата g', () => {
    expect(formatDesktopNumber(0.0000123456)).toBe('1,23456e-05')
    expect(formatDesktopNumber(0.000123)).toBe('0,000123')
    expect(formatDesktopNumber(1234567.5)).toBe('1,23457e+06')
  })

  it('целые — как есть', () => {
    expect(formatDesktopNumber(136)).toBe('136')
    expect(formatDesktopNumber(37385092)).toBe('37385092')
    expect(formatDesktopNumber(0)).toBe('0')
  })
})
