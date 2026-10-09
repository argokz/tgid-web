import { afterEach, describe, expect, it } from 'vitest'
import { appStorage, storageKey } from '~/utils/appStorage'

describe('appStorage', () => {
  afterEach(() => {
    delete (globalThis as any).__NUXT__
    localStorage.clear()
  })

  it('без префикса ключи прежние (Алматы)', () => {
    appStorage.setItem('visibleFragments', '[1]')
    expect(storageKey('visibleFragments')).toBe('visibleFragments')
    expect(localStorage.getItem('visibleFragments')).toBe('[1]')
  })

  it('с префиксом города настройки не пересекаются', () => {
    localStorage.setItem('visibleFragments', '[1]')
    ;(globalThis as any).__NUXT__ = { config: { public: { storagePrefix: 'astana' } } }
    expect(appStorage.getItem('visibleFragments')).toBeNull()
    appStorage.setItem('visibleFragments', '[2]')
    expect(localStorage.getItem('astana:visibleFragments')).toBe('[2]')
    expect(localStorage.getItem('visibleFragments')).toBe('[1]')
    appStorage.removeItem('visibleFragments')
    expect(localStorage.getItem('astana:visibleFragments')).toBeNull()
  })
})
