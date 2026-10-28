import { describe, expect, it } from 'vitest';
import { MAX_TRACE_IDS, TRACE_TYPES, featureBounds, parseIdList, traceTypeMeta } from '~/utils/networkTrace';

describe('parseIdList', () => {
  it('принимает запятые, пробелы и точки с запятой, убирает повторы', () => {
    expect(parseIdList('12, 15 18;20 12')).toEqual({ ids: [12, 15, 18, 20], error: null });
  });

  it('пустая строка — пустой список без ошибки', () => {
    expect(parseIdList('')).toEqual({ ids: [], error: null });
    expect(parseIdList(null)).toEqual({ ids: [], error: null });
  });

  it('не молчит о мусоре и нулях', () => {
    expect(parseIdList('12, абв').error).toContain('абв');
    expect(parseIdList('0').error).toContain('0');
    expect(parseIdList('-5').error).toContain('-5');
    expect(parseIdList('1.5').error).toContain('1.5');
  });

  it('держит предел API', () => {
    const many = Array.from({ length: MAX_TRACE_IDS + 1 }, (_, i) => i + 1).join(',');
    expect(parseIdList(many).error).toContain(String(MAX_TRACE_IDS));
  });
});

describe('featureBounds', () => {
  it('охватывает линии и точки разных коллекций', () => {
    const lines: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[76.9, 43.2], [76.95, 43.25]] } },
      ],
    };
    const points: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [76.8, 43.3] } }],
    };
    expect(featureBounds(lines, points)).toEqual([76.8, 43.2, 76.95, 43.3]);
  });

  it('пусто — null', () => {
    expect(featureBounds({ type: 'FeatureCollection', features: [] }, null)).toBeNull();
  });
});

describe('traceTypeMeta', () => {
  it('у каждого типа API есть подпись и цвет', () => {
    for (const type of ['connected', 'upstream', 'downstream', 'subnetwork'] as const) {
      const meta = traceTypeMeta(type);
      expect(meta.value).toBe(type);
      expect(meta.color).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(TRACE_TYPES).toHaveLength(4);
  });
});
