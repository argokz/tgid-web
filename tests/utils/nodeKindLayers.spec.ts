import { describe, expect, it } from 'vitest'
import {
  combineCql,
  combineWithNodeCodes,
  filterCodeSet,
  layerCanMatchNodeCodes,
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
  it('подслои стиля uzel, которые не могут показать узлы источника, отсеиваются', () => {
    expect(filterCodeSet(['==', 'code', 'IS'])).toEqual(new Set(['IS']))
    expect(filterCodeSet(['in', ['get', 'code'], ['literal', ['PR', 'EL']]])).toEqual(new Set(['PR', 'EL']))
    expect(filterCodeSet(['all', ['==', 'code', 'TK'], ['>', 'du', 100]])).toEqual(new Set(['TK']))
    expect(filterCodeSet(['>', 'du', 100])).toBeNull()
    // «Источники» (только IS): правило ТК пустое, правило IS и подпись без кода — остаются
    expect(layerCanMatchNodeCodes(['==', 'code', 'TK'], ['IS'])).toBe(false)
    expect(layerCanMatchNodeCodes(['==', 'code', 'IS'], ['IS'])).toBe(true)
    expect(layerCanMatchNodeCodes(['has', 'name'], ['IS'])).toBe(true)
    // подпись «PR-EL-NZ-PO-US»: у потребителей нужна, у источников — нет
    const text = ['in', 'code', 'PR', 'EL', 'NZ', 'PO', 'US']
    expect(layerCanMatchNodeCodes(text, ['PR', 'EL', 'NZ'])).toBe(true)
    expect(layerCanMatchNodeCodes(text, ['IS'])).toBe(false)
    // uzel без IS/NS/PR/EL/NZ/PO: правило IS пустое, US в подписи остаётся
    const excluded = ['IS', 'NS', 'PR', 'EL', 'NZ', 'PO']
    expect(layerCanMatchNodeCodes(['==', 'code', 'IS'], excluded, true)).toBe(false)
    expect(layerCanMatchNodeCodes(text, excluded, true)).toBe(true)
  })
})
