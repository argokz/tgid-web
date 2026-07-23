<template>
  <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1540" scrollable>
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="teal-darken-4" density="compact">
        <v-icon class="ml-3 mr-2">mdi-circle-slice-8</v-icon>
        <v-toolbar-title>Диафрагмы наружных теплопроводов</v-toolbar-title>
        <v-chip class="mr-2" size="small" color="white" variant="outlined">
          {{ lookups.counts.ready || 0 }}/{{ lookups.counts.total || 0 }} готовы
        </v-chip>
        <v-btn icon="mdi-close" aria-label="Закрыть" @click="visible = false" />
      </v-toolbar>

      <div class="alerts pa-3 pb-0">
        <v-alert type="warning" variant="tonal" density="compact">
          В текущей БД найдено {{ lookups.counts.total || 0 }} диафрагм, но их старые линии не имеют полной
          топологии и геометрии. Паспортные данные доступны, позиционирование на карте — только после восстановления связей.
        </v-alert>
        <v-alert v-if="lookups.result_count === 0" type="info" variant="tonal" density="compact">
          Таблицы <code>calculation</code> и <code>DRO_OUT</code> пусты. Расход, потери напора и сопротивление
          показаны как отсутствующие и не подменяются нулями.
        </v-alert>
      </div>

      <div class="metric-row pa-3 pb-0">
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
      <div class="metric-row pa-3 pb-0">
        <v-chip color="blue" variant="tonal">Диаметр записан: {{ lookups.counts.diameter_available || 0 }}</v-chip>
        <v-chip color="cyan-darken-3" variant="tonal">Ожидает расчёт: {{ lookups.counts.diameter_pending_calculation || 0 }}</v-chip>
        <v-chip color="orange" variant="tonal">Диаметр недоступен: {{ lookups.counts.diameter_unavailable || 0 }}</v-chip>
        <v-chip color="brown" variant="tonal">Некорректное количество: {{ lookups.counts.installed_count_invalid || 0 }}</v-chip>
        <v-chip color="grey" variant="tonal">С координатой: {{ lookups.counts.locatable || 0 }}</v-chip>
      </div>

      <div class="filters pa-3">
        <v-text-field v-model="filters.search" label="ID, линия, узел, место или владелец" prepend-inner-icon="mdi-magnify" density="compact" variant="outlined" clearable hide-details @keyup.enter="reload" />
        <v-select v-model="filters.quality_status" :items="qualityOptions" label="Качество данных" density="compact" variant="outlined" clearable hide-details />
        <v-select v-model="filters.diameter_mode" :items="diameterOptions" label="Режим диаметра" density="compact" variant="outlined" clearable hide-details />
        <v-select v-model="filters.installation_place" :items="lookups.locations" item-title="name" item-value="name" label="Место установки" density="compact" variant="outlined" clearable hide-details />
        <v-select v-model="filters.state_id" :items="lookups.states" item-title="name" item-value="id" label="Состояние" density="compact" variant="outlined" clearable hide-details />
        <v-select v-model="filters.external_sign_line_id" :items="lookups.external_signs" item-title="name" item-value="id" label="Признак линии" density="compact" variant="outlined" clearable hide-details />
        <v-btn color="teal-darken-4" :loading="loading" @click="reload">Найти</v-btn>
      </div>

      <div v-if="error" class="journal-error">{{ error }}</div>
      <div class="table-wrap">
        <table class="journal-table">
          <thead>
            <tr><th>ID</th><th>Место установки</th><th>Линия / узлы</th><th>Диаметр</th><th>Количество</th><th>Запись расчёта</th><th>Линия</th><th>Состояние</th><th>Качество</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" @click="openDetails(item.id)">
              <td>{{ item.id }}</td>
              <td><strong>{{ item.installation_place || item.display_name }}</strong></td>
              <td>{{ item.line_id ?? '—' }}<div class="muted">{{ nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1) }} → {{ nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2) }}</div></td>
              <td>{{ diameterLabel(item) }}<div class="muted">{{ diameterModeLabel(item.diameter_mode) }}</div></td>
              <td>{{ item.installed_count ?? '—' }}</td>
              <td><v-chip size="x-small" :color="item.calculation_writeback_allowed ? 'green' : 'grey'">{{ item.entry_mark || 'не разрешена' }}</v-chip></td>
              <td>{{ item.external_sign_line_name || '—' }}</td>
              <td>{{ item.state_name || '—' }}</td>
              <td><v-chip size="x-small" :color="qualityColor(item.quality_status)">{{ qualityLabel(item.quality_status) }}</v-chip></td>
              <td><v-btn v-if="hasCoordinates(item)" icon="mdi-map-marker" size="x-small" variant="text" aria-label="Показать диафрагму на карте" @click.stop="locate(item)" /></td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && !items.length" class="empty">Диафрагмы по выбранным условиям не найдены</div>
        <v-progress-linear v-if="loading" indeterminate color="teal-darken-4" />
      </div>
      <v-pagination v-if="pages > 1" v-model="page" :length="pages" density="comfortable" @update:model-value="loadItems" />
    </v-card>
  </v-dialog>

  <v-dialog v-model="detailVisible" :fullscreen="isMobile" max-width="1180" scrollable>
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="teal-darken-4" density="compact">
        <v-btn icon="mdi-arrow-left" aria-label="Вернуться к журналу" @click="detailVisible = false" />
        <v-toolbar-title>{{ details?.display_name || 'Паспорт диафрагмы' }}</v-toolbar-title>
        <v-btn icon="mdi-close" aria-label="Закрыть карточку" @click="detailVisible = false" />
      </v-toolbar>
      <v-progress-linear v-if="detailLoading" indeterminate color="teal-darken-4" />

      <template v-if="details && !detailLoading">
        <div class="alerts pa-3 pb-0">
          <v-alert v-if="details.quality_status !== 'ready'" :type="details.quality_status === 'line_missing' ? 'error' : 'warning'" variant="tonal" density="compact">
            {{ qualityDescription(details.quality_status) }}
          </v-alert>
          <v-alert v-if="details.diameter_mode === 'pending_calculation'" type="info" variant="tonal" density="compact">
            Нулевой диаметр является штатным: desktop разрешает расчёту подобрать и записать диаметр диафрагмы.
          </v-alert>
        </div>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6"><v-card variant="outlined" class="h-100"><v-card-title class="text-subtitle-1">Сетевая привязка</v-card-title><v-card-text class="detail-grid">
              <DetailValue label="Диафрагма / ID" :value="details.id" /><DetailValue label="Линия" :value="details.line_id" />
              <DetailValue label="Начальный узел" :value="nodeLabel(details.node_code_1, details.node_name_1, details.node_id_1)" /><DetailValue label="Конечный узел" :value="nodeLabel(details.node_code_2, details.node_name_2, details.node_id_2)" />
              <DetailValue label="Внутренний потребитель" :value="nodeLabel(details.internal_node_code, details.internal_node_name, details.internal_node_id)" /><DetailValue label="Фрагмент" :value="details.fragment_name || details.fragment_id" />
              <DetailValue label="Признак линии" :value="details.external_sign_line_name" /><DetailValue label="Сопротивление линии" :value="formatNumber(details.line_hydraulic_resistance, 8)" />
            </v-card-text></v-card></v-col>
            <v-col cols="12" md="6"><v-card variant="outlined" class="h-100">
              <v-card-title class="text-subtitle-1">Паспорт диафрагмы</v-card-title>
              <v-card-text class="detail-grid" v-if="!isEditing">
                <DetailValue label="Место установки" :value="details.installation_place" /><DetailValue label="Состояние" :value="details.state_name" />
                <DetailValue label="Внутренний диаметр" :value="diameterLabel(details)" /><DetailValue label="Режим диаметра" :value="diameterModeLabel(details.diameter_mode)" />
                <DetailValue label="Количество последовательно" :value="details.installed_count" /><DetailValue label="Разрешение записи расчёта" :value="details.entry_mark || 'не разрешена'" />
              </v-card-text>
              <v-card-text v-else>
                <v-row dense>
                  <v-col v-for="field in buildFields()" :key="field.key" cols="12" sm="6">
                    <div class="detail-label mb-1">{{ field.label }}</div>
                    <v-select v-if="field.type === 'select'" v-model="editFields[field.key]" :items="field.items" item-title="name" item-value="id" density="compact" hide-details variant="outlined" clearable />
                    <v-text-field v-else v-model="editFields[field.key]" :type="field.type === 'number' ? 'number' : 'text'" density="compact" hide-details variant="outlined" clearable />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card></v-col>
            <v-col cols="12" md="6"><v-card variant="outlined" class="h-100"><v-card-title class="text-subtitle-1">Архивные реквизиты линии</v-card-title><v-card-text class="detail-grid">
              <DetailValue label="Регистрационный номер" :value="details.registration_number" /><DetailValue label="Ввод в эксплуатацию" :value="formatDate(details.commissioned_at)" />
              <DetailValue label="Последний ремонт" :value="formatDate(details.last_maintenance_at)" /><DetailValue label="Владелец" :value="details.organization_name" />
              <DetailValue label="Оператор" :value="details.operator_name" />
            </v-card-text></v-card></v-col>
            <v-col cols="12" md="6"><v-card variant="outlined" class="h-100"><v-card-title class="text-subtitle-1">Расчётный режим DRO_OUT</v-card-title>
              <v-card-text v-if="details.latest_output" class="detail-grid">
                <DetailValue label="Расход через диафрагму" :value="formatUnit(outputValue('flow'), 'т/ч')" /><DetailValue label="Потери напора" :value="formatUnit(outputValue('head_loss'), 'м')" />
                <DetailValue label="Полное гидравлическое сопротивление" :value="formatNumber(outputValue('total_hydraulic_resistance'), 8)" /><DetailValue label="Располагаемый напор в конечном узле" :value="formatUnit(outputValue('available_head_end'), 'м')" />
                <DetailValue label="Пьезометрический напор" :value="formatUnit(outputValue('piezometric_head_end'), 'м')" /><DetailValue label="Геодезическая отметка" :value="formatUnit(outputValue('geodetic_mark_end'), 'м')" />
                <DetailValue label="Полный напор" :value="formatUnit(outputValue('total_head_end'), 'м')" /><DetailValue label="Источник тепла" :value="String(outputValue('heat_source_name') || outputValue('heat_source_id') || '—')" />
              </v-card-text>
              <v-card-text v-else><v-alert type="info" variant="tonal" density="compact">Расчётный результат для этой диафрагмы отсутствует.</v-alert></v-card-text>
            </v-card></v-col>
            <v-col cols="12"><v-card variant="outlined"><v-card-title class="text-subtitle-1">Исходные поля diaphragms</v-card-title><v-card-text class="attribute-grid">
              <DetailValue v-for="entry in attributeEntries" :key="entry[0]" :label="entry[0]" :value="formatAttribute(entry[1])" />
            </v-card-text></v-card></v-col>
          </v-row>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-3 bg-grey-lighten-4">
          <v-spacer />
          <v-btn v-if="!isEditing && hasCoordinates(details)" color="teal-darken-4" variant="text" prepend-icon="mdi-map-marker" @click="locate(details)">Показать на карте</v-btn>
          <template v-if="!isEditing">
            <v-btn v-if="mutationsEnabled" color="primary" variant="flat" prepend-icon="mdi-pencil" @click="startEdit">Редактировать</v-btn>
          </template>
          <template v-else>
            <v-btn v-if="mutationsEnabled" color="error" variant="text" @click="cancelEdit" :disabled="saving">Отмена</v-btn>
            <v-btn v-if="mutationsEnabled" color="primary" variant="flat" @click="saveChanges" :loading="saving">Сохранить</v-btn>
          </template>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, type PropType } from 'vue'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import {
  fastApiService,
  type NetworkDiaphragmDetails,
  type NetworkDiaphragmDiameterMode,
  type NetworkDiaphragmFilters,
  type NetworkDiaphragmLookups,
  type NetworkDiaphragmQualityStatus,
  type NetworkDiaphragmSummary
} from '~/services/fastApiService'

const DetailValue = defineComponent({
  props: { label: { type: String, required: true }, value: { type: [String, Number] as PropType<string | number | null | undefined>, default: null } },
  setup: props => () => h('div', { class: 'detail-value' }, [h('span', { class: 'detail-label' }, props.label), h('strong', String(props.value ?? '—'))])
})

const emit = defineEmits<{
  'locate-diaphragm': [payload: { longitude: number; latitude: number; id: number; lineId: number | null; label: string }]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const emptyLookups = (): NetworkDiaphragmLookups => ({ states: [], external_signs: [], locations: [], entry_marks: [], fragments: [], counts: {}, calculation_count: 0, result_count: 0 })
const visible = ref(false)
const detailVisible = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const lookupsLoaded = ref(false)
const error = ref('')
const page = ref(1)
const pages = ref(0)
const items = ref<NetworkDiaphragmSummary[]>([])
const details = ref<NetworkDiaphragmDetails | null>(null)
const lookups = ref<NetworkDiaphragmLookups>(emptyLookups())
const filters = ref<NetworkDiaphragmFilters>({})
const isEditing = ref(false)
const saving = ref(false)
const editFields = ref<Record<string, any>>({})

const buildFields = () => {
  return [
    { label: 'Место установки', key: 'throtdiaphloc', type: 'text', value: details.value?.installation_place },
    { label: 'Состояние', key: 'stateid', type: 'select', items: lookups.value.states, value: details.value?.state_id },
    { label: 'Внутренний диаметр', key: 'diameterinternal', type: 'number', value: details.value?.internal_diameter },
    { label: 'Количество последовательно', key: 'consinstdiaphcount', type: 'number', value: details.value?.installed_count },
    { label: 'Разрешение записи расчёта', key: 'entrymark', type: 'text', value: details.value?.entry_mark }
  ]
}

const startEdit = () => {
  isEditing.value = true
  editFields.value = {}
  for (const field of buildFields()) {
    if (field.key) editFields.value[field.key] = field.value ?? null
  }
}

const cancelEdit = () => {
  isEditing.value = false
  editFields.value = {}
}

const saveChanges = async () => {
  if (!details.value) return
  saving.value = true
  try {
    const processedFields: Record<string, any> = {}
    for (const key in editFields.value) {
      if (editFields.value[key] === '') processedFields[key] = null
      else processedFields[key] = editFields.value[key]
    }
    
    await fastApiService.updateObjectAttributes('diaphragms', details.value.id, processedFields)
    
    await openDetails(details.value.id)
    isEditing.value = false
    await loadItems()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Ошибка при сохранении'
  } finally {
    saving.value = false
  }
}

const qualityOptions = [
  { title: 'Готово', value: 'ready' }, { title: 'Нет линии', value: 'line_missing' },
  { title: 'Линия удалена', value: 'line_removed' }, { title: 'Нет топологии', value: 'topology_missing' },
  { title: 'Нет состояния', value: 'state_missing' }, { title: 'Некорректное количество', value: 'count_invalid' },
  { title: 'Диаметр не определён', value: 'diameter_unresolved' }
]
const diameterOptions = [
  { title: 'Диаметр записан', value: 'available' },
  { title: 'Ожидает расчёт', value: 'pending_calculation' },
  { title: 'Не определён', value: 'unresolved' }
]
const qualityMetrics: Array<{ value: NetworkDiaphragmQualityStatus; label: string; color: string }> = [
  { value: 'ready', label: 'Готовы', color: 'green' }, { value: 'line_missing', label: 'Нет линии', color: 'red' },
  { value: 'line_removed', label: 'Удалённая линия', color: 'grey' }, { value: 'topology_missing', label: 'Нет топологии', color: 'orange' },
  { value: 'state_missing', label: 'Нет состояния', color: 'purple' }, { value: 'count_invalid', label: 'Количество', color: 'brown' },
  { value: 'diameter_unresolved', label: 'Диаметр', color: 'amber-darken-3' }
]
const attributeEntries = computed(() => Object.entries(details.value?.attributes || {}).filter(([, value]) => value !== null && value !== ''))

const loadLookups = async () => {
  if (!lookupsLoaded.value) { lookups.value = await fastApiService.getNetworkDiaphragmLookups(); lookupsLoaded.value = true }
}
const loadItems = async () => {
  loading.value = true; error.value = ''
  try { const response = await fastApiService.getNetworkDiaphragms({ ...filters.value, page: page.value, page_size: 50 }); items.value = response.items; pages.value = response.pages }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить диафрагмы' } finally { loading.value = false }
}
const reload = () => { page.value = 1; void loadItems() }
const setQualityStatus = (status: NetworkDiaphragmQualityStatus) => { filters.value.quality_status = filters.value.quality_status === status ? undefined : status; reload() }
const openDetails = async (diaphragmId: number) => {
  detailVisible.value = true; detailLoading.value = true; details.value = null; isEditing.value = false
  try { details.value = await fastApiService.getNetworkDiaphragm(diaphragmId) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось открыть карточку диафрагмы'; detailVisible.value = false }
  finally { detailLoading.value = false }
}
const openDialog = async (scope: { diaphragmId?: number; lineId?: number } = {}) => {
  visible.value = true; await loadLookups(); filters.value = { line_id: scope.lineId }; page.value = 1; await loadItems()
  if (scope.diaphragmId) await openDetails(scope.diaphragmId)
}

const hasCoordinates = (item: NetworkDiaphragmSummary) => item.longitude !== null && item.latitude !== null && Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))
const locate = (item: NetworkDiaphragmSummary) => emit('locate-diaphragm', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, lineId: item.line_id, label: item.display_name || `Диафрагма №${item.id}` })
const qualityLabel = (status: NetworkDiaphragmQualityStatus) => ({ ready: 'готово', line_missing: 'нет линии', line_removed: 'линия удалена', topology_missing: 'нет топологии', state_missing: 'нет состояния', count_invalid: 'количество', diameter_unresolved: 'нет диаметра' })[status]
const qualityColor = (status: NetworkDiaphragmQualityStatus) => ({ ready: 'green', line_missing: 'red', line_removed: 'grey', topology_missing: 'orange', state_missing: 'purple', count_invalid: 'brown', diameter_unresolved: 'amber-darken-3' })[status]
const qualityDescription = (status: NetworkDiaphragmQualityStatus) => ({ ready: '', line_missing: 'Связанная линия отсутствует в текущей таблице linesobj.', line_removed: 'Связанная линия помечена удалённой.', topology_missing: 'Старая линия не содержит начальный и конечный узлы, поэтому сетевой контекст и координата недоступны.', state_missing: 'Ссылка stateID не соответствует справочнику states.', count_invalid: 'Количество последовательно установленных диафрагм должно быть больше нуля.', diameter_unresolved: 'Диаметр не задан, а разрешение записать подобранное расчётом значение отсутствует.' })[status]
const diameterModeLabel = (mode: NetworkDiaphragmDiameterMode) => ({ available: 'диаметр записан', pending_calculation: 'ожидает подбор расчётом', unresolved: 'не определён' })[mode]
const diameterLabel = (item: NetworkDiaphragmSummary) => item.internal_diameter !== null && item.internal_diameter > 0 ? `${formatNumber(item.internal_diameter, 6)} мм` : '—'
const nodeLabel = (code: string | null, name: string | null, id: number | null) => [code, name].filter(Boolean).join(' ') || (id ? `№${id}` : '—')
const formatNumber = (value: unknown, digits = 3) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatUnit = (value: unknown, unit: string) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : `${formatNumber(value)} ${unit}`
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('ru-RU') : '—'
const formatAttribute = (value: unknown) => typeof value === 'number' ? formatNumber(value, 8) : String(value ?? '—')
const outputValue = (key: string) => details.value?.latest_output?.[key] as string | number | null | undefined

defineExpose({ openDialog })
</script>

<style scoped>
.alerts{display:grid;gap:8px}.metric-row,.filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.filters>*{min-width:180px;flex:1}.filters .v-btn{flex:0 0 auto}.table-wrap{overflow:auto;min-height:380px}.journal-table{width:100%;border-collapse:collapse;font-size:13px}.journal-table th,.journal-table td{padding:9px 10px;border-bottom:1px solid #e0e0e0;text-align:left;white-space:nowrap}.journal-table th{position:sticky;top:0;background:#e0f2f1;z-index:1}.journal-table tbody tr{cursor:pointer}.journal-table tbody tr:hover{background:#f1fbfa}.muted{font-size:11px;color:#757575}.empty{text-align:center;color:#757575;padding:48px 32px}.journal-error{margin:0 12px 12px;padding:10px 12px;border-radius:4px;background:#ffebee;color:#b71c1c}.detail-grid,.attribute-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}:deep(.detail-value){display:flex;flex-direction:column;min-width:0}:deep(.detail-label){font-size:11px;color:#757575}:deep(.detail-value strong){overflow-wrap:anywhere}
@media(max-width:960px){.filters{display:grid;grid-template-columns:1fr}.filters>*{width:100%}.detail-grid,.attribute-grid{grid-template-columns:1fr}}
</style>
