<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCesiumStore } from '~/stores/cesiumStore'
import { resolveTilesetUrl } from '~/utils/cesiumTileset'

const cesiumContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const cesiumStore = useCesiumStore()
const runtimeConfig = useRuntimeConfig()
const emit = defineEmits<{ ready: [] }>()
const tilesetNoticeClosed = ref(false)

onMounted(async () => {
  if (!cesiumContainer.value) return
  try {
    const tilesetUrl = resolveTilesetUrl(runtimeConfig.public.networkTilesetUrl, runtimeConfig.app.baseURL)
    if (tilesetUrl) {
      cesiumStore.networkTilesetUrl = tilesetUrl
    }
    await cesiumStore.initializeViewer(
      cesiumContainer.value,
      String(runtimeConfig.public.cesiumIonToken || '')
    )
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
    <div ref="cesiumContainer" class="cesium-canvas" />
    <div v-if="loading" class="cesium-status">Подготавливаем 3D-карту…</div>
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
