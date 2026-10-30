import { describe, expect, it } from 'vitest';
import {
  loadOption,
  loadSummary,
  temperatureOption,
  weatherText,
  type ForecastDetail,
  type ForecastPoint,
} from '~/utils/loadForecast';

const point = (ts: string, kind: 'fact' | 'forecast', t: number, total: number, fact: number | null): ForecastPoint => ({
  ts, kind, t_air: t, source: 'open-meteo', heating: total - 300, vent: 0, hw: 300, total, t1: 62.5, t2: 41.8, fact,
});
const POINTS = [
  point('2026-10-30T10:00:00+00:00', 'fact', 4, 650, 670),
  point('2026-10-30T11:00:00+00:00', 'fact', 5, 640, null),
  point('2026-10-30T12:00:00+00:00', 'forecast', 6, 630, null),
];

describe('loadForecast', () => {
  it('temperatureOption: факт и прогноз одной линией без разрыва', () => {
    const opt = temperatureOption(POINTS, '2026-10-30T12:00:00+00:00') as { series: { data: unknown[][] }[] };
    expect(opt.series[0].data.map((d) => d[1])).toEqual([4, 5, null]);
    expect(opt.series[1].data.map((d) => d[1])).toEqual([null, 5, 6]);
  });

  it('loadOption: линия факта только если есть показания', () => {
    const withFact = loadOption(POINTS, POINTS[2].ts) as { series: unknown[]; legend: { data: string[] } };
    expect(withFact.series).toHaveLength(2);
    expect(withFact.legend.data).toEqual(['Прогноз по погоде', 'Факт по датчикам']);
    const none = loadOption(POINTS.map((p) => ({ ...p, fact: null })), POINTS[2].ts) as { series: unknown[] };
    expect(none.series).toHaveLength(1);
  });

  it('loadSummary и weatherText', () => {
    const d = {
      next: { hours: 24, t_min: 1.4, t_max: 14.1, q_max: 742.7, q_avg: 543.9, q_sum: 13054 },
      accuracy: { hours: 5, mean_pct: 2.6, mean_abs_pct: 3.1 },
    } as unknown as ForecastDetail;
    expect(loadSummary(d)).toBe('Сутки: воздух 1,4…14,1 °C, пик 742,7 Гкал/ч, среднее 543,9 Гкал/ч, отпуск 13 054 Гкал;'
      + ' по фактической погоде против датчиков — в среднем +2,6 % (5 ч)');
    expect(loadSummary({ ...d, next: { hours: 0 } })).toBe('Прогноза погоды на ближайшие сутки нет');
    expect(weatherText({ provider: 'none' })).toContain('вручную или файлом');
    expect(weatherText({ provider: 'open-meteo', lat: 43.3153, lon: 76.9409, error: 'нет связи' }))
      .toBe('Погода — Open-Meteo (43,32, 76,94) — нет связи');
  });
});
