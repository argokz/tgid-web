import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import type {
  Map as MapLibreMap,
  StyleSpecification,
  PopupOptions,
  MapMouseEvent,
  LngLat,
  MapGeoJSONFeature,
} from 'maplibre-gl';
import { getMaplibreDefault } from '~/utils/maplibreLoader';
import type { LayerConfig, FeatureData, ExtendedLayerConfig } from '~/types';
import { fastApiService } from '~/services/fastApiService';

import { useGeoServer } from '~/composables/useGeoServer';
import { useLayerStore } from '~/stores/layerStore';
import { useLabelStore, TECHNICAL_LABELS } from '~/stores/labelStore';
import { usePopupStore } from '~/stores/popupStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { getDefaultPaint } from '~/server/config/layer-types';
import { escapeHtml } from '~/utils/escapeHtml';
import {
  getMapTilerGlyphsUrl,
  getMapTilerHybridTilesUrl,
  getMapTilerKey,
  getMapTilerStreetsTilesUrl,
  getMapTilerTilesUrl
} from '~/utils/maptiler';
import {
  getAllContextMapLayerIds,
  getPlanetLayersInsertBeforeId,
  isContextMapLayerId,
  restackPlanetLayersBelowOverlays,
} from '~/utils/contextMapLayers';
import {
  PLANET_V4_LAYERS,
  PLANET_V4_SOURCE_PAINT_ORDER,
  applyPlanetLayerStyleOverride,
  getPlanetLayerDef,
  getPlanetMapLayerInsertBeforeId,
  type PlanetLayerStyleOverride,
} from '~/utils/planetV4Layers';

interface LayerStyle {
  color: string;
  opacity: number;
  lineWidth?: number;
  circleRadius?: number;
  outlineColor?: string;
  icon?: {
    url: string;
    width: number;
    height: number;
  };
  dynamicStyles?: Record<string, any>;
}

export const useMapStore = defineStore('map', {
  state: () => ({
    map: null as any,
    popup: null as any,
    highlightedFeature: null as string | null,
    _attributePanelShow: null as ((properties: Record<string, any>) => void) | null,
    // Diagnostics Fault Layers
    isDefectsLayerVisible: false,
    isCorrosionLayerVisible: false,
    // Calculation Diagnostics
    activeCalculationId: null as number | null,
    calculationColorMode: 'pressure_drop' as 'pressure_drop' | 'velocity',
    calculationResultsGeoJSON: null as any,
    baseLayers: [
      { id: 'stadia', label: 'Stadia Maps (OSM Bright)' },
      { id: 'osm', label: 'OpenStreetMap' },
      { id: 'streets-v4', label: 'Подробная карта улиц (MapTiler Streets v4)' },
      { id: 'planet-v4', label: 'MapTiler Planet v4 (zoom 0-15)' },
      { id: 'hybrid-v4', label: 'Спутниковая карта (MapTiler Hybrid v4)' },
      { id: 'google', label: 'Google Maps' },
      { id: 'dg', label: '2GIS' },
    ],
    selectedBaseLayer: 'stadia',

    osmSource: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      minzoom: 0,
      maxzoom: 19,
    },
    mapTilerSource: {
      type: 'raster' as const,
      tiles: [getMapTilerTilesUrl()],
      tileSize: 256,
      attribution: '© MapTiler © OpenStreetMap contributors',
      minzoom: 0,
      maxzoom: 22,
    },
    googleSource: {
      type: 'raster' as const,
      tiles: ['https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'],
      tileSize: 256,
      attribution: '© Google',
      minzoom: 0,
      maxzoom: 22,
    },
    dgSource: {
      type: 'raster' as const,
      tiles: [
        'https://tile0.maps.2gis.com/tiles?x={x}&y={y}&z={z}',
        'https://tile1.maps.2gis.com/tiles?x={x}&y={y}&z={z}',
        'https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}',
        'https://tile3.maps.2gis.com/tiles?x={x}&y={y}&z={z}'
      ],
      tileSize: 256,
      attribution: '© 2GIS',
      minzoom: 0,
      maxzoom: 18,
    },
    mapTilerStreetsSource: {
      type: 'raster' as const,
      tiles: [getMapTilerStreetsTilesUrl()],
      tileSize: 256,
      attribution: '© MapTiler © OpenStreetMap contributors',
      minzoom: 0,
      maxzoom: 22,
    },
    mapTilerHybridSource: {
      type: 'raster' as const,
      tiles: [getMapTilerHybridTilesUrl()],
      tileSize: 256,
      attribution: '© MapTiler',
      minzoom: 0,
      maxzoom: 22,
    },
    baseLayerId: 'base-layer',
    baseSourceId: 'base-source',
    planetBaseSourceId: 'base-planet-source',
    planetBaseLayerIds: [] as string[],
    visiblePlanetLayers: [] as string[],
    planetLayerStyleOverrides: {} as Record<string, PlanetLayerStyleOverride>,
    layerStyles: {} as Record<string, any>,
    selectedFeatureData: null as FeatureData | null,
    objectDataLoading: false,
    handleMapClickBound: null as any,
    handleMouseMoveBound: null as any,
    hoverLayerIdsCache: [] as string[],
    hoverLayerIdsCacheKey: '',
    lastHoverQueryAt: 0,
    hoverThrottleMs: 90,
    contextHoverInspectEnabled: false,
    contextHoverPopup: null as any,
    identifyRequestId: 0,
    identifyModeEnabled: true,

    // Feature Selection Menu state
    potentialFeatures: [] as any[],
    featureMenuVisible: false,
    featureMenuPosition: { x: 0, y: 0 },
  }),

  actions: {
    loadSelectedBaseLayer() {
      const savedLayer = localStorage.getItem('selectedBaseLayer') || localStorage.getItem('baseLayer');
      if (!savedLayer) return;
      const hasLayer = this.baseLayers.some((layer: { id: string }) => layer.id === savedLayer);
      if (hasLayer) {
        this.selectedBaseLayer = savedLayer;
      }
    },

    async initializeMap(containerId: string): Promise<void> {
      if (this.map) {
        if (import.meta.dev) console.debug('Map already initialized, cleaning up...');
        this.cleanup();
      }

      if (import.meta.dev) console.debug('Initializing map in container:', containerId);

      const maplibregl = await getMaplibreDefault();

      return new Promise<void>((resolve) => {
      this.map = markRaw(new maplibregl.Map({
        container: containerId,
        /** Компактная атрибуция — меньше переносов текста и CLS от блока © MapLibre/OSM */
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {},
          layers: [],
          glyphs: getMapTilerGlyphsUrl()
        } as StyleSpecification,
        center: [76.946, 43.222],
        zoom: 12,
        transformRequest: (url, resourceType) => {
          if (resourceType === 'Tile' || resourceType === 'Source') {
            const layerStore = useLayerStore();
            // Проверяем кэширование для MVT слоев GeoServer
            if (url.includes('/geoserver/')) {
               // Пытаемся извлечь layerId из URL или сопоставить
               const urlObj = new URL(url);
               const fullLayerName = urlObj.searchParams.get('LAYER') || urlObj.searchParams.get('LAYERS');
               
               if (fullLayerName) {
                 // Отрезаем workspace (например, "Almaty2:")
                 const sourceLayer = fullLayerName.includes(':') ? fullLayerName.split(':')[1] : fullLayerName;
                 
                 // Находим соответствующий слой в сторе
                 const layer = layerStore.geoServerLayers.find(l => 
                   l.sourceLayer === sourceLayer || 
                   l.layerName === sourceLayer || 
                   l.sourceLayer === fullLayerName
                 );
                 
                 if (layer && !layerStore.isLayerCachingEnabled(layer.id)) {
                    return {
                      url: url,
                      headers: { 'Cache-Control': 'no-cache' }
                    };
                 }
               }
            }
          }
          return { url };
        }
      }));

      this.map.on('load', async () => {
        if (import.meta.dev) console.debug('Map loaded event triggered');
        this.loadSelectedBaseLayer();
        useLayerStore().loadVisibleContextLayers();
        await this.addBaseLayer();
        this.loadLayerStyles();

        this.setupEventListeners();

        // Initialize other stores
        const labelStore = useLabelStore();
        const popupStore = usePopupStore();
        
        popupStore.setMap(this.map as any);
        labelStore.loadLayerLabels();
        resolve();
      });
      });
    },

    setupEventListeners() {
      if (!this.map) return;
      
      this.handleMapClickBound = (e: MapMouseEvent) => this.handleMapClick(e);
      this.handleMouseMoveBound = (e: MapMouseEvent) => this.handleMouseMove(e);

      this.map.on('click', this.handleMapClickBound);
      this.map.on('mousemove', this.handleMouseMoveBound);
    },

    async addBaseLayer() {
      if (!this.map) return;

      if (this.map.getLayer(this.baseLayerId)) this.map.removeLayer(this.baseLayerId);
      if (this.map.getSource(this.baseSourceId)) this.map.removeSource(this.baseSourceId);
      this.removePlanetBaseLayers();

      if (this.selectedBaseLayer === 'planet-v4') {
        await this.addPlanetVectorBaseLayer();
        return;
      }

      let source;
      switch (this.selectedBaseLayer) {
        case 'osm': source = this.osmSource; break;
        case 'streets-v4':
          source = getMapTilerKey() ? this.mapTilerStreetsSource : this.osmSource;
          break;
        case 'hybrid-v4':
          source = getMapTilerKey() ? this.mapTilerHybridSource : this.osmSource;
          break;
        case 'google': source = this.googleSource; break;
        case 'dg':
        case '2gis': source = this.dgSource; break;
        case 'stadia':
        default:
          source = getMapTilerKey() ? this.mapTilerSource : this.osmSource;
          break;
      }
      
      this.map.addSource(this.baseSourceId, source);
      const firstNonBaseLayer = this.map
        .getStyle()
        .layers.find((layer: any) => layer.id !== this.baseLayerId);
      this.map.addLayer({
        id: this.baseLayerId,
        type: 'raster',
        source: this.baseSourceId,
        minzoom: 0,
        maxzoom: 22,
      }, firstNonBaseLayer?.id);

      useLayerStore().syncContextLayersToMap();
    },

    removePlanetBaseLayers() {
      if (!this.map) return;
      const styleLayers = this.map.getStyle()?.layers || [];
      for (const layer of [...styleLayers].reverse()) {
        if (layer.id.startsWith('base-planet-') && this.map.getLayer(layer.id)) {
          this.map.removeLayer(layer.id);
        }
      }
      if (this.map.getSource(this.planetBaseSourceId)) {
        this.map.removeSource(this.planetBaseSourceId);
      }
      this.planetBaseLayerIds = [];
    },

    async addPlanetVectorBaseLayer() {
      if (!this.map) return;
      if (!getMapTilerKey()) return;

      this.loadVisiblePlanetLayers();

      const firstExistingLayerId = this.map.getStyle()?.layers?.[0]?.id;
      this.map.addLayer({
        id: this.baseLayerId,
        type: 'background',
        paint: { 'background-color': '#f0ede6' },
      }, firstExistingLayerId);

      this.map.addSource(this.planetBaseSourceId, {
        type: 'vector',
        tiles: [`https://api.maptiler.com/tiles/v4/{z}/{x}/{y}.pbf?key=${getMapTilerKey()}`],
        maxzoom: 15,
      });

      const addedIds: string[] = [];
      const visibleSet = new Set(this.visiblePlanetLayers);
      const insertBefore = getPlanetLayersInsertBeforeId(this.map as any);
      const specsToAdd: any[] = [];
      for (const sl of PLANET_V4_SOURCE_PAINT_ORDER) {
        if (!visibleSet.has(sl)) continue;
        const def = getPlanetLayerDef(sl);
        if (!def) continue;
        for (const spec of def.buildLayers(this.planetBaseSourceId)) {
          specsToAdd.push(spec);
        }
      }

      let anchor: string | undefined = insertBefore;
      for (let i = specsToAdd.length - 1; i >= 0; i -= 1) {
        const spec = specsToAdd[i];
        try {
          const layerSpec = { ...spec, source: this.planetBaseSourceId };
          if (anchor) this.map.addLayer(layerSpec as any, anchor);
          else this.map.addLayer(layerSpec as any);
          addedIds.push(spec.id!);
          anchor = spec.id;
        } catch (err) {
          if (import.meta.dev) console.warn('[mapStore] planet layer skip:', spec.id, err);
        }
      }

      this.planetBaseLayerIds = addedIds;
      if (import.meta.dev) {
        console.debug(`[mapStore] planet-v4: ${addedIds.length} layers added`);
      }
      useLayerStore().syncContextLayersToMap();
      restackPlanetLayersBelowOverlays(this.map as any);
      this.applyAllPlanetStyleOverrides();
    },

    loadVisiblePlanetLayers() {
      const PLANET_PREFS_VERSION = 2;
      const ver = localStorage.getItem('visiblePlanetLayers_v');
      const saved = localStorage.getItem('visiblePlanetLayers');
      if (saved && ver === String(PLANET_PREFS_VERSION)) {
        try {
          this.visiblePlanetLayers = JSON.parse(saved);
          this.loadPlanetLayerStyleOverrides();
          return;
        } catch { /* use defaults */ }
      }
      this.visiblePlanetLayers = PLANET_V4_LAYERS
        .filter((d) => d.defaultVisible)
        .map((d) => d.sourceLayer);
      this.saveVisiblePlanetLayers();
      this.loadPlanetLayerStyleOverrides();
    },

    saveVisiblePlanetLayers() {
      localStorage.setItem('visiblePlanetLayers', JSON.stringify(this.visiblePlanetLayers));
      localStorage.setItem('visiblePlanetLayers_v', '2');
    },

    loadPlanetLayerStyleOverrides() {
      try {
        const raw = localStorage.getItem('planetLayerStyleOverrides');
        this.planetLayerStyleOverrides = raw ? JSON.parse(raw) : {};
      } catch {
        this.planetLayerStyleOverrides = {};
      }
    },

    savePlanetLayerStyleOverrides() {
      localStorage.setItem('planetLayerStyleOverrides', JSON.stringify(this.planetLayerStyleOverrides));
    },

    applyAllPlanetStyleOverrides() {
      if (!this.map || this.selectedBaseLayer !== 'planet-v4') return;
      for (const sl of this.visiblePlanetLayers) {
        const o = this.planetLayerStyleOverrides[sl];
        if (!o || (!o.color && o.opacity == null && o.textSize == null)) continue;
        const def = getPlanetLayerDef(sl);
        if (!def) continue;
        applyPlanetLayerStyleOverride(this.map as any, this.planetBaseSourceId, def, o);
      }
    },

    setPlanetLayerStyleOverride(sourceLayer: string, patch: Partial<PlanetLayerStyleOverride> | null) {
      if (patch === null) {
        delete this.planetLayerStyleOverrides[sourceLayer];
      } else {
        this.planetLayerStyleOverrides = {
          ...this.planetLayerStyleOverrides,
          [sourceLayer]: { ...this.planetLayerStyleOverrides[sourceLayer], ...patch },
        };
      }
      this.savePlanetLayerStyleOverrides();
      if (!this.map || this.selectedBaseLayer !== 'planet-v4') return;
      const def = getPlanetLayerDef(sourceLayer);
      if (!def) return;
      const merged = this.planetLayerStyleOverrides[sourceLayer];
      if (!merged || (!merged.color && merged.opacity == null && merged.textSize == null)) {
        this.refreshPlanetLayerPaintDefaults(sourceLayer);
        return;
      }
      applyPlanetLayerStyleOverride(this.map as any, this.planetBaseSourceId, def, merged);
    },

    /** Сброс кастомных paint/layout для логического слоя: пересоздать слои из спецификации. */
            async loadCalculation(calculationId: number | null) {
      this.activeCalculationId = calculationId;
      if (!this.map) return;

      if (calculationId === null) {
        if (this.map.getLayer('calculation-lines-layer')) {
          this.map.setLayoutProperty('calculation-lines-layer', 'visibility', 'none');
        }
        this.calculationResultsGeoJSON = null;
        return;
      }

      try {
        const data = await fastApiService.getCalculationResultsGeoJSON(calculationId);
        this.calculationResultsGeoJSON = data;

        if (!this.map.getSource('calculation-source')) {
          this.map.addSource('calculation-source', { type: 'geojson', data });
          this.map.addLayer({
            id: 'calculation-lines-layer',
            type: 'line',
            source: 'calculation-source',
            paint: {
              'line-width': 4,
              'line-color': [
                'interpolate',
                ['linear'],
                ['get', this.calculationColorMode],
                0, '#00ff00',
                0.5, '#ffff00',
                1.0, '#ff0000',
                5.0, '#8b0000'
              ]
            }
          });
          
          // Add hover interaction for calculation lines
          this.map.on('mouseenter', 'calculation-lines-layer', () => {
            this.map.getCanvas().style.cursor = 'pointer';
          });
          this.map.on('mouseleave', 'calculation-lines-layer', () => {
            this.map.getCanvas().style.cursor = '';
          });
          this.map.on('click', 'calculation-lines-layer', (e: any) => {
            if (e.features && e.features.length > 0 && this._attributePanelShow) {
              const feature = e.features[0];
              this._attributePanelShow({
                id: feature.properties.id,
                layer_id: 'line-layer',
                ...feature.properties,
                _isCalculationResult: true
              });
            }
          });
        } else {
          (this.map.getSource('calculation-source') as maplibregl.GeoJSONSource).setData(data);
          this.map.setLayoutProperty('calculation-lines-layer', 'visibility', 'visible');
          this.updateCalculationColors();
        }
      } catch (e) {
        console.error('Failed to load calculation results', e);
      }
    },

    updateCalculationColors() {
      if (!this.map || !this.map.getLayer('calculation-lines-layer')) return;
      
      const maxVal = this.calculationColorMode === 'pressure_drop' ? 5.0 : 3.0; // arbitrary max for coloring
      
      this.map.setPaintProperty('calculation-lines-layer', 'line-color', [
        'interpolate',
        ['linear'],
        ['get', this.calculationColorMode],
        0, '#00ff00',       // Green for 0
        maxVal * 0.2, '#ffff00', // Yellow
        maxVal * 0.6, '#ff0000', // Red
        maxVal, '#8b0000'        // Dark red
      ]);
    },

    async toggleDefectsLayer() {
      if (!this.map) return;
      if (this.isDefectsLayerVisible) {
        if (!this.map.getSource('defects-source')) {
          try {
            const data = await fastApiService.getDefectsGeoJSON();
            this.map.addSource('defects-source', { type: 'geojson', data });
            this.map.addLayer({
              id: 'defects-layer',
              type: 'circle',
              source: 'defects-source',
              paint: {
                'circle-radius': 6,
                'circle-color': '#e65100', // red-orange
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
              }
            });
            // Click handler is handled in MapViewer
          } catch (e) {
            console.error('Failed to load defects GeoJSON', e);
          }
        } else {
          this.map.setLayoutProperty('defects-layer', 'visibility', 'visible');
        }
      } else {
        if (this.map.getLayer('defects-layer')) {
          this.map.setLayoutProperty('defects-layer', 'visibility', 'none');
        }
      }
    },

    async toggleCorrosionLayer() {
      if (!this.map) return;
      if (this.isCorrosionLayerVisible) {
        if (!this.map.getSource('corrosion-source')) {
          try {
            const data = await fastApiService.getCorrosionIndicatorsGeoJSON();
            this.map.addSource('corrosion-source', { type: 'geojson', data });
            this.map.addLayer({
              id: 'corrosion-layer',
              type: 'circle',
              source: 'corrosion-source',
              paint: {
                'circle-radius': 6,
                'circle-color': '#ffb300', // amber/yellow
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
              }
            });
          } catch (e) {
            console.error('Failed to load corrosion GeoJSON', e);
          }
        } else {
          this.map.setLayoutProperty('corrosion-layer', 'visibility', 'visible');
        }
      } else {
        if (this.map.getLayer('corrosion-layer')) {
          this.map.setLayoutProperty('corrosion-layer', 'visibility', 'none');
        }
      }
    },

    refreshPlanetLayerPaintDefaults(sourceLayer: string) {
      if (!this.map || this.selectedBaseLayer !== 'planet-v4') return;
      const def = getPlanetLayerDef(sourceLayer);
      if (!def) return;
      const visible = this.visiblePlanetLayers.includes(sourceLayer);
      if (!visible) return;
      for (const spec of def.buildLayers(this.planetBaseSourceId)) {
        if (this.map.getLayer(spec.id!)) this.map.removeLayer(spec.id!);
        this.planetBaseLayerIds = this.planetBaseLayerIds.filter((id) => id !== spec.id!);
      }
      for (const spec of def.buildLayers(this.planetBaseSourceId)) {
        const beforeId =
          getPlanetMapLayerInsertBeforeId(this.map as any, spec.id!) ??
          getPlanetLayersInsertBeforeId(this.map as any);
        try {
          const layerSpec = { ...spec, source: this.planetBaseSourceId };
          if (beforeId) this.map.addLayer(layerSpec as any, beforeId);
          else this.map.addLayer(layerSpec as any);
          this.planetBaseLayerIds.push(spec.id!);
        } catch (err) {
          if (import.meta.dev) console.warn('[mapStore] planet refresh skip:', spec.id, err);
        }
      }
      restackPlanetLayersBelowOverlays(this.map as any);
    },

    resetPlanetLayerStyle(sourceLayer: string) {
      delete this.planetLayerStyleOverrides[sourceLayer];
      this.savePlanetLayerStyleOverrides();
      this.refreshPlanetLayerPaintDefaults(sourceLayer);
    },

    ensurePlanetLayerOnMap(def: (typeof PLANET_V4_LAYERS)[number]) {
      if (!this.map || !this.map.getSource(this.planetBaseSourceId)) return;
      for (const spec of def.buildLayers(this.planetBaseSourceId)) {
        if (this.map.getLayer(spec.id!)) continue;
        const beforeId =
          getPlanetMapLayerInsertBeforeId(this.map as any, spec.id!) ??
          getPlanetLayersInsertBeforeId(this.map as any);
        try {
          const layerSpec = { ...spec, source: this.planetBaseSourceId };
          if (beforeId) this.map.addLayer(layerSpec as any, beforeId);
          else this.map.addLayer(layerSpec as any);
          if (!this.planetBaseLayerIds.includes(spec.id!)) {
            this.planetBaseLayerIds.push(spec.id!);
          }
        } catch (err) {
          if (import.meta.dev) console.warn('[mapStore] planet lazy-add skip:', spec.id, err);
        }
      }
      restackPlanetLayersBelowOverlays(this.map as any);
      const o = this.planetLayerStyleOverrides[def.sourceLayer];
      if (o && (o.color || o.opacity != null || o.textSize != null)) {
        applyPlanetLayerStyleOverride(this.map as any, this.planetBaseSourceId, def, o);
      }
    },

    removePlanetLayerFromMap(def: (typeof PLANET_V4_LAYERS)[number]) {
      if (!this.map) return;
      for (const spec of def.buildLayers(this.planetBaseSourceId)) {
        if (this.map.getLayer(spec.id!)) {
          this.map.removeLayer(spec.id!);
          this.planetBaseLayerIds = this.planetBaseLayerIds.filter((id) => id !== spec.id!);
        }
      }
    },

    setPlanetLayerVisible(sourceLayer: string, visible: boolean) {
      const set = new Set(this.visiblePlanetLayers);
      if (visible) set.add(sourceLayer); else set.delete(sourceLayer);
      this.visiblePlanetLayers = [...set];
      this.saveVisiblePlanetLayers();

      if (!this.map || this.selectedBaseLayer !== 'planet-v4') return;
      const def = PLANET_V4_LAYERS.find((d) => d.sourceLayer === sourceLayer);
      if (!def) return;
      if (visible) {
        this.ensurePlanetLayerOnMap(def);
      } else {
        this.removePlanetLayerFromMap(def);
      }
    },

    setPlanetGroupVisible(sourceLayers: string[], visible: boolean) {
      const set = new Set(this.visiblePlanetLayers);
      for (const sl of sourceLayers) {
        if (visible) set.add(sl); else set.delete(sl);
      }
      this.visiblePlanetLayers = [...set];
      this.saveVisiblePlanetLayers();

      if (!this.map || this.selectedBaseLayer !== 'planet-v4') return;
      for (const sl of sourceLayers) {
        const def = PLANET_V4_LAYERS.find((d) => d.sourceLayer === sl);
        if (!def) continue;
        if (visible) {
          this.ensurePlanetLayerOnMap(def);
        } else {
          this.removePlanetLayerFromMap(def);
        }
      }
    },

    getBaseHoverInspectLayerIds(): string[] {
      if (!this.map || this.selectedBaseLayer !== 'planet-v4') return [];
      return this.planetBaseLayerIds.filter((id) => Boolean(this.map?.getLayer(id)));
    },

    async updateBaseLayer(newBaseLayer: string) {
      if (!this.map || this.selectedBaseLayer === newBaseLayer) return;
      this.selectedBaseLayer = newBaseLayer;
      await this.addBaseLayer();
      localStorage.setItem('selectedBaseLayer', newBaseLayer);
      localStorage.setItem('baseLayer', newBaseLayer);
    },

    selectBaseLayer(layerId: string) {
      return this.updateBaseLayer(layerId);
    },

    cleanup() {
      if (this.map) {
        this.map.remove();
        this.map = null;
      }
      if (this.contextHoverPopup) {
        this.contextHoverPopup.remove();
        this.contextHoverPopup = null;
      }
      if (this.popup) {
        this.popup.remove();
        this.popup = null;
      }
    },

    async handleMapClick(e: MapMouseEvent) {
      if (!this.identifyModeEnabled) return;
      this.identifyFeature(e);
    },

    async identifyFeature(e: MapMouseEvent) {
      if (!this.map) return;
      const layerStore = useLayerStore();
      const requestId = ++this.identifyRequestId;
      
      // Clear previous states
      this.featureMenuVisible = false;
      this.potentialFeatures = [];
      this.featureMenuPosition = { x: e.point.x, y: e.point.y };

      if (this.popup) {
        this.popup.remove();
        this.popup = null;
      }
      
      const allFoundFeatures: any[] = [];

      // 1. Identify MVT features
      const allVisibleLayerIds: string[] = [];
      for (const rootId of layerStore.visibleGeoServerLayers) {
        const layerConfig = layerStore.geoServerLayers.find(l => l.layerId === rootId);
        if (layerConfig?.renderFormat === 'wms') continue;
        const subIds = this.getIdentifyLayerIdsOnMap(rootId);
        allVisibleLayerIds.push(...subIds);
      }
      
      if (allVisibleLayerIds.length > 0) {
        const uniqueLayerIds = [...new Set(allVisibleLayerIds)].filter(
          (id) => Boolean(this.map?.getLayer(id)) && !isContextMapLayerId(id)
        );
        if (uniqueLayerIds.length > 0) {
          const mvtFeatures = this.map.queryRenderedFeatures(e.point, { layers: uniqueLayerIds });
          mvtFeatures.forEach((f: any) => {
            allFoundFeatures.push(this.normalizeFeatureForState({
              ...f,
              sourceType: 'mvt'
            }));
          });
        }
      }
      
      // 2. Identify WMS features with bounded timeout
      const { getFeatureInfo } = useGeoServer();
      const bounds = this.map.getBounds();
      const container = this.map.getContainer();
      const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      const fragmentStore = useFragmentStore();
      const activeFragments = fragmentStore.visibleFragments.map(id => String(id));

      const wmsIdentifyTargets: Array<{
        key: string;
        workspaceId?: string;
        workspaceName?: string;
        layerName?: string;
        title?: string;
      }> = [];

      for (const layerId of layerStore.visibleWmsLayers) {
        const wmsLayer = layerStore.wmsLayers.find(l => l.id === layerId);
        if (!wmsLayer) continue;
        const resolvedLayerName = wmsLayer.layerName;
        const resolvedWorkspaceId = wmsLayer.workspace || wmsLayer.id;
        if (!resolvedLayerName || !resolvedWorkspaceId) continue;
        wmsIdentifyTargets.push({
          key: `settings:${layerId}`,
          workspaceId: resolvedWorkspaceId,
          workspaceName: wmsLayer.workspace,
          layerName: resolvedLayerName,
          title: wmsLayer.name
        });
      }

      for (const layerId of layerStore.visibleGeoServerLayers) {
        const layer = layerStore.geoServerLayers.find(l => l.layerId === layerId);
        if (!layer || layer.renderFormat !== 'wms') continue;
        const resolvedLayerName = layer.layerName || layer.sourceLayer;
        const resolvedWorkspaceId = layer.workspace;
        if (!resolvedLayerName || !resolvedWorkspaceId) continue;
        wmsIdentifyTargets.push({
          key: `geoserver:${layer.layerId}`,
          workspaceId: resolvedWorkspaceId,
          workspaceName: layer.workspace,
          layerName: resolvedLayerName,
          title: layer.displayName || layer.label || layer.layerId
        });
      }

      const uniqueWmsTargets = new Map<string, {
        key: string;
        workspaceId?: string;
        workspaceName?: string;
        layerName?: string;
        title?: string;
      }>();
      for (const target of wmsIdentifyTargets) {
        const dedupKey = `${target.workspaceName || target.workspaceId || 'default'}|${target.layerName || ''}`;
        if (!uniqueWmsTargets.has(dedupKey)) {
          uniqueWmsTargets.set(dedupKey, target);
        }
      }

      if (uniqueWmsTargets.size > 0) {
        const wmsTasks = Array.from(uniqueWmsTargets.values()).map(async (target) => {
          try {
            const result = await Promise.race([
              getFeatureInfo(
                bbox,
                container.clientWidth,
                container.clientHeight,
                e.point.x,
                e.point.y,
                activeFragments,
                target.workspaceId,
                target.layerName
              ),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 2200))
            ]);

            if (requestId !== this.identifyRequestId || !result?.features?.length) return [];
            return result.features.map((f: any) => this.normalizeFeatureForState({
              ...f,
              sourceType: 'wms',
              workspace: target.workspaceName || target.workspaceId,
              workspaceName: target.title || target.workspaceName || target.workspaceId,
              sourceLayer: target.layerName
            }));
          } catch (error) {
            if (import.meta.dev) {
              console.warn(`WMS identification failed for layer ${target.key}:`, error);
            }
          }
          return [];
        });

        const results = await Promise.allSettled(wmsTasks);
        if (requestId !== this.identifyRequestId) return;
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.length > 0) {
            allFoundFeatures.push(...result.value);
          }
        }
      }

      // 3. Process results
      const uniqueFoundFeatures = this.dedupeFeatures(allFoundFeatures);

      if (uniqueFoundFeatures.length === 0) {
        if (import.meta.dev) console.debug('No features found at this point');
        this.selectedFeatureData = null;
        return;
      }

      if (uniqueFoundFeatures.length === 1) {
        // Only one feature, select it immediately
        await this.selectFeature(uniqueFoundFeatures[0]);
      } else {
        // Multiple features, show selection menu
        this.potentialFeatures = uniqueFoundFeatures;
        this.featureMenuVisible = true;
      }
    },

    async selectFeature(feature: any) {
      if (!this.map) return;
      this.featureMenuVisible = false;
      this.objectDataLoading = true;

      const normalizedFeature = this.normalizeFeatureForState(feature);
      let properties = { ...normalizedFeature.properties };
      const featureId = properties.id ?? normalizedFeature.id ?? properties.fileid;

      // Resolve the numeric ID for WFS viewparams lookup.
      // _sourceId is the raw tile/WMS feature ID (e.g. 13587 or "heatpipesections.13587")
      // which is the reliable primary key, unlike properties.id which may be an unrelated field.
      const rawSourceId = normalizedFeature._sourceId;
      const wfsId = (() => {
        if (rawSourceId !== undefined && rawSourceId !== null && String(rawSourceId) !== '') {
          const s = String(rawSourceId);
          // "tableName.12345" or "id_tableName.fid-xxx_12345" → take last numeric segment
          const numericMatch = s.match(/\.(\d+)$/);
          if (numericMatch) return Number(numericMatch[1]);
          const asNum = Number(s);
          if (!isNaN(asNum) && asNum > 0) return asNum;
        }
        // Fall back to properties.id
        if (featureId !== undefined && featureId !== null && String(featureId) !== '') {
          const s = String(featureId);
          if (s.includes('.')) return Number(s.split('.').pop());
          return Number(s);
        }
        return null;
      })();
      
      if (import.meta.dev) console.debug('Selecting feature:', normalizedFeature.id, '_sourceId:', rawSourceId, 'wfsId:', wfsId, 'Source:', normalizedFeature.sourceType);

      try {
        const { getFeatureById } = useGeoServer();

        // Determine WFS table name — three priority levels:
        // 1. Explicit `tab` property from WMS GetFeatureInfo (most reliable, e.g. "generalizedconsumers")
        // 2. Prefix of the feature ID (e.g. "heatpipesections" from "heatpipesections.13587")
        // 3. sourceLayer / layer-id keyword analysis (MVT fallback)
        let table = '';

        if (properties.tab && typeof properties.tab === 'string') {
          // Priority 1: server tells us the exact WFS layer name
          table = properties.tab;
        } else {
          // Priority 2: extract prefix from raw feature ID ("heatpipesections.13587" → "heatpipesections")
          const rawIdStr = String(rawSourceId ?? '');
          const idPrefixMatch = rawIdStr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.(.+)$/);
          if (idPrefixMatch) {
            table = idPrefixMatch[1].toLowerCase();
          } else {
            // Priority 3: sourceLayer keyword analysis (MVT tiles)
            const sourceLayer = String(
              normalizedFeature.sourceLayer
              || normalizedFeature.layer?.['source-layer']
              || normalizedFeature.layer?.id
              || ''
            ).toLowerCase();

            if (sourceLayer.includes('heatpipesections') || sourceLayer.includes('uchastok')) {
              table = 'heatpipesections';
            } else if (sourceLayer.includes('uzel') || sourceLayer.includes('node')) {
              table = 'nodes';
            } else if (sourceLayer.includes('consumer')) {
              table = 'consumers';
            } else if (sourceLayer.includes('source')) {
              table = 'sources';
            }
          }
        }

        if (import.meta.dev) console.debug('[Select] table resolved:', table, '| sourceId:', rawSourceId, '| tab prop:', properties.tab);

        // Fetch full payload via WFS if possible
        if (table && wfsId !== null && !isNaN(wfsId) && wfsId > 0) {
          const wfsData = await getFeatureById(table, wfsId);
          if (wfsData && wfsData.properties) {
            properties = { ...properties, ...wfsData.properties };
            if (import.meta.dev) console.debug('[Select] Augmented selection via WFS table:', table, 'id:', wfsId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch full WFS properties in selectFeature', err);
      }

      // Load Structure & Translations (only if not provided by server)
      try {
        let namesMap: Record<string, string> = {};
        
        // Load local tg_names as base
        try {
          const { default: attributeTabs } = await import('~/data/attributeTabs.json');
          namesMap = { ...attributeTabs.tg_names };
        } catch (e) {
          console.warn('Failed to load local attributeTabs.json', e);
        }

        // Add hardcoded technical labels (always override/augment)
        Object.assign(namesMap, Object.entries(TECHNICAL_LABELS).reduce((acc, [key, val]) => {
          acc[key.toLowerCase()] = val;
          return acc;
        }, {} as Record<string, string>));

        // Merge with server-provided names if available
        const serverNamesStr = properties.tg_names || properties.tg__names;
        if (serverNamesStr) {
          try {
            const parsedServerNames = typeof serverNamesStr === 'string' ? JSON.parse(serverNamesStr) : serverNamesStr;
            Object.assign(namesMap, Object.entries(parsedServerNames).reduce((acc, [key, val]) => {
              acc[key.toLowerCase()] = String(val);
              return acc;
            }, {} as Record<string, string>));
          } catch (e) {
            console.error('Failed to parse server tg_names', e);
          }
        }

        // Русские подписи — только WFS (tg_names) + локальные словари выше; без FastAPI при identify.
        properties.tg_names = JSON.stringify(namesMap);

        // Tabs structure handling
        if (!properties.tg_tabs && !properties.tg__tabs) {
          console.warn('[selectFeature] tg_tabs not found in WFS properties – falling back to local attributeTabs.json');
          try {
            const { default: attributeTabs } = await import('~/data/attributeTabs.json');
            properties.tg_tabs = JSON.stringify(attributeTabs.tg_tabs);
          } catch (e) {
            console.warn('Failed to load local tabs structure', e);
          }
        } else {
          console.log('[selectFeature] tg_tabs source: WFS response ✓');
        }
      } catch (e) {
        console.error('Failed to load translations or tab structure', e);
      }

      console.log('[selectFeature] Before _attributePanelShow:', {
        hasTgTabs: !!properties.tg_tabs,
        hasTgNames: !!properties.tg_names,
        tgTabsPreview: properties.tg_tabs ? String(properties.tg_tabs).substring(0, 80) : null,
        propertyCount: Object.keys(properties).length,
        attributePanelReady: !!this._attributePanelShow,
      });

      // Show Attribute Panel
      const safeProperties = this.toPlainObject(properties);
      if (this._attributePanelShow) {
        this._attributePanelShow(safeProperties);
      } else {
        console.error('[selectFeature] _attributePanelShow is not set – panel will not open!');
      }

      // Build structured tabs from tg_tabs + tg_names
      let structuredTabs: import('~/types').Tab[] | undefined;
      try {
        const tabsRaw = safeProperties.tg_tabs ?? safeProperties.tg__tabs;
        const namesRaw = safeProperties.tg_names ?? safeProperties.tg__names;

        if (tabsRaw) {
          const tabsParsed: any[] = typeof tabsRaw === 'string' ? JSON.parse(tabsRaw) : tabsRaw;
          const namesParsed: Record<string, any> = namesRaw
            ? (typeof namesRaw === 'string' ? JSON.parse(namesRaw) : namesRaw)
            : {};

          const namesMap: Record<string, string> = {};
          for (const [k, v] of Object.entries(namesParsed)) {
            namesMap[k.toLowerCase()] = String(v);
          }

          const propsLower: Record<string, any> = {};
          for (const [k, v] of Object.entries(safeProperties)) {
            propsLower[k.toLowerCase()] = v;
          }

          let fieldIdx = 0;
          structuredTabs = tabsParsed.map((tabObj: any) => {
            const [tabTitle, subsRaw] = Object.entries(tabObj)[0] as [string, any[]];
            const subsections = (subsRaw as any[]).map((subsObj: any) => {
              const [subsTitle, fieldKeys] = Object.entries(subsObj)[0] as [string, string[]];
              const fields = (fieldKeys as string[]).map((fieldKey: string) => {
                const fieldLower = fieldKey.toLowerCase();
                return {
                  table: '',
                  field: fieldKey,
                  label: namesMap[fieldLower] || fieldKey,
                  value: propsLower[fieldLower] ?? null,
                  id: fieldIdx++,
                  type: 'text' as const,
                };
              });
              return { title: subsTitle, fields };
            });
            return { title: tabTitle, subsections };
          });
        }
      } catch (e) {
        console.warn('Failed to build structured tabs from tg_tabs/tg_names', e);
      }

      this.objectDataLoading = false;
      this.selectedFeatureData = {
        id: String(normalizedFeature.id ?? featureId ?? ''),
        properties: safeProperties,
        geometry: this.toPlainGeometry(normalizedFeature.geometry),
        ...(structuredTabs ? { data: { tabs: structuredTabs } } : {})
      };
    },

    async invalidateServerCache() {
      try {
        await $fetch('/api/geoserver-layers?refresh=true');
        if (import.meta.dev) console.debug('Server cache invalidated successfully');
      } catch (error) {
        console.error('Failed to invalidate server cache:', error);
      }
    },



    async showPopup(lngLat: LngLat, html: string) {
      if (!this.map) return;

      const maplibregl = await getMaplibreDefault();
      const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        className: 'custom-popup',
        offset: [0, -10]
      })
        .setLngLat(lngLat)
        .setHTML(html);
        
      popup.addTo(this.map as any);
      this.popup = markRaw(popup);
    },

    getVisibleLayerIdsForPointer(layerStore: ReturnType<typeof useLayerStore>): string[] {
      const cacheKey = layerStore.visibleGeoServerLayers
        .map((rootId) => {
          const layerConfig = layerStore.geoServerLayers.find((layer) => layer.layerId === rootId);
          return `${rootId}:${layerConfig?.renderFormat || 'mvt'}`;
        })
        .join('|');

      if (cacheKey === this.hoverLayerIdsCacheKey && this.hoverLayerIdsCache.length > 0) {
        const existingCachedLayers = this.hoverLayerIdsCache.filter((id) => Boolean(this.map?.getLayer(id)));
        if (existingCachedLayers.length !== this.hoverLayerIdsCache.length) {
          this.hoverLayerIdsCache = existingCachedLayers;
        }
        return existingCachedLayers;
      }

      const allLayerIds: string[] = [];
      for (const rootId of layerStore.visibleGeoServerLayers) {
        allLayerIds.push(...this.getLayerIdsOnMap(rootId));
      }

      this.hoverLayerIdsCacheKey = cacheKey;
      this.hoverLayerIdsCache = [...new Set(allLayerIds)].filter((id) => Boolean(this.map?.getLayer(id)));
      return this.hoverLayerIdsCache;
    },

    async handleMouseMove(e: MapMouseEvent) {
      if (!this.map) return;
      if (!this.identifyModeEnabled && !this.contextHoverInspectEnabled) {
        this.map.getCanvas().style.cursor = '';
        this.hideContextHoverPopup();
        return;
      }

      const now = Date.now();
      if (now - this.lastHoverQueryAt < this.hoverThrottleMs) return;
      this.lastHoverQueryAt = now;

      const layerStore = useLayerStore();
      const allLayerIds = this.getVisibleLayerIdsForPointer(layerStore).filter((id) => Boolean(this.map?.getLayer(id)));
      const contextLayerIds = getAllContextMapLayerIds().filter((id) => Boolean(this.map?.getLayer(id)));
      const baseInspectLayerIds = this.getBaseHoverInspectLayerIds();

      try {
        const features = allLayerIds.length > 0
          ? this.map.queryRenderedFeatures(e.point, { layers: allLayerIds })
          : [];
        const contextFeatures = (this.contextHoverInspectEnabled && contextLayerIds.length > 0)
          ? this.map.queryRenderedFeatures(e.point, { layers: contextLayerIds })
          : [];
        const baseFeatures = (this.contextHoverInspectEnabled && baseInspectLayerIds.length > 0)
          ? this.map.queryRenderedFeatures(e.point, { layers: baseInspectLayerIds })
          : [];

        this.map.getCanvas().style.cursor = (features.length > 0 || contextFeatures.length > 0 || baseFeatures.length > 0) ? 'pointer' : '';
        if (this.contextHoverInspectEnabled) {
          await this.updateContextHoverPopup(e.lngLat, [...contextFeatures, ...baseFeatures]);
        } else {
          this.hideContextHoverPopup();
        }
      } catch (error) {
        if (import.meta.dev) {
          console.warn('[mapStore] Hover query failed, clearing stale pointer cache', error);
        }
        this.hoverLayerIdsCache = [];
        this.hoverLayerIdsCacheKey = '';
        this.map.getCanvas().style.cursor = '';
        this.hideContextHoverPopup();
      }
    },

    setContextHoverInspectMode(enabled: boolean) {
      this.contextHoverInspectEnabled = enabled;
      if (!enabled) {
        this.hideContextHoverPopup();
      }
    },

    hideContextHoverPopup() {
      if (this.contextHoverPopup) {
        this.contextHoverPopup.remove();
        this.contextHoverPopup = null;
      }
    },

    async updateContextHoverPopup(lngLat: LngLat, features: MapGeoJSONFeature[]) {
      if (!this.map) return;
      if (!features.length) {
        this.hideContextHoverPopup();
        return;
      }

      const maplibregl = await getMaplibreDefault();

      const feature = features[0];
      const properties = feature.properties || {};
      const entries = Object.entries(properties)
        .filter(([, value]) => value !== null && value !== undefined && String(value).length > 0)
        .slice(0, 10);

      const rows = entries.length > 0
        ? entries.map(([k, v]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</div>`).join('')
        : '<div>Нет атрибутов</div>';
      const html = `
        <div style="font-size:12px; line-height:1.35; max-width:280px;">
          <div style="font-weight:600; margin-bottom:4px;">${escapeHtml(feature.layer.id)}</div>
          ${rows}
        </div>
      `;

      if (!this.contextHoverPopup) {
        const popup = markRaw(new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'custom-popup',
          offset: [0, -10],
        }));
        popup.addTo(this.map as any);
        this.contextHoverPopup = popup;
      }

      const hoverPopup = this.contextHoverPopup;
      if (hoverPopup) hoverPopup.setLngLat(lngLat).setHTML(html);
    },

    setIdentifyMode(enabled: boolean) {
      this.identifyModeEnabled = enabled;
      if (!enabled) {
        this.featureMenuVisible = false;
        this.potentialFeatures = [];
        this.objectDataLoading = false;
        if (this.map) {
          this.map.getCanvas().style.cursor = '';
        }
        if (!this.contextHoverInspectEnabled) {
          this.hideContextHoverPopup();
        }
      }
    },

    formatAttributeValue(value: any): string {
      if (typeof value === 'number') {
        return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);
      }
      return String(value);
    },

    async applyLayerStyle(layerId: string, style: Partial<LayerStyle>) {
      if (!this.map) return;
      const layerIds = this.getLayerIdsOnMap(layerId);
      this.layerStyles[layerId] = { ...this.layerStyles[layerId], ...style };
      localStorage.setItem('layerStyles', JSON.stringify(this.layerStyles));

      layerIds.forEach(id => {
          const layer = this.map?.getLayer(id);
          if (!layer) return;
          const type = layer.type;
          if (type === 'circle') {
             if (style.color) this.map?.setPaintProperty(id, 'circle-color', style.color);
             if (style.opacity !== undefined) this.map?.setPaintProperty(id, 'circle-opacity', style.opacity);
             if (style.circleRadius !== undefined) this.map?.setPaintProperty(id, 'circle-radius', style.circleRadius);
          } else if (type === 'line') {
             if (style.color) this.map?.setPaintProperty(id, 'line-color', style.color);
             if (style.opacity !== undefined) this.map?.setPaintProperty(id, 'line-opacity', style.opacity);
             if (style.lineWidth !== undefined) this.map?.setPaintProperty(id, 'line-width', style.lineWidth);
          } else if (type === 'fill') {
             if (style.color) this.map?.setPaintProperty(id, 'fill-color', style.color);
             if (style.opacity !== undefined) this.map?.setPaintProperty(id, 'fill-opacity', style.opacity);
             if (style.outlineColor) this.map?.setPaintProperty(id, 'fill-outline-color', style.outlineColor);
          }
        });
    },

    getLayerIdsOnMap(layerId: string): string[] {
      if (!this.map) return [];
      const style = this.map.getStyle();
      if (!style || !style.layers) return [];
      return style.layers
        .filter((l: any) => l.id === layerId || l.id.startsWith(`${layerId}-`))
        .map((l: any) => l.id);
    },

    getIdentifyLayerIdsOnMap(layerId: string): string[] {
      if (!this.map) return [];
      const style = this.map.getStyle();
      if (!style || !style.layers) return [];

      const matchedLayers = style.layers.filter((l: any) => l.id === layerId || l.id.startsWith(`${layerId}-`));
      if (matchedLayers.length === 0) return [];

      const interactiveLayers = matchedLayers.filter((l: any) => {
        const idLower = String(l.id || '').toLowerCase();
        if (idLower.includes('label') || idLower.includes('подписи')) return false;
        // Исключаем только чисто текстовые символы (без иконки).
        // Symbol-слои с icon-image + text-field — это кликабельные точечные объекты (иконки с подписями).
        if (l.type === 'symbol' && l.layout?.['text-field'] && !l.layout?.['icon-image']) return false;
        return true;
      });

      const layersForIdentify = interactiveLayers.length > 0 ? interactiveLayers : matchedLayers;
      return [...new Set<string>(layersForIdentify.map((layer: any) => String(layer.id)).filter(Boolean))];
    },

    toPlainObject(value: any): Record<string, any> {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      const serialized = this.toSerializableValue(value);
      if (!serialized || typeof serialized !== 'object' || Array.isArray(serialized)) return {};
      return serialized as Record<string, any>;
    },

    toPlainGeometry(geometry: any): FeatureData['geometry'] | undefined {
      if (!geometry || typeof geometry !== 'object') return undefined;
      const plainGeometry = this.toPlainObject(geometry);
      const coordinates = plainGeometry.coordinates;
      if (!plainGeometry.type || coordinates === undefined) return undefined;

      return {
        type: String(plainGeometry.type),
        coordinates: this.toSerializableCoordinates(coordinates)
      };
    },

    toSerializableCoordinates(value: any): any[] {
      if (Array.isArray(value)) {
        return value.map((item) => Array.isArray(item) || ArrayBuffer.isView(item)
          ? this.toSerializableCoordinates(item)
          : this.toSerializableValue(item));
      }

      if (ArrayBuffer.isView(value)) {
        return Array.from(value as unknown as ArrayLike<number>);
      }

      return [];
    },

    toSerializableValue(value: any): any {
      if (value === null || value === undefined) return value;
      if (typeof value !== 'object') return value;
      if (value instanceof Date) return value.toISOString();
      if (ArrayBuffer.isView(value)) return Array.from(value as unknown as ArrayLike<number>);
      if (Array.isArray(value)) return value.map((item) => this.toSerializableValue(item));

      const output: Record<string, any> = {};
      for (const [key, nestedValue] of Object.entries(value)) {
        output[key] = this.toSerializableValue(nestedValue);
      }
      return output;
    },

    normalizeFeatureForState(feature: any): any {
      const properties = this.toPlainObject(feature?.properties);
      const plainLayer = feature?.layer
        ? {
            id: String(feature.layer.id || ''),
            source: typeof feature.layer.source === 'string' ? feature.layer.source : '',
            'source-layer': typeof feature.layer['source-layer'] === 'string' ? feature.layer['source-layer'] : '',
            type: String(feature.layer.type || '')
          }
        : null;
      const fallbackId = properties.id ?? properties.ID ?? properties.fileid ?? feature?.id;

      // Preserve the raw tile/WMS feature ID (e.g. 13587 or "heatpipesections.13587")
      // separately so WFS lookup can use it instead of an unrelated properties.id field.
      const rawSourceId = feature?._sourceId ?? feature?.id;

      return {
        id: fallbackId,
        _sourceId: rawSourceId,
        properties,
        geometry: this.toPlainGeometry(feature?.geometry),
        sourceType: feature?.sourceType || 'mvt',
        workspace: feature?.workspace || properties.__workspaceId || null,
        workspaceName: feature?.workspaceName || properties.__workspaceName || null,
        sourceLayer: feature?.sourceLayer || plainLayer?.['source-layer'] || plainLayer?.id || null,
        layer: plainLayer
      };
    },

    buildFeatureDedupKey(feature: any): string {
      const properties = this.toPlainObject(feature?.properties);
      const sourceType = String(feature?.sourceType || 'unknown');
      const workspace = String(feature?.workspace || properties.__workspaceId || 'default');
      const sourceLayer = String(
        feature?.sourceLayer
        || feature?.layer?.['source-layer']
        || feature?.layer?.id
        || properties.__layerId
        || 'unknown-layer'
      );
      const featureId = properties.id ?? properties.ID ?? feature?.id ?? properties.fileid;

      if (featureId !== undefined && featureId !== null && String(featureId).length > 0) {
        return `${sourceType}|${workspace}|${sourceLayer}|${String(featureId)}`;
      }

      const geometry = feature?.geometry;
      if (geometry?.type && Array.isArray(geometry.coordinates)) {
        return `${sourceType}|${workspace}|${sourceLayer}|${geometry.type}|${JSON.stringify(geometry.coordinates)}`;
      }

      return `${sourceType}|${workspace}|${sourceLayer}|${JSON.stringify(properties)}`;
    },

    dedupeFeatures(features: any[]): any[] {
      const uniqueFeatures = new Map<string, any>();

      for (const item of features) {
        const normalized = this.normalizeFeatureForState(item);
        const key = this.buildFeatureDedupKey(normalized);
        const existing = uniqueFeatures.get(key);

        if (!existing) {
          uniqueFeatures.set(key, normalized);
          continue;
        }

        const mergedProperties = { ...existing.properties, ...normalized.properties };
        const existingSize = Object.keys(existing.properties || {}).length;
        const normalizedSize = Object.keys(normalized.properties || {}).length;
        const preferred = normalizedSize > existingSize ? normalized : existing;

        uniqueFeatures.set(key, {
          ...preferred,
          sourceType: existing.sourceType === 'mvt' || normalized.sourceType !== 'mvt'
            ? existing.sourceType
            : normalized.sourceType,
          layer: existing.layer || normalized.layer,
          sourceLayer: existing.sourceLayer || normalized.sourceLayer,
          workspace: existing.workspace || normalized.workspace,
          workspaceName: existing.workspaceName || normalized.workspaceName,
          properties: mergedProperties
        });
      }

      return Array.from(uniqueFeatures.values());
    },

    formatAttributeNameSync(attr: string): string {
      return TECHNICAL_LABELS[attr] || TECHNICAL_LABELS[attr.toUpperCase()] || fastApiService.getCachedRussianName(attr);
    },

    async formatAttributeName(attr: string): Promise<string> {
      return await fastApiService.getRussianName(attr);
    },

    loadLayerStyles() {
      const saved = localStorage.getItem('layerStyles');
      this.layerStyles = saved ? JSON.parse(saved) : {};
    },


  },

  getters: {
    getBaseLayers: (state) => state.baseLayers,
    getSelectedBaseLayer: (state) => state.selectedBaseLayer,
    getSelectedFeatureData: (state) => state.selectedFeatureData
  }
});
