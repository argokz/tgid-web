import { describe, expect, it } from 'vitest';
import {
  buildStyle,
  colorExpression,
  colorFor,
  equalBreaks,
  jenksBreaks,
  layerFilter,
  legendRows,
  paletteColors,
  quantileBreaks,
  type ThematicTheme,
} from '~/utils/thematicStyle';

const diameter: ThematicTheme = {
  key: 'diameter', label: 'Условный диаметр', units: 'мм', kind: 'number', source: 'passport', hint: '',
  method: 'manual', breaks: [80, 150, 250], palette: 'sequential', digits: 0,
};
const head: ThematicTheme = { ...diameter, key: 'available_head', units: 'м', method: 'quantile', breaks: [],
  palette: 'sequential_reverse', digits: 1 };
const tubing: ThematicTheme = { ...diameter, key: 'tubing_type', kind: 'category', units: '', method: 'quantile', breaks: [] };

describe('thematicStyle: классы', () => {
  it('равные интервалы и квантили', () => {
    expect(equalBreaks([0, 10, 100], 4)).toEqual([25, 50, 75]);
    expect(equalBreaks([5, 5], 4)).toEqual([]);
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(quantileBreaks(values, 4)).toEqual([26, 51, 76]);
    // совпавшие квантили схлопываются, граница на минимуме не нужна
    expect(quantileBreaks([1, 1, 1, 1, 1, 1, 1, 9], 4)).toEqual([]);
  });

  it('Дженкс находит естественные разрывы', () => {
    const values = [1, 2, 2, 3, 50, 51, 52, 200, 205, 210];
    expect(jenksBreaks(values, 3)).toEqual([50, 200]);
    expect(jenksBreaks([7], 3)).toEqual([]);
    // выборка большого набора не теряет крайние классы
    const big = [...Array.from({ length: 5000 }, () => 10), ...Array.from({ length: 5000 }, () => 1000)];
    expect(jenksBreaks(big, 2)).toEqual([1000]);
  });

  it('палитры: интерполяция и обратный порядок', () => {
    const five = paletteColors('ylorrd', 5);
    expect(five).toHaveLength(5);
    expect(five[0]).toBe('#fed976');
    expect(five[4]).toBe('#800026');
    expect(paletteColors('ylorrd_r', 5)).toEqual([...five].reverse());
    expect(paletteColors('нет такой', 2)).toEqual(paletteColors('ylorrd', 2));
  });
});

describe('thematicStyle: стиль, цвет, легенда', () => {
  it('своих границ темы хватает для стиля по умолчанию', () => {
    const style = buildStyle(diameter, [50, 100, 200, 300, null]);
    expect(style).toMatchObject({ format: 1, theme: 'diameter', method: 'manual', classes: 4, breaks: [80, 150, 250] });
    expect(style.colors).toHaveLength(4);
    expect(colorFor(style, 79)).toBe(style.colors![0]);
    expect(colorFor(style, 80)).toBe(style.colors![1]);
    expect(colorFor(style, 999)).toBe(style.colors![3]);
    expect(colorFor(style, null)).toBe('#9e9e9e');
  });

  it('квантили по значениям, палитра темы в обратном порядке', () => {
    const values = Array.from({ length: 50 }, (_, i) => i * 0.5);
    const style = buildStyle(head, values, { classes: 5 });
    expect(style.method).toBe('quantile');
    expect(style.breaks).toEqual([5, 10, 15, 20]);
    expect(style.palette).toBe('ylorrd_r');
    expect(style.colors![0]).toBe('#800026');
  });

  it('все значения одинаковые — граница на значении, классов два', () => {
    const style = buildStyle(head, [7, 7, 7], { method: 'equal' });
    expect(style.breaks).toEqual([7]);
    expect(style.classes).toBe(2);
  });

  it('выражение MapLibre совпадает с colorFor', () => {
    const style = buildStyle(diameter, []);
    const expr = colorExpression(style) as any[];
    expect(expr[0]).toBe('case');
    expect(expr[2]).toEqual(['step', ['get', 'v'], style.colors![0], 80, style.colors![1], 150, style.colors![2],
      250, style.colors![3]]);
    expect(expr[3]).toBe('#9e9e9e');
    expect(layerFilter(style)).toBeUndefined();
    expect(layerFilter({ ...style, show_nulls: false })).toEqual(['==', ['typeof', ['get', 'v']], 'number']);
  });

  it('легенда: диапазоны, число участков и «нет данных»', () => {
    const style = buildStyle(diameter, []);
    const rows = legendRows(style, [50, 80, 100, 300, null, null], { digits: 0, units: 'мм' });
    expect(rows.map((r) => [r.label, r.count])).toEqual([
      ['до 80 мм', 1], ['80 – 150 мм', 2], ['150 – 250 мм', 0], ['250 мм и выше', 1], ['Нет данных', 2],
    ]);
    expect(legendRows({ ...style, show_nulls: false }, [null]).length).toBe(4);
  });

  it('справочник: уникальные значения и «прочие»', () => {
    const style = buildStyle(tubing, [], { categories: [1, 4] });
    expect(style.method).toBe('unique');
    expect(style.categories).toEqual([{ value: 1, color: '#4e79a7' }, { value: 4, color: '#f28e2b' }]);
    expect(colorFor(style, 4)).toBe('#f28e2b');
    expect(colorFor(style, 9)).toBe('#9e9e9e');
    const expr = colorExpression(style) as any[];
    expect(expr[2]).toEqual(['match', ['to-number', ['get', 'v']], 1, '#4e79a7', 4, '#f28e2b', '#9e9e9e']);
    const rows = legendRows(style, [1, 1, 4, 9], { labels: { 1: 'Подземная', 4: 'Надземная' } });
    expect(rows.map((r) => [r.label, r.count])).toEqual([['Подземная', 2], ['Надземная', 1], ['Прочие', 1]]);
  });
});
