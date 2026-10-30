import { describe, expect, it } from 'vitest';
import {
  deviationText,
  regimeCell,
  regimeState,
  sensorStatus,
  seriesOption,
  seriesSummary,
  sortSensors,
  valueText,
  type RegimeNode,
  type Sensor,
  type SensorSeries,
} from '~/utils/telemetry';

const base: Sensor = {
  id: 1, code: 'P1', name: 'Б', kind: 'pressure', kind_label: 'Давление', pipe: 'supply', pipe_label: 'подача',
  unit: 'kgf_cm2', unit_label: 'кгс/см²', node_id: 5, line_id: null, fileid: 74, lon: 76.9, lat: 43.2, active: true,
  note: '', last: { ts: '2026-10-30T10:00:00Z', value: 10 }, stale: false, model: 10,
  deviation: { diff: 0, pct: 0, status: 'ok', base_unit: 'м вод. ст.' },
};

describe('telemetry', () => {
  it('sensorStatus: нет показаний, молчит, нет расчёта, расхождение', () => {
    expect(sensorStatus({ ...base, last: null })).toBe('no_data');
    expect(sensorStatus({ ...base, stale: true })).toBe('stale');
    expect(sensorStatus({ ...base, deviation: null })).toBe('no_model');
    expect(sensorStatus({ ...base, deviation: { ...base.deviation!, status: 'bad' } })).toBe('bad');
  });

  it('deviationText и valueText', () => {
    expect(deviationText({ diff: 6.6, pct: 12.6, status: 'bad', base_unit: 'м вод. ст.' })).toBe('+12,6 %');
    expect(deviationText({ diff: -2.585, pct: null, status: 'warn', base_unit: '°C' })).toBe('−2,6 °C');
    expect(deviationText(null)).toBe('—');
    expect(valueText(10.2371, 'кгс/см²')).toBe('10,237 кгс/см²');
    expect(valueText(25768.17, 'м³/ч').replace(/\s/gu, ' ')).toBe('25 768,2 м³/ч'); // ru-RU: неразрывный пробел
    expect(valueText(null, 'т/ч')).toBe('—');
  });

  it('sortSensors: сначала расхождения, потом по имени', () => {
    const list = [
      { ...base, id: 1, name: 'В' },
      { ...base, id: 2, name: 'А', deviation: { ...base.deviation!, status: 'warn' as const } },
      { ...base, id: 3, name: 'Б', deviation: { ...base.deviation!, status: 'bad' as const } },
      { ...base, id: 4, name: 'А', stale: true },
    ];
    expect(sortSensors(list).map((s) => s.id)).toEqual([3, 2, 4, 1]);
  });

  it('seriesOption: одна серия факта, полоса мин–макс, линия модели', () => {
    const series: SensorSeries = { sensor: base, step_min: 5, points: [
      { t: '2026-10-30T10:00:00Z', avg: 10, min: 9.9, max: 10.1, n: 2 },
      { t: '2026-10-30T10:05:00Z', avg: 10.2, min: 10.2, max: 10.2, n: 1 },
    ] };
    const opt = seriesOption(series, 10.5) as { series: Record<string, unknown>[] };
    const fact = opt.series.find((s) => s.name === 'Факт') as { markLine: { data: { yAxis: number }[] } };
    expect(fact.markLine.data[0].yAxis).toBe(10.5);
    expect((opt.series[1] as { data: [string, number][] }).data[0][1]).toBeCloseTo(0.2);
    expect((seriesOption(series, null) as { series: { markLine?: unknown }[] }).series[2].markLine).toBeUndefined();
    // ось захватывает модель, даже если факт далеко от неё
    const axis = (opt as unknown as { yAxis: { min: (v: object) => number; max: (v: object) => number } }).yAxis;
    expect(axis.max({ min: 9.9, max: 10.2 })).toBeGreaterThan(10.5);
    const low = (seriesOption(series, 5) as unknown as { yAxis: { min: (v: object) => number } }).yAxis;
    expect(low.min({ min: 9.9, max: 10.2 })).toBeLessThan(5);
    expect(seriesSummary(series, 10.5)).toBe('Среднее 10,067 кгс/см², от 9,9 до 10,2 (интервал 5 мин); модель — 10,5 кгс/см²');
    expect(seriesSummary({ ...series, points: [] }, null)).toBe('Показаний за период нет');
  });
});

describe('calibrationFeature', () => {
  it('линия пары цвета вывода; без геометрии — пусто', async () => {
    const { calibrationFeature, CALIBRATION_META } = await import('~/utils/telemetry');
    const seg = {
      pipe: 'supply', label: '2-20 → 2-40А', status: 'rough',
      geometry: { type: 'MultiLineString', coordinates: [[[76.9, 43.2], [76.91, 43.21]]] },
    } as unknown as import('~/utils/telemetry').CalibrationSegment;
    const fc = calibrationFeature(seg);
    expect(fc.features[0].properties).toEqual({ name: '2-20 → 2-40А', color: CALIBRATION_META.rough.color });
    expect(calibrationFeature({ ...seg, geometry: null }).features).toEqual([]);
  });
});

describe('regime', () => {
  const node: RegimeNode = {
    node_id: 535303, fileid: 74, node_name: 'ТЭЦ-1', set: { p1: 120, p2: 54 },
    fact: { p1: 111.6, p2: 53.5, t1: 124.8 }, model: { p1: 120, p2: 54, t1: 132 },
    sensors: ['P1', 'P2', 'T1'], silent: [], problem: null, changes: ['напор подачи 120 → 111.6 м'],
  };

  it('regimeCell: расчёт → факт, без лишней стрелки', () => {
    expect(regimeCell(120, 111.6)).toBe('120 → 111,6');
    expect(regimeCell(54, 54.02)).toBe('54');
    expect(regimeCell(132, null)).toBe('132');
    expect(regimeCell(undefined, 53.5)).toBe('53,5');
    expect(regimeCell(null, null)).toBe('—');
  });

  it('regimeState: ошибка факта важнее изменения', () => {
    expect(regimeState(node).text).toBe('режим изменился');
    expect(regimeState({ ...node, problem: 'нет свежих показаний' }).text).toBe('нет свежих показаний');
    expect(regimeState({ ...node, changes: [] }).text).toBe('совпадает с расчётом');
    expect(regimeState({ ...node, changes: [], model: null }).text).toBe('нет расчёта');
  });
});
