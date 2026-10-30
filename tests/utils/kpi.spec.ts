import { describe, expect, it } from 'vitest';
import {
  DEFECT_STATE_COLORS,
  WEAR_RAMP,
  barOption,
  bboxParam,
  defectMapFeatures,
  monthLabel,
  peakMonth,
  presetPeriod,
  tableRows,
  wearBars,
  workOrderBars,
} from '~/utils/kpi';
import { STATUS_META } from '~/utils/workOrders';

describe('показатели: периоды и фильтры карты', () => {
  it('кнопки периода', () => {
    const today = new Date(2026, 9, 30);
    expect(presetPeriod('12m', today)).toEqual({ from: '2025-10-01', to: '2026-10-30' });
    expect(presetPeriod('year', today)).toEqual({ from: '2026-01-01', to: '2026-10-30' });
    expect(presetPeriod('prev-year', today)).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(presetPeriod('12m', new Date(2026, 0, 15))).toEqual({ from: '2025-01-01', to: '2026-01-15' });
  });

  it('видимая область карты — в границах WGS84', () => {
    expect(bboxParam({ west: 71.4, south: 51.1, east: 71.5, north: 51.2 })).toBe('71.40000,51.10000,71.50000,51.20000');
    expect(bboxParam({ west: -200, south: -95, east: 190, north: 91 })).toBe('-180.00000,-90.00000,180.00000,90.00000');
  });

  it('месяцы и пик', () => {
    expect(monthLabel('2026-05')).toBe('май 26');
    expect(peakMonth([{ month: '2026-01', count: 2 }, { month: '2026-02', count: 7 }, { month: '2026-03', count: 7 }])).toBe('фев 26');
    expect(peakMonth([{ month: '2026-01', count: 0 }])).toBeNull();
  });
});

describe('показатели: графики', () => {
  it('одна серия, подписи столбцов только у небольших графиков, свои цвета по столбцам', () => {
    const opt = barOption({ categories: ['a', 'b'], values: [3, 0], name: 'Дефектов', colors: ['#111111'] }) as any;
    expect(opt.series).toHaveLength(1);
    expect(opt.series[0].data).toEqual([{ value: 3, itemStyle: { color: '#111111' } }, 0]);
    expect(opt.series[0].label.show).toBe(true);
    expect(opt.xAxis.type).toBe('category');
    const n = (1234.5).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
    expect(opt.tooltip.formatter({ name: 'a', value: 1234.5 })).toBe(`a: <b>${n}</b>`);
    // название из справочника не становится разметкой
    expect(opt.tooltip.formatter({ name: '<img src=x onerror=alert(1)>', value: 1 })).toBe('&lt;img src=x onerror=alert(1)&gt;: <b>1</b>');
    const h = barOption({ categories: Array.from({ length: 13 }, (_, i) => `${i}`), values: Array(13).fill(1), name: 'x', horizontal: true }) as any;
    expect(h.yAxis.type).toBe('category');
    expect(h.yAxis.inverse).toBe(true);
    expect(h.series[0].label.show).toBe(false);
  });

  it('износ — порядковая шкала одного оттенка; наряды — цвета статусов', () => {
    const w = wearBars({ calculation_id: 1, name: null, at: null, lines: 5, avg_wear: 27.7,
      by_category: { 1: 0, 2: 4, 3: 1, 4: 0, 5: 0 }, category_labels: { 1: 'Хорошее', 2: 'Удовлетворительное' } } as any);
    expect(w.values).toEqual([0, 4, 1, 0, 0]);
    expect(w.colors).toEqual(WEAR_RAMP);
    expect(w.categories.slice(0, 3)).toEqual(['Хорошее', 'Удовлетворительное', 'Категория 3']);
    const o = workOrderBars({ new: 2, done: 1 }, { new: 'Заявка' });
    expect(o.values[0]).toBe(2);
    expect(o.colors?.[0]).toBe(STATUS_META.new.mapColor);
    expect(o.categories[0]).toBe('Заявка');
  });

  it('дефекты на карте — цвет по состоянию; таблица', () => {
    const fc = defectMapFeatures({ type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { state_id: 3 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { state_id: null } },
    ] });
    expect(fc.features.map((f) => f.properties?.color)).toEqual([DEFECT_STATE_COLORS[3], DEFECT_STATE_COLORS[1]]);
    expect(tableRows(['a', 'b'], [1])).toEqual([{ name: 'a', value: 1 }, { name: 'b', value: 0 }]);
  });
});
