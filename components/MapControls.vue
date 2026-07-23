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


      <!-- Поиск узлов -->
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

      <!--
        Журналы, реестры и диагностика — единое меню вместо 20+ кнопок в столбце.
        Каждый пункт с иконкой и подписью, сгруппирован по разделам.
      -->
      <v-menu
        v-model="toolsMenuOpen"
        location="left"
        :close-on-content-click="true"
        transition="scale-transition"
        max-height="80vh"
      >
        <template #activator="{ props: menuProps }">
          <v-tooltip text="Журналы, реестры и отчёты" location="left">
            <template #activator="{ props: tp }">
              <v-btn
                v-bind="{ ...menuProps, ...tp }"
                icon
                size="large"
                elevation="4"
                :color="toolsMenuOpen ? 'primary' : 'white'"
                class="control-btn mt-2"
                aria-label="Журналы, реестры и отчёты"
              >
                <v-icon :color="toolsMenuOpen ? 'white' : 'primary'">mdi-view-grid-plus-outline</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
        </template>

        <v-card class="tools-menu-card" rounded="lg" elevation="8">
          <div class="tools-menu-header px-4 py-3">
            <v-icon size="20" color="primary" class="me-2">mdi-view-grid-plus-outline</v-icon>
            <span class="text-subtitle-2 font-weight-bold">Журналы, реестры и отчёты</span>
          </div>
          <v-divider />
          <v-text-field
            v-model="toolsSearch"
            density="compact"
            variant="solo-filled"
            flat
            hide-details
            clearable
            prepend-inner-icon="mdi-magnify"
            placeholder="Найти журнал или отчёт…"
            aria-label="Поиск по журналам и отчётам"
            class="tools-menu-search px-3 py-2"
            @click.stop
            @keydown.stop
          />
          <v-divider />

          <div class="tools-menu-body">
            <template v-for="group in filteredToolGroups" :key="group.title">
              <div class="tools-group-title px-4 pt-3 pb-1">
                <v-icon size="14" :color="group.color" class="me-1">{{ group.icon }}</v-icon>
                <span class="text-caption font-weight-bold text-uppercase">{{ group.title }}</span>
              </div>
              <div class="tools-grid px-2 pb-2">
                <button
                  v-for="tool in group.items"
                  :key="tool.event"
                  type="button"
                  class="tool-tile"
                  :aria-label="tool.label"
                  @click="runTool(tool)"
                >
                  <v-icon :color="tool.color" size="22">{{ tool.icon }}</v-icon>
                  <span class="tool-tile__label">{{ tool.label }}</span>
                </button>
              </div>
            </template>

            <div v-if="!filteredToolGroups.length" class="pa-6 text-center text-medium-emphasis">
              <v-icon size="32" class="mb-2">mdi-file-search-outline</v-icon>
              <div class="text-body-2">Ничего не найдено</div>
            </div>
          </div>
        </v-card>
      </v-menu>



      <!-- Edit Topology Mode (режим карты, поэтому остаётся отдельной кнопкой) -->
      <v-tooltip
        v-if="topologyEditingEnabled"
        :text="isEditTopologyMode ? 'Выключить редактирование топологии' : 'Редактировать топологию сети'"
        location="left"
      >
        <template #activator="{ props: tp }">
          <v-btn
            v-bind="tp"
            icon
            size="large"
            elevation="4"
            :color="isEditTopologyMode ? 'red' : 'white'"
            class="control-btn mt-2"
            aria-label="Редактировать топологию сети"
            @click="$emit('toggle-edit-topology-mode')"
          >
            <v-icon :color="isEditTopologyMode ? 'white' : 'red'">mdi-pencil-network</v-icon>
          </v-btn>
        </template>
      </v-tooltip>

      <!-- Trace mode -->


      <v-tooltip


        :text="isTraceMode ? 'Отключить режим трассировки' : 'Пьезометрический график'"


        location="left"


      >


        <template #activator="{ props: tp }">


          <v-btn


            v-bind="tp"


            icon


            size="large"


            elevation="4"


            :color="isTraceMode ? 'primary' : 'white'"


            class="control-btn"


            :class="{ 'identify-active': isTraceMode }"


            aria-label="Пьезометрический график"


            @click="$emit('toggle-trace-mode')"


          >


            <v-icon :color="isTraceMode ? 'white' : 'blue'">mdi-chart-line</v-icon>


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





      <!-- 2D/3D Toggle -->


      <v-tooltip :text="cesiumStore.viewMode === '2D' ? 'Переключить в 3D (Cesium)' : 'Переключить в 2D (MapLibre)'" location="left">


        <template #activator="{ props: tp }">


          <v-btn


            v-bind="tp"


            icon


            size="large"


            elevation="4"


            color="white"


            class="control-btn font-weight-bold"


            :class="{'bg-primary text-white': cesiumStore.viewMode === '3D'}"


            aria-label="Переключить 2D/3D"


            @click="toggle2D3D"


          >


            {{ cesiumStore.viewMode }}


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


import { useCesiumStore } from '~/stores/cesiumStore'





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


  'open-node-search': []


  'open-topology-diagnostics': []


  'open-fault-diagnostics': []


  'open-calculation-diagnostics': []


  'toggle-trace-mode': []


  'toggle-edit-topology-mode': []


  'open-passport-dialog': []


  'open-defect-journal': []


  'open-shurf-journal': []


  'open-inspection-journal': []


  'open-repair-journal': []


  'open-pressure-test-journal': []


  'open-technical-condition-journal': []


  'open-corrosion-indicator-journal': []


  'open-alseko-journal': []


  'open-electrical-network-journal': []


  'open-heat-loss-journal': []


  'open-temperature-graph-journal': []


  'open-consumer-load-diagnostics': []


  'open-pump-equipment': []


  'open-network-armatures': []


  'open-network-regulators': []


  'open-network-bypasses': []


  'open-network-diaphragms': []


  'open-elevators': []


}>()





const { searchAddress } = useNominatim()


const { layers, currentLayer, getCurrentLayer, setLayer, loadSavedLayer } = useBaseLayers()


const notificationStore = useNotificationStore()


const cesiumStore = useCesiumStore()





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





const toggle2D3D = () => {


  cesiumStore.toggleViewMode()


  if (cesiumStore.viewMode === '3D') {


    notificationStore.showInfo('Включен 3D режим (Cesium)')


  } else {


    notificationStore.showInfo('Включен 2D режим (MapLibre)')


  }


}





const openPassportDialog = () => emit('open-passport-dialog')

/**
 * Каталог инструментов для меню «Журналы, реестры и отчёты».
 * Раньше это были 20+ отдельных кнопок в вертикальном столбце поверх карты:
 * они занимали весь экран по высоте и не читались без наведения.
 */
// Параметризованный тип emit сводится к последней перегрузке, поэтому список
// событий меню задан явно.
type ToolEvent =
  | 'open-topology-diagnostics'
  | 'open-fault-diagnostics'
  | 'open-calculation-diagnostics'
  | 'open-passport-dialog'
  | 'open-defect-journal'
  | 'open-shurf-journal'
  | 'open-inspection-journal'
  | 'open-repair-journal'
  | 'open-pressure-test-journal'
  | 'open-technical-condition-journal'
  | 'open-corrosion-indicator-journal'
  | 'open-alseko-journal'
  | 'open-electrical-network-journal'
  | 'open-heat-loss-journal'
  | 'open-temperature-graph-journal'
  | 'open-consumer-load-diagnostics'
  | 'open-pump-equipment'
  | 'open-network-armatures'
  | 'open-network-regulators'
  | 'open-network-bypasses'
  | 'open-network-diaphragms'
  | 'open-elevators'
interface ToolItem { label: string; icon: string; color: string; event: ToolEvent }
interface ToolGroup { title: string; icon: string; color: string; items: ToolItem[] }

const toolsMenuOpen = ref(false)
const toolsSearch = ref('')

const toolGroups: ToolGroup[] = [
  {
    title: 'Эксплуатация',
    icon: 'mdi-clipboard-text-outline',
    color: 'deep-orange-darken-2',
    items: [
      { label: 'Нарушения', icon: 'mdi-alert-decagram-outline', color: 'deep-orange-darken-2', event: 'open-defect-journal' },
      { label: 'Шурфовки', icon: 'mdi-shovel', color: 'brown-darken-2', event: 'open-shurf-journal' },
      { label: 'Осмотры', icon: 'mdi-clipboard-search-outline', color: 'teal-darken-2', event: 'open-inspection-journal' },
      { label: 'Ремонты', icon: 'mdi-hammer-wrench', color: 'deep-purple-darken-2', event: 'open-repair-journal' },
      { label: 'Опрессовки', icon: 'mdi-gauge', color: 'blue-darken-2', event: 'open-pressure-test-journal' },
      { label: 'Индикаторы коррозии', icon: 'mdi-test-tube', color: 'orange-darken-3', event: 'open-corrosion-indicator-journal' },
    ],
  },
  {
    title: 'Оборудование сети',
    icon: 'mdi-pipe-valve',
    color: 'blue-grey-darken-3',
    items: [
      { label: 'Насосное оборудование', icon: 'mdi-pump', color: 'blue-grey-darken-3', event: 'open-pump-equipment' },
      { label: 'Запорная арматура', icon: 'mdi-valve', color: 'deep-purple-darken-3', event: 'open-network-armatures' },
      { label: 'Сетевые регуляторы', icon: 'mdi-tune-vertical', color: 'indigo-darken-3', event: 'open-network-regulators' },
      { label: 'Байпасы', icon: 'mdi-pipe-valve', color: 'cyan-darken-4', event: 'open-network-bypasses' },
      { label: 'Диафрагмы', icon: 'mdi-circle-slice-8', color: 'teal-darken-4', event: 'open-network-diaphragms' },
      { label: 'Элеваторы', icon: 'mdi-elevator', color: 'blue-grey-darken-4', event: 'open-elevators' },
    ],
  },
  {
    title: 'Расчёты и диагностика',
    icon: 'mdi-calculator-variant',
    color: 'primary',
    items: [
      { label: 'Диагностика расчётов', icon: 'mdi-calculator-variant', color: 'primary', event: 'open-calculation-diagnostics' },
      { label: 'Диагностика топологии', icon: 'mdi-stethoscope', color: 'deep-purple-darken-2', event: 'open-topology-diagnostics' },
      { label: 'Поиск неисправностей', icon: 'mdi-alert-octagon', color: 'error', event: 'open-fault-diagnostics' },
      { label: 'Тепловые нагрузки', icon: 'mdi-home-lightning-bolt-outline', color: 'teal-darken-3', event: 'open-consumer-load-diagnostics' },
      { label: 'Тепловые потери', icon: 'mdi-heat-wave', color: 'deep-orange-darken-3', event: 'open-heat-loss-journal' },
      { label: 'Температурные графики', icon: 'mdi-chart-bell-curve-cumulative', color: 'purple-darken-3', event: 'open-temperature-graph-journal' },
    ],
  },
  {
    title: 'Реестры и отчёты',
    icon: 'mdi-file-tree',
    color: 'success',
    items: [
      { label: 'Отчёты и паспорта', icon: 'mdi-file-tree', color: 'success', event: 'open-passport-dialog' },
      { label: 'Технические условия', icon: 'mdi-file-certificate-outline', color: 'cyan-darken-3', event: 'open-technical-condition-journal' },
      { label: 'Объекты АЛСЕКО', icon: 'mdi-office-building-marker', color: 'indigo-darken-2', event: 'open-alseko-journal' },
      { label: 'Электрическая сеть', icon: 'mdi-transmission-tower', color: 'amber-darken-4', event: 'open-electrical-network-journal' },
    ],
  },
]

const filteredToolGroups = computed<ToolGroup[]>(() => {
  const s = (toolsSearch.value || '').trim().toLowerCase()
  if (!s) return toolGroups
  return toolGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(s)) }))
    .filter((g) => g.items.length > 0)
})

const runTool = (tool: ToolItem) => {
  toolsMenuOpen.value = false
  toolsSearch.value = ''
  ;(emit as (event: ToolEvent) => void)(tool.event)
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

/* --- Меню «Журналы, реестры и отчёты» --- */
.tools-menu-card {
  width: min(420px, calc(100vw - 32px));
  overflow: hidden;
}

.tools-menu-header {
  display: flex;
  align-items: center;
}

.tools-menu-search :deep(.v-field) {
  border-radius: 8px;
}

.tools-menu-body {
  max-height: min(60vh, 520px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.tools-group-title {
  display: flex;
  align-items: center;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.72;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.tool-tile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.tool-tile:hover,
.tool-tile:focus-visible {
  background: rgba(var(--v-theme-primary), 0.08);
  border-color: rgba(var(--v-theme-primary), 0.24);
  outline: none;
}

.tool-tile__label {
  font-size: 13px;
  line-height: 1.25;
  color: rgb(var(--v-theme-on-surface));
}

@media (max-width: 600px) {
  .tools-grid {
    grid-template-columns: 1fr;
  }
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


