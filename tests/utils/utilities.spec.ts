import { describe, expect, it } from 'vitest';
import {
  clearanceText,
  CONFLICT_META,
  conflictsFrame,
  depthRangeText,
  depthText,
  excavationFrame,
  NET_COLOR,
  pointGeometry,
  type UtilityConflicts,
  type UtilityExcavation,
} from '~/utils/utilities';

const pt = (x: number, y: number): GeoJSON.Point => ({ type: 'Point', coordinates: [x, y] });

describe('общая карта коммуникаций', () => {
  it('conflictsFrame: пересечения и сближения — точками со своим цветом, без точки — пропуск', () => {
    const c = {
      crossings: [{ water_link: '225', heat_line: 74224, point: pt(1, 1) }],
      close: [{ water_link: '283', heat_line: 75158, point: pt(2, 2), clearance_m: 0.04 },
        { water_link: '1', heat_line: 2, point: null, clearance_m: 1 }],
    } as unknown as UtilityConflicts;
    const f = conflictsFrame(c).features.map((x) => x.properties);
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ kind: 'crossing', color: CONFLICT_META.crossing.color, label: '225 × 74224' });
    expect(f[1]).toMatchObject({ kind: 'close', color: CONFLICT_META.close.color, label: '0,04 м' });
  });

  it('excavationFrame: цвет по виду сети, зона — жёлтая', () => {
    const e = { geojson: { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: pt(0, 0), properties: { kind: 'zone' } },
      { type: 'Feature', geometry: pt(0, 0), properties: { kind: 'heat', id: 1 } },
      { type: 'Feature', geometry: pt(0, 0), properties: { kind: 'water', id: 'L' } },
    ] } } as unknown as UtilityExcavation;
    expect(excavationFrame(e).features.map((x) => x.properties?.color)).toEqual([NET_COLOR.zone, NET_COLOR.heat, NET_COLOR.water]);
  });

  it('clearanceText и pointGeometry', () => {
    expect(clearanceText(0.25)).toBe('0,25 м');
    expect(clearanceText(-0.22)).toBe('перекрытие 0,22 м');
    expect(pointGeometry(76.123456789, 43.987654321).coordinates).toEqual([76.1234568, 43.9876543]);
  });

  it('depthText и depthRangeText: над землёй, оценка, диапазон', () => {
    expect(depthText(1.5)).toBe('1,5 м');
    expect(depthText(-2)).toBe('над землёй 2 м');
    expect(depthText(1.234, 'neighbors')).toBe('≈1,23 м');
    expect(depthText(null)).toBe('—');
    expect(depthRangeText(-2, 1.5, 'nodes')).toBe('над землёй 2 м … 1,5 м');
    expect(depthRangeText(1.5, 1.52)).toBe('1,5 м');
    expect(depthRangeText(null, 1.2, 'node')).toBe('1,2 м');
  });
});
