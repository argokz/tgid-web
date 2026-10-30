import { describe, expect, it } from 'vitest';
import {
  TRACK_MAX_ACCURACY_M,
  TRACK_MIN_DISTANCE_M,
  distanceM,
  shouldRecord,
  toBatches,
  type TrackPoint,
} from '~/utils/fieldTrack';

const T0 = Date.parse('2026-10-30T09:00:00Z');
const pt = (sec: number, lat = 43.25, extra: Partial<TrackPoint> = {}): TrackPoint => ({
  t: new Date(T0 + sec * 1000).toISOString(), lon: 76.95, lat, accuracy: 10, brigadeId: 5, ...extra,
});
/** сдвиг по широте на метры */
const north = (m: number) => 43.25 + m / 111_195;

describe('shouldRecord', () => {
  it('первая точка — пишется; плохая точность — никогда', () => {
    expect(shouldRecord(null, pt(0))).toBe(true);
    expect(shouldRecord(null, pt(0, 43.25, { accuracy: TRACK_MAX_ACCURACY_M + 1 }))).toBe(false);
    expect(shouldRecord(null, pt(0, 43.25, { accuracy: null }))).toBe(true);
  });

  it('стоянка — раз в минуту, движение — каждые 25 м, но не чаще раза в 5 с', () => {
    const prev = pt(0);
    expect(shouldRecord(prev, pt(30))).toBe(false);
    expect(shouldRecord(prev, pt(60))).toBe(true);
    expect(shouldRecord(prev, pt(10, north(TRACK_MIN_DISTANCE_M + 1)))).toBe(true);
    expect(shouldRecord(prev, pt(10, north(TRACK_MIN_DISTANCE_M - 5)))).toBe(false);
    expect(shouldRecord(prev, pt(2, north(200)))).toBe(false);
    expect(shouldRecord(prev, pt(-120))).toBe(false); // часы назад — не пишем
  });

  it('расстояние по сфере', () => {
    expect(Math.round(distanceM({ lon: 76.95, lat: 43.25 }, { lon: 76.95, lat: north(100) }))).toBe(100);
  });
});

describe('toBatches', () => {
  it('по бригадам и по размеру пачки, по времени', () => {
    const points = [pt(30), pt(0), pt(10, 43.25, { brigadeId: null }), pt(20)];
    const batches = toBatches(points, 2);
    expect(batches.map((b) => [b.brigadeId, b.points.length])).toEqual([[5, 2], [5, 1], [null, 1]]);
    expect(batches[0].points.map((p) => p.t)).toEqual([pt(0).t, pt(20).t]);
    expect(toBatches([])).toEqual([]);
  });
});
