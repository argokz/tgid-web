import { describe, expect, it } from 'vitest'
import {
  getCardLineId,
  getFeatureId,
  getSectionRowId,
  mergeQueryLayerProperties,
  resolveCardObject,
} from '../../utils/networkFeature'

// QA F12/F54: участок 324386 (linesobj.id), его паспорт трубы — heatpipesections.id 141949;
// id 141949 у linesobj — другой живой участок.
const LINE = 324386
const SECTION = 141949

const mvtPipe = (props: Record<string, any>) => ({
  layer: { id: 'almatygis-heatpipesections', 'source-layer': 'heatpipesections' },
  geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
  properties: props,
})

describe('getFeatureId', () => {
  it('takes linesobj.id from the MVT section layer', () => {
    expect(getFeatureId(mvtPipe({ id: LINE, fileid: 74 }))).toBe(LINE)
  })

  it('prefers explicit lineid over id for sections', () => {
    expect(getFeatureId(mvtPipe({ id: SECTION, lineid: LINE }))).toBe(LINE)
  })

  it('returns null for a query-layer section feature without lineid', () => {
    const fromQueryLayer = {
      id: `id_heatpipesections.fid-1_${SECTION}`,
      sourceLayer: 'AlmatyGIS:id_heatpipesections',
      geometry: { type: 'LineString', coordinates: [] },
      properties: { id: SECTION },
    }
    expect(getFeatureId(fromQueryLayer)).toBeNull()
  })

  it('keeps node ids and ignores non-positive ids', () => {
    const node = { layer: { id: 'uzel', 'source-layer': 'uzel' }, properties: { id: 42 } }
    expect(getFeatureId(node)).toBe(42)
    expect(getFeatureId(mvtPipe({ id: 0 }))).toBeNull()
    expect(getFeatureId(mvtPipe({ id: 'abc' }))).toBeNull()
  })
})

describe('mergeQueryLayerProperties', () => {
  it('keeps the lookup line id as card id and stores the passport row id', () => {
    const merged = mergeQueryLayerProperties(
      { id: LINE, fileid: 74, name: 'MVT' },
      { id: SECTION, diametercondit: 150, name: 'WFS' },
      'heatpipesections',
      LINE
    )
    expect(merged.id).toBe(LINE)
    expect(merged.lineid).toBe(LINE)
    expect(merged.query_table).toBe('heatpipesections')
    expect(merged.query_row_id).toBe(SECTION)
    expect(merged.diametercondit).toBe(150)
    expect(merged.name).toBe('WFS')
    expect(getCardLineId(merged)).toBe(LINE)
    expect(getSectionRowId(merged)).toBe(SECTION)
  })

  it('keys consumer cards by node id', () => {
    const merged = mergeQueryLayerProperties({ id: 777 }, { id: 5 }, 'generalizedconsumers', 777)
    expect(merged.id).toBe(777)
    expect(merged.nodeid).toBe(777)
    expect(merged.query_row_id).toBe(5)
    expect(getSectionRowId(merged)).toBeNull()
  })

  it('leaves other tables untouched (query-layer id is the object id)', () => {
    const merged = mergeQueryLayerProperties({ id: 9 }, { id: 9, a: 1 }, 'nodes', 9)
    expect(merged).toEqual({ id: 9, a: 1 })
  })

  it('здание zdaniya_2: таблица запоминается, карточка — строка здания (QA F79)', () => {
    const merged = mergeQueryLayerProperties({ objectid: 636957 }, { id: 87055, number_1: '214а' }, 'zdaniya_2', 87055)
    expect(merged.query_table).toBe('zdaniya_2')
    expect(resolveCardObject(merged)).toEqual({ table: 'zdaniya_2', network: null, networkId: null, rowId: 87055 })
    // query-слой ничего не вернул — таблицу не угадываем
    expect(mergeQueryLayerProperties({ objectid: 1 }, null, 'zdaniya_2', 5).query_table).toBeUndefined()
  })
})

describe('getCardLineId', () => {
  it('uses id for plain linesobj cards (search, API)', () => {
    expect(getCardLineId({ id: LINE, gistable: 'linesobj' })).toBe(LINE)
  })

  it('refuses a section card whose line id is unknown', () => {
    expect(getCardLineId({ id: SECTION, query_table: 'heatpipesections', query_row_id: SECTION })).toBeNull()
    expect(getCardLineId({ id: null, query_table: 'heatpipesections' })).toBeNull()
  })
})

// QA F11: свойства реальных фич фрагмента 74 (MVT AlmatyGIS:uzel / heatpipesections + WFS id_<table>).
// gistable в слоях нет (nodes.gistable пуст) — вид объекта определяется по query_table / tab / полям.
const uzelMvt = (id: number, tab: string, code: string, code2: string) => ({
  loc: 1, code2, code, full_name: `М1 ${id}`, tab, name: String(id), text: '', externalnodename: String(id), fileid: 74,
})
const pipeMvt = { loc: 2, code2: 'Участок', code: 'UT', org: false, mag: false, geot1: 0, geot2: 0, zakr: false, name: 'РС1 - РС1', nadz: false, text: '', fileid: 74 }

describe('resolveCardObject', () => {
  it('section from MVT + WFS id_heatpipesections: linesobj by lineid', () => {
    const props = mergeQueryLayerProperties(pipeMvt, { id: 144805, externalsignlineid: 'подающий' }, 'heatpipesections', 327446)
    expect(resolveCardObject(props)).toEqual({ table: 'linesobj', network: 'line', networkId: 327446, rowId: 327446 })
  })

  it('section from MVT without WFS answer: line kind by layer code, id unknown', () => {
    expect(resolveCardObject(pipeMvt)).toEqual({ table: 'linesobj', network: 'line', networkId: null, rowId: null })
    expect(resolveCardObject({ id: null, query_table: 'heatpipesections', query_row_id: 144805 }).networkId).toBeNull()
  })

  it('plain node (tab=nodes) + WFS id_nodes', () => {
    const props = mergeQueryLayerProperties(
      uzelMvt(534700, 'nodes', 'US', 'Узел'),
      { id: 534700, nodetypeid: null, externalsignid: 'общий', fileid: 'Маг. сети для расчета НС' },
      'nodes',
      534700
    )
    expect(resolveCardObject(props)).toEqual({ table: 'nodes', network: 'node', networkId: 534700, rowId: 534700 })
  })

  it.each([
    ['generalizedconsumers', 'PO', 'Потребитель обобщенныйs', 535810, 22723],
    ['realconsumers', 'PR', 'Потребитель реальный', 536296, 22104],
    ['heatsources', 'IS', 'Источник', 535304, 177],
    ['pumpstations', 'NS', 'Насосная станция', 535305, 176],
  ])('%s from map: node nodes.id, row of own table', (tab, code, code2, nodeId, rowId) => {
    const props = mergeQueryLayerProperties(uzelMvt(nodeId, tab, code, code2), { id: rowId, name: '' }, tab, nodeId)
    expect(resolveCardObject(props)).toEqual({ table: tab, network: 'node', networkId: nodeId, rowId })
  })

  it('consumer by tab only (WFS failed): node kind, ids unknown', () => {
    expect(resolveCardObject(uzelMvt(535810, 'generalizedconsumers', 'PO', 'Потребитель обобщенныйs')))
      .toEqual({ table: 'generalizedconsumers', network: 'node', networkId: null, rowId: null })
  })

  it('explicit gistable keeps priority', () => {
    expect(resolveCardObject({ gistable: 'linesobj', id: 5, tab: 'nodes' })).toEqual({ table: 'linesobj', network: 'line', networkId: 5, rowId: 5 })
    expect(resolveCardObject({ gistable: 'NODES', id: 7 })).toEqual({ table: 'nodes', network: 'node', networkId: 7, rowId: 7 })
    expect(resolveCardObject({ gistable: 'generalizedconsumers', id: 22723, nodeid: 535810 }))
      .toEqual({ table: 'generalizedconsumers', network: 'node', networkId: 535810, rowId: 22723 })
    expect(resolveCardObject({ gistable: 'zdaniya_tu', id: 3 })).toEqual({ table: 'zdaniya_tu', network: null, networkId: null, rowId: 3 })
    expect(resolveCardObject({ gistable: 'defects', id: 9, defectid: 9 }).network).toBeNull()
  })

  it('record fields without layer hints', () => {
    expect(resolveCardObject({ id: 11, nodeid1: 1, nodeid2: 2 }).network).toBe('line')
    expect(resolveCardObject({ id: 12, nodetypeid: 9 }).network).toBe('node')
    expect(resolveCardObject({ id: 13 })).toEqual({ table: '', network: null, networkId: null, rowId: 13 })
  })
})
