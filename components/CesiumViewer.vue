<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCesiumStore } from '~/stores/cesiumStore'

const cesiumContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const cesiumStore = useCesiumStore()
const runtimeConfig = useRuntimeConfig()
const emit = defineEmits<{ ready: [] }>()

onMounted(async () => {
  if (!cesiumContainer.value) return
  try {
    const tilesetUrl = String(runtimeConfig.public.networkTilesetUrl || '')
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
  </div>
</template>

<style scoped>
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
