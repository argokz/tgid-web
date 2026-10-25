import { describe, expect, it } from 'vitest';
import {
  axisTooltip,
  brushRangeToZoom,
  escapeHtml,
  formatAxisTooltip,
  formatChartNumber,
  pointValue,
  zoomControls,
} from '~/utils/chartOptions';

describe('chartOptions', () => {
  it('formatChartNumber: русская запись, пусто и не число — «—»', () => {
    expect(formatChartNumber(1234.567, 1)).toBe((1234.6).toLocaleString('ru-RU'));
    expect(formatChartNumber(null)).toBe('—');
    expect(formatChartNumber('')).toBe('—');
    expect(formatChartNumber('abc')).toBe('—');
  });

  it('pointValue: число, пара [x, y], объект { value }', () => {
    expect(pointValue({ value: 5 })).toBe(5);
    expect(pointValue({ value: [12, 34] })).toBe(34);
    expect(pointValue({ data: { value: [1, 2, 3] } })).toBe(3);
  });

  it('тултип: заголовок, единицы по серии, подписи из базы экранированы', () => {
    const html = formatAxisTooltip(
      [
        { seriesName: 'H подача', marker: '<span class="m"></span>', value: 42.123, axisValueLabel: 'ТК-1 <script>' },
        { seriesName: 't <b>', value: null },
      ],
      { units: { 'H подача': 'м' }, digits: 1 },
    );
    expect(html).toContain('ТК-1 &lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain(`${(42.1).toLocaleString('ru-RU')} м`);
    expect(html).toContain('t &lt;b&gt;');
    // без значения — прочерк и без единиц
    expect(html).toMatch(/—<\/b>/);
    // маркер ECharts остаётся HTML
    expect(html).toContain('<span class="m"></span>');
    expect(escapeHtml(`"a"&'b'`)).toBe('&quot;a&quot;&amp;&#39;b&#39;');
  });

  it('axisTooltip: ось, кроссхэйр, формат', () => {
    const tip = axisTooltip({ pointer: 'line', units: () => '°C' });
    expect(tip.trigger).toBe('axis');
    expect(tip.axisPointer.type).toBe('line');
    expect(tip.formatter([{ seriesName: 't1', value: 95 }])).toContain('95 °C');
  });

  it('zoomControls: колесо и ползунок; без ползунка — только колесо', () => {
    expect(zoomControls()).toHaveLength(2);
    expect(zoomControls({ slider: false })).toEqual([{ type: 'inside', xAxisIndex: 0, filterMode: 'none' }]);
  });

  it('brushRangeToZoom: диапазон по возрастанию, пустое и точка — null', () => {
    expect(brushRangeToZoom([{ coordRange: [30, 10] }])).toEqual({ startValue: 10, endValue: 30 });
    expect(brushRangeToZoom([{ coordRange: [5, 5] }])).toBeNull();
    expect(brushRangeToZoom([])).toBeNull();
    expect(brushRangeToZoom(undefined)).toBeNull();
  });

  it('brushRangeToZoom: ось категорий — индексы в проценты (числовые категории не путаются со значениями)', () => {
    const axis = { type: 'category', data: Array.from({ length: 11 }, (_, i) => 8 - i) };
    expect(brushRangeToZoom([{ coordRange: [7, 2] }], axis)).toEqual({ start: 20, end: 70 });
    expect(brushRangeToZoom([{ coordRange: [0, 3] }], { type: 'category', data: [1] })).toBeNull();
  });
});
