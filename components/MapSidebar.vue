<template>
  <div>
    <!-- Кнопка открытия (десктоп свёрнут / мобильный) -->
    <transition name="fade">
      <div
        v-if="showToggleBtn"
        class="sidebar-toggle-wrap"
      >
        <v-tooltip
          text="Открыть панель слоёв"
          location="right"
        >
          <template #activator="{ props: tp }">
            <v-btn
              v-bind="tp"
              icon
              size="large"
              elevation="3"
              color="surface"
              class="sidebar-toggle"
              aria-label="Открыть панель слоёв"
              @click="openPanel"
            >
              <v-icon color="primary">mdi-layers</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </div>
    </transition>

    <!-- МОБИЛЬНЫЙ: navigation-drawer (оверлей) -->
    <v-navigation-drawer
      v-if="mobile"
      v-model="mobileOpen"
      location="left"
      temporary
      width="320"
    >
      <MapSidebarPanel
        :layer-opacities="layerOpacities"
        :fragments-loading="fragmentsLoading"
        :active-tab="activeTab"
        @update:active-tab="activeTab = $event"
        @close="mobileOpen = false"
        @layers-applied="onLayersApplied"
        @fragments-applied="onFragmentsApplied"
        @labels-applied="onLabelsApplied"
        @move-up="moveLayerUp"
        @move-down="moveLayerDown"
        @change-format="changeLayerFormat"
        @opacity-change="updateLayerOpacity"
        @load-fragments="loadFragments"
      />
    </v-navigation-drawer>

    <!-- ДЕСКТОП: фиксированная боковая панель (первый кадр без slide-enter — иначе CLS в .map-container) -->
    <transition :name="sidebarMotionEnabled ? 'slide' : 'sidebar-static'">
      <div
        v-if="!mobile && !desktopCollapsed"
        class="desktop-sidebar"
      >
        <v-card
          elevation="2"
          rounded="0"
          class="sidebar-card"
        >
          <MapSidebarPanel
            :layer-opacities="layerOpacities"
            :fragments-loading="fragmentsLoading"
            :active-tab="activeTab"
            @update:active-tab="activeTab = $event"
            @close="desktopCollapsed = true"
            @layers-applied="onLayersApplied"
            @fragments-applied="onFragmentsApplied"
            @labels-applied="onLabelsApplied"
            @move-up="moveLayerUp"
            @move-down="moveLayerDown"
            @change-format="changeLayerFormat"
            @opacity-change="updateLayerOpacity"
            @load-fragments="loadFragments"
          />
        </v-card>
      </div>
    </transition>

    <!-- Уведомление -->
    <v-snackbar
      v-model="showSnackbar"
      :timeout="2500"
      color="success"
      location="bottom"
      rounded="pill"
    >
      <div class="d-flex align-center">
        <v-icon class="me-2">mdi-check-circle</v-icon>
        {{ snackbarMessage }}
      </div>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { appStorage } from '~/utils/appStorage'
import { ref, computed, onBeforeUnmount, onMounted, watch, nextTick } from 'vue'
import { useDisplay } from 'vuetify'
import { useLayerStore }    from '~/stores/layerStore'
import { useFragmentStore } from '~/stores/fragmentStore'
import { useMapStore }      from '~/stores/mapStore'
import { useUiStore }       from '~/stores/uiStore'
import { setMapSubLayerOpacity } from '~/utils/mapLayerOpacity'
import MapSidebarPanel from './MapSidebarPanel.vue'

const { mobile } = useDisplay()

const layerStore    = useLayerStore()
const fragmentStore = useFragmentStore()
const mapStore      = useMapStore()
const SIDEBAR_STATE_KEY = 'mapSidebarState'

// UI state
const desktopCollapsed = ref(false)
const mobileOpen       = ref(false)
const activeTab        = ref('layers')
const showSnackbar     = ref(false)
const snackbarMessage  = ref('')
const fragmentsLoading = ref(false)
/** После первого nextTick включаем slide — иначе enter-from: translateX(-100%) даёт огромный CLS */
const sidebarMotionEnabled = ref(false)

const showToggleBtn = computed(() =>
  mobile.value ? !mobileOpen.value : desktopCollapsed.value
)

const openPanel = () => {
  if (mobile.value) mobileOpen.value = true
  else desktopCollapsed.value = false
}

const saveSidebarState = () => {
  appStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify({
    desktopCollapsed: desktopCollapsed.value,
    mobileOpen: mobileOpen.value,
    activeTab: activeTab.value
  }))
}

// Layer opacities
const layerOpacities = ref<Record<string, number>>({})

const updateLayerOpacity = (layerId: string, opacity: number) => {
  layerOpacities.value[layerId] = opacity
  const map = mapStore.map
  if (!map) return
  const subIds = mapStore.getLayerIdsOnMap(layerId)
  for (const subId of subIds) {
    setMapSubLayerOpacity(map, subId, opacity)
  }
  appStorage.setItem('layerOpacities', JSON.stringify(layerOpacities.value))
}

const onLayersApplied = () => {
  snackbarMessage.value = 'Слои применены'
  showSnackbar.value = true
}

const onFragmentsApplied = () => {
  snackbarMessage.value = 'Фрагменты применены'
  showSnackbar.value = true
}

const onLabelsApplied = () => {
  snackbarMessage.value = 'Подписи применены'
  showSnackbar.value = true
}

const moveLayerUp = (layerId: string) => {
  const idx = layerStore.geoServerLayers.findIndex((l: { layerId: string }) => l.layerId === layerId)
  if (idx <= 0) return
  const arr = [...layerStore.geoServerLayers]
  ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
  layerStore.geoServerLayers = arr
  applyLayerOrder()
}

const moveLayerDown = (layerId: string) => {
  const idx = layerStore.geoServerLayers.findIndex((l: { layerId: string }) => l.layerId === layerId)
  if (idx < 0 || idx >= layerStore.geoServerLayers.length - 1) return
  const arr = [...layerStore.geoServerLayers]
  ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
  layerStore.geoServerLayers = arr
  applyLayerOrder()
}

const applyLayerOrder = () => {
  layerStore.syncMapLayerStackOrder()
}

const changeLayerFormat = async (layerId: string, format: string) => {
  if (!format || !['mvt', 'wms', 'wmts'].includes(format)) return
  await layerStore.changeLayerFormat(layerId, format as 'mvt' | 'wms' | 'wmts')
}

const loadFragments = async () => {
  fragmentsLoading.value = true
  try { await fragmentStore.loadFragments() }
  finally { fragmentsLoading.value = false }
}

// Lifecycle
onMounted(() => {
  const savedUiStateRaw = appStorage.getItem(SIDEBAR_STATE_KEY)
  if (savedUiStateRaw) {
    try {
      const savedUiState = JSON.parse(savedUiStateRaw)
      desktopCollapsed.value = Boolean(savedUiState.desktopCollapsed)
      mobileOpen.value = Boolean(savedUiState.mobileOpen)
      if (typeof savedUiState.activeTab === 'string' && savedUiState.activeTab.length > 0) {
        activeTab.value = savedUiState.activeTab
      }
    } catch {
      // ignore malformed snapshot
    }
  }
  const saved = appStorage.getItem('layerOpacities')
  if (saved) try { layerOpacities.value = JSON.parse(saved) } catch { /* ignore */ }
  loadFragments()
  void nextTick(() => {
    sidebarMotionEnabled.value = true
  })
})

watch([desktopCollapsed, mobileOpen, activeTab], saveSidebarState, { deep: false })

/** Ширина открытой панели на десктопе — в uiStore: легенда и панель графиков встают правее (docs/ui-zones.md) */
const SIDEBAR_WIDTH_PX = 340
const ui = useUiStore()
watch([mobile, desktopCollapsed], ([isMobile, collapsed]) => {
  ui.setLeftInset(!isMobile && !collapsed ? SIDEBAR_WIDTH_PX : 0)
}, { immediate: true })
onBeforeUnmount(() => ui.setLeftInset(0))
</script>

<style scoped>
.sidebar-toggle-wrap {
  position: fixed;
  top: 68px;
  left: calc(12px + var(--safe-left, 0px));
  z-index: 200;
}

/* Десктопная панель */
.desktop-sidebar {
  position: fixed;
  top: 56px;
  left: 0;
  z-index: 199;
  height: calc(100vh - 56px);
  /* адресная строка мобильного браузера: видимая высота, а не высота без панелей */
  height: calc(100dvh - 56px);
  width: 340px;
  pointer-events: all;
}

.sidebar-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
}

/* Первый показ панели: без анимации входа (см. sidebarMotionEnabled) */
.sidebar-static-enter-active,
.sidebar-static-leave-active {
  transition: none !important;
}

.sidebar-static-enter-from,
.sidebar-static-leave-to {
  transform: none !important;
  opacity: 1 !important;
}

/* Анимация появления/скрытия панели (после гидрации): токены _motion.scss — вход пружиной, выход быстрее */
.slide-enter-active {
  transition: transform var(--duration-slow) var(--ease-spring),
              opacity   var(--duration-base) var(--ease-out);
}

.slide-leave-active {
  transition: transform var(--duration-exit) var(--ease-in),
              opacity   var(--duration-exit) var(--ease-in);
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* Анимация кнопки */
.fade-enter-active { transition: opacity var(--duration-base) var(--ease-out); }
.fade-leave-active { transition: opacity var(--duration-exit) var(--ease-in); }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>
