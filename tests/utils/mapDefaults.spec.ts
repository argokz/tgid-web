import { afterEach, describe, expect, it } from 'vitest'
import { MAP_DEFAULTS_VERSION, resetStaleMapPrefs } from '~/utils/mapDefaults'

describe('resetStaleMapPrefs', () => {
  afterEach(() => {
    delete (globalThis as any).__NUXT__
    localStorage.clear()
  })

  it('стирает выбор, сделанный до новых умолчаний, один раз', () => {
    localStorage.setItem('selectedBaseLayer', 'stadia')
    localStorage.setItem('baseLayer', 'stadia')
    localStorage.setItem('visibleContextLayers', '["contours"]')
    localStorage.setItem('visibleFragments', '[1]')
    resetStaleMapPrefs()
    expect(localStorage.getItem('selectedBaseLayer')).toBeNull()
    expect(localStorage.getItem('baseLayer')).toBeNull()
    expect(localStorage.getItem('visibleContextLayers')).toBeNull()
    expect(localStorage.getItem('visibleFragments')).toBe('[1]')
    expect(localStorage.getItem('mapDefaults_v')).toBe(MAP_DEFAULTS_VERSION)

    // выбор после сброса сохраняется
    localStorage.setItem('selectedBaseLayer', 'hybrid-v4')
    resetStaleMapPrefs()
    expect(localStorage.getItem('selectedBaseLayer')).toBe('hybrid-v4')
  })

  it('у каждого города свой сброс', () => {
    ;(globalThis as any).__NUXT__ = { config: { public: { storagePrefix: 'astana' } } }
    localStorage.setItem('astana:selectedBaseLayer', 'osm')
    localStorage.setItem('selectedBaseLayer', 'osm')
    resetStaleMapPrefs()
    expect(localStorage.getItem('astana:selectedBaseLayer')).toBeNull()
    expect(localStorage.getItem('selectedBaseLayer')).toBe('osm')
  })
})
