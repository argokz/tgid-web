/**
 * Выбор объекта карты кликом с допуском: раньше брались только объекты точно под курсором
 * (участок толщиной 1–3 px приходилось «ловить»). Теперь — все объекты в квадрате ±radius,
 * отсортированные по расстоянию на экране; узел ловится по всему значку.
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

type Project = (lngLat: [number, number]) => ScreenPoint;

/** Допуск в пикселях: мышь — 8, палец (pointer: coarse) — 14 */
export const PICK_RADIUS_PX = 8;
export const PICK_RADIUS_TOUCH_PX = 14;
/** Значок узла: клик в пределах радиуса значка считается попаданием */
const POINT_HIT_PX = 6;
/** Половина толщины линии участка (две линии подачи/обратки разнесены на 1–3 px) */
const LINE_HIT_PX = 3;
/** Объекты не дальше ближайшего + TIE_PX считаются равноудалёнными — тогда меню выбора */
export const PICK_TIE_PX = 3;

export const pickRadius = (): number => {
  try {
    if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) {
      return PICK_RADIUS_TOUCH_PX;
    }
  } catch {
    // matchMedia недоступен — допуск мыши
  }
  return PICK_RADIUS_PX;
};

const segmentDistance = (p: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const lineDistance = (p: ScreenPoint, coords: any[], project: Project): number => {
  let best = Infinity;
  let prev: ScreenPoint | null = null;
  for (const c of coords) {
    const cur = project(c as [number, number]);
    best = Math.min(best, prev ? segmentDistance(p, prev, cur) : Math.hypot(p.x - cur.x, p.y - cur.y));
    prev = cur;
  }
  return best;
};

const insideRing = (p: ScreenPoint, ring: ScreenPoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

/**
 * Расстояние «до попадания» в пикселях: 0 — курсор на значке узла / на линии участка.
 * Полигон (здание, контур) под курсором получает radius — он ниже по приоритету, чем узел
 * или участок рядом: здания лежат под сетью, и клик у трубы не должен открывать здание.
 */
export const screenDistance = (geometry: any, point: ScreenPoint, project: Project, radius: number): number => {
  const type = geometry?.type;
  const coords = geometry?.coordinates;
  if (!type || !coords) return radius;
  try {
    switch (type) {
      case 'Point': {
        const s = project(coords);
        return Math.max(0, Math.hypot(point.x - s.x, point.y - s.y) - POINT_HIT_PX);
      }
      case 'MultiPoint':
        return Math.min(...coords.map((c: any) => screenDistance({ type: 'Point', coordinates: c }, point, project, radius)));
      case 'LineString':
        return Math.max(0, lineDistance(point, coords, project) - LINE_HIT_PX);
      case 'MultiLineString':
        return Math.max(0, Math.min(...coords.map((l: any[]) => lineDistance(point, l, project))) - LINE_HIT_PX);
      case 'Polygon':
      case 'MultiPolygon': {
        const polygons = type === 'Polygon' ? [coords] : coords;
        for (const poly of polygons) {
          if (poly?.[0] && insideRing(point, poly[0].map((c: any) => project(c)))) return radius;
        }
        const edge = Math.min(...polygons.flatMap((poly: any[]) => poly.map((r: any[]) => lineDistance(point, r, project))));
        return Math.max(radius, edge);
      }
      default:
        return radius;
    }
  } catch {
    return radius;
  }
};

const symbolKey = (f: any): string => `${f.layer?.id}|${f.id ?? ''}|${JSON.stringify(f.geometry?.coordinates ?? null)}`;

/**
 * Объекты в радиусе от точки, ближайшие первыми. Каждому feature добавляется `_pickDistance`.
 * Объекты дальше radius (попали в квадрат запроса углом) отбрасываются.
 */
export const queryRenderedNear = (
  map: any,
  point: ScreenPoint,
  options: { layers?: string[]; radius?: number } = {}
): any[] => {
  if (!map) return [];
  const radius = options.radius ?? pickRadius();
  const box: [[number, number], [number, number]] = [
    [point.x - radius, point.y - radius],
    [point.x + radius, point.y + radius],
  ];
  const query = (where: any) => (options.layers ? map.queryRenderedFeatures(where, { layers: options.layers }) : map.queryRenderedFeatures(where)) as any[];
  const features = query(box);
  // Подпись (symbol) под самим курсором — попадание в объект, даже если его точка дальше radius
  const labelHits = new Set(
    query([point.x, point.y]).filter((f) => f.layer?.type === 'symbol').map(symbolKey)
  );
  const project: Project = (lngLat) => map.project(lngLat);
  const scored = features
    .map((feature, order) => ({
      feature,
      order,
      d: feature.layer?.type === 'symbol' && labelHits.has(symbolKey(feature))
        ? 0
        : screenDistance(feature.geometry, point, project, radius),
    }))
    .filter((s) => s.d <= radius);
  // При равном расстоянии — порядок MapLibre (верхний слой первым)
  scored.sort((a, b) => a.d - b.d || a.order - b.order);
  return scored.map((s) => {
    s.feature._pickDistance = s.d;
    return s.feature;
  });
};

const isPoint = (f: any): boolean => f?.geometry?.type === 'Point' || f?.geometry?.type === 'MultiPoint';

/**
 * Ближайшие объекты: не дальше первого + tie (несколько — неоднозначно, нужен выбор).
 * Курсор на значке узла — только узлы: под значком сходятся концы участков, и клик
 * по узлу не должен открывать меню «узел + участки».
 */
export const nearestGroup = <T extends { _pickDistance?: number }>(features: readonly T[], tie = PICK_TIE_PX): T[] => {
  if (!features.length) return [];
  const onIcon = features.filter((f) => isPoint(f) && (f._pickDistance ?? 0) === 0);
  if (onIcon.length) return onIcon;
  const best = features[0]._pickDistance ?? 0;
  return features.filter((f) => (f._pickDistance ?? 0) <= best + tie);
};
