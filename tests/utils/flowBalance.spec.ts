import { describe, expect, it } from 'vitest';
import { alertText, BALANCE_META, flowText, zoneFeature, type BalanceAlert, type BalanceZone } from '~/utils/flowBalance';

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

describe('alertText', () => {
  it('ночной рост и небаланс с цифрами', () => {
    const base: Omit<BalanceAlert, 'status'> = {
      id: 1, zone_key: 535303, zone_kind: 'source', boundary: [324808], prev_status: null, at: '2026-10-30T18:00:00Z',
      night: '2026-10-30', night_value: 1230.5, night_baseline: 1149.7, night_growth: 80.9, excess: 301, uncertainty: 764,
      acknowledged_by: null, acknowledged_at: null,
    };
    expect(alertText({ ...base, status: 'growth' }))
      .toBe('источник — подпитка (участки 324808): ночной расход 1\u00a0150 → 1\u00a0231 т/ч (+81)');
    expect(alertText({ ...base, status: 'leak' })).toBe('источник — подпитка (участки 324808): небаланс +301 ± 764 т/ч');
  });
});
