<template>
  <client-only>
    <div class="map-viewer-root">
      <div
        ref="mapContainerEl"
        class="map-container"
      >
        <!-- 2D Map (MapLibre) -->
        <div
          v-show="cesiumStore.viewMode === '2D'"
          id="map"
          class="map-canvas-host"
        />
      
        <!-- 3D Map (Cesium) -->
        <CesiumViewer
          v-if="cesiumStore.viewMode === '3D' || cesiumStore.isInitialized"
          v-show="cesiumStore.viewMode === '3D'"
          @ready="onCesiumReady"
        />

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
            <v-btn
              size="small"
              variant="text"
              color="warning"
              @click="$emit('retry-layers')"
            >
              Повторить
            </v-btn>
          </template>
        </v-alert>

        <!-- Error overlay -->
        <v-overlay
          v-model="mapInitError"
          class="align-center justify-center"
          persistent
        >
          <v-alert
            type="error"
            variant="tonal"
            class="ma-4"
            style="max-width: 400px"
          >
            Ошибка при инициализации карты.
            <template #append>
              <v-btn
                variant="text"
                color="error"
                @click="retryMapInit"
              >Повторить</v-btn>
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

        <!-- Панель инструментов приложения (журналы, реестры, отчёты) -->
        <LazyToolsPanel
          v-if="uiStore.toolsPanelOpen || toolsPanelMounted"
          v-model="uiStore.toolsPanelOpen"
          @open-tool="onOpenTool"
        />

        <!-- Панель рисования и измерений на карте -->
        <LazyDrawPanel
          v-if="uiStore.drawPanelOpen"
          v-model="uiStore.drawPanelOpen"
          :map="mapStore.map"
        />

        <!-- Right Map Controls -->
        <MapControls
          :map="mapStore.map"
          :initial-identify-mode="savedPageState?.identifyMode ?? true"
          :topology-editing-enabled="topologyEditingEnabled"
          v-model:isTraceMode="isTraceMode"
          v-model:isEditTopologyMode="isEditTopologyMode"
          @layer-change="onBaseLayerChange"
          @identify-mode-change="onIdentifyModeChange"
          @open-node-search="openLazyDialog('nodeSearch')"
          @toggle-trace-mode="toggleTraceMode"
          @toggle-edit-topology-mode="toggleEditTopologyMode"
        />

        <!-- Диалоги инструментов монтируются лениво (таблица toolDialogs): чанк подгружается при первом открытии через openLazyDialog -->
        <template
          v-for="dialog in toolDialogs"
          :key="dialog.key"
        >
          <component
            :is="dialog.component"
            v-if="mountedDialogs[dialog.key]"
            :ref="dialogRef(dialog.key)"
            v-on="dialog.on ?? {}"
          />
        </template>

        <!-- Attribute properties panel dialog (лениво: монтируется при первом identify-клике) -->
        <LazyAttributePanel
          v-if="mountedDialogs.attributePanel"
          ref="attributePanelRef"
          :is-edit-topology-mode="isEditTopologyMode"
          @delete-feature="onDeleteFeature"
          @refresh-layers="onCardRefreshLayers"
          @open-defect-journal="openLazyDialog('defect', $event)"
          @open-shurf-journal="openLazyDialog('shurf', $event)"
          @open-inspection-journal="openLazyDialog('inspection', $event)"
          @open-repair-journal="openLazyDialog('repair', $event)"
          @open-pressure-test-journal="openLazyDialog('pressureTest', $event)"
          @open-technical-condition-journal="openLazyDialog('technicalCondition', $event)"
          @open-corrosion-indicator-journal="openLazyDialog('corrosionIndicator', $event)"
          @open-alseko-journal="openLazyDialog('alseko', $event)"
          @open-electrical-network-journal="openLazyDialog('electricalNetwork', $event)"
          @open-heat-loss-journal="openLazyDialog('heatLoss', $event)"
          @open-temperature-graph-journal="openLazyDialog('temperatureGraph', $event)"
          @open-consumer-load-diagnostics="openLazyDialog('consumerLoad', $event)"
          @open-pump-equipment="openLazyDialog('pumpEquipment', $event)"
          @open-network-armatures="openLazyDialog('networkArmature', $event)"
          @open-network-regulators="openLazyDialog('networkRegulator', $event)"
          @open-network-bypasses="openLazyDialog('networkBypass', $event)"
          @open-network-diaphragms="openLazyDialog('networkDiaphragm', $event)"
          @open-outage-simulation="openLazyDialog('outageSimulation', $event)"
          @open-audit-history="openLazyDialog('auditHistory', $event)"
        />

        <!-- Node search dialog -->
        <LazyNodeSearch
          v-if="mountedDialogs.nodeSearch"
          :ref="dialogRef('nodeSearch')"
          :map="mapStore.map"
        />

        <!-- Контур журнала: показ на карте и выбор участков (этап 9) -->
        <JournalContourPickBar />

        <!-- Подсветка участков ПТС: что подсвечено и снять -->
        <PtsHighlightBar />

        <!-- Панель трассировки маршрута пьезометра -->
        <v-card
          v-if="isTraceMode"
          class="trace-panel"
          elevation="8"
          rounded="lg"
          role="region"
          aria-label="Построение маршрута пьезометра"
        >
          <div class="trace-panel__header px-3 py-2">
            <v-icon
              size="18"
              color="primary"
              class="me-2"
            >mdi-chart-line-variant</v-icon>
            <span class="text-subtitle-2 font-weight-bold">Маршрут пьезометра</span>
            <v-spacer />
            <v-btn
              icon
              size="x-small"
              variant="text"
              aria-label="Закрыть трассировку"
              @click="toggleTraceMode"
            >
              <v-icon size="18">mdi-close</v-icon>
            </v-btn>
          </div>
          <v-divider />
          <div class="pa-3">
            <div class="text-caption text-medium-emphasis mb-2">
              Кликайте по узлам сети — маршрут пройдёт через них по порядку.
            </div>
            <div
              v-if="traceNodes.length"
              class="trace-chips mb-2"
            >
              <v-chip
                v-for="(nodeId, idx) in traceNodes"
                :key="`${nodeId}-${idx}`"
                size="small"
                class="me-1 mb-1"
                :color="idx === 0 ? 'success' : idx === traceNodes.length - 1 ? 'error' : 'primary'"
                variant="tonal"
              >
                {{ idx + 1 }}. Узел {{ nodeId }}
              </v-chip>
            </div>
            <div
              v-else
              class="text-caption text-disabled mb-2"
            >Узлы не выбраны</div>
            <div
              class="d-flex flex-wrap"
              style="gap: 6px;"
            >
              <v-btn
                size="small"
                color="primary"
                variant="flat"
                :disabled="traceNodes.length < 2 || piezometerLoading"
                :loading="piezometerLoading"
                @click="buildPiezometerRoute"
              >
                Построить график
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                :disabled="!traceNodes.length"
                @click="undoTraceNode"
              >
                Отменить точку
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                prepend-icon="mdi-bookmark-multiple"
                @click="piezometerDirectionsOpen = true"
              >
                Направления
              </v-btn>
              <v-spacer />
              <v-btn
                size="small"
                variant="text"
                color="error"
                :disabled="!traceNodes.length"
                @click="clearTrace"
              >
                Очистить
              </v-btn>
            </div>
          </div>
        </v-card>

        <!-- Piezometer modal (лениво: ECharts-чанк подгружается при первом построении графика) -->
        <LazyPiezometerModal
          v-if="piezometerActivated"
          v-model="piezometerModalOpen"
          :path-data="piezometerPathData"
          :loading="piezometerLoading"
          :error="piezometerError"
          :has-calculation="piezometerHasCalc"
          :total-length="piezometerTotalLength"
          :waypoints="traceNodes"
          :calculation-id="piezometerRoute?.calculation_id ?? null"
          :calculation-id2="piezometerCalc2"
          :fragment-ids="piezometerRoute?.fragment_ids ?? []"
          :static-head="piezometerRoute?.static_head ?? null"
          @node-hover="onPiezometerNodeHover"
          @double="onPiezometerDouble"
        />
        <LazyPiezometerDirectionsDialog
          v-if="piezometerDirectionsOpen"
          v-model="piezometerDirectionsOpen"
          :waypoints="traceNodes"
          @load="onPiezometerDirectionLoad"
        />

        <!-- Превью разрезания участка (dry-run → подтверждение) -->
        <LazySplitPreviewDialog
          v-if="splitPreviewOpen"
          v-model="splitPreviewOpen"
          :line-id="splitPreviewTarget?.lineId ?? null"
          :report="splitPreviewReport"
          :loading="splitPreviewLoading"
          :confirming="splitPreviewConfirming"
          :error="splitPreviewError"
          @confirm="confirmSplit"
          @cancel="cancelSplit"
        />

        <!-- Панель инструментов CAD топологии -->
        <div
          v-if="isEditTopologyMode"
          class="topology-edit-toolbar elevation-4"
        >
          <div class="d-flex align-center ga-2 pa-2">
            <v-chip
              size="small"
              color="primary"
              variant="flat"
            >
              CAD Топология
            </v-chip>
            <v-btn
              size="small"
              :color="isMergeMode ? 'warning' : 'default'"
              :variant="isMergeMode ? 'flat' : 'outlined'"
              @click="toggleMergeMode"
            >
              <v-icon
                start
                size="16"
              >mdi-call-merge</v-icon>
              {{ isMergeMode ? 'Отменить слияние' : 'Слияние узлов' }}
            </v-btn>
            <span
              v-if="isMergeMode && !mergeTargetNodeId"
              class="text-caption text-medium-emphasis"
            >
              Кликните целевой узел
            </span>
            <span
              v-else-if="isMergeMode && mergeTargetNodeId"
              class="text-caption text-warning font-weight-medium"
            >
              Узел {{ mergeTargetNodeId }} выбран. Кликните узел для слияния.
            </span>
            <v-btn
              size="small"
              :color="isVertexMode ? 'warning' : 'default'"
              :variant="isVertexMode ? 'flat' : 'outlined'"
              @click="toggleVertexMode"
            >
              <v-icon
                start
                size="16"
              >mdi-vector-polyline-edit</v-icon>
              {{ isVertexMode ? 'Закрыть вершины' : 'Вершины' }}
            </v-btn>
            <template v-if="isVertexMode">
              <span
                v-if="!vertexEditor.active.value"
                class="text-caption text-medium-emphasis"
              >
                Кликните участок
              </span>
              <template v-else>
                <span class="text-caption">
                  Участок {{ vertexEditor.lineId.value }}: тяните вершину, «○» — добавить, правый клик — удалить
                </span>
                <v-btn
                  size="small"
                  color="primary"
                  variant="flat"
                  :disabled="!vertexEditor.dirty.value"
                  :loading="vertexEditor.saving.value"
                  @click="vertexEditor.save()"
                >
                  <v-icon
                    start
                    size="16"
                  >mdi-content-save</v-icon>
                  Сохранить
                </v-btn>
                <v-btn
                  size="small"
                  variant="text"
                  :disabled="!vertexEditor.dirty.value"
                  @click="vertexEditor.reset()"
                >
                  <v-icon
                    start
                    size="16"
                  >mdi-restore</v-icon>
                  Сбросить
                </v-btn>
              </template>
            </template>
            <v-divider
              vertical
              class="mx-1"
            />
            <v-btn
              size="small"
              variant="outlined"
              :disabled="!lastTopologyOperation || !lastTopologyOperation.undo_supported"
              :loading="undoBusy"
              @click="undoLastTopologyOperation"
            >
              <v-icon
                start
                size="16"
              >mdi-undo</v-icon>
              Отменить
              <v-tooltip
                activator="parent"
                location="bottom"
              >
                {{ lastTopologyOperation ? `Отменить: ${topologyOperationLabel(lastTopologyOperation)}` : 'Нет операций для отмены' }}
              </v-tooltip>
            </v-btn>
          </div>
        </div>

        <!-- Превью слияния узлов (dry-run: что и куда перенесётся, что блокирует) -->
        <LazyMergePreviewDialog
          v-if="mergeConfirmDialogOpen"
          v-model="mergeConfirmDialogOpen"
          :target-id="mergeTargetNodeId"
          :source-id="mergeSourceNodeId"
          :report="mergePreviewReport"
          :loading="mergePreviewLoading"
          :confirming="mergeLoading"
          :error="mergePreviewError"
          @confirm="confirmMerge"
          @cancel="cancelMerge"
        />

        <!-- Feature selection menu -->
        <FeatureMenu />
      </div>
    </div>

    <template #fallback>
      <div class="map-viewer-root">
        <div class="map-container map-skeleton">
          <div
            class="map-canvas-host map-skeleton-host"
            aria-hidden="true"
          />
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
import { appStorage } from '~/utils/appStorage';
import { formatApiError } from '~/utils/apiError';
import { activeDrawMode } from '~/composables/useMapDraw';
import { useMapStore } from '~/stores/mapStore';
import { usePopupStore } from '~/stores/popupStore';
import { useLayerStore } from '~/stores/layerStore';
import { useCesiumStore } from '~/stores/cesiumStore';
import { useUiStore } from '~/stores/uiStore';
import { useAuthStore } from '~/stores/authStore';
import { TOOL_EVENT_TO_DIALOG } from '~/utils/toolCatalog';
import type { ToolDialogKey, ToolEvent } from '~/utils/toolCatalog';
import type { LayerConfig } from '~/types';
import { computed, defineAsyncComponent, markRaw, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowReactive, watch } from 'vue';
import type { Component } from 'vue';
import { markPerf, measurePerf, timeAsync } from '~/utils/perf';
import { useNotificationStore } from '~/stores/notificationStore';
import { fastApiService } from '~/services/fastApiService';
import type { PiezometerRouteResponse } from '~/services/fastApiService';
import maplibregl from 'maplibre-gl';
import { useTopologyEditor } from '~/composables/useTopologyEditor';
import { useJournalContourLayer } from '~/composables/useJournalContourLayer';
import { useOverlayLayer } from '~/composables/useOverlayLayer';
import type { RegimePointsResult } from '~/utils/regimeMapPoints';
import { useLocateMarkers } from '~/composables/useLocateMarkers';
import type { LocatePoint } from '~/composables/useLocateMarkers';
import { getNetworkFeatureKind, pickNetworkFeature } from '~/utils/networkFeature';
import { nearestGroup, queryRenderedNear } from '~/utils/mapPick';
import type { PickCandidate } from '~/utils/networkFeature';
import { useFragmentStore } from '~/stores/fragmentStore';
import { topologyOperationLabel } from '~/utils/topologyLabels';
import { isStyleMutable, waitForStyleMutable } from '~/services/mapService';

const props = defineProps<{
  initialLayers: LayerConfig[];
  layersLoading?: boolean;
  layersError?: boolean;
}>();
defineEmits<{ (e: 'retry-layers'): void }>();

const mapStore = useMapStore();
const popupStore = usePopupStore();
const layerStore = useLayerStore();
const fragmentStore = useFragmentStore();
const cesiumStore = useCesiumStore();
const uiStore = useUiStore();
/** Панель инструментов остаётся смонтированной после первого открытия (сохраняет поиск/скролл) */
const toolsPanelMounted = ref(false);
watch(() => uiStore.toolsPanelOpen, (isOpen: boolean) => {
  if (isOpen) toolsPanelMounted.value = true;
});
const CesiumViewer = defineAsyncComponent(() => import('./CesiumViewer.vue'));
const authStore = useAuthStore();
/** Редактор топологии: admin + MUTATIONS_ENABLED + TOPOLOGY_MUTATIONS_ENABLED на сервере */
const topologyEditingEnabled = computed(() => authStore.canEditTopology);
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

// Окно карты общее для 2D и 3D и всегда видно (холсты MapLibre/Cesium скрываются через v-show)
const mapContainerEl = ref<HTMLElement | null>(null);
const mapViewport = () => ({
  width: mapContainerEl.value?.clientWidth ?? 0,
  height: mapContainerEl.value?.clientHeight ?? 0,
});

const syncCesiumCameraFromMap = () => {
  if (!mapStore.map || !cesiumStore.isInitialized) return;
  const center = mapStore.map.getCenter();
  cesiumStore.syncCameraFrom2D(
    [center.lng, center.lat],
    mapStore.map.getZoom(),
    mapStore.map.getBearing(),
    mapStore.map.getPitch(),
    mapViewport()
  );
};

const onCesiumReady = () => {
  if (cesiumStore.viewMode === '3D') {
    syncCesiumCameraFromMap();
    cesiumStore.hibernate(false);
  } else {
    cesiumStore.hibernate(true);
  }
};

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

// Sync and Hibernation Logic for 2D/3D
watch(() => cesiumStore.viewMode, async (newMode) => {
  if (!process.client) return;
  
  if (newMode === '3D') {
    syncCesiumCameraFromMap();
    // 2. Un-hibernate Cesium
    cesiumStore.hibernate(false);
    if (cesiumStore.syncedSelection) {
      cesiumStore.flyToSelection(cesiumStore.syncedSelection);
    }
  } else {
    // Sync camera from Cesium to MapLibre
    const state = cesiumStore.getCameraStateFor2D(mapViewport());
    if (state && mapStore.map) {
      mapStore.map.jumpTo({
        center: state.center,
        zoom: state.zoom,
        bearing: state.bearing,
        pitch: state.pitch
      });
    }

    // 1. Hibernate Cesium to save CPU/GPU
    cesiumStore.hibernate(true);
    // 2. Refresh MapLibre canvas size since it was hidden
    await nextTick();
    if (mapStore.map) {
      mapStore.map.resize();
    }
  }
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
      center: [center.lng, center.lat] as [number, number],
      zoom: mapStore.map.getZoom(),
      bearing: mapStore.map.getBearing(),
      pitch: mapStore.map.getPitch()
    }
  };
  savedPageState.value = nextState;
  appStorage.setItem(PAGE_STATE_KEY, JSON.stringify(nextState));
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

/**
 * Ленивое монтирование диалогов: тяжёлые журналы не попадают в основной чанк карты,
 * их код загружается при первом открытии. openLazyDialog поднимает флаг монтирования
 * и, если компонент ещё не загружен, дожидается появления ref перед вызовом openDialog.
 * Ключи диалогов инструментов объявлены в utils/toolCatalog.ts,
 * компоненты и обработчики их событий — в таблице toolDialogs ниже.
 */
type LazyDialogKey = ToolDialogKey | 'nodeSearch';

type LazyDialogInstance = { openDialog: (scope?: any) => void };

const mountedDialogs = reactive<Partial<Record<LazyDialogKey | 'attributePanel', boolean>>>({});
const dialogInstances = shallowReactive<Partial<Record<LazyDialogKey, LazyDialogInstance | null>>>({});
const dialogRefSetters: Partial<Record<LazyDialogKey, (el: any) => void>> = {};
/** Стабильный function-ref на ключ: экземпляр диалога попадает в dialogInstances */
const dialogRef = (key: LazyDialogKey) =>
  (dialogRefSetters[key] ??= (el: any) => {
    dialogInstances[key] = (el as LazyDialogInstance | null) ?? null;
  });

const onOpenTool = (event: ToolEvent) => {
  const key = TOOL_EVENT_TO_DIALOG[event];
  if (key) openLazyDialog(key);
};

const openLazyDialog = (key: LazyDialogKey, scope?: unknown) => {
  mountedDialogs[key] = true;
  const current = dialogInstances[key];
  if (current) {
    current.openDialog(scope);
    return;
  }
  const stop = watch(() => dialogInstances[key], (instance: LazyDialogInstance | null | undefined) => {
    if (!instance) return;
    stop();
    instance.openDialog(scope);
  });
};

// === «Показать на карте»: маркер + перелёт, один слот на источник ===
const locateMarkers = useLocateMarkers(() => mapStore.map, {
  onSync: (selection) => cesiumStore.setSyncedSelection(selection),
});

/** Пульсирующая точка диагностик и анализа (раньше — маркер nodeSearch) */
const faultMarkerElement = () => {
  const el = document.createElement('div');
  el.className = 'fault-marker';
  el.style.width = '24px';
  el.style.height = '24px';
  el.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
  el.style.border = '2px solid red';
  el.style.borderRadius = '50%';
  el.style.animation = 'pulse 1.5s infinite';
  return el;
};

const labelOr = (fallback: string) => (p: LocatePoint) => p.label || `${fallback}${p.id}`;

const locate = locateMarkers.handlers({
  defect: { zoom: 18, color: '#e65100', popupText: (p) => `Нарушение ${p.id}` },
  shurf: { zoom: 18, color: '#795548', popupText: (p) => `Шурф ${p.id}` },
  inspection: { zoom: 16, color: '#00796b', popupText: labelOr('Осмотр ') },
  repair: { zoom: 16, color: '#5e35b1', popupText: labelOr('Ремонт ') },
  pressureTest: { zoom: 16, color: '#1565c0', popupText: labelOr('Опрессовка ') },
  technicalCondition: { zoom: 18, color: '#00838f', popupText: labelOr('ТУ ') },
  corrosionIndicator: { zoom: 18, color: '#ef6c00', popupText: labelOr('Индикатор ') },
  alseko: { zoom: 18, color: '#3949ab', popupText: labelOr('АЛСЕКО ') },
  electricalNetwork: { zoom: 18, color: '#ff8f00', popupText: labelOr('Объект электросети ') },
  heatSource: { zoom: 18, color: '#d84315', popupText: labelOr('Источник №') },
  consumer: { zoom: 18, color: '#00796b', popupText: labelOr('Потребитель №') },
  pump: { zoom: 19, color: '#37474f', popupText: labelOr('Насос №') },
  armature: { zoom: 19, color: '#4527a0', popupText: labelOr('Арматура №') },
  regulator: { zoom: 19, color: '#283593', popupText: labelOr('Регулятор №') },
  bypass: { zoom: 19, color: '#006064', popupText: labelOr('Байпас №') },
  diaphragm: { zoom: 19, color: '#004d40', popupText: labelOr('Диафрагма №'), syncLayerId: 'diaphragms' },
  elevator: { zoom: 19, color: '#263238', popupText: labelOr('Элеватор №'), syncLayerId: 'elevators' },
  // Диагностики топологии, запросы по сети, анализ режима: { lat, lng } без подсказки
  fault: { zoom: 18, element: faultMarkerElement },
});

// === Outage Simulation Map Visualization ===
const outageIsolatedOverlay = useOverlayLayer(() => mapStore.map, 'outage-isolated-pipes', {
  layerIds: ['outage-isolated-pipes-glow', 'outage-isolated-pipes-line'],
});
const outageDownstreamOverlay = useOverlayLayer(() => mapStore.map, 'outage-downstream-pipes', {
  layerIds: ['outage-downstream-pipes-line'],
});
const outageValvesOverlay = useOverlayLayer(() => mapStore.map, 'outage-valves-to-close', {
  layerIds: ['outage-valves-to-close-points'],
});

const onShowOutageOnMap = (res: any) => {
  const map = mapStore.map;
  if (!map) return;
  onClearOutageHighlight();

  // Highlight isolated pipes
  if (res.geojson?.isolated_pipes?.features?.length) {
    outageIsolatedOverlay.show(res.geojson.isolated_pipes, [
      {
        id: 'outage-isolated-pipes-glow',
        type: 'line',
        paint: {
          'line-color': '#ff1744',
          'line-width': 8,
          'line-opacity': 0.45,
        },
      },
      {
        id: 'outage-isolated-pipes-line',
        type: 'line',
        paint: {
          'line-color': '#d50000',
          'line-width': 4,
        },
      },
    ]);
  }

  // Участки ниже закрытых задвижек без связи с источниками (оценка)
  if (res.geojson?.downstream_pipes?.features?.length) {
    outageDownstreamOverlay.show(res.geojson.downstream_pipes, [
      {
        id: 'outage-downstream-pipes-line',
        type: 'line',
        paint: { 'line-color': '#ff6d00', 'line-width': 4, 'line-dasharray': [2, 1.5] },
      },
    ]);
  }

  // Highlight isolating valves
  if (res.geojson?.valves_to_close?.features?.length) {
    outageValvesOverlay.show(res.geojson.valves_to_close, [
      {
        id: 'outage-valves-to-close-points',
        type: 'circle',
        paint: {
          'circle-radius': 9,
          'circle-color': '#ffd600',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#d50000',
        },
      },
    ]);
  }

  // Center map on isolated zone
  const firstValve = res.valves_to_close?.find((v: any) => v.lng && v.lat);
  if (firstValve && firstValve.lng && firstValve.lat) {
    map.flyTo({ center: [firstValve.lng, firstValve.lat], zoom: 17 });
  } else if (res.affected_consumers?.length) {
    const firstC = res.affected_consumers.find((c: any) => c.longitude && c.latitude);
    if (firstC && firstC.longitude && firstC.latitude) {
      map.flyTo({ center: [firstC.longitude, firstC.latitude], zoom: 17 });
    }
  }
};

const onClearOutageHighlight = () => {
  outageIsolatedOverlay.clear();
  outageDownstreamOverlay.clear();
  outageValvesOverlay.clear();
};

const onFocusCoords = (lng: number, lat: number) => {
  mapStore.map?.flyTo({ center: [lng, lat], zoom: 18 });
};

// === Hydraulic Thematic Maps & Flow Arrows ===
const FLOW_ARROW_ICON = 'hydraulic-flow-arrow';
const HAS_DELTA_H = ['==', ['typeof', ['get', 'delta_h']], 'number'] as any;

/** Треугольная стрелка «по линии» (острие по +x); после смены стиля регистрируется заново */
const ensureFlowArrowIcon = (m: any) => {
  if (m.hasImage(FLOW_ARROW_ICON)) return;
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.beginPath();
  ctx.moveTo(5, 5);
  ctx.lineTo(20, 12);
  ctx.lineTo(5, 19);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  m.addImage(FLOW_ARROW_ICON, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
};

const hydraulicOverlay = useOverlayLayer(() => mapStore.map, 'hydraulic-calc-source', {
  layerIds: ['hydraulic-pipes-layer', 'hydraulic-flow-arrows-layer', 'hydraulic-nodes-layer', 'hydraulic-nodes-labels-layer'],
});

const onClearHydraulicThematic = () => hydraulicOverlay.clear();

// «Анализ режима» → «Показать все на карте»: все найденные объекты разом (как gid6, QA F39)
const regimeOverlay = useOverlayLayer(() => mapStore.map, 'regime-analysis-points', {
  layerIds: ['regime-analysis-points-halo', 'regime-analysis-points-circle'],
});
const showRegimePoints = (points: RegimePointsResult) => {
  const shown = regimeOverlay.show(points.data, [
    { id: 'regime-analysis-points-halo', type: 'circle', paint: { 'circle-radius': 11, 'circle-color': '#ff6d00', 'circle-opacity': 0.25 } },
    {
      id: 'regime-analysis-points-circle', type: 'circle',
      paint: { 'circle-radius': 5, 'circle-color': '#ff6d00', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 },
    },
  ]);
  if (shown && points.bounds) {
    mapStore.map?.fitBounds(points.bounds, { padding: 80, maxZoom: 17, duration: 800 });
  }
};

const hydraulicPipeColor = (colorPipes: boolean) => (colorPipes
  ? [
      'case',
      ['==', ['get', 'is_over_resistance'], true], '#d32f2f',
      ['==', ['get', 'velocity_status'], 'high'], '#f57c00',
      ['==', ['get', 'velocity_status'], 'low'], '#7b1fa2',
      '#2e7d32',
    ]
  : '#1976d2');

const visibility = (visible: boolean) => (visible ? 'visible' : 'none');

const onApplyHydraulicThematic = (payload: {
  geojson: any;
  showArrows: boolean;
  colorPipes: boolean;
  colorNodes: boolean;
  showNodeLabels: boolean;
}) => {
  const map = mapStore.map;
  if (!map) return;

  onClearHydraulicThematic();

  // Стрелки направления потоков — иконка, а не символ шрифта:
  // в глифах Open Sans (MapTiler) нет «▶», и текстовые стрелки не рисовались
  ensureFlowArrowIcon(map);
  hydraulicOverlay.show(payload.geojson, [
    // 1. Участки с раскраской
    {
      id: 'hydraulic-pipes-layer',
      type: 'line',
      filter: ['==', ['get', 'kind'], 'line'],
      paint: {
        'line-color': hydraulicPipeColor(payload.colorPipes),
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 15, 5, 18, 8],
      },
    },
    // 2. Стрелки направления потоков вдоль участков
    {
      id: 'hydraulic-flow-arrows-layer',
      type: 'symbol',
      filter: ['==', ['get', 'kind'], 'line'],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 80,
        'icon-image': FLOW_ARROW_ICON,
        'icon-rotation-alignment': 'map',
        'icon-rotate': ['case', ['<', ['get', 'flow_dir'], 0], 180, 0],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'visibility': visibility(payload.showArrows),
      },
    },
    // 3. Узлы с раскраской по ΔH
    {
      id: 'hydraulic-nodes-layer',
      type: 'circle',
      filter: ['==', ['get', 'kind'], 'node'],
      layout: {
        visibility: visibility(payload.colorNodes),
      },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 7, 18, 10],
        // ΔH есть только у узлов, где считались обе трубы; остальные — серые
        'circle-color': [
          'case',
          HAS_DELTA_H,
          [
            'interpolate',
            ['linear'],
            ['get', 'delta_h'],
            0, '#304ffe',
            15, '#00b0ff',
            30, '#00e676',
            50, '#ffeb3b',
            70, '#ff1744',
          ],
          '#9e9e9e',
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    },
    // 4. Подписи напора узлов
    {
      id: 'hydraulic-nodes-labels-layer',
      type: 'symbol',
      filter: ['all', ['==', ['get', 'kind'], 'node'], HAS_DELTA_H],
      minzoom: 14,
      layout: {
        'text-field': ['concat', 'ΔH=', ['to-string', ['get', 'delta_h']], ' м'],
        'text-font': ['Open Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
        'visibility': visibility(payload.showNodeLabels),
      },
      paint: {
        'text-color': '#1a237e',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      },
    },
  ]);
};

const onUpdateHydraulicThematicSettings = (payload: {
  showArrows: boolean;
  colorPipes: boolean;
  colorNodes: boolean;
  showNodeLabels: boolean;
}) => {
  if (!hydraulicOverlay.isShown()) return;
  hydraulicOverlay.setLayout('hydraulic-flow-arrows-layer', 'visibility', visibility(payload.showArrows));
  hydraulicOverlay.setLayout('hydraulic-nodes-layer', 'visibility', visibility(payload.colorNodes));
  hydraulicOverlay.setLayout('hydraulic-nodes-labels-layer', 'visibility', visibility(payload.showNodeLabels));
  hydraulicOverlay.setPaint('hydraulic-pipes-layer', 'line-color', hydraulicPipeColor(payload.colorPipes));
};

// === Trace Mode for Piezometric Graph ===
// Маршрут задаётся последовательностью узлов (waypoints), как выделение
// направления в десктопе: путь строится через все выбранные точки по порядку.
const isTraceMode = ref(false);
const traceNodes = ref<number[]>([]);
/** Фрагменты узлов маршрута (параллельно traceNodes; null — неизвестен): следующий узел ищется в том же */
let traceNodeFragments: Array<number | null> = [];
const piezometerModalOpen = ref(false);
/** Модал с ECharts монтируется лениво — только после первого открытия */
const piezometerActivated = ref(false);
watch(piezometerModalOpen, (open: boolean) => {
  if (open) piezometerActivated.value = true;
});
const piezometerPathData = ref<any[]>([]);
const piezometerLoading = ref(false);
const piezometerError = ref<string | null>(null);
const piezometerHasCalc = ref(false);
const piezometerTotalLength = ref(0);
/** Полный ответ маршрута (статика, фрагменты, расчёт) и второй расчёт двойного пьезометра */
const piezometerRoute = ref<PiezometerRouteResponse | null>(null);
const piezometerCalc2 = ref<number | null>(null);
const piezometerDirectionsOpen = ref(false);
const routeOverlay = useOverlayLayer(() => mapStore.map, 'piezo-route-source', {
  layerIds: ['piezo-route-line', 'piezo-route-nodes'],
});
const traceNodeMarkers: maplibregl.Marker[] = [];

const toggleTraceMode = () => {
  isTraceMode.value = !isTraceMode.value;
  if (isTraceMode.value) {
    if (isEditTopologyMode.value) void toggleEditTopologyMode();
    clearTrace();
    mapStore.setIdentifyMode(false); // отключаем обычный identify-клик
    useNotificationStore().showSuccess('Режим трассировки: кликайте по узлам маршрута.');
  } else {
    clearTrace();
    mapStore.setIdentifyMode(true);
  }
};

const clearRouteHighlight = () => {
  traceNodeMarkers.forEach((m) => m.remove());
  traceNodeMarkers.length = 0;
  routeOverlay.clear();
};

/** Подсветка построенного маршрута линией + маркерами по узлам */
const highlightRoute = (path: Array<{ node_id: number; lng: number | null; lat: number | null; label: string }>) => {
  const map = mapStore.map;
  if (!map) return;
  // Стиль мог быть не готов (HMR / смена подложки) — addSource тогда бросает
  if (!isStyleMutable(map)) {
    void waitForStyleMutable(map).then(() => highlightRoute(path), () => {});
    return;
  }
  clearRouteHighlight();

  const coords = path
    .filter((p) => p.lng != null && p.lat != null)
    .map((p) => [p.lng as number, p.lat as number]);
  if (coords.length < 2) return;

  try {
    addRouteLayers(path, coords);
  } catch (e) {
    console.warn('[piezometer] не удалось подсветить маршрут:', e);
  }
};

const addRouteLayers = (
  path: Array<{ lng: number | null; lat: number | null }>,
  coords: number[][]
) => {
  routeOverlay.show(
    {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
        ...path
          .filter((p) => p.lng != null && p.lat != null)
          .map((p) => ({
            type: 'Feature' as const,
            properties: { node: true },
            geometry: { type: 'Point' as const, coordinates: [p.lng as number, p.lat as number] },
          })),
      ],
    },
    [
      {
        id: 'piezo-route-line',
        type: 'line',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#ff6f00', 'line-width': 4, 'line-opacity': 0.85 },
      },
      {
        id: 'piezo-route-nodes',
        type: 'circle',
        filter: ['==', ['get', 'node'], true],
        paint: {
          'circle-radius': 4,
          'circle-color': '#ff6f00',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      },
    ]
  );

  // Центрируем карту на маршруте
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  mapStore.map?.fitBounds(
    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
    { padding: 80, maxZoom: 18, duration: 800 }
  );
};

const undoTraceNode = () => {
  traceNodes.value = traceNodes.value.slice(0, -1);
  traceNodeFragments = traceNodeFragments.slice(0, traceNodes.value.length);
};

const clearTrace = () => {
  traceNodes.value = [];
  traceNodeFragments = [];
  piezometerCalc2.value = null;
  clearRouteHighlight();
};

const buildPiezometerRoute = async () => {
  if (traceNodes.value.length < 2) return;
  piezometerModalOpen.value = true;
  piezometerLoading.value = true;
  piezometerError.value = null;
  try {
    const res = await fastApiService.buildPiezometerRoute([...traceNodes.value], piezometerCalc2.value);
    piezometerRoute.value = res;
    piezometerPathData.value = res.path;
    piezometerHasCalc.value = res.has_calculation;
    piezometerTotalLength.value = res.total_length;
    highlightRoute(res.path);
  } catch (e: any) {
    piezometerError.value = formatApiError(e, 'Ошибка построения маршрута');
  } finally {
    piezometerLoading.value = false;
  }
};

const onPiezometerDouble = (calculationId: number | null) => {
  piezometerCalc2.value = calculationId;
  buildPiezometerRoute();
};

/** Загрузка сохранённого направления: опорные узлы → маршрут пьезометра */
const onPiezometerDirectionLoad = (nodes: number[]) => {
  clearTrace();
  if (!isTraceMode.value) toggleTraceMode();
  traceNodes.value = [...nodes];
  traceNodeFragments = nodes.map(() => null);
  buildPiezometerRoute();
};

const onPiezometerNodeHover = (nodeId: number) => {
  const node = piezometerPathData.value.find((p: any) => p.node_id === nodeId);
  if (!node || node.lng == null || node.lat == null || !mapStore.map) return;
  mapStore.map.flyTo({ center: [node.lng, node.lat], zoom: 18, duration: 600, essential: true });
};

/** Меню «Выберите объект» для инструментов: несколько объектов сети под курсором (QA F53) */
const chooseNetworkCandidate = async (
  candidates: PickCandidate[],
  point: { x: number; y: number }
): Promise<PickCandidate | null> => {
  const index = await mapStore.chooseFeature(candidates.map((c) => c.feature), point);
  return index === null ? null : candidates[index] ?? null;
};

const onMapClickForTrace = async (e: any) => {
  if (!isTraceMode.value) return;
  // Узлы фрагментов лежат друг на друге: берём узел фрагмента предыдущей точки маршрута,
  // иначе активного фрагмента; несколько — меню выбора (QA F28)
  const prevFragment = traceNodeFragments[traceNodeFragments.length - 1] ?? null;
  // Узлы в допуске вокруг курсора, ближайшие первыми
  const nearNodes = queryRenderedNear(mapStore.map, e.point).filter((f) => getNetworkFeatureKind(f) === 'node');
  const res = pickNetworkFeature(nearestGroup(nearNodes), {
    kind: 'node',
    fragmentIds: prevFragment ? [prevFragment] : fragmentStore.activeFragmentIds,
  });
  if (res.status === 'none') {
    useNotificationStore().showWarning('Кликните точнее по узлу сети.');
    return;
  }
  const node = res.status === 'single' ? res.candidate : await chooseNetworkCandidate(res.candidates, e.point);
  if (!node || !isTraceMode.value) return;
  const nodeId = node.id;
  // Не добавляем тот же узел дважды подряд
  if (traceNodes.value[traceNodes.value.length - 1] === nodeId) return;
  traceNodes.value = [...traceNodes.value, nodeId];
  traceNodeFragments = [...traceNodeFragments, node.fragmentId];

  // Маркер выбранной точки — на узле, а не в точке клика
  if (mapStore.map) {
    const coords = node.feature?.geometry?.type === 'Point' ? node.feature.geometry.coordinates : null;
    const marker = new maplibregl.Marker({
      color: traceNodes.value.length === 1 ? '#2e7d32' : '#1976d2',
    })
      .setLngLat(Array.isArray(coords) ? [Number(coords[0]), Number(coords[1])] : e.lngLat)
      .addTo(mapStore.map);
    traceNodeMarkers.push(marker);
  }
};

// === Topology Edit Mode (composables/useTopologyEditor) ===
const topologyEditor = useTopologyEditor({
  getMap: () => mapStore.map,
  enabled: topologyEditingEnabled,
  isTraceMode,
  isDrawActive: () => activeDrawMode.value !== 'none',
  setIdentifyMode: (enabled: boolean) => mapStore.setIdentifyMode(enabled),
  refreshLayers: () => layerStore.refreshVisibleDataLayers(),
  getSelectedFeature: () => mapStore.potentialFeatures?.[0],
  closeCard: () => attributePanelRef.value?.close(),
  getActiveFragmentIds: () => fragmentStore.activeFragmentIds,
  chooseCandidate: chooseNetworkCandidate,
});
const {
  isEditTopologyMode,
  isMergeMode,
  mergeTargetNodeId,
  mergeSourceNodeId,
  mergeConfirmDialogOpen,
  mergeLoading,
  mergePreviewReport,
  mergePreviewLoading,
  mergePreviewError,
  lastTopologyOperation,
  undoBusy,
  isVertexMode,
  vertexEditor,
  splitPreviewOpen,
  splitPreviewLoading,
  splitPreviewConfirming,
  splitPreviewError,
  splitPreviewReport,
  splitPreviewTarget,
  onCardRefreshLayers,
  undoLastTopologyOperation,
  toggleEditTopologyMode,
  toggleVertexMode,
  toggleMergeMode,
  cancelMerge,
  confirmMerge,
  confirmSplit,
  cancelSplit,
  onDeleteFeature,
} = topologyEditor;

// === Контуры журналов (этап 9): слой контура и выбор участков кликом ===
const journalContourLayer = useJournalContourLayer(() => mapStore.map, {
  fragmentIds: () => fragmentStore.activeFragmentIds,
  onPickHint: (text: string) => useNotificationStore().showInfo(text),
});


// === Диалоги инструментов: компонент и обработчики событий (порядок монтирования как в шаблоне) ===
interface ToolDialogEntry {
  key: ToolDialogKey;
  component: Component;
  on?: Record<string, (...args: any[]) => void>;
}
const lazyDialog = (loader: () => Promise<any>) => markRaw(defineAsyncComponent(loader));
const openDefect = (defectId: unknown) => openLazyDialog('defect', { defectId });

const toolDialogs: ToolDialogEntry[] = [
  { key: 'passport', component: lazyDialog(() => import('./PassportDialog.vue')) },
  { key: 'defect', component: lazyDialog(() => import('./DefectJournalDialog.vue')), on: { locateDefect: locate.defect } },
  { key: 'shurf', component: lazyDialog(() => import('./ShurfJournalDialog.vue')), on: { locateShurf: locate.shurf, openDefect } },
  { key: 'inspection', component: lazyDialog(() => import('./InspectionJournalDialog.vue')), on: { locateInspection: locate.inspection, openDefect } },
  { key: 'repair', component: lazyDialog(() => import('./RepairJournalDialog.vue')), on: { locateRepair: locate.repair, openDefect } },
  { key: 'pressureTest', component: lazyDialog(() => import('./PressureTestJournalDialog.vue')), on: { locatePressureTest: locate.pressureTest, openDefect } },
  { key: 'ocheredOpressovok', component: lazyDialog(() => import('./OcheredOpressovokDialog.vue')) },
  { key: 'technicalCondition', component: lazyDialog(() => import('./TechnicalConditionJournalDialog.vue')), on: { locateTechnicalCondition: locate.technicalCondition } },
  { key: 'corrosionIndicator', component: lazyDialog(() => import('./CorrosionIndicatorJournalDialog.vue')), on: { locateCorrosionIndicator: locate.corrosionIndicator } },
  { key: 'alseko', component: lazyDialog(() => import('./AlsekoJournalDialog.vue')), on: { locateAlseko: locate.alseko } },
  { key: 'electricalNetwork', component: lazyDialog(() => import('./ElectricalNetworkJournalDialog.vue')), on: { locateElectricalObject: locate.electricalNetwork } },
  { key: 'heatLoss', component: lazyDialog(() => import('./HeatLossJournalDialog.vue')), on: { locateHeatSource: locate.heatSource } },
  { key: 'temperatureGraph', component: lazyDialog(() => import('./TemperatureGraphJournalDialog.vue')), on: { locateSource: locate.heatSource } },
  { key: 'consumerLoad', component: lazyDialog(() => import('./ConsumerLoadDiagnosticsDialog.vue')), on: { locateConsumer: locate.consumer } },
  { key: 'pumpEquipment', component: lazyDialog(() => import('./PumpEquipmentJournalDialog.vue')), on: { locatePump: locate.pump } },
  { key: 'networkArmature', component: lazyDialog(() => import('./NetworkArmatureJournalDialog.vue')), on: { locateArmature: locate.armature } },
  { key: 'networkRegulator', component: lazyDialog(() => import('./NetworkRegulatorJournalDialog.vue')), on: { locateRegulator: locate.regulator } },
  { key: 'networkBypass', component: lazyDialog(() => import('./NetworkBypassJournalDialog.vue')), on: { locateBypass: locate.bypass } },
  { key: 'networkDiaphragm', component: lazyDialog(() => import('./NetworkDiaphragmJournalDialog.vue')), on: { locateDiaphragm: locate.diaphragm } },
  { key: 'elevator', component: lazyDialog(() => import('./ElevatorJournalDialog.vue')), on: { locateElevator: locate.elevator } },
  { key: 'networkQueries', component: lazyDialog(() => import('./NetworkQueriesDialog.vue')), on: { locate: locate.fault } },
  // Desktop TGID «Анализ»: режим, допустимость, гидростатические зоны
  { key: 'regimeAnalysis', component: lazyDialog(() => import('./RegimeAnalysisDialog.vue')), on: { locate: locate.fault, showAll: showRegimePoints, clearMap: () => regimeOverlay.clear() } },
  // Desktop TGID «Excel»: отчёты по шаблонам gid6 excel2 и сводные ведомости
  { key: 'excelReports', component: lazyDialog(() => import('./ExcelReportsDialog.vue')) },
  // Локализация аварий и задвижек
  {
    key: 'outageSimulation',
    component: lazyDialog(() => import('./OutageSimulationDialog.vue')),
    on: { showOnMap: onShowOutageOnMap, clearHighlight: onClearOutageHighlight, focusCoords: onFocusCoords },
  },
  // Калькулятор дросселирования (шайбы и элеваторы)
  { key: 'throttlingCalculator', component: lazyDialog(() => import('./ThrottlingCalculatorDialog.vue')) },
  // Гидравлический режим и стрелки потоков
  {
    key: 'hydraulicThematic',
    component: lazyDialog(() => import('./HydraulicThematicDialog.vue')),
    on: {
      applyThematic: onApplyHydraulicThematic,
      updateThematicSettings: onUpdateHydraulicThematicSettings,
      clearThematic: onClearHydraulicThematic,
    },
  },
  { key: 'topologyDiagnostics', component: lazyDialog(() => import('./TopologyDiagnosticsModal.vue')), on: { locateFault: locate.fault } },
  {
    key: 'faultDiagnostics',
    component: lazyDialog(() => import('./FaultDiagnosticsModal.vue')),
    on: { openDefect, openCorrosion: (indicatorId: unknown) => openLazyDialog('corrosionIndicator', { indicatorId }) },
  },
  { key: 'calculationDiagnostics', component: lazyDialog(() => import('./CalculationDiagnosticsModal.vue')) },
  // Администрирование: пользователи и роли (только admin), история правок audit_log
  { key: 'usersAdmin', component: lazyDialog(() => import('./UsersAdminDialog.vue')) },
  { key: 'auditHistory', component: lazyDialog(() => import('./AuditHistoryDialog.vue')) },
  // Исходные данные (этап 9): участки ПТС, групповые установщики aSet* и справочники
  { key: 'ptsSites', component: lazyDialog(() => import('./PtsSitesDialog.vue')) },
  { key: 'groupSetters', component: lazyDialog(() => import('./GroupSetterDialog.vue')) },
  { key: 'dictionaries', component: lazyDialog(() => import('./DictionariesDialog.vue')) },
  // Этап 10: печать карты в макет (PNG/PDF), импорт SHP / Excel / координат узлов
  { key: 'printLayout', component: lazyDialog(() => import('./PrintLayoutDialog.vue')) },
  { key: 'networkImport', component: lazyDialog(() => import('./NetworkImportDialog.vue')) },
];

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
    mapStore.map?.on('click', onMapClickForTrace);
    if (mapStore.map) topologyEditor.attach(mapStore.map);
    if (mapStore.map) journalContourLayer.attach(mapStore.map);
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
  // MapLibre меняет подложку сразу; 3D берёт её из mapStore.selectedBaseLayer (CesiumViewer)
  void mapStore.updateBaseLayer(layerId);
}

const onIdentifyModeChange = (enabled: boolean) => {
  mapStore.setIdentifyMode(enabled);
  if (process.client) {
    const currentState = savedPageState.value ?? {};
    savedPageState.value = { ...currentState, identifyMode: enabled };
    appStorage.setItem(PAGE_STATE_KEY, JSON.stringify(savedPageState.value));
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
    cesiumStore.loadSavedViewMode();
    window.addEventListener('pagehide', onPageHideBfCache);
    window.addEventListener('pageshow', onPageShowBfCache);
    const rawSavedState = appStorage.getItem(PAGE_STATE_KEY);
    if (rawSavedState) {
      try {
        savedPageState.value = JSON.parse(rawSavedState);
      } catch {
        savedPageState.value = null;
      }
    }
    initMap();
    // Wire AttributePanel into mapStore so any click on a feature opens it.
    // Панель лениво монтируется при первом identify-клике, поэтому дожидаемся её загрузки.
    mapStore._attributePanelShow = (properties: Record<string, any>) => {
      mountedDialogs.attributePanel = true;
      if (attributePanelRef.value) {
        attributePanelRef.value.show(properties);
        return;
      }
      const stop = watch(attributePanelRef, (panel) => {
        if (!panel) return;
        stop();
        panel.show(properties);
      });
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
  mapStore.map?.off('click', onMapClickForTrace);
  journalContourLayer.detach(mapStore.map);
  topologyEditor.detach(mapStore.map);
  clearRouteHighlight();
  cesiumStore.cleanup();
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
/* Панель построения маршрута пьезометра */
.trace-panel {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  width: min(360px, calc(100vw - 32px));
  background: rgb(var(--v-theme-surface));

  &__header {
    display: flex;
    align-items: center;
  }

  .trace-chips {
    max-height: 96px;
    overflow-y: auto;
  }
}

@media (max-width: 600px) {
  .trace-panel {
    top: 8px;
    width: calc(100vw - 16px);
  }
}

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

.topology-edit-toolbar {
  position: absolute;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 24px;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
</style>
