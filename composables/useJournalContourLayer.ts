/**
 * Слои карты для журналов: контур (GeoJSON участков из /journals/{j}/{id}/contour) и
 * подсветка участков, выбираемых кликом в режиме «Выбрать на карте».
 * Состояние — в useJournalMapBridge; здесь только отрисовка и обработка кликов.
 */
import { watch } from 'vue';
import type maplibregl from 'maplibre-gl';
import { useJournalMapBridge } from '~/composables/useJournalMapBridge';
import { useMapStore } from '~/stores/mapStore';

const OVERLAY_SOURCE = 'journal-contour';
const OVERLAY_LAYER = 'journal-contour-line';
const PICK_SOURCE = 'journal-contour-pick';
const PICK_LAYER = 'journal-contour-pick-line';
const PICK_NODE_LAYER = 'journal-contour-pick-node';
const OWN_LAYERS = new Set([OVERLAY_LAYER, PICK_LAYER, PICK_NODE_LAYER]);

const EMPTY = { type: 'FeatureCollection' as const, features: [] as any[] };

interface Options {
  isLineFeature: (feature: any) => boolean
  /** Узел сети — для выбора узлов (групповые установщики по потребителям/узлам) */
  isNodeFeature?: (feature: any) => boolean
  featureId: (feature: any) => number | null
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
    if (!bridge.state.pick.active) return;
    const map = getMap();
    if (!map) return;
    const r = 6;
    const features = map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]]);
    const wantNode = bridge.state.pick.kind === 'node';
    const matches = (f: any) => (wantNode ? Boolean(options.isNodeFeature?.(f)) : options.isLineFeature(f));
    const hit = features.find((f: any) => !OWN_LAYERS.has(f?.layer?.id) && matches(f));
    const id = hit ? options.featureId(hit) : null;
    if (!id) {
      options.onPickHint?.(wantNode ? 'Кликните по узлу (потребителю) сети.' : 'Кликните по участку тепловой сети.');
      return;
    }
    bridge.togglePicked(id, hit);
  };

  const attach = (map: maplibregl.Map) => {
    map.on('click', onClick);
  };
  const detach = (map: maplibregl.Map | null | undefined) => {
    map?.off('click', onClick);
  };

  watch(() => bridge.state.overlayVersion, () => {
    drawOverlay();
    drawPicked();
  });
  watch(() => [bridge.state.pick.active, bridge.state.pick.lineIds.length], () => drawPicked());
  watch(() => bridge.state.pick.active, (active) => {
    // во время выбора клик не открывает карточку объекта
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
