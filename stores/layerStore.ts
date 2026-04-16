import { defineStore } from 'pinia';
import { mapService } from '~/services/mapService';
import type { LayerConfig, ExtendedLayerConfig, WmsLayerConfig } from '~/types';
import type { FilterSpecification } from 'maplibre-gl';
import { useMapStore } from './mapStore';
import { useLabelStore } from './labelStore';
import { getLayerType, layerTypes } from '~/server/config/layer-types';
import { useFragmentStore } from './fragmentStore';
import { useWmsLayer } from '~/composables/useWmsLayer';
import { useSettingsStore } from './settingsStore';
import type { ContextLayerKey } from '~/utils/contextMapLayers';
import {
  CONTEXT_LAYER_ORDER,
  ensureContextMapLayers,
  restackContextMapLayers,
  restackPlanetLayersBelowOverlays,
  applyContextLayersVisibility,
} from '~/utils/contextMapLayers';

const pbfAttributeRequests = new globalThis.Map<string, Promise<string[]>>();

export const useLayerStore = defineStore('layer', {
  state: () => ({
    geoServerLayers: [] as ExtendedLayerConfig[],
    visibleGeoServerLayers: [] as string[],
    wmsLayers: [] as WmsLayerConfig[],
    visibleWmsLayers: [] as string[],
    layerStyles: {} as Record<string, any>,
    layerAttributes: {} as Record<string, string[]>,
    cachingEnabledLayers: [] as string[], // Список ID слоев, для которых включено кэширование
    isInitialized: false,
    isLayersLoading: false,
    loadingTotalLayers: 0,
    loadingCompletedLayers: 0,
    loadingFailedLayers: 0,
    /** Видимые слои контекста MapTiler (ключи: contours | buildings | hillshade) */
    visibleContextLayers: [] as ContextLayerKey[],
  }),

  actions: {
    initializeLayers(layers: ExtendedLayerConfig[]) {
      this.geoServerLayers = layers;
      // Загружаем сохраненные видимые слои
      this.loadVisibleLayers();
      this.loadVisibleContextLayers();
      // Загружаем порядок слоев (zIndex)
      this.loadLayerOrder();
      // Загружаем стили слоев
      this.loadLayerStyles();
      // Загружаем атрибуты слоев
      this.loadLayerAttributes();
      // Загружаем настройки кэширования
      this.loadCachingSettings();
      
      this.isInitialized = true;
      this.syncContextLayersToMap();
    },

    loadVisibleContextLayers() {
      const saved = localStorage.getItem('visibleContextLayers');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const allowed = new Set<string>(CONTEXT_LAYER_ORDER);
          this.visibleContextLayers = Array.isArray(parsed)
            ? (parsed.filter((k: unknown) => typeof k === 'string' && allowed.has(k)) as ContextLayerKey[])
            : [];
        } catch {
          this.visibleContextLayers = [];
        }
      } else {
        this.visibleContextLayers = [];
      }
    },

    saveVisibleContextLayers() {
      localStorage.setItem('visibleContextLayers', JSON.stringify(this.visibleContextLayers));
    },

    /** Установить источники/слои контекста и видимость; выровнять стек под рабочими слоями. */
    syncContextLayersToMap() {
      const mapStore = useMapStore();
      const map = mapStore.map;
      if (!map) return;
      if (!ensureContextMapLayers(map as any)) return;
      applyContextLayersVisibility(map as any, new Set(this.visibleContextLayers));
      restackContextMapLayers(map as any);
    },

    setContextLayerVisible(key: ContextLayerKey, visible: boolean) {
      const mapStore = useMapStore();
      const map = mapStore.map;
      if (!map) return;
      if (!ensureContextMapLayers(map as any)) return;
      const had = this.visibleContextLayers.includes(key);
      if (visible && !had) {
        this.visibleContextLayers = [...this.visibleContextLayers, key];
      } else if (!visible && had) {
        this.visibleContextLayers = this.visibleContextLayers.filter((k) => k !== key);
      }
      this.saveVisibleContextLayers();
      applyContextLayersVisibility(map as any, new Set(this.visibleContextLayers));
      restackContextMapLayers(map as any);
    },

    toggleContextLayer(key: ContextLayerKey) {
      this.setContextLayerVisible(key, !this.visibleContextLayers.includes(key));
    },

    resetLayerLoadingProgress(total: number) {
      this.isLayersLoading = total > 0;
      this.loadingTotalLayers = total;
      this.loadingCompletedLayers = 0;
      this.loadingFailedLayers = 0;
    },

    markLayerLoadingSuccess() {
      this.loadingCompletedLayers += 1;
      if (this.loadingCompletedLayers >= this.loadingTotalLayers) {
        this.isLayersLoading = false;
      }
    },

    markLayerLoadingFailure() {
      this.loadingFailedLayers += 1;
      this.loadingCompletedLayers += 1;
      if (this.loadingCompletedLayers >= this.loadingTotalLayers) {
        this.isLayersLoading = false;
      }
    },

    async setupMapLayers() {
      const mapStore = useMapStore();
      if (!mapStore.map) return;

      if (import.meta.dev) console.debug('📡 Synchronizing visible layers with map instance');
      const totalLayers = this.visibleGeoServerLayers.length + this.visibleWmsLayers.length;
      this.resetLayerLoadingProgress(totalLayers);
      if (totalLayers === 0) {
        this.syncMapLayerStackOrder();
        return;
      }

      // 1. MVT Layers — загружаем в правильном порядке:
      // сначала линейные/площадные (нижний слой), затем точечные (верхний слой)
      // внутри каждой группы — по zIndex (от меньшего к большему = от нижнего к верхнему)
      const pointTypes = new Set(['circle', 'symbol']);
      const sortedLayerIds = [...this.visibleGeoServerLayers].sort((a, b) => {
        const layerA = this.geoServerLayers.find(l => l.layerId === a);
        const layerB = this.geoServerLayers.find(l => l.layerId === b);
        const aIsPoint = layerA && pointTypes.has(layerA.type) ? 1 : 0;
        const bIsPoint = layerB && pointTypes.has(layerB.type) ? 1 : 0;
        if (aIsPoint !== bIsPoint) return aIsPoint - bIsPoint;
        const aZ = layerA?.zIndex ?? 0;
        const bZ = layerB?.zIndex ?? 0;
        return aZ - bZ;
      });

      for (const layerId of sortedLayerIds) {
        const layer = this.geoServerLayers.find(l => l.layerId === layerId);
        if (layer) {
          const loaded = await this.loadLayer(layer);
          if (loaded) this.markLayerLoadingSuccess();
          else this.markLayerLoadingFailure();
        } else {
          this.markLayerLoadingFailure();
        }
      }

      // 2. WMS Layers
      for (const layerId of this.visibleWmsLayers) {
        const loaded = this.loadWmsLayer(layerId);
        if (loaded) this.markLayerLoadingSuccess();
        else this.markLayerLoadingFailure();
      }
      
      this.applyFragmentFilter();
      await this.waitForMapIdle();
      this.syncMapLayerStackOrder();
      this.isLayersLoading = false;
    },

    initWmsLayers(layers: WmsLayerConfig[]) {
      this.wmsLayers = layers;
      this.loadVisibleWmsLayers();
    },

    loadVisibleWmsLayers() {
      const saved = localStorage.getItem('visibleWmsLayers');
      if (saved) {
        this.visibleWmsLayers = JSON.parse(saved);
      }
    },

    saveVisibleWmsLayers() {
      localStorage.setItem('visibleWmsLayers', JSON.stringify(this.visibleWmsLayers));
    },

    async toggleWmsLayer(layerId: string) {
      const mapStore = useMapStore();
      if (!mapStore.map) return;

      const { addWmsLayer: addWms, removeWmsLayer: removeWms } = useWmsLayer();
      const index = this.visibleWmsLayers.indexOf(layerId);
      const isVisible = index !== -1;
      
      if (isVisible) {
        this.visibleWmsLayers.splice(index, 1);
        const sourceId = `wms-source-${layerId}`;
        const layId = `wms-layer-${layerId}`;
        removeWms(mapStore.map as any, sourceId, layId);
      } else {
        const wmsLayer = this.wmsLayers.find(l => l.id === layerId);
        if (wmsLayer) {
          this.visibleWmsLayers.push(layerId);
          const sourceId = `wms-source-${layerId}`;
          const layId = `wms-layer-${layerId}`;
          addWms(mapStore.map as any, sourceId, layId, wmsLayer);
        }
      }
      this.saveVisibleWmsLayers();
    },

    loadWmsLayer(layerId: string): boolean {
      const mapStore = useMapStore();
      if (!mapStore.map) return false;
      
      const wmsLayer = this.wmsLayers.find(l => l.id === layerId);
      if (wmsLayer) {
        const { addWmsLayer: addWms } = useWmsLayer();
        const sourceId = `wms-source-${layerId}`;
        const layId = `wms-layer-${layerId}`;
        addWms(mapStore.map as any, sourceId, layId, wmsLayer);
        return true;
      }
      return false;
    },

    removeWmsLayer(layerId: string) {
      const mapStore = useMapStore();
      if (!mapStore.map) return;
      
      const { removeWmsLayer: removeWms } = useWmsLayer();
      const sourceId = `wms-source-${layerId}`;
      const layId = `wms-layer-${layerId}`;
      removeWms(mapStore.map as any, sourceId, layId);
    },

    async loadLayer(layer: ExtendedLayerConfig): Promise<boolean> {
      if (import.meta.dev) console.debug(`Attempting to load layer: ${layer.layerId}`);
      const mapStore = useMapStore();
      
      if (!mapStore.map) {
        console.error('LayerStore: Map not initialized');
        return false;
      }
      
      if (mapStore.map.getLayer(layer.layerId)) {
        if (import.meta.dev) console.debug(`LayerStore: Layer ${layer.layerId} already exists, applying style`);
        await mapStore.applyLayerStyle(layer.layerId, this.layerStyles[layer.layerId] || {});
        return true;
      }
      
      try {
        if (!layer.renderFormat || layer.renderFormat === 'mvt') {
          // Construct MVT URL with viewparams
          const labelStore = useLabelStore();
          const fragmentStore = useFragmentStore();
          
          let mvtUrl = layer.mvtUrl;
          if (mvtUrl && mapStore.map) {
            const labelStore = useLabelStore();
            const fragmentStore = useFragmentStore();
            
            const fragmentsS = fragmentStore.visibleFragments.length > 0 
              ? encodeURIComponent(fragmentStore.visibleFragments.join('_')) 
              : '';
            const fragmentsPart = fragmentsS ? `fragments:${fragmentsS};` : '';
            const fieldsPart = this.getLayerVisibleFields(layer);
            const viewparams = `${fragmentsPart}${fieldsPart}${fieldsPart.endsWith(';') || !fieldsPart ? '' : ';'}nach:2;`;
            
            // CRITICAL: Don't use URL object as it encodes {z}/{x}/{y} placeholders
            const separator = mvtUrl.includes('?') ? '&' : '?';
            mvtUrl = `${mvtUrl}${separator}viewparams=${viewparams}`;
          }

          if (import.meta.dev) console.debug(`Loading MVT layer: ${layer.layerId}, URL: ${mvtUrl}`);
          if (!mvtUrl) {
            console.error(`Missing mvtUrl for layer ${layer.layerId}`);
            return false;
          }
          
          // Re-map the mvtUrl in the layer config for loadMvtLayer
          const layerWithParams = { ...layer, mvtUrl };
          await mapService.loadMvtLayer(mapStore.map as any, layerWithParams);
          if (import.meta.dev) console.debug(`LayerStore: MVT layer ${layer.layerId} loading initiated`);
        } else if (layer.renderFormat === 'wms') {
          if (import.meta.dev) console.debug(`Loading WMS layer: ${layer.layerId}`);
          
          // Get current fragment filter as CQL
          const fragmentStore = useFragmentStore();
          let cqlFilterStr: string | undefined = undefined;
          if (fragmentStore.visibleFragments.length > 0) {
            const ids = fragmentStore.visibleFragments;
            const allIds = [...new Set([...ids, ...ids.map(id => String(id))])];
            cqlFilterStr = `"fileid" IN (${allIds.map(id => `'${id}'`).join(',')})`;
          }

          const { addWmsLayer } = useWmsLayer();
          addWmsLayer(mapStore.map as any, layer.sourceId, layer.layerId, {
            workspace: layer.workspace || 'AlmatyGIS',
            layerName: layer.sourceLayer,
            cqlFilter: cqlFilterStr
          });
        }
        
        // Стабильная проверка загрузки через событие 'idle' или 'sourcedata'
        // Для простоты подписываемся один раз на sourcedata именно для этого источника
        const applySavedStyles = () => {
          const subIds = mapStore.getLayerIdsOnMap(layer.layerId).filter((id) => mapStore.map!.getLayer(id));
          if (subIds.length === 0) return;

          const savedStyles = this.layerStyles[layer.layerId];
          if (savedStyles) {
            const isComplexMbStyle = layer.mbLayers && layer.mbLayers.length > 1;
            const stylesToApply = isComplexMbStyle ? { opacity: savedStyles.opacity } : savedStyles;

            if (Object.keys(stylesToApply).length > 0) {
              mapStore.applyLayerStyle(layer.layerId, stylesToApply);
            }
          }
          const labelStore = useLabelStore();
          labelStore.syncGlobalLabels();
        };

        const checkReady = (e: any) => {
          if (e.sourceId !== layer.sourceId) return;
          const ready = mapStore.getLayerIdsOnMap(layer.layerId).some((id) => mapStore.map!.getLayer(id));
          if (!ready) return;
          if (import.meta.dev) console.debug(`LayerStore: Layer ${layer.layerId} is ready`);
          applySavedStyles();
          mapStore.map!.off('sourcedata', checkReady);
        };
        
        mapStore.map.on('sourcedata', checkReady);
        
        // Фолбэк через idle если sourcedata не сработал как ожидалось
        mapStore.map.once('idle', () => {
          applySavedStyles();
          mapStore.map!.off('sourcedata', checkReady);
          
          // Auto-discover attributes for filtering
          this.getPbfAttributes(layer);
        });
        return true;
      } catch (error) {
        console.error(`Failed to load layer ${layer.layerId}:`, error);
        return false;
      }
    },

    loadVisibleLayers() {
      const saved = localStorage.getItem('visibleGeoServerLayers');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const raw = Array.isArray(parsed) ? parsed : [];
          this.visibleGeoServerLayers = this.sortVisibleLayerIdsByGeoOrder(raw);
        } catch {
          this.visibleGeoServerLayers = [];
        }
      } else {
        // По умолчанию ни один MVT-слой не включён — пользователь включает вручную
        this.visibleGeoServerLayers = [];
        this.saveVisibleLayers();
      }
    },

    /** Порядок как в списке слоёв (geoServerLayers), без порядка кликов по чекбоксам */
    sortVisibleLayerIdsByGeoOrder(layerIds: string[]): string[] {
      const set = new Set(layerIds);
      return this.geoServerLayers.map((l) => l.layerId).filter((id) => set.has(id));
    },

    /**
     * Порядок снизу вверх для updateLayerOrder: последний id — верх карты (как первый в списке UI).
     */
    getGeoServerStackBottomToTop(): string[] {
      return [...this.geoServerLayers].map((l) => l.layerId).reverse();
    },

    /** Выровнять z-порядок MapLibre с порядком в списке; точечные сублои — над линейными (логика updateLayerOrder). */
    syncMapLayerStackOrder() {
      const mapStore = useMapStore();
      if (!mapStore.map) return;
      restackPlanetLayersBelowOverlays(mapStore.map as any);
      const order = this.getGeoServerStackBottomToTop();
      if (order.length > 0) {
        this.updateLayerOrder(order);
      }
      restackContextMapLayers(mapStore.map as any);
    },

    /** После addLayer стиль догружается асинхронно — один idle перед выравниванием стека. */
    waitForMapIdle(): Promise<void> {
      const map = useMapStore().map;
      if (!map) return Promise.resolve();
      return new Promise((resolve) => {
        map.once('idle', () => resolve());
      });
    },

    /**
     * Применить набор видимых MVT-слоёв разом (после выбора в UI), затем выровнять порядок отрисовки.
     */
    async applyVisibleLayersSelection(targetIds: string[]) {
      const mapStore = useMapStore();
      const map = mapStore.map;
      const sortedTarget = this.sortVisibleLayerIdsByGeoOrder(targetIds);
      const prev = [...this.visibleGeoServerLayers];
      const prevSet = new Set(prev);
      const nextSet = new Set(sortedTarget);

      if (map) {
        for (const layerId of prev) {
          if (!nextSet.has(layerId)) {
            const subIds = this.getLayerIdsOnMap(layerId);
            const idsToHide = subIds.length > 0 ? subIds : [layerId];
            for (const subId of idsToHide) {
              if (map.getLayer(subId)) {
                map.setLayoutProperty(subId, 'visibility', 'none');
              }
            }
          }
        }

        const loadPromises: Promise<boolean>[] = [];
        for (const layerId of sortedTarget) {
          if (prevSet.has(layerId)) continue;
          const layerConfig = this.geoServerLayers.find((l) => l.layerId === layerId);
          if (!layerConfig) continue;
          const subIds = this.getLayerIdsOnMap(layerId);
          const idsToToggle = subIds.length > 0 ? subIds : [layerId];
          const existingSubIds = idsToToggle.filter((id) => map.getLayer(id));
          if (existingSubIds.length > 0) {
            for (const subId of existingSubIds) {
              map.setLayoutProperty(subId, 'visibility', 'visible');
            }
            const savedStyles = this.layerStyles[layerId];
            if (savedStyles) {
              const isComplexMbStyle = layerConfig.mbLayers && layerConfig.mbLayers.length > 1;
              const stylesToApply = isComplexMbStyle ? { opacity: savedStyles.opacity } : savedStyles;
              if (Object.keys(stylesToApply).length > 0) {
                mapStore.applyLayerStyle(layerId, stylesToApply);
              }
            }
          } else {
            loadPromises.push(this.loadLayer(layerConfig));
          }
        }
        if (loadPromises.length > 0) {
          await Promise.all(loadPromises);
          await this.waitForMapIdle();
        }
      }

      this.visibleGeoServerLayers = sortedTarget;
      this.saveVisibleLayers();
      this.syncMapLayerStackOrder();
    },

    toggleLayerVisibility(layerId: string) {
      const index = this.visibleGeoServerLayers.indexOf(layerId);
      const isAdding = index === -1;
      
      if (isAdding) {
        this.visibleGeoServerLayers.push(layerId);
      } else {
        this.visibleGeoServerLayers.splice(index, 1);
      }
      this.visibleGeoServerLayers = this.sortVisibleLayerIdsByGeoOrder(this.visibleGeoServerLayers);
      this.saveVisibleLayers();

      // Синхронизируем видимость с картой (все сублои)
      const mapStore = useMapStore();
      if (mapStore.map) {
        const subIds = this.getLayerIdsOnMap(layerId);
        const idsToToggle = subIds.length > 0 ? subIds : [layerId];
        let stackSyncDeferred = false;

        if (!isAdding) {
          for (const subId of idsToToggle) {
            if (mapStore.map.getLayer(subId)) {
              mapStore.map.setLayoutProperty(subId, 'visibility', 'none');
            }
          }
        } else {
          const existingSubIds = idsToToggle.filter(id => mapStore.map!.getLayer(id));
          if (existingSubIds.length > 0) {
            for (const subId of existingSubIds) {
              mapStore.map.setLayoutProperty(subId, 'visibility', 'visible');
            }
            const layerConfig = this.geoServerLayers.find(l => l.layerId === layerId);
            const savedStyles = this.layerStyles[layerId];
            if (layerConfig && savedStyles) {
              const isComplexMbStyle = layerConfig.mbLayers && layerConfig.mbLayers.length > 1;
              const stylesToApply = isComplexMbStyle ? { opacity: savedStyles.opacity } : savedStyles;
              if (Object.keys(stylesToApply).length > 0) {
                mapStore.applyLayerStyle(layerId, stylesToApply);
              }
            }
          } else {
            const layerConfig = this.geoServerLayers.find(l => l.layerId === layerId);
            if (layerConfig) {
              stackSyncDeferred = true;
              void this.loadLayer(layerConfig)
                .then(() => this.waitForMapIdle())
                .then(() => this.syncMapLayerStackOrder());
            }
          }
        }
        if (!stackSyncDeferred) {
          this.syncMapLayerStackOrder();
        }
      }
    },

    async changeLayerFormat(layerId: string, format: 'mvt' | 'wms' | 'wmts') {
      const layer = this.geoServerLayers.find(l => l.layerId === layerId);
      if (!layer) return;
      const currentFormat = layer.renderFormat || 'mvt';
      if (currentFormat === format) return;
      
      const mapStore = useMapStore();
      const map = mapStore.map;
      
      if (map) {
        const layersToRemove = this.getLayerIdsOnMap(layerId);
        for (const lId of layersToRemove) {
          if (map.getLayer(lId)) map.removeLayer(lId);
        }
        if (map.getSource(layer.sourceId)) map.removeSource(layer.sourceId);
      }
      
      layer.renderFormat = format;
      
      if (this.visibleGeoServerLayers.includes(layerId)) {
         await this.loadLayer(layer);
      }
    },

    async getPbfAttributes(layer: LayerConfig): Promise<string[]> {
      const mapStore = useMapStore();
      const map = mapStore.map;
      if (!map) return [];

      // If we already have attributes, return them
      if (this.layerAttributes[layer.layerId] && this.layerAttributes[layer.layerId].length > 0) {
        return this.layerAttributes[layer.layerId];
      }

      const inFlight = pbfAttributeRequests.get(layer.layerId);
      if (inFlight) {
        return inFlight;
      }

      const request = new Promise<string[]>((resolve) => {
        let attempt = 0;
        let loggedLayerIds = false;
        let interval: ReturnType<typeof setInterval> | null = null;

        const finish = (result: string[]) => {
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          resolve(result);
        };

        const checkFeatures = () => {
          try {
            const subLayerIds = mapStore.getLayerIdsOnMap(layer.layerId);
            if (subLayerIds.length === 0) {
              subLayerIds.push(layer.layerId);
            }

            const existingLayerIds = subLayerIds.filter(id => map.getLayer(id));
            if (existingLayerIds.length === 0) return false;

            if (!loggedLayerIds && import.meta.dev) {
              console.debug(`[layerStore] Querying attributes for ${layer.layerId} using sublayers:`, existingLayerIds);
              loggedLayerIds = true;
            }

            const features = map.queryRenderedFeatures(undefined, { layers: existingLayerIds });
            if (!features || features.length === 0) return false;

            const firstProperties = features[0]?.properties ?? {};
            const attributes = Object.keys(firstProperties);
            if (import.meta.dev) {
              console.debug(`[layerStore] Discovered ${attributes.length} attributes for layer ${layer.layerId}`);
            }

            this.layerAttributes[layer.layerId] = attributes;
            this.saveLayerAttributes();

            const labelStore = useLabelStore();
            if (labelStore.globalLabels.length > 0) {
              this.refreshLayerSource(layer.layerId);
            }

            finish(attributes);
            return true;
          } catch (e) {
            console.warn(`Error querying features for layer ${layer.layerId}:`, e);
            return false;
          }
        };

        if (checkFeatures()) return;

        interval = setInterval(() => {
          attempt += 1;
          if (checkFeatures()) return;

          if (attempt >= 20) {
            console.warn(`Timeout waiting for features in layer ${layer.layerId}`);
            if (!this.layerAttributes[layer.layerId]) {
              this.layerAttributes[layer.layerId] = [];
              this.saveLayerAttributes();
            }
            finish([]);
          }
        }, 1000);
      }).finally(() => {
        pbfAttributeRequests.delete(layer.layerId);
      });

      pbfAttributeRequests.set(layer.layerId, request);
      return request;
    },

    /**
     * Refreshes a single layer's source with current viewparams
     */
    refreshLayerSource(layerId: string) {
      const mapStore = useMapStore();
      const layer = this.geoServerLayers.find(l => l.layerId === layerId);
      if (!mapStore.map || !layer) return;

      const sourceId = layer.sourceId;
      const source = mapStore.map.getSource(sourceId) as any;
      
      if (source && source.tiles) {
        const originalUrl = layer.mvtUrl || '';
        
        // Build new viewparams
        const fragmentStore = useFragmentStore();
        const fragmentsS = fragmentStore.visibleFragments.length > 0 
          ? encodeURIComponent(fragmentStore.visibleFragments.join('_')) 
          : '';
        const fragmentsPart = fragmentsS ? `fragments:${fragmentsS};` : '';
        const fieldsPart = this.getLayerVisibleFields(layer);
        const viewparams = `${fragmentsPart}${fieldsPart}${fieldsPart.endsWith(';') || !fieldsPart ? '' : ';'}nach:2;`;
        
        const separator = originalUrl.includes('?') ? '&' : '?';
        const newTileUrl = `${originalUrl}${separator}viewparams=${viewparams}`;
        
        const prev = Array.isArray(source.tiles) ? source.tiles[0] : '';
        if (prev === newTileUrl) {
          return;
        }

        console.log(`[layerStore] Refreshing source ${sourceId} with params: ${viewparams}`);
        source.tiles = [newTileUrl];
        
        // Clear cache and refresh
        if ((mapStore.map as any).style.sourceCaches[sourceId]) {
          (mapStore.map as any).style.sourceCaches[sourceId].clearTiles();
          (mapStore.map as any).style.sourceCaches[sourceId].update(mapStore.map.transform);
          mapStore.map.triggerRepaint();
        }
      }
    },

    syncLayerVisibility(visibleLayers: string[]) {
      this.visibleGeoServerLayers = visibleLayers;
      this.saveVisibleLayers();
    },

    updateLayerOrder(layerIds: string[]) {
      const mapStore = useMapStore();
      const map = mapStore.map;
      if (!map) return;
      
      const style = map.getStyle();
      if (!style || !style.layers) return;

      // Строим упорядоченный список сублоев
      // layerIds передаётся в порядке снизу вверх (последний = сверху на карте)
      // Сначала собираем нон-точечные, затем точечные — чтобы точки всегда были над линиями
      const pointTypes = new Set(['circle', 'symbol']);
      const nonPointOrder: string[] = [];
      const pointOrder: string[] = [];

      layerIds.forEach(layerId => {
        const relatedLayers = this.getLayerIdsOnMap(layerId);
        const ids = relatedLayers.length > 0 ? relatedLayers : (map.getLayer(layerId) ? [layerId] : []);
        
        ids.forEach(subId => {
          const sublayer = map.getLayer(subId) as any;
          if (sublayer && pointTypes.has(sublayer.type)) {
            pointOrder.push(subId);
          } else if (sublayer) {
            nonPointOrder.push(subId);
          }
        });
      });

      const newLayerOrder = [...nonPointOrder, ...pointOrder];
      
      // Применяем порядок: первый элемент — самый нижний, последний — самый верхний
      for (let i = 0; i < newLayerOrder.length; i++) {
        const layerId = newLayerOrder[i];
        if (map.getLayer(layerId)) {
          try {
            if (i < newLayerOrder.length - 1) {
              map.moveLayer(layerId, newLayerOrder[i + 1]);
            } else {
              map.moveLayer(layerId);
            }
          } catch (e) {
            console.warn(`Could not move layer ${layerId}:`, e);
          }
        }
      }
    },

    saveLayerOrder(layerOrders: { id: string; zIndex: number }[]) {
      for (const { id, zIndex } of layerOrders) {
        const layer = this.geoServerLayers.find(l => l.layerId === id);
        if (layer) layer.zIndex = zIndex;
      }
      localStorage.setItem('layerZIndex', JSON.stringify(layerOrders));
    },

    loadLayerOrder() {
      const saved = localStorage.getItem('layerZIndex');
      if (saved) {
        try {
          const orders: { id: string; zIndex: number }[] = JSON.parse(saved);
          for (const { id, zIndex } of orders) {
            const layer = this.geoServerLayers.find(l => l.layerId === id);
            if (layer) layer.zIndex = zIndex;
          }
        } catch {
          // ignore parse errors
        }
      }
    },

    async convertCircleLayerToSymbol(layerId: string, iconPath: string, size: number) {
      const mapStore = useMapStore();
      const map = mapStore.map;
      if (!map) return;

      const layer = map.getLayer(layerId) as any;
      if (!layer || layer.type !== 'circle') return;

      const source = layer.source;
      const sourceLayer = (layer as any)?.['source-layer'];
      const iconId = `icon-${layerId}`;

      // Load image
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (map.hasImage(iconId)) map.removeImage(iconId);
          map.addImage(iconId, img);
          resolve(true);
        };
        img.onerror = reject;
        img.src = iconPath;
      });

      // Save original style to metadata if not already there
      const metadata = layer.metadata || {};
      if (!metadata.originalType) {
        metadata.originalType = 'circle';
        metadata.originalPaint = {
          'circle-color': map.getPaintProperty(layerId, 'circle-color'),
          'circle-radius': map.getPaintProperty(layerId, 'circle-radius'),
          'circle-opacity': map.getPaintProperty(layerId, 'circle-opacity')
        };
      }
      metadata.iconPath = iconPath;

      // Remove circle layer and add symbol layer
      const filter = map.getFilter(layerId);
      const minzoom = layer.minzoom;
      const maxzoom = layer.maxzoom;

      map.removeLayer(layerId);
      const symbolLayer: any = {
        id: layerId,
        type: 'symbol',
        source,
        'source-layer': sourceLayer,
        minzoom,
        maxzoom,
        metadata,
        layout: {
          'icon-image': iconId,
          'icon-size': size || 0.15,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: {
          'icon-opacity': metadata.originalPaint?.['circle-opacity'] ?? 1
        }
      };

      if (filter) {
        symbolLayer.filter = filter as any;
      }

      map.addLayer(symbolLayer);
      
      // Store style info
      this.layerStyles[layerId] = {
        ...this.layerStyles[layerId],
        icon: { url: iconId, width: 24, height: 24, iconPath }
      };
      this.saveLayerStyles();
    },

    async changeSymbolLayerIcon(layerId: string, iconPath: string, size: number) {
      const mapStore = useMapStore();
      const map = mapStore.map;
      if (!map) return;

      const iconId = `icon-${layerId}`;
      
      // Load image
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (map.hasImage(iconId)) map.removeImage(iconId);
          map.addImage(iconId, img);
          resolve(true);
        };
        img.onerror = reject;
        img.src = iconPath;
      });

      map.setLayoutProperty(layerId, 'icon-image', iconId);
      map.setLayoutProperty(layerId, 'icon-size', size || 0.15);
      
      // Update style info
      this.layerStyles[layerId] = {
        ...this.layerStyles[layerId],
        icon: { url: iconId, width: 24, height: 24, iconPath }
      };
      this.saveLayerStyles();
    },

    async convertSymbolLayerToCircle(layerId: string) {
      const mapStore = useMapStore();
      const map = mapStore.map;
      if (!map) return;

      const layer = map.getLayer(layerId) as any;
      if (!layer || layer.type !== 'symbol') return;

      const metadata = layer.metadata;
      if (!metadata || metadata.originalType !== 'circle') return;

      const source = layer.source;
      const sourceLayer = (layer as any)?.['source-layer'];
      const filter = map.getFilter(layerId);
      const minzoom = layer.minzoom;
      const maxzoom = layer.maxzoom;

      map.removeLayer(layerId);
      const circleLayer: any = {
        id: layerId,
        type: 'circle',
        source,
        'source-layer': sourceLayer,
        minzoom,
        maxzoom,
        paint: metadata.originalPaint || {
          'circle-color': '#ff0000',
          'circle-radius': 5,
          'circle-opacity': 1
        }
      };

      if (filter) {
        circleLayer.filter = filter as any;
      }

      map.addLayer(circleLayer);
      
      // Remove icon from style info
      if (this.layerStyles[layerId]) {
        delete this.layerStyles[layerId].icon;
        this.saveLayerStyles();
      }
    },

    async removeSymbolLayerIcon(layerId: string) {
      const mapStore = useMapStore();
      const map = mapStore.map;
      if (!map) return;

      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'icon-image', '');
      }
      
      // Remove icon from style info
      if (this.layerStyles[layerId]) {
        delete this.layerStyles[layerId].icon;
        this.saveLayerStyles();
      }
    },

    toggleGeoServerLayer(layer: ExtendedLayerConfig | string) {
      const mapStore = useMapStore();
      
      if (!mapStore.map) return;
      
      // Преобразуем входящие данные в LayerConfig и layerId
      let layerConfig: ExtendedLayerConfig;
      let layerId: string;
      
      if (typeof layer === 'string') {
        layerId = layer;
        const foundLayer = this.geoServerLayers.find(l => l.layerId === layerId);
        if (!foundLayer) {
          console.error(`Layer with ID ${layerId} not found`);
          return;
        }
        layerConfig = foundLayer;
      } else {
        layerConfig = layer;
        layerId = layer.layerId;
      }
      
      const isVisible = this.visibleGeoServerLayers.includes(layerId);
      let stackSyncDeferred = false;

      if (isVisible) {
        // Выключаем слой
        this.visibleGeoServerLayers = this.sortVisibleLayerIdsByGeoOrder(
          this.visibleGeoServerLayers.filter((id) => id !== layerId)
        );

        // Скрываем все сублои (включая ${layerId}-0-xxx, ${layerId}-1-xxx и т.д.)
        const subIds = this.getLayerIdsOnMap(layerId);
        const idsToHide = subIds.length > 0 ? subIds : [layerId];
        for (const subId of idsToHide) {
          if (mapStore.map.getLayer(subId)) {
            mapStore.map.setLayoutProperty(subId, 'visibility', 'none');
          }
        }
      } else {
        // Включаем слой
        this.visibleGeoServerLayers.push(layerId);
        this.visibleGeoServerLayers = this.sortVisibleLayerIdsByGeoOrder(this.visibleGeoServerLayers);

        const subIds = this.getLayerIdsOnMap(layerId);
        if (subIds.length > 0) {
          // Проверяем, существует ли хотя бы один сублой на карте
          const existingSubIds = subIds.filter((id) => mapStore.map!.getLayer(id));
          if (existingSubIds.length > 0) {
            // Слои уже на карте — просто делаем их видимыми
            for (const subId of existingSubIds) {
              mapStore.map.setLayoutProperty(subId, 'visibility', 'visible');
            }
            mapStore.applyLayerStyle(layerId, this.layerStyles[layerId] || {});
          } else {
            stackSyncDeferred = true;
            void this.loadLayer(layerConfig)
              .then(() => this.waitForMapIdle())
              .then(() => this.syncMapLayerStackOrder());
          }
        } else if (mapStore.map.getLayer(layerId)) {
          mapStore.map.setLayoutProperty(layerId, 'visibility', 'visible');
          mapStore.applyLayerStyle(layerId, this.layerStyles[layerId] || {});
        } else {
          stackSyncDeferred = true;
          void this.loadLayer(layerConfig)
            .then(() => this.waitForMapIdle())
            .then(() => this.syncMapLayerStackOrder());
        }
      }

      this.saveVisibleLayers();
      if (!stackSyncDeferred) {
        this.syncMapLayerStackOrder();
      }
    },

    updateLayerAttributes(layerId: string, attributes: string[]) {
      this.layerAttributes[layerId] = attributes;
      this.saveLayerAttributes();
    },

    saveLayerAttributes() {
      localStorage.setItem('layerAttributes', JSON.stringify(this.layerAttributes));
    },

    loadLayerAttributes() {
      const saved = localStorage.getItem('layerAttributes');
      if (saved) {
        this.layerAttributes = JSON.parse(saved);
      }
    },

    saveLayerStyles() {
      localStorage.setItem('layerStyles', JSON.stringify(this.layerStyles));
    },

    updateLayerStyle(layerId: string, style: any) {
      if (!this.layerStyles[layerId]) {
        this.layerStyles[layerId] = {};
      }
      this.layerStyles[layerId] = { ...this.layerStyles[layerId], ...style };
      this.saveLayerStyles();
    },

    getLayerVisibleFields(layer: ExtendedLayerConfig): string {
      const labelStore = useLabelStore();
      const globalLabels = labelStore.globalLabels;
      if (!globalLabels || globalLabels.length === 0) return '';

      // If we have cached attributes for this layer, filter the global labels
      const cachedAttrs = this.layerAttributes[layer.layerId];
      if (cachedAttrs && cachedAttrs.length > 0) {
        // Convert cachedAttrs to lowercase for case-insensitive matching
        const attrSet = new Set(cachedAttrs.map(a => a.toLowerCase()));
        
        console.log(`[layerStore] Filtering ${globalLabels.length} labels for ${layer.layerId} against ${cachedAttrs.length} cached attrs`);
        
        // Filter global labels to only those present in the PBF attributes
        const filtered = globalLabels.filter(label => {
          const l = label.toLowerCase();
          const match = attrSet.has(l) || attrSet.has(label);
          if (match) console.log(`[layerStore]   Label ${label} MATCHED for ${layer.layerId}`);
          return match;
        });

        console.log(`[layerStore] Filtered results for ${layer.layerId}: ${filtered.length}/${globalLabels.length}`);
        return filtered.map(f => `${f}:on`).join(';');
      }

      // Пустой массив = таймаут/не удалось прочитать PBF — фолбэк как раньше (все подписи)
      if (Array.isArray(cachedAttrs) && cachedAttrs.length === 0) {
        console.warn(`[layerStore] No PBF attrs for ${layer.layerId}, using all ${globalLabels.length} global labels in viewparams`);
        return globalLabels.map(f => `${f}:on`).join(';');
      }

      // Атрибуты ещё не известны — не подмешиваем все globalLabels в первый запрос viewparams
      console.warn(`[layerStore] PBF attrs not yet known for ${layer.layerId}; omitting label fields in viewparams until discovery`);
      return '';
    },

    saveVisibleLayers() {
      localStorage.setItem('visibleGeoServerLayers', JSON.stringify(this.visibleGeoServerLayers));
    },

    loadLayerStyles() {
      const savedStyles = localStorage.getItem('layerStyles');
      if (savedStyles) {
        this.layerStyles = JSON.parse(savedStyles);
        }
    },

    applyFragmentFilter() {
      const mapStore = useMapStore();
      const fragmentStore = useFragmentStore();
      if (!mapStore.map) return;

      // Build fragment filter using MapLibre legacy syntax for MVT: ["in", "propertyName", v0, v1, ...]
      const fileIdVariants = ['fileID', 'fileid', 'fileId', 'FILEID', 'FileId', 'file_id', 'FILE_ID'];
      let fragmentFilter: any[] | null = null;
      let cqlFilterStr: string | undefined = undefined;
      
      if (fragmentStore.visibleFragments.length > 0) {
        // Include both number and string versions of each fragment ID
        const ids = fragmentStore.visibleFragments;
        const strIds = ids.map(id => String(id));
        const numIds = ids.map(id => Number(id));
        const allIds = [...new Set([...numIds, ...strIds])];
        
        fragmentFilter = ['any', ...fileIdVariants.map(variant => [
          'in', variant, ...allIds
        ])];
        
        // Build CQL string: only use "fileid" since GeoServer throws errors for nonexistent columns
        cqlFilterStr = `"fileid" IN (${allIds.map(id => `'${id}'`).join(',')})`;
      }

      const { updateWmsLayer } = useWmsLayer();

      // Apply filter to each visible GeoServer layer appropriately based on renderFormat
      for (const layer of this.geoServerLayers) {
        if (layer.renderFormat === 'wms') {
          // WMS layers use VIEWPARAMS via source URL recreation
          const sourceId = layer.sourceId;
          const mapLayerId = layer.layerId;
          
          if (mapStore.map.getSource(sourceId)) {
            const labelStore = useLabelStore();
            const fragmentStore = useFragmentStore();
            
            const fragmentsS = fragmentStore.visibleFragments.length > 0 
              ? encodeURIComponent(fragmentStore.visibleFragments.join('_')) 
              : '';
            const fragmentsPart = fragmentsS ? `fragments:${fragmentsS};` : '';
            const fieldsPart = this.getLayerVisibleFields(layer);
            const viewparams = `${fragmentsPart}${fieldsPart}${fieldsPart.endsWith(';') || !fieldsPart ? '' : ';'}nach:2;`;

            updateWmsLayer(mapStore.map as any, sourceId, mapLayerId, {
              workspace: layer.workspace || 'AlmatyGIS',
              layerName: layer.sourceLayer,
              viewParams: {
                viewparams: viewparams // This will be encoded in createWmsTileUrl
              } as any
            });
            // Re-apply styles (like opacity) after recreating layer
            const savedStyles = this.layerStyles[mapLayerId];
            if (savedStyles) {
               mapStore.applyLayerStyle(mapLayerId, savedStyles);
            }
          }
        } else {
          // MVT layers: Support server-side filtering via viewparams AND client-side filtering via setFilter
          const sourceId = layer.sourceId;
          if (mapStore.map.getSource(sourceId)) {
             // In MapLibre, we must update the 'tiles' property. 
             // Simplest way is to remove and re-add the layer/source, but loadLayer already handles checking exists.
             // We'll update the Tile source if possible, or trigger reload.
             const labelStore = useLabelStore();
             const fragmentStore = useFragmentStore();
             
             const fragmentsS = fragmentStore.visibleFragments.length > 0 
                ? encodeURIComponent(fragmentStore.visibleFragments.join('_')) 
                : '';
             const fragmentsPart = fragmentsS ? `fragments:${fragmentsS};` : '';
             const fieldsPart = this.getLayerVisibleFields(layer);
             const viewparams = `${fragmentsPart}${fieldsPart}${fieldsPart.endsWith(';') || !fieldsPart ? '' : ';'}nach:2;`;
             
             const source = mapStore.map.getSource(sourceId) as any;
             if (source && source.tiles) {
                const originalUrl = layer.mvtUrl || '';
                
                // CRITICAL: Don't use URL object as it encodes {z}/{x}/{y} placeholders
                const separator = originalUrl.includes('?') ? '&' : '?';
                const newTileUrl = `${originalUrl}${separator}viewparams=${viewparams}`;
                
                const prev = Array.isArray(source.tiles) ? source.tiles[0] : '';
                if (prev !== newTileUrl) {
                  source.tiles = [newTileUrl];
                  if ((mapStore.map as any).style.sourceCaches[sourceId]) {
                    (mapStore.map as any).style.sourceCaches[sourceId].clearTiles();
                    (mapStore.map as any).style.sourceCaches[sourceId].update(mapStore.map.transform);
                    mapStore.map.triggerRepaint();
                  }
                }
             }
          }

          const subLayerIds = mapStore.getLayerIdsOnMap(layer.layerId);

          for (const subId of subLayerIds) {
            if (!mapStore.map.getLayer(subId)) continue;

            // Always start from the original MBStyle filter to avoid recursive nesting
            const mbLayer = layer.mbLayers?.find((_: any, idx: number) =>
              subId === `${layer.layerId}-${idx}-${(layer.mbLayers![idx] as any)?.id || 'layer'}`
              || subId === layer.layerId
            );
            const originalFilter = mbLayer?.filter || null;

            const isSymbol = mbLayer?.type === 'symbol' || subId.toLowerCase().includes('label');

            if (fragmentFilter && !isSymbol) {
              const combined = originalFilter
                ? (['all', originalFilter, fragmentFilter] as any)
                : (fragmentFilter as any);
              mapStore.map.setFilter(subId, combined);
            } else {
              mapStore.map.setFilter(subId, originalFilter);
            }
          }

          // Apply to labels too (MVT only)
          const labelStore = useLabelStore();
          labelStore.applyFragmentFilterToLabels(layer.layerId, fragmentFilter as any || ['all']);
        }
      }
    },

    toggleLayerCaching(layerId: string) {
      const index = this.cachingEnabledLayers.indexOf(layerId);
      if (index === -1) {
        this.cachingEnabledLayers.push(layerId);
      } else {
        this.cachingEnabledLayers.splice(index, 1);
      }
      this.saveCachingSettings();
    },

    saveCachingSettings() {
      localStorage.setItem('cachingEnabledLayers', JSON.stringify(this.cachingEnabledLayers));
    },

    loadCachingSettings() {
      const saved = localStorage.getItem('cachingEnabledLayers');
      if (saved) {
        this.cachingEnabledLayers = JSON.parse(saved);
      } else {
        // По умолчанию кэширование включено для всех MVT слоев
        this.cachingEnabledLayers = this.geoServerLayers.map(l => l.layerId);
        this.saveCachingSettings();
      }
    },

    isLayerCachingEnabled(layerId: string): boolean {
      return this.cachingEnabledLayers.includes(layerId);
    },

    getLayerIdsOnMap(layerId: string): string[] {
      const mapStore = useMapStore();
      const map = mapStore.map;
      if (!map) return [layerId];
      
      const style = map.getStyle();
      if (!style || !style.layers) return [layerId];
      
      // Находим все слои, ID которых начинается с layerId или содержит его
      // (для учета технических слоев вроде layerId-labels, layerId-symbol-icon и т.д.)
      return style.layers
        .filter((l: any) => l.id === layerId || l.id.startsWith(`${layerId}-`))
        .map((l: any) => l.id);
    }
  },

  getters: {
    getGeoServerLayers: (state) => state.geoServerLayers,
    getVisibleGeoServerLayers: (state) => state.visibleGeoServerLayers,
    getWmsLayers: (state) => state.wmsLayers,
    getVisibleWmsLayers: (state) => state.visibleWmsLayers,
  },
}); 