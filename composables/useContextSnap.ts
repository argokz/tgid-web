/**
 * Индекс привязки к подложке (этап C): здания и улицы MapTiler в окне карты.
 *
 * Тайлы грузятся только у видимых слоёв, поэтому на время трассы добавляются невидимые
 * (прозрачные) слои `cad-ctx-*`: здания — источник контекста context-buildings-src,
 * улицы, их подписи и номера домов — свой источник Planet v4. Индекс собирается из уже
 * загруженных тайлов (querySourceFeatures) после сдвига карты и подгрузки тайлов.
 * Ниже z15 привязки к подложке нет: тайлы грубее, а размеры теряют смысл.
 */
import { ref, shallowRef } from 'vue';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { getMapTilerKey, getMapTilerPlanetV4TilesUrl } from '~/utils/maptiler';
import { CONTEXT_SOURCE_IDS, ensureContextMapLayers } from '~/utils/contextMapLayers';
import {
  buildContextIndex,
  buildingNumbers,
  CONTEXT_MIN_MAP_ZOOM,
  mergeBuildingPieces,
  roadLabelsFrom,
  roadsFrom,
  type ContextIndex,
  type ContextSourceFeature,
} from '~/utils/cadContext';
import type { LngLat } from '~/utils/lineVertices';

export type ContextSnapStatus = 'off' | 'no-key' | 'zoom-in' | 'loading' | 'ready';

const PLANET_SOURCE_ID = 'cad-ctx-planet';
const LAYER_BUILDING = 'cad-ctx-building';
const LAYER_ROAD = 'cad-ctx-road';
const LAYER_ROAD_LABEL = 'cad-ctx-road-label';
const LAYER_NUMBER = 'cad-ctx-number';
const LAYERS = [LAYER_NUMBER, LAYER_ROAD_LABEL, LAYER_ROAD, LAYER_BUILDING];
const REBUILD_DELAY_MS = 200;

export function useContextSnap(getMap: () => MapLibreMap | null | undefined) {
  const index = shallowRef<ContextIndex | null>(null);
  const status = ref<ContextSnapStatus>('off');
  let active = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const addLayers = (map: MapLibreMap): boolean => {
    if (!getMapTilerKey()) return false;
    if (!map.getSource(CONTEXT_SOURCE_IDS.buildings) && !ensureContextMapLayers(map)) return false;
    if (!map.getSource(PLANET_SOURCE_ID)) {
      map.addSource(PLANET_SOURCE_ID, { type: 'vector', tiles: [getMapTilerPlanetV4TilesUrl()], minzoom: 0, maxzoom: 15 });
    }
    const invisible = (id: string, source: string, sourceLayer: string, type: 'fill' | 'line' | 'circle') => {
      if (map.getLayer(id)) return;
      const paint =
        type === 'fill' ? { 'fill-opacity': 0 } : type === 'line' ? { 'line-opacity': 0 } : { 'circle-opacity': 0, 'circle-radius': 0 };
      map.addLayer({ id, type, source, 'source-layer': sourceLayer, minzoom: CONTEXT_MIN_MAP_ZOOM, paint } as any);
    };
    invisible(LAYER_BUILDING, CONTEXT_SOURCE_IDS.buildings, 'building', 'fill');
    invisible(LAYER_ROAD, PLANET_SOURCE_ID, 'road', 'line');
    invisible(LAYER_ROAD_LABEL, PLANET_SOURCE_ID, 'road_label', 'line');
    invisible(LAYER_NUMBER, PLANET_SOURCE_ID, 'building_number', 'circle');
    return true;
  };

  const removeLayers = (map: MapLibreMap) => {
    for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(PLANET_SOURCE_ID)) map.removeSource(PLANET_SOURCE_ID);
  };

  const query = (map: MapLibreMap, source: string, sourceLayer: string): ContextSourceFeature[] => {
    try {
      return map.querySourceFeatures(source, { sourceLayer }) as unknown as ContextSourceFeature[];
    } catch {
      return [];
    }
  };

  const rebuild = () => {
    const map = getMap();
    if (!map || !active) return;
    if (map.getZoom() < CONTEXT_MIN_MAP_ZOOM) {
      index.value = null;
      status.value = 'zoom-in';
      return;
    }
    const numbers = buildingNumbers(query(map, PLANET_SOURCE_ID, 'building_number'));
    const buildings = mergeBuildingPieces(query(map, CONTEXT_SOURCE_IDS.buildings, 'building'), numbers);
    const roads = roadsFrom(query(map, PLANET_SOURCE_ID, 'road'));
    const labels = roadLabelsFrom(query(map, PLANET_SOURCE_ID, 'road_label'));
    const c = map.getCenter();
    const origin: LngLat = [c.lng, c.lat];
    index.value = buildContextIndex({ buildings, roads, labels }, origin);
    const loaded = map.isSourceLoaded(PLANET_SOURCE_ID) && map.isSourceLoaded(CONTEXT_SOURCE_IDS.buildings);
    status.value = loaded ? 'ready' : 'loading';
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(rebuild, REBUILD_DELAY_MS);
  };

  const onSourceData = (e: any) => {
    if (e?.sourceId === PLANET_SOURCE_ID || e?.sourceId === CONTEXT_SOURCE_IDS.buildings) {
      if (e.tile || e.isSourceLoaded) schedule();
    }
  };

  const start = () => {
    const map = getMap();
    if (!map || active) return;
    if (!addLayers(map)) {
      status.value = 'no-key';
      return;
    }
    active = true;
    status.value = 'loading';
    map.on('moveend', schedule);
    map.on('sourcedata', onSourceData);
    schedule();
  };

  const stop = () => {
    const map = getMap();
    active = false;
    if (timer) clearTimeout(timer);
    if (map) {
      map.off('moveend', schedule);
      map.off('sourcedata', onSourceData);
      removeLayers(map);
    }
    index.value = null;
    status.value = 'off';
  };

  return { index, status, start, stop, rebuild };
}
