import { describe, expect, it } from 'vitest'
import { ALMATY_BBOX, ALMATY_CENTER, getCityConfig, parseBbox, parseCenter, readCityConfig } from '~/utils/cityConfig'

describe('настройки города стенда', () => {
  it('по умолчанию — Алматы и AlmatyGIS', () => {
    expect(readCityConfig({})).toEqual({ bbox: ALMATY_BBOX, center: ALMATY_CENTER, workspace: 'AlmatyGIS' })
    // вне Nuxt (useRuntimeConfig нет) — то же
    expect(getCityConfig().workspace).toBe('AlmatyGIS')
  })

  it('Астана: охват, центр из охвата и workspace первого пункта каталога', () => {
    const cfg = readCityConfig({ cityBbox: '71.05,50.94,71.79,51.37', geoserver: { workspace: 'AstanaGIS' } })
    expect(cfg.bbox).toEqual([71.05, 50.94, 71.79, 51.37])
    expect(cfg.center[0]).toBeCloseTo(71.42)
    expect(cfg.center[1]).toBeCloseTo(51.155)
    expect(cfg.workspace).toBe('AstanaGIS')
    expect(readCityConfig({ cityBbox: '71.05,50.94,71.79,51.37', mapCenter: '71.43, 51.13' }).center).toEqual([71.43, 51.13])
  })

  it('ошибочные значения игнорируются', () => {
    expect(parseBbox('71.79,50.94,71.05,51.37')).toBeNull()
    expect(parseBbox('1,2,3')).toBeNull()
    expect(parseCenter('abc,51')).toBeNull()
    expect(parseCenter('200,51')).toBeNull()
    expect(readCityConfig({ cityBbox: 'x', mapCenter: '' }).bbox).toEqual(ALMATY_BBOX)
  })
})
