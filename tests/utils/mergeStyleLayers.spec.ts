import { describe, expect, it } from 'vitest';
import { expression as styleExpression, featureFilter, v8 } from '@maplibre/maplibre-gl-style-spec';
import {
  legacyFilterToExpression,
  mergeLineLayers,
  stopsValueAt,
  type StyleLayerLike,
} from '~/utils/mergeStyleLayers';

/** Проверка выражения спецификацией MapLibre: парсится ли как paint-свойство линии */
const assertPaintExpression = (key: string, value: unknown) => {
  const spec = (v8.paint_line as Record<string, any>)[key];
  const result = styleExpression.createPropertyExpression(value as any, spec);
  expect(result.result, `${key}: ${JSON.stringify((result as any).value).slice(0, 200)}`).toBe('success');
};

/** Четыре класса участков как в стиле GeoServer (подслои отличаются фильтром, цветом, смещением и пунктиром) */
const legacyAny = (prop: string, v: string) => ['any', ['==', prop, v], ['==', prop, Number(v)], ['==', prop, v === '1']];
const pipeLayer = (id: string, filter: unknown, color: string, offsetSign: 1 | -1, dashed = false): StyleLayerLike => ({
  id,
  type: 'line',
  'source-layer': 'heatpipesections',
  minzoom: 12,
  filter,
  layout: { 'line-cap': 'butt', 'line-join': 'round' },
  paint: {
    'line-color': color,
    'line-width': { stops: [[12, 0.5], [14, 0.9], [16, 1.2]] },
    'line-offset': { stops: [[12, 0], [13, 0.3 * offsetSign], [15, 0.9 * offsetSign]] },
    'line-opacity': { stops: [[12, 0.55], [14, 0.9], [15, 1]] },
    ...(dashed ? { 'line-dasharray': [2, 1] } : {}),
  },
});
const obr = ['all', legacyAny('obr', '1'), legacyAny('nadz', '0')];
const obrZakr = ['all', legacyAny('obr', '1'), legacyAny('zakr', '1')];
const pod = ['all', legacyAny('pod', '1'), legacyAny('nadz', '0')];
const obrNadz = ['all', legacyAny('obr', '1'), legacyAny('nadz', '1')];

describe('mergeLineLayers: подслои участков', () => {
  it('сливает линии с одинаковым оформлением, пунктирные — отдельно, подписи не трогает', () => {
    const symbol: StyleLayerLike = { id: 'Диаметр', type: 'symbol', filter: ['>', ['get', 'du'], 0], layout: { 'text-field': 'Ду {du}' } };
    const input = [
      pipeLayer('Обратка', obr, '#00007f', 1),
      pipeLayer('Обратка закрытая', obrZakr, '#808000', 1),
      pipeLayer('Обратка надземная', obrNadz, '#00007f', 1, true),
      pipeLayer('Подача', pod, '#7f0000', -1),
      symbol,
    ];
    const out = mergeLineLayers(input);
    expect(out.map((l) => l.id)).toEqual(['Обратка +2', 'Обратка надземная', 'Диаметр']);
    const merged = out[0];
    expect(merged.metadata?.mergedFrom).toEqual(['Обратка', 'Обратка закрытая', 'Подача']);
    expect(merged.minzoom).toBe(12);
    expect(merged.layout).toEqual({ 'line-cap': 'butt', 'line-join': 'round' });
    // фильтр — объединение классов в синтаксисе выражений
    expect((merged.filter as unknown[])[0]).toBe('any');
    expect((merged.filter as unknown[]).length).toBe(4);
    expect(featureFilter(merged.filter as any).filter({ zoom: 14 } as any, { type: 2, properties: { obr: 1, nadz: 0 } } as any)).toBe(true);
    expect(featureFilter(merged.filter as any).filter({ zoom: 14 } as any, { type: 2, properties: { obr: 1, nadz: 1 } } as any)).toBe(false);
    // цвет — case по классам, ширина одинакова и осталась как была, смещение — interpolate с case на каждом зуме
    expect((merged.paint!['line-color'] as unknown[])[0]).toBe('case');
    expect(merged.paint!['line-width']).toEqual({ stops: [[12, 0.5], [14, 0.9], [16, 1.2]] });
    const offset = merged.paint!['line-offset'] as unknown[];
    expect(offset.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']]);
    expect(offset[3]).toBe(12);
    expect((offset[4] as unknown[])[0]).toBe('case');
    // одинаковая у всех прозрачность остаётся legacy-функцией stops (это не выражение — проверяем только выражения)
    expect(merged.paint!['line-opacity']).toEqual({ stops: [[12, 0.55], [14, 0.9], [15, 1]] });
    for (const key of ['line-color', 'line-offset']) assertPaintExpression(key, merged.paint![key]);
    // пунктирный слой остался нетронутым
    expect(out[1]).toEqual(input[2]);
  });

  it('значение paint считается по классу: подача получает отрицательное смещение', () => {
    const [merged] = mergeLineLayers([pipeLayer('Обратка', obr, '#00007f', 1), pipeLayer('Подача', pod, '#7f0000', -1)]);
    const spec = (v8.paint_line as Record<string, any>)['line-offset'];
    const expr = styleExpression.createPropertyExpression(merged.paint!['line-offset'] as any, spec);
    expect(expr.result).toBe('success');
    const evalAt = (zoom: number, properties: Record<string, unknown>) =>
      (expr as any).value.evaluate({ zoom }, { type: 2, properties } as any);
    expect(evalAt(15, { obr: 1, nadz: 0 })).toBeCloseTo(0.9, 3);
    expect(evalAt(15, { pod: 1, nadz: 0 })).toBeCloseTo(-0.9, 3);
    expect(evalAt(14, { obr: 1, nadz: 0 })).toBeCloseTo(0.6, 3);
  });

  it('не сливает слои без фильтра, с разным minzoom или layout, с выражениями в paint', () => {
    const a = pipeLayer('A', obr, '#00007f', 1);
    const noFilter = { ...pipeLayer('B', pod, '#7f0000', -1), filter: undefined };
    const otherZoom = { ...pipeLayer('C', pod, '#7f0000', -1), minzoom: 9 };
    const otherLayout = { ...pipeLayer('D', pod, '#7f0000', -1), layout: { 'line-cap': 'round' } };
    const exprPaint = { ...pipeLayer('E', pod, '#7f0000', -1), paint: { 'line-color': ['get', 'color'] } };
    expect(mergeLineLayers([a, noFilter, otherZoom, otherLayout, exprPaint]).map((l) => l.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('группа ставится на место первого слоя, порядок остальных сохраняется', () => {
    const fill: StyleLayerLike = { id: 'fill', type: 'fill', filter: ['==', 'kind', 'x'], paint: { 'fill-color': '#fff' } };
    const out = mergeLineLayers([fill, pipeLayer('A', obr, '#00007f', 1), pipeLayer('X', obrNadz, '#00007f', 1, true), pipeLayer('B', pod, '#7f0000', -1)]);
    expect(out.map((l) => l.id)).toEqual(['fill', 'A +1', 'X']);
  });
});

describe('legacyFilterToExpression', () => {
  it('переводит операторы legacy-фильтра', () => {
    expect(legacyFilterToExpression(['==', 'obr', '1'])).toEqual(['==', ['get', 'obr'], '1']);
    expect(legacyFilterToExpression(['in', 'code', 'US', 'TK'])).toEqual(['in', ['get', 'code'], ['literal', ['US', 'TK']]]);
    expect(legacyFilterToExpression(['!in', 'code', 'US'])).toEqual(['!', ['in', ['get', 'code'], ['literal', ['US']]]]);
    expect(legacyFilterToExpression(['!has', 'du'])).toEqual(['!', ['has', 'du']]);
    expect(legacyFilterToExpression(['>', 'du', 100])).toEqual(['all', ['has', 'du'], ['>', ['to-number', ['get', 'du']], 100]]);
    expect(legacyFilterToExpression(['==', '$type', 'LineString'])).toEqual(['==', ['geometry-type'], 'LineString']);
    expect(legacyFilterToExpression(['none', ['==', 'a', 1]])).toEqual(['all', ['!', ['==', ['get', 'a'], 1]]]);
  });

  it('неизвестный оператор — null, выражения проходят как есть', () => {
    expect(legacyFilterToExpression(['within', {}])).toBeNull();
    expect(legacyFilterToExpression(['all', ['==', ['get', 'a'], 1], ['==', 'b', 2]])).toEqual(['all', ['==', ['get', 'a'], 1], ['==', ['get', 'b'], 2]]);
  });

  it('переведённый фильтр совпадает с legacy по результату на объектах', () => {
    const legacy = ['all', legacyAny('obr', '1'), ['!in', 'code', 'X'], ['>', 'du', 100]];
    const expr = legacyFilterToExpression(legacy)!;
    const f1 = featureFilter(legacy as any).filter;
    const f2 = featureFilter(expr as any).filter;
    for (const properties of [{ obr: 1, code: 'A', du: 200 }, { obr: '1', code: 'X', du: 200 }, { obr: 0, du: 200 }, { obr: true, code: 'B', du: 50 }, { obr: true, code: 'B' }]) {
      const feature = { type: 2, properties } as any;
      expect(f2({ zoom: 14 } as any, feature), JSON.stringify(properties)).toBe(f1({ zoom: 14 } as any, feature));
    }
  });
});

describe('stopsValueAt', () => {
  it('линейная интерполяция с зажимом по краям', () => {
    const fn = { stops: [[12, 0], [13, 0.3], [15, 0.9]] as Array<[number, number]> };
    expect(stopsValueAt(fn, 10)).toBe(0);
    expect(stopsValueAt(fn, 12.5)).toBeCloseTo(0.15, 6);
    expect(stopsValueAt(fn, 14)).toBeCloseTo(0.6, 6);
    expect(stopsValueAt(fn, 20)).toBe(0.9);
  });
});
