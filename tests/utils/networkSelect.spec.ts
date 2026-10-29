import { describe, expect, it } from 'vitest';
import type { SelectField, SelectResult } from '~/services/api/types';
import {
  buildSpec,
  builderFromSpec,
  circlePolygon,
  emptyBuilder,
  newRow,
  parseNumber,
  resultCsv,
  resultMapData,
  rowCondition,
} from '~/utils/networkSelect';

const field = (key: string, kind: SelectField['kind'], ops: SelectField['ops']): SelectField => ({
  key, label: key, kind, units: '', source: 'passport', hint: '', ops, choices: [],
});
const NUM = field('diameter', 'number', ['lt', 'le', 'gt', 'ge', 'eq', 'ne', 'between', 'is_null', 'not_null']);
const CAT = field('tubing_type', 'category', ['in', 'not_in', 'is_null', 'not_null']);
const TXT = field('name', 'text', ['contains', 'eq', 'is_null', 'not_null']);
const FIELDS = [NUM, CAT, TXT];

describe('networkSelect: конструктор выборки', () => {
  it('разбирает числа с запятой и пробелами', () => {
    expect(parseNumber(' 1,5 ')).toBe(1.5);
    expect(parseNumber('12 000')).toBe(12000);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });

  it('строка условия: по умолчанию операция по виду поля, незаполненные — пропуск', () => {
    expect(newRow(NUM).op).toBe('ge');
    expect(newRow(CAT).op).toBe('in');
    expect(newRow(TXT).op).toBe('contains');
    expect(rowCondition({ ...newRow(NUM), value: '' }, NUM)).toBeNull();
    expect(rowCondition({ ...newRow(NUM), value: '400' }, NUM)).toEqual({ field: 'diameter', op: 'ge', value: 400 });
    expect(rowCondition({ ...newRow(NUM), op: 'between', value: '300', value2: '' }, NUM)).toBeNull();
    expect(rowCondition({ ...newRow(NUM), op: 'between', value: '300', value2: '500' }, NUM))
      .toEqual({ field: 'diameter', op: 'between', value: 300, value2: 500 });
    expect(rowCondition({ ...newRow(NUM), op: 'is_null' }, NUM)).toEqual({ field: 'diameter', op: 'is_null' });
    expect(rowCondition({ ...newRow(CAT), values: [2] }, CAT)).toEqual({ field: 'tubing_type', op: 'in', values: [2] });
    expect(rowCondition({ ...newRow(TXT), value: '  ТК ' }, TXT)).toEqual({ field: 'name', op: 'contains', value: 'ТК' });
    expect(rowCondition({ ...newRow(NUM), op: 'contains', value: '1' }, NUM)).toBeNull();
    expect(rowCondition(newRow(NUM), undefined)).toBeNull();
  });

  it('собирает запрос: фрагменты на карте, все или названные; «рядом» — только с узлом', () => {
    const state = { ...emptyBuilder(), rows: [{ ...newRow(NUM), value: '400' }, newRow(CAT)], nearOn: true, nearNode: ' ' };
    const spec = buildSpec(state, FIELDS, [72, 74]);
    expect(spec.conditions).toEqual([{ field: 'diameter', op: 'ge', value: 400 }]);
    expect(spec.fragment_ids).toEqual([72, 74]);
    expect(spec.near).toBeNull();
    expect(buildSpec({ ...state, scope: 'all' }, FIELDS, [72]).fragment_ids).toBeNull();
    expect(buildSpec({ ...state, scope: 'list', fragments: [5] }, FIELDS, [72]).fragment_ids).toEqual([5]);
    expect(buildSpec({ ...state, nearNode: 'ТК-12', nearMeters: 300 }, FIELDS, []).near)
      .toEqual({ node_name: 'ТК-12', meters: 300 });
  });

  it('запрос ИИ переносится в конструктор и обратно без потерь', () => {
    const spec = buildSpec({
      ...emptyBuilder('nodes'),
      rows: [{ ...newRow(NUM), op: 'between', value: '1', value2: '2,5' }, { ...newRow(CAT), values: [2, 4] }],
      nearOn: true, nearNode: '3-47', nearMeters: 500, scope: 'list', fragments: [74], orderBy: 'diameter',
    }, FIELDS, [72]);
    const state = builderFromSpec(spec, [72]);
    expect(state.scope).toBe('list');
    expect(state.fragments).toEqual([74]);
    expect(buildSpec(state, FIELDS, [72])).toEqual(spec);
    expect(builderFromSpec({ ...spec, fragment_ids: [72] }, [72]).scope).toBe('visible');
    expect(builderFromSpec({ ...spec, fragment_ids: null }, [72]).scope).toBe('all');
  });

  it('CSV: заголовок с единицами, экранирование «;» и кавычек', () => {
    const res: SelectResult = {
      spec: buildSpec(emptyBuilder(), FIELDS, []), description: '', target: 'lines',
      columns: [{ key: 'diameter', label: 'Ду', units: 'мм' }], total: 1, truncated: false,
      items: [{ id: 1, fileid: 74, title: 'ТК "1"; ТК-2', length: 12.5, values: { diameter: 400 }, lon: 76.9, lat: 43.2 }],
    };
    const [header, row] = resultCsv(res).split('\r\n');
    expect(header).toBe('id;Фрагмент;Участок;Длина, м;Ду, мм;Долгота;Широта');
    expect(row).toBe('1;74;"ТК ""1""; ТК-2";12.5;400;76.9;43.2');
  });

  it('окружность «рядом с» — замкнутая, радиус в метрах', () => {
    const ring = circlePolygon(76.9, 43.2, 1000).coordinates[0]!;
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    const [lon, lat] = ring[16]!; // четверть круга — строго на север
    expect(lon).toBeCloseTo(76.9, 6);
    expect((lat - 43.2) * 111_320).toBeCloseTo(1000, 0);
    const res = { geojson: { type: 'FeatureCollection', features: [] }, near_center: { lon: 76.9, lat: 43.2, meters: 100 } };
    expect(resultMapData(res as unknown as SelectResult).features[0]!.properties).toEqual({ kind: 'near' });
  });
});
