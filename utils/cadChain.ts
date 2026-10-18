/**
 * Трасса участков, которую рисует оператор (CAD): точки, правила завершения, запрос к серверу
 * (POST topology/chains) и GeoJSON предпросмотра. Без карты и сети — чистые функции.
 *
 * Клик по узлу — точка «узел», по трубе — «врезка», в пустоту — излом (а первая точка —
 * новый узел). Клик по узлу или трубе завершает трассу (с Shift — трасса продолжается через
 * эту точку); Enter или двойной клик — завершить в последней точке (излом становится новым узлом).
 */
import type { SnapResult } from '~/utils/cadSnap';
import { distanceM, polylineLengthM } from '~/utils/cadGeometry';
import type { LngLat } from '~/utils/lineVertices';

export type TracePointKind = 'node' | 'tap' | 'new' | 'vertex';

export interface TracePoint {
  kind: TracePointKind;
  coord: LngLat;
  nodeId?: number;
  lineId?: number;
}

/** Режим трубы: общая (1), подача и обратка раздельно (2 + 3), только подача / обратка */
export type PipeMode = 'common' | 'pair' | 'supply' | 'return';

export const PIPE_MODE_ITEMS: { value: PipeMode; title: string; hint: string }[] = [
  { value: 'common', title: 'Двухтрубная, общая', hint: 'Одна запись на подачу и обратку (признак «общий»)' },
  { value: 'pair', title: 'П и О раздельно', hint: 'Две трубы с общей трассой — когда у подачи и обратки разные параметры' },
  { value: 'supply', title: 'Только подача', hint: 'Признак «подающий»; переход в обратную сеть — автоматически' },
  { value: 'return', title: 'Только обратка', hint: 'Признак «обратный»; переход в подающую сеть — автоматически' },
];

export const isBoundary = (p: TracePoint) => p.kind !== 'vertex';

/** Точка по клику: привязка (если есть) или координата курсора */
export const pointFromClick = (snap: SnapResult | null, cursor: LngLat, isFirst: boolean): TracePoint => {
  if (snap?.kind === 'node' && snap.nodeId != null) return { kind: 'node', coord: snap.coord, nodeId: snap.nodeId };
  if (snap && snap.lineId != null) return { kind: 'tap', coord: snap.coord, lineId: snap.lineId };
  return { kind: isFirst ? 'new' : 'vertex', coord: cursor };
};

/** Клик завершает трассу: узел или врезка после хотя бы одной точки (без Shift) */
export const finishesTrace = (point: TracePoint, before: readonly TracePoint[], keepGoing: boolean): boolean =>
  !keepGoing && before.length > 0 && (point.kind === 'node' || point.kind === 'tap');

/** Повтор той же точки (двойной клик ставит две одинаковые) — не добавлять */
export const samePoint = (a: TracePoint | undefined, b: TracePoint): boolean => {
  if (!a) return false;
  if (a.kind === 'node' || b.kind === 'node') return a.kind === b.kind && a.nodeId === b.nodeId;
  return distanceM(a.coord, b.coord) < 0.01;
};

/** Завершение: последний излом становится новым узлом */
export const finalizePoints = (points: readonly TracePoint[]): TracePoint[] => {
  const out = points.map((p) => ({ ...p }));
  const last = out[out.length - 1];
  if (last && last.kind === 'vertex') last.kind = 'new';
  return out;
};

/** Что делать с завершённой трассой */
export type TraceOutcome =
  | { action: 'none' }
  | { action: 'node'; coord: LngLat }
  | { action: 'split'; lineId: number; coord: LngLat }
  | { action: 'chain'; points: TracePoint[] };

export const traceOutcome = (points: readonly TracePoint[]): TraceOutcome => {
  const pts = finalizePoints(points);
  if (pts.length === 0) return { action: 'none' };
  if (pts.length === 1) {
    const p = pts[0];
    if (p.kind === 'new') return { action: 'node', coord: p.coord };
    if (p.kind === 'tap' && p.lineId != null) return { action: 'split', lineId: p.lineId, coord: p.coord };
    return { action: 'none' };
  }
  return { action: 'chain', points: pts };
};

/** Точки для POST topology/chains */
export const chainRequestPoints = (points: readonly TracePoint[]) =>
  points.map((p) => {
    if (p.kind === 'node') return { kind: 'node' as const, node_id: p.nodeId };
    if (p.kind === 'tap') return { kind: 'tap' as const, line_id: p.lineId, lng: p.coord[0], lat: p.coord[1] };
    return { kind: p.kind, lng: p.coord[0], lat: p.coord[1] };
  });

/** Длина всей трассы и текущего участка (от последней границы) с учётом курсора, м */
export const traceLengths = (points: readonly TracePoint[], cursor: LngLat | null) => {
  const coords = points.map((p) => p.coord);
  if (cursor && coords.length) coords.push(cursor);
  let start = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (isBoundary(points[i])) {
      start = i;
      break;
    }
  }
  return {
    totalM: polylineLengthM(coords),
    segmentM: polylineLengthM(coords.slice(start)),
    lastM: coords.length >= 2 ? distanceM(coords[coords.length - 2], coords[coords.length - 1]) : 0,
  };
};

/** GeoJSON предпросмотра: проложенная трасса, «резинка» к курсору, точки, привязка */
export const traceCollection = (points: readonly TracePoint[], cursor: LngLat | null, snap: SnapResult | null) => {
  const features: any[] = [];
  if (points.length >= 2) {
    features.push({
      type: 'Feature',
      properties: { role: 'trace' },
      geometry: { type: 'LineString', coordinates: points.map((p) => p.coord) },
    });
  }
  if (cursor && points.length) {
    features.push({
      type: 'Feature',
      properties: { role: 'rubber' },
      geometry: { type: 'LineString', coordinates: [points[points.length - 1].coord, cursor] },
    });
  }
  points.forEach((p, i) => {
    features.push({
      type: 'Feature',
      properties: { role: 'point', kind: p.kind, index: i },
      geometry: { type: 'Point', coordinates: p.coord },
    });
  });
  if (snap) {
    features.push({
      type: 'Feature',
      properties: { role: 'snap', kind: snap.kind },
      geometry: { type: 'Point', coordinates: snap.coord },
    });
  }
  return { type: 'FeatureCollection', features };
};
