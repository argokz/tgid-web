/**
 * Рисование и измерения на карте поверх MapLibre.
 *
 * Реализовано на нативных источниках/слоях MapLibre, без mapbox-gl-draw:
 * та библиотека рассчитана на mapbox-gl и работает с MapLibre только через
 * прослойку, которая ломается при обновлениях. Здесь — полный контроль над
 * поведением и никаких дополнительных зависимостей.
 */
import { computed, ref, shallowRef } from 'vue';
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';

export type DrawMode = 'none' | 'point' | 'line' | 'polygon' | 'measure-distance' | 'measure-area';

/** Текущий режим панели рисования — чтобы редактор сети не принимал её клики за свои */
export const activeDrawMode = ref<DrawMode>('none');

export interface DrawFeature {
  id: string;
  type: 'point' | 'line' | 'polygon';
  coordinates: number[][];
  /** Длина в метрах (линия) либо периметр (полигон) */
  length?: number;
  /** Площадь в м² (полигон) */
  area?: number;
  label?: string;
}

const SOURCE_ID = 'draw-source';
const SOURCE_DRAFT_ID = 'draw-draft-source';
const LAYER_FILL = 'draw-fill';
const LAYER_LINE = 'draw-line';
const LAYER_POINT = 'draw-point';
const LAYER_VERTEX = 'draw-vertex';
const LAYER_DRAFT_LINE = 'draw-draft-line';
const LAYER_LABEL = 'draw-label';

const EARTH_RADIUS = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Расстояние по большой окружности, метры */
export function haversine(a: number[], b: number[]): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineLength(coords: number[][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) total += haversine(coords[i - 1], coords[i]);
  return total;
}

/** Площадь сферического многоугольника, м² (формула Гаусса на сфере) */
export function polygonArea(coords: number[][]): number {
  if (coords.length < 3) return 0;
  const ring = [...coords];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);

  let total = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    total += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS * EARTH_RADIUS) / 2);
}

export function formatLength(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} км` : `${meters.toFixed(1)} м`;
}

export function formatArea(sqMeters: number): string {
  if (!Number.isFinite(sqMeters)) return '—';
  if (sqMeters >= 1_000_000) return `${(sqMeters / 1_000_000).toFixed(3)} км²`;
  if (sqMeters >= 10_000) return `${(sqMeters / 10_000).toFixed(2)} га`;
  return `${sqMeters.toFixed(1)} м²`;
}

export function useMapDraw() {
  const mode = ref<DrawMode>('none');
  const features = ref<DrawFeature[]>([]);
  const draftPoints = ref<number[][]>([]);
  const mapRef = shallowRef<MapLibreMap | null>(null);
  const snapEnabled = ref<boolean>(true);
  const snapRadiusPx = ref<number>(15);
  let hoverPoint: number[] | null = null;

  const findSnapPoint = (screenPoint: { x: number; y: number }): number[] | null => {
    const map = mapRef.value;
    if (!map || !snapEnabled.value) return null;
    const r = snapRadiusPx.value;
    try {
      const rendered = map.queryRenderedFeatures([
        [screenPoint.x - r, screenPoint.y - r],
        [screenPoint.x + r, screenPoint.y + r],
      ]);
      for (const f of rendered) {
        if (f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates)) {
          return f.geometry.coordinates as number[];
        }
      }
    } catch {
      // MapLibre may throw if query outside viewport
    }
    return null;
  };

  const isDrawing = computed(() => mode.value !== 'none');
  const isMeasuring = computed(
    () => mode.value === 'measure-distance' || mode.value === 'measure-area'
  );
  const draftLength = computed(() => lineLength(draftPoints.value));
  const draftArea = computed(() =>
    draftPoints.value.length >= 3 ? polygonArea(draftPoints.value) : 0
  );

  const featureCollection = () => ({
    type: 'FeatureCollection' as const,
    features: features.value.map((f) => ({
      type: 'Feature' as const,
      id: f.id,
      properties: {
        kind: f.type,
        label: f.label || '',
      },
      geometry:
        f.type === 'point'
          ? { type: 'Point' as const, coordinates: f.coordinates[0] }
          : f.type === 'line'
            ? { type: 'LineString' as const, coordinates: f.coordinates }
            : { type: 'Polygon' as const, coordinates: [closeRing(f.coordinates)] },
    })),
  });

  const closeRing = (coords: number[][]) => {
    if (coords.length < 3) return coords;
    const first = coords[0];
    const last = coords[coords.length - 1];
    return first[0] === last[0] && first[1] === last[1] ? coords : [...coords, first];
  };

  const draftCollection = () => {
    const pts = [...draftPoints.value];
    if (hoverPoint && pts.length > 0) pts.push(hoverPoint);
    const geoFeatures: any[] = pts.map((p, i) => ({
      type: 'Feature',
      properties: { vertex: true, index: i + 1 },
      geometry: { type: 'Point', coordinates: p },
    }));
    if (pts.length >= 2) {
      const coords = mode.value === 'polygon' || mode.value === 'measure-area'
        ? closeRing(pts)
        : pts;
      geoFeatures.push({
        type: 'Feature',
        properties: { draft: true },
        geometry: { type: 'LineString', coordinates: coords },
      });
    }
    return { type: 'FeatureCollection' as const, features: geoFeatures };
  };

  const refresh = () => {
    const map = mapRef.value;
    if (!map || !map.getSource(SOURCE_ID)) return;
    (map.getSource(SOURCE_ID) as any).setData(featureCollection());
    (map.getSource(SOURCE_DRAFT_ID) as any)?.setData(draftCollection());
  };

  const ensureLayers = (map: MapLibreMap) => {
    if (map.getSource(SOURCE_ID)) return;
    // isStyleLoaded() иногда возвращает true, пока стиль ещё диффится (HMR,
    // смена подложки) — addSource в этот момент бросает. Ловим и повторяем
    // на следующем idle, чтобы не терять инициализацию слоёв рисования.
    if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
      map.once('idle', () => { if (mapRef.value === map) ensureLayers(map); });
      return;
    }

    try {
      addDrawLayers(map);
    } catch {
      map.once('idle', () => { if (mapRef.value === map) ensureLayers(map); });
    }
  };

  const addDrawLayers = (map: MapLibreMap) => {
    map.addSource(SOURCE_ID, { type: 'geojson', data: featureCollection() });
    map.addSource(SOURCE_DRAFT_ID, { type: 'geojson', data: draftCollection() });

    map.addLayer({
      id: LAYER_FILL,
      type: 'fill',
      source: SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'polygon'],
      paint: { 'fill-color': '#1976d2', 'fill-opacity': 0.18 },
    });
    map.addLayer({
      id: LAYER_LINE,
      type: 'line',
      source: SOURCE_ID,
      filter: ['in', ['get', 'kind'], ['literal', ['line', 'polygon']]],
      paint: { 'line-color': '#1976d2', 'line-width': 3 },
    });
    map.addLayer({
      id: LAYER_POINT,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'point'],
      paint: {
        'circle-radius': 6,
        'circle-color': '#1976d2',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });
    map.addLayer({
      id: LAYER_LABEL,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['!=', ['get', 'label'], ''],
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 12,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
      },
      paint: { 'text-color': '#0d47a1', 'text-halo-color': '#fff', 'text-halo-width': 2 },
    });
    map.addLayer({
      id: LAYER_DRAFT_LINE,
      type: 'line',
      source: SOURCE_DRAFT_ID,
      filter: ['==', ['get', 'draft'], true],
      paint: { 'line-color': '#ff6f00', 'line-width': 2, 'line-dasharray': [2, 1.5] },
    });
    map.addLayer({
      id: LAYER_VERTEX,
      type: 'circle',
      source: SOURCE_DRAFT_ID,
      filter: ['==', ['get', 'vertex'], true],
      paint: {
        'circle-radius': 5,
        'circle-color': '#ff6f00',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });
  };

  const onMapClick = (e: MapMouseEvent) => {
    if (mode.value === 'none') return;
    const snapped = findSnapPoint(e.point);
    const point = snapped || [e.lngLat.lng, e.lngLat.lat];

    if (mode.value === 'point') {
      features.value = [
        ...features.value,
        { id: `f${Date.now()}`, type: 'point', coordinates: [point] },
      ];
      refresh();
      return;
    }

    draftPoints.value = [...draftPoints.value, point];
    refresh();
  };

  const onMapMove = (e: MapMouseEvent) => {
    if (mode.value === 'none' || mode.value === 'point' || draftPoints.value.length === 0) return;
    const snapped = findSnapPoint(e.point);
    hoverPoint = snapped || [e.lngLat.lng, e.lngLat.lat];
    refresh();
  };

  /** Завершить текущую фигуру (двойной клик / кнопка «Готово») */
  const finishShape = () => {
    const pts = draftPoints.value;
    hoverPoint = null;
    if (pts.length < 2) {
      draftPoints.value = [];
      refresh();
      return;
    }

    const isArea = mode.value === 'polygon' || mode.value === 'measure-area';
    const type: DrawFeature['type'] = isArea ? 'polygon' : 'line';
    const length = lineLength(isArea ? closeRing(pts) : pts);
    const area = isArea ? polygonArea(pts) : undefined;

    let label = '';
    if (mode.value === 'measure-distance') label = formatLength(length);
    else if (mode.value === 'measure-area') label = `${formatArea(area || 0)} · ${formatLength(length)}`;

    features.value = [
      ...features.value,
      { id: `f${Date.now()}`, type, coordinates: pts, length, area, label },
    ];
    draftPoints.value = [];
    refresh();
  };

  const undoPoint = () => {
    if (draftPoints.value.length > 0) {
      draftPoints.value = draftPoints.value.slice(0, -1);
    } else if (features.value.length > 0) {
      features.value = features.value.slice(0, -1);
    }
    refresh();
  };

  const clearAll = () => {
    draftPoints.value = [];
    features.value = [];
    hoverPoint = null;
    refresh();
  };

  const setMode = (next: DrawMode) => {
    // Смена режима завершает незакрытую фигуру, чтобы точки не «перетекали»
    if (draftPoints.value.length >= 2) finishShape();
    draftPoints.value = [];
    hoverPoint = null;
    mode.value = next;
    activeDrawMode.value = next;
    const map = mapRef.value;
    if (map) map.getCanvas().style.cursor = next === 'none' ? '' : 'crosshair';
    refresh();
  };

  const attach = (map: MapLibreMap | null) => {
    if (!map) return;
    mapRef.value = map;
    // Панель могли открыть до готовности стиля — addSource тогда бросает
    // «Style is not done loading»; ждём событие load.
    if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
      map.once('load', () => {
        if (mapRef.value === map) ensureLayers(map);
      });
    } else {
      ensureLayers(map);
    }
    map.on('click', onMapClick);
    map.on('mousemove', onMapMove);
    map.on('dblclick', finishShape);
  };

  const detach = () => {
    activeDrawMode.value = 'none';
    const map = mapRef.value;
    if (!map) return;
    map.off('click', onMapClick);
    map.off('mousemove', onMapMove);
    map.off('dblclick', finishShape);
    map.getCanvas().style.cursor = '';
    for (const id of [LAYER_LABEL, LAYER_VERTEX, LAYER_DRAFT_LINE, LAYER_POINT, LAYER_LINE, LAYER_FILL]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of [SOURCE_DRAFT_ID, SOURCE_ID]) {
      if (map.getSource(id)) map.removeSource(id);
    }
    mapRef.value = null;
  };

  /** Выгрузка нарисованного в GeoJSON */
  const exportGeoJson = () => JSON.stringify(featureCollection(), null, 2);

  return {
    mode,
    features,
    draftPoints,
    isDrawing,
    isMeasuring,
    draftLength,
    draftArea,
    setMode,
    finishShape,
    undoPoint,
    clearAll,
    attach,
    detach,
    exportGeoJson,
    snapEnabled,
    snapRadiusPx,
  };
}
