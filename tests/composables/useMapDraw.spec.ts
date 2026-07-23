import { describe, expect, it } from 'vitest';
import {
  formatArea,
  formatLength,
  haversine,
  lineLength,
  polygonArea,
} from '~/composables/useMapDraw';

describe('геометрия рисования', () => {
  it('haversine считает расстояние по большой окружности', () => {
    // Алматы → Астана, ~970 км по прямой
    const almaty = [76.8897, 43.2389];
    const astana = [71.4704, 51.1605];
    const meters = haversine(almaty, astana);
    expect(meters).toBeGreaterThan(950_000);
    expect(meters).toBeLessThan(1_000_000);
  });

  it('haversine симметричен и нулевой для совпадающих точек', () => {
    const a = [76.9, 43.2];
    const b = [76.95, 43.25];
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6);
    expect(haversine(a, a)).toBe(0);
  });

  it('lineLength суммирует сегменты', () => {
    const coords = [
      [76.9, 43.2],
      [76.91, 43.2],
      [76.92, 43.2],
    ];
    const total = lineLength(coords);
    const first = haversine(coords[0], coords[1]);
    const second = haversine(coords[1], coords[2]);
    expect(total).toBeCloseTo(first + second, 6);
  });

  it('lineLength нулевая для одной точки', () => {
    expect(lineLength([[76.9, 43.2]])).toBe(0);
    expect(lineLength([])).toBe(0);
  });

  it('polygonArea считает площадь прямоугольника с разумной точностью', () => {
    // ~0.01° по долготе и широте около экватора широты 43°
    const ring = [
      [76.90, 43.20],
      [76.91, 43.20],
      [76.91, 43.21],
      [76.90, 43.21],
    ];
    const area = polygonArea(ring);
    // Ожидаемая площадь: (0.01° долготы * cos43° * 111320) x (0.01° широты * 110570)
    const expected = 0.01 * 111_320 * Math.cos((43.205 * Math.PI) / 180) * (0.01 * 110_570);
    expect(area).toBeGreaterThan(expected * 0.9);
    expect(area).toBeLessThan(expected * 1.1);
  });

  it('polygonArea нулевая для вырожденных контуров', () => {
    expect(polygonArea([])).toBe(0);
    expect(polygonArea([[76.9, 43.2], [76.91, 43.2]])).toBe(0);
  });

  it('polygonArea не зависит от явного замыкания кольца', () => {
    const open = [
      [76.90, 43.20],
      [76.91, 43.20],
      [76.91, 43.21],
    ];
    const closed = [...open, open[0]];
    expect(polygonArea(open)).toBeCloseTo(polygonArea(closed), 6);
  });

  it('formatLength переключается на километры', () => {
    expect(formatLength(250.4)).toBe('250.4 м');
    expect(formatLength(1500)).toBe('1.50 км');
    expect(formatLength(Number.NaN)).toBe('—');
  });

  it('formatArea переключает м² / га / км²', () => {
    expect(formatArea(500)).toBe('500.0 м²');
    expect(formatArea(25_000)).toBe('2.50 га');
    expect(formatArea(2_500_000)).toBe('2.500 км²');
    expect(formatArea(Number.NaN)).toBe('—');
  });
});
