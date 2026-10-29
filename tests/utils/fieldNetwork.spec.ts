import { describe, expect, it } from 'vitest';
import type { SelectResult } from '~/services/api/types';
import { NETWORK_MAX_AGE_MS, NETWORK_RADIUS_M, isFresh, networkSpec, resultToFeatures } from '~/utils/fieldNetwork';

describe('networkSpec', () => {
  it('в радиусе от места работ, только фрагмент наряда (сценарии — копии с той же геометрией)', () => {
    const spec = networkSpec({ lon: 76.95, lat: 43.25, fileid: 74 }, 'nodes');
    expect(spec.target).toBe('nodes');
    expect(spec.near).toEqual({ lon: 76.95, lat: 43.25, meters: NETWORK_RADIUS_M });
    expect(spec.fragment_ids).toEqual([74]);
    expect(spec.conditions).toEqual([]);
    expect(networkSpec({ lon: 1, lat: 2, fileid: null }, 'lines').fragment_ids).toBeNull();
  });
});

describe('resultToFeatures', () => {
  it('подписи из строк выборки попадают в свойства объектов карты', () => {
    const res = {
      items: [{ id: 7, fileid: 74, title: 'ТК-12', node_type: 'Камера', card_type: 'Задвижка', values: {}, lon: 1, lat: 2 }],
      geojson: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', id: 7, geometry: { type: 'Point', coordinates: [1, 2] }, properties: { id: 7, fileid: 74 } },
          { type: 'Feature', id: 8, geometry: { type: 'Point', coordinates: [3, 4] }, properties: { id: 8, fileid: 74 } },
        ],
      },
    } as unknown as SelectResult;
    const fc = resultToFeatures(res);
    expect(fc.features[0].properties).toEqual({ id: 7, fileid: 74, title: 'ТК-12', node_type: 'Камера', card_type: 'Задвижка' });
    expect(fc.features[1].properties).toMatchObject({ id: 8, title: '', node_type: null });
    expect(resultToFeatures({ items: [] } as unknown as SelectResult).features).toEqual([]);
  });
});

describe('isFresh', () => {
  it('сохранённое за последние 12 часов — свежее; нет или битая дата — нет', () => {
    const now = Date.parse('2026-10-30T12:00:00Z');
    expect(isFresh({ savedAt: '2026-10-30T01:00:00Z' }, now)).toBe(true);
    expect(isFresh({ savedAt: new Date(now - NETWORK_MAX_AGE_MS - 1).toISOString() }, now)).toBe(false);
    expect(isFresh({ savedAt: 'вчера' }, now)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
  });
});
