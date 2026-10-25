<template>
  <v-dialog
    v-model="dialog"
    max-width="1240"
    scrollable
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-3 px-4 py-3">
        <v-avatar
          color="error"
          variant="tonal"
          size="40"
        >
          <v-icon>mdi-alert-octagon</v-icon>
        </v-avatar>
        <div
          class="flex-grow-1"
          style="min-width: 0"
        >
          <div class="text-subtitle-1 font-weight-bold">
            Диагностика неисправностей
          </div>
          <div class="text-caption text-medium-emphasis text-truncate">
            Дефекты и индикаторы коррозии: слои на карте, итог по базе, последние записи; щелчок по строке — объект на карте
          </div>
        </div>
        <HintTip
          text="Обновить"
          location="bottom"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-refresh"
              variant="text"
              aria-label="Обновить"
              :loading="loading"
              @click="fetchData"
            />
          </template>
        </HintTip>
        <HintTip
          text="Закрыть"
          hotkey="Esc"
          location="bottom"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-close"
              variant="text"
              aria-label="Закрыть"
              @click="dialog = false"
            />
          </template>
        </HintTip>
      </v-card-title>
      <v-divider />

      <v-card-text
        class="pa-4"
        style="min-height: 420px;"
      >
        <!-- Слои на карте: подпись — что и каким цветом покажется -->
        <div class="fault-layers mb-4">
          <v-switch
            v-model="mapStore.isDefectsLayerVisible"
            color="error"
            density="compact"
            hide-details
            inset
          >
            <template #label>
              <span class="fault-layers__label">
                <v-icon
                  color="error"
                  size="18"
                >mdi-tools</v-icon>
                Дефекты на карте <span class="text-medium-emphasis">— красные маркеры</span>
              </span>
            </template>
          </v-switch>
          <v-switch
            v-model="mapStore.isCorrosionLayerVisible"
            color="warning"
            density="compact"
            hide-details
            inset
          >
            <template #label>
              <span class="fault-layers__label">
                <v-icon
                  color="warning"
                  size="18"
                >mdi-water-alert</v-icon>
                Индикаторы коррозии на карте <span class="text-medium-emphasis">— оранжевые маркеры</span>
              </span>
            </template>
          </v-switch>
        </div>

        <StateView
          variant="table"
          :rows="8"
          :loading="loading && !loaded"
          :error="error"
          :empty="loaded && !error && !defects.total && !corrosion.total"
          empty-title="Неисправности не зарегистрированы"
          empty-text="В базе нет дефектов и индикаторов коррозии — они появятся здесь после регистрации в журналах"
          empty-icon="mdi-check-circle-outline"
          error-title="Не удалось загрузить неисправности"
          :retrying="loading"
          @retry="fetchData"
        >
          <!-- Итог по всей базе (не по показанным строкам): плитки вида — фильтр таблицы, состояния — справочно -->
          <div class="fault-tiles mb-2">
            <KpiTile
              v-for="tile in kindTiles"
              :key="tile.kind"
              :label="tile.label"
              :value="tile.total"
              :compact="false"
              selectable
              :active="kindFilter === tile.kind"
              @select="kindFilter = kindFilter === tile.kind ? 'all' : tile.kind"
            />
            <KpiTile
              v-for="tile in stateTiles"
              :key="tile.key"
              :label="tile.label"
              :value="tile.count"
              :status="tile.status"
            />
          </div>
          <v-alert
            v-for="warning in partialWarnings"
            :key="warning"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-2"
          >
            {{ warning }}
          </v-alert>

          <div class="d-flex flex-wrap align-center ga-2 mb-2">
            <SearchField
              v-model="search"
              class="fault-search"
              label="Поиск по названию, адресу, описанию"
              density="compact"
              :result-count="search ? tableRows.length : null"
            />
            <v-spacer />
            <div class="fault-notes">
              <span
                v-for="note in truncatedNotes"
                :key="note.kind"
                class="text-caption text-medium-emphasis"
              >
                {{ note.text }}
                <v-btn
                  size="x-small"
                  variant="text"
                  color="primary"
                  @click="emit('open-journal', note.kind)"
                >
                  Журнал
                </v-btn>
              </span>
            </div>
          </div>

          <DataTable
            :columns="columns"
            :items="tableRows"
            item-key="key"
            selectable
            :height="360"
            no-data-text="Нет записей по фильтру"
            @select="(row) => locateFault(row as unknown as FaultRow)"
          >
            <template #[`item.kind`]="{ item }">
              <v-icon
                :color="item.kind === 'defect' ? 'error' : 'warning'"
                size="18"
                :aria-label="item.kind === 'defect' ? 'Дефект' : 'Индикатор коррозии'"
              >
                {{ item.kind === 'defect' ? 'mdi-tools' : 'mdi-water-alert' }}
              </v-icon>
            </template>
            <template #[`item.date`]="{ item }">
              {{ formatDate(item.date) }}
            </template>
            <template #[`item.locate`]="{ item }">
              <v-icon
                v-if="item.lat != null && item.lng != null"
                size="16"
                color="primary"
                aria-label="Есть на карте"
              >
                mdi-crosshairs-gps
              </v-icon>
            </template>
          </DataTable>
        </StateView>
      </v-card-text>

      <v-divider />
      <v-card-actions class="px-4 py-3">
        <v-spacer />
        <v-btn
          variant="text"
          @click="dialog = false"
        >
          Закрыть
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue'
import HintTip from '~/components/HintTip.vue'
import KpiTile, { type KpiStatus } from '~/components/KpiTile.vue'
import SearchField from '~/components/SearchField.vue'
import StateView from '~/components/StateView.vue'
import { fastApiService } from '~/services/fastApiService'
import { useMapStore } from '~/stores/mapStore'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiErrorWith } from '~/utils/apiError'

/**
 * Диагностика неисправностей: слои дефектов и индикаторов коррозии на карте, итог по базе (плитки — всего и по
 * состояниям из `state_counts` журналов) и последние записи обоих журналов одной таблицей. Полный список с
 * фильтрами и правкой — в журналах («Журнал»). Щелчок по строке — перелёт к объекту и его запись в журнале.
 */
type FaultKind = 'defect' | 'corrosion'
interface FaultRow {
  key: string
  id: number
  kind: FaultKind
  title: string
  state: string
  date: string | null
  place: string
  description: string
  lat: number | null
  lng: number | null
}
interface SourceState {
  rows: FaultRow[]
  total: number
  counts: { state_id: number | null; count: number }[]
}

/** Последние записи каждого журнала (предел API — 200 на страницу) */
const LATEST_LIMIT = 200
/** Состояние дефекта → тон плитки, как в журнале дефектов: нарушение — проблема, ремонт — внимание */
const DEFECT_STATE_STATUS: Record<number, KpiStatus> = { 1: 'serious', 2: 'warning', 3: 'good' }
const KIND_LABEL: Record<FaultKind, string> = { defect: 'Дефекты', corrosion: 'Индикаторы коррозии' }

const emit = defineEmits<{
  'open-defect': [id: number]
  'open-corrosion': [id: number]
  'open-journal': [kind: FaultKind]
}>()

const dialog = ref(false)
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const partialWarnings = ref<string[]>([])
const defects = reactive<SourceState>({ rows: [], total: 0, counts: [] })
const corrosion = reactive<SourceState>({ rows: [], total: 0, counts: [] })
const defectStates = ref<{ id: number; name: string }[]>([])
const kindFilter = ref<FaultKind | 'all'>('all')
const search = ref('')
const notificationStore = useNotificationStore()
const mapStore = useMapStore()
let fetchSeq = 0

watch(() => mapStore.isDefectsLayerVisible, () => mapStore.toggleDefectsLayer())
watch(() => mapStore.isCorrosionLayerVisible, () => mapStore.toggleCorrosionLayer())

const text = (value: unknown) => (value == null ? '' : String(value).trim())
const coord = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const toDefectRow = (item: Record<string, unknown>): FaultRow => ({
  key: `defect-${item.id}`,
  id: Number(item.id),
  kind: 'defect',
  title: [text(item.category_name) || 'Дефект', `№${item.id}`].join(' '),
  state: text(item.state_name),
  date: text(item.detected_at) || null,
  place: text(item.address),
  description: text(item.description) || text(item.name),
  lat: coord(item.latitude),
  lng: coord(item.longitude)
})

const toCorrosionRow = (item: Record<string, unknown>): FaultRow => ({
  key: `corrosion-${item.id}`,
  id: Number(item.id),
  kind: 'corrosion',
  title: `Индикатор ${text(item.number) || `№${item.id}`}`,
  state: text(item.phase_name),
  date: text(item.extracted_on) || text(item.installed_on) || text(item.planned_on) || null,
  place: text(item.installation_place) || text(item.address),
  description: [text(item.process_mark_name), item.corrosion_rate != null ? `скорость ${item.corrosion_rate}` : '']
    .filter(Boolean).join(', '),
  lat: coord(item.latitude),
  lng: coord(item.longitude)
})

const apply = (target: SourceState, response: { items?: unknown[]; total?: number; state_counts?: SourceState['counts'] }, map: (item: Record<string, unknown>) => FaultRow) => {
  target.rows = (response.items || []).map((item) => map(item as Record<string, unknown>))
  target.total = Number(response.total ?? target.rows.length)
  target.counts = Array.isArray(response.state_counts) ? response.state_counts : []
}

const fetchData = async () => {
  const seq = ++fetchSeq
  loading.value = true
  error.value = ''
  const query = { page: 1, page_size: LATEST_LIMIT }
  const [defectRes, corrosionRes, lookupsRes] = await Promise.allSettled([
    fastApiService.getDefects(query),
    fastApiService.getCorrosionIndicators(query),
    defectStates.value.length ? Promise.resolve(null) : fastApiService.getDefectLookups()
  ])
  if (seq !== fetchSeq) return
  loading.value = false
  const failures: string[] = []
  if (defectRes.status === 'fulfilled') apply(defects, defectRes.value, toDefectRow)
  else failures.push(describeFailure('дефекты', defectRes.reason))
  if (corrosionRes.status === 'fulfilled') apply(corrosion, corrosionRes.value, toCorrosionRow)
  else failures.push(describeFailure('индикаторы коррозии', corrosionRes.reason))
  if (lookupsRes.status === 'fulfilled' && lookupsRes.value) defectStates.value = lookupsRes.value.states as { id: number; name: string }[]
  if (failures.length === 2) {
    error.value = failures.join('; ')
    notificationStore.showError(error.value)
    return
  }
  partialWarnings.value = failures
  if (lookupsRes.status === 'rejected') partialWarnings.value.push('Справочник состояний дефектов не загрузился — плитки состояний не показаны')
  loaded.value = true
}

/** 404 на журнальных маршрутах — на сервере устаревшая версия API */
const describeFailure = (what: string, err: unknown) => {
  const status = (err as { statusCode?: number; response?: { status?: number } })?.statusCode
    ?? (err as { response?: { status?: number } })?.response?.status
  return status === 404
    ? `Журнал «${what}» недоступен на сервере API — похоже, развёрнута устаревшая версия itwin-api`
    : formatApiErrorWith(`Не загрузились ${what}`, err, 'неизвестная ошибка')
}

const kindTiles = computed(() => (['defect', 'corrosion'] as const).map((kind) => ({
  kind,
  label: KIND_LABEL[kind],
  total: kind === 'defect' ? defects.total : corrosion.total
})))

/** Состояния дефектов по всей базе; записи без состояния — отдельной плиткой, если они есть */
const stateTiles = computed(() => {
  if (!defectStates.value.length || !defects.counts.length) return []
  const counts = new Map(defects.counts.map((c) => [c.state_id, c.count]))
  const tiles = defectStates.value.map((state) => ({
    key: `state-${state.id}`,
    label: state.name,
    count: counts.get(state.id) ?? 0,
    status: DEFECT_STATE_STATUS[state.id] ?? 'none' as KpiStatus
  }))
  const withoutState = counts.get(null) ?? 0
  if (withoutState) tiles.push({ key: 'state-none', label: 'Без состояния', count: withoutState, status: 'none' })
  return tiles
})

/** Показаны не все записи журнала — сказать об этом и дать перейти к полному списку */
const truncatedNotes = computed(() => (['defect', 'corrosion'] as const)
  .map((kind) => {
    const source = kind === 'defect' ? defects : corrosion
    if (source.total <= source.rows.length) return null
    if (kindFilter.value !== 'all' && kindFilter.value !== kind) return null
    return { kind, text: `${KIND_LABEL[kind]}: последние ${source.rows.length} из ${source.total.toLocaleString('ru-RU')}` }
  })
  .filter((note): note is { kind: FaultKind; text: string } => note !== null))

const tableRows = computed(() => {
  const rows = kindFilter.value === 'defect'
    ? defects.rows
    : kindFilter.value === 'corrosion' ? corrosion.rows : [...defects.rows, ...corrosion.rows]
  const query = search.value.trim().toLowerCase()
  if (!query) return rows
  return rows.filter((row) => [row.title, row.state, row.place, row.description].some((v) => v.toLowerCase().includes(query)))
})

const columns: DataTableColumn[] = [
  { key: 'kind', title: '', width: 36, sortable: false },
  { key: 'date', title: 'Дата', type: 'date', width: 110 },
  { key: 'title', title: 'Объект', width: 200 },
  { key: 'state', title: 'Состояние / этап', width: 150 },
  { key: 'place', title: 'Адрес / место' },
  { key: 'description', title: 'Описание' },
  { key: 'locate', title: '', width: 36, sortable: false }
]

const formatDate = (value: unknown) => {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '—'
}

const locateFault = (fault: FaultRow) => {
  if (fault.lat == null || fault.lng == null) {
    notificationStore.showWarning('Координаты неисправности не указаны')
    return
  }
  mapStore.map?.flyTo({ center: [fault.lng, fault.lat], zoom: 18, duration: 1400, essential: true })
  if (fault.kind === 'defect') emit('open-defect', fault.id)
  else emit('open-corrosion', fault.id)
}

const openDialog = () => {
  dialog.value = true
  if (!loaded.value && !loading.value) void fetchData()
}

defineExpose({
  openDialog
})
</script>

<style scoped>
.fault-layers { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-6, 24px); }
.fault-layers__label { display: inline-flex; align-items: center; gap: var(--space-1); }
.fault-tiles { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.fault-search { flex: 0 1 360px; min-width: 220px; }
.fault-notes { display: flex; flex-direction: column; align-items: flex-end; }
</style>
