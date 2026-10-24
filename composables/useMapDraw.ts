/**
 * Измерения на карте (линейка и площадь) поверх MapLibre.
 *
 * Реализовано на нативных источниках/слоях MapLibre, без mapbox-gl-draw:
 * та библиотека рассчитана на mapbox-gl и работает с MapLibre только через
 * прослойку, которая ломается при обновлениях.
 *
 * Пока идёт измерение, клик по карте не выбирает объекты сети (mapStore и другие обработчики
 * смотрят isMapMeasureActive()). Управление: клик — точка (с привязкой к узлу сети), двойной клик /
 * Enter / правая кнопка — завершить, Backspace — убрать последнюю точку, Esc — отменить текущее
 * измерение (второй Esc — выйти из режима). Вершины готовых измерений можно перетаскивать.
 */
import { computed, ref, shallowRef } from 'vue';
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { isStyleMutable, waitForStyleMutable } from '~/services/mapService';
import { registerHotkeys } from '~/composables/useHotkeys';
import { sampleElevation } from '~/utils/terrainSample';
import { formatDeg, formatTurn, signedTurnDeg, vertexAngles } from '~/utils/cadGeometry';

export type DrawMode = 'none' | 'measure-distance' | 'measure-area';

/** Текущий режим измерения — чтобы клики по карте не выбирали объекты и не правили сеть */
export const activeDrawMode = ref<DrawMode>('none');

/** Идёт измерение: обработчики кликов карты (выбор объекта, трассировка, редактор) пропускают клик */
export const isMapMeasureActive = (): boolean => activeDrawMode.value !== 'none';

export interface ProfilePoint {
  /** Расстояние от начала, м */
  d: number;
  /** Высота земли, м (null — нет данных) */
  h: number | null;
}

export interface ElevationProfile {
  status: 'loading' | 'ready' | 'error';
  points: ProfilePoint[];
}

export interface Measurement {
  id: string;
  kind: 'distance' | 'area';
  coordinates: number[][];
  /** Длина линии либо периметр, м */
  length: number;
  /** Площадь, м² */
  area?: number;
  /** Профиль высот вдоль линии (только расстояние) */
  profile?: ElevationProfile;
}

const SOURCE_ID = 'measure-source';
const SOURCE_DRAFT_ID = 'measure-draft-source';
const LAYER_FILL = 'measure-fill';
const LAYER_LINE = 'measure-line';
const LAYER_VERTEX = 'measure-vertex';
/** Радиус попадания в вершину измерения для курсора «переместить», px (точечный хит-тест mousedown) */
const VERTEX_HIT_PX = 8;
const LAYER_SEGMENT_LABEL = 'measure-segment-label';
const LAYER_TOTAL_LABEL = 'measure-total-label';
const LAYER_DRAFT_FILL = 'measure-draft-fill';
const LAYER_DRAFT_LINE = 'measure-draft-line';
const LAYER_DRAFT_VERTEX = 'measure-draft-vertex';
const LAYER_SNAP = 'measure-snap';
const LAYER_CURSOR_LABEL = 'measure-cursor-label';
const LAYER_ANGLE_LABEL = 'measure-angle-label';
const LAYER_DRAFT_ANGLE_LABEL = 'measure-draft-angle-label';
const ALL_LAYERS = [
  LAYER_CURSOR_LABEL, LAYER_DRAFT_ANGLE_LABEL, LAYER_ANGLE_LABEL, LAYER_SNAP, LAYER_DRAFT_VERTEX, LAYER_DRAFT_LINE, LAYER_DRAFT_FILL,
  LAYER_TOTAL_LABEL, LAYER_SEGMENT_LABEL, LAYER_VERTEX, LAYER_LINE, LAYER_FILL,
];

const COLOR = '#0d6efd';
const DRAFT_COLOR = '#ff6f00';

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

/** Азимут отрезка от севера по часовой стрелке, градусы 0..360 */
export function bearing(a: number[], b: number[]): number {
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLon = toRad(b[0] - a[0]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const decimal = (v: number, digits: number) => v.toFixed(digits).replace('.', ',');

export function formatLength(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  return meters >= 1000 ? `${decimal(meters / 1000, 2)} км` : `${decimal(meters, 1)} м`;
}

export function formatArea(sqMeters: number): string {
  if (!Number.isFinite(sqMeters)) return '—';
  if (sqMeters >= 1_000_000) return `${decimal(sqMeters / 1_000_000, 3)} км²`;
  if (sqMeters >= 10_000) return `${decimal(sqMeters / 10_000, 2)} га`;
  return `${decimal(sqMeters, 1)} м²`;
}

export function formatBearing(deg: number): string {
  return `${Math.round(deg) % 360}°`;
}

/** Точки вдоль линии с шагом по длине: [{ d, lng, lat }] — для профиля высот */
export function pointsAlong(coords: number[][], count: number): Array<{ d: number; lng: number; lat: number }> {
  const total = lineLength(coords);
  if (coords.length < 2 || total === 0) return coords.slice(0, 1).map((c) => ({ d: 0, lng: c[0], lat: c[1] }));
  const out: Array<{ d: number; lng: number; lat: number }> = [];
  const n = Math.max(2, count);
  let seg = 0;
  let segStart = 0;
  for (let k = 0; k < n; k += 1) {
    const d = (total * k) / (n - 1);
    while (seg < coords.length - 2 && segStart + haversine(coords[seg], coords[seg + 1]) < d) {
      segStart += haversine(coords[seg], coords[seg + 1]);
      seg += 1;
    }
    const segLen = haversine(coords[seg], coords[seg + 1]) || 1;
    const t = Math.min(1, Math.max(0, (d - segStart) / segLen));
    const [x0, y0] = coords[seg];
    const [x1, y1] = coords[seg + 1];
    out.push({ d, lng: x0 + (x1 - x0) * t, lat: y0 + (y1 - y0) * t });
  }
  return out;
}

export interface ProfileStats {
  start: number;
  end: number;
  min: number;
  max: number;
  /** Суммарный подъём / спуск по профилю, м */
  gain: number;
  loss: number;
  /** Средний уклон начало → конец, ‰ */
  slopePermille: number;
}

export function profileStats(points: ProfilePoint[]): ProfileStats | null {
  const valid = points.filter((p): p is { d: number; h: number } => p.h != null && Number.isFinite(p.h));
  if (valid.length < 2) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < valid.length; i += 1) {
    const dh = valid[i].h - valid[i - 1].h;
    if (dh > 0) gain += dh;
    else loss -= dh;
  }
  const first = valid[0];
  const last = valid[valid.length - 1];
  const dist = last.d - first.d;
  return {
    start: first.h,
    end: last.h,
    min: Math.min(...valid.map((p) => p.h)),
    max: Math.max(...valid.map((p) => p.h)),
    gain,
    loss,
    slopePermille: dist > 0 ? ((last.h - first.h) / dist) * 1000 : 0,
  };
}

const closeRing = (coords: number[][]) => {
  if (coords.length < 3) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? coords : [...coords, first];
};

const midpoint = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Подписи длин отрезков (на середине каждого) */
function segmentLabels(coords: number[][], closed: boolean, extra: Record<string, unknown> = {}) {
  const pts = closed ? closeRing(coords) : coords;
  const out: any[] = [];
  for (let i = 1; i < pts.length; i += 1) {
    const len = haversine(pts[i - 1], pts[i]);
    if (len <= 0) continue;
    out.push({
      type: 'Feature',
      properties: { segmentLabel: formatLength(len), ...extra },
      geometry: { type: 'Point', coordinates: midpoint(pts[i - 1], pts[i]) },
    });
  }
  return out;
}

/** Углы поворота в изломах линейки (транспортир): «∠ 35°» у вершины */
export function angleLabels(coords: number[][], extra: Record<string, unknown> = {}) {
  return vertexAngles(coords as [number, number][])
    .filter((v) => Math.abs(v.turnDeg) >= 0.5)
    .map((v) => ({
      type: 'Feature',
      properties: { angleLabel: `∠ ${formatDeg(Math.abs(v.turnDeg))}`, ...extra },
      geometry: { type: 'Point', coordinates: v.coord },
    }));
}

export function measurementLabel(m: Pick<Measurement, 'kind' | 'length' | 'area'>): string {
  return m.kind === 'area' ? `${formatArea(m.area || 0)} · периметр ${formatLength(m.length)}` : formatLength(m.length);
}

/** Слои сети (узлы) — к ним привязываются точки измерения; не к подписям подложки */
const isNetworkLayer = (id: string) => id.startsWith('mvt__');

const PROFILE_SAMPLES = 120;

export function useMapDraw() {
  const mode = ref<DrawMode>('none');
  const measurements = ref<Measurement[]>([]);
  const draftPoints = ref<number[][]>([]);
  const mapRef = shallowRef<MapLibreMap | null>(null);
  const snapEnabled = ref<boolean>(true);
  const snapRadiusPx = ref<number>(12);
  /** Курсор (для текущего отрезка и подсказки) */
  const hoverPoint = shallowRef<number[] | null>(null);
  const hoverSnapped = ref(false);
  let dragging: { id: string; index: number } | null = null;
  let suppressNextClick = false;

  /** Курсор над вершиной готового измерения (рука «переместить»); обновляется из того же запроса, что и привязка */
  let overVertex = false;
  const setVertexCursor = (over: boolean) => {
    const map = mapRef.value;
    if (!map || over === overVertex) return;
    overVertex = over;
    if (dragging) return;
    map.getCanvas().style.cursor = over ? 'move' : mode.value === 'none' ? '' : 'crosshair';
  };

  /**
   * Один queryRenderedFeatures на кадр: узлы сети для привязки и вершины измерений для курсора.
   * Раньше вершины ловились делегированными mouseenter/mouseleave по слою — MapLibre опрашивал
   * слой на каждом mousemove ещё дважды (замер S6: 3 запроса на движение, docs/performance-baseline.md).
   */
  let queryErrorLogged = false;
  const logQueryError = (e: unknown) => {
    if (!import.meta.dev || queryErrorLogged) return;
    queryErrorLogged = true;
    console.warn('[useMapDraw] queryRenderedFeatures бросил — кадр пропущен:', e);
  };
  /** Слои сети для привязки — список из стиля кешируется до следующего styledata (getStyle() сериализует весь стиль) */
  let networkLayerIds: string[] | null = null;
  const invalidateNetworkLayers = () => { networkLayerIds = null; };
  const getNetworkLayerIds = (map: MapLibreMap): string[] => {
    if (!networkLayerIds) networkLayerIds = (map.getStyle()?.layers || []).map((l) => l.id).filter(isNetworkLayer);
    return networkLayerIds;
  };
  const queryAround = (
    screenPoint: { x: number; y: number },
    withSnap = snapEnabled.value,
  ): { snapped: number[] | null; vertex: boolean } => {
    const map = mapRef.value;
    const none = { snapped: null, vertex: false };
    if (!map) return none;
    const r = snapRadiusPx.value;
    try {
      const layers = withSnap ? [...getNetworkLayerIds(map)] : [];
      if (measurements.value.length && map.getLayer(LAYER_VERTEX)) layers.push(LAYER_VERTEX);
      if (!layers.length) return none;
      const rendered = map.queryRenderedFeatures(
        [[screenPoint.x - r, screenPoint.y - r], [screenPoint.x + r, screenPoint.y + r]],
        { layers },
      );
      let best: number[] | null = null;
      let bestDist = Infinity;
      let vertex = false;
      for (const f of rendered) {
        if (f.geometry?.type !== 'Point') continue;
        if (f.layer?.id === LAYER_VERTEX) {
          // курсор «переместить» — только там, где mousedown реально попадёт в вершину (точечный хит-тест ≈ половина значка)
          const vp = map.project(f.geometry.coordinates as [number, number]);
          if (Math.hypot(vp.x - screenPoint.x, vp.y - screenPoint.y) <= VERTEX_HIT_PX) vertex = true;
          continue;
        }
        const c = f.geometry.coordinates as number[];
        const p = map.project(c as [number, number]);
        const dist = Math.hypot(p.x - screenPoint.x, p.y - screenPoint.y);
        if (dist < bestDist) {
          best = c;
          bestDist = dist;
        }
      }
      return { snapped: best, vertex };
    } catch (e) {
      // Стиль в середине диффа (смена подложки, HMR) — getStyle/queryRenderedFeatures на таком кадре бросают;
      // без привязки один кадр безвреден, но постоянную ошибку надо видеть хотя бы в dev
      logQueryError(e);
      return none;
    }
  };

  /** Точка привязки (если привязка включена); курсор над вершиной обновляется в любом случае */
  const findSnapPoint = (screenPoint: { x: number; y: number }): number[] | null => {
    const { snapped, vertex } = queryAround(screenPoint);
    setVertexCursor(vertex);
    return snapEnabled.value ? snapped : null;
  };

  const isMeasuring = computed(() => mode.value !== 'none');
  const isArea = computed(() => mode.value === 'measure-area');

  /** Точки текущего измерения вместе с курсором */
  const livePoints = computed(() =>
    hoverPoint.value && draftPoints.value.length > 0 ? [...draftPoints.value, hoverPoint.value] : draftPoints.value
  );
  const draftLength = computed(() => lineLength(isArea.value ? closeRing(livePoints.value) : livePoints.value));
  const draftArea = computed(() => (livePoints.value.length >= 3 ? polygonArea(livePoints.value) : 0));
  /** Текущий отрезок (последняя точка → курсор): длина и азимут */
  const currentSegment = computed(() => {
    const pts = draftPoints.value;
    const h = hoverPoint.value;
    if (!pts.length || !h) return null;
    const last = pts[pts.length - 1];
    const prev = pts.length >= 2 ? pts[pts.length - 2] : null;
    const b = bearing(last, h);
    // поворот от предыдущего отрезка (транспортир); для первого отрезка — нет
    const turn = prev && haversine(prev, last) > 0 && haversine(last, h) > 0 ? signedTurnDeg(bearing(prev, last), b) : null;
    return { length: haversine(last, h), bearing: b, turn };
  });

  const featureCollection = () => {
    const features: any[] = [];
    for (const m of measurements.value) {
      const closed = m.kind === 'area';
      features.push({
        type: 'Feature',
        properties: { measureId: m.id, kind: m.kind },
        geometry: closed
          ? { type: 'Polygon', coordinates: [closeRing(m.coordinates)] }
          : { type: 'LineString', coordinates: m.coordinates },
      });
      m.coordinates.forEach((c, index) => features.push({
        type: 'Feature',
        properties: { vertex: true, measureId: m.id, index },
        geometry: { type: 'Point', coordinates: c },
      }));
      if (m.coordinates.length > 2 || closed) features.push(...segmentLabels(m.coordinates, closed, { measureId: m.id }));
      if (!closed) features.push(...angleLabels(m.coordinates, { measureId: m.id }));
      const anchor = closed ? centroid(m.coordinates) : m.coordinates[m.coordinates.length - 1];
      features.push({
        type: 'Feature',
        properties: { totalLabel: measurementLabel(m), measureId: m.id },
        geometry: { type: 'Point', coordinates: anchor },
      });
    }
    return { type: 'FeatureCollection' as const, features };
  };

  const centroid = (coords: number[][]) => {
    const n = coords.length || 1;
    return [coords.reduce((s, c) => s + c[0], 0) / n, coords.reduce((s, c) => s + c[1], 0) / n];
  };

  const draftCollection = () => {
    const pts = livePoints.value;
    const features: any[] = draftPoints.value.map((p, i) => ({
      type: 'Feature',
      properties: { vertex: true, index: i + 1 },
      geometry: { type: 'Point', coordinates: p },
    }));
    if (pts.length >= 3 && isArea.value) {
      features.push({
        type: 'Feature',
        properties: { draftFill: true },
        geometry: { type: 'Polygon', coordinates: [closeRing(pts)] },
      });
    }
    if (pts.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { draft: true },
        geometry: { type: 'LineString', coordinates: isArea.value ? closeRing(pts) : pts },
      });
      features.push(...segmentLabels(pts, isArea.value && pts.length >= 3));
      if (!isArea.value) features.push(...angleLabels(pts));
    }
    const h = hoverPoint.value;
    if (h && isMeasuring.value) {
      if (hoverSnapped.value) {
        features.push({ type: 'Feature', properties: { snap: true }, geometry: { type: 'Point', coordinates: h } });
      }
      const seg = currentSegment.value;
      const lines = seg
        ? [
          isArea.value && draftArea.value > 0 ? formatArea(draftArea.value) : `Всего ${formatLength(draftLength.value)}`,
          `${formatLength(seg.length)} · азимут ${formatBearing(seg.bearing)}`,
          ...(seg.turn != null ? [formatTurn(seg.turn)] : []),
        ]
        : [hoverSnapped.value ? 'Узел сети — кликните, чтобы начать' : 'Кликните, чтобы начать'];
      features.push({
        type: 'Feature',
        properties: { cursorLabel: lines.join('\n') },
        geometry: { type: 'Point', coordinates: h },
      });
    }
    return { type: 'FeatureCollection' as const, features };
  };

  const refresh = () => {
    const map = mapRef.value;
    if (!map || !map.getSource(SOURCE_ID)) return;
    (map.getSource(SOURCE_ID) as any).setData(featureCollection());
    (map.getSource(SOURCE_DRAFT_ID) as any)?.setData(draftCollection());
  };

  /** Только черновик (курсор, текущий отрезок): готовые измерения при движении мыши не меняются */
  const refreshDraft = () => {
    const map = mapRef.value;
    if (!map) return;
    (map.getSource(SOURCE_DRAFT_ID) as any)?.setData(draftCollection());
  };

  const ensureLayers = (map: MapLibreMap) => {
    if (map.getSource(SOURCE_ID)) return;
    // isStyleLoaded() иногда возвращает true, пока стиль ещё диффится (HMR,
    // смена подложки) — addSource в этот момент бросает. Ловим и повторяем
    // на следующем idle, чтобы не терять инициализацию слоёв.
    if (!isStyleMutable(map)) {
      void waitForStyleMutable(map).then(() => { if (mapRef.value === map) ensureLayers(map); }, () => {});
      return;
    }

    try {
      addMeasureLayers(map);
    } catch {
      map.once('idle', () => { if (mapRef.value === map) ensureLayers(map); });
    }
  };

  const labelLayout = (field: string, size: number): any => ({
    'text-field': ['get', field],
    'text-size': size,
    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
    'text-allow-overlap': true,
    'text-ignore-placement': true,
  });
  const labelPaint = (color: string): any => ({
    'text-color': color,
    'text-halo-color': '#ffffff',
    'text-halo-width': 2,
  });

  const addMeasureLayers = (map: MapLibreMap) => {
    map.addSource(SOURCE_ID, { type: 'geojson', data: featureCollection() });
    map.addSource(SOURCE_DRAFT_ID, { type: 'geojson', data: draftCollection() });

    map.addLayer({
      id: LAYER_FILL,
      type: 'fill',
      source: SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'area'],
      paint: { 'fill-color': COLOR, 'fill-opacity': 0.15 },
    });
    map.addLayer({
      id: LAYER_LINE,
      type: 'line',
      source: SOURCE_ID,
      filter: ['has', 'kind'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': COLOR, 'line-width': 3 },
    });
    map.addLayer({
      id: LAYER_VERTEX,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'vertex'], true],
      paint: {
        'circle-radius': 5,
        'circle-color': '#ffffff',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': COLOR,
      },
    });
    map.addLayer({
      id: LAYER_SEGMENT_LABEL,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'segmentLabel'],
      minzoom: 13,
      layout: labelLayout('segmentLabel', 11),
      paint: labelPaint('#1d3f73'),
    });
    map.addLayer({
      id: LAYER_TOTAL_LABEL,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'totalLabel'],
      layout: { ...labelLayout('totalLabel', 13), 'text-anchor': 'left', 'text-offset': [0.8, 0] },
      paint: labelPaint(COLOR),
    });
    map.addLayer({
      id: LAYER_DRAFT_FILL,
      type: 'fill',
      source: SOURCE_DRAFT_ID,
      filter: ['==', ['get', 'draftFill'], true],
      paint: { 'fill-color': DRAFT_COLOR, 'fill-opacity': 0.12 },
    });
    map.addLayer({
      id: LAYER_DRAFT_LINE,
      type: 'line',
      source: SOURCE_DRAFT_ID,
      filter: ['==', ['get', 'draft'], true],
      paint: { 'line-color': DRAFT_COLOR, 'line-width': 2.5, 'line-dasharray': [2, 1.5] },
    });
    map.addLayer({
      id: LAYER_DRAFT_VERTEX,
      type: 'circle',
      source: SOURCE_DRAFT_ID,
      filter: ['==', ['get', 'vertex'], true],
      paint: {
        'circle-radius': 4.5,
        'circle-color': DRAFT_COLOR,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });
    map.addLayer({
      id: LAYER_SNAP,
      type: 'circle',
      source: SOURCE_DRAFT_ID,
      filter: ['==', ['get', 'snap'], true],
      paint: {
        'circle-radius': 10,
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#00a86b',
      },
    });
    map.addLayer({
      id: LAYER_CURSOR_LABEL,
      type: 'symbol',
      source: SOURCE_DRAFT_ID,
      filter: ['has', 'cursorLabel'],
      layout: {
        ...labelLayout('cursorLabel', 12),
        'text-anchor': 'top-left',
        'text-offset': [1.2, 1.2],
        'text-justify': 'left',
      },
      paint: { ...labelPaint('#202124'), 'text-halo-width': 2.5 },
    });
    // углы поворота в изломах (транспортир) — сбоку от вершины
    const angleLayout = { ...labelLayout('angleLabel', 11), 'text-anchor': 'bottom-left', 'text-offset': [0.6, -0.4] };
    map.addLayer({
      id: LAYER_ANGLE_LABEL,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'angleLabel'],
      minzoom: 13,
      layout: angleLayout,
      paint: labelPaint('#5d4037'),
    });
    map.addLayer({
      id: LAYER_DRAFT_ANGLE_LABEL,
      type: 'symbol',
      source: SOURCE_DRAFT_ID,
      filter: ['has', 'angleLabel'],
      layout: angleLayout,
      paint: labelPaint('#5d4037'),
    });
  };

  const pointFromEvent = (e: MapMouseEvent): number[] => {
    const snapped = findSnapPoint(e.point);
    hoverSnapped.value = Boolean(snapped);
    return snapped || [e.lngLat.lng, e.lngLat.lat];
  };

  const onMapClick = (e: MapMouseEvent) => {
    if (mode.value === 'none') return;
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    const point = pointFromEvent(e);
    const pts = draftPoints.value;
    // Двойной клик даёт два click подряд в той же точке — повтор не добавляем
    const last = pts[pts.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) return;
    draftPoints.value = [...pts, point];
    refresh();
  };

  /**
   * mousemove приходит чаще кадра; привязка (queryRenderedFeatures) и setData — один раз на кадр
   * по последнему событию. Без этого ведение линии шло на 2,5 fps: по два setData и три
   * queryRenderedFeatures на каждое движение (замер S6, docs/performance-baseline.md).
   */
  let pendingMove: MapMouseEvent | null = null;
  let moveFrame = 0;
  const flushMove = () => {
    moveFrame = 0;
    const e = pendingMove;
    pendingMove = null;
    if (!e) return;
    if (dragging) {
      moveVertex(e);
      return;
    }
    if (mode.value === 'none') {
      if (measurements.value.length) setVertexCursor(queryAround(e.point, false).vertex);
      return;
    }
    hoverPoint.value = pointFromEvent(e);
    refreshDraft();
  };
  const cancelPendingMove = () => {
    pendingMove = null;
    if (moveFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(moveFrame);
    moveFrame = 0;
  };
  const onMapMove = (e: MapMouseEvent) => {
    if (!dragging && mode.value === 'none' && !measurements.value.length) return;
    pendingMove = e;
    if (moveFrame) return;
    if (typeof requestAnimationFrame !== 'function') {
      flushMove();
      return;
    }
    moveFrame = requestAnimationFrame(flushMove);
  };

  const onMapOut = () => {
    cancelPendingMove();
    setVertexCursor(false);
    hoverPoint.value = null;
    hoverSnapped.value = false;
    refreshDraft();
  };

  /** Профиль высот вдоль линии (модель рельефа MapTiler) */
  const loadProfile = async (id: string) => {
    const m = measurements.value.find((x) => x.id === id);
    if (!m || m.kind !== 'distance') return;
    const coords = m.coordinates.map((c) => [...c]);
    m.profile = { status: 'loading', points: [] };
    measurements.value = [...measurements.value];
    try {
      const samples = pointsAlong(coords, PROFILE_SAMPLES);
      const heights = await Promise.all(samples.map((s) => sampleElevation(s.lng, s.lat)));
      const current = measurements.value.find((x) => x.id === id);
      // Вершины могли перетащить, пока грузились тайлы — тогда профиль уже пересчитывается
      if (!current || JSON.stringify(current.coordinates) !== JSON.stringify(coords)) return;
      current.profile = {
        status: heights.some((h) => h != null) ? 'ready' : 'error',
        points: samples.map((s, i) => ({ d: s.d, h: heights[i] })),
      };
    } catch {
      const current = measurements.value.find((x) => x.id === id);
      if (current) current.profile = { status: 'error', points: [] };
    }
    measurements.value = [...measurements.value];
  };

  /** Завершить текущее измерение (двойной клик / Enter / правая кнопка / «Готово») */
  const finishShape = () => {
    const pts = draftPoints.value;
    const area = isArea.value;
    hoverPoint.value = null;
    draftPoints.value = [];
    if (pts.length < (area ? 3 : 2)) {
      refresh();
      return;
    }
    const m: Measurement = {
      id: `m${Date.now()}`,
      kind: area ? 'area' : 'distance',
      coordinates: pts,
      length: lineLength(area ? closeRing(pts) : pts),
      area: area ? polygonArea(pts) : undefined,
    };
    measurements.value = [...measurements.value, m];
    refresh();
    if (m.kind === 'distance') void loadProfile(m.id);
  };

  const undoPoint = () => {
    if (draftPoints.value.length > 0) {
      draftPoints.value = draftPoints.value.slice(0, -1);
    } else if (measurements.value.length > 0) {
      measurements.value = measurements.value.slice(0, -1);
    }
    refresh();
  };

  /** Esc: отменить текущее измерение; если его нет — выйти из режима */
  const cancel = () => {
    if (draftPoints.value.length) {
      draftPoints.value = [];
      refresh();
    } else {
      setMode('none');
    }
  };

  const removeMeasurement = (id: string) => {
    measurements.value = measurements.value.filter((m) => m.id !== id);
    if (!measurements.value.length) setVertexCursor(false);
    refresh();
  };

  const clearAll = () => {
    draftPoints.value = [];
    measurements.value = [];
    hoverPoint.value = null;
    setVertexCursor(false);
    refresh();
  };

  /** Показать измерение целиком */
  const zoomTo = (id: string) => {
    const map = mapRef.value;
    const m = measurements.value.find((x) => x.id === id);
    if (!map || !m) return;
    const xs = m.coordinates.map((c) => c[0]);
    const ys = m.coordinates.map((c) => c[1]);
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 80, maxZoom: 18 });
  };

  // --- перетаскивание вершин готовых измерений ---
  const onVertexDown = (e: MapMouseEvent) => {
    const map = mapRef.value;
    if (!map || !measurements.value.length || !map.getLayer(LAYER_VERTEX)) return;
    let f: any;
    try {
      f = map.queryRenderedFeatures(e.point, { layers: [LAYER_VERTEX] })[0];
    } catch (err) {
      // как в queryAround: захват вершины на кадре диффа стиля теряется, карта просто панорамируется
      logQueryError(err);
      return;
    }
    const id = f?.properties?.measureId;
    const index = Number(f?.properties?.index);
    if (!id || !Number.isInteger(index)) return;
    e.preventDefault();
    dragging = { id: String(id), index };
    map.dragPan.disable();
  };

  const moveVertex = (e: MapMouseEvent) => {
    if (!dragging) return;
    const point = pointFromEvent(e);
    const m = measurements.value.find((x) => x.id === dragging!.id);
    if (!m) return;
    m.coordinates = m.coordinates.map((c, i) => (i === dragging!.index ? point : c));
    m.length = lineLength(m.kind === 'area' ? closeRing(m.coordinates) : m.coordinates);
    if (m.kind === 'area') m.area = polygonArea(m.coordinates);
    hoverPoint.value = null;
    refresh();
  };

  const onVertexUp = () => {
    if (!dragging) return;
    // mousemove и mouseup в одном кадре: доносим последнее положение, пока dragging ещё активен
    if (pendingMove) {
      if (moveFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(moveFrame);
      moveFrame = 0;
      flushMove();
    }
    const { id } = dragging;
    dragging = null;
    suppressNextClick = true;
    setTimeout(() => { suppressNextClick = false; }, 0);
    mapRef.value?.dragPan.enable();
    measurements.value = [...measurements.value];
    void loadProfile(id);
  };

  const onContextMenu = (e: MapMouseEvent) => {
    if (mode.value === 'none') return;
    e.preventDefault();
    finishShape();
  };

  /** Клавиши измерения — область `measure` реестра хоткеев (utils/hotkeys.ts), активна только в режиме */
  const onKeyDown = (e: KeyboardEvent): boolean => {
    if (e.key === 'Escape') {
      cancel();
    } else if (e.key === 'Enter') {
      finishShape();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      if (!draftPoints.value.length) return false;
      undoPoint();
    } else {
      return false;
    }
    return true;
  };
  let disposeHotkeys: (() => void) | null = null;

  // Двойной клик завершает измерение — во время измерения он не должен зумить карту (QA F25)
  const syncDoubleClickZoom = (map: MapLibreMap, drawMode: DrawMode) => {
    const handler = (map as any).doubleClickZoom;
    if (!handler) return;
    if (drawMode === 'none') handler.enable();
    else handler.disable();
  };

  const setMode = (next: DrawMode) => {
    // Смена режима завершает незакрытое измерение, чтобы точки не «перетекали»
    if (draftPoints.value.length >= 2) finishShape();
    draftPoints.value = [];
    hoverPoint.value = null;
    hoverSnapped.value = false;
    mode.value = next;
    activeDrawMode.value = next;
    overVertex = false;
    const map = mapRef.value;
    if (map) {
      map.getCanvas().style.cursor = next === 'none' ? '' : 'crosshair';
      syncDoubleClickZoom(map, next);
    }
    refresh();
  };

  const attach = (map: MapLibreMap | null) => {
    if (!map) return;
    mapRef.value = map;
    // Панель могли открыть до готовности стиля — addSource тогда бросает
    // «Style is not done loading»; ждём событие load.
    if (!isStyleMutable(map)) {
      void waitForStyleMutable(map).then(() => {
        if (mapRef.value === map) ensureLayers(map);
      }, () => {});
    } else {
      ensureLayers(map);
    }
    map.on('click', onMapClick);
    map.on('mousemove', onMapMove);
    map.on('mouseout', onMapOut);
    map.on('mouseup', onVertexUp);
    map.on('dblclick', finishShape);
    map.on('contextmenu', onContextMenu);
    map.on('mousedown', onVertexDown);
    map.on('styledata', invalidateNetworkLayers);
    disposeHotkeys?.();
    disposeHotkeys = registerHotkeys({ id: 'map-measure', area: 'measure', enabled: () => mode.value !== 'none', handle: onKeyDown });
    syncDoubleClickZoom(map, mode.value);
  };

  const detach = () => {
    cancelPendingMove();
    overVertex = false;
    activeDrawMode.value = 'none';
    mode.value = 'none';
    disposeHotkeys?.();
    disposeHotkeys = null;
    const map = mapRef.value;
    if (!map) return;
    map.off('click', onMapClick);
    map.off('mousemove', onMapMove);
    map.off('mouseout', onMapOut);
    map.off('mouseup', onVertexUp);
    map.off('dblclick', finishShape);
    map.off('contextmenu', onContextMenu);
    map.off('mousedown', onVertexDown);
    map.off('styledata', invalidateNetworkLayers);
    networkLayerIds = null;
    if (dragging) map.dragPan?.enable();
    dragging = null;
    syncDoubleClickZoom(map, 'none');
    map.getCanvas().style.cursor = '';
    for (const id of ALL_LAYERS) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of [SOURCE_DRAFT_ID, SOURCE_ID]) {
      if (map.getSource(id)) map.removeSource(id);
    }
    mapRef.value = null;
  };

  /** Выгрузка измерений в GeoJSON (длина, площадь — в свойствах) */
  const exportGeoJson = () => JSON.stringify({
    type: 'FeatureCollection',
    features: measurements.value.map((m) => ({
      type: 'Feature',
      properties: { kind: m.kind, length_m: Math.round(m.length * 10) / 10, area_m2: m.area != null ? Math.round(m.area) : undefined },
      geometry: m.kind === 'area'
        ? { type: 'Polygon', coordinates: [closeRing(m.coordinates)] }
        : { type: 'LineString', coordinates: m.coordinates },
    })),
  }, null, 2);

  return {
    mode,
    measurements,
    draftPoints,
    isMeasuring,
    isArea,
    draftLength,
    draftArea,
    currentSegment,
    hoverSnapped,
    setMode,
    finishShape,
    undoPoint,
    cancel,
    removeMeasurement,
    clearAll,
    zoomTo,
    attach,
    detach,
    exportGeoJson,
    snapEnabled,
    snapRadiusPx,
  };
}
