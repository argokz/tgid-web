/**
 * Редактор вершин участка (этап 8.5) для CAD-панели топологии.
 *
 * Участок загружается с сервера целиком (тайлы обрезаны и упрощены) вместе с версией;
 * вершины двигаются перетаскиванием, «+» на середине сегмента добавляет вершину,
 * правый клик по вершине удаляет её. Концы прибиты к узлам — не двигаются и не удаляются.
 * Привязка при перетаскивании — только к объектам сети (utils/networkSnap).
 * Сохранение — PUT геометрии с версией: 409 означает, что участок успели изменить.
 */
import { computed, ref, shallowRef } from 'vue';
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { fastApiService } from '~/services/fastApiService';
import {
  insertVertex,
  isEndpoint,
  moveVertex,
  removeVertex,
  sameLine,
  vertexEditCollection,
  type LngLat,
} from '~/utils/lineVertices';
import { pickNetworkSnap } from '~/utils/networkSnap';

const SOURCE_ID = 'topology-vertex-edit';
const LAYER_LINE = 'topology-vertex-line';
const LAYER_MID = 'topology-vertex-mid';
const LAYER_VERTEX = 'topology-vertex-point';
const SNAP_RADIUS_PX = 12;

export interface VertexEditorCallbacks {
  onSaved?: (result: { line_id: number; new_length: number; operation_id?: number | null }) => void;
  onError?: (err: unknown, reload: () => Promise<void>) => void;
}

export function useLineVertexEditor(getMap: () => MapLibreMap | null | undefined, callbacks: VertexEditorCallbacks = {}) {
  const lineId = ref<number | null>(null);
  const coords = shallowRef<LngLat[]>([]);
  const original = shallowRef<LngLat[]>([]);
  const version = ref<string | undefined>(undefined);
  const loading = ref(false);
  const saving = ref(false);
  const dirty = computed(() => !sameLine(coords.value, original.value));
  const active = computed(() => lineId.value !== null);
  let dragIndex: number | null = null;

  const render = () => {
    const map = getMap();
    if (!map) return;
    const data = vertexEditCollection(coords.value) as any;
    const src = map.getSource(SOURCE_ID) as any;
    if (src) {
      src.setData(data);
      return;
    }
    map.addSource(SOURCE_ID, { type: 'geojson', data });
    map.addLayer({
      id: LAYER_LINE,
      type: 'line',
      source: SOURCE_ID,
      filter: ['==', ['get', 'role'], 'line'],
      paint: { 'line-color': '#ff6d00', 'line-width': 3, 'line-dasharray': [2, 1] },
    });
    map.addLayer({
      id: LAYER_MID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'role'], 'mid'],
      paint: {
        'circle-radius': 4,
        'circle-color': '#ffffff',
        'circle-stroke-color': '#ff6d00',
        'circle-stroke-width': 2,
        'circle-opacity': 0.9,
      },
    });
    map.addLayer({
      id: LAYER_VERTEX,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'role'], 'vertex'],
      paint: {
        'circle-radius': 6,
        'circle-color': ['case', ['get', 'fixed'], '#757575', '#ff6d00'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
  };

  const clearLayers = () => {
    const map = getMap();
    if (!map) return;
    for (const id of [LAYER_VERTEX, LAYER_MID, LAYER_LINE]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  };

  const load = async (id: number) => {
    loading.value = true;
    try {
      const g = await fastApiService.getLineGeometry(id);
      lineId.value = id;
      coords.value = g.coordinates.map((c) => [c[0], c[1]] as LngLat);
      original.value = coords.value;
      version.value = g.version;
      render();
    } finally {
      loading.value = false;
    }
  };

  const stop = () => {
    lineId.value = null;
    coords.value = [];
    original.value = [];
    version.value = undefined;
    dragIndex = null;
    getMap()?.dragPan.enable();
    clearLayers();
  };

  const reset = () => {
    coords.value = original.value;
    render();
  };

  const hitVertex = (e: MapMouseEvent): { role: 'vertex' | 'mid'; index: number } | null => {
    const map = getMap();
    if (!map) return null;
    const layers = [LAYER_VERTEX, LAYER_MID].filter((l) => map.getLayer(l));
    if (!layers.length) return null;
    const pad = 6;
    const hits = map.queryRenderedFeatures(
      [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]],
      { layers },
    );
    // вершина приоритетнее «плюса» середины
    const v = hits.find((f: any) => f.properties?.role === 'vertex') || hits[0];
    if (!v) return null;
    return { role: (v.properties as any).role, index: Number((v.properties as any).index) };
  };

  const snapped = (e: MapMouseEvent): LngLat => {
    const map = getMap();
    if (!map) return [e.lngLat.lng, e.lngLat.lat];
    const r = SNAP_RADIUS_PX;
    const features = map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]]);
    const snap = pickNetworkSnap(
      features,
      e.point,
      (c) => map.project(c),
      r,
      { lines: lineId.value != null ? [lineId.value] : [] },
    );
    return snap ? snap.coord : [e.lngLat.lng, e.lngLat.lat];
  };

  /** true — событие обработано редактором (карта не должна делать своё) */
  const onMouseDown = (e: MapMouseEvent): boolean => {
    if (!active.value) return false;
    const hit = hitVertex(e);
    if (!hit) return false;
    if (hit.role === 'vertex' && isEndpoint(hit.index, coords.value.length)) return true;
    e.preventDefault();
    getMap()?.dragPan.disable();
    if (hit.role === 'mid') {
      coords.value = insertVertex(coords.value, hit.index, [e.lngLat.lng, e.lngLat.lat]);
      dragIndex = hit.index + 1;
    } else {
      dragIndex = hit.index;
    }
    render();
    return true;
  };

  const onMouseMove = (e: MapMouseEvent): boolean => {
    if (dragIndex === null) return false;
    coords.value = moveVertex(coords.value, dragIndex, snapped(e));
    render();
    return true;
  };

  const onMouseUp = (): boolean => {
    if (dragIndex === null) return false;
    dragIndex = null;
    getMap()?.dragPan.enable();
    return true;
  };

  const onContextMenu = (e: MapMouseEvent): boolean => {
    if (!active.value) return false;
    const hit = hitVertex(e);
    if (!hit || hit.role !== 'vertex') return false;
    e.preventDefault();
    coords.value = removeVertex(coords.value, hit.index);
    render();
    return true;
  };

  const save = async () => {
    if (lineId.value === null || !dirty.value) return;
    const id = lineId.value;
    saving.value = true;
    try {
      const res = await fastApiService.updateLineGeometry(id, coords.value, version.value);
      callbacks.onSaved?.(res as any);
      stop();
    } catch (err) {
      callbacks.onError?.(err, () => load(id));
    } finally {
      saving.value = false;
    }
  };

  return {
    lineId,
    coords,
    version,
    loading,
    saving,
    dirty,
    active,
    load,
    stop,
    reset,
    save,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onContextMenu,
  };
}
