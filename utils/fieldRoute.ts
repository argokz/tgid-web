/**
 * Обход маршрутом (полевое приложение, шаг 4): наряд на осмотр по контуру осмотра десктопа. Маршрут — участки
 * контура, точки обхода — их узлы по порядку (itwin-api database/work_order_route.py). Бригада отмечает узел
 * «осмотрен» или «с дефектом»; без связи отметки ждут в очереди, а карточка показывает их сразу.
 */
import type { FieldAction } from './fieldQueue';

export type RouteCheckState = 'ok' | 'defect';

export interface RoutePoint {
  node_id: number;
  name: string;
  node_type: string | null;
  lon: number;
  lat: number;
  state: RouteCheckState | null;
  note: string;
  defect_id: number | null;
  by_user: string | null;
  at: string | null;
  /** отметка ещё в очереди телефона */
  pending?: boolean;
}

export interface RouteProgress {
  total: number;
  ok: number;
  defect: number;
}

export interface WorkOrderRoute {
  order_id: number;
  inspection: { id: number; name: string };
  lines: GeoJSON.FeatureCollection;
  points: RoutePoint[];
  progress: RouteProgress;
  truncated: boolean;
}

export const CHECK_LABELS: Record<RouteCheckState, string> = { ok: 'осмотрен', defect: 'с дефектом' };
export const CHECK_COLORS: Record<RouteCheckState | 'none', string> = { ok: '#2E7D32', defect: '#C62828', none: '#78909C' };

export function routeProgress(points: Array<Pick<RoutePoint, 'state'>>): RouteProgress {
  return {
    total: points.length,
    ok: points.filter((p) => p.state === 'ok').length,
    defect: points.filter((p) => p.state === 'defect').length,
  };
}

/**
 * Маршрут с учётом очереди: отметки и дефекты узлов, ещё не отправленные, видны сразу. Как и на сервере,
 * побеждает последняя отметка узла (дефект узла — отметка «с дефектом»).
 */
export function applyPendingChecks(route: WorkOrderRoute, queue: FieldAction[]): WorkOrderRoute {
  const mine = queue.filter((a) => a.state === 'pending' && a.nodeId != null
    && ((a.kind === 'check' && a.orderId === route.order_id) || (a.kind === 'defect' && a.routeOrderId === route.order_id)));
  if (!mine.length) return route;
  const points = route.points.map((p) => {
    const last = mine.filter((a) => a.nodeId === p.node_id).at(-1);
    if (!last) return p;
    const state: RouteCheckState = last.kind === 'defect' ? 'defect' : (last.checkState ?? 'ok');
    return { ...p, state, pending: true };
  });
  return { ...route, points, progress: routeProgress(points) };
}

/** Следующий неотмеченный узел (к нему — «Маршрут») */
export function nextPoint(route: WorkOrderRoute): RoutePoint | null {
  return route.points.find((p) => !p.state) ?? null;
}

/** Итог обхода для «Что сделано» и для «Результатов осмотра» контура */
export function routeSummary(route: WorkOrderRoute): string {
  const { total, ok, defect } = route.progress;
  const done = ok + defect;
  const left = total - done;
  return `Обход «${route.inspection.name}»: осмотрено узлов ${done} из ${total}`
    + (defect ? `, с дефектами ${defect}` : ', дефектов нет')
    + (left ? `; не осмотрено ${left}` : '') + '.';
}

/** Точки обхода для карты: цвет — по отметке */
export function routePointFeatures(route: WorkOrderRoute): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: route.points.map((p) => ({
      type: 'Feature',
      id: p.node_id,
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { title: p.name, node_type: p.node_type, state: p.state ?? 'none', color: CHECK_COLORS[p.state ?? 'none'] },
    })),
  };
}
