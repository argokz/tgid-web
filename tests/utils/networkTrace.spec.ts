import { describe, expect, it } from 'vitest';
import { useJournalMapBridge } from '~/composables/useJournalMapBridge';
import {
  MAX_TRACE_IDS,
  STOP_KINDS,
  TRACE_TYPES,
  featureBounds,
  parseIdList,
  stopKindsText,
  supportsStops,
  traceTypeMeta,
} from '~/utils/networkTrace';

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

describe('барьеры по условию', () => {
  it('действуют у «связанных» и «зоны»', () => {
    expect(supportsStops('connected')).toBe(true);
    expect(supportsStops('subnetwork')).toBe(true);
    expect(supportsStops('upstream')).toBe(false);
    expect(supportsStops('downstream')).toBe(false);
  });

  it('подпись в порядке справочника, без неизвестных', () => {
    expect(stopKindsText(['setpress', 'valves'])).toBe('задвижки, узлы заданного напора');
    expect(stopKindsText([])).toBe('');
    expect(stopKindsText(undefined)).toBe('');
    expect(STOP_KINDS.map((k) => k.value)).toEqual(['valves', 'pumpstations', 'setpress', 'sources']);
  });
});

describe('результат трассировки как выборка', () => {
  it('добавляется в выбор участков с геометрией и в выбор узлов', async () => {
    const bridge = useJournalMapBridge();
    bridge.offerSelection({
      label: 'Квартал',
      lineIds: [10, 20],
      nodeIds: [1, 2, 3],
      lineFeatures: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { id: 10 } }],
    });
    const lines = bridge.startPick([20, 30], 'свойства участков', 'line');
    expect(bridge.addOffered()).toBe(1);
    expect(bridge.state.pick.lineIds).toEqual([20, 30, 10]);
    expect(bridge.state.pick.features[10]).toBeTruthy();
    bridge.finishPick(true);
    await expect(lines).resolves.toEqual([20, 30, 10]);

    const nodes = bridge.startPick([], 'узлы', 'node');
    expect(bridge.addOffered()).toBe(3);
    bridge.finishPick(false);
    await expect(nodes).resolves.toBeNull();
    // вне режима выбора ничего не добавляется
    expect(bridge.addOffered()).toBe(0);
    bridge.offerSelection(null);
  });
});
