/**
 * Геометрия CAD-редактора в метрах на земле, а не в пикселях и не в проекции карты.
 *
 * Web Mercator на широте Алматы растягивает метр примерно в 1,37 раза, поэтому длины, привязка
 * по радиусу и углы считаются в локальной касательной плоскости вокруг точки (равнопромежуточная
 * проекция: на окне в несколько километров ошибка — сотые доли процента). Окончательную длину
 * участка всё равно задаёт сервер (ST_Length в местной СК 9998).
 */

import type { LngLat } from '~/utils/lineVertices';

export type XY = [number, number];

const EARTH_RADIUS_M = 6371008.8;
const DEG = Math.PI / 180;

/** Расстояние по большому кругу, м */
export const distanceM = (a: LngLat, b: LngLat): number => {
  const dLat = (b[1] - a[1]) * DEG;
  const dLng = (b[0] - a[0]) * DEG;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
};

/** Длина ломаной, м */
export const polylineLengthM = (coords: readonly LngLat[]): number => {
  let sum = 0;
  for (let i = 1; i < coords.length; i++) sum += distanceM(coords[i - 1], coords[i]);
  return sum;
};

/** Локальная плоскость в метрах вокруг origin: lng/lat ↔ x (восток) / y (север) */
export interface LocalFrame {
  origin: LngLat;
  toXY: (p: LngLat) => XY;
  toLngLat: (p: XY) => LngLat;
}

export const localFrame = (origin: LngLat): LocalFrame => {
  const kx = EARTH_RADIUS_M * DEG * Math.cos(origin[1] * DEG);
  const ky = EARTH_RADIUS_M * DEG;
  return {
    origin,
    toXY: (p) => [(p[0] - origin[0]) * kx, (p[1] - origin[1]) * ky],
    toLngLat: (p) => [origin[0] + p[0] / kx, origin[1] + p[1] / ky],
  };
};

/** Ближайшая точка отрезка ab к p (всё в метрах): t ∈ [0, 1] — доля от a */
export const projectOnSegment = (p: XY, a: XY, b: XY): { point: XY; t: number; dist: number } => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  const point: XY = [a[0] + t * dx, a[1] + t * dy];
  return { point, t, dist: Math.hypot(p[0] - point[0], p[1] - point[1]) };
};

/** Азимут отрезка a → b, градусы от севера по часовой [0, 360) */
export const bearingDeg = (a: LngLat, b: LngLat): number => {
  const f = localFrame(a);
  const [x, y] = f.toXY(b);
  return ((Math.atan2(x, y) / DEG) + 360) % 360;
};

/**
 * Угол поворота трассы в вершине cur (0 — прямо, 180 — разворот), как угол отвода.
 * null — соседние точки совпадают.
 */
export const turnAngleDeg = (prev: LngLat, cur: LngLat, next: LngLat): number | null => {
  const f = localFrame(cur);
  const u = f.toXY(prev);
  const v = f.toXY(next);
  const ux = -u[0];
  const uy = -u[1];
  const lu = Math.hypot(ux, uy);
  const lv = Math.hypot(v[0], v[1]);
  if (lu === 0 || lv === 0) return null;
  const cos = Math.max(-1, Math.min(1, (ux * v[0] + uy * v[1]) / (lu * lv)));
  return Math.acos(cos) / DEG;
};

/** Угол в (-180, 180] */
export const normalizeDeg180 = (deg: number): number => {
  const d = ((deg % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
};

/** Угол в [0, 360) */
export const normalizeDeg360 = (deg: number): number => ((deg % 360) + 360) % 360;

/** Точка в distM метрах от origin по азимуту bearing (градусы от севера по часовой) */
export const destination = (origin: LngLat, distM: number, bearing: number): LngLat => {
  const f = localFrame(origin);
  const b = bearing * DEG;
  return f.toLngLat([distM * Math.sin(b), distM * Math.cos(b)]);
};

/**
 * Поворот трассы со знаком: + вправо (по часовой), − влево; 0 — прямо.
 * Модуль — угол отвода (как turnAngleDeg).
 */
export const signedTurnDeg = (inBearing: number, outBearing: number): number => normalizeDeg180(outBearing - inBearing);

/** Углы в изломах ломаной: поворот со знаком и внутренний угол α = 180° − |поворот| */
export interface VertexAngle {
  index: number;
  coord: LngLat;
  turnDeg: number;
  innerDeg: number;
  inBearing: number;
  outBearing: number;
}

export const vertexAngles = (coords: readonly LngLat[]): VertexAngle[] => {
  const out: VertexAngle[] = [];
  for (let i = 1; i < coords.length - 1; i++) {
    if (distanceM(coords[i - 1], coords[i]) === 0 || distanceM(coords[i], coords[i + 1]) === 0) continue;
    const inBearing = bearingDeg(coords[i - 1], coords[i]);
    const outBearing = bearingDeg(coords[i], coords[i + 1]);
    const turn = signedTurnDeg(inBearing, outBearing);
    out.push({ index: i, coord: coords[i], turnDeg: turn, innerDeg: 180 - Math.abs(turn), inBearing, outBearing });
  }
  return out;
};

/** «90°», «22,5°» — без лишних нулей */
export const formatDeg = (deg: number): string => {
  const r = Math.round(deg * 10) / 10;
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1).replace('.', ',')}°`;
};

/** «поворот 90° вправо» / «прямо» */
export const formatTurn = (turnDeg: number): string => {
  const a = Math.abs(turnDeg);
  if (a < 0.05) return 'прямо';
  return `поворот ${formatDeg(a)} ${turnDeg > 0 ? 'вправо' : 'влево'}`;
};

/** Дуга угла поворота в вершине: от продолжения входящего направления к исходящему */
export const turnArc = (vertex: LngLat, inBearing: number, turnDeg: number, radiusM: number, steps = 12): LngLat[] => {
  const pts: LngLat[] = [];
  for (let k = 0; k <= steps; k++) pts.push(destination(vertex, radiusM, inBearing + (turnDeg * k) / steps));
  return pts;
};

/** «12,34 м» / «1,23 км» — как в остальном интерфейсе (запятая) */
export const formatMeters = (m: number): string =>
  m >= 1000 ? `${(m / 1000).toFixed(2).replace('.', ',')} км` : `${m.toFixed(2).replace('.', ',')} м`;
