<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Primitive } from 'cesium'
import { useCesiumStore } from '~/stores/cesiumStore'
import { useMapStore } from '~/stores/mapStore'
import { useLayerStore } from '~/stores/layerStore'
import { useFragmentStore } from '~/stores/fragmentStore'
import { useSettingsStore } from '~/stores/settingsStore'
import { useBaseLayers } from '~/composables/useBaseLayers'
import { resolveTilesetUrl } from '~/utils/cesiumTileset'
import { buildNetworkWmsOverlays, resolve3dBaseImagery } from '~/utils/cesiumImagery'
import { buildUnderground, setUndergroundView, viewBbox, whenReady } from '~/utils/cesiumUnderground'
import { ABOVE_GROUND, DEPTH_CLASSES, NO_DEPTH, type Network3dResponse } from '~/utils/network3d'
import { fastApiService } from '~/services/fastApiService'
import { formatApiError } from '~/utils/apiError'

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
  if (cesiumStore.isInitialized) void cesiumStore.setNetworkOverlays(overlays)
})

// Фотореалистичные здания (Google через Cesium ion): нужен ion-токен и id ассета
const photorealisticAssetId = computed(() => Number((runtimeConfig.public as any).cesiumPhotorealisticAssetId || 0))
const photorealisticAvailable = computed(() =>
  Boolean(runtimeConfig.public.cesiumIonToken) && photorealisticAssetId.value > 0
)
const togglePhotorealistic = () => {
  void cesiumStore.setPhotorealistic(!cesiumStore.photorealistic, photorealisticAssetId.value)
}

// Сеть под землёй (utils/cesiumUnderground.ts): примитив вне реактивности — он большой
let undergroundPrimitive: Primitive | null = null
const underground = ref(false)
const undergroundBusy = ref(false)
const undergroundError = ref('')
const undergroundStats = ref<Pick<Network3dResponse, 'pipes' | 'with_depth' | 'lines' | 'truncated'> | null>(null)
const undergroundLegend = [...DEPTH_CLASSES, ABOVE_GROUND, NO_DEPTH]

const removeUnderground = () => {
  const viewer = cesiumStore.viewer
  if (viewer && undergroundPrimitive) viewer.scene.primitives.remove(undergroundPrimitive)
  undergroundPrimitive = null
}

const loadUnderground = async () => {
  const viewer = cesiumStore.viewer
  const Cesium = cesiumStore.cesium as typeof import('cesium') | null
  if (!viewer || !Cesium) return
  const bbox = viewBbox(Cesium, viewer)
  if (!bbox) {
    undergroundError.value = 'Наклоните камеру к земле: в виде нет поверхности'
    return
  }
  undergroundBusy.value = true
  undergroundError.value = ''
  try {
    const data = await fastApiService.getNetwork3dLines(bbox, fragmentStore.visibleFragments)
    const primitive = await buildUnderground(Cesium, viewer, data.items)
    removeUnderground()
    undergroundPrimitive = viewer.scene.primitives.add(primitive)
    await whenReady(viewer, primitive)
    undergroundStats.value = { pipes: data.pipes, with_depth: data.with_depth, lines: data.lines, truncated: data.truncated }
  } catch (err: unknown) {
    undergroundError.value = formatApiError(err, 'Сеть под землёй не загрузилась')
  } finally {
    undergroundBusy.value = false
  }
}

const toggleUnderground = () => {
  const viewer = cesiumStore.viewer
  const Cesium = cesiumStore.cesium as typeof import('cesium') | null
  if (!viewer || !Cesium) return
  underground.value = !underground.value
  setUndergroundView(Cesium, viewer, underground.value)
  if (underground.value) {
    void loadUnderground()
  } else {
    removeUnderground()
    undergroundStats.value = null
    undergroundError.value = ''
    viewer.scene.requestRender()
  }
}

onBeforeUnmount(removeUnderground)

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
    void cesiumStore.setNetworkOverlays(networkOverlays.value)
    if (photorealisticAvailable.value && cesiumStore.loadSavedPhotorealistic()) {
      void cesiumStore.setPhotorealistic(true, photorealisticAssetId.value)
    }
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
    <v-btn
      v-if="photorealisticAvailable && !loading && !errorMessage"
      class="cesium-photo-toggle"
      size="small"
      elevation="4"
      prepend-icon="mdi-office-building"
      :color="cesiumStore.photorealistic ? 'primary' : 'white'"
      :loading="cesiumStore.photorealisticStatus === 'loading'"
      :title="cesiumStore.photorealistic ? 'Вернуть рельеф с подложкой' : 'Фотореалистичные здания и рельеф (Google 3D Tiles)'"
      @click="togglePhotorealistic"
    >
      Здания 3D
    </v-btn>
    <div
      v-if="!loading && !errorMessage"
      class="cesium-underground"
    >
      <v-btn
        size="small"
        elevation="4"
        prepend-icon="mdi-pipe"
        :color="underground ? 'primary' : 'white'"
        :loading="undergroundBusy"
        :title="underground ? 'Убрать сеть под землёй' : 'Трубы на глубине заложения, земля вблизи полупрозрачная'"
        @click="toggleUnderground"
      >
        Сеть под землёй
      </v-btn>
      <v-card
        v-if="underground"
        class="cesium-underground-panel mt-2 pa-2"
        elevation="4"
      >
        <div class="d-flex align-center ga-1 mb-1">
          <span class="text-caption flex-grow-1">
            <template v-if="undergroundStats">
              Труб — {{ undergroundStats.pipes.toLocaleString('ru-RU') }}, с глубиной —
              {{ undergroundStats.with_depth.toLocaleString('ru-RU') }}<template v-if="undergroundStats.truncated">
                (первые {{ undergroundStats.lines.toLocaleString('ru-RU') }} участков — приблизьте вид)</template>
            </template>
            <template v-else>Загружаем участки в виде…</template>
          </span>
          <v-btn
            size="x-small"
            variant="text"
            icon="mdi-refresh"
            aria-label="Загрузить участки текущего вида"
            :disabled="undergroundBusy"
            @click="loadUnderground"
          />
        </div>
        <div
          v-for="c in undergroundLegend"
          :key="c.key"
          class="d-flex align-center ga-2 text-caption"
        >
          <span
            class="cesium-underground-swatch"
            :style="{ background: c.color }"
          />
          {{ c.label }}
        </div>
        <div class="text-caption text-medium-emphasis mt-1">
          Глубина — до верха трубы из отметок узлов; подача и обратка — одной линией.
        </div>
        <div
          v-if="undergroundError"
          class="text-caption text-error mt-1"
        >
          {{ undergroundError }}
        </div>
      </v-card>
    </div>
    <v-alert
      v-if="cesiumStore.photorealisticStatus === 'error'"
      class="cesium-tileset-notice"
      type="warning"
      variant="tonal"
      density="compact"
    >
      Фотореалистичные 3D Tiles не загрузились: {{ cesiumStore.photorealisticError }}
    </v-alert>
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

.cesium-underground {
  position: absolute;
  top: calc(var(--hud-top) + 40px);
  right: var(--controls-w);
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.cesium-underground-panel {
  width: 250px;
}

.cesium-underground-swatch {
  display: inline-block;
  width: 18px;
  height: 4px;
  border-radius: 2px;
}

.cesium-photo-toggle {
  position: absolute;
  top: var(--hud-top);
  right: var(--controls-w); /* левее колонки контролов карты */
  z-index: 2;
}

.cesium-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  /* Как у 2D-карты: холст 3D уходит под стекло шапки, подписи и кнопки — ниже неё (MapViewer.vue .map-container) */
  overflow: visible;
}

.cesium-canvas {
  position: absolute;
  inset: calc(-1 * var(--shell-top)) 0 0 0;
}

.cesium-status,
.cesium-error {
  position: absolute;
  z-index: 2;
  top: calc(var(--modes-offset) + var(--toolbar-row) + var(--shell-gap)); /* под строкой режимов */
  left: calc(var(--map-left-inset, 0px) + (100% - var(--map-left-inset, 0px) - var(--map-right-inset, 0px)) / 2);
  transform: translateX(-50%);
}
</style>
