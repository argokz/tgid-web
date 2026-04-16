<template>
  <div>
    <v-dialog v-model="dialog" max-width="900px" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center pa-4">
          <v-icon class="mr-2" color="primary">mdi-map-search</v-icon>
          <span class="text-h6">Поиск узлов</span>
          <v-spacer />
          <v-btn icon variant="text" @click="dialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-4">
          <v-text-field
            v-model="searchText"
            label="Поиск по узлам"
            placeholder="Введите текст для поиска..."
            prepend-inner-icon="mdi-magnify"
            clearable
            variant="outlined"
            density="comfortable"
            hide-details
            @update:model-value="onSearchInput"
            :loading="loading"
          />
          <div v-if="!loading && nodes.length > 0" class="text-caption text-grey-darken-1 mt-2">
            Найдено узлов: {{ nodes.length }}
          </div>
        </v-card-text>

        <v-divider />

        <v-card-text class="pa-0" style="max-height: 500px; overflow-y: auto;">
          <!-- Loading -->
          <div v-if="loading" class="pa-12 text-center">
            <v-progress-circular indeterminate color="primary" size="64" width="4" />
            <div class="mt-6 text-h6 text-grey">Поиск узлов...</div>
          </div>

          <!-- Results -->
          <v-list v-else-if="nodes.length > 0" class="pa-2" density="compact">
            <v-virtual-scroll
              :items="nodes"
              :height="500"
              :item-height="88"
            >
              <template #default="{ item, index }">
                <v-list-item
                  :key="item.id || index"
                  class="node-item mb-2"
                  rounded="lg"
                  @click="selectNode(item)"
                >
                  <template #prepend>
                    <v-avatar color="primary" size="48" class="elevation-2">
                      <v-icon color="white" size="28">mdi-map-marker</v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title class="font-weight-medium mb-1">
                    {{ getNodeTitle(item) }}
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-caption">
                    <div v-if="getNodeSubtitle(item)" class="d-flex align-center">
                      <v-icon size="14" class="mr-1">mdi-information-outline</v-icon>
                      {{ getNodeSubtitle(item) }}
                    </div>
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn icon variant="text" size="small" color="primary">
                      <v-icon>mdi-chevron-right</v-icon>
                    </v-btn>
                  </template>
                </v-list-item>
              </template>
            </v-virtual-scroll>
          </v-list>

          <!-- Empty state -->
          <div v-else-if="!loading && !searchText" class="pa-12 text-center text-grey">
            <v-avatar color="grey-lighten-3" size="80" class="mb-4">
              <v-icon size="48" color="grey">mdi-map-search-outline</v-icon>
            </v-avatar>
            <div class="text-h6 mb-2">Начните поиск</div>
            <div class="text-body-2">Введите текст для поиска узлов</div>
          </div>

          <!-- No results -->
          <div v-else-if="!loading && searchText && nodes.length === 0" class="pa-12 text-center text-grey">
            <v-avatar color="grey-lighten-3" size="80" class="mb-4">
              <v-icon size="48" color="grey">mdi-alert-circle-outline</v-icon>
            </v-avatar>
            <div class="text-h6 mb-2">Ничего не найдено</div>
            <div class="text-body-2">Попробуйте изменить запрос</div>
          </div>
        </v-card-text>

        <v-divider />

        <v-card-actions class="pa-4">
          <v-btn variant="text" color="grey" @click="removeMarker" prepend-icon="mdi-map-marker-off">
            Очистить маркер
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Закрыть</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="3000" location="top">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import type { Map } from 'maplibre-gl'
import { useRuntimeConfig } from '#app'

interface Props {
  map?: Map | null
}

const props = defineProps<Props>()
const config = useRuntimeConfig()

const dialog = ref(false)
const searchText = ref('')
const nodes = ref<any[]>([])
const loading = ref(false)
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

let searchTimeout: ReturnType<typeof setTimeout> | null = null
let animationFrame: number | null = null
let searchAbortController: AbortController | null = null
let geometryAbortController: AbortController | null = null

const getGeoServerUrl = () => {
  return (config.public as any)?.geoserver?.url || ''
}

const getNodeTitle = (node: any) => {
  return node.naimenovanie || node.naimenovanie_uzla || node.name || node.adres ||
    (node.nomer ? `Узел № ${node.nomer}` : '') || `Узел #${node.id || '???'}`
}

const getNodeSubtitle = (node: any) => {
  const used = new Set(['id', 'naimenovanie', 'naimenovanie_uzla', 'name', 'adres', 'nomer', 'number'])
  const keys = Object.keys(node).filter(k => !used.has(k) && node[k])
  if (keys.length > 0) {
    return `${keys[0].replace(/_/g, ' ')}: ${node[keys[0]]}`
  }
  return null
}

const onSearchInput = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    if (searchText.value) loadNodes()
    else nodes.value = []
  }, 500)
}

const loadNodes = async () => {
  if (!searchText.value.trim()) { nodes.value = []; return }

  const baseUrl = getGeoServerUrl()
  if (!baseUrl) { showSnackbar('GeoServer URL не настроен', 'error'); return }

  loading.value = true
  if (searchAbortController) searchAbortController.abort()
  searchAbortController = new AbortController()
  try {
    const workspace = 'AlmatyGIS'
    const url = `${baseUrl}/${workspace}/ows?service=WFS&version=1.1.0&request=GetFeature` +
      `&typeName=${workspace}:find_node&outputFormat=application/json` +
      `&viewparams=${encodeURIComponent(`text:${searchText.value.trim()}`)}`

    const response = await fetch(url, { signal: searchAbortController.signal })
    const contentType = response.headers.get('content-type')

    if (!contentType?.includes('json')) {
      showSnackbar('Таблица find_node не найдена в GeoServer', 'error')
      nodes.value = []
      return
    }

    if (!response.ok) {
      showSnackbar(`Ошибка сервера: ${response.status}`, 'error')
      nodes.value = []
      return
    }

    const data = await response.json()
    nodes.value = data.features?.map((f: any) => f.properties) || []

    if (nodes.value.length === 0 && searchText.value) {
      showSnackbar('Узлы не найдены', 'info')
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') return
    console.error('Node search error:', error)
    showSnackbar('Ошибка загрузки данных', 'error')
    nodes.value = []
  } finally {
    loading.value = false
  }
}

const getNodeGeometry = async (nodeId: string) => {
  const baseUrl = getGeoServerUrl()
  if (!baseUrl) return null

  try {
    if (geometryAbortController) geometryAbortController.abort()
    geometryAbortController = new AbortController()
    const workspace = 'AlmatyGIS'
    const url = `${baseUrl}/${workspace}/ows?service=WFS&version=1.1.0&request=GetFeature` +
      `&typeName=${workspace}:id_nodes&viewparams=id:${nodeId}&outputFormat=application/json`

    const response = await fetch(url, { signal: geometryAbortController.signal })
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('json') || !response.ok) return null

    const data = await response.json()
    return data.features?.[0]?.geometry || null
  } catch (error) {
    if ((error as Error).name === 'AbortError') return null
    console.error('Geometry load error:', error)
    return null
  }
}

const animateMarker = () => {
  if (!props.map) return
  let startTime = Date.now()

  const animate = () => {
    if (!props.map?.getLayer('node-marker-pulse')) return
    const elapsed = Date.now() - startTime
    const progress = (elapsed % 2000) / 2000
    const pulseRadius = 20 + Math.sin(progress * Math.PI * 2) * 5
    const pulseOpacity = 0.3 * (1 - progress * 0.5)
    props.map.setPaintProperty('node-marker-pulse', 'circle-radius', pulseRadius)
    props.map.setPaintProperty('node-marker-pulse', 'circle-opacity', pulseOpacity)
    animationFrame = requestAnimationFrame(animate)
  }

  animate()
}

const removeMarker = () => {
  if (!props.map) return
  if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null }

  const layers = ['node-marker-pulse', 'node-marker-middle', 'node-marker', 'node-marker-outline', 'node-marker-line-outline']
  layers.forEach(id => { if (props.map!.getLayer(id)) props.map!.removeLayer(id) })
  if (props.map.getSource('node-marker')) props.map.removeSource('node-marker')
}

const selectNode = async (node: any) => {
  const nodeId = node.id
  if (!nodeId || !props.map) { showSnackbar('Карта не инициализирована', 'error'); return }

  const geometry = await getNodeGeometry(nodeId)
  if (!geometry) { showSnackbar('Не удалось получить координаты узла', 'error'); return }

  let center: [number, number] | null = null
  if (geometry.type === 'Point') {
    center = geometry.coordinates
  } else if (geometry.type === 'LineString') {
    const coords = geometry.coordinates as [number, number][]
    center = coords[Math.floor(coords.length / 2)]
  } else if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates[0] as [number, number][]
    const { LngLatBounds } = await import('maplibre-gl')
    const bounds = new LngLatBounds()
    coords.forEach(c => bounds.extend(c))
    const c = bounds.getCenter()
    center = [c.lng, c.lat]
  }

  if (!center) { showSnackbar('Не удалось определить координаты', 'error'); return }

  removeMarker()

  props.map.addSource('node-marker', {
    type: 'geojson',
    data: { type: 'Feature', geometry, properties: { nodeId } }
  })

  if (geometry.type === 'Point') {
    props.map.addLayer({ id: 'node-marker-pulse', type: 'circle', source: 'node-marker', paint: { 'circle-radius': 20, 'circle-color': '#2196F3', 'circle-opacity': 0.3, 'circle-stroke-width': 0 } })
    props.map.addLayer({ id: 'node-marker-middle', type: 'circle', source: 'node-marker', paint: { 'circle-radius': 12, 'circle-color': '#2196F3', 'circle-opacity': 0.6, 'circle-stroke-width': 0 } })
    props.map.addLayer({ id: 'node-marker', type: 'circle', source: 'node-marker', paint: { 'circle-radius': 8, 'circle-color': '#1976D2', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff', 'circle-opacity': 1 } })
    animateMarker()
  } else if (geometry.type === 'LineString') {
    props.map.addLayer({ id: 'node-marker-line-outline', type: 'line', source: 'node-marker', paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.8 } })
    props.map.addLayer({ id: 'node-marker', type: 'line', source: 'node-marker', paint: { 'line-color': '#2196F3', 'line-width': 4, 'line-opacity': 1 } })
  }

  props.map.flyTo({ center, zoom: Math.max(props.map.getZoom(), 18), duration: 1000 })
  dialog.value = false
  showSnackbar('Переход к узлу выполнен', 'success')
}

const openDialog = () => { dialog.value = true }

const showSnackbar = (text: string, color: string = 'success') => {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

defineExpose({ openDialog, removeMarker })

onBeforeUnmount(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
    searchTimeout = null
  }
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
  if (searchAbortController) searchAbortController.abort()
  if (geometryAbortController) geometryAbortController.abort()
})
</script>

<style scoped>
.node-item {
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
}

.node-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
  border-color: rgba(var(--v-theme-primary), 0.2);
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.node-item {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
