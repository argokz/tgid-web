import { describe, expect, it } from 'vitest';
import {
  OUTAGE_ZONE_COLORS,
  durationText,
  isOutageForward,
  outageMapData,
  outageTransitionLabel,
  zonesMapData,
  type Outage,
} from '~/utils/outages';

const outage = (over: Partial<Outage> = {}): Outage => ({
  id: 1, number: 'О-2026-00001', title: 'Замена задвижки', kind: 'planned', kind_label: 'Плановое',
  status: 'announced', status_label: 'Объявлено', next: ['active'], recomputable: true, line_id: 10, node_id: null,
  work_order_id: null, fileid: 74, lon: 76.9, lat: 43.2, planned_start: '2026-11-02T04:00:00Z',
  planned_end: '2026-11-02T13:00:00Z', actual_start: null, actual_end: null, reason: '', public: false, public_note: '',
  consumers_count: 2, load_gcal_h: 3.5, computed_at: null, revision: 1,
  area: { type: 'Polygon', coordinates: [[[76.9, 43.2], [76.91, 43.2], [76.9, 43.21], [76.9, 43.2]]] },
  valves: [{ id: 1, name: 'З-1', line_id: 10, required: true, diameter: 500, state: null, lng: 76.9, lat: 43.2 },
    { id: 2, name: null, line_id: 11, required: false, diameter: null, state: null, lng: null, lat: null }],
  consumers: [{ id: 5, type: 'real', node_id: 50, name: 'Школа №1', load: 1.5, lng: 76.9, lat: 43.2, downstream: true }],
  ...over,
});

describe('outages: отключения', () => {
  it('подписи и направление переходов', () => {
    expect(outageTransitionLabel('planned', 'announced')).toBe('Объявлено потребителям');
    expect(outageTransitionLabel('announced', 'active')).toBe('Отключили');
    expect(outageTransitionLabel('active', 'finished')).toBe('Включили — завершить');
    expect(outageTransitionLabel('announced', 'planned')).toBe('Вернуть в план');
    expect(outageTransitionLabel('cancelled', 'planned')).toBe('Запланировать снова');
    expect(isOutageForward('planned', 'active')).toBe(true);
    expect(isOutageForward('announced', 'planned')).toBe(false);
    expect(isOutageForward('planned', 'cancelled')).toBe(false);
    expect(isOutageForward('cancelled', 'planned')).toBe(true);
  });

  it('длительность', () => {
    expect(durationText('2026-11-02T04:00:00Z', '2026-11-02T13:00:00Z')).toBe('9 ч');
    expect(durationText('2026-11-02T04:00:00Z', '2026-11-03T07:30:00Z')).toBe('1 сут 3 ч');
    expect(durationText('2026-11-02T04:00:00Z', '2026-11-02T04:45:00Z')).toBe('45 мин');
    expect(durationText('2026-11-02T04:00:00Z', '2026-11-02T03:00:00Z')).toBe('—');
  });

  it('слой карты: зона, задвижки с координатами, потребители', () => {
    const fc = outageMapData(outage());
    expect(fc.features.map((f) => f.properties?.kind)).toEqual(['zone', 'valve', 'consumer']);
    expect(fc.features[0]!.properties?.color).toBe(OUTAGE_ZONE_COLORS.announced);
    expect(fc.features[1]!.properties).toMatchObject({ required: true, name: 'З-1' });
    expect(fc.features[2]!.properties).toMatchObject({ downstream: true });
    expect(outageMapData(outage({ area: null, valves: [], consumers: [] })).features).toEqual([]);
    const zones = zonesMapData({ type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { status: 'active' } }] });
    expect(zones.features[0]!.properties).toMatchObject({ kind: 'zone', color: OUTAGE_ZONE_COLORS.active });
  });
});
