import { describe, expect, it } from 'vitest'
import {
  combineCql,
  combineWithNodeCodes,
  nodeCodesCql,
  nodeKindCodes,
  withCqlParam,
} from '~/utils/nodeKindLayers'

describe('слои по типу узла (uzel.code)', () => {
  it('коды по таблице объекта, как в SQL слоя uzel', () => {
    expect(nodeKindCodes('heatsources')).toEqual(['IS'])
    expect(nodeKindCodes('pumpstations')).toEqual(['NS'])
    expect(nodeKindCodes('realconsumers')).toEqual(['PR', 'EL', 'NZ'])
    expect(nodeKindCodes('generalizedconsumers')).toEqual(['PO'])
    expect(nodeKindCodes('uzel')).toBeNull()
  })

  it('CQL: выбор и исключение кодов, объединение с фрагментами', () => {
    expect(nodeCodesCql(['PR', 'EL'])).toBe("code IN ('PR','EL')")
    expect(nodeCodesCql(['IS'], true)).toBe("code NOT IN ('IS')")
    expect(combineCql("code IN ('IS')", undefined)).toBe("code IN ('IS')")
    expect(combineCql("code IN ('IS')", `"fileid" IN ('74')`)).toBe(`(code IN ('IS')) AND ("fileid" IN ('74'))`)
    expect(combineCql(undefined, '')).toBeUndefined()
  })

  it('фильтр MapLibre в синтаксисе исходного фильтра подслоя', () => {
    // правила SLD конвертируются в legacy-фильтры
    expect(combineWithNodeCodes(['==', 'code', 'IS'], ['IS'])).toEqual(['all', ['==', 'code', 'IS'], ['in', 'code', 'IS']])
    // подписи без фильтра
    expect(combineWithNodeCodes(undefined, ['IS', 'NS'], true)).toEqual(['!in', 'code', 'IS', 'NS'])
    // выражение — выражение
    expect(combineWithNodeCodes(['!', ['has', 'name']], ['PO'])).toEqual(
      ['all', ['!', ['has', 'name']], ['in', ['get', 'code'], ['literal', ['PO']]]],
    )
  })

  it('CQL_FILTER добавляется только к MVT через WMS GetMap', () => {
    const getMap = 'https://gs/ows?SERVICE=WMS&REQUEST=GetMap&LAYERS=AlmatyGIS:uzel'
    expect(withCqlParam(getMap, "code IN ('IS')")).toBe(`${getMap}&CQL_FILTER=code%20IN%20('IS')`)
    expect(withCqlParam('https://gs/gwc/service/wmts?REQUEST=GetTile', "code IN ('IS')")).toBeNull()
    expect(withCqlParam(getMap, undefined)).toBe(getMap)
  })
})
