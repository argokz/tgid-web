import { describe, expect, it } from 'vitest';
import {
  gisLayers,
  gisReportLines,
  ISOLATION_META,
  isolationFrame,
  METER_COLOR,
  PRESSURE_META,
  pressureStatus,
  runLabel,
  stepTime,
  velocityColor,
  waterFrame,
  ZONE_COLORS,
  ZONE_OTHER_COLOR,
  ZONE_SOURCE_COLOR,
  zoneColors,
  zoneFrame,
  type WaterGisInspect,
  type WaterGisReport,
  type WaterIsolation,
  type WaterRun,
  type WaterStep,
  type WaterZone,
  type WaterZones,
} from '~/utils/water';

const net: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { kind: 'link', id: '60', type: 'Pipe' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { kind: 'node', id: '10', type: 'Junction' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { kind: 'node', id: 'Lake', type: 'Reservoir' } },
  ],
};

describe('water', () => {
  it('pressureStatus и velocityColor', () => {
    expect(pressureStatus('Junction', -0.6)).toBe('negative');
    expect(pressureStatus('Junction', 4)).toBe('low');
    expect(pressureStatus('Junction', 40)).toBe('ok');
    expect(pressureStatus('Junction', null)).toBe('no_data');
    expect(pressureStatus('Tank', 5)).toBe('source');
    expect(velocityColor(-2.85)).toBe('#0D47A1'); // по модулю: направление потока скорость не меняет
    expect(velocityColor(0.1)).toBe('#BBDEFB');
    expect(velocityColor(null)).toBe('#90A4AE');
  });

  it('waterFrame: значения шага к сети', () => {
    const step: WaterStep = { step: 8, time_s: 28800, times_s: [], pressure_m: { 10: -0.6, Lake: 0 },
      flow_ls: { 60: 120 }, velocity_ms: { 60: 2.85 } };
    const fc = waterFrame(net, step);
    expect(fc.features[0].properties).toMatchObject({ velocity_ms: 2.85, flow_ls: 120, color: '#0D47A1' });
    expect(fc.features[1].properties).toMatchObject({ status: 'negative', color: PRESSURE_META.negative.color });
    expect(fc.features[2].properties?.status).toBe('source');
    expect(waterFrame(net, null).features[1].properties?.status).toBe('no_data');
  });

  it('stepTime', () => {
    expect(stepTime(28800)).toBe('8 ч');
    expect(stepTime(5400)).toBe('1 ч 30 мин');
  });
});

const zone = (index: number, kind: WaterZone['kind']): WaterZone => ({
  index, name: `Зона ${index}`, kind, nodes: 1, junctions: 1, sources: [], demand_ls: 0, inlets: [],
});

describe('зоны водоучёта', () => {
  it('zoneColors: районы — по порядку, девятый — «прочие», источники — серые', () => {
    const zones = [zone(1, 'dma'), zone(2, 'source'), ...Array.from({ length: 8 }, (_, i) => zone(i + 3, 'dma'))];
    const c = zoneColors(zones);
    expect(c[1]).toBe(ZONE_COLORS[0]);
    expect(c[2]).toBe(ZONE_SOURCE_COLOR);
    expect(c[3]).toBe(ZONE_COLORS[1]); // источник не занимает цвет района
    expect(c[9]).toBe(ZONE_COLORS[7]);
    expect(c[10]).toBe(ZONE_OTHER_COLOR);
  });

  it('zoneFrame: участки и узлы — цветом зоны, расходомер — тёмный и толстый', () => {
    const zones: WaterZones = {
      meters: ['60'],
      zones: [zone(1, 'dma'), zone(2, 'source')],
      boundary: [{ link: '60', type: 'Pipe', reason: 'meter', start: '10', end: 'Lake', start_zone: 1, end_zone: 2 }],
      node_zone: { 10: 1, Lake: 2 },
      link_zone: {},
    };
    const f = zoneFrame(net, zones).features.map((x) => x.properties ?? {});
    expect(f[0]).toMatchObject({ boundary: 'meter', color: METER_COLOR, width: 5 });
    expect(f[1]).toMatchObject({ zone: 1, color: ZONE_COLORS[0] });
    expect(f[2]).toMatchObject({ zone: 2, color: ZONE_SOURCE_COLOR });
  });

  it('runLabel', () => {
    const base = { id: 1, summary: {} } as unknown as WaterRun;
    const leak = { id: 3, summary: { leaks: [{ node: '141', area_cm2: 2.5, avg_ls: 1, volume_m3: 1 }] } } as unknown as WaterRun;
    expect(runLabel(base)).toBe('№1 · базовый');
    expect(runLabel(leak)).toBe('№3 · утечка 141 (2,5 см²)');
  });
});

describe('отключение участка', () => {
  const iso = {
    link: '60', segment: { links: ['60'], nodes: ['10'], length_m: 100 }, close_valves: [{ id: 7, link: '61', node: '10' }],
    close_devices: [], sources_inside: [], no_water: { segment_nodes: ['10'], cut_off_nodes: [], demand_ls: 1 },
    closed_links: ['60', '61'], valves_total: 2,
  } as WaterIsolation;
  const valves: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [7, 8].map((id) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { kind: 'valve', id } })),
  };

  it('isolationFrame: участок красный и толстый, закрываемая задвижка добавлена, остальные — нет', () => {
    const f = isolationFrame(net, iso, valves).features.map((x) => x.properties ?? {});
    expect(f[0]).toMatchObject({ id: '60', color: ISOLATION_META.segment.color, width: 5 });
    expect(f[1]).toMatchObject({ id: '10', color: ISOLATION_META.segment.color });
    expect(f[2]).toMatchObject({ id: 'Lake', color: ISOLATION_META.other.color });
    expect(f.filter((p) => p.kind === 'valve')).toEqual([{ kind: 'valve', id: 7, color: ISOLATION_META.valve.color }]);
  });

  it('runLabel: расчёт отключения', () => {
    const run = { id: 9, summary: { isolation: { link: '129' } } } as unknown as WaterRun;
    expect(runLabel(run)).toBe('№9 · отключение трубы 129');
  });
});

describe('сеть из ГИС', () => {
  it('gisLayers: линейные — трубы, точечные — задвижки', () => {
    const info = { layers: [
      { name: 'pipes', geometry_type: 'MultiLineString', count: 10 },
      { name: 'valves', geometry_type: 'Point', count: 5 },
      { name: 'zones', geometry_type: 'Polygon', count: 2 },
    ] } as WaterGisInspect;
    expect(gisLayers(info, 'line')).toEqual(['pipes']);
    expect(gisLayers(info, 'point')).toEqual(['valves']);
    expect(gisLayers(null, 'line')).toEqual([]);
  });

  it('gisReportLines: только то, что случилось', () => {
    const base = {
      pipes: 3833, length_km: 276.465, junctions: 3337, sources: Array(18).fill({}), components: 18, kept_components: 18,
      dropped_pipes: 0, t_splits: 4, zero_length_dropped: 0, diameter: { missing: 0, field_in_metres: false },
      valves: { points: 4335, matched: 4212, missed: 0 },
    } as unknown as WaterGisReport;
    const lines = gisReportLines(base);
    expect(lines[0]).toBe('Труб в модели: 3 833 (276,465 км), узлов: 3 337, источников: 18.');
    expect(lines[1]).toBe('Связных частей: 18, в модели — 18.');
    expect(lines).toContain('Т-примыканий разрезано: 4.');
    expect(lines.some((l) => l.startsWith('Без диаметра'))).toBe(false);
    const dropped = gisReportLines({ ...base, kept_components: 1, dropped_pipes: 1977 });
    expect(dropped[1]).toBe('Связных частей: 18, в модели — 1; отброшено труб: 1 977 (не связаны с источником).');
  });
});
