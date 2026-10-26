<template>
  <v-dialog
    v-model="visible"
    :fullscreen="isMobile"
    max-width="1550"
    scrollable
  >
    <v-card
      class="consumer-load-journal"
      :rounded="isMobile ? 0 : 'lg'"
    >
      <v-card-title class="d-flex align-center ga-3 px-4 py-3">
        <v-avatar
          color="primary"
          variant="tonal"
          size="40"
        >
          <v-icon>mdi-home-lightning-bolt-outline</v-icon>
        </v-avatar>
        <div
          class="flex-grow-1"
          style="min-width: 0"
        >
          <div class="text-subtitle-1 font-weight-bold">
            Диагностика тепловых нагрузок
          </div>
          <div class="text-caption text-medium-emphasis text-truncate">
            Потребители с нулевой нагрузкой, закрытые, отключённые и без расчёта; щелчок по строке — карточка
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
              @click="reload"
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
              @click="visible = false"
            />
          </template>
        </HintTip>
      </v-card-title>
      <v-divider />

      <v-alert
        v-if="lookups.calculation_warning"
        class="ma-3 mb-0"
        density="compact"
        icon="mdi-alert-circle-outline"
        type="warning"
        variant="tonal"
      >
        {{ lookups.calculation_warning }} Записи показаны как «нет расчёта», а не как отключённые.
      </v-alert>

      <!-- Итог по текущим фильтрам: всего и по видам диагностики; плитка вида — фильтр (повторный щелчок снимает) -->
      <div class="load-kpi px-3 pt-3">
        <KpiTile
          label="Потребителей"
          :value="scopeCount('total')"
          :compact="false"
        />
        <KpiTile
          v-for="item in diagnosticOptions"
          :key="item.value"
          :label="item.title"
          :value="scopeCount(item.value)"
          :status="scopeCount(item.value) ? item.status : 'none'"
          :compact="false"
          selectable
          :active="filters.diagnostic === item.value"
          @select="selectDiagnostic(item.value)"
        />
      </div>

      <div class="filters pa-3">
        <SearchField
          :model-value="filters.search ?? ''"
          label="Потребитель, узел, код, фрагмент или ID"
          :debounce="350"
          :loading="loading"
          @update:model-value="filters.search = $event || undefined"
          @search="reload"
        />
        <AppSelect
          v-model="filters.consumer_type"
          :items="consumerTypeOptions"
          label="Тип потребителя"
        />
        <AppSelect
          v-model="filters.fragment_id"
          :items="lookups.fragments"
          item-title="name"
          item-value="id"
          label="Фрагмент схемы"
        />
        <AppSelect
          v-model="filters.state_id"
          :items="lookups.states"
          item-title="name"
          item-value="id"
          label="Состояние"
        />
        <HintTip text="Все найденные потребители по текущим фильтрам, не только эта страница">
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              variant="tonal"
              prepend-icon="mdi-file-delimited-outline"
              :loading="exporting"
              :disabled="!total"
              @click="exportCsv"
            >
              Экспорт (CSV)
            </v-btn>
          </template>
        </HintTip>
      </div>
      <v-divider />

      <div class="table-wrap">
        <StateView
          variant="table"
          :rows="10"
          :loading="loading && !items.length"
          :error="error"
          :empty="!loading && !error && !items.length"
          empty-title="Потребители не найдены"
          empty-text="По выбранным условиям потребителей нет — измените фильтры или снимите вид диагностики"
          empty-icon="mdi-database-search-outline"
          error-title="Список потребителей не загружен"
          :retrying="loading"
          @retry="loadPage"
        >
          <v-progress-linear
            v-if="loading"
            indeterminate
            color="primary"
          />
          <DataTable
            :columns="columns"
            :items="tableRows"
            item-key="key"
            selectable
            height="100%"
            class="load-table"
            @select="(row) => openDetails(row.consumer_type as ConsumerLoadType, Number(row.id))"
          >
            <template #[`item.type`]="{ item }">
              <v-chip
                size="x-small"
                variant="tonal"
              >
                {{ typeLabel(item.consumer_type as ConsumerLoadType) }}
              </v-chip>
              <span class="text-caption ml-1">№{{ item.id }}</span>
            </template>
            <template #[`item.node`]="{ item }">
              {{ item.external_code || '—' }}
              <span class="text-caption text-medium-emphasis">· {{ item.external_node_name || `ID ${item.node_id}` }}</span>
            </template>
            <template
              v-for="key in LOAD_KEYS"
              :key="key"
              #[`item.${key}`]="{ item }"
            >
              {{ formatLoad(item[key] as number | null) }}
            </template>
            <template #[`item.state_name`]="{ item }">
              <v-chip
                v-if="item.state_name"
                size="x-small"
                variant="outlined"
              >
                {{ item.state_name }}
              </v-chip>
            </template>
            <template #[`item.actions`]="{ item }">
              <HintTip
                text="Показать на карте"
                location="left"
              >
                <template #default="{ props: tip }">
                  <v-btn
                    v-bind="tip"
                    icon="mdi-crosshairs-gps"
                    variant="text"
                    size="small"
                    :disabled="!hasCoordinates(item as unknown as ConsumerLoadSummary)"
                    aria-label="Показать на карте"
                    @click.stop="locateItem(item as unknown as ConsumerLoadSummary)"
                  />
                </template>
              </HintTip>
            </template>
          </DataTable>
        </StateView>
      </div>

      <v-divider />
      <div class="pagination-row">
        <span class="text-caption text-medium-emphasis">
          Найдено: {{ formatInteger(total) }}<template v-if="pages > 1">, страница {{ page }} из {{ pages }}</template>
        </span>
        <v-pagination
          v-if="pages > 1"
          v-model="page"
          :length="pages"
          :total-visible="isMobile ? 3 : 7"
          density="compact"
          @update:model-value="loadPage"
        />
      </div>
    </v-card>
  </v-dialog>

  <v-dialog
    v-model="detailsVisible"
    :fullscreen="isMobile"
    max-width="1180"
    scrollable
  >
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-card-title class="d-flex align-center ga-3 px-4 py-3">
        <div
          class="flex-grow-1 text-subtitle-1 font-weight-bold text-truncate"
          style="min-width: 0"
        >
          {{ detailsTitle }}
        </div>
        <v-btn
          v-if="details && hasCoordinates(details)"
          prepend-icon="mdi-crosshairs-gps"
          variant="tonal"
          @click="locateDetails"
        >
          На карте
        </v-btn>
        <HintTip
          text="Закрыть карточку"
          hotkey="Esc"
          location="bottom"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-close"
              variant="text"
              aria-label="Закрыть карточку"
              @click="detailsVisible = false"
            />
          </template>
        </HintTip>
      </v-card-title>
      <v-divider />

      <v-card-text class="pa-4">
        <StateView
          variant="card"
          :loading="detailLoading"
          :error="detailError"
          :empty="false"
          error-title="Карточка потребителя не загружена"
          :retrying="detailLoading"
          @retry="detailTarget && openDetails(detailTarget.type, detailTarget.id)"
        >
          <template v-if="details">
            <div class="status-chips mb-4">
              <v-chip :color="details.closed ? 'error' : 'success'">
                {{ details.state_name || 'Состояние не задано' }}
              </v-chip>
              <v-chip
                v-if="details.zero_load"
                color="warning"
              >
                Нулевая нагрузка (отопление, вентиляция, ГВС)
              </v-chip>
              <v-chip
                v-else-if="details.zero_heating_load"
                color="warning"
                variant="outlined"
              >
                Нулевая отопительная нагрузка
              </v-chip>
              <v-chip v-if="!details.calculation_available">
                Фрагмент не рассчитан
              </v-chip>
              <v-chip
                v-else-if="!details.has_calculation_output"
                color="error"
              >
                Нет результата PT_OUT
              </v-chip>
              <v-chip
                v-else
                color="success"
                variant="outlined"
              >
                Результат расчёта найден
              </v-chip>
            </div>

            <div class="detail-grid mb-5">
              <DetailValue
                label="Тип"
                :value="typeLabel(details.consumer_type)"
              />
              <DetailValue
                label="Потребитель"
                :value="details.name"
              />
              <DetailValue
                label="Узел"
                :value="details.node_id"
              />
              <DetailValue
                label="Код узла"
                :value="details.external_code"
              />
              <DetailValue
                label="Наименование узла"
                :value="details.external_node_name"
              />
              <DetailValue
                label="Фрагмент"
                :value="details.fragment_name"
              />
            </div>

            <h3 class="text-subtitle-2 mb-2">
              Расчётные нагрузки, Гкал/ч
            </h3>
            <div class="load-tiles mb-5">
              <KpiTile
                v-for="load in detailLoads"
                :key="load.label"
                :label="load.label"
                :value="formatLoad(load.value)"
                :compact="false"
                :class="{ 'load-tiles__total': load.total }"
              />
            </div>

            <h3 class="text-subtitle-2 mb-2">
              Состав отопительной нагрузки
            </h3>
            <div class="detail-grid mb-5">
              <DetailValue
                v-for="field in componentFields"
                :key="field.key"
                :label="field.label"
                :value="attributeValue(field.key)"
              />
            </div>

            <v-alert
              v-if="!details.latest_output"
              density="compact"
              type="info"
              variant="tonal"
            >
              Результат последнего гидравлического расчёта для этого узла отсутствует.
            </v-alert>
            <template v-else>
              <h3 class="text-subtitle-2 mb-2">
                Последний результат PT_OUT
              </h3>
              <div class="detail-grid mb-5">
                <DetailValue
                  label="Расчёт"
                  :value="details.latest_calculation_id"
                />
                <DetailValue
                  label="Требуемая нагрузка"
                  :value="recordValue(details.latest_output, 'required_total')"
                />
                <DetailValue
                  label="Полученная нагрузка"
                  :value="recordValue(details.latest_output, 'delivered_total')"
                />
                <DetailValue
                  label="Фактическая нагрузка"
                  :value="recordValue(details.latest_output, 'actual_total')"
                />
              </div>
            </template>

            <template v-if="details.related_consumers.length">
              <h3 class="text-subtitle-2 mt-5 mb-2">
                Другие потребители на узле
              </h3>
              <div class="related-list">
                <v-chip
                  v-for="related in details.related_consumers"
                  :key="`${recordValue(related, 'consumer_type')}-${recordValue(related, 'id')}`"
                  variant="outlined"
                >
                  {{ recordValue(related, 'name') || `№${recordValue(related, 'id')}` }}
                </v-chip>
              </div>
            </template>
          </template>
        </StateView>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, reactive, ref, watch, type PropType } from 'vue'
import AppSelect from '~/components/AppSelect.vue'
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue'
import HintTip from '~/components/HintTip.vue'
import KpiTile, { type KpiStatus } from '~/components/KpiTile.vue'
import SearchField from '~/components/SearchField.vue'
import StateView from '~/components/StateView.vue'
import { useMobile } from '~/composables/useMobile'
import {
  fastApiService,
  type ConsumerLoadDetails,
  type ConsumerLoadDiagnosticKind,
  type ConsumerLoadLookups,
  type ConsumerLoadSummary,
  type ConsumerLoadType,
} from '~/services/fastApiService'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiErrorWith } from '~/utils/apiError'
import {
  DEFAULT_CONSUMER_LOAD_FILTERS,
  consumerLoadFiltersForScope,
  type ConsumerLoadFilters,
  type ConsumerLoadScope,
} from '~/utils/consumerLoadScope'
import { hasLonLat } from '~/utils/journalFields'

/**
 * Диагностика тепловых нагрузок потребителей: журнал с серверной пагинацией (`DataTable`), плитки видов
 * диагностики — счётчики по текущим фильтрам и фильтр вида, карточка потребителя с нагрузками и результатом PT_OUT.
 * Фильтры применяются сразу; поиск — после паузы ввода. Экспорт CSV — все найденные, постранично.
 */
const DetailValue = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number] as PropType<string | number | null>, default: null },
  },
  setup(props) {
    return () => h('div', { class: 'detail-value' }, [
      h('div', { class: 'detail-label' }, props.label),
      h('div', String(props.value ?? '—')),
    ])
  },
})

const emit = defineEmits<{
  'locate-consumer': [payload: { longitude: number; latitude: number; id: number; nodeId: number; label: string }]
}>()

const PAGE_SIZE = 50
/** Экспорт: страницы по максимуму API и предел, чтобы не выкачивать базу целиком */
const EXPORT_PAGE_SIZE = 200
const EXPORT_MAX_ROWS = 20000
const LOAD_KEYS = ['heating_load', 'ventilation_load', 'hot_water_load', 'total_load'] as const

const { isMobile } = useMobile()
const notifications = useNotificationStore()
const visible = ref(false)
const detailsVisible = ref(false)
const loading = ref(false)
const error = ref('')
const exporting = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detailTarget = ref<{ type: ConsumerLoadType; id: number } | null>(null)
const items = ref<ConsumerLoadSummary[]>([])
const details = ref<ConsumerLoadDetails | null>(null)
const page = ref(1)
const pages = ref(0)
const total = ref(0)
const lookups = ref<ConsumerLoadLookups>({ states: [], fragments: [], counts: {}, calculation_warning: null })
const filters = reactive<ConsumerLoadFilters>({ ...DEFAULT_CONSUMER_LOAD_FILTERS })
/** Пока openDialog раскладывает фильтры области — наблюдатель фильтров молчит (список грузит сам openDialog) */
let applyingScope = false
let listRequest = 0
let detailRequest = 0

const consumerTypeOptions = [
  { title: 'Обобщённый', value: 'generalized' },
  { title: 'Реальный', value: 'real' },
]
const diagnosticOptions: Array<{ title: string; value: ConsumerLoadDiagnosticKind; status: KpiStatus }> = [
  { title: 'Нулевая нагрузка', value: 'zero_load', status: 'warning' },
  { title: 'Закрытые', value: 'closed', status: 'none' },
  { title: 'Отключённые', value: 'disconnected', status: 'serious' },
  { title: 'Нет расчёта', value: 'not_calculated', status: 'warning' },
]
const columns: DataTableColumn[] = [
  { key: 'type', title: 'Тип / ID', width: 150, sortable: false },
  { key: 'name', title: 'Потребитель' },
  { key: 'node', title: 'Узел', sortable: false },
  { key: 'fragment', title: 'Фрагмент' },
  { key: 'heating_load', title: 'Отопление, Гкал/ч', type: 'number', width: 130 },
  { key: 'ventilation_load', title: 'Вентиляция, Гкал/ч', type: 'number', width: 130 },
  { key: 'hot_water_load', title: 'ГВС, Гкал/ч', type: 'number', width: 110 },
  { key: 'total_load', title: 'Всего, Гкал/ч', type: 'number', width: 120 },
  { key: 'state_name', title: 'Состояние', width: 140 },
  { key: 'actions', title: '', type: 'actions', width: 56, sortable: false },
]
const tableRows = computed(() => items.value.map((item) => ({
  ...item,
  key: `${item.consumer_type}-${item.id}`,
  name: item.name || 'Без наименования',
  fragment: item.fragment_name || `Фрагмент ${item.fragment_id ?? '—'}`,
})) as Record<string, unknown>[])

const generalizedFields = [
  ['calchldep', 'Зависимая схема'], ['calchlindep', 'Независимая схема'],
  ['calchlparall', 'Параллельная схема'], ['calchlmix', 'Смешанная схема'],
  ['calchlconseq', 'Последовательная схема'], ['calchlpreon', 'Предвключённая схема'],
] as const
const realFields = [
  ['calchldep', 'Зависимая схема'], ['calchlindep', 'Независимая схема'],
  ['contcalchldep', 'Договорная зависимая'], ['contcalchlindep', 'Договорная независимая'],
  ['perspcalchldep', 'Перспективная зависимая'], ['perspcalchlindep', 'Перспективная независимая'],
] as const
const componentFields = computed(() => (details.value?.consumer_type === 'generalized' ? generalizedFields : realFields).map(([key, label]) => ({ key, label })))
const detailsTitle = computed(() => details.value ? `${details.value.name || 'Потребитель'} · №${details.value.id}` : 'Карточка потребителя')
const detailLoads = computed(() => {
  const d = details.value
  if (!d) return []
  return [
    { label: 'Отопление', value: d.heating_load },
    { label: 'Вентиляция', value: d.ventilation_load },
    { label: 'Кондиционирование', value: d.conditioning_load },
    { label: 'ГВС', value: d.hot_water_load },
    { label: 'Всего', value: d.total_load, total: true },
  ]
})

function formatInteger(value: unknown) { return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(value || 0)) }
function formatLoad(value: number | null | undefined) { return value === null || value === undefined ? '—' : new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(value) }
function typeLabel(type: ConsumerLoadType) { return type === 'generalized' ? 'Обобщённый' : 'Реальный' }
function recordValue(record: Record<string, unknown> | null | undefined, key: string): string | number | null { const value = record?.[key]; return typeof value === 'string' || typeof value === 'number' ? value : null }
function attributeValue(key: string) { return recordValue(details.value?.attributes, key) }
function hasCoordinates(item: ConsumerLoadSummary) { return hasLonLat(item) }
// Счётчики — по текущим фильтрам (фрагмент, тип, состояние, поиск) из ответа списка;
// до первой загрузки — общие из lookups (QA F36)
const scopeCounts = ref<Record<string, number> | null>(null)
function scopeCount(kind: string) { return (scopeCounts.value ?? lookups.value.counts)[kind] || 0 }

async function loadLookups() {
  if (lookups.value.states.length) return
  try {
    lookups.value = await fastApiService.getConsumerLoadLookups()
  } catch (err: unknown) {
    // список работает и без справочников — фильтры фрагмента и состояния будут пустыми
    notifications.showWarning(formatApiErrorWith('Справочники не загрузились — фильтры фрагмента и состояния пусты', err))
  }
}
async function loadPage() {
  const seq = ++listRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getConsumerLoadDiagnostics({ ...filters, page: page.value, page_size: PAGE_SIZE })
    if (seq !== listRequest) return
    items.value = response.items
    total.value = response.total
    pages.value = response.pages
    scopeCounts.value = (response as { counts?: Record<string, number> }).counts ?? null
  } catch (err: unknown) {
    if (seq !== listRequest) return
    // ошибка не должна выглядеть как «потребители не найдены»
    items.value = []
    total.value = 0
    pages.value = 0
    error.value = formatApiErrorWith('Список потребителей не загружен', err)
  } finally {
    if (seq === listRequest) loading.value = false
  }
}
async function reload() { page.value = 1; await loadPage() }
// Повторный клик снимает фильтр вида: журнал по всем потребителям (после открытия из карточки)
async function selectDiagnostic(kind: ConsumerLoadDiagnosticKind) {
  filters.diagnostic = filters.diagnostic === kind ? undefined : kind
  await reload()
}
watch(() => [filters.consumer_type, filters.fragment_id, filters.state_id], () => {
  if (!visible.value || applyingScope) return
  void reload()
})

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
async function exportCsv() {
  if (exporting.value || !total.value) return
  exporting.value = true
  try {
    const rows: ConsumerLoadSummary[] = []
    const query = { ...filters }
    for (let p = 1; rows.length < EXPORT_MAX_ROWS; p += 1) {
      const response = await fastApiService.getConsumerLoadDiagnostics({ ...query, page: p, page_size: EXPORT_PAGE_SIZE })
      rows.push(...response.items)
      if (p >= response.pages || !response.items.length) break
    }
    const headers = ['ID', 'Тип', 'Наименование', 'Узел', 'Участок', 'Тепл.нагрузка', 'Вентиляция', 'ГВС', 'Всего', 'Состояние']
    const lines = rows.slice(0, EXPORT_MAX_ROWS).map((item) => [
      item.id,
      typeLabel(item.consumer_type),
      csvCell(item.name),
      csvCell(item.external_code || item.external_node_name || item.node_id),
      csvCell(item.fragment_name || item.fragment_id),
      item.heating_load || 0,
      item.ventilation_load || 0,
      item.hot_water_load || 0,
      item.total_load || 0,
      csvCell(item.state_name),
    ].join(';'))
    const blob = new Blob(['﻿' + headers.join(';') + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `consumer_loads_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    if (total.value > lines.length) {
      notifications.showWarning(`Выгружено ${formatInteger(lines.length)} из ${formatInteger(total.value)} — уточните фильтры`)
    } else {
      notifications.showSuccess(`Выгружено потребителей: ${formatInteger(lines.length)}`)
    }
  } catch (err: unknown) {
    notifications.showError(formatApiErrorWith('Экспорт не выполнен', err))
  } finally {
    exporting.value = false
  }
}

async function openDetails(consumerType: ConsumerLoadType, consumerId: number) {
  const seq = ++detailRequest
  detailTarget.value = { type: consumerType, id: consumerId }
  details.value = null
  detailError.value = ''
  detailsVisible.value = true
  detailLoading.value = true
  try {
    const result = await fastApiService.getConsumerLoadDiagnostic(consumerType, consumerId)
    if (seq === detailRequest) details.value = result
  } catch (err: unknown) {
    if (seq === detailRequest) detailError.value = formatApiErrorWith('Карточка потребителя не загружена', err)
  } finally {
    if (seq === detailRequest) detailLoading.value = false
  }
}
/** Показать потребителя на карте; окна закрываются, иначе карта под ними не видна (QA F70) */
function locateItem(item: ConsumerLoadSummary) {
  if (!hasCoordinates(item)) return
  emit('locate-consumer', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, nodeId: item.node_id, label: item.name || `Потребитель №${item.id}` })
  visible.value = false
  detailsVisible.value = false
}
function locateDetails() {
  const item = details.value
  if (!item || !hasCoordinates(item)) return
  locateItem(item)
}
async function openDialog(scope: ConsumerLoadScope = {}) {
  visible.value = true
  // Из карточки — поиск именно этого объекта без фильтра «Нулевая нагрузка» и старого поиска (QA F20, F78)
  const next = consumerLoadFiltersForScope(filters, scope)
  applyingScope = true
  for (const key of Object.keys(filters) as Array<keyof ConsumerLoadFilters>) delete filters[key]
  Object.assign(filters, next)
  await nextTick()
  applyingScope = false
  await loadLookups()
  await reload()
  if (scope.consumerType && scope.consumerId) await openDetails(scope.consumerType, scope.consumerId)
}
defineExpose({ openDialog })
</script>

<style scoped>
.consumer-load-journal { height: min(92vh, 950px); display: flex; flex-direction: column; }
.load-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); flex-shrink: 0; }
.filters { display: grid; grid-template-columns: minmax(260px, 2fr) minmax(170px, 1fr) minmax(220px, 1.3fr) minmax(150px, .8fr) auto; gap: 10px; align-items: center; }
.table-wrap { position: relative; min-height: 300px; overflow: hidden; flex: 1; display: flex; flex-direction: column; }
.table-wrap > * { flex: 1; min-height: 0; }
.load-table { height: 100%; }
.status-chips, .related-list { display: flex; flex-wrap: wrap; gap: 6px; }
.pagination-row { min-height: 54px; padding: 4px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
.detail-grid { display: grid; grid-template-columns: repeat(3, minmax(170px, 1fr)); gap: 12px; }
:deep(.detail-value) { padding: 12px; border: 1px solid rgba(var(--v-theme-on-surface), 0.12); border-radius: 8px; }
:deep(.detail-label) { margin-bottom: 4px; color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); font-size: .75rem; }
.load-tiles { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
.load-tiles__total { border-color: rgb(var(--v-theme-primary)) !important; }
@media (max-width: 1050px) { .filters { grid-template-columns: 1fr 1fr; }.load-tiles { grid-template-columns: 1fr 1fr; } }
@media (max-width: 700px) { .consumer-load-journal { height: 100dvh; }.filters, .detail-grid, .load-tiles { grid-template-columns: 1fr; }.pagination-row { align-items: flex-start; flex-direction: column; } }
</style>
