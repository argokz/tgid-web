import { describe, expect, it } from 'vitest'
import {
  getCardLineId,
  getFeatureId,
  getSectionRowId,
  mergeQueryLayerProperties,
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
