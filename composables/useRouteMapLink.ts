import { getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue';
import { useSelectionHighlight } from '~/composables/useSelectionHighlight';
import { nearestPointIndex, type ScreenPoint } from '~/utils/routeFocus';

/** Узел маршрута графика: id и координаты (у узлов без геометрии — null) */
export interface RouteNode {
  node_id: number;
  lng?: number | null;
  lat?: number | null;
}

interface MapLike {
  project: (lngLat: [number, number]) => ScreenPoint;
  on: (type: string, handler: (event: any) => void) => void;
  off: (type: string, handler: (event: any) => void) => void;
}

/**
 * Связь графика маршрута с картой (этап 6, пьезометр): наведение на точку графика подсвечивает узел на карте,
 * курсор над узлом маршрута на карте — точку на графике (`mapFocusId`). Подсветка — свой оверлей
 * `useSelectionHighlight`; и подсветка, и поиск узла под курсором — не чаще кадра (rAF) и только при смене узла:
 * `setData` на каждый mousemove не вызывается.
 */
export function useRouteMapLink(
  getMap: () => any,
  getNodes: () => ReadonlyArray<RouteNode>,
  isActive: () => boolean,
) {
  const highlight = useSelectionHighlight(getMap, 'tgid-route-focus', 'hover');
  /** Узел маршрута под курсором на карте — график показывает его точку */
  const mapFocusId = ref<number | null>(null);

  let shownId: number | null = null;
  let pendingChartId: number | null | undefined;
  let chartFrame = 0;
  let cursor: ScreenPoint | null = null;
  let mapFrame = 0;
  let attachedMap: MapLike | null = null;

  const nodeById = (id: number) => getNodes().find((node) => node.node_id === id);

  const showNode = (id: number | null) => {
    if (id === shownId) return;
    shownId = id;
    const node = id == null ? null : nodeById(id);
    highlight.show(node && node.lng != null && node.lat != null
      ? { geometry: { type: 'Point', coordinates: [Number(node.lng), Number(node.lat)] } }
      : null);
  };

  /** Наведение на график: узел (или null — курсор ушёл с графика); подсветка в следующем кадре */
  const focusFromChart = (id: number | null) => {
    pendingChartId = id;
    if (chartFrame) return;
    chartFrame = requestAnimationFrame(() => {
      chartFrame = 0;
      if (pendingChartId === undefined) return;
      showNode(pendingChartId);
      pendingChartId = undefined;
    });
  };

  const findUnderCursor = () => {
    mapFrame = 0;
    const map = attachedMap;
    if (!map || !cursor) return;
    const nodes = getNodes();
    const points = nodes.map((node) => (node.lng != null && node.lat != null
      ? map.project([Number(node.lng), Number(node.lat)])
      : null));
    const index = nearestPointIndex(points, cursor);
    const id = index == null ? null : nodes[index].node_id;
    if (id !== mapFocusId.value) mapFocusId.value = id;
  };

  const onMouseMove = (event: { point?: ScreenPoint }) => {
    if (!event?.point) return;
    cursor = { x: event.point.x, y: event.point.y };
    if (!mapFrame) mapFrame = requestAnimationFrame(findUnderCursor);
  };
  const onMouseOut = () => {
    cursor = null;
    mapFocusId.value = null;
  };

  const attach = () => {
    const map = getMap() as MapLike | null;
    if (!map || attachedMap === map) return;
    detach();
    attachedMap = map;
    map.on('mousemove', onMouseMove);
    map.on('mouseout', onMouseOut);
  };
  const detach = () => {
    if (attachedMap) {
      attachedMap.off('mousemove', onMouseMove);
      attachedMap.off('mouseout', onMouseOut);
    }
    attachedMap = null;
    if (mapFrame) cancelAnimationFrame(mapFrame);
    if (chartFrame) cancelAnimationFrame(chartFrame);
    mapFrame = 0;
    chartFrame = 0;
    pendingChartId = undefined;
    cursor = null;
    mapFocusId.value = null;
    showNode(null);
  };

  watch(isActive, (active) => (active ? attach() : detach()), { immediate: true });
  if (getCurrentInstance()) onBeforeUnmount(detach);

  return { mapFocusId, focusFromChart, detach };
}
