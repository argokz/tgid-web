/**
 * Рисование трассы участков на карте (CAD): точки, привязка к сети, предпросмотр.
 *
 * Привязка — по индексу точной геометрии (useSnapIndex), радиус задаётся в пикселях и
 * переводится в метры на земле. Alt — временно без привязки. Слои предпросмотра — `cad-trace-*`
 * (их не видит выбор объектов сети: utils/networkSnap пропускает оверлеи `cad-`).
 */
import { computed, ref, shallowRef } from 'vue';
import type { Ref } from 'vue';
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { findSnap, type SnapIndex, type SnapResult } from '~/utils/cadSnap';
import { metersPerPixel } from '~/utils/cameraSync';
import type { LngLat } from '~/utils/lineVertices';
import {
  finishesTrace,
  pointFromClick,
  samePoint,
  traceCollection,
  traceLengths,
  type TracePoint,
} from '~/utils/cadChain';

const SOURCE_ID = 'cad-trace';
const LAYER_LINE = 'cad-trace-line';
const LAYER_RUBBER = 'cad-trace-rubber';
const LAYER_POINT = 'cad-trace-point';
const LAYER_SNAP = 'cad-trace-snap';
export const TRACE_SNAP_RADIUS_PX = 14;

const KIND_COLOR = [
  'match', ['get', 'kind'],
  'node', '#1565c0',
  'tap', '#c62828',
  'segment', '#c62828',
  'midpoint', '#6a1b9a',
  'vertex', '#ef6c00',
  'new', '#2e7d32',
  '#ef6c00',
];

export function useTraceDraw(
  getMap: () => MapLibreMap | null | undefined,
  snapIndex: Ref<SnapIndex | null>,
  getFragmentIds: () => readonly number[],
) {
  const points = shallowRef<TracePoint[]>([]);
  const cursor = shallowRef<LngLat | null>(null);
  const snap = shallowRef<SnapResult | null>(null);
  /** положение курсора на экране — для бейджа рядом с ним */
  const cursorPx = ref<{ x: number; y: number } | null>(null);
  const active = computed(() => points.value.length > 0);
  const lengths = computed(() => traceLengths(points.value, cursor.value));

  const render = () => {
    const map = getMap();
    if (!map) return;
    const data = traceCollection(points.value, cursor.value, snap.value) as any;
    const src = map.getSource(SOURCE_ID) as any;
    if (src) {
      src.setData(data);
      return;
    }
    map.addSource(SOURCE_ID, { type: 'geojson', data });
    map.addLayer({
      id: LAYER_RUBBER,
      type: 'line',
      source: SOURCE_ID,
      filter: ['==', ['get', 'role'], 'rubber'],
      paint: { 'line-color': '#ef6c00', 'line-width': 2, 'line-dasharray': [2, 2] },
    });
    map.addLayer({
      id: LAYER_LINE,
      type: 'line',
      source: SOURCE_ID,
      filter: ['==', ['get', 'role'], 'trace'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ef6c00', 'line-width': 3 },
    });
    map.addLayer({
      id: LAYER_POINT,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'role'], 'point'],
      paint: {
        'circle-radius': ['match', ['get', 'kind'], 'vertex', 4, 6],
        'circle-color': KIND_COLOR as any,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
    map.addLayer({
      id: LAYER_SNAP,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'role'], 'snap'],
      paint: {
        'circle-radius': 9,
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': KIND_COLOR as any,
        'circle-stroke-width': 3,
      },
    });
  };

  const clearLayers = () => {
    const map = getMap();
    if (!map) return;
    for (const id of [LAYER_SNAP, LAYER_POINT, LAYER_LINE, LAYER_RUBBER]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  };

  const snapAt = (e: MapMouseEvent): SnapResult | null => {
    const map = getMap();
    const idx = snapIndex.value;
    if (!map || !idx || (e.originalEvent as MouseEvent | undefined)?.altKey) return null;
    const radiusM = TRACE_SNAP_RADIUS_PX * metersPerPixel(map.getZoom(), e.lngLat.lat);
    return findSnap(idx, [e.lngLat.lng, e.lngLat.lat], radiusM, { fragmentIds: getFragmentIds() });
  };

  const onMove = (e: MapMouseEvent) => {
    const s = snapAt(e);
    snap.value = s;
    cursor.value = s ? s.coord : [e.lngLat.lng, e.lngLat.lat];
    cursorPx.value = { x: e.point.x, y: e.point.y };
    render();
  };

  /** Клик: добавить точку; true — трасса завершена этим кликом (узел/труба без Shift) */
  const onClick = (e: MapMouseEvent): boolean => {
    const s = snapAt(e);
    const point = pointFromClick(s, s ? s.coord : [e.lngLat.lng, e.lngLat.lat], points.value.length === 0);
    if (samePoint(points.value[points.value.length - 1], point)) return false;
    const before = points.value;
    points.value = [...before, point];
    snap.value = s;
    render();
    return finishesTrace(point, before, Boolean((e.originalEvent as MouseEvent | undefined)?.shiftKey));
  };

  const removeLast = () => {
    points.value = points.value.slice(0, -1);
    render();
  };

  const clear = () => {
    points.value = [];
    snap.value = null;
    cursor.value = null;
    cursorPx.value = null;
    clearLayers();
  };

  /** Привязка под курсором без рисования (до первой точки — показать, к чему прилипнет клик) */
  const hover = (e: MapMouseEvent) => {
    onMove(e);
  };

  return { points, cursor, cursorPx, snap, active, lengths, onMove, onClick, hover, removeLast, clear, render };
}
