<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useCesiumStore } from '~/stores/cesiumStore'
import { useMapStore } from '~/stores/mapStore'
import { useLayerStore } from '~/stores/layerStore'
import { useFragmentStore } from '~/stores/fragmentStore'
import { useSettingsStore } from '~/stores/settingsStore'
import { useBaseLayers } from '~/composables/useBaseLayers'
import { resolveTilesetUrl } from '~/utils/cesiumTileset'
import { buildNetworkWmsOverlays, resolve3dBaseImagery } from '~/utils/cesiumImagery'

const cesiumContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const cesiumStore = useCesiumStore()
const runtimeConfig = useRuntimeConfig()
const emit = defineEmits<{ ready: [] }>()
const tilesetNoticeClosed = ref(false)
const mapStore = useMapStore()
const layerStore = useLayerStore()
const fragmentStore = useFragmentStore()
const settingsStore = useSettingsStore()
const { layers: baseLayers } = useBaseLayers()

// Подложка 3D — та же, что выбрана в 2D (растровый вариант)
const baseImagery = computed(() => resolve3dBaseImagery(
  mapStore.selectedBaseLayer,
  baseLayers,
  String((runtimeConfig.public as any).maptilerKey || '')
))

// Сеть в 3D — видимые слои панели через WMS GeoServer, с фильтром фрагментов
const networkOverlays = computed(() => buildNetworkWmsOverlays(
  layerStore.geoServerLayers,
  layerStore.visibleGeoServerLayers,
  fragmentStore.visibleFragments,
  (ws, layer) =>
    layer.workspaceBaseUrl ||
    settingsStore.workspaces.find((w) => w.workspace === ws)?.url ||
    (runtimeConfig.public as any).geoserver?.url ||
    'https://itwin.kz/geoserver'
))

watch(baseImagery, (imagery) => {
  if (cesiumStore.isInitialized) cesiumStore.setBaseImagery(imagery)
})
watch(networkOverlays, (overlays) => {
  if (cesiumStore.isInitialized) cesiumStore.setNetworkOverlays(overlays)
})

onMounted(async () => {
  if (!cesiumContainer.value) return
  try {
    const tilesetUrl = resolveTilesetUrl(runtimeConfig.public.networkTilesetUrl, runtimeConfig.app.baseURL)
    if (tilesetUrl) {
      cesiumStore.networkTilesetUrl = tilesetUrl
    }
    await cesiumStore.initializeViewer(
      cesiumContainer.value,
      String(runtimeConfig.public.cesiumIonToken || ''),
      baseImagery.value
    )
    cesiumStore.setNetworkOverlays(networkOverlays.value)
    emit('ready')
  } catch (error: any) {
    console.error('Cesium init error:', error)
    errorMessage.value = error?.message || 'Не удалось инициализировать 3D-карту'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="cesium-container">
    <div
      ref="cesiumContainer"
      class="cesium-canvas"
    />
    <div
      v-if="loading"
      class="cesium-status"
    >Подготавливаем 3D-карту…</div>
    <v-alert
      v-else-if="errorMessage"
      class="cesium-error"
      type="error"
      variant="tonal"
    >
      {{ errorMessage }}
    </v-alert>
    <v-alert
      v-else-if="!tilesetNoticeClosed && cesiumStore.networkTilesetStatus === 'error'"
      class="cesium-tileset-notice"
      type="warning"
      variant="tonal"
      density="compact"
      closable
      @click:close="tilesetNoticeClosed = true"
    >
      3D-модель сети не загружена: {{ cesiumStore.networkTilesetError }}. Карта работает без неё.
    </v-alert>
    <div
      v-else-if="cesiumStore.networkTilesetStatus === 'loading'"
      class="cesium-status"
    >
      Загружаем 3D-модель сети…
    </div>
  </div>
</template>

<style scoped>
.cesium-tileset-notice {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  max-width: 560px;
  z-index: 2;
}

.cesium-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
}

.cesium-canvas {
  position: absolute;
  inset: 0;
}

.cesium-status,
.cesium-error {
  position: absolute;
  z-index: 2;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
}
</style>
