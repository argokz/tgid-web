import { describe, expect, it } from 'vitest';
import {
  bearing,
  formatArea,
  formatBearing,
  formatLength,
  haversine,
  lineLength,
  pointsAlong,
  polygonArea,
  profileStats,
} from '~/composables/useMapDraw';
import { elevationFromRgb, tilePosition } from '~/utils/terrainSample';

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
    expect(formatLength(250.4)).toBe('250,4 м');
    expect(formatLength(1500)).toBe('1,50 км');
    expect(formatLength(Number.NaN)).toBe('—');
  });

  it('formatArea переключает м² / га / км²', () => {
    expect(formatArea(500)).toBe('500,0 м²');
    expect(formatArea(25_000)).toBe('2,50 га');
    expect(formatArea(2_500_000)).toBe('2,500 км²');
    expect(formatArea(Number.NaN)).toBe('—');
  });
});

describe('азимут и профиль высот', () => {
  it('bearing: север 0°, восток 90°, юг 180°, запад 270°', () => {
    const o = [76.9, 43.2];
    expect(bearing(o, [76.9, 43.3])).toBeCloseTo(0, 3);
    expect(bearing(o, [77.0, 43.2])).toBeCloseTo(90, 0);
    expect(bearing(o, [76.9, 43.1])).toBeCloseTo(180, 3);
    expect(bearing(o, [76.8, 43.2])).toBeCloseTo(270, 0);
    expect(formatBearing(359.7)).toBe('0°');
  });

  it('pointsAlong: равный шаг по длине ломаной, концы совпадают', () => {
    const line = [[76.9, 43.2], [76.91, 43.2], [76.91, 43.21]];
    const pts = pointsAlong(line, 11);
    const total = lineLength(line);
    expect(pts).toHaveLength(11);
    expect(pts[0]).toMatchObject({ d: 0, lng: 76.9, lat: 43.2 });
    expect(pts[10].d).toBeCloseTo(total, 6);
    expect(pts[10].lng).toBeCloseTo(76.91, 9);
    expect(pts[10].lat).toBeCloseTo(43.21, 9);
    expect(pts[5].d).toBeCloseTo(total / 2, 6);
  });

  it('profileStats: перепад, подъём/спуск, уклон в ‰; пропуски без данных', () => {
    const s = profileStats([
      { d: 0, h: 800 }, { d: 50, h: 805 }, { d: 100, h: null }, { d: 150, h: 798 }, { d: 200, h: 790 },
    ])!;
    expect(s).toMatchObject({ start: 800, end: 790, min: 790, max: 805, gain: 5, loss: 15 });
    expect(s.slopePermille).toBeCloseTo(-50, 6);
    expect(profileStats([{ d: 0, h: null }])).toBeNull();
  });

  it('terrain-rgb: высота из пикселя и тайл точки', () => {
    expect(elevationFromRgb(1, 134, 160)).toBeCloseTo(0, 6);
    expect(elevationFromRgb(1, 168, 52)).toBeCloseTo(859.6, 6);
    const p = tilePosition(76.94, 43.25, 14);
    expect([p.x, p.y]).toEqual([11693, 6004]);
    expect(p.fx).toBeGreaterThanOrEqual(0);
    expect(p.fx).toBeLessThan(1);
  });
});

describe('измерение и двойной клик (QA F25)', () => {
  it('во время измерения doubleClickZoom выключен, после — включён', async () => {
    const { useMapDraw } = await import('~/composables/useMapDraw');
    const dbl = { enabled: true, enable() { this.enabled = true; }, disable() { this.enabled = false; } };
    const canvas = { style: { cursor: '' } };
    const map: any = {
      doubleClickZoom: dbl,
      on() {}, off() {}, getStyle: () => ({ layers: [] }), dragPan: { enable() {}, disable() {} },
      getCanvas: () => canvas,
      getLayer: () => undefined, getSource: () => undefined,
      addSource() {}, addLayer() {}, removeLayer() {}, removeSource() {},
      isStyleLoaded: () => true, loaded: () => true, style: { _loaded: true },
    };
    const draw = useMapDraw();
    draw.attach(map);
    draw.setMode('measure-distance');
    expect(dbl.enabled).toBe(false);
    draw.setMode('none');
    expect(dbl.enabled).toBe(true);
    draw.setMode('measure-area');
    draw.detach();
    expect(dbl.enabled).toBe(true);
  });
});
