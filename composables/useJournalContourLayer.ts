/**
 * Слои карты для журналов: контур (GeoJSON участков из /journals/{j}/{id}/contour) и
 * подсветка участков, выбираемых кликом в режиме «Выбрать на карте».
 * Состояние — в useJournalMapBridge; здесь только отрисовка и обработка кликов.
 */
import { watch } from 'vue';
import type maplibregl from 'maplibre-gl';
import { useJournalMapBridge } from '~/composables/useJournalMapBridge';
import { useMapStore } from '~/stores/mapStore';
import { collectNetworkCandidates, pickNetworkFeature } from '~/utils/networkFeature';
import { isMapMeasureActive } from '~/composables/useMapDraw';

const OVERLAY_SOURCE = 'journal-contour';
const OVERLAY_LAYER = 'journal-contour-line';
const PICK_SOURCE = 'journal-contour-pick';
const PICK_LAYER = 'journal-contour-pick-line';
const PICK_NODE_LAYER = 'journal-contour-pick-node';
const OWN_LAYERS = new Set([OVERLAY_LAYER, PICK_LAYER, PICK_NODE_LAYER]);

const EMPTY = { type: 'FeatureCollection' as const, features: [] as any[] };

interface Options {
  /** Фрагменты контекста: из копий объекта под курсором берётся объект этих фрагментов */
  fragmentIds?: () => readonly number[]
  onPickHint?: (text: string) => void
}

export function useJournalContourLayer(getMap: () => maplibregl.Map | null | undefined, options: Options) {
  const bridge = useJournalMapBridge();
  const mapStore = useMapStore();
  let identifyBeforePick: boolean | null = null;

  const setData = (map: maplibregl.Map, sourceId: string, data: any) => {
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(data);
  };

  const ensureLayers = (map: maplibregl.Map): boolean => {
    try {
      if (!map.getSource(OVERLAY_SOURCE)) map.addSource(OVERLAY_SOURCE, { type: 'geojson', data: EMPTY });
      if (!map.getSource(PICK_SOURCE)) map.addSource(PICK_SOURCE, { type: 'geojson', data: EMPTY });
      if (!map.getLayer(OVERLAY_LAYER)) {
        map.addLayer({
          id: OVERLAY_LAYER,
          type: 'line',
          source: OVERLAY_SOURCE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#7b1fa2', 'line-width': 7, 'line-opacity': 0.55 },
        });
      }
      if (!map.getLayer(PICK_LAYER)) {
        map.addLayer({
          id: PICK_LAYER,
          type: 'line',
          source: PICK_SOURCE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ff6f00', 'line-width': 5, 'line-opacity': 0.9 },
        });
      }
      if (!map.getLayer(PICK_NODE_LAYER)) {
        map.addLayer({
          id: PICK_NODE_LAYER,
          type: 'circle',
          source: PICK_SOURCE,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-color': '#ff6f00',
            'circle-radius': 7,
            'circle-opacity': 0.85,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
        });
      }
      return true;
    } catch {
      // стиль ещё грузится (смена подложки) — отрисуем при следующем изменении
      return false;
    }
  };

  const pickedCollection = () => {
    const ids = new Set(bridge.state.pick.lineIds);
    const features: any[] = [];
    const seen = new Set<number>();
    for (const feature of bridge.state.overlay?.geojson.features || []) {
      const id = Number(feature?.properties?.line_id);
      if (ids.has(id) && !seen.has(id)) {
        features.push(feature);
        seen.add(id);
      }
    }
    for (const [key, feature] of Object.entries(bridge.state.pick.features)) {
      const id = Number(key);
      if (ids.has(id) && !seen.has(id)) features.push(feature);
    }
    return { type: 'FeatureCollection' as const, features };
  };

  const drawOverlay = () => {
    const map = getMap();
    if (!map || !ensureLayers(map)) return;
    const overlay = bridge.state.overlay;
    setData(map, OVERLAY_SOURCE, overlay?.geojson || EMPTY);
    if (overlay?.bbox) {
      const [xmin, ymin, xmax, ymax] = overlay.bbox;
      map.fitBounds([[xmin, ymin], [xmax, ymax]], { padding: 80, maxZoom: 18, duration: 1200 });
    }
  };

  const drawPicked = () => {
    const map = getMap();
    if (!map || !ensureLayers(map)) return;
    setData(map, PICK_SOURCE, bridge.state.pick.active ? pickedCollection() : EMPTY);
  };

  const onClick = (e: any) => {
    if (!bridge.state.pick.active || isMapMeasureActive()) return;
    const map = getMap();
    if (!map) return;
    const r = 6;
    const features = map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]])
      .filter((f: any) => !OWN_LAYERS.has(f?.layer?.id));
    const wantNode = bridge.state.pick.kind === 'node';
    // Единый выбор объекта сети (слой uzel/участки, фрагмент контекста), а не «первый под курсором» (QA F83)
    const pick = pickNetworkFeature(features, { kind: wantNode ? 'node' : 'line', fragmentIds: options.fragmentIds?.() ?? [] });
    if (pick.status === 'ambiguous') {
      const frags = [...new Set(pick.candidates.map((c) => c.fragmentId).filter((id) => id != null))];
      options.onPickHint?.(`Под курсором несколько объектов${frags.length ? ` (фрагменты ${frags.join(', ')})` : ''}: выберите фрагмент на карте.`);
      return;
    }
    if (pick.status !== 'single' || !pick.candidate) {
      options.onPickHint?.(wantNode ? 'Кликните по узлу (потребителю) сети.' : 'Кликните по участку тепловой сети.');
      return;
    }
    bridge.togglePicked(pick.candidate.id, pick.candidate.feature);
  };

  // Выбор рамкой: Shift + протянуть мышью — добавить все объекты в рамке (фрагменты контекста)
  let box: { start: { x: number; y: number }; el: HTMLDivElement } | null = null;
  let boxZoomWasOn = false;
  const boxPoint = (map: maplibregl.Map, e: MouseEvent) => {
    const rect = map.getCanvasContainer().getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onBoxMove = (e: MouseEvent) => {
    const map = getMap();
    if (!map || !box) return;
    const p = boxPoint(map, e);
    const x = Math.min(p.x, box.start.x);
    const y = Math.min(p.y, box.start.y);
    Object.assign(box.el.style, {
      left: `${x}px`, top: `${y}px`,
      width: `${Math.abs(p.x - box.start.x)}px`, height: `${Math.abs(p.y - box.start.y)}px`,
    });
  };
  const onBoxUp = (e: MouseEvent) => {
    const map = getMap();
    document.removeEventListener('mousemove', onBoxMove);
    document.removeEventListener('mouseup', onBoxUp);
    if (!map || !box) return;
    const start = box.start;
    box.el.remove();
    box = null;
    map.dragPan.enable();
    const end = boxPoint(map, e);
    if (Math.abs(end.x - start.x) < 4 && Math.abs(end.y - start.y) < 4) return;
    const features = map.queryRenderedFeatures([
      [Math.min(start.x, end.x), Math.min(start.y, end.y)],
      [Math.max(start.x, end.x), Math.max(start.y, end.y)],
    ]).filter((f: any) => !OWN_LAYERS.has(f?.layer?.id));
    const kind = bridge.state.pick.kind === 'node' ? 'node' : 'line';
    let candidates = collectNetworkCandidates(features, kind);
    const context = (options.fragmentIds?.() ?? []).filter((id) => Number.isInteger(id) && id > 0);
    if (context.length) candidates = candidates.filter((c) => c.fragmentId !== null && context.includes(c.fragmentId));
    const seen = new Set<number>();
    const items = candidates.filter((c) => !seen.has(c.id) && seen.add(c.id)).map((c) => ({ id: c.id, feature: c.feature }));
    if (!items.length) {
      options.onPickHint?.(kind === 'node' ? 'В рамке нет узлов сети.' : 'В рамке нет участков сети.');
      return;
    }
    bridge.addPicked(items);
  };
  const onBoxDown = (e: MouseEvent) => {
    const map = getMap();
    if (!map || !bridge.state.pick.active || !e.shiftKey || e.button !== 0 || isMapMeasureActive()) return;
    e.preventDefault();
    e.stopPropagation();
    map.dragPan.disable();
    const el = document.createElement('div');
    el.className = 'tgid-pick-box';
    Object.assign(el.style, {
      position: 'absolute', zIndex: '5', pointerEvents: 'none',
      border: '2px dashed #ff6f00', background: 'rgba(255, 111, 0, 0.08)',
    });
    map.getCanvasContainer().appendChild(el);
    box = { start: boxPoint(map, e), el };
    document.addEventListener('mousemove', onBoxMove);
    document.addEventListener('mouseup', onBoxUp);
  };

  const attach = (map: maplibregl.Map) => {
    map.on('click', onClick);
    map.getCanvasContainer().addEventListener('mousedown', onBoxDown, true);
  };
  const detach = (map: maplibregl.Map | null | undefined) => {
    map?.off('click', onClick);
    map?.getCanvasContainer().removeEventListener('mousedown', onBoxDown, true);
  };

  watch(() => bridge.state.overlayVersion, () => {
    drawOverlay();
    drawPicked();
  });
  watch(() => [bridge.state.pick.active, bridge.state.pick.lineIds.length], () => drawPicked());
  watch(() => bridge.state.pick.active, (active) => {
    // во время выбора клик не открывает карточку объекта
    // Shift + рамка — выбор, а не приближение (boxZoom MapLibre)
    const map = getMap();
    if (map) {
      if (active) {
        boxZoomWasOn = map.boxZoom.isEnabled();
        map.boxZoom.disable();
      } else if (boxZoomWasOn) {
        map.boxZoom.enable();
      }
    }
    if (active) {
      identifyBeforePick = mapStore.identifyModeEnabled;
      mapStore.setIdentifyMode(false);
    } else if (identifyBeforePick !== null) {
      mapStore.setIdentifyMode(identifyBeforePick);
      identifyBeforePick = null;
    }
  });

  return { attach, detach, redraw: () => { drawOverlay(); drawPicked(); } };
}
