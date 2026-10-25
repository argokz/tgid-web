<template>
  <div>
    <v-dialog
      v-model="dialog"
      :max-width="mobile ? undefined : 900"
      :fullscreen="mobile"
      scrollable
      :transition="mobile ? 'dialog-bottom-transition' : 'dialog-transition'"
    >
      <v-card :rounded="mobile ? '0' : undefined">
        <v-card-title class="d-flex align-center flex-wrap pa-4 gap-2">
          <v-icon
            class="mr-2"
            color="primary"
          >mdi-map-search</v-icon>
          <span class="text-h6">Поиск узлов</span>
          <v-spacer />
          <HintTip
            text="Закрыть"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                aria-label="Закрыть"
                @click="dialog = false"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </HintTip>
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-4">
          <SearchField
            v-model="searchText"
            :label="aiMode ? 'Поиск фразой' : 'Поиск по узлам'"
            :placeholder="aiMode ? 'например: потребители без нагрузки во фрагменте 74 или камера 3-47' : 'Введите текст для поиска...'"
            :icon="aiMode ? 'mdi-creation' : 'mdi-magnify'"
            :loading="loading"
            :debounce="300"
            :result-count="aiMode || loading ? null : nodes.length"
            density="comfortable"
            @search="onSearch"
            @enter="aiMode && runAiSearch()"
            @escape="dialog = false"
          />
          <v-switch
            v-if="authStore.canUseAi"
            v-model="aiMode"
            density="compact"
            hide-details
            color="primary"
            label="Поиск фразой (помощник ИИ): узлы, участки, потребители, источники, инструменты"
            @update:model-value="onAiModeChange"
          />
          <div
            v-if="aiMode && aiNote"
            class="text-caption text-medium-emphasis mt-1"
          >
            {{ aiNote }}
          </div>
          <div
            v-if="!loading && nodes.length > 0"
            class="text-caption text-grey-darken-1 mt-2"
          >
            Найдено узлов: {{ nodes.length }}
          </div>
        </v-card-text>

        <v-divider />

        <v-card-text
          class="pa-0 node-search-results"
          :style="resultsScrollStyle"
        >
          <!-- Loading -->
          <div
            v-if="loading"
            class="pa-12 text-center"
          >
            <v-progress-circular
              indeterminate
              color="primary"
              size="64"
              width="4"
            />
            <div class="mt-6 text-h6 text-grey">Поиск узлов...</div>
          </div>

          <!-- Результаты поиска фразой: узлы, участки, источники, потребители -->
          <v-list
            v-else-if="aiMode && aiItems.length > 0"
            class="pa-2"
            density="compact"
          >
            <v-list-item
              v-for="(item, index) in aiItems"
              :key="`ai-${index}`"
              class="node-item mb-2"
              rounded="lg"
              @click="selectAiItem(item)"
            >
              <template #prepend>
                <v-avatar
                  color="primary"
                  size="40"
                >
                  <v-icon color="white">mdi-map-marker</v-icon>
                </v-avatar>
              </template>
              <v-list-item-title class="font-weight-medium">
                {{ aiItemTitle(item) }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ aiItemSubtitle(item) }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <!-- Results (сгруппировано: тип → код РС → фрагмент) -->
          <v-list
            v-else-if="nodes.length > 0"
            class="pa-2 node-search-grouped-list"
            density="compact"
          >
            <template
              v-for="group in nodeGroups"
              :key="group.key"
            >
              <v-list-subheader class="node-group-subheader text-wrap py-2">
                {{ group.label }}
              </v-list-subheader>
              <v-list-item
                v-for="(item, index) in group.nodes"
                :key="item.id ?? `${group.key}-${index}`"
                class="node-item mb-2"
                rounded="lg"
                @click="selectNode(item)"
              >
                <template #prepend>
                  <v-avatar
                    color="primary"
                    size="48"
                    class="elevation-2"
                  >
                    <v-icon
                      color="white"
                      size="28"
                    >mdi-map-marker</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title class="font-weight-medium mb-1">
                  {{ getNodeTitle(item) }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  <div
                    v-if="getNodeSubtitle(item)"
                    class="d-flex align-center"
                  >
                    <v-icon
                      size="14"
                      class="mr-1"
                    >mdi-information-outline</v-icon>
                    {{ getNodeSubtitle(item) }}
                  </div>
                </v-list-item-subtitle>
                <template #append>
                  <HintTip
                    text="Открыть подробности об узле"
                  >
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        icon
                        variant="text"
                        size="small"
                        color="primary"
                        aria-label="Подробнее"
                      >
                        <v-icon>mdi-chevron-right</v-icon>
                      </v-btn>
                    </template>
                  </HintTip>
                </template>
              </v-list-item>
            </template>
          </v-list>

          <!-- Empty state -->
          <div
            v-else-if="!loading && !searchText"
            class="pa-12 text-center text-grey"
          >
            <v-avatar
              color="grey-lighten-3"
              size="80"
              class="mb-4"
            >
              <v-icon
                size="48"
                color="grey"
              >mdi-map-search-outline</v-icon>
            </v-avatar>
            <div class="text-h6 mb-2">Начните поиск</div>
            <div class="text-body-2">Введите текст для поиска узлов</div>
          </div>

          <!-- No results -->
          <div
            v-else-if="!loading && searchText && nodes.length === 0"
            class="pa-12 text-center text-grey"
          >
            <v-avatar
              color="grey-lighten-3"
              size="80"
              class="mb-4"
            >
              <v-icon
                size="48"
                color="grey"
              >mdi-alert-circle-outline</v-icon>
            </v-avatar>
            <div class="text-h6 mb-2">Ничего не найдено</div>
            <div class="text-body-2">Попробуйте изменить запрос</div>
          </div>
        </v-card-text>

        <v-divider />

        <v-card-actions
          class="pa-4 d-flex flex-wrap gap-2"
          :class="mobile ? 'flex-column' : ''"
        >
          <v-btn
            variant="text"
            color="grey"
            :block="mobile"
            prepend-icon="mdi-map-marker-off"
            @click="removeMarker"
          >
            Очистить маркер
          </v-btn>
          <v-spacer v-if="!mobile" />
          <v-btn
            variant="text"
            :block="mobile"
            @click="dialog = false"
          >Закрыть</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top"
    >
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import SearchField from '~/components/SearchField.vue'
import { onBeforeUnmount, ref, computed } from 'vue'
import { useMobile } from '~/composables/useMobile'
import { getCityConfig } from '~/utils/cityConfig'
import { findNodesUrl, getNodeFragment, getNodeRsCode, getNodeSubtitle, getNodeTitle, getNodeType, nodeGeometryUrl } from '~/utils/nodeSearch'
import { useAuthStore } from '~/stores/authStore'
import { useFragmentStore } from '~/stores/fragmentStore'
import { useUiStore } from '~/stores/uiStore'
import { aiService } from '~/services/aiService'
import { formatApiErrorWith } from '~/utils/apiError'
import type { Map as MapLibreMap } from 'maplibre-gl'
import HintTip from '~/components/HintTip.vue'

interface Props {
  map?: MapLibreMap | null
}

const props = defineProps<Props>()
const config = useRuntimeConfig()

const { isMobile: mobile } = useMobile()

const resultsScrollStyle = computed(() =>
  mobile.value
    ? { maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' as const }
    : { maxHeight: '500px', overflowY: 'auto' as const }
)

const dialog = ref(false)
const searchText = ref('')

// --- Поиск фразой (помощник ИИ): сервер разбирает фразу и выполняет выборку, SQL модель не пишет ---
const authStore = useAuthStore()
const fragmentStore = useFragmentStore()
const uiStore = useUiStore()
const aiMode = ref(false)
const aiNote = ref('')
interface AiSearchItem { id?: number; name?: string | null; node1?: string | null; node2?: string | null; fragment_id?: number | null; longitude?: number | null; latitude?: number | null; diameter?: number | null; node_type?: string | null; [key: string]: unknown }
interface AiSearchResult { query: { kind: string; note?: string; confidence?: number }; items: AiSearchItem[]; total?: number; open_tool: { key: string; scope?: unknown } | null }
const aiItems = ref<AiSearchItem[]>([])
const onAiModeChange = () => { aiItems.value = []; aiNote.value = ''; nodes.value = [] }
const aiItemTitle = (item: AiSearchItem) => item.name || (item.node1 ? `${item.node1} — ${item.node2 ?? '?'}` : `#${item.id ?? ''}`)
const aiItemSubtitle = (item: AiSearchItem) => [item.node_type, item.fragment_id != null ? `фрагмент ${item.fragment_id}` : '', item.diameter != null ? `Ø${item.diameter}` : ''].filter(Boolean).join(' · ')
const KIND_LABELS: Record<string, string> = { node: 'узлы', line: 'участки', consumer: 'потребители', source: 'источники', tool: 'инструмент', unknown: 'не понял запрос' }
const runAiSearch = async () => {
  const text = searchText.value.trim()
  if (text.length < 2) return
  loading.value = true
  aiNote.value = ''
  try {
    const res = await aiService.call<AiSearchResult>('search', { text, fragment_ids: fragmentStore.visibleFragments ?? [] })
    aiItems.value = res.items || []
    if (res.open_tool) {
      uiStore.requestToolDialog(res.open_tool.key, res.open_tool.scope)
      if (!aiItems.value.length) dialog.value = false
    }
    aiNote.value = `${KIND_LABELS[res.query.kind] || res.query.kind}${res.total != null ? `, всего ${res.total}` : ''}${res.query.note ? ` — ${res.query.note}` : ''}`
    if (!aiItems.value.length && !res.open_tool) showSnackbar('Ничего не найдено', 'info')
  } catch (error) {
    showSnackbar(formatApiErrorWith('Поиск фразой не выполнен', error), 'error')
  } finally {
    loading.value = false
  }
}
const selectAiItem = (item: AiSearchItem) => {
  if (!props.map || item.longitude == null || item.latitude == null) { showSnackbar('У объекта нет координат', 'info'); return }
  props.map.flyTo({ center: [Number(item.longitude), Number(item.latitude)], zoom: Math.max(props.map.getZoom(), 17), duration: 1000 })
  dialog.value = false
}
const nodes = ref<any[]>([])
const loading = ref(false)
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

let animationFrame: number | null = null
let searchAbortController: AbortController | null = null
let geometryAbortController: AbortController | null = null

const getGeoServerUrl = () => {
  return (config.public as any)?.geoserver?.url || ''
}

type NodeGroup = { key: string; label: string; nodes: any[] }

const nodeGroups = computed((): NodeGroup[] => {
  const list = nodes.value
  if (!list.length) return []

  const byKey = new Map<string, any[]>()
  for (const node of list) {
    const type = getNodeType(node) ?? '—'
    const rs = getNodeRsCode(node) ?? '—'
    const frag = getNodeFragment(node)
    const key = `${type}\t${rs}\t${frag ?? ''}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(node)
  }

  const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true })
  const entries = [...byKey.entries()].sort(([ka], [kb]) => collator.compare(ka, kb))

  return entries.map(([key, groupNodes]) => {
    const [type, rs, fragPart] = key.split('\t')
    const labelParts = [`${type}`, `РС: ${rs}`]
    if (fragPart) labelParts.push(`Фрагмент: ${fragPart}`)
    const sortedNodes = [...groupNodes].sort((a, b) =>
      collator.compare(getNodeTitle(a), getNodeTitle(b))
    )
    return {
      key,
      label: labelParts.join(' · '),
      nodes: sortedNodes
    }
  })
})

/** Текст после паузы ввода (SearchField): в режиме фразы ищет только Enter */
const onSearch = (query: string) => {
  if (aiMode.value) return
  if (query) loadNodes()
  else nodes.value = []
}

const loadNodes = async () => {
  if (!searchText.value.trim()) { nodes.value = []; return }

  const baseUrl = getGeoServerUrl()
  if (!baseUrl) { showSnackbar('GeoServer URL не настроен', 'error'); return }

  loading.value = true
  if (searchAbortController) searchAbortController.abort()
  searchAbortController = new AbortController()
  try {
    const url = findNodesUrl(baseUrl, getCityConfig().workspace, searchText.value)

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
    const url = nodeGeometryUrl(baseUrl, getCityConfig().workspace, nodeId)

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

.node-group-subheader {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
  font-weight: 600;
  line-height: 1.35;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
