import { describe, expect, it } from 'vitest';
import { BALANCE_META, flowText, zoneFeature, type BalanceZone } from '~/utils/flowBalance';

describe('flowBalance', () => {
  it('flowText: тысячи, знак небаланса', () => {
    expect(flowText(1149.7)).toBe('1\u00a0150');
    expect(flowText(80.9, true)).toBe('+81');
    expect(flowText(-307.7, true)).toBe('−308');
    expect(flowText(0, true)).toBe('0');
    expect(flowText(null)).toBe('—');
  });

  it('zoneFeature: цвет вывода, пусто без геометрии', () => {
    const zone = { key: 535303, status: 'growth' } as BalanceZone;
    const geometry: GeoJSON.Geometry = { type: 'Polygon', coordinates: [[[76.9, 43.3], [77, 43.3], [77, 43.4], [76.9, 43.3]]] };
    const fc = zoneFeature(zone, { key: 535303, lines: 9000, hull: true, geometry });
    expect(fc.features[0].properties).toEqual({ name: 'Зона 535303', color: BALANCE_META.growth.color });
    expect(zoneFeature(zone, { key: 1, lines: 0, hull: false, geometry: null }).features).toEqual([]);
  });
});
