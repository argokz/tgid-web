/**
 * Трек бригады (полевое приложение, pages/field.vue): пока включено «Передавать местоположение», телефон
 * записывает точку не чаще раза в TRACK_MIN_GAP_MS — когда сдвинулся на TRACK_MIN_DISTANCE_M или прошла
 * минута стоянки. Точки копятся на устройстве (fieldStore) и уходят пачками (itwin-api database/field_track.py).
 *
 * Здесь — чистые правила: какую точку записать и как разложить накопленное по отправкам.
 */

export const TRACK_MIN_DISTANCE_M = 25;
export const TRACK_MIN_INTERVAL_MS = 60_000;
/** чаще не писать даже в машине: на скорости точка через каждые 25 м — лишнее */
export const TRACK_MIN_GAP_MS = 5_000;
/** точка с худшей точностью (в помещении, только по вышкам) — не пишется */
export const TRACK_MAX_ACCURACY_M = 100;
/** точек в одной отправке — как MAX_POINTS сервера */
export const TRACK_BATCH = 500;

export interface TrackPoint {
  /** время снятия, ISO — ключ точки на телефоне и на сервере */
  t: string;
  lon: number;
  lat: number;
  accuracy: number | null;
  /** бригада, выбранная на телефоне при снятии */
  brigadeId: number | null;
}

export interface TrackBatch {
  brigadeId: number | null;
  points: TrackPoint[];
}

const EARTH_R = 6_371_008.8;

/** Расстояние по сфере между точками, м */
export function distanceM(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Записать ли новую точку после последней записанной */
export function shouldRecord(prev: TrackPoint | null, next: TrackPoint): boolean {
  if (next.accuracy != null && next.accuracy > TRACK_MAX_ACCURACY_M) return false;
  if (!prev) return true;
  const dt = Date.parse(next.t) - Date.parse(prev.t);
  if (!(dt >= TRACK_MIN_GAP_MS)) return false;
  return dt >= TRACK_MIN_INTERVAL_MS || distanceM(prev, next) >= TRACK_MIN_DISTANCE_M;
}

/** Накопленное — по бригадам (у отправки одна бригада) и по TRACK_BATCH точек, по времени */
export function toBatches(points: TrackPoint[], size = TRACK_BATCH): TrackBatch[] {
  const byBrigade = new Map<number | null, TrackPoint[]>();
  for (const p of [...points].sort((a, b) => a.t.localeCompare(b.t))) {
    const list = byBrigade.get(p.brigadeId) ?? [];
    list.push(p);
    byBrigade.set(p.brigadeId, list);
  }
  const out: TrackBatch[] = [];
  byBrigade.forEach((list, brigadeId) => {
    for (let i = 0; i < list.length; i += size) out.push({ brigadeId, points: list.slice(i, i + size) });
  });
  return out;
}
