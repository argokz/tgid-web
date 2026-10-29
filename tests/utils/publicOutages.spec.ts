import { describe, expect, it } from 'vitest';
import {
  PUBLIC_COLORS,
  consumersText,
  periodText,
  sortOutages,
  statusText,
  zonesForMap,
  type PublicOutageFeature,
  type PublicOutageProps,
} from '~/utils/publicOutages';

const feature = (over: Partial<PublicOutageProps>): PublicOutageFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [0, 0] },
  properties: {
    id: 1, number: 'О-1', kind: 'planned', kind_label: 'Плановое', status: 'announced', status_label: 'Объявлено',
    planned_start: '2026-11-02T09:00:00', planned_end: '2026-11-02T18:00:00', consumers_count: 3, note: '', ...over,
  },
});

describe('publicOutages: карта отключений для жителей', () => {
  it('идущие — первыми, затем по началу', () => {
    const sorted = sortOutages([
      feature({ id: 1, planned_start: '2026-11-02T09:00:00' }),
      feature({ id: 2, status: 'active', planned_start: '2026-11-03T09:00:00' }),
      feature({ id: 3, planned_start: '2026-11-01T09:00:00' }),
    ]);
    expect(sorted.map((f) => f.properties.id)).toEqual([2, 3, 1]);
  });

  it('подписи статуса, срока и числа потребителей', () => {
    expect(statusText(feature({ status: 'active' }).properties)).toBe('Идёт сейчас');
    expect(statusText(feature({ status: 'active', kind: 'emergency' }).properties)).toBe('Аварийное — идёт сейчас');
    expect(statusText(feature({}).properties)).toBe('Плановое, объявлено');
    expect(periodText({ planned_start: '2026-11-02T09:00:00', planned_end: '2026-11-02T18:00:00' }))
      .toBe('02.11.2026 с 09:00 до 18:00');
    expect(periodText({ planned_start: '2026-11-02T09:00:00', planned_end: '2026-11-03T12:00:00' }))
      .toBe('с 02.11.2026 09:00 до 03.11.2026 12:00');
    expect([1, 2, 5, 11, 21, 964].map(consumersText)).toEqual([
      '1 потребитель', '2 потребителя', '5 потребителей', '11 потребителей', '21 потребитель', '964 потребителя']);
  });

  it('цвет зоны по статусу', () => {
    const fc = zonesForMap([feature({ status: 'active' }), feature({})]);
    expect(fc.features.map((f) => f.properties?.color)).toEqual([PUBLIC_COLORS.active, PUBLIC_COLORS.announced]);
  });
});
