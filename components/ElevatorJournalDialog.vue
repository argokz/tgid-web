<template>
  <div>
  <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1500" scrollable>
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="blue-grey-darken-4" density="compact">
        <v-icon class="ml-3 mr-2">mdi-elevator</v-icon>
        <v-toolbar-title>Элеваторы</v-toolbar-title>
        <v-chip class="mr-2" size="small" color="white" variant="outlined">
          {{ lookups.counts.ready || 0 }}/{{ lookups.counts.total || 0 }} готовы
        </v-chip>
        <v-btn icon="mdi-close" aria-label="Закрыть" @click="visible = false" />
      </v-toolbar>

      <div class="metrics pa-3 pb-0">
        <v-chip
          v-for="metric in qualityMetrics"
          :key="metric.value"
          :color="metric.color"
          :variant="filters.quality_status === metric.value ? 'flat' : 'tonal'"
          @click="setQualityStatus(metric.value)"
        >
          {{ metric.label }}: {{ lookups.counts[metric.value] || 0 }}
        </v-chip>
      </div>

      <div class="filters pa-3">
        <v-text-field v-model="filters.search" label="ID, линия, тип, номер или узел" prepend-inner-icon="mdi-magnify" density="compact" variant="outlined" clearable hide-details @keyup.enter="reload" />
        <v-select v-model="filters.quality_status" :items="qualityOptions" label="Качество данных" density="compact" variant="outlined" clearable hide-details />
        <v-select v-model="filters.state_id" :items="lookups.states" item-title="name" item-value="id" label="Состояние" density="compact" variant="outlined" clearable hide-details />
        <v-select v-model="filters.fragment_id" :items="lookups.fragments" item-title="name" item-value="id" label="Фрагмент" density="compact" variant="outlined" clearable hide-details />
        <v-btn color="blue-grey-darken-4" :loading="loading" @click="reload">Найти</v-btn>
      </div>

      <div v-if="error" class="journal-error">{{ error }}</div>
      <div class="table-wrap">
        <table class="journal-table">
          <thead>
            <tr><th>ID</th><th>Тип / номер</th><th>Линия / узлы</th><th>Сопло</th><th>Камера</th><th>Материал</th><th>Состояние</th><th>Качество</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" @click="openDetails(item.id)">
              <td>{{ item.id }}</td>
              <td><strong>{{ item.elevator_type || item.display_name }}</strong><div class="muted">{{ item.elevator_num_inst ?? '—' }}</div></td>
              <td>{{ item.line_id ?? '—' }}<div class="muted">{{ nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1) }} → {{ nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2) }}</div></td>
              <td>{{ formatUnit(item.diameter_nozzle, 'мм') }}</td>
              <td>{{ formatUnit(item.diameter_chamber, 'мм') }}</td>
              <td>{{ item.material || '—' }}</td>
              <td>{{ item.state_name || '—' }}</td>
              <td><v-chip size="x-small" :color="qualityColor(item.quality_status)">{{ qualityLabel(item.quality_status) }}</v-chip></td>
              <td><v-btn v-if="hasCoordinates(item)" icon="mdi-map-marker" size="x-small" variant="text" aria-label="Показать элеватор на карте" @click.stop="locate(item)" /></td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && !items.length" class="empty">Элеваторы по выбранным условиям не найдены</div>
        <v-progress-linear v-if="loading" indeterminate color="blue-grey-darken-4" />
      </div>
      <v-pagination v-if="pages > 1" v-model="page" :length="pages" density="comfortable" @update:model-value="loadItems" />
    </v-card>
  </v-dialog>

  <v-dialog v-model="detailVisible" :fullscreen="isMobile" max-width="1120" scrollable>
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="blue-grey-darken-4" density="compact">
        <v-btn icon="mdi-arrow-left" aria-label="Вернуться к журналу" @click="detailVisible = false" />
        <v-toolbar-title>{{ details?.display_name || 'Паспорт элеватора' }}</v-toolbar-title>
        <v-btn icon="mdi-close" aria-label="Закрыть карточку" @click="detailVisible = false" />
      </v-toolbar>
      <v-progress-linear v-if="detailLoading" indeterminate color="blue-grey-darken-4" />

      <template v-if="details && !detailLoading">
        <v-alert v-if="details.quality_status !== 'ready'" class="ma-3 mb-0" type="warning" variant="tonal" density="compact">
          {{ qualityDescription(details.quality_status) }}
        </v-alert>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6"><v-card variant="outlined" class="h-100"><v-card-title class="text-subtitle-1">Сетевая привязка</v-card-title><v-card-text class="detail-grid">
              <DetailValue label="Элеватор / ID" :value="details.id" /><DetailValue label="Линия" :value="details.line_id" />
              <DetailValue label="Начальный узел" :value="nodeLabel(details.node_code_1, details.node_name_1, details.node_id_1)" /><DetailValue label="Конечный узел" :value="nodeLabel(details.node_code_2, details.node_name_2, details.node_id_2)" />
              <DetailValue label="Фрагмент" :value="details.fragment_name || details.fragment_id" /><DetailValue label="Признак линии" :value="details.external_sign_line_name" />
            </v-card-text></v-card></v-col>
            <v-col cols="12" md="6"><v-card variant="outlined" class="h-100"><v-card-title class="text-subtitle-1">Паспорт</v-card-title><v-card-text class="detail-grid">
              <DetailValue label="Тип" :value="details.elevator_type" /><DetailValue label="Установленный номер" :value="details.elevator_num_inst" />
              <DetailValue label="Диаметр сопла" :value="formatUnit(details.diameter_nozzle, 'мм')" /><DetailValue label="Диаметр камеры" :value="formatUnit(details.diameter_chamber, 'мм')" />
              <DetailValue label="Длина корпуса" :value="formatUnit(details.length, 'мм')" /><DetailValue label="Входной фланец" :value="formatUnit(details.diameter_inlet_flange, 'мм')" />
              <DetailValue label="Выходной фланец" :value="formatUnit(details.diameter_outlet_flange, 'мм')" /><DetailValue label="Патрубок подсоса" :value="formatUnit(details.diameter_suction_pipe, 'мм')" />
              <DetailValue label="Материал" :value="details.material" /><DetailValue label="Состояние" :value="details.state_name" />
              <DetailValue label="Признак расчёта" :value="details.entry_mark" />
            </v-card-text></v-card></v-col>
            <v-col cols="12" md="6"><v-card variant="outlined" class="h-100"><v-card-title class="text-subtitle-1">Архивные реквизиты линии</v-card-title><v-card-text class="detail-grid">
              <DetailValue label="Регистрационный номер" :value="details.registration_number" /><DetailValue label="Ввод в эксплуатацию" :value="formatDate(details.commissioned_at)" />
              <DetailValue label="Последнее обслуживание" :value="formatDate(details.last_maintenance_at)" /><DetailValue label="Владелец" :value="details.organization_name" />
              <DetailValue label="Оператор" :value="details.operator_name" /><DetailValue label="Сопротивление линии" :value="formatNumber(details.line_hydraulic_resistance, 8)" />
            </v-card-text></v-card></v-col>
            <v-col cols="12" md="6"><v-card variant="outlined" class="h-100"><v-card-title class="text-subtitle-1">Последний ANY_OUT</v-card-title>
              <v-card-text v-if="details.latest_output" class="attribute-grid">
                <DetailValue v-for="entry in outputEntries" :key="entry[0]" :label="entry[0]" :value="formatAttribute(entry[1])" />
              </v-card-text>
              <v-card-text v-else><v-alert type="info" variant="tonal" density="compact">Расчётный результат для линии отсутствует.</v-alert></v-card-text>
            </v-card></v-col>
            <v-col cols="12"><v-card variant="outlined"><v-card-title class="text-subtitle-1">Исходные поля elevators</v-card-title><v-card-text class="attribute-grid">
              <DetailValue v-for="entry in attributeEntries" :key="entry[0]" :label="entry[0]" :value="formatAttribute(entry[1])" />
            </v-card-text></v-card></v-col>
          </v-row>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-3 bg-grey-lighten-4">
          <v-spacer />
          <v-btn v-if="hasCoordinates(details)" color="blue-grey-darken-4" variant="text" prepend-icon="mdi-map-marker" @click="locate(details)">Показать на карте</v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, type PropType } from 'vue'
import { useMobile } from '~/composables/useMobile'
import {
  fastApiService,
  type ElevatorDetails,
  type ElevatorFilters,
  type ElevatorLookups,
  type ElevatorQualityStatus,
  type ElevatorSummary
} from '~/services/fastApiService'

const DetailValue = defineComponent({
  props: { label: { type: String, required: true }, value: { type: [String, Number] as PropType<string | number | null | undefined>, default: null } },
  setup: props => () => h('div', { class: 'detail-value' }, [h('span', { class: 'detail-label' }, props.label), h('strong', String(props.value ?? '—'))])
})

const emit = defineEmits<{
  'locate-elevator': [payload: { longitude: number; latitude: number; id: number; lineId: number | null; label: string }]
}>()
const { isMobile } = useMobile()
const visible = ref(false)
const detailVisible = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const lookupsLoaded = ref(false)
const error = ref('')
const page = ref(1)
const pages = ref(0)
const items = ref<ElevatorSummary[]>([])
const details = ref<ElevatorDetails | null>(null)
const lookups = ref<ElevatorLookups>({ states: [], fragments: [], elevator_types: [], materials: [], counts: {} })
const filters = ref<ElevatorFilters>({})

const qualityOptions = [
  { title: 'Готово', value: 'ready' }, { title: 'Нет линии', value: 'line_missing' },
  { title: 'Линия удалена', value: 'line_removed' }, { title: 'Нет топологии', value: 'topology_missing' },
  { title: 'Нет состояния', value: 'state_missing' }, { title: 'Сопло не определено', value: 'nozzle_unresolved' },
  { title: 'Ожидает расчёт', value: 'pending_calculation' }
]
const qualityMetrics: Array<{ value: ElevatorQualityStatus; label: string; color: string }> = [
  { value: 'ready', label: 'Готовы', color: 'green' }, { value: 'line_missing', label: 'Нет линии', color: 'red' },
  { value: 'line_removed', label: 'Удалённая линия', color: 'grey' }, { value: 'topology_missing', label: 'Нет топологии', color: 'orange' },
  { value: 'state_missing', label: 'Нет состояния', color: 'purple' }, { value: 'nozzle_unresolved', label: 'Нет сопла', color: 'amber-darken-3' },
  { value: 'pending_calculation', label: 'Ожидают расчёт', color: 'cyan-darken-3' }
]
const attributeEntries = computed(() => Object.entries(details.value?.attributes || {}).filter(([, value]) => value !== null && value !== ''))
const outputEntries = computed(() => Object.entries(details.value?.latest_output || {}).filter(([key, value]) => key !== 'calculation' && value !== null && value !== ''))

const loadItems = async () => {
  loading.value = true; error.value = ''
  try { const response = await fastApiService.getElevators({ ...filters.value, page: page.value, page_size: 50 }); items.value = response.items; pages.value = response.pages }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить элеваторы' } finally { loading.value = false }
}
const reload = () => { page.value = 1; void loadItems() }
const setQualityStatus = (status: ElevatorQualityStatus) => { filters.value.quality_status = filters.value.quality_status === status ? undefined : status; reload() }
const openDetails = async (elevatorId: number) => {
  detailVisible.value = true; detailLoading.value = true; details.value = null
  try { details.value = await fastApiService.getElevator(elevatorId) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось открыть карточку элеватора'; detailVisible.value = false }
  finally { detailLoading.value = false }
}
const openDialog = async (scope: { elevatorId?: number; lineId?: number; nodeId?: number } = {}) => {
  visible.value = true
  if (!lookupsLoaded.value) { lookups.value = await fastApiService.getElevatorLookups(); lookupsLoaded.value = true }
  filters.value = { line_id: scope.lineId, node_id: scope.nodeId }; page.value = 1; await loadItems()
  if (scope.elevatorId) await openDetails(scope.elevatorId)
}

const hasCoordinates = (item: ElevatorSummary) => item.longitude !== null && item.latitude !== null && Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))
const locate = (item: ElevatorSummary) => emit('locate-elevator', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, lineId: item.line_id, label: item.display_name || `Элеватор №${item.id}` })
const qualityLabel = (status: ElevatorQualityStatus) => ({ ready: 'готово', line_missing: 'нет линии', line_removed: 'линия удалена', topology_missing: 'нет топологии', state_missing: 'нет состояния', nozzle_unresolved: 'нет сопла', pending_calculation: 'ожидает расчёт' })[status]
const qualityColor = (status: ElevatorQualityStatus) => ({ ready: 'green', line_missing: 'red', line_removed: 'grey', topology_missing: 'orange', state_missing: 'purple', nozzle_unresolved: 'amber-darken-3', pending_calculation: 'cyan-darken-3' })[status]
const qualityDescription = (status: ElevatorQualityStatus) => ({ ready: '', line_missing: 'Связанная линия отсутствует.', line_removed: 'Связанная линия помечена удалённой.', topology_missing: 'У линии отсутствует начальный или конечный узел.', state_missing: 'Состояние не найдено в справочнике.', nozzle_unresolved: 'Диаметр сопла не задан и признак расчётного подбора отсутствует.', pending_calculation: 'Диаметр сопла должен быть подобран расчётом.' })[status]
const nodeLabel = (code: string | null, name: string | null, id: number | null) => [code, name].filter(Boolean).join(' ') || (id ? `№${id}` : '—')
const formatNumber = (value: unknown, digits = 3) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatUnit = (value: unknown, unit: string) => formatNumber(value) === '—' ? '—' : `${formatNumber(value)} ${unit}`
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('ru-RU') : '—'
const formatAttribute = (value: unknown) => typeof value === 'number' ? formatNumber(value, 8) : String(value ?? '—')

defineExpose({ openDialog })
</script>

<style scoped>
.metrics,.filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.filters>*{min-width:180px;flex:1}.filters .v-btn{flex:0 0 auto}.table-wrap{overflow:auto;min-height:380px}.journal-table{width:100%;border-collapse:collapse;font-size:13px}.journal-table th,.journal-table td{padding:9px 10px;border-bottom:1px solid #e0e0e0;text-align:left;white-space:nowrap}.journal-table th{position:sticky;top:0;background:#eceff1;z-index:1}.journal-table tbody tr{cursor:pointer}.journal-table tbody tr:hover{background:#f5f7f8}.muted{font-size:11px;color:#757575}.empty{text-align:center;color:#757575;padding:48px 32px}.journal-error{margin:0 12px 12px;padding:10px 12px;border-radius:4px;background:#ffebee;color:#b71c1c}.detail-grid,.attribute-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}:deep(.detail-value){display:flex;flex-direction:column;min-width:0}:deep(.detail-label){font-size:11px;color:#757575}:deep(.detail-value strong){overflow-wrap:anywhere}
@media(max-width:960px){.filters{display:grid;grid-template-columns:1fr}.filters>*{width:100%}.detail-grid,.attribute-grid{grid-template-columns:1fr}}
</style>
