import { afterEach, describe, expect, it } from 'vitest'
import { toInternalGeoserverUrl } from '~/server/utils/geoserverInternal'

const cfg = { public: { geoserver: { url: 'https://itwin.kz/geoserver' } }, geoserverInternalUrl: 'http://127.0.0.1:8085/geoserver/' }

describe('сервер веба ходит в GeoServer по внутреннему адресу', () => {
  afterEach(() => { delete process.env.GEOSERVER_INTERNAL_URL })

  it('публичный адрес заменяется внутренним, остальное — как есть', () => {
    expect(toInternalGeoserverUrl('https://itwin.kz/geoserver/gwc/service/wmts?REQUEST=GetCapabilities', cfg))
      .toBe('http://127.0.0.1:8085/geoserver/gwc/service/wmts?REQUEST=GetCapabilities')
    expect(toInternalGeoserverUrl('https://itwin.kz/geoserver', cfg)).toBe('http://127.0.0.1:8085/geoserver')
    expect(toInternalGeoserverUrl('https://itwin.kz/geoserverx/a', cfg)).toBe('https://itwin.kz/geoserverx/a')
    expect(toInternalGeoserverUrl('http://127.0.0.1:8085/geoserver/rest', cfg)).toBe('http://127.0.0.1:8085/geoserver/rest')
  })

  it('без внутреннего адреса ничего не меняется; переменная окружения важнее сборки', () => {
    const plain = { public: cfg.public }
    expect(toInternalGeoserverUrl('https://itwin.kz/geoserver/ows', plain)).toBe('https://itwin.kz/geoserver/ows')
    process.env.GEOSERVER_INTERNAL_URL = 'http://localhost:9090/geoserver'
    expect(toInternalGeoserverUrl('https://itwin.kz/geoserver/ows', cfg)).toBe('http://localhost:9090/geoserver/ows')
  })
})
