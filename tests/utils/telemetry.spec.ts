import { describe, expect, it } from 'vitest';
import {
  deviationText,
  sensorStatus,
  seriesOption,
  seriesSummary,
  sortSensors,
  valueText,
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
