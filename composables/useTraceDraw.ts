/**
 * Рисование трассы участков на карте (CAD): точки, привязка к сети, предпросмотр.
 *
 * Привязка — по индексу точной геометрии (useSnapIndex), радиус задаётся в пикселях и
 * переводится в метры на земле. Alt — временно без привязки. Слои предпросмотра — `cad-trace-*`
 * (их не видит выбор объектов сети: utils/networkSnap пропускает оверлеи `cad-`).
 *
 * Без привязки к объекту следующая точка подчиняется ограничениям (utils/cadConstraint):
 * полярная привязка с шагом polarStep от предыдущего участка, направляющие ∥ и ⊥ к соседней
 * трубе, Shift — строго по шагу 90°, и замки длины и угла, введённые с клавиатуры (utils/cadInput).
 * На трассе подписаны длины отрезков и углы поворота.
 */
import { computed, ref, shallowRef } from 'vue';
import type { Ref } from 'vue';
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { findSnap, nearestPipeBearing, pipeBearingsAt, type SnapIndex, type SnapResult } from '~/utils/cadSnap';
import { constrainPoint, type ConstraintResult, type GuideKind } from '~/utils/cadConstraint';
import { bearingDeg, distanceM, signedTurnDeg } from '~/utils/cadGeometry';
import { cadInputKey, cadInputLocks, EMPTY_CAD_INPUT, type CadInputKey, type CadInputState } from '~/utils/cadInput';
import { metersPerPixel } from '~/utils/cameraSync';
import type { LngLat } from '~/utils/lineVertices';
import {
  finishesTrace,
  pointFromClick,
  samePoint,
  traceCollection,
  traceLengths,
  type TraceGuide,
  type TracePoint,
} from '~/utils/cadChain';

const SOURCE_ID = 'cad-trace';
/**
 * Подписи — в отдельном источнике: шрифты грузятся с подложки (MapTiler), и если они недоступны,
 * MapLibre не отрисует ни одного слоя источника с текстом — трасса не должна пропасть вместе с ними.
 */
const LABEL_SOURCE_ID = 'cad-trace-labels';
const isLabel = (f: any) => f.properties?.role === 'label' || f.properties?.role === 'angle';
const LAYER_GUIDE = 'cad-trace-guide';
const LAYER_LINE = 'cad-trace-line';
const LAYER_RUBBER = 'cad-trace-rubber';
const LAYER_ARC = 'cad-trace-arc';
const LAYER_POINT = 'cad-trace-point';
const LAYER_SNAP = 'cad-trace-snap';
const LAYER_LABEL = 'cad-trace-label';
export const TRACE_SNAP_RADIUS_PX = 14;
/** радиус дуги угла поворота на экране */
const ARC_RADIUS_PX = 22;
/** направляющая «вдоль трубы» — от трубы в стольких радиусах привязки от курсора */
const NEAR_PIPE_RADII = 6;

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

const GUIDE_COLOR = [
  'match', ['get', 'kind'],
  'parallel', '#00897b',
  'perpendicular', '#00897b',
  '#7b1fa2',
];

export interface TraceDrawOptions {
  /** шаг полярной привязки, градусы; 0 — выкл (Shift всё равно даёт 90°) */
  polarStep?: Ref<number>;
}

/** Сведения для бейджа у курсора */
export interface TraceMetrics {
  /** поворот в последней точке к курсору (+ вправо), null — первый участок */
  turnDeg: number | null;
  guide: GuideKind | null;
  lockedLength: boolean;
  lockedAngle: boolean;
}

interface RawCursor {
  coord: LngLat;
  alt: boolean;
  shift: boolean;
}

export function useTraceDraw(
  getMap: () => MapLibreMap | null | undefined,
  snapIndex: Ref<SnapIndex | null>,
  getFragmentIds: () => readonly number[],
  options: TraceDrawOptions = {},
) {
  const points = shallowRef<TracePoint[]>([]);
  const cursor = shallowRef<LngLat | null>(null);
  const snap = shallowRef<SnapResult | null>(null);
  const constraint = shallowRef<ConstraintResult | null>(null);
  /** ввод длины / угла с клавиатуры */
  const input = ref<CadInputState>({ ...EMPTY_CAD_INPUT });
  /** положение курсора на экране — для бейджа рядом с ним */
  const cursorPx = ref<{ x: number; y: number } | null>(null);
  const active = computed(() => points.value.length > 0);
  const lengths = computed(() => traceLengths(points.value, cursor.value));
  let raw: RawCursor | null = null;
  let guide: TraceGuide | null = null;

  const metrics = computed<TraceMetrics>(() => {
    const c = constraint.value;
    if (c) return { turnDeg: c.turnDeg, guide: c.guide, lockedLength: c.lockedLength, lockedAngle: c.lockedAngle };
    const pts = points.value;
    const cur = cursor.value;
    let turnDeg: number | null = null;
    if (pts.length >= 2 && cur) {
      const prev = pts[pts.length - 2].coord;
      const last = pts[pts.length - 1].coord;
      if (distanceM(prev, last) > 0 && distanceM(last, cur) > 0) {
        turnDeg = signedTurnDeg(bearingDeg(prev, last), bearingDeg(last, cur));
      }
    }
    return { turnDeg, guide: null, lockedLength: false, lockedAngle: false };
  });

  const radiusM = (lat: number) => {
    const map = getMap();
    return map ? TRACE_SNAP_RADIUS_PX * metersPerPixel(map.getZoom(), lat) : 0;
  };

  const render = () => {
    const map = getMap();
    if (!map) return;
    const lat = cursor.value?.[1] ?? map.getCenter().lat;
    const arcRadiusM = ARC_RADIUS_PX * metersPerPixel(map.getZoom(), lat);
    const all = traceCollection(points.value, cursor.value, snap.value, { arcRadiusM, guide });
    const data = { type: 'FeatureCollection', features: all.features.filter((f) => !isLabel(f)) } as any;
    const labels = { type: 'FeatureCollection', features: all.features.filter(isLabel) } as any;
    const src = map.getSource(SOURCE_ID) as any;
    if (src) {
      src.setData(data);
      (map.getSource(LABEL_SOURCE_ID) as any)?.setData(labels);
      return;
    }
    map.addSource(SOURCE_ID, { type: 'geojson', data });
    map.addSource(LABEL_SOURCE_ID, { type: 'geojson', data: labels });
    map.addLayer({
      id: LAYER_GUIDE,
      type: 'line',
      source: SOURCE_ID,
      filter: ['==', ['get', 'role'], 'guide'],
      paint: { 'line-color': GUIDE_COLOR as any, 'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.85 },
    });
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
      id: LAYER_ARC,
      type: 'line',
      source: SOURCE_ID,
      filter: ['==', ['get', 'role'], 'arc'],
      paint: { 'line-color': '#5d4037', 'line-width': 1.5 },
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
    map.addLayer({
      id: LAYER_LABEL,
      type: 'symbol',
      source: LABEL_SOURCE_ID,
      layout: {
        'text-field': ['get', 'text'],
        'text-size': ['match', ['get', 'role'], 'angle', 12, 11],
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': ['match', ['get', 'role'], 'angle', '#5d4037', '#bf360c'],
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      },
    });
  };

  const clearLayers = () => {
    const map = getMap();
    if (!map) return;
    for (const id of [LAYER_LABEL, LAYER_SNAP, LAYER_POINT, LAYER_ARC, LAYER_LINE, LAYER_RUBBER, LAYER_GUIDE]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of [SOURCE_ID, LABEL_SOURCE_ID]) {
      if (map.getSource(id)) map.removeSource(id);
    }
  };

  const snapAt = (coord: LngLat): SnapResult | null => {
    const idx = snapIndex.value;
    if (!idx) return null;
    return findSnap(idx, coord, radiusM(coord[1]), { fragmentIds: getFragmentIds() });
  };

  // направления труб у последней точки — пересчёт только при смене трассы
  let guidesFor: TracePoint | null = null;
  let guidesAtLast: number[] = [];
  const guideBearings = (last: TracePoint, at: LngLat): number[] => {
    const idx = snapIndex.value;
    if (!idx) return [];
    if (guidesFor !== last) {
      guidesFor = last;
      guidesAtLast = last.kind === 'node' || last.kind === 'tap' ? pipeBearingsAt(idx, last) : [];
    }
    const near = nearestPipeBearing(idx, at, NEAR_PIPE_RADII * radiusM(at[1]), getFragmentIds());
    return near == null ? guidesAtLast : [...guidesAtLast, near];
  };

  /** Точка под курсором: привязка к объекту или ограничения (замки, полярная, направляющие) */
  const compute = () => {
    guide = null;
    constraint.value = null;
    if (!raw) {
      snap.value = null;
      cursor.value = null;
      return;
    }
    const locks = cadInputLocks(input.value);
    const locked = locks.lengthM != null || locks.angleDeg != null;
    const s = raw.alt || locked ? null : snapAt(raw.coord);
    snap.value = s;
    const pts = points.value;
    if (s || !pts.length) {
      cursor.value = s ? s.coord : raw.coord;
      return;
    }
    const last = pts[pts.length - 1];
    const prev = pts.length >= 2 ? pts[pts.length - 2].coord : null;
    const tolerance = radiusM(raw.coord[1]);
    const c = constrainPoint({
      last: last.coord,
      prev: prev && distanceM(prev, last.coord) > 0 ? prev : null,
      cursor: raw.coord,
      lengthM: locks.lengthM,
      angleDeg: locks.angleDeg,
      polarStepDeg: raw.alt ? null : options.polarStep?.value || null,
      ortho: !raw.alt && raw.shift,
      guideBearings: raw.alt ? [] : guideBearings(last, raw.coord),
      toleranceM: tolerance,
    });
    constraint.value = c;
    cursor.value = c.coord;
    if (c.guide || c.lockedAngle) {
      guide = {
        from: last.coord,
        bearing: c.bearing,
        lengthM: Math.max(c.lengthM, 0) + tolerance * 4,
        kind: c.guide ?? 'polar',
      };
    }
  };

  const rawFrom = (e: MapMouseEvent): RawCursor => {
    const oe = e.originalEvent as MouseEvent | undefined;
    return { coord: [e.lngLat.lng, e.lngLat.lat], alt: Boolean(oe?.altKey), shift: Boolean(oe?.shiftKey) };
  };

  const onMove = (e: MapMouseEvent) => {
    raw = rawFrom(e);
    cursorPx.value = { x: e.point.x, y: e.point.y };
    compute();
    render();
  };

  const resetInput = () => {
    input.value = { ...EMPTY_CAD_INPUT };
  };

  const addPoint = (point: TracePoint): boolean => {
    if (samePoint(points.value[points.value.length - 1], point)) return false;
    points.value = [...points.value, point];
    resetInput();
    compute();
    render();
    return true;
  };

  /** Клик: добавить точку; true — трасса завершена этим кликом (узел/труба без Shift) */
  const onClick = (e: MapMouseEvent): boolean => {
    raw = rawFrom(e);
    compute();
    const s = snap.value;
    const point = pointFromClick(s, cursor.value ?? raw.coord, points.value.length === 0);
    const before = points.value;
    if (!addPoint(point)) return false;
    return finishesTrace(point, before, raw.shift);
  };

  /**
   * Клавиша ввода длины/угла (цифры, Tab, Enter со значением, Backspace/Delete/Esc в поле).
   * true — обработана; иначе клавиша остаётся трассе.
   */
  const handleKey = (ev: CadInputKey): boolean => {
    if (!points.value.length) return false;
    const step = cadInputKey(input.value, ev);
    if (!step.handled) return false;
    input.value = step.state;
    compute();
    if (step.place && cursor.value) {
      const last = points.value[points.value.length - 1];
      if (distanceM(last.coord, cursor.value) > 0) {
        addPoint({ kind: 'vertex', coord: cursor.value });
        return true;
      }
    }
    render();
    return true;
  };

  const removeLast = () => {
    points.value = points.value.slice(0, -1);
    resetInput();
    compute();
    render();
  };

  const clear = () => {
    points.value = [];
    snap.value = null;
    cursor.value = null;
    cursorPx.value = null;
    constraint.value = null;
    raw = null;
    guide = null;
    guidesFor = null;
    resetInput();
    clearLayers();
  };

  /** Shift нажат / отпущен без движения мыши — «орто» сразу */
  const setShift = (on: boolean) => {
    if (!raw || raw.shift === on) return;
    raw = { ...raw, shift: on };
    compute();
    render();
  };

  /** Пересчитать курсор без движения мыши (сменили шаг полярной привязки) */
  const refresh = () => {
    if (!raw) return;
    compute();
    render();
  };

  /** Привязка под курсором без рисования (до первой точки — показать, к чему прилипнет клик) */
  const hover = (e: MapMouseEvent) => {
    onMove(e);
  };

  return {
    points,
    cursor,
    cursorPx,
    snap,
    input,
    metrics,
    active,
    lengths,
    onMove,
    onClick,
    handleKey,
    hover,
    removeLast,
    clear,
    refresh,
    setShift,
    render,
  };
}
