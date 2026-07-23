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
      <v-toolbar
        color="teal-darken-3"
        density="compact"
      >
        <v-icon class="ml-3 mr-2">
          mdi-home-lightning-bolt-outline
        </v-icon>
        <v-toolbar-title>Диагностика тепловых нагрузок</v-toolbar-title>
        <v-chip
          class="mr-2"
          color="white"
          size="small"
          variant="outlined"
        >
          {{ formatInteger(lookups.counts.total) }} потребителей
        </v-chip>
        <v-chip
          class="mr-2"
          color="white"
          size="small"
          variant="outlined"
        >
          {{ formatInteger(lookups.counts.zero_load) }} без нагрузки
        </v-chip>
        <v-chip
          class="mr-2"
          color="white"
          size="small"
          variant="outlined"
        >
          {{ formatInteger(lookups.counts.closed) }} закрыто
        </v-chip>
        <v-btn
          icon="mdi-close"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-toolbar>

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

      <div class="diagnostic-switch pa-3 pb-0">
        <v-chip
          v-for="item in diagnosticOptions"
          :key="item.value"
          :color="filters.diagnostic === item.value ? 'teal-darken-3' : undefined"
          :variant="filters.diagnostic === item.value ? 'flat' : 'outlined'"
          @click="selectDiagnostic(item.value)"
        >
          <v-icon start>
            {{ item.icon }}
          </v-icon>
          {{ item.title }}
          <span class="ml-1">{{ formatInteger(diagnosticCount(item.value)) }}</span>
        </v-chip>
      </div>

      <div class="filters pa-3">
        <v-text-field
          v-model="filters.search"
          clearable
          density="compact"
          hide-details
          label="Потребитель, узел, код, фрагмент или ID"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          @keyup.enter="reload"
        />
        <v-select
          v-model="filters.consumer_type"
          :items="consumerTypeOptions"
          clearable
          density="compact"
          hide-details
          label="Тип потребителя"
          variant="outlined"
        />
        <v-select
          v-model="filters.fragment_id"
          :items="lookups.fragments"
          clearable
          density="compact"
          hide-details
          item-title="name"
          item-value="id"
          label="Фрагмент схемы"
          variant="outlined"
        />
        <v-select
          v-model="filters.state_id"
          :items="lookups.states"
          clearable
          density="compact"
          hide-details
          item-title="name"
          item-value="id"
          label="Состояние"
          variant="outlined"
        />
        <v-btn
          color="teal-darken-3"
          :loading="loading"
          @click="reload"
        >
          Обновить
        </v-btn>
        <v-btn
          color="teal-darken-3"
          variant="outlined"
          @click="exportCsv"
        >
          Экспорт (CSV)
        </v-btn>
      </div>

      <div class="table-wrap">
        <table class="journal-table">
          <thead>
            <tr>
              <th>Тип / ID</th>
              <th>Потребитель</th>
              <th>Узел</th>
              <th>Фрагмент</th>
              <th>Отопление</th>
              <th>Вентиляция</th>
              <th>ГВС</th>
              <th>Всего</th>
              <th>Состояние</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in items"
              :key="`${item.consumer_type}-${item.id}`"
              @click="openDetails(item.consumer_type, item.id)"
            >
              <td>
                <v-chip
                  size="x-small"
                  variant="tonal"
                >
                  {{ typeLabel(item.consumer_type) }}
                </v-chip>
                <div class="text-caption mt-1">
                  №{{ item.id }}
                </div>
              </td>
              <td>{{ item.name || 'Без наименования' }}</td>
              <td>
                <div>{{ item.external_code || '—' }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ item.external_node_name || `ID ${item.node_id}` }}
                </div>
              </td>
              <td>{{ item.fragment_name || `Фрагмент ${item.fragment_id ?? '—'}` }}</td>
              <td>{{ formatLoad(item.heating_load) }}</td>
              <td>{{ formatLoad(item.ventilation_load) }}</td>
              <td>{{ formatLoad(item.hot_water_load) }}</td>
              <td>{{ formatLoad(item.total_load) }}</td>
              <td>
                <v-chip
                  v-if="item.state_name"
                  color="teal-darken-4"
                  size="small"
                  variant="outlined"
                >
                  {{ item.state_name }}
                </v-chip>
              </td>
              <td @click.stop>
                <v-btn 
                  icon="mdi-crosshairs-gps" 
                  variant="text" 
                  size="small" 
                  color="primary"
                  :disabled="!hasCoordinates(item)"
                  @click="emit('locate-consumer', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, nodeId: item.node_id, label: item.name || `Потребитель П-${item.id}` })"
                >
                  <v-tooltip activator="parent" location="left">Найти на карте</v-tooltip>
                </v-btn>
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="!loading && !items.length"
          class="empty-state"
        >
          <v-icon
            color="blue-grey-lighten-2"
            size="52"
          >
            mdi-database-search-outline
          </v-icon>
          <div class="mt-3">
            Потребители по выбранным условиям не найдены
          </div>
        </div>
        <div
          v-if="loading"
          class="loading-state"
        >
          <v-progress-circular
            color="teal"
            indeterminate
          />
        </div>
      </div>

      <div class="pagination-row">
        <span class="text-caption text-medium-emphasis">Найдено: {{ formatInteger(total) }}</span>
        <v-pagination
          v-if="pages > 1"
          v-model="page"
          :length="pages"
          density="comfortable"
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
      <v-toolbar
        color="teal-darken-3"
        density="compact"
      >
        <v-toolbar-title>{{ detailsTitle }}</v-toolbar-title>
        <v-btn
          v-if="details && hasCoordinates(details)"
          prepend-icon="mdi-crosshairs-gps"
          variant="text"
          @click="locateDetails"
        >
          На карте
        </v-btn>
        <v-btn
          icon="mdi-close"
          aria-label="Закрыть карточку"
          @click="detailsVisible = false"
        />
      </v-toolbar>

      <v-card-text
        v-if="detailLoading"
        class="loading-state"
      >
        <v-progress-circular
          color="teal"
          indeterminate
        />
      </v-card-text>
      <v-card-text
        v-else-if="details"
        class="pa-4"
      >
        <div class="status-chips mb-4">
          <v-chip :color="details.closed ? 'red' : 'green'">
            {{ details.state_name || 'Состояние не задано' }}
          </v-chip>
          <v-chip
            v-if="details.zero_heating_load"
            color="orange"
          >
            Нулевая отопительная нагрузка
          </v-chip>
          <v-chip
            v-if="!details.calculation_available"
            color="blue-grey"
          >
            Фрагмент не рассчитан
          </v-chip>
          <v-chip
            v-else-if="!details.has_calculation_output"
            color="red"
          >
            Нет результата PT_OUT
          </v-chip>
          <v-chip
            v-else
            color="teal"
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

        <h3 class="mb-2">
          Расчётные нагрузки, Гкал/ч
        </h3>
        <div class="load-cards mb-5">
          <div class="load-card">
            <span>Отопление</span><strong>{{ formatLoad(details.heating_load) }}</strong>
          </div>
          <div class="load-card">
            <span>Вентиляция</span><strong>{{ formatLoad(details.ventilation_load) }}</strong>
          </div>
          <div class="load-card">
            <span>Кондиционирование</span><strong>{{ formatLoad(details.conditioning_load) }}</strong>
          </div>
          <div class="load-card">
            <span>ГВС</span><strong>{{ formatLoad(details.hot_water_load) }}</strong>
          </div>
          <div class="load-card total">
            <span>Всего</span><strong>{{ formatLoad(details.total_load) }}</strong>
          </div>
        </div>

        <h3 class="mb-2">
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
          <h3 class="mb-2">
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
          <h3 class="mt-5 mb-2">
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
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { defineComponent, h, type PropType } from 'vue'
import { useDisplay } from 'vuetify'
import {
  fastApiService,
  type ConsumerLoadDetails,
  type ConsumerLoadDiagnosticKind,
  type ConsumerLoadLookups,
  type ConsumerLoadSummary,
  type ConsumerLoadType,
} from '~/services/fastApiService'

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
const { smAndDown: isMobile } = useDisplay()
const visible = ref(false)
const detailsVisible = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const items = ref<ConsumerLoadSummary[]>([])
const details = ref<ConsumerLoadDetails | null>(null)
const page = ref(1)
const pages = ref(0)
const total = ref(0)
const lookups = ref<ConsumerLoadLookups>({ states: [], fragments: [], counts: {}, calculation_warning: null })
const filters = reactive<{
  diagnostic?: ConsumerLoadDiagnosticKind
  consumer_type?: ConsumerLoadType
  fragment_id?: number
  state_id?: number
  search?: string
}>({ diagnostic: 'zero_load' })
const consumerTypeOptions = [
  { title: 'Обобщённый', value: 'generalized' },
  { title: 'Реальный', value: 'real' },
]
const diagnosticOptions: Array<{ title: string; value: ConsumerLoadDiagnosticKind; icon: string }> = [
  { title: 'Нулевая нагрузка', value: 'zero_load', icon: 'mdi-gauge-empty' },
  { title: 'Закрытые', value: 'closed', icon: 'mdi-lock-outline' },
  { title: 'Отключённые', value: 'disconnected', icon: 'mdi-connection' },
  { title: 'Нет расчёта', value: 'not_calculated', icon: 'mdi-calculator-variant-outline' },
]
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

function formatInteger(value: unknown) { return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(value || 0)) }
function formatLoad(value: number | null | undefined) { return value === null || value === undefined ? '—' : new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(value) }
function typeLabel(type: ConsumerLoadType) { return type === 'generalized' ? 'Обобщённый' : 'Реальный' }
function recordValue(record: Record<string, unknown> | null | undefined, key: string): string | number | null { const value = record?.[key]; return typeof value === 'string' || typeof value === 'number' ? value : null }
function attributeValue(key: string) { return recordValue(details.value?.attributes, key) }
function hasCoordinates(item: ConsumerLoadSummary) { return Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude)) }
function diagnosticCount(kind: ConsumerLoadDiagnosticKind) { return lookups.value.counts[kind] || 0 }

async function loadLookups() {
  if (!lookups.value.states.length) lookups.value = await fastApiService.getConsumerLoadLookups()
}
async function loadPage() {
  loading.value = true
  try {
    const response = await fastApiService.getConsumerLoadDiagnostics({ ...filters, page: page.value, page_size: 50 })
    items.value = response.items
    total.value = response.total
    pages.value = response.pages
  } finally { loading.value = false }
}
async function reload() { page.value = 1; await loadPage() }
async function selectDiagnostic(kind: ConsumerLoadDiagnosticKind) { filters.diagnostic = kind; await reload() }

function exportCsv() {
  if (!items.value || items.value.length === 0) return
  
  const headers = ['ID', 'Тип', 'Наименование', 'Узел', 'Участок', 'Тепл.нагрузка', 'Вентиляция', 'ГВС', 'Всего', 'Состояние']
  const rows = items.value.map(item => [
    item.id,
    typeLabel(item.consumer_type),
    `"${(item.name || '').replace(/"/g, '""')}"`,
    `"${item.external_code || item.external_node_name || item.node_id}"`,
    `"${item.fragment_name || item.fragment_id || ''}"`,
    item.heating_load || 0,
    item.ventilation_load || 0,
    item.hot_water_load || 0,
    item.total_load || 0,
    `"${item.state_name || ''}"`
  ].join(';'))
  
  const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `consumer_loads_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function openDetails(consumerType: ConsumerLoadType, consumerId: number) {
  details.value = null
  detailsVisible.value = true
  detailLoading.value = true
  try { details.value = await fastApiService.getConsumerLoadDiagnostic(consumerType, consumerId) } finally { detailLoading.value = false }
}
function locateDetails() {
  const item = details.value
  if (!item || !hasCoordinates(item)) return
  emit('locate-consumer', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, nodeId: item.node_id, label: item.name || `Потребитель №${item.id}` })
  visible.value = false
  detailsVisible.value = false
}
async function openDialog(scope: { consumerType?: ConsumerLoadType; consumerId?: number; nodeId?: number; diagnostic?: ConsumerLoadDiagnosticKind } = {}) {
  visible.value = true
  await loadLookups()
  if (scope.diagnostic) filters.diagnostic = scope.diagnostic
  if (scope.nodeId) filters.search = String(scope.nodeId)
  await reload()
  if (scope.consumerType && scope.consumerId) await openDetails(scope.consumerType, scope.consumerId)
}
defineExpose({ openDialog })
</script>

<style scoped>
.consumer-load-journal { height: min(92vh, 950px); display: flex; flex-direction: column; }
.diagnostic-switch { display: flex; flex-wrap: wrap; gap: 8px; }
.filters { display: grid; grid-template-columns: minmax(260px, 2fr) minmax(170px, 1fr) minmax(220px, 1.3fr) minmax(150px, .8fr) auto; gap: 10px; align-items: center; }
.table-wrap { position: relative; min-height: 300px; overflow: auto; flex: 1; }
.journal-table { width: 100%; min-width: 1420px; border-collapse: collapse; font-size: .82rem; }
.journal-table th { position: sticky; top: 0; z-index: 2; padding: 10px 12px; text-align: left; white-space: nowrap; color: #00695c; background: #e0f2f1; }
.journal-table td { padding: 9px 12px; border-bottom: 1px solid #eceff1; vertical-align: middle; }
.journal-table tbody tr { cursor: pointer; }.journal-table tbody tr:hover { background: #e0f2f1; }
.status-chips, .related-list { display: flex; flex-wrap: wrap; gap: 6px; }
.empty-state, .loading-state { min-height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #78909c; }
.pagination-row { min-height: 54px; padding: 4px 16px; display: flex; align-items: center; justify-content: space-between; }
.detail-grid { display: grid; grid-template-columns: repeat(3, minmax(170px, 1fr)); gap: 12px; }
:deep(.detail-value) { padding: 12px; border: 1px solid #b2dfdb; border-radius: 8px; background: #f5fffd; }
:deep(.detail-label) { margin-bottom: 4px; color: #546e7a; font-size: .75rem; }
.load-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
.load-card { display: flex; flex-direction: column; gap: 5px; padding: 13px; border-radius: 8px; background: #e0f2f1; }.load-card span { color: #546e7a; font-size: .76rem; }.load-card.total { color: white; background: #00796b; }.load-card.total span { color: white; }
@media (max-width: 1050px) { .filters { grid-template-columns: 1fr 1fr; }.load-cards { grid-template-columns: 1fr 1fr; } }
@media (max-width: 700px) { .consumer-load-journal { height: 100dvh; }.filters, .detail-grid, .load-cards { grid-template-columns: 1fr; }.pagination-row { align-items: flex-start; flex-direction: column; } }
</style>
