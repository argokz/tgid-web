import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MiniHistogram from '~/components/MiniHistogram.vue';
import { buildHistogram, finiteValues } from '~/utils/histogram';

describe('histogram', () => {
  it('finiteValues: пустые, логические и нечисловые отброшены, строки-числа приняты', () => {
    expect(finiteValues([1, '2', null, '', undefined, true, 'abc', Infinity])).toEqual([1, 2]);
  });

  it('buildHistogram: равные интервалы, максимум в последнем, медиана, пик', () => {
    const h = buildHistogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 10], 5)!;
    expect(h.bins).toHaveLength(5);
    expect(h.bins.map((b) => b.count)).toEqual([2, 2, 2, 2, 2]);
    expect(h.bins[4].to).toBe(10);
    expect(h.median).toBe(4.5);
    expect(h.total).toBe(10);
    expect(h.peak).toBe(2);
  });

  it('одинаковые значения — один столбец; пустой ряд — null; столбцов не больше значений', () => {
    const same = buildHistogram([3, 3, 3])!;
    expect(same.bins).toEqual([{ from: 3, to: 3, count: 3 }]);
    expect(buildHistogram([null, 'x'])).toBeNull();
    expect(buildHistogram([1, 2], 12)!.bins).toHaveLength(2);
  });

  it('MiniHistogram: описание для чтения с экрана, подписи осей, пустое состояние', () => {
    const w = mount(MiniHistogram, { props: { values: [-2, -1, 0, 4], label: 'Перепад', units: 'м', bins: 4 } });
    expect(w.attributes('aria-label')).toBe('Перепад: 4 значений от -2 до 4 м, медиана -0,5 м');
    expect(w.findAll('rect')).toHaveLength(4);
    expect(w.find('figcaption').text()).toContain('медиана -0,5 м');
    const empty = mount(MiniHistogram, { props: { values: [], label: 'Перепад' } });
    expect(empty.text()).toContain('Нет числовых значений');
  });
});
