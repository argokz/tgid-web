<template>
  <!--
    Контролы карты (этапы 10е–10ж, docs/ui-felt-audit.md): группы-«таблетки» по закону Хика — не больше четырёх
    кнопок. Режимы работы с картой — строка сверху по центру видимой части карты (панели режимов: измерения,
    редактор сети, маршрут пьезометра — под ней); вид и зум — внизу справа, как в Felt и любой веб-ГИС.
    Поиск адреса и узлов — палитра Ctrl+K в шапке, «Инструменты» — иконка в шапке.
  -->
  <div class="map-modes">
    <GlassSurface
      level="solid"
      rounded="md"
      class="control-group control-group--row"
      role="toolbar"
      aria-label="Режимы карты"
      aria-orientation="horizontal"
    >
      <HintTip
        text="Измерения: расстояние и площадь"
        location="bottom"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon
            variant="text"
            class="control-btn"
            :class="{ 'control-btn--active': uiStore.drawPanelOpen }"
            :aria-pressed="uiStore.drawPanelOpen"
            aria-label="Измерения"
            @click="uiStore.toggleDrawPanel()"
          >
            <v-icon size="20">mdi-ruler</v-icon>
          </v-btn>
        </template>
      </HintTip>

      <!-- Редактор топологии — режим карты, только при праве на правку -->
      <HintTip
        v-if="topologyEditingEnabled"
        :text="isEditTopologyMode ? 'Выключить редактирование топологии' : 'Редактировать топологию сети'"
        location="bottom"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon
            variant="text"
            class="control-btn"
            :class="{ 'control-btn--active': isEditTopologyMode }"
            :aria-pressed="Boolean(isEditTopologyMode)"
            aria-label="Редактировать топологию сети"
            @click="$emit('toggle-edit-topology-mode')"
          >
            <v-icon size="20">mdi-vector-polyline-edit</v-icon>
          </v-btn>
        </template>
      </HintTip>

      <HintTip
        :text="isTraceMode ? 'Отключить режим трассировки' : 'Пьезометрический график'"
        location="bottom"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon
            variant="text"
            class="control-btn"
            :class="{ 'control-btn--active': isTraceMode }"
            :aria-pressed="Boolean(isTraceMode)"
            aria-label="Пьезометрический график"
            @click="$emit('toggle-trace-mode')"
          >
            <v-icon size="20">mdi-chart-line</v-icon>
          </v-btn>
        </template>
      </HintTip>

      <HintTip
        :text="identifyMode ? 'Отключить режим информации' : 'Информация об объекте'"
        location="bottom"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon
            variant="text"
            class="control-btn"
            :class="{ 'control-btn--active': identifyMode }"
            :aria-pressed="identifyMode"
            aria-label="Информация об объекте"
            @click="toggleIdentifyMode"
          >
            <v-icon size="20">mdi-information</v-icon>
          </v-btn>
        </template>
      </HintTip>
    </GlassSurface>
  </div>

  <div class="map-controls">
    <!-- Вид и зум — внизу справа (QA F17, F59: всегда на экране) -->
    <div class="control-bottom">
      <GlassSurface
        level="solid"
        rounded="md"
        class="control-group"
        role="toolbar"
        aria-label="Вид карты"
        aria-orientation="vertical"
      >
        <HintTip
          text="Начальный вид"
          location="left"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon
              variant="text"
              class="control-btn"
              aria-label="Начальный вид"
              @click="goHome"
            >
              <v-icon size="20">mdi-home</v-icon>
            </v-btn>
          </template>
        </HintTip>

        <HintTip
          text="Моё местоположение"
          location="left"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon
              variant="text"
              class="control-btn"
              aria-label="Моё местоположение"
              :loading="locating"
              @click="getMyLocation"
            >
              <v-icon size="20">mdi-crosshairs-gps</v-icon>
            </v-btn>
          </template>
        </HintTip>

        <HintTip
          :text="cesiumStore.viewMode === '2D' ? 'Переключить в 3D (Cesium)' : 'Переключить в 2D (MapLibre)'"
          location="left"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon
              variant="text"
              class="control-btn control-btn--text"
              :class="{ 'control-btn--active': cesiumStore.viewMode === '3D' }"
              :aria-pressed="cesiumStore.viewMode === '3D'"
              aria-label="Переключить 2D/3D"
              @click="toggle2D3D"
            >
              {{ cesiumStore.viewMode }}
            </v-btn>
          </template>
        </HintTip>

        <v-menu location="left">
          <template #activator="{ props: menuProps }">
            <HintTip
              text="Базовый слой"
              location="left"
            >
              <template #default="{ props: tip }">
                <v-btn
                  v-bind="mergeProps(menuProps, tip)"
                  icon
                  variant="text"
                  class="control-btn"
                  aria-label="Базовый слой"
                >
                  <v-icon size="20">{{ currentLayerIcon }}</v-icon>
                </v-btn>
              </template>
            </HintTip>
          </template>

          <v-list
            density="compact"
            class="layer-menu"
          >
            <v-list-subheader class="section-label">Базовые слои карты</v-list-subheader>
            <v-list-item
              v-for="layer in layers"
              :key="layer.id"
              :active="currentLayer === layer.id"
              color="primary"
              @click="selectBaseLayer(layer.id)"
            >
              <template #prepend>
                <v-icon>{{ layer.icon }}</v-icon>
              </template>
              <v-list-item-title>{{ layer.name }}</v-list-item-title>
              <template #append>
                <v-icon
                  v-if="currentLayer === layer.id"
                  size="18"
                >mdi-check</v-icon>
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
      </GlassSurface>

      <GlassSurface
        level="solid"
        rounded="md"
        class="control-group"
        role="toolbar"
        aria-label="Масштаб"
        aria-orientation="vertical"
      >
        <HintTip
          text="Приблизить"
          location="left"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon
              variant="text"
              class="control-btn"
              aria-label="Приблизить"
              @click="zoomIn"
            >
              <v-icon size="20">mdi-plus</v-icon>
            </v-btn>
          </template>
        </HintTip>
        <HintTip
          text="Отдалить"
          location="left"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon
              variant="text"
              class="control-btn"
              aria-label="Отдалить"
              @click="zoomOut"
            >
              <v-icon size="20">mdi-minus</v-icon>
            </v-btn>
          </template>
        </HintTip>
      </GlassSurface>
    </div>
  </div>
</template>

<script setup lang="ts">
import HintTip from '~/components/HintTip.vue'
import GlassSurface from '~/components/GlassSurface.vue'
import { ref, computed, onMounted, mergeProps } from 'vue'
import type { Map } from 'maplibre-gl'
import { getCityConfig } from '~/utils/cityConfig'
import { useBaseLayers } from '~/composables/useBaseLayers'
import { useNotificationStore } from '~/stores/notificationStore'
import { useCesiumStore } from '~/stores/cesiumStore'
import { useUiStore } from '~/stores/uiStore'
import { useFragmentStore } from '~/stores/fragmentStore'

const props = withDefaults(defineProps<{
  map: Map | null
  initialIdentifyMode?: boolean
  isTraceMode?: boolean
  isEditTopologyMode?: boolean
  topologyEditingEnabled?: boolean
}>(), {
  initialIdentifyMode: true,
  topologyEditingEnabled: false
})

const emit = defineEmits<{
  'layer-change': [layerId: string]
  'identify-mode-change': [enabled: boolean]
  'toggle-trace-mode': []
  'toggle-edit-topology-mode': []
}>()

const { layers, currentLayer, getCurrentLayer, setLayer, loadSavedLayer } = useBaseLayers()
const notificationStore = useNotificationStore()
const fragmentStore = useFragmentStore()
const cesiumStore = useCesiumStore()
const uiStore = useUiStore()

const locating = ref(false)
const identifyMode = ref(props.initialIdentifyMode)
const hasLocatedOnce = ref(false)

/** Сколько держится маркер «Вы здесь», мс */
const TEMP_MARKER_MS = 5000

const currentLayerIcon = computed(() => getCurrentLayer.value?.icon || 'mdi-map')

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
  }, TEMP_MARKER_MS)
}

// «Домой» — к видимым фрагментам (у города их может быть несколько в разных местах: в Шатуре —
// Шатура, Москва, Петербург); охвата нет (нет узлов, ошибка) — центр города
const goHome = async () => {
  if (!props.map) return
  const ids = fragmentStore.activeFragmentIds.length ? fragmentStore.activeFragmentIds : fragmentStore.defaultFragmentIds
  if (ids.length && await fragmentStore.zoomToFragments(ids)) return
  props.map.flyTo({ center: getCityConfig().center, zoom: 11, duration: 2000, essential: true })
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

const toggle2D3D = () => {
  cesiumStore.toggleViewMode()
  notificationStore.showInfo(cesiumStore.viewMode === '3D' ? 'Включен 3D режим (Cesium)' : 'Включен 2D режим (MapLibre)')
}

onMounted(() => {
  loadSavedLayer()
  emit('identify-mode-change', identifyMode.value)
})

defineExpose({ identifyMode })
</script>

<style scoped>
/*
 * Строка режимов — сверху по центру видимой части карты (между карточками слоёв и объекта: --map-left/right-inset
 * ставит MapViewer). Колонка справа — от шапки до атрибуции, группы прижаты книзу. Обе прозрачны для мыши.
 * Группа — плотная «таблетка» (стекло только у шапки), кнопки 40 px вплотную, между группами 8 px.
 */
.map-modes {
  position: fixed;
  top: calc(var(--shell-top) + var(--shell-inset));
  left: calc(var(--map-left-inset, 0px) + (100% - var(--map-left-inset, 0px) - var(--map-right-inset, 0px)) / 2);
  transform: translateX(-50%);
  z-index: var(--z-controls);
}

.control-group.control-group--row {
  flex-direction: row;
}

.map-controls {
  position: fixed;
  top: calc(var(--shell-top) + var(--shell-inset));
  right: calc(var(--shell-inset) + var(--safe-right, 0px));
  bottom: calc(var(--shell-inset) + 24px + var(--safe-bottom, 0px)); /* над строкой атрибуции MapLibre */
  z-index: var(--z-controls);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--shell-gap);
  pointer-events: none;
}

.map-controls > * {
  pointer-events: auto;
}

.control-group {
  display: flex;
  flex-direction: column;
  flex: none;
  padding: 2px;
}

.control-bottom {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--shell-gap);
  flex: none;
  margin-top: auto;
}

/* Кнопка-иконка: прозрачная, нейтральная иконка, ховер подложкой; активный режим — подложка выбора и синий */
.control-group .control-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  transition: background-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
}

.control-group .control-btn:hover {
  background: var(--surface-hover);
}

.control-group .control-btn--active,
.control-group .control-btn--active:hover {
  background: var(--surface-selected);
  color: rgb(var(--v-theme-primary));
}

.control-group .control-btn--text {
  font-size: 13px;
  font-weight: 600;
}

/* Тач-экран: зона 44 px (закон Фиттса) */
@media (pointer: coarse) {
  .control-group .control-btn {
    width: 44px;
    height: 44px;
  }
}

/* Низкое окно (телефон боком): вид и зум — в ряд, чтобы колонка влезла по высоте */
@media (max-height: 560px) {
  .control-bottom {
    flex-direction: row-reverse;
    align-items: flex-end;
  }
}

.layer-menu {
  min-width: 220px;
}
</style>
