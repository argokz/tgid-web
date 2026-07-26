<template>
  <client-only>
    <div class="map-viewer-root">
    <div class="map-container">
      <!-- 2D Map (MapLibre) -->
      <div v-show="cesiumStore.viewMode === '2D'" id="map" class="map-canvas-host" />
      
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
        @open-topology-diagnostics="openLazyDialog('topologyDiagnostics')"
        @open-fault-diagnostics="openLazyDialog('faultDiagnostics')"
        @open-calculation-diagnostics="openLazyDialog('calculationDiagnostics')"
        @toggle-trace-mode="toggleTraceMode"
        @toggle-edit-topology-mode="toggleEditTopologyMode"
        @open-passport-dialog="openLazyDialog('passport')"
        @open-defect-journal="openLazyDialog('defect')"
        @open-shurf-journal="openLazyDialog('shurf')"
        @open-inspection-journal="openLazyDialog('inspection')"
        @open-repair-journal="openLazyDialog('repair')"
        @open-pressure-test-journal="openLazyDialog('pressureTest')"
        @open-technical-condition-journal="openLazyDialog('technicalCondition')"
        @open-corrosion-indicator-journal="openLazyDialog('corrosionIndicator')"
        @open-alseko-journal="openLazyDialog('alseko')"
        @open-electrical-network-journal="openLazyDialog('electricalNetwork')"
        @open-heat-loss-journal="openLazyDialog('heatLoss')"
        @open-temperature-graph-journal="openLazyDialog('temperatureGraph')"
        @open-consumer-load-diagnostics="openLazyDialog('consumerLoad')"
        @open-pump-equipment="openLazyDialog('pumpEquipment')"
        @open-network-armatures="openLazyDialog('networkArmature')"
        @open-network-regulators="openLazyDialog('networkRegulator')"
        @open-network-bypasses="openLazyDialog('networkBypass')"
        @open-network-diaphragms="openLazyDialog('networkDiaphragm')"
        @open-elevators="openLazyDialog('elevator')"
      />

      <!-- Диалоги журналов монтируются лениво: чанк подгружается при первом открытии через openLazyDialog -->
      <!-- Passports Tree Dialog -->
      <LazyPassportDialog v-if="mountedDialogs.passport" ref="passportDialogRef" />

      <!-- Desktop TGID defect journal -->
      <LazyDefectJournalDialog
        v-if="mountedDialogs.defect"
        ref="defectJournalRef"
        @locate-defect="onLocateDefect"
      />

      <!-- Desktop TGID shurf journal -->
      <LazyShurfJournalDialog
        v-if="mountedDialogs.shurf"
        ref="shurfJournalRef"
        @locate-shurf="onLocateShurf"
        @open-defect="openLazyDialog('defect', { defectId: $event })"
      />

      <!-- Desktop TGID inspection journal -->
      <LazyInspectionJournalDialog
        v-if="mountedDialogs.inspection"
        ref="inspectionJournalRef"
        @locate-inspection="onLocateInspection"
        @open-defect="openLazyDialog('defect', { defectId: $event })"
      />

      <!-- Desktop TGID repair journal -->
      <LazyRepairJournalDialog
        v-if="mountedDialogs.repair"
        ref="repairJournalRef"
        @locate-repair="onLocateRepair"
        @open-defect="openLazyDialog('defect', { defectId: $event })"
      />

      <!-- Desktop TGID pressure test journal -->
      <LazyPressureTestJournalDialog
        v-if="mountedDialogs.pressureTest"
        ref="pressureTestJournalRef"
        @locate-pressure-test="onLocatePressureTest"
        @open-defect="openLazyDialog('defect', { defectId: $event })"
      />

      <LazyOcheredOpressovokDialog
        v-if="mountedDialogs.ocheredOpressovok"
        ref="ocheredOpressovokRef"
      />

      <!-- Desktop TGID technical conditions registry -->
      <LazyTechnicalConditionJournalDialog
        v-if="mountedDialogs.technicalCondition"
        ref="technicalConditionJournalRef"
        @locate-technical-condition="onLocateTechnicalCondition"
      />

      <!-- Desktop TGID corrosion indicator journal -->
      <LazyCorrosionIndicatorJournalDialog
        v-if="mountedDialogs.corrosionIndicator"
        ref="corrosionIndicatorJournalRef"
        @locate-corrosion-indicator="onLocateCorrosionIndicator"
      />

      <!-- Desktop TGID ALSEKO contractual load registry -->
      <LazyAlsekoJournalDialog
        v-if="mountedDialogs.alseko"
        ref="alsekoJournalRef"
        @locate-alseko="onLocateAlseko"
      />

      <!-- Desktop TGID electrical network inventory -->
      <LazyElectricalNetworkJournalDialog
        v-if="mountedDialogs.electricalNetwork"
        ref="electricalNetworkJournalRef"
        @locate-electrical-object="onLocateElectricalObject"
      />

      <!-- Desktop TGID heat-loss seasons and source readiness -->
      <LazyHeatLossJournalDialog
        v-if="mountedDialogs.heatLoss"
        ref="heatLossJournalRef"
        @locate-heat-source="onLocateHeatSource"
      />

      <!-- Desktop TGID temperature graphs and source operating conditions -->
      <LazyTemperatureGraphJournalDialog
        v-if="mountedDialogs.temperatureGraph"
        ref="temperatureGraphJournalRef"
        @locate-source="onLocateHeatSource"
      />

      <!-- Desktop TGID consumer load diagnostics -->
      <LazyConsumerLoadDiagnosticsDialog
        v-if="mountedDialogs.consumerLoad"
        ref="consumerLoadDiagnosticsRef"
        @locate-consumer="onLocateConsumer"
      />

      <!-- Desktop TGID pump inventory, catalog and characteristic curves -->
      <LazyPumpEquipmentJournalDialog
        v-if="mountedDialogs.pumpEquipment"
        ref="pumpEquipmentJournalRef"
        @locate-pump="onLocatePump"
      />

      <!-- Desktop TGID network dampers and regulating armatures -->
      <LazyNetworkArmatureJournalDialog
        v-if="mountedDialogs.networkArmature"
        ref="networkArmatureJournalRef"
        @locate-armature="onLocateArmature"
      />

      <!-- Desktop TGID pressure, flow and differential-pressure regulators -->
      <LazyNetworkRegulatorJournalDialog
        v-if="mountedDialogs.networkRegulator"
        ref="networkRegulatorJournalRef"
        @locate-regulator="onLocateRegulator"
      />

      <!-- Desktop TGID bypasses on external heat pipelines -->
      <LazyNetworkBypassJournalDialog
        v-if="mountedDialogs.networkBypass"
        ref="networkBypassJournalRef"
        @locate-bypass="onLocateBypass"
      />

      <!-- Desktop TGID diaphragms on external heat pipelines -->
      <LazyNetworkDiaphragmJournalDialog
        v-if="mountedDialogs.networkDiaphragm"
        ref="networkDiaphragmJournalRef"
        @locate-diaphragm="onLocateDiaphragm"
      />

      <!-- Desktop TGID elevator inventory -->
      <LazyElevatorJournalDialog
        v-if="mountedDialogs.elevator"
        ref="elevatorJournalRef"
        @locate-elevator="onLocateElevator"
      />

      <LazyNetworkQueriesDialog
        v-if="mountedDialogs.networkQueries"
        ref="networkQueriesRef"
      />

      <!-- Topology diagnostics modal -->
      <LazyTopologyDiagnosticsModal
        v-if="mountedDialogs.topologyDiagnostics"
        ref="topologyDiagnosticsRef"
        @locate-fault="handleLocateFault"
      />

      <!-- Fault diagnostics modal -->
      <LazyFaultDiagnosticsModal
        v-if="mountedDialogs.faultDiagnostics"
        ref="faultDiagnosticsRef"
        @open-defect="openLazyDialog('defect', { defectId: $event })"
        @open-corrosion="openLazyDialog('corrosionIndicator', { indicatorId: $event })"
      />

      <!-- Calculation diagnostics modal -->
      <LazyCalculationDiagnosticsModal
        v-if="mountedDialogs.calculationDiagnostics"
        ref="calculationDiagnosticsRef"
      />

      <!-- Attribute properties panel dialog (лениво: монтируется при первом identify-клике) -->
      <LazyAttributePanel
        v-if="mountedDialogs.attributePanel"
        ref="attributePanelRef"
        :is-edit-topology-mode="isEditTopologyMode"
        @delete-feature="onDeleteFeature"
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
      />

      <!-- Node search dialog -->
      <LazyNodeSearch
        v-if="mountedDialogs.nodeSearch"
        ref="nodeSearchRef"
        :map="mapStore.map"
      />

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
          <v-icon size="18" color="primary" class="me-2">mdi-chart-line-variant</v-icon>
          <span class="text-subtitle-2 font-weight-bold">Маршрут пьезометра</span>
          <v-spacer />
          <v-btn icon size="x-small" variant="text" aria-label="Закрыть трассировку" @click="toggleTraceMode">
            <v-icon size="18">mdi-close</v-icon>
          </v-btn>
        </div>
        <v-divider />
        <div class="pa-3">
          <div class="text-caption text-medium-emphasis mb-2">
            Кликайте по узлам сети — маршрут пройдёт через них по порядку.
          </div>
          <div v-if="traceNodes.length" class="trace-chips mb-2">
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
          <div v-else class="text-caption text-disabled mb-2">Узлы не выбраны</div>
          <div class="d-flex flex-wrap" style="gap: 6px;">
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
            <v-btn size="small" variant="text" :disabled="!traceNodes.length" @click="undoTraceNode">
              Отменить точку
            </v-btn>
            <v-spacer />
            <v-btn size="small" variant="text" color="error" :disabled="!traceNodes.length" @click="clearTrace">
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
        @node-hover="onPiezometerNodeHover"
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
import { useCesiumStore } from '~/stores/cesiumStore';
import { useUiStore } from '~/stores/uiStore';
import type { ToolEvent } from '~/utils/toolCatalog';
import type { LayerConfig } from '~/types';
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { markPerf, measurePerf, timeAsync } from '~/utils/perf';
import { useNotificationStore } from '~/stores/notificationStore';
import { fastApiService } from '~/services/fastApiService';
import maplibregl from 'maplibre-gl';

const props = defineProps<{
  initialLayers: LayerConfig[];
  layersLoading?: boolean;
  layersError?: boolean;
}>();
defineEmits<{ (e: 'retry-layers'): void }>();

const mapStore = useMapStore();
const popupStore = usePopupStore();
const layerStore = useLayerStore();
const cesiumStore = useCesiumStore();
const uiStore = useUiStore();
/** Панель инструментов остаётся смонтированной после первого открытия (сохраняет поиск/скролл) */
const toolsPanelMounted = ref(false);
watch(() => uiStore.toolsPanelOpen, (isOpen: boolean) => {
  if (isOpen) toolsPanelMounted.value = true;
});
const CesiumViewer = defineAsyncComponent(() => import('./CesiumViewer.vue'));
const runtimeConfig = useRuntimeConfig();
const topologyEditingEnabled = computed(
  () => runtimeConfig.public.topologyEditingEnabled === true
);
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

const syncCesiumCameraFromMap = () => {
  if (!mapStore.map || !cesiumStore.isInitialized) return;
  const center = mapStore.map.getCenter();
  cesiumStore.syncCameraFrom2D(
    [center.lng, center.lat],
    mapStore.map.getZoom(),
    mapStore.map.getBearing(),
    mapStore.map.getPitch()
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
    const state = cesiumStore.getCameraStateFor2D();
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
const nodeSearchMarker = ref<maplibregl.Marker | null>(null);
const topologyDiagnosticsRef = ref<{ openDialog: () => void } | null>(null);
const faultDiagnosticsRef = ref<{ openDialog: () => void } | null>(null);
const calculationDiagnosticsRef = ref<{ openDialog: () => void } | null>(null);
const passportDialogRef = ref<{ openDialog: () => void } | null>(null);
const defectJournalRef = ref<{
  openDialog: (scope?: { lineId?: number; nodeId?: number; defectId?: number }) => void
} | null>(null);
const shurfJournalRef = ref<{
  openDialog: (scope?: { lineId?: number; nodeId?: number; shurfId?: number }) => void
} | null>(null);
const inspectionJournalRef = ref<{
  openDialog: (scope?: { lineId?: number; nodeId?: number; inspectionId?: number }) => void
} | null>(null);
const repairJournalRef = ref<{
  openDialog: (scope?: { lineId?: number; nodeId?: number; repairId?: number }) => void
} | null>(null);
const pressureTestJournalRef = ref<{
  openDialog: (scope?: { lineId?: number; nodeId?: number; testId?: number }) => void
} | null>(null);
const ocheredOpressovokRef = ref<{
  openDialog: () => void
} | null>(null);
const technicalConditionJournalRef = ref<{
  openDialog: (scope?: { buildingId?: number; pipeId?: number; conditionId?: number }) => void
} | null>(null);
const corrosionIndicatorJournalRef = ref<{
  openDialog: (scope?: { lineId?: number; nodeId?: number; indicatorId?: number }) => void
} | null>(null);
const alsekoJournalRef = ref<{
  openDialog: (scope?: { loadId?: number; buildingId?: number }) => void
} | null>(null);
const electricalNetworkJournalRef = ref<{
  openDialog: (scope?: { objectType?: 'source' | 'line' | 'receiver' | 'channel' | 'coupling' | 'support' | 'sleeve'; objectId?: number; parentLineId?: number }) => void
} | null>(null);
const heatLossJournalRef = ref<{
  openDialog: (scope?: { sourceId?: number; seasonId?: number }) => void
} | null>(null);
const temperatureGraphJournalRef = ref<{
  openDialog: (scope?: { sourceId?: number; nodeId?: number; graphStatus?: 'ready' | 'missing' | 'duplicates' | 'incomplete' }) => void
} | null>(null);
const consumerLoadDiagnosticsRef = ref<{
  openDialog: (scope?: { consumerType?: 'generalized' | 'real'; consumerId?: number; nodeId?: number; diagnostic?: 'zero_load' | 'closed' | 'disconnected' | 'not_calculated' }) => void
} | null>(null);
const pumpEquipmentJournalRef = ref<{
  openDialog: (scope?: { pumpId?: number; standardPumpId?: number; lineId?: number }) => void
} | null>(null);
const networkArmatureJournalRef = ref<{
  openDialog: (scope?: { equipmentType?: 'damper' | 'regulating'; armatureId?: number; standardId?: number; lineId?: number }) => void
} | null>(null);
const networkRegulatorJournalRef = ref<{
  openDialog: (scope?: { regulatorType?: 'pressure' | 'flow' | 'differential'; regulatorId?: number; catalogType?: 'pressure' | 'flow' | 'differential'; catalogId?: number; lineId?: number }) => void
} | null>(null);
const networkBypassJournalRef = ref<{
  openDialog: (scope?: { bypassId?: number; standardTubeId?: number; lineId?: number }) => void
} | null>(null);
const networkDiaphragmJournalRef = ref<{
  openDialog: (scope?: { diaphragmId?: number; lineId?: number }) => void
} | null>(null);
const elevatorJournalRef = ref<{
  openDialog: (scope?: { elevatorId?: number; lineId?: number; nodeId?: number }) => void
} | null>(null);
const networkQueriesRef = ref<{ openDialog: () => void } | null>(null);

/**
 * Ленивое монтирование диалогов: тяжёлые журналы не попадают в основной чанк карты,
 * их код загружается при первом открытии. openLazyDialog поднимает флаг монтирования
 * и, если компонент ещё не загружен, дожидается появления ref перед вызовом openDialog.
 */
type LazyDialogKey =
  | 'nodeSearch'
  | 'topologyDiagnostics'
  | 'faultDiagnostics'
  | 'calculationDiagnostics'
  | 'passport'
  | 'defect'
  | 'shurf'
  | 'inspection'
  | 'repair'
  | 'pressureTest'
  | 'ocheredOpressovok'
  | 'technicalCondition'
  | 'corrosionIndicator'
  | 'alseko'
  | 'electricalNetwork'
  | 'heatLoss'
  | 'temperatureGraph'
  | 'consumerLoad'
  | 'pumpEquipment'
  | 'networkArmature'
  | 'networkRegulator'
  | 'networkBypass'
  | 'networkDiaphragm'
  | 'elevator'
  | 'networkQueries';

type LazyDialogInstance = { openDialog: (scope?: any) => void };

const mountedDialogs = reactive<Partial<Record<LazyDialogKey | 'attributePanel', boolean>>>({});

const lazyDialogRefs: Record<LazyDialogKey, Ref<LazyDialogInstance | null>> = {
  nodeSearch: nodeSearchRef,
  topologyDiagnostics: topologyDiagnosticsRef,
  faultDiagnostics: faultDiagnosticsRef,
  calculationDiagnostics: calculationDiagnosticsRef,
  passport: passportDialogRef,
  defect: defectJournalRef,
  shurf: shurfJournalRef,
  inspection: inspectionJournalRef,
  repair: repairJournalRef,
  pressureTest: pressureTestJournalRef,
  ocheredOpressovok: ocheredOpressovokRef,
  technicalCondition: technicalConditionJournalRef,
  corrosionIndicator: corrosionIndicatorJournalRef,
  alseko: alsekoJournalRef,
  electricalNetwork: electricalNetworkJournalRef,
  heatLoss: heatLossJournalRef,
  temperatureGraph: temperatureGraphJournalRef,
  consumerLoad: consumerLoadDiagnosticsRef,
  pumpEquipment: pumpEquipmentJournalRef,
  networkArmature: networkArmatureJournalRef,
  networkRegulator: networkRegulatorJournalRef,
  networkBypass: networkBypassJournalRef,
  networkDiaphragm: networkDiaphragmJournalRef,
  elevator: elevatorJournalRef,
  networkQueries: networkQueriesRef,
};

/** Событие панели инструментов → ключ ленивого диалога */
const TOOL_EVENT_TO_DIALOG: Record<ToolEvent, LazyDialogKey> = {
  'open-topology-diagnostics': 'topologyDiagnostics',
  'open-fault-diagnostics': 'faultDiagnostics',
  'open-calculation-diagnostics': 'calculationDiagnostics',
  'open-passport-dialog': 'passport',
  'open-defect-journal': 'defect',
  'open-shurf-journal': 'shurf',
  'open-inspection-journal': 'inspection',
  'open-repair-journal': 'repair',
  'open-pressure-test-journal': 'pressureTest',
  'open-ochered-opressovok': 'ocheredOpressovok',
  'open-technical-condition-journal': 'technicalCondition',
  'open-corrosion-indicator-journal': 'corrosionIndicator',
  'open-alseko-journal': 'alseko',
  'open-electrical-network-journal': 'electricalNetwork',
  'open-heat-loss-journal': 'heatLoss',
  'open-temperature-graph-journal': 'temperatureGraph',
  'open-consumer-load-diagnostics': 'consumerLoad',
  'open-pump-equipment': 'pumpEquipment',
  'open-network-armatures': 'networkArmature',
  'open-network-regulators': 'networkRegulator',
  'open-network-bypasses': 'networkBypass',
  'open-network-diaphragms': 'networkDiaphragm',
  'open-elevators': 'elevator',
  'open-network-queries': 'networkQueries',
};

const onOpenTool = (event: ToolEvent) => {
  const key = TOOL_EVENT_TO_DIALOG[event];
  if (key) openLazyDialog(key);
};

const openLazyDialog = (key: LazyDialogKey, scope?: unknown) => {
  mountedDialogs[key] = true;
  const target = lazyDialogRefs[key];
  if (target.value) {
    target.value.openDialog(scope);
    return;
  }
  const stop = watch(target, (instance: LazyDialogInstance | null) => {
    if (!instance) return;
    stop();
    instance.openDialog(scope);
  });
};

let defectLocateMarker: maplibregl.Marker | null = null;
let shurfLocateMarker: maplibregl.Marker | null = null;
let inspectionLocateMarker: maplibregl.Marker | null = null;
let repairLocateMarker: maplibregl.Marker | null = null;
let pressureTestLocateMarker: maplibregl.Marker | null = null;
let technicalConditionLocateMarker: maplibregl.Marker | null = null;
let corrosionIndicatorLocateMarker: maplibregl.Marker | null = null;
let alsekoLocateMarker: maplibregl.Marker | null = null;
let electricalNetworkLocateMarker: maplibregl.Marker | null = null;
let heatLossLocateMarker: maplibregl.Marker | null = null;
let consumerLoadLocateMarker: maplibregl.Marker | null = null;
let pumpLocateMarker: maplibregl.Marker | null = null;
let armatureLocateMarker: maplibregl.Marker | null = null;
let regulatorLocateMarker: maplibregl.Marker | null = null;
let bypassLocateMarker: maplibregl.Marker | null = null;
let diaphragmLocateMarker: maplibregl.Marker | null = null;
let elevatorLocateMarker: maplibregl.Marker | null = null;

const onLocateDefect = (coordinates: { longitude: number; latitude: number; id: number }) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 18, duration: 1400, essential: true });
  defectLocateMarker?.remove();
  defectLocateMarker = new maplibregl.Marker({ color: '#e65100' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(`Нарушение ${coordinates.id}`))
    .addTo(mapStore.map);
  defectLocateMarker.togglePopup();
};

const onLocateShurf = (coordinates: { longitude: number; latitude: number; id: number }) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 18, duration: 1400, essential: true });
  shurfLocateMarker?.remove();
  shurfLocateMarker = new maplibregl.Marker({ color: '#795548' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(`Шурф ${coordinates.id}`))
    .addTo(mapStore.map);
  shurfLocateMarker.togglePopup();
};

const onLocateInspection = (coordinates: {
  longitude: number
  latitude: number
  id: number
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 16, duration: 1400, essential: true });
  inspectionLocateMarker?.remove();
  inspectionLocateMarker = new maplibregl.Marker({ color: '#00796b' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Осмотр ${coordinates.id}`))
    .addTo(mapStore.map);
  inspectionLocateMarker.togglePopup();
};

const onLocateRepair = (coordinates: {
  longitude: number
  latitude: number
  id: number
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 16, duration: 1400, essential: true });
  repairLocateMarker?.remove();
  repairLocateMarker = new maplibregl.Marker({ color: '#5e35b1' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Ремонт ${coordinates.id}`))
    .addTo(mapStore.map);
  repairLocateMarker.togglePopup();
};

const onLocatePressureTest = (coordinates: {
  longitude: number
  latitude: number
  id: number
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 16, duration: 1400, essential: true });
  pressureTestLocateMarker?.remove();
  pressureTestLocateMarker = new maplibregl.Marker({ color: '#1565c0' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Опрессовка ${coordinates.id}`))
    .addTo(mapStore.map);
  pressureTestLocateMarker.togglePopup();
};

const onLocateTechnicalCondition = (coordinates: {
  longitude: number
  latitude: number
  id: number
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 18, duration: 1400, essential: true });
  technicalConditionLocateMarker?.remove();
  technicalConditionLocateMarker = new maplibregl.Marker({ color: '#00838f' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `ТУ ${coordinates.id}`))
    .addTo(mapStore.map);
  technicalConditionLocateMarker.togglePopup();
};

const onLocateCorrosionIndicator = (coordinates: {
  longitude: number
  latitude: number
  id: number
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 18, duration: 1400, essential: true });
  corrosionIndicatorLocateMarker?.remove();
  corrosionIndicatorLocateMarker = new maplibregl.Marker({ color: '#ef6c00' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Индикатор ${coordinates.id}`))
    .addTo(mapStore.map);
  corrosionIndicatorLocateMarker.togglePopup();
};

const onLocateAlseko = (coordinates: {
  longitude: number
  latitude: number
  id: number
  kind: 'load' | 'building'
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 18, duration: 1400, essential: true });
  alsekoLocateMarker?.remove();
  alsekoLocateMarker = new maplibregl.Marker({ color: '#3949ab' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `АЛСЕКО ${coordinates.id}`))
    .addTo(mapStore.map);
  alsekoLocateMarker.togglePopup();
};

const onLocateElectricalObject = (coordinates: {
  longitude: number
  latitude: number
  id: number
  objectType: string
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 18, duration: 1400, essential: true });
  electricalNetworkLocateMarker?.remove();
  electricalNetworkLocateMarker = new maplibregl.Marker({ color: '#ff8f00' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Объект электросети ${coordinates.id}`))
    .addTo(mapStore.map);
  electricalNetworkLocateMarker.togglePopup();
};

const onLocateHeatSource = (coordinates: {
  longitude: number
  latitude: number
  id: number
  nodeId: number
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 18, duration: 1400, essential: true });
  heatLossLocateMarker?.remove();
  heatLossLocateMarker = new maplibregl.Marker({ color: '#d84315' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Источник №${coordinates.id}`))
    .addTo(mapStore.map);
  heatLossLocateMarker.togglePopup();
};

const onLocateConsumer = (coordinates: {
  longitude: number
  latitude: number
  id: number
  nodeId: number
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 18, duration: 1400, essential: true });
  consumerLoadLocateMarker?.remove();
  consumerLoadLocateMarker = new maplibregl.Marker({ color: '#00796b' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Потребитель №${coordinates.id}`))
    .addTo(mapStore.map);
  consumerLoadLocateMarker.togglePopup();
};

const onLocatePump = (coordinates: {
  longitude: number
  latitude: number
  id: number
  lineId: number | null
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 19, duration: 1400, essential: true });
  pumpLocateMarker?.remove();
  pumpLocateMarker = new maplibregl.Marker({ color: '#37474f' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Насос №${coordinates.id}`))
    .addTo(mapStore.map);
  pumpLocateMarker.togglePopup();
};

const onLocateArmature = (coordinates: {
  longitude: number
  latitude: number
  id: number
  lineId: number | null
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 19, duration: 1400, essential: true });
  armatureLocateMarker?.remove();
  armatureLocateMarker = new maplibregl.Marker({ color: '#4527a0' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Арматура №${coordinates.id}`))
    .addTo(mapStore.map);
  armatureLocateMarker.togglePopup();
};

const onLocateRegulator = (coordinates: {
  longitude: number
  latitude: number
  id: number
  lineId: number | null
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 19, duration: 1400, essential: true });
  regulatorLocateMarker?.remove();
  regulatorLocateMarker = new maplibregl.Marker({ color: '#283593' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Регулятор №${coordinates.id}`))
    .addTo(mapStore.map);
  regulatorLocateMarker.togglePopup();
};

const onLocateBypass = (coordinates: {
  longitude: number
  latitude: number
  id: number
  lineId: number | null
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  mapStore.map.flyTo({ center: lngLat, zoom: 19, duration: 1400, essential: true });
  bypassLocateMarker?.remove();
  bypassLocateMarker = new maplibregl.Marker({ color: '#006064' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Байпас №${coordinates.id}`))
    .addTo(mapStore.map);
  bypassLocateMarker.togglePopup();
};

const onLocateDiaphragm = (coordinates: {
  longitude: number
  latitude: number
  id: number
  lineId: number | null
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  cesiumStore.setSyncedSelection({
    id: coordinates.id,
    longitude: coordinates.longitude,
    latitude: coordinates.latitude,
    label: coordinates.label,
    layerId: 'diaphragms',
  });
  mapStore.map.flyTo({ center: lngLat, zoom: 19, duration: 1400, essential: true });
  diaphragmLocateMarker?.remove();
  diaphragmLocateMarker = new maplibregl.Marker({ color: '#004d40' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Диафрагма №${coordinates.id}`))
    .addTo(mapStore.map);
  diaphragmLocateMarker.togglePopup();
};

const onLocateElevator = (coordinates: {
  longitude: number
  latitude: number
  id: number
  lineId: number | null
  label: string
}) => {
  if (!mapStore.map) return;
  const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude];
  cesiumStore.setSyncedSelection({
    id: coordinates.id,
    longitude: coordinates.longitude,
    latitude: coordinates.latitude,
    label: coordinates.label,
    layerId: 'elevators',
  });
  mapStore.map.flyTo({ center: lngLat, zoom: 19, duration: 1400, essential: true });
  elevatorLocateMarker?.remove();
  elevatorLocateMarker = new maplibregl.Marker({ color: '#263238' })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(coordinates.label || `Элеватор №${coordinates.id}`))
    .addTo(mapStore.map);
  elevatorLocateMarker.togglePopup();
};

// === Trace Mode for Piezometric Graph ===
// Маршрут задаётся последовательностью узлов (waypoints), как выделение
// направления в десктопе: путь строится через все выбранные точки по порядку.
const isTraceMode = ref(false);
const traceNodes = ref<number[]>([]);
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
const routeSourceId = 'piezo-route-source';
const routeLineLayer = 'piezo-route-line';
const routeNodeLayer = 'piezo-route-nodes';
const traceNodeMarkers: maplibregl.Marker[] = [];

const toggleTraceMode = () => {
  isTraceMode.value = !isTraceMode.value;
  if (isTraceMode.value) {
    clearTrace();
    mapStore.setIdentifyMode(false); // отключаем обычный identify-клик
    useNotificationStore().showSuccess('Режим трассировки: кликайте по узлам маршрута.');
  } else {
    clearTrace();
    mapStore.setIdentifyMode(true);
  }
};

const clearRouteHighlight = () => {
  const map = mapStore.map;
  traceNodeMarkers.forEach((m) => m.remove());
  traceNodeMarkers.length = 0;
  if (!map) return;
  if (map.getLayer(routeNodeLayer)) map.removeLayer(routeNodeLayer);
  if (map.getLayer(routeLineLayer)) map.removeLayer(routeLineLayer);
  if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);
};

/** Подсветка построенного маршрута линией + маркерами по узлам */
const highlightRoute = (path: Array<{ node_id: number; lng: number | null; lat: number | null; label: string }>) => {
  const map = mapStore.map;
  if (!map) return;
  // Стиль мог быть не готов (HMR / смена подложки) — addSource тогда бросает
  if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
    map.once('idle', () => highlightRoute(path));
    return;
  }
  clearRouteHighlight();

  const coords = path
    .filter((p) => p.lng != null && p.lat != null)
    .map((p) => [p.lng as number, p.lat as number]);
  if (coords.length < 2) return;

  try {
    addRouteLayers(map, path, coords);
  } catch (e) {
    console.warn('[piezometer] не удалось подсветить маршрут:', e);
  }
};

const addRouteLayers = (
  map: maplibregl.Map,
  path: Array<{ lng: number | null; lat: number | null }>,
  coords: number[][]
) => {
  map.addSource(routeSourceId, {
    type: 'geojson',
    data: {
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
  });
  map.addLayer({
    id: routeLineLayer,
    type: 'line',
    source: routeSourceId,
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': '#ff6f00', 'line-width': 4, 'line-opacity': 0.85 },
  });
  map.addLayer({
    id: routeNodeLayer,
    type: 'circle',
    source: routeSourceId,
    filter: ['==', ['get', 'node'], true],
    paint: {
      'circle-radius': 4,
      'circle-color': '#ff6f00',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  });

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
};

const clearTrace = () => {
  traceNodes.value = [];
  clearRouteHighlight();
};

const buildPiezometerRoute = async () => {
  if (traceNodes.value.length < 2) return;
  piezometerModalOpen.value = true;
  piezometerLoading.value = true;
  piezometerError.value = null;
  try {
    const res = await fastApiService.buildPiezometerRoute([...traceNodes.value]);
    piezometerPathData.value = res.path;
    piezometerHasCalc.value = res.has_calculation;
    piezometerTotalLength.value = res.total_length;
    highlightRoute(res.path);
  } catch (e: any) {
    piezometerError.value = e?.userMessage || e?.message || 'Ошибка построения маршрута';
  } finally {
    piezometerLoading.value = false;
  }
};

const onPiezometerNodeHover = (nodeId: number) => {
  const node = piezometerPathData.value.find((p: any) => p.node_id === nodeId);
  if (!node || node.lng == null || node.lat == null || !mapStore.map) return;
  mapStore.map.flyTo({ center: [node.lng, node.lat], zoom: 18, duration: 600, essential: true });
};

const onMapClickForTrace = (e: any) => {
  if (!isTraceMode.value) return;
  const features = mapStore.map?.queryRenderedFeatures(e.point);
  const nodeFeature = features?.find((feature: any) => getFeatureKind(feature) === 'node');
  if (!nodeFeature || !nodeFeature.properties) {
    useNotificationStore().showWarning('Кликните точнее по узлу сети.');
    return;
  }
  const id = nodeFeature.properties.id || nodeFeature.properties.Id || nodeFeature.id;
  if (!id) return;
  const nodeId = Number(id);
  // Не добавляем тот же узел дважды подряд
  if (traceNodes.value[traceNodes.value.length - 1] === nodeId) return;
  traceNodes.value = [...traceNodes.value, nodeId];

  // Маркер выбранной точки
  if (mapStore.map) {
    const marker = new maplibregl.Marker({
      color: traceNodes.value.length === 1 ? '#2e7d32' : '#1976d2',
    })
      .setLngLat(e.lngLat)
      .addTo(mapStore.map);
    traceNodeMarkers.push(marker);
  }
};

// === Topology Edit Mode ===
const isEditTopologyMode = ref(false);
const topologyStartNode = ref<number | null>(null);
let draggedNodeMarker: maplibregl.Marker | null = null;
let draggedNodeId: number | null = null;
let suppressTopologyClickUntil = 0;

// Превью разрезания линии (dry-run → подтверждение → запись)
const splitPreviewOpen = ref(false);
const splitPreviewLoading = ref(false);
const splitPreviewConfirming = ref(false);
const splitPreviewError = ref<string | null>(null);
const splitPreviewReport = ref<import('~/services/fastApiService').SplitTransferReport | null>(null);
const splitPreviewTarget = ref<{ lineId: number; lng: number; lat: number } | null>(null);

const openSplitPreview = async (lineId: number, lng: number, lat: number) => {
  splitPreviewTarget.value = { lineId, lng, lat };
  splitPreviewReport.value = null;
  splitPreviewError.value = null;
  splitPreviewLoading.value = true;
  splitPreviewOpen.value = true;
  try {
    const preview = await fastApiService.previewSplitLine(lineId, lng, lat);
    splitPreviewReport.value = preview.transferred;
  } catch (err: any) {
    splitPreviewError.value = err?.userMessage || err?.message || 'Не удалось получить превью';
  } finally {
    splitPreviewLoading.value = false;
  }
};

const confirmSplit = async () => {
  const target = splitPreviewTarget.value;
  if (!target) return;
  splitPreviewConfirming.value = true;
  try {
    const result = await fastApiService.splitLine(target.lineId, target.lng, target.lat);
    useNotificationStore().showSuccess(
      `Участок ${target.lineId} разрезан: узел ${result.new_node_id}, участок ${result.new_line_id}`
    );
    layerStore.refreshVisibleDataLayers();
    splitPreviewOpen.value = false;
  } catch (err: any) {
    useNotificationStore().showError('Ошибка разрезания: ' + (err?.userMessage || err?.message || ''));
  } finally {
    splitPreviewConfirming.value = false;
    splitPreviewTarget.value = null;
  }
};

const cancelSplit = () => {
  splitPreviewTarget.value = null;
};

const getFeatureKind = (feature: any): 'node' | 'line' | null => {
  const signature = [
    feature?.layer?.id,
    feature?.sourceLayer,
    feature?.layer?.['source-layer'],
    feature?.properties?.table,
    feature?.properties?.type
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (signature.includes('node') || signature.includes('узел')) return 'node';
  if (
    signature.includes('line')
    || signature.includes('pipe')
    || signature.includes('heatpipesection')
    || signature.includes('труб')
  ) return 'line';

  const geometryType = feature?.geometry?.type;
  if (geometryType === 'Point' || geometryType === 'MultiPoint') return 'node';
  if (geometryType === 'LineString' || geometryType === 'MultiLineString') return 'line';
  return null;
};

const getFeatureId = (feature: any): number | null => {
  const rawId = feature?.properties?.id ?? feature?.properties?.Id ?? feature?.id;
  const id = Number(rawId);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const toggleEditTopologyMode = () => {
  isEditTopologyMode.value = !isEditTopologyMode.value;
  if (isEditTopologyMode.value) {
    topologyStartNode.value = null;
    isTraceMode.value = false;
    mapStore.setIdentifyMode(false);
    useNotificationStore().showSuccess('Режим редактирования сети включен. Клик по пустому месту — создать узел. Перетаскивание узла — переместить. Клик по двум узлам — создать участок.');
  } else {
    mapStore.setIdentifyMode(true);
    if (draggedNodeMarker) {
      draggedNodeMarker.remove();
      draggedNodeMarker = null;
    }
    draggedNodeId = null;
  }
};

const onMapMouseDownForTopology = (e: any) => {
  if (!isEditTopologyMode.value) return;
  const features = mapStore.map?.queryRenderedFeatures(e.point);
  const nodeFeature = features?.find((feature: any) => getFeatureKind(feature) === 'node');
  
  if (nodeFeature && nodeFeature.properties) {
    const id = getFeatureId(nodeFeature);
    if (!id) return;
    
    // Prevent default panning
    e.preventDefault();
    mapStore.map?.dragPan.disable();
    
    draggedNodeId = id;
    const pointCoordinates = nodeFeature.geometry?.type === 'Point'
      ? nodeFeature.geometry.coordinates
      : null;
    const coords = Array.isArray(pointCoordinates)
      ? { lng: Number(pointCoordinates[0]), lat: Number(pointCoordinates[1]) }
      : e.lngLat;
    
    // Create marker
    if (draggedNodeMarker) draggedNodeMarker.remove();
    draggedNodeMarker = new maplibregl.Marker({ color: 'red' })
      .setLngLat([coords.lng, coords.lat])
      .addTo(mapStore.map!);
  }
};

const onMapMouseMoveForTopology = (e: any) => {
  if (!isEditTopologyMode.value || !draggedNodeMarker || draggedNodeId === null) return;
  draggedNodeMarker.setLngLat(e.lngLat);
};

const onNodeDragEnd = async () => {
  if (!draggedNodeMarker || !draggedNodeId) return;
  
  const lngLat = draggedNodeMarker.getLngLat();
  const id = draggedNodeId;
  
  try {
    useNotificationStore().showInfo('Сохранение новой позиции...');
    await fastApiService.moveNode(id, lngLat.lng, lngLat.lat);
    useNotificationStore().showSuccess('Узел успешно перемещен');
    // Refresh layers
    const layerStore = useLayerStore();
    layerStore.refreshVisibleDataLayers();
  } catch (err: any) {
    useNotificationStore().showError('Ошибка перемещения узла: ' + err.message);
  } finally {
    mapStore.map?.dragPan.enable();
    draggedNodeMarker.remove();
    draggedNodeMarker = null;
    draggedNodeId = null;
    suppressTopologyClickUntil = Date.now() + 250;
  }
};

const onMapClickForTopology = async (e: any) => {
  if (!isEditTopologyMode.value) return;
  if (draggedNodeId !== null || Date.now() < suppressTopologyClickUntil) return;
  
  const features = mapStore.map?.queryRenderedFeatures(e.point);
  const nodeFeature = features?.find((feature: any) => getFeatureKind(feature) === 'node');
  const lineFeature = features?.find((feature: any) => getFeatureKind(feature) === 'line');
  
  if (nodeFeature && nodeFeature.properties) {
    const id = getFeatureId(nodeFeature);
    if (!id) return;
    
    // Line creation logic
    if (!topologyStartNode.value) {
      topologyStartNode.value = id;
      useNotificationStore().showSuccess(`Узел ${id} выбран. Кликните по другому узлу для создания участка.`);
    } else {
      if (topologyStartNode.value === id) {
        topologyStartNode.value = null; // deselect
        useNotificationStore().showInfo('Выбор узла отменен.');
        return;
      }
      // Create line
      try {
        await fastApiService.createLine(topologyStartNode.value, id);
        useNotificationStore().showSuccess(`Участок между ${topologyStartNode.value} и ${id} создан`);
        const layerStore = useLayerStore();
        layerStore.refreshVisibleDataLayers();
      } catch (err: any) {
        useNotificationStore().showError('Ошибка создания участка: ' + err.message);
      } finally {
        topologyStartNode.value = null;
      }
    }
    return;
  }

  if (lineFeature && lineFeature.properties) {
    const lineId = getFeatureId(lineFeature);
    if (!lineId) return;
    // Сначала превью (dry-run): показываем, что перенесётся, до записи
    await openSplitPreview(lineId, e.lngLat.lng, e.lngLat.lat);
    return;
  }

  try {
    const result = await fastApiService.createNode(e.lngLat.lng, e.lngLat.lat);
    useNotificationStore().showSuccess(`Узел ${result.id} создан`);
    layerStore.refreshVisibleDataLayers();
  } catch (err: any) {
    useNotificationStore().showError('Ошибка создания узла: ' + err.message);
  }
};

const onDeleteFeature = async (featureId: string | number) => {
  if (!confirm('Вы уверены, что хотите удалить объект?')) return;
  try {
    const selected = mapStore.potentialFeatures?.[0];
    if (!selected) return;
    
    // We try to figure out if it's a node or line based on layer
    const isNode = selected.layerId?.includes('node') || selected.layerName?.includes('node');
    
    if (isNode) {
      await fastApiService.deleteNode(Number(featureId));
      useNotificationStore().showSuccess('Узел и прилегающие участки удалены');
    } else {
      await fastApiService.deleteLine(Number(featureId));
      useNotificationStore().showSuccess('Участок удален');
    }
    attributePanelRef.value?.close();
    const layerStore = useLayerStore();
    layerStore.refreshVisibleDataLayers();
  } catch (err: any) {
    useNotificationStore().showError('Ошибка удаления: ' + err.message);
  }
};

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
    mapStore.map?.on('mousedown', onMapMouseDownForTopology);
    mapStore.map?.on('mousemove', onMapMouseMoveForTopology);
    mapStore.map?.on('mouseup', onNodeDragEnd);
    mapStore.map?.on('click', onMapClickForTopology);
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

const onBaseLayerChange = (_layerId: string) => {
  // Смена подложки касается только MapLibre; Cesium синхронизируется через собственный store
}

const handleLocateFault = (fault: { lat: number, lng: number }) => {
  if (fault.lat != null && fault.lng != null) {
    mapStore.map?.flyTo({ center: [fault.lng, fault.lat], zoom: 18, duration: 1400, essential: true })
    
    // Подсветка проблемной точки с использованием маркера nodeSearch
    if (mapStore.map) {
      if (nodeSearchMarker.value) {
        nodeSearchMarker.value.remove()
      }
      
      const el = document.createElement('div')
      el.className = 'fault-marker'
      el.style.width = '24px'
      el.style.height = '24px'
      el.style.backgroundColor = 'rgba(255, 0, 0, 0.5)'
      el.style.border = '2px solid red'
      el.style.borderRadius = '50%'
      el.style.animation = 'pulse 1.5s infinite'

      nodeSearchMarker.value = new maplibregl.Marker({ element: el })
        .setLngLat([fault.lng, fault.lat])
        .addTo(mapStore.map)
    }
  }
}

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
    cesiumStore.loadSavedViewMode();
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
  mapStore.map?.off('mousedown', onMapMouseDownForTopology);
  mapStore.map?.off('mousemove', onMapMouseMoveForTopology);
  mapStore.map?.off('mouseup', onNodeDragEnd);
  mapStore.map?.off('click', onMapClickForTopology);
  if (draggedNodeMarker) draggedNodeMarker.remove();
  clearRouteHighlight();
  if (defectLocateMarker) defectLocateMarker.remove();
  if (shurfLocateMarker) shurfLocateMarker.remove();
  if (inspectionLocateMarker) inspectionLocateMarker.remove();
  if (repairLocateMarker) repairLocateMarker.remove();
  if (pressureTestLocateMarker) pressureTestLocateMarker.remove();
  if (technicalConditionLocateMarker) technicalConditionLocateMarker.remove();
  if (corrosionIndicatorLocateMarker) corrosionIndicatorLocateMarker.remove();
  if (alsekoLocateMarker) alsekoLocateMarker.remove();
  if (electricalNetworkLocateMarker) electricalNetworkLocateMarker.remove();
  if (heatLossLocateMarker) heatLossLocateMarker.remove();
  if (consumerLoadLocateMarker) consumerLoadLocateMarker.remove();
  if (pumpLocateMarker) pumpLocateMarker.remove();
  if (armatureLocateMarker) armatureLocateMarker.remove();
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
</style>
