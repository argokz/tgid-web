import { describe, expect, it } from 'vitest';
import { PRESSURE_META, pressureStatus, stepTime, velocityColor, waterFrame, type WaterStep } from '~/utils/water';

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
