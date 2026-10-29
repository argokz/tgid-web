/**
 * Трассировки сети (фаза 1 модернизации): подписи типов, цвета на карте, разбор списков id
 * и охват результата для fitBounds. Расчёт — в API (database/network_trace.py).
 */
import type { NetworkFeedPoint, NetworkStopKind, NetworkTraceType } from '~/services/api/types';

export interface TraceTypeMeta {
  value: NetworkTraceType;
  label: string;
  /** Цвет линий результата на карте */
  color: string;
  hint: string;
}

export const TRACE_TYPES: readonly TraceTypeMeta[] = [
  {
    value: 'upstream',
    label: 'К источнику',
    color: '#2962ff',
    hint: 'Участки на путях от питающих точек до выбранного объекта; в кольце — все обходы',
  },
  {
    value: 'downstream',
    label: 'Ниже по потоку',
    color: '#ff6d00',
    hint: 'Что останется без связи с питанием, если вывести выбранный объект',
  },
  {
    value: 'connected',
    label: 'Связанные',
    color: '#00897b',
    hint: 'Всё, что связано с объектом по проводящим участкам; можно остановить на задвижках',
  },
  {
    value: 'subnetwork',
    label: 'Зона',
    color: '#8e24aa',
    hint: 'Зона сети (компонента связности) и её питающие точки',
  },
];

export const traceTypeMeta = (type: NetworkTraceType): TraceTypeMeta =>
  TRACE_TYPES.find((t) => t.value === type) ?? TRACE_TYPES[0];

/** Барьеры по условию (API network_trace.STOP_KINDS): где останавливается обход */
export const STOP_KINDS: readonly { value: NetworkStopKind; label: string }[] = [
  { value: 'valves', label: 'Задвижки' },
  { value: 'pumpstations', label: 'Насосные' },
  { value: 'setpress', label: 'Узлы заданного напора' },
  { value: 'sources', label: 'Источники' },
];

/** Барьеры по условию действуют у «связанных» и «зоны» (API STOP_TRACE_TYPES) */
export const supportsStops = (type: NetworkTraceType): boolean => type === 'connected' || type === 'subnetwork';

/** «Задвижки, насосные» — для подписи настройки и результата */
export const stopKindsText = (kinds: readonly NetworkStopKind[] | undefined): string =>
  STOP_KINDS.filter((k) => kinds?.includes(k.value)).map((k) => k.label.toLowerCase()).join(', ');

export const FEED_POINT_LABELS: Record<NetworkFeedPoint['kind'], string> = {
  heat_source: 'Источник',
  set_pressure: 'Заданный напор',
};

/** Предел API на число id в одном списке (routers/analysis.py TraceRequest) */
export const MAX_TRACE_IDS = 500;

/**
 * «12, 15 18;20» → [12, 15, 18, 20]. Повторы убираются, порядок сохраняется.
 * Нецелые и неположительные значения — ошибка с понятным текстом, а не молчаливый пропуск.
 */
export function parseIdList(text: string | null | undefined): { ids: number[]; error: string | null } {
  const parts = (text ?? '').split(/[\s,;]+/).filter(Boolean);
  const ids: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part) || Number(part) < 1) {
      return { ids: [], error: `«${part}» — не номер объекта` };
    }
    const id = Number(part);
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length > MAX_TRACE_IDS) {
    return { ids: [], error: `Не больше ${MAX_TRACE_IDS} объектов в списке` };
  }
  return { ids, error: null };
}

type Position = number[];

const eachPosition = (geometry: GeoJSON.Geometry | null, visit: (p: Position) => void): void => {
  if (!geometry) return;
  switch (geometry.type) {
    case 'Point':
      visit(geometry.coordinates);
      break;
    case 'LineString':
    case 'MultiPoint':
      geometry.coordinates.forEach(visit);
      break;
    case 'MultiLineString':
    case 'Polygon':
      geometry.coordinates.forEach((ring) => ring.forEach(visit));
      break;
    case 'MultiPolygon':
      geometry.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach(visit)));
      break;
    case 'GeometryCollection':
      geometry.geometries.forEach((g) => eachPosition(g, visit));
      break;
  }
};

/** Охват [xmin, ymin, xmax, ymax] нескольких коллекций; null — пусто */
export function featureBounds(
  ...collections: Array<GeoJSON.FeatureCollection | null | undefined>
): [number, number, number, number] | null {
  let xmin = Infinity;
  let ymin = Infinity;
  let xmax = -Infinity;
  let ymax = -Infinity;
  for (const fc of collections) {
    for (const feature of fc?.features ?? []) {
      eachPosition(feature.geometry, ([x, y]) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        xmin = Math.min(xmin, x);
        ymin = Math.min(ymin, y);
        xmax = Math.max(xmax, x);
        ymax = Math.max(ymax, y);
      });
    }
  }
  return Number.isFinite(xmin) ? [xmin, ymin, xmax, ymax] : null;
}
