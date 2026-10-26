import { afterEach, describe, expect, it } from 'vitest'
import { readCssPx, shellTopPx, SHELL_TOP_FALLBACK_PX } from '~/utils/shellMetrics'

describe('shellMetrics: размеры каркаса из CSS-токенов', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--shell-top')
  })

  it('читает высоту шапки из --shell-top', () => {
    document.documentElement.style.setProperty('--shell-top', '48px')
    expect(shellTopPx()).toBe(48)
    document.documentElement.style.setProperty('--shell-top', '0px')
    expect(shellTopPx()).toBe(0)
  })

  it('без токена или не в px — запасное значение', () => {
    expect(shellTopPx()).toBe(SHELL_TOP_FALLBACK_PX)
    document.documentElement.style.setProperty('--shell-top', 'calc(10px + 2px)')
    expect(readCssPx('--shell-top', 7)).toBe(7)
  })
})
