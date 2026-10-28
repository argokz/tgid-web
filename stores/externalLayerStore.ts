import { defineStore } from 'pinia';
import type { Map as MapLibreMap, MapSourceDataEvent } from 'maplibre-gl';
import { appStorage } from '~/utils/appStorage';
import {
  ExternalLayerError,
  capabilitiesUrl,
  newExternalLayerId,
  parseSavedExternalLayers,
  parseWmsCapabilities,
  parseWmtsCapabilities,
  type ExternalLayer,
  type ServiceLayerOption,
} from '~/utils/externalLayers';
import { useMapStore } from './mapStore';

/**
 * Внешние слои пользователя (utils/externalLayers.ts): список — в браузере, отдельно по городу
 * (appStorage); на карте — растровые слои под сетью ТГИД.
 */
const SAVED_KEY = 'externalLayers';
const CAPABILITIES_TIMEOUT_MS = 15000;
/** Подряд неудачных тайлов, после которых у слоя показывается ошибка */
const TILE_ERRORS_TO_REPORT = 3;
/** Слои сети ТГИД (MVT/WMS GeoServer): внешние встают под них */
const NETWORK_LAYER_RE = /^(mvt|wms)__/;

const sourceIdOf = (id: string) => `${id}-src`;

export const useExternalLayerStore = defineStore('externalLayer', {
  state: () => ({
    layers: [] as ExternalLayer[],
    /** id слоя → текст ошибки загрузки тайлов (не сохраняется) */
    errors: {} as Record<string, string>,
    loaded: false,
  }),

  actions: {
    load() {
      if (this.loaded) return;
      try {
        this.layers = parseSavedExternalLayers(appStorage.getItem(SAVED_KEY));
      } catch {
        this.layers = []; // localStorage недоступен — список живёт до перезагрузки
      }
      this.loaded = true;
    },

    save() {
      try {
        appStorage.setItem(SAVED_KEY, JSON.stringify(this.layers));
      } catch {
        // localStorage недоступен — список живёт до перезагрузки
      }
    },

    /** Слои сервиса из GetCapabilities (запрос из браузера: сервер должен разрешать CORS). */
    async discover(kind: 'wms' | 'wmts', serviceUrl: string): Promise<ServiceLayerOption[]> {
      const url = capabilitiesUrl(serviceUrl, kind);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CAPABILITIES_TIMEOUT_MS);
      let xml: string;
      try {
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) throw new ExternalLayerError(`Сервер ответил ошибкой ${resp.status} на GetCapabilities`);
        xml = await resp.text();
      } catch (e) {
        if (e instanceof ExternalLayerError) throw e;
        if ((e as Error)?.name === 'AbortError') {
          throw new ExternalLayerError('Сервер не ответил за 15 секунд');
        }
        throw new ExternalLayerError(
          'Сервер недоступен или не разрешает запросы с этого сайта (CORS). Проверьте адрес; ' +
          'если сервер свой — администратору нужно разрешить CORS или открыть его через прокси ТГИД',
        );
      } finally {
        clearTimeout(timer);
      }
      return kind === 'wms' ? parseWmsCapabilities(xml, serviceUrl) : parseWmtsCapabilities(xml, serviceUrl);
    },

    add(input: Omit<ExternalLayer, 'id' | 'opacity' | 'visible'> & Partial<Pick<ExternalLayer, 'opacity' | 'visible'>>) {
      const layer: ExternalLayer = { opacity: 0.8, visible: true, ...input, id: newExternalLayerId() };
      this.layers.push(layer);
      this.save();
      this.syncToMap();
      return layer;
    },

    remove(id: string) {
      this.layers = this.layers.filter((l) => l.id !== id);
      delete this.errors[id];
      this.save();
      const map = useMapStore().map;
      if (!map) return;
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(sourceIdOf(id))) map.removeSource(sourceIdOf(id));
    },

    setVisible(id: string, visible: boolean) {
      const layer = this.layers.find((l) => l.id === id);
      if (!layer) return;
      layer.visible = visible;
      this.save();
      const map = useMapStore().map;
      if (map?.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    },

    setOpacity(id: string, opacity: number) {
      const layer = this.layers.find((l) => l.id === id);
      if (!layer) return;
      layer.opacity = Math.min(1, Math.max(0, opacity));
      this.save();
      const map = useMapStore().map;
      if (map?.getLayer(id)) map.setPaintProperty(id, 'raster-opacity', layer.opacity);
    },

    /** Добавить на карту недостающие слои списка (после создания карты и после add). */
    syncToMap() {
      this.load();
      const map = useMapStore().map;
      if (!map) return;
      this.watchTileErrors(map);
      const firstNetwork = map.getStyle()?.layers?.find((l: { id: string }) => NETWORK_LAYER_RE.test(l.id))?.id;
      for (const layer of this.layers) {
        const src = sourceIdOf(layer.id);
        if (!map.getSource(src)) {
          map.addSource(src, {
            type: 'raster',
            tiles: [layer.tileUrl],
            tileSize: 256,
            scheme: layer.tileUrl.includes('{-y}') ? 'tms' : 'xyz',
            ...(layer.minzoom != null ? { minzoom: layer.minzoom } : {}),
            ...(layer.maxzoom != null ? { maxzoom: layer.maxzoom } : {}),
          });
        }
        if (!map.getLayer(layer.id)) {
          map.addLayer(
            {
              id: layer.id,
              type: 'raster',
              source: src,
              layout: { visibility: layer.visible ? 'visible' : 'none' },
              paint: { 'raster-opacity': layer.opacity },
            },
            firstNetwork,
          );
        }
      }
    },

    watchTileErrors(map: MapLibreMap) {
      const tagged = map as MapLibreMap & { __externalErrorsWatched?: boolean };
      if (tagged.__externalErrorsWatched) return;
      tagged.__externalErrorsWatched = true;
      const failures: Record<string, number> = {};
      map.on('error', (e: { sourceId?: string; error?: Error }) => {
        const id = e.sourceId?.endsWith('-src') ? e.sourceId.slice(0, -4) : null;
        if (!id || !this.layers.some((l) => l.id === id)) return;
        failures[id] = (failures[id] ?? 0) + 1;
        if (failures[id] >= TILE_ERRORS_TO_REPORT) {
          this.errors[id] = 'Тайлы не загружаются: сервер недоступен, нет такого слоя или он запрещает доступ с этого сайта (CORS)';
        }
      });
      map.on('sourcedata', (e: MapSourceDataEvent) => {
        const id = e.sourceId?.endsWith('-src') ? e.sourceId.slice(0, -4) : null;
        if (id && e.tile && failures[id]) {
          failures[id] = 0;
          delete this.errors[id];
        }
      });
    },
  },
});
