<template>
  <v-dialog
    v-model="visible"
    :fullscreen="isMobile"
    max-width="1100"
    scrollable
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-3 px-4 py-3">
        <v-avatar
          color="primary"
          variant="tonal"
          size="40"
        >
          <v-icon>mdi-gauge</v-icon>
        </v-avatar>
        <div
          class="flex-grow-1"
          style="min-width: 0"
        >
          <div class="text-subtitle-1 font-weight-bold">
            Анализ режима
          </div>
          <div class="text-caption text-medium-emphasis text-truncate">
            Аналог desktop «Анализ» по результатам расчёта фрагмента; щелчок по строке — объект на карте
          </div>
        </div>
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
              @click="visible = false"
            />
          </template>
        </HintTip>
      </v-card-title>
      <v-divider />
      <v-card-text>
        <div class="d-flex flex-wrap ga-3 mb-3">
          <AppSelect
            v-model="fragmentId"
            :items="fragmentItems"
            item-title="title"
            item-value="value"
            label="Фрагмент"
            style="min-width: 260px; max-width: 360px"
            searchable
            :clearable="false"
          />
          <AppSelect
            v-model="calculationId"
            :items="calculationItems"
            item-title="title"
            item-value="value"
            label="Расчёт"
            :loading="calculationsLoading"
            :disabled="!fragmentId"
            style="min-width: 240px; max-width: 340px"
            :clearable="false"
          />
          <AppSelect
            v-model="queryKey"
            :items="queryItems"
            item-title="title"
            item-value="value"
            label="Запрос"
            style="min-width: 320px; flex: 1"
            :clearable="false"
          />
          <v-btn
            color="primary"
            :loading="loading"
            :disabled="!fragmentId || !queryKey"
            @click="run"
          >
            Выполнить
          </v-btn>
        </div>

        <StateView
          variant="table"
          :rows="8"
          :loading="loading"
          :error="error"
          :empty="!loading && !error && !result"
          empty-title="Выберите фрагмент и запрос"
          empty-text="«Выполнить» покажет объекты, найденные по результатам расчёта"
          empty-icon="mdi-gauge"
          error-title="Анализ не выполнен"
          :retrying="loading"
          @retry="run"
        >
          <template v-if="result">
            <div class="d-flex flex-wrap align-center ga-2 mb-3">
              <span class="text-subtitle-1 font-weight-medium">{{ result.title }}</span>
              <v-chip
                v-if="result.calculation_id"
                size="small"
                variant="tonal"
                color="primary"
              >
                Расчёт №{{ result.calculation_id }}<template v-if="result.tn != null">, Tн {{ result.tn }} °C</template>
              </v-chip>
              <v-spacer />
              <v-btn
                size="small"
                variant="tonal"
                prepend-icon="mdi-map-marker-multiple"
                :disabled="!mapPointsCount"
                @click="showAllOnMap"
              >
                Показать все на карте ({{ mapPointsCount }})
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                prepend-icon="mdi-map-marker-off"
                @click="emit('clearMap')"
              >
                Скрыть с карты
              </v-btn>
            </div>
            <p
              v-if="result.note"
              class="text-caption text-medium-emphasis mb-2"
            >
              {{ result.note }}
            </p>

            <v-alert
              v-if="result.query === 'hydrostatic_zones' && result.full_static_head_m != null"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-3"
            >
              Полный статический напор <strong>{{ formatNum(result.full_static_head_m) }} м</strong>,
              пьезометрический статический напор <strong>{{ formatNum(result.piezometric_static_head_m) }} м</strong>.
              Минимальная отметка верха трубы {{ formatNum(result.min_geo_mark_m) }} м
              (узел {{ result.min_geo_node?.code }} {{ result.min_geo_node?.name }}).
              Ниже — узлы нижней зоны.
            </v-alert>

            <!-- Итог: число найденных и с координатой; режимы — плитки-фильтры; распределение ключевого показателя -->
            <div class="ra-summary mb-3">
              <div class="ra-tiles">
                <KpiTile
                  label="Найдено"
                  :value="result.count"
                  :compact="false"
                  :status="foundStatus"
                />
                <KpiTile
                  label="С координатой"
                  :value="mapPointsCount"
                  :compact="false"
                />
                <KpiTile
                  v-for="tile in summaryChips"
                  :key="tile.mode"
                  :label="tile.mode"
                  :value="tile.count"
                  :compact="false"
                  selectable
                  :active="modeFilter === tile.mode"
                  @select="modeFilter = modeFilter === tile.mode ? null : tile.mode"
                />
              </div>
              <MiniHistogram
                v-if="metric && filteredRows.length > 1"
                class="ra-histogram"
                :values="filteredRows.map((row) => row[metric!.key])"
                :label="metric.label"
                :units="metric.units"
              />
            </div>

            <DataTable
              :columns="tableColumns"
              :items="tableRows"
              item-key="_row"
              selectable
              density="compact"
              :height="420"
              no-data-text="Записей нет"
              class="ra-table"
              @select="locate"
            >
              <template
                v-for="col in columns"
                :key="col.key"
                #[`item.${col.key}`]="{ item }"
              >
                {{ formatCell(item[col.key]) }}
              </template>
              <template #[`item._locate`]="{ item }">
                <v-icon
                  v-if="hasCoords(item)"
                  size="16"
                  color="primary"
                  aria-label="Есть на карте"
                >
                  mdi-crosshairs-gps
                </v-icon>
              </template>
            </DataTable>
          </template>
        </StateView>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import AppSelect from '~/components/AppSelect.vue'
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue'
import HintTip from '~/components/HintTip.vue'
import KpiTile from '~/components/KpiTile.vue'
import MiniHistogram from '~/components/MiniHistogram.vue'
import StateView from '~/components/StateView.vue'
import { formatApiError, formatApiErrorWith } from '~/utils/apiError'
import { computed, ref, watch } from 'vue'
import { useMobile } from '~/composables/useMobile'
import { fastApiService, type RegimeAnalysisKind, type RegimeAnalysisResult } from '~/services/fastApiService'
import { useFragmentStore } from '~/stores/fragmentStore'
import { useNotificationStore } from '~/stores/notificationStore'
import { regimePoints, type RegimePointsResult } from '~/utils/regimeMapPoints'

const emit = defineEmits<{
  (e: 'locate', point: { lat: number; lng: number }): void
  (e: 'showAll', points: RegimePointsResult): void
  (e: 'clearMap'): void
}>()

const { isMobile } = useMobile()
const fragmentStore = useFragmentStore()
const visible = ref(false)
const loading = ref(false)
const error = ref('')
const result = ref<RegimeAnalysisResult | null>(null)
const fragmentId = ref<number | null>(null)
// null — последний расчёт фрагмента (как раньше); иначе выбранный (QA F39)
const calculationId = ref<number | null>(null)
const calculations = ref<Array<{ id: number; calculated_at: string | null; tn: number | null; name: string | null; has_results: boolean }>>([])
const calculationsLoading = ref(false)
const queryKey = ref<string>('negative-dp')
const modeFilter = ref<string | null>(null)
const admissibility = ref<{ id: number; title: string }[]>([])

interface Column { key: string; title: string }

// Запросы gid6 «Анализ» и колонки их результатов
const REGIME: Record<string, { title: string; kind: RegimeAnalysisKind; uncalculated?: boolean; columns: Column[] }> = {
  'negative-dp': {
    title: 'Отрицательные перепады',
    kind: 'negative-dp',
    columns: [
      { key: 'code', title: 'Код' }, { key: 'name', title: 'Узел' },
      { key: 'pih_supply', title: 'Напор подача, м' }, { key: 'pih_return', title: 'Напор обратка, м' },
      { key: 'dp', title: 'Перепад, м' },
    ],
  },
  airlock: {
    title: 'Завоздушивание',
    kind: 'airlock',
    columns: [
      { key: 'code', title: 'Код' }, { key: 'name', title: 'Узел' }, { key: 'consumer', title: 'Потребитель' },
      { key: 'scheme', title: 'Схема' }, { key: 'building_height', title: 'Высота здания, м' },
      { key: 'pih_supply', title: 'Напор подача, м' }, { key: 'shortfall', title: 'Недостаток, м' },
    ],
  },
  'low-temperature': {
    title: 'Низкие температуры',
    kind: 'low-temperature',
    columns: [
      { key: 'code', title: 'Код' }, { key: 'name', title: 'Узел' }, { key: 'consumer', title: 'Потребитель' },
      { key: 't_supply', title: 't подачи, °C' }, { key: 't2_graph', title: 't2 графика, °C' },
      { key: 'no_flow', title: 'Нет расхода' },
    ],
  },
  'closed-sections': {
    title: 'Закрытые участки',
    kind: 'closed-sections',
    columns: SECTION_COLUMNS(),
  },
  'disconnected-sections': {
    title: 'Отключенные участки',
    kind: 'closed-sections',
    uncalculated: true,
    columns: SECTION_COLUMNS(),
  },
  'hydrostatic-zones': {
    title: 'Гидростатические зоны',
    kind: 'hydrostatic-zones',
    columns: [
      { key: 'code', title: 'Код' }, { key: 'name', title: 'Узел' },
      { key: 'geo_mark', title: 'Отметка верха трубы, м' }, { key: 'building_height', title: 'Высота здания, м' },
    ],
  },
}

function SECTION_COLUMNS(): Column[] {
  return [
    { key: 'state', title: 'Состояние' },
    { key: 'code1', title: 'Код нач.' }, { key: 'name1', title: 'Начальный узел' },
    { key: 'code2', title: 'Код кон.' }, { key: 'name2', title: 'Конечный узел' },
    { key: 'sign', title: 'П/О' }, { key: 'length_m', title: 'Длина, м' },
    { key: 'diameter_mm', title: 'Dвн, мм' }, { key: 'heat_source', title: 'Источник' },
    { key: 'owner', title: 'Владелец' },
  ]
}

const queryItems = computed(() => [
  ...Object.entries(REGIME).map(([value, q]) => ({ value, title: q.title })),
  ...admissibility.value.map((a) => ({ value: `adm-${a.id}`, title: `Анализ режима: ${a.title}` })),
])

const fragmentItems = computed(() =>
  fragmentStore.fragments.map((f: { id: number; name?: string }) => ({
    value: f.id,
    title: f.name ? `${f.name} (#${f.id})` : `Фрагмент #${f.id}`,
  })),
)

const columns = computed<Column[]>(() => {
  const r = result.value
  if (!r) return []
  if (r.columns) {
    return r.columns.filter((c) => !c.startsWith('_')).map((c) => ({ key: c, title: c }))
  }
  return REGIME[queryKey.value]?.columns ?? []
})

const summaryChips = computed(() =>
  Object.entries(result.value?.summary || {}).map(([mode, count]) => ({ mode, count })),
)

const filteredRows = computed(() => {
  const items = result.value?.items || []
  const col = result.value?.mode_column
  if (!modeFilter.value || !col) return items
  return items.filter((i) => String(i[col]) === modeFilter.value)
})

/** Ключевой показатель запроса — его распределение мини-гистограммой (у запросов допустимости — нет) */
const METRICS: Record<string, { key: string; label: string; units: string }> = {
  'negative-dp': { key: 'dp', label: 'Перепад', units: 'м' },
  airlock: { key: 'shortfall', label: 'Недостаток напора', units: 'м' },
  'low-temperature': { key: 't_supply', label: 't подачи', units: '°C' },
  'closed-sections': { key: 'length_m', label: 'Длина участков', units: 'м' },
  'disconnected-sections': { key: 'length_m', label: 'Длина участков', units: 'м' },
  'hydrostatic-zones': { key: 'geo_mark', label: 'Отметка верха трубы', units: 'м' },
}
/** Запросы-проблемы (найденное — нарушение режима): плитка «Найдено» с состоянием; у справочных — без */
const PROBLEM_QUERIES = new Set(['negative-dp', 'airlock', 'low-temperature'])
const foundStatus = computed(() => {
  if (!result.value || !(PROBLEM_QUERIES.has(queryKey.value) || queryKey.value.startsWith('adm-'))) return 'none'
  return result.value.count ? 'warning' : 'good'
})
const metric = computed(() => (result.value ? METRICS[queryKey.value] ?? null : null))

/** Строки таблицы: ключ строки — порядковый номер (у результатов анализа нет общего id) */
const tableRows = computed(() => filteredRows.value.map((row, index) => ({ ...row, _row: index })))
/** Колонки: числовые — вправо (по первому непустому значению), первая — отметка «есть на карте» */
const tableColumns = computed<DataTableColumn[]>(() => {
  const rows = filteredRows.value
  const isNumeric = (key: string) => typeof rows.find((row) => row[key] != null && row[key] !== '')?.[key] === 'number'
  return [
    { key: '_locate', title: '', width: 36, sortable: false },
    ...columns.value.map((col) => ({ key: col.key, title: col.title, type: isNumeric(col.key) ? 'number' as const : 'text' as const })),
  ]
})

const formatNum = (v: number | null | undefined) =>
  v == null || Number.isNaN(Number(v))
    ? '—'
    : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(v))

const formatCell = (v: unknown) => {
  if (v == null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'да' : ''
  if (typeof v === 'number') return formatNum(v)
  return String(v)
}

const hasCoords = (row: Record<string, any>) => row.latitude != null && row.longitude != null

const calculationItems = computed(() => [
  { title: 'Последний расчёт', value: null },
  ...calculations.value.map(c => ({
    value: c.id,
    title: [
      `№${c.id}`,
      c.calculated_at ? new Date(c.calculated_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : null,
      c.tn != null ? `Tн ${c.tn} °C` : null,
      c.name,
    ].filter(Boolean).join(' · '),
  })),
])

const notifications = useNotificationStore()
/** Номера последних запросов: ответ по прежнему фрагменту или запросу, пришедший позже, отбрасывается */
let calculationsSeq = 0
let runSeq = 0

const loadCalculations = async () => {
  const seq = ++calculationsSeq
  calculations.value = []
  calculationId.value = null
  if (!fragmentId.value) {
    calculationsLoading.value = false
    return
  }
  calculationsLoading.value = true
  try {
    const res = await fastApiService.listCalculations({ file_id: fragmentId.value, limit: 50 })
    if (seq === calculationsSeq) calculations.value = res.items.filter(c => c.has_results !== false)
  } catch (err: unknown) {
    // список не обязателен (запросы идут по последнему расчёту), но выбор расчёта пропал — сказать об этом
    if (seq === calculationsSeq) notifications.showWarning(formatApiErrorWith('Список расчётов фрагмента не загрузился — анализ по последнему расчёту', err))
  } finally {
    if (seq === calculationsSeq) calculationsLoading.value = false
  }
}
watch(fragmentId, () => { void loadCalculations() })

// все найденные объекты с координатами (с учётом фильтра режима), как подсветка gid6
const mapPoints = computed(() => regimePoints(filteredRows.value))
const mapPointsCount = computed(() => mapPoints.value.data.features.length)
const showAllOnMap = () => {
  if (mapPointsCount.value) emit('showAll', mapPoints.value)
}

const locate = (row: Record<string, any>) => {
  if (hasCoords(row)) emit('locate', { lat: row.latitude, lng: row.longitude })
}

const run = async () => {
  if (!fragmentId.value || !queryKey.value) return
  const seq = ++runSeq
  loading.value = true
  error.value = ''
  result.value = null
  modeFilter.value = null
  try {
    let next: RegimeAnalysisResult
    if (queryKey.value.startsWith('adm-')) {
      next = await fastApiService.getAdmissibility(
        Number(queryKey.value.slice(4)), fragmentId.value, calculationId.value ?? undefined)
    } else {
      const q = REGIME[queryKey.value]
      next = await fastApiService.getRegimeAnalysis(q.kind, fragmentId.value, {
        includeUncalculated: q.uncalculated,
        calculationId: calculationId.value ?? undefined,
      })
    }
    if (seq === runSeq) result.value = next
  } catch (e: unknown) {
    if (seq === runSeq) error.value = formatApiError(e)
  } finally {
    if (seq === runSeq) loading.value = false
  }
}

const openDialog = async () => {
  visible.value = true
  error.value = ''
  if (fragmentId.value == null) {
    fragmentId.value = fragmentStore.selectedFragmentId
      ?? (fragmentStore.visibleFragments.length === 1 ? [...fragmentStore.visibleFragments][0] : null)
  }
  if (!admissibility.value.length) {
    try {
      admissibility.value = await fastApiService.getAdmissibilityCatalog()
    } catch (err: unknown) {
      // каталог — только для списка запросов; основные запросы работают и без него
      notifications.showWarning(formatApiErrorWith('Каталог анализов режима не загрузился — в списке только основные запросы', err))
    }
  }
}

defineExpose({ openDialog })
</script>

<style scoped>
.ra-summary { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-3); }
.ra-tiles { display: flex; flex-wrap: wrap; gap: var(--space-2); flex: 1 1 360px; }
.ra-histogram { flex: 0 1 300px; min-width: 220px; }
</style>
