<template>
  <client-only>
    <div class="map-viewer-root">
    <div class="map-container">
      <!-- Большая площадь + фон — чтобы LCP чаще был картой, а не текстом оверлея -->
      <div id="map" class="map-canvas-host" />

      <v-card
        v-if="mapInitLoading || (layerSyncProgressVisible && isLayerSyncInProgress)"
        class="map-loading-card pa-2"
        elevation="6"
        role="status"
      >
        <div class="d-flex align-center ga-2">
          <v-progress-circular
            indeterminate
            size="20"
            color="primary"
            width="3"
            aria-label="Индикатор загрузки карты"
          />
          <!-- Текст только для screen readers — уменьшает «element render delay» в Lighthouse (LCP на span) -->
          <span class="map-loading-sr-only">
            {{ mapInitLoading ? 'Подготавливаем карту.' : 'Загружаем тематические слои.' }}
            Всего слоёв: {{ totalAvailableLayers }}.
            <template v-if="hasLayerProgress">
              Загружено {{ layerStore.loadingCompletedLayers }} из {{ layerStore.loadingTotalLayers }}.
              <template v-if="layerStore.loadingFailedLayers > 0">
                Ошибок: {{ layerStore.loadingFailedLayers }}.
              </template>
            </template>
          </span>
          <v-progress-linear
            v-if="hasLayerProgress"
            class="map-loading-card__bar flex-grow-1"
            :model-value="layerLoadingPercent"
            color="primary"
            height="4"
            rounded
            aria-label="Прогресс загрузки тематических слоёв"
          />
        </div>
      </v-card>

      <v-alert
        v-if="layersError"
        class="map-error-alert ma-3"
        type="warning"
        variant="tonal"
      >
        Не удалось загрузить часть слоев. Карта работает в ограниченном режиме.
        <template #append>
          <v-btn size="small" variant="text" color="warning" @click="$emit('retry-layers')">
            Повторить
          </v-btn>
        </template>
      </v-alert>

      <!-- Error overlay -->
      <v-overlay v-model="mapInitError" class="align-center justify-center" persistent>
        <v-alert type="error" variant="tonal" class="ma-4" style="max-width: 400px">
          Ошибка при инициализации карты.
          <template #append>
            <v-btn variant="text" color="error" @click="retryMapInit">Повторить</v-btn>
          </template>
        </v-alert>
      </v-overlay>

      <!-- Loading feature data indicator -->
      <v-progress-circular
        v-if="mapStore.objectDataLoading"
        indeterminate
        size="32"
        color="primary"
        class="object-loading-indicator"
        aria-label="Загрузка данных объекта"
      />

      <!-- Left Sidebar -->
      <MapSidebar />

      <!-- Right Map Controls -->
      <MapControls
        :map="mapStore.map"
        :initial-identify-mode="savedPageState?.identifyMode ?? true"
        @layer-change="onBaseLayerChange"
        @identify-mode-change="onIdentifyModeChange"
        @open-node-search="nodeSearchRef?.openDialog()"
      />

      <!-- Attribute properties panel dialog -->
      <AttributePanel ref="attributePanelRef" />

      <!-- Node search dialog -->
      <NodeSearch ref="nodeSearchRef" :map="mapStore.map" />

      <!-- Feature selection menu -->
      <FeatureMenu />
    </div>
    </div>

    <template #fallback>
      <div class="map-viewer-root">
        <div class="map-container map-skeleton">
          <div class="map-canvas-host map-skeleton-host" aria-hidden="true" />
          <div class="map-skeleton__spinner d-flex flex-column align-center">
            <v-progress-circular
              indeterminate
              size="48"
              color="primary"
              width="4"
              aria-label="Загрузка карты"
            />
            <span class="text-body-2 text-medium-emphasis mt-3">Загрузка карты…</span>
          </div>
        </div>
      </div>
    </template>
  </client-only>
</template>

<script setup lang="ts">
import { useMapStore } from '~/stores/mapStore';
import { usePopupStore } from '~/stores/popupStore';
import { useLayerStore } from '~/stores/layerStore';
import type { LayerConfig } from '~/types';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { markPerf, measurePerf, timeAsync } from '~/utils/perf';

const props = defineProps<{
  initialLayers: LayerConfig[];
  layersLoading?: boolean;
  layersError?: boolean;
}>();
defineEmits<{ (e: 'retry-layers'): void }>();

const mapStore = useMapStore();
const popupStore = usePopupStore();
const layerStore = useLayerStore();
const PAGE_STATE_KEY = 'mapPageState';

const mapInitLoading = ref(false);
const mapInitError = ref(false);
const mapBootstrapped = ref(false);
const appliedLayerSignature = ref('');
const totalAvailableLayers = computed(() => layerStore.geoServerLayers.length + layerStore.wmsLayers.length);
const hasLayerProgress = computed(() => layerStore.loadingTotalLayers > 0);
const layerLoadingPercent = computed(() => {
  if (!hasLayerProgress.value) return 0;
  return Math.round((layerStore.loadingCompletedLayers / layerStore.loadingTotalLayers) * 100);
});
const isLayerSyncInProgress = computed(() => layerStore.isLayersLoading || Boolean(props.layersLoading));
/**
 * Оверлей синхронизации слоёв показываем с задержкой: иначе крошечный текст/карточка
 * часто становятся LCP и дают multi-second «element render delay» (ожидание main thread + MapLibre).
 */
const layerSyncProgressVisible = ref(false);
let layerSyncDeferTimer: ReturnType<typeof setTimeout> | null = null;

watch(isLayerSyncInProgress, (sync: boolean) => {
  if (!process.client) return;
  if (layerSyncDeferTimer) {
    clearTimeout(layerSyncDeferTimer);
    layerSyncDeferTimer = null;
  }
  if (!sync) {
    layerSyncProgressVisible.value = false;
    return;
  }
  layerSyncDeferTimer = setTimeout(() => {
    layerSyncProgressVisible.value = true;
    layerSyncDeferTimer = null;
  }, 800);
});

const savedPageState = ref<{
  viewport?: { center: [number, number]; zoom: number; bearing: number; pitch: number };
  identifyMode?: boolean;
} | null>(null);
const isValidViewport = (viewport: any): viewport is { center: [number, number]; zoom: number; bearing: number; pitch: number } => {
  return Boolean(
    viewport
    && Array.isArray(viewport.center)
    && viewport.center.length === 2
    && typeof viewport.center[0] === 'number'
    && typeof viewport.center[1] === 'number'
    && typeof viewport.zoom === 'number'
    && typeof viewport.bearing === 'number'
    && typeof viewport.pitch === 'number'
  );
};
const saveMapViewportState = () => {
  if (!process.client || !mapStore.map) return;
  const center = mapStore.map.getCenter();
  const state = savedPageState.value ?? {};
  const nextState = {
    ...state,
    viewport: {
      center: [center.lng, center.lat],
      zoom: mapStore.map.getZoom(),
      bearing: mapStore.map.getBearing(),
      pitch: mapStore.map.getPitch()
    }
  };
  savedPageState.value = nextState;
  localStorage.setItem(PAGE_STATE_KEY, JSON.stringify(nextState));
};

const waitForMapContainer = async (attempts = 20, delayMs = 50): Promise<boolean> => {
  for (let i = 0; i < attempts; i += 1) {
    await nextTick();
    if (document.getElementById('map')) return true;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
};

const attributePanelRef = ref<{ show: (props: Record<string, any>) => void; close: () => void } | null>(null);
const nodeSearchRef = ref<{ openDialog: () => void; removeMarker: () => void } | null>(null);

/** Стабильная сигнатура каталога слоёв (порядок в ответе API не должен вызывать повторный init) */
const getLayerSignature = (layers: LayerConfig[]) =>
  [...layers.map((layer) => layer.layerId)].sort().join('|');

const applyLayersToMap = async (layers: LayerConfig[]) => {
  if (!mapStore.map || layers.length === 0) return;

  const nextSignature = getLayerSignature(layers);
  if (nextSignature === appliedLayerSignature.value) return;

  markPerf('map:layers:init:start');
  await layerStore.initializeLayers(layers);
  markPerf('map:layers:init:end');
  measurePerf('map:layers:init', 'map:layers:init:start', 'map:layers:init:end');

  const settingsStore = useSettingsStore();
  layerStore.initWmsLayers(settingsStore.getWmsLayers);
  await timeAsync('map:setupMapLayers', () => layerStore.setupMapLayers());
  appliedLayerSignature.value = nextSignature;
};

const initMap = async () => {
  if (!process.client) return;
  if (mapBootstrapped.value) return;
  mapInitLoading.value = true;
  mapInitError.value = false;
  markPerf('map:init:start');
  try {
    await import('maplibre-gl/dist/maplibre-gl.css');
    popupStore.initPopupSettings();

    const settingsStore = useSettingsStore();
    if (!settingsStore.workspaces.length) {
      settingsStore.initSettings();
    }

    const hasContainer = await waitForMapContainer();
    if (!hasContainer) {
      throw new Error("Container 'map' not found");
    }

    await timeAsync('map:initializeMap', () => mapStore.initializeMap('map'));
    const viewport = savedPageState.value?.viewport;
    if (isValidViewport(viewport) && mapStore.map) {
      mapStore.map.jumpTo({
        center: viewport.center,
        zoom: viewport.zoom,
        bearing: viewport.bearing,
        pitch: viewport.pitch
      });
    }
    mapStore.map?.on('moveend', saveMapViewportState);
    mapBootstrapped.value = true;
    mapInitLoading.value = false;
    await applyLayersToMap(props.initialLayers);
  } catch (error) {
    console.error('Map init error:', error);
    mapInitError.value = true;
    useNotificationStore().showError('Ошибка при инициализации карты');
  } finally {
    mapInitLoading.value = false;
    markPerf('map:init:end');
    measurePerf('map:init:total', 'map:init:start', 'map:init:end');
  }
};

const retryMapInit = () => {
  mapInitError.value = false;
  initMap();
};

const onBaseLayerChange = (layerId: string) => {
  mapStore.selectBaseLayer(layerId);
};

const onIdentifyModeChange = (enabled: boolean) => {
  mapStore.setIdentifyMode(enabled);
  if (process.client) {
    const currentState = savedPageState.value ?? {};
    savedPageState.value = { ...currentState, identifyMode: enabled };
    localStorage.setItem(PAGE_STATE_KEY, JSON.stringify(savedPageState.value));
  }
  if (import.meta.dev) console.debug('Identify mode:', enabled);
};

/** BFCache: при уходе со страницы в кэш освобождаем WebGL; при возврате пересоздаём карту */
const onPageHideBfCache = (e: PageTransitionEvent) => {
  if (!e.persisted) return;
  mapStore.cleanup();
};

const onPageShowBfCache = (e: PageTransitionEvent) => {
  if (!e.persisted || !process.client) return;
  if (mapBootstrapped.value && !mapStore.map) {
    mapBootstrapped.value = false;
    mapInitLoading.value = true;
    initMap();
  }
};

onMounted(() => {
  if (process.client) {
    window.addEventListener('pagehide', onPageHideBfCache);
    window.addEventListener('pageshow', onPageShowBfCache);
    const rawSavedState = localStorage.getItem(PAGE_STATE_KEY);
    if (rawSavedState) {
      try {
        savedPageState.value = JSON.parse(rawSavedState);
      } catch {
        savedPageState.value = null;
      }
    }
    initMap();
    // Wire AttributePanel into mapStore so any click on a feature opens it
    mapStore._attributePanelShow = (properties: Record<string, any>) => {
      attributePanelRef.value?.show(properties);
    };
  }
});

onBeforeUnmount(() => {
  if (process.client) {
    window.removeEventListener('pagehide', onPageHideBfCache);
    window.removeEventListener('pageshow', onPageShowBfCache);
  }
  if (layerSyncDeferTimer) clearTimeout(layerSyncDeferTimer);
  mapStore.map?.off('moveend', saveMapViewportState);
});

watch(
  () => props.initialLayers,
  (layers: LayerConfig[]) => {
    if (!mapBootstrapped.value || !layers?.length) return;
    applyLayersToMap(layers);
  },
  { deep: false }
);
</script>

<style lang="scss" scoped>
/* Высоту задаёт layout (layout-content-root + index-page); здесь только заполняем родителя — без второго calc(100svh) */
.map-viewer-root {
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}

.map-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  isolation: isolate;
}

.map-canvas-host {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
  min-height: 0;
  background: #e3e9ef;
  contain: layout paint;
}

.map-loading-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.map-loading-card__bar {
  max-width: 140px;
}

.object-loading-indicator {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.map-loading-card {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
  min-width: auto;
  max-width: 200px;
}

.map-error-alert {
  position: absolute;
  top: 68px;
  right: 12px;
  z-index: 20;
  max-width: 420px;
}

.map-skeleton {
  background: #e8edf2;
}

.map-skeleton-host {
  pointer-events: none;
}

.map-skeleton__spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  pointer-events: none;
}
</style>