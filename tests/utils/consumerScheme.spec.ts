import { describe, expect, it } from 'vitest'
import {
  readCxema, rezAllowed, schemeChangeValues, schemeNumber, schemeOptions, schemeVisValues, type SchemeOptions,
} from '~/utils/consumerScheme'

describe('consumerScheme', () => {
  it('readCxema: как десктоп', () => {
    expect(readCxema('')).toBeNull()
    expect(readCxema(null)).toBeNull()
    expect(readCxema('2.1')).toEqual({ elev: '0', otop: '', gvs: '', gvs_all: '', vent: '1', rez: '' })
    // открытая ГВС из подачи, зависимое элеваторное, вентиляция, рециркуляция
    expect(readCxema('6.8')).toEqual({ elev: '1', otop: 'z', gvs: 'op', gvs_all: '1', vent: '1', rez: '1' })
    // независимое без ГВС
    expect(readCxema('1.5')).toMatchObject({ otop: 'n', elev: '0', gvs: '', vent: '0' })
    // без отопления
    expect(readCxema('C3.1')).toMatchObject({ otop: '', gvs: 'pr' })
    expect(readCxema('мусор')).toEqual({ elev: '0', otop: '', gvs: '', gvs_all: '', vent: '', rez: '' })
  })

  it('schemeNumber: как get_nomer, номер читается обратно в тот же выбор', () => {
    const bools = [false, true]
    const types: SchemeOptions['gvsType'][] = ['op', 'oo', 'pr', 'sm', 'ps', 'pw']
    for (const otop of bools) for (const dependent of bools) for (const elevator of bools)
      for (const gvs of bools) for (const gvsType of types) for (const vent of bools) for (const rez of bools) {
        const o: SchemeOptions = { otop, dependent, elevator, gvs, gvsType, vent, rez }
        const n = schemeNumber(o)
        const cx = readCxema(n)!
        expect(cx.otop, n).toBe(otop ? (dependent ? 'z' : 'n') : '')
        if (otop && dependent) expect(cx.elev, n).toBe(elevator ? '1' : '0')
        expect(cx.gvs, n).toBe(gvs ? gvsType : '')
        expect(cx.vent, n).toBe(vent ? '1' : '0')
        if (gvs) expect(cx.rez, n).toBe(rez && rezAllowed(o) ? '1' : '0')
      }
    expect(schemeNumber({ otop: false, dependent: true, elevator: false, gvs: false, gvsType: 'pr', vent: true, rez: false })).toBe('2.1')
    expect(schemeNumber({ otop: true, dependent: true, elevator: true, gvs: true, gvsType: 'pr', vent: true, rez: false })).toBe('3.7')
    expect(schemeOptions('3.7')).toMatchObject({ otop: true, dependent: true, elevator: true, gvs: true, gvsType: 'pr', vent: true })
  })

  it('schemeChangeValues: нагрузки переходят в поля новой схемы, остальные — 0', () => {
    const values = {
      calchldep: 0.5, contcalchldep: 0.4, avghlgvscloseparall: 0.1, contavghlgvscloseparall: 0.09, calchlventil: 0.2,
    }
    // зависимое + параллельная ГВС + вентиляция → независимое + смешанная ГВС без вентиляции
    const out = schemeChangeValues(values, '3.3', '4.9')
    expect(out.schemeNum).toBe('4.9')
    expect(out.calcHLindep).toBe(0.5)
    expect(out.contcalcHLindep).toBe(0.4)
    expect(out.calcHLdep).toBe(0)
    expect(out.avgHLGVScloseMix).toBe(0.1)
    expect(out.contAvgHLGVScloseMix).toBe(0.09)
    expect(out.avgHLGVScloseParall).toBe(0)
    expect(out.calcHLventil).toBe(0)
    // рециркуляции не было — 10 %, как в десктопе
    expect(schemeChangeValues({}, '1.1', '6.2').circHLosOpen).toBe(10)
  })

  it('schemeVisValues: ключи правил видимости', () => {
    expect(schemeVisValues('')).toEqual({})
    expect(schemeVisValues('1.2')).toEqual({ elev: '0', otop: 'z', gvs: '', gvs_all: '', vent: '1', rez: '0' })
  })
})
