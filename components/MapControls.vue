<template>
  <div class="map-controls">
    <!-- Address Search -->
    <div class="search-wrapper" :class="{ 'expanded': searchExpanded }">
      <v-btn
        v-if="!searchExpanded"
        icon
        size="large"
        elevation="4"
        color="white"
        class="control-btn"
        aria-label="Открыть поиск адреса на карте"
        @click="expandSearch"
      >
        <v-icon color="primary">mdi-magnify</v-icon>
      </v-btn>

      <v-card v-if="searchExpanded" class="search-panel-expanded" elevation="8" rounded="lg">
        <div class="pa-2 search-input-wrapper">
          <v-text-field
            ref="searchInput"
            v-model="searchQuery"
            placeholder="Поиск адреса на карте..."
            variant="solo"
            density="comfortable"
            hide-details
            single-line
            autofocus
            @input="onSearchInput"
            @keyup.enter="performSearch"
            @keyup.esc="collapseSearch"
          >
            <template #prepend-inner>
              <v-icon color="primary">mdi-magnify</v-icon>
            </template>
            <template #append-inner>
              <v-btn
                icon
                size="small"
                variant="text"
                aria-label="Закрыть поиск адреса"
                @click="collapseSearch"
              >
                <v-icon size="small">mdi-close</v-icon>
              </v-btn>
            </template>
          </v-text-field>
        </div>

        <div v-if="searchResults.length > 0 || searching" class="search-results-wrapper">
          <v-divider />
          <v-list v-if="searchResults.length > 0" class="search-results" density="compact">
            <v-list-item
              v-for="result in searchResults"
              :key="result.place_id"
              @click="selectResult(result)"
              class="search-result-item"
            >
              <template #prepend>
                <v-avatar size="36" color="blue-lighten-5">
                  <v-icon color="primary" size="small">mdi-map-marker</v-icon>
                </v-avatar>
              </template>
              <v-list-item-title class="text-body-2 font-weight-medium">
                {{ getMainAddress(result.display_name) }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ getSecondaryAddress(result.display_name) }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
          <div v-if="searching" class="pa-4 text-center">
            <v-progress-circular
              indeterminate
              size="32"
              color="primary"
              aria-label="Поиск адреса"
            />
            <div class="text-caption text-grey mt-2">Поиск...</div>
          </div>
        </div>
      </v-card>
    </div>

    <!-- Control buttons (right column) -->
    <div class="control-buttons">
      <!-- Node search -->
      <v-tooltip text="Поиск узлов" location="left">
        <template #activator="{ props: tp }">
          <v-btn
            v-bind="tp"
            icon
            size="large"
            elevation="4"
            color="white"
            class="control-btn"
            aria-label="Поиск узлов"
            @click="$emit('open-node-search')"
          >
            <v-icon color="primary">mdi-map-search</v-icon>
          </v-btn>
        </template>
      </v-tooltip>

      <!-- Identify mode -->
      <v-tooltip
        :text="identifyMode ? 'Отключить режим информации' : 'Информация об объекте'"
        location="left"
      >
        <template #activator="{ props: tp }">
          <v-btn
            v-bind="tp"
            icon
            size="large"
            elevation="4"
            :color="identifyMode ? 'primary' : 'white'"
            class="control-btn"
            :class="{ 'identify-active': identifyMode }"
            :aria-label="identifyMode ? 'Отключить режим информации' : 'Информация об объекте'"
            @click="toggleIdentifyMode"
          >
            <v-icon>mdi-information</v-icon>
          </v-btn>
        </template>
      </v-tooltip>

      <!-- Home -->
      <v-tooltip text="Начальный вид" location="left">
        <template #activator="{ props: tp }">
          <v-btn
            v-bind="tp"
            icon
            size="large"
            elevation="4"
            color="white"
            class="control-btn"
            aria-label="Начальный вид"
            @click="goHome"
          >
            <v-icon color="grey-darken-2">mdi-home</v-icon>
          </v-btn>
        </template>
      </v-tooltip>

      <!-- Geolocation -->
      <v-tooltip text="Моё местоположение" location="left">
        <template #activator="{ props: tp }">
          <v-btn
            v-bind="tp"
            icon
            size="large"
            elevation="4"
            color="white"
            class="control-btn"
            aria-label="Моё местоположение"
            :loading="locating"
            @click="getMyLocation"
          >
            <v-icon color="primary">mdi-crosshairs-gps</v-icon>
          </v-btn>
        </template>
      </v-tooltip>

      <!-- Zoom In -->
      <v-tooltip text="Приблизить" location="left">
        <template #activator="{ props: tp }">
          <v-btn
            v-bind="tp"
            icon
            size="large"
            elevation="4"
            color="white"
            class="control-btn"
            aria-label="Приблизить"
            @click="zoomIn"
          >
            <v-icon color="grey-darken-2">mdi-plus</v-icon>
          </v-btn>
        </template>
      </v-tooltip>

      <!-- Zoom Out -->
      <v-tooltip text="Отдалить" location="left">
        <template #activator="{ props: tp }">
          <v-btn
            v-bind="tp"
            icon
            size="large"
            elevation="4"
            color="white"
            class="control-btn"
            aria-label="Отдалить"
            @click="zoomOut"
          >
            <v-icon color="grey-darken-2">mdi-minus</v-icon>
          </v-btn>
        </template>
      </v-tooltip>

      <!-- Base layer switcher -->
      <v-menu offset-y location="left">
        <template #activator="{ props: menuProps }">
          <v-tooltip text="Базовый слой" location="left">
            <template #activator="{ props: tp }">
              <v-btn
                v-bind="{ ...menuProps, ...tp }"
                icon
                size="large"
                elevation="4"
                color="white"
                class="control-btn"
                aria-label="Базовый слой"
              >
                <v-icon color="deep-orange">{{ currentLayerIcon }}</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
        </template>

        <v-list density="compact" class="layer-menu">
          <v-list-subheader>Базовые слои карты</v-list-subheader>
          <v-list-item
            v-for="layer in layers"
            :key="layer.id"
            @click="selectBaseLayer(layer.id)"
            :class="{ 'active-layer': currentLayer === layer.id }"
          >
            <template #prepend>
              <v-icon :color="currentLayer === layer.id ? 'primary' : 'grey'">{{ layer.icon }}</v-icon>
            </template>
            <v-list-item-title>{{ layer.name }}</v-list-item-title>
            <template #append>
              <v-icon v-if="currentLayer === layer.id" color="primary">mdi-check</v-icon>
            </template>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import type { Map } from 'maplibre-gl'
import type { NominatimResult } from '~/composables/useNominatim'
import { useNominatim } from '~/composables/useNominatim'
import { useBaseLayers } from '~/composables/useBaseLayers'
import { useNotificationStore } from '~/stores/notificationStore'

const props = withDefaults(defineProps<{
  map: Map | null
  initialIdentifyMode?: boolean
}>(), {
  initialIdentifyMode: true
})

const emit = defineEmits<{
  'layer-change': [layerId: string]
  'identify-mode-change': [enabled: boolean]
  'open-node-search': []
}>()

const { searchAddress } = useNominatim()
const { layers, currentLayer, getCurrentLayer, setLayer, loadSavedLayer } = useBaseLayers()
const notificationStore = useNotificationStore()

const searchExpanded = ref(false)
const searchInput = ref<any>(null)
const searchQuery = ref('')
const searchResults = ref<NominatimResult[]>([])
const searching = ref(false)
const locating = ref(false)
const identifyMode = ref(props.initialIdentifyMode)
const hasLocatedOnce = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const currentLayerIcon = computed(() => getCurrentLayer.value?.icon || 'mdi-map')

const expandSearch = () => {
  searchExpanded.value = true
  nextTick(() => searchInput.value?.focus())
}

const collapseSearch = () => {
  searchExpanded.value = false
  searchQuery.value = ''
  searchResults.value = []
}

const getMainAddress = (s: string) => s.split(',').slice(0, 2).join(',').trim()
const getSecondaryAddress = (s: string) => s.split(',').slice(2).join(',').trim()

const onSearchInput = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (!searchQuery.value || searchQuery.value.length < 3) { searchResults.value = []; return }
  searchTimeout = setTimeout(performSearch, 500)
}

const performSearch = async () => {
  if (!searchQuery.value || searchQuery.value.length < 3) return
  searching.value = true
  try { searchResults.value = await searchAddress(searchQuery.value) }
  finally { searching.value = false }
}

const selectResult = (result: NominatimResult) => {
  if (!props.map) return
  const lat = parseFloat(result.lat)
  const lon = parseFloat(result.lon)
  props.map.flyTo({ center: [lon, lat], zoom: 16, duration: 2000 })
  addTemporaryMarker(lon, lat, result.display_name)
  searchResults.value = []
  searchQuery.value = result.display_name
}

const addTemporaryMarker = (lon: number, lat: number, description: string) => {
  if (!props.map) return
  if (props.map.getLayer('temp-marker')) props.map.removeLayer('temp-marker')
  if (props.map.getSource('temp-marker')) props.map.removeSource('temp-marker')

  props.map.addSource('temp-marker', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { description } }
  })
  props.map.addLayer({
    id: 'temp-marker',
    type: 'circle',
    source: 'temp-marker',
    paint: { 'circle-radius': 10, 'circle-color': '#FF5252', 'circle-stroke-width': 3, 'circle-stroke-color': '#FFFFFF' }
  })

  setTimeout(() => {
    if (props.map?.getLayer('temp-marker')) props.map.removeLayer('temp-marker')
    if (props.map?.getSource('temp-marker')) props.map.removeSource('temp-marker')
  }, 5000)
}

const goHome = () => {
  if (!props.map) return
  props.map.flyTo({ center: [76.92, 43.26], zoom: 11, duration: 2000, essential: true })
}

const getMyLocation = () => {
  if (!props.map) return
  if (!window.isSecureContext) {
    notificationStore.showWarning('Геолокация работает только в безопасном контексте (HTTPS или localhost)')
    return
  }
  if (!navigator.geolocation) {
    notificationStore.showWarning('Ваш браузер не поддерживает геолокацию')
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      if (!hasLocatedOnce.value) {
        props.map?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 15, duration: 2000 })
        hasLocatedOnce.value = true
      } else {
        props.map?.easeTo({ center: [coords.longitude, coords.latitude], duration: 1200 })
      }
      addTemporaryMarker(coords.longitude, coords.latitude, 'Вы здесь')
      notificationStore.showSuccess('Местоположение определено')
      locating.value = false
    },
    (error) => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          notificationStore.showError('Доступ к геолокации запрещён. Разрешите доступ в настройках браузера')
          break
        case error.POSITION_UNAVAILABLE:
          notificationStore.showError('Не удалось определить местоположение. Проверьте GPS/сеть')
          break
        case error.TIMEOUT:
          notificationStore.showError('Превышено время ожидания геолокации')
          break
        default:
          notificationStore.showError('Не удалось получить местоположение')
      }
      locating.value = false
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  )
}

const zoomIn = () => props.map?.zoomIn({ duration: 300 })
const zoomOut = () => props.map?.zoomOut({ duration: 300 })

const selectBaseLayer = (layerId: string) => {
  setLayer(layerId)
  emit('layer-change', layerId)
}

const toggleIdentifyMode = () => {
  identifyMode.value = !identifyMode.value
  emit('identify-mode-change', identifyMode.value)
}

onMounted(() => {
  loadSavedLayer()
  emit('identify-mode-change', identifyMode.value)
})

defineExpose({ identifyMode })
</script>

<style scoped>
.map-controls {
  position: fixed;
  top: 68px; /* 56px app bar + 12px gap */
  right: 12px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-wrapper {
  display: flex;
  justify-content: flex-end;
}

.search-panel-expanded {
  width: 420px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
  animation: expandSearch 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes expandSearch {
  from { width: 56px; opacity: 0; transform: scale(0.9); }
  to { width: 420px; opacity: 1; transform: scale(1); }
}

.search-results-wrapper {
  max-height: 360px;
  overflow: hidden;
}

.search-results {
  max-height: 360px;
  overflow-y: auto;
}

.search-result-item {
  cursor: pointer;
  border-left: 3px solid transparent;
  margin: 4px 8px;
  border-radius: 8px;
  padding: 8px !important;
  transition: all 0.2s;
}

.search-result-item:hover {
  background: rgba(33, 150, 243, 0.08);
  border-left-color: #2196F3;
}

.control-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-self: flex-end;
}

.control-btn {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.control-btn:hover {
  transform: scale(1.08);
}

.control-btn:active {
  transform: scale(0.95);
}

/* Белая иконка когда кнопка "информация" активна (primary фон) */
.control-btn.identify-active :deep(svg),
.control-btn.identify-active :deep(path) {
  fill: white;
  color: white;
}

.layer-menu {
  min-width: 220px;
}

.active-layer {
  background: rgba(33, 150, 243, 0.08);
  border-left: 3px solid #2196F3;
}
</style>
