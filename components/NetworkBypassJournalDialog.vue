<template>
  <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1520" scrollable>
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="cyan-darken-4" density="compact">
        <v-icon class="ml-3 mr-2">mdi-pipe-valve</v-icon>
        <v-toolbar-title>Байпасы наружных теплопроводов</v-toolbar-title>
        <v-chip class="mr-2" size="small" color="white" variant="outlined">
          {{ lookups.counts.ready || 0 }}/{{ lookups.counts.total || 0 }} готовы
        </v-chip>
        <v-btn icon="mdi-close" aria-label="Закрыть" @click="visible = false" />
      </v-toolbar>

      <div class="alerts pa-3 pb-0">
        <v-alert v-if="lookups.counts.total === 0" type="warning" variant="tonal" density="compact">
          Таблица <code>bypass</code> текущей БД пуста. Журнал и карточка готовы для существующих данных,
          а каталог стандартных труб доступен отдельно.
        </v-alert>
        <v-alert v-if="lookups.result_count === 0" type="info" variant="tonal" density="compact">
          Расчётная таблица <code>BP_OUT</code> пуста. Диаметр диафрагмы, расход и потери напора
          появятся после сохранения расчёта сети.
        </v-alert>
      </div>

      <v-tabs v-model="activeTab" color="cyan-darken-4" class="px-3 mt-2" @update:model-value="onTabChange">
        <v-tab value="inventory">Байпасы ({{ lookups.counts.total || 0 }})</v-tab>
        <v-tab value="tubes">Стандартные трубы ({{ lookups.tube_counts.total || 0 }})</v-tab>
      </v-tabs>

      <v-window v-model="activeTab">
        <v-window-item value="inventory">
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

          <div class="filters pa-3">
            <v-text-field v-model="filters.search" label="Узел, линия, место или ID" prepend-inner-icon="mdi-magnify" density="compact" variant="outlined" clearable hide-details @keyup.enter="reloadInventory" />
            <v-select v-model="filters.quality_status" :items="qualityOptions" label="Качество данных" density="compact" variant="outlined" clearable hide-details />
            <v-select v-model="filters.state_id" :items="lookups.states" item-title="name" item-value="id" label="Состояние" density="compact" variant="outlined" clearable hide-details />
            <v-select v-model="filters.pipeline_sign_id" :items="lookups.pipeline_signs" item-title="name" item-value="id" label="Трубопровод" density="compact" variant="outlined" clearable hide-details />
            <v-select v-model="filters.fragment_id" :items="lookups.fragments" item-title="name" item-value="id" label="Фрагмент" density="compact" variant="outlined" clearable hide-details />
            <v-btn color="cyan-darken-4" :loading="loading" @click="reloadInventory">Найти</v-btn>
          </div>

          <JournalError :message="error" />
          <div class="table-wrap">
            <table class="journal-table">
              <thead>
                <tr><th>ID</th><th>Место установки</th><th>Линия / узлы</th><th>Задание</th><th>Узел присоединения</th><th>Трубопровод</th><th>L / Dвн</th><th>Состояние</th><th>Фрагмент</th><th>Качество</th><th /></tr>
              </thead>
              <tbody>
                <tr v-for="item in inventory" :key="item.id" @click="openItemDetails(item.id)">
                  <td>{{ item.id }}</td>
                  <td>{{ item.installation_place || item.display_name || '—' }}</td>
                  <td>{{ item.line_id ?? '—' }}<div class="muted">{{ nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1) }} → {{ nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2) }}</div></td>
                  <td>{{ formatUnit(item.target_flow, 'т/ч') }}<div class="muted">± {{ formatUnit(item.flow_tolerance, 'т/ч') }}</div></td>
                  <td>{{ nodeLabel(item.connection_node_code, item.connection_node_name, item.connection_node_id) }}</td>
                  <td>{{ item.pipeline_sign_name || '—' }}</td>
                  <td>{{ formatUnit(item.length, 'м') }} / {{ formatUnit(item.internal_diameter, 'мм') }}</td>
                  <td><v-chip size="x-small" :color="stateColor(item.state_name)">{{ item.state_name || '—' }}</v-chip></td>
                  <td>{{ item.fragment_name || `№${item.fragment_id || '—'}` }}</td>
                  <td><v-chip size="x-small" :color="qualityColor(item.quality_status)">{{ qualityLabel(item.quality_status) }}</v-chip></td>
                  <td><v-btn v-if="hasCoordinates(item)" icon="mdi-map-marker" size="x-small" variant="text" aria-label="Показать байпас на карте" @click.stop="locate(item)" /></td>
                </tr>
              </tbody>
            </table>
            <div v-if="!loading && !inventory.length" class="empty">
              В текущей базе байпасы отсутствуют
            </div>
            <v-progress-linear v-if="loading" indeterminate color="cyan-darken-4" />
          </div>
          <v-pagination v-if="inventoryPages > 1" v-model="inventoryPage" :length="inventoryPages" density="comfortable" @update:model-value="loadInventory" />
        </v-window-item>

        <v-window-item value="tubes">
          <div class="filters pa-3">
            <v-text-field v-model="tubeFilters.search" label="Стандарт, DN, материал или ID" prepend-inner-icon="mdi-magnify" density="compact" variant="outlined" clearable hide-details @keyup.enter="reloadTubes" />
            <v-select v-model="tubeFilters.standard" :items="lookups.tube_standards" item-title="name" item-value="name" label="Стандарт" density="compact" variant="outlined" clearable hide-details />
            <v-select v-model="tubeFilters.quality_status" :items="tubeQualityOptions" label="Полнота паспорта" density="compact" variant="outlined" clearable hide-details />
            <v-btn color="cyan-darken-4" :loading="loading" @click="reloadTubes">Найти</v-btn>
          </div>
          <JournalError :message="error" />
          <div class="table-wrap catalog-table-wrap">
            <table class="journal-table">
              <thead><tr><th>ID</th><th>Стандарт</th><th>DN</th><th>Dнар</th><th>Dвн</th><th>Стенка</th><th>Площадь сечения</th><th>Установлено</th><th>Качество</th></tr></thead>
              <tbody>
                <tr v-for="tube in tubes" :key="tube.id" @click="openTubeDetails(tube.id)">
                  <td>{{ tube.id }}</td><td><strong>{{ tube.standard || '—' }}</strong></td>
                  <td>{{ formatUnit(tube.nominal_diameter, 'мм') }}</td><td>{{ formatUnit(tube.external_diameter, 'мм') }}</td><td>{{ formatUnit(tube.internal_diameter, 'мм') }}</td><td>{{ formatUnit(tube.wall_thickness, 'мм') }}</td>
                  <td>{{ formatNumber(tube.section_area, 8) }}</td><td>{{ tube.installed_count }}</td>
                  <td><v-chip size="x-small" :color="tube.quality_status === 'ready' ? 'green' : 'orange'">{{ tube.quality_status === 'ready' ? 'готово' : 'неполный' }}</v-chip></td>
                </tr>
              </tbody>
            </table>
            <div v-if="!loading && !tubes.length" class="empty">Типоразмеры не найдены</div>
            <v-progress-linear v-if="loading" indeterminate color="cyan-darken-4" />
          </div>
          <v-pagination v-if="tubePages > 1" v-model="tubePage" :length="tubePages" density="comfortable" @update:model-value="loadTubes" />
        </v-window-item>
      </v-window>
    </v-card>
  </v-dialog>

  <v-dialog v-model="detailVisible" :fullscreen="isMobile" max-width="1160" scrollable>
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="cyan-darken-4" density="compact">
        <v-btn icon="mdi-arrow-left" aria-label="Вернуться к журналу" @click="detailVisible = false" />
        <v-toolbar-title>{{ detailTitle }}</v-toolbar-title>
        <v-btn icon="mdi-close" aria-label="Закрыть карточку" @click="detailVisible = false" />
      </v-toolbar>
      <v-progress-linear v-if="detailLoading" indeterminate color="cyan-darken-4" />

      <template v-if="itemDetails && !detailLoading">
        <div class="alerts pa-3 pb-0">
          <v-alert v-if="itemDetails.quality_status !== 'ready'" :type="itemDetails.quality_status === 'line_missing' ? 'error' : 'warning'" variant="tonal" density="compact">{{ qualityDescription(itemDetails.quality_status) }}</v-alert>
        </div>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6"><v-card variant="outlined" class="h-100"><v-card-title class="text-subtitle-1">Сетевая привязка</v-card-title><v-card-text class="detail-grid">
              <DetailValue label="Байпас / ID" :value="itemDetails.id" /><DetailValue label="Линия" :value="itemDetails.line_id" />
              <DetailValue label="Начальный узел" :value="nodeLabel(itemDetails.node_code_1, itemDetails.node_name_1, itemDetails.node_id_1)" /><DetailValue label="Конечный узел" :value="nodeLabel(itemDetails.node_code_2, itemDetails.node_name_2, itemDetails.node_id_2)" />
              <DetailValue label="Узел присоединения" :value="nodeLabel(itemDetails.connection_node_code, itemDetails.connection_node_name, itemDetails.connection_node_id)" /><DetailValue label="Фрагмент" :value="itemDetails.fragment_name || itemDetails.fragment_id" />
            </v-card-text></v-card></v-col>
            <v-col cols="12" md="6"><v-card variant="outlined" class="h-100">
              <v-card-title class="text-subtitle-1">Задание байпаса</v-card-title>
              <v-card-text class="detail-grid" v-if="!isEditing">
                <DetailValue label="Регулируемый расход" :value="formatUnit(itemDetails.target_flow, 'т/ч')" /><DetailValue label="Допуск расхода" :value="formatUnit(itemDetails.flow_tolerance, 'т/ч')" />
                <DetailValue label="Заданный напор" :value="formatUnit(itemDetails.target_head, 'м')" /><DetailValue label="Допуск напора" :value="formatUnit(itemDetails.head_tolerance, 'м')" />
                <DetailValue label="Состояние" :value="itemDetails.state_name" /><DetailValue label="Трубопровод" :value="itemDetails.pipeline_sign_name" /><DetailValue label="Место установки" :value="itemDetails.installation_place" />
              </v-card-text>
              <v-card-text v-else>
                <v-row dense>
                  <v-col v-for="field in buildFields().assignment" :key="field.key" cols="12" sm="6">
                    <div class="detail-label mb-1">{{ field.label }}</div>
                    <v-select v-if="field.type === 'select'" v-model="editFields[field.key]" :items="field.items" item-title="name" item-value="id" density="compact" hide-details variant="outlined" clearable />
                    <v-text-field v-else v-model="editFields[field.key]" :type="field.type === 'number' ? 'number' : 'text'" density="compact" hide-details variant="outlined" clearable />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card></v-col>
            <v-col cols="12" md="6"><v-card variant="outlined" class="h-100">
              <v-card-title class="text-subtitle-1">Параметры трубопровода</v-card-title>
              <v-card-text class="detail-grid" v-if="!isEditing">
                <DetailValue label="Длина" :value="formatUnit(itemDetails.length, 'м')" /><DetailValue label="Внутренний диаметр" :value="formatUnit(itemDetails.internal_diameter, 'мм')" />
                <DetailValue label="Экв. шероховатость" :value="formatUnit(itemDetails.tube_roughness, 'мм')" /><DetailValue label="Σ местных сопротивлений" :value="formatNumber(itemDetails.local_resistance_coefficients, 5)" />
                <DetailValue label="Стандарт" :value="itemDetails.standard_name" /><DetailValue label="Типовая труба" :value="itemDetails.selected_tube?.display_name || itemDetails.standard_tube_id" />
                <DetailValue label="Сопротивление линии" :value="formatNumber(itemDetails.line_hydraulic_resistance, 8)" />
              </v-card-text>
              <v-card-text v-else>
                <v-row dense>
                  <v-col v-for="field in buildFields().pipeline" :key="field.key" cols="12" sm="6">
                    <div class="detail-label mb-1">{{ field.label }}</div>
                    <v-select v-if="field.type === 'select'" v-model="editFields[field.key]" :items="field.items" item-title="name" item-value="id" density="compact" hide-details variant="outlined" clearable />
                    <v-text-field v-else v-model="editFields[field.key]" :type="field.type === 'number' ? 'number' : 'text'" density="compact" hide-details variant="outlined" clearable />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card></v-col>
            <v-col cols="12" md="6"><v-card variant="outlined" class="h-100"><v-card-title class="text-subtitle-1">Расчётный режим BP_OUT</v-card-title>
              <v-card-text v-if="itemDetails.latest_output" class="detail-grid">
                <DetailValue label="Диаметр диафрагмы" :value="formatUnit(outputValue('diaphragm_diameter'), 'мм')" /><DetailValue label="Напор на диафрагме" :value="formatUnit(outputValue('diaphragm_head_loss'), 'м')" />
                <DetailValue label="Расход" :value="formatUnit(outputValue('flow'), 'т/ч')" /><DetailValue label="Потери на байпасе" :value="formatUnit(outputValue('bypass_head_loss'), 'м')" />
                <DetailValue label="Суммарный гасимый напор" :value="formatUnit(outputValue('total_head_loss'), 'м')" /><DetailValue label="Гидравлическое сопротивление" :value="formatNumber(outputValue('hydraulic_resistance'), 8)" />
              </v-card-text><v-card-text v-else><v-alert type="info" variant="tonal" density="compact">Гидравлический режим для этого байпаса пока не рассчитан.</v-alert></v-card-text>
            </v-card></v-col>
          </v-row>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-3 bg-grey-lighten-4">
          <v-spacer />
          <v-btn v-if="!isEditing && hasCoordinates(itemDetails)" color="cyan-darken-4" variant="text" prepend-icon="mdi-map-marker" @click="locate(itemDetails)">Показать на карте</v-btn>
          <template v-if="!isEditing">
            <v-btn v-if="mutationsEnabled" color="primary" variant="flat" prepend-icon="mdi-pencil" @click="startEdit">Редактировать</v-btn>
          </template>
          <template v-else>
            <v-btn v-if="mutationsEnabled" color="error" variant="text" @click="cancelEdit" :disabled="saving">Отмена</v-btn>
            <v-btn v-if="mutationsEnabled" color="primary" variant="flat" @click="saveChanges" :loading="saving">Сохранить</v-btn>
          </template>
        </v-card-actions>
      </template>

      <template v-if="tubeDetails && !detailLoading">
        <v-card-text><v-row>
          <v-col cols="12" md="6"><v-card variant="outlined" class="h-100"><v-card-title class="text-subtitle-1">Паспорт стандартной трубы</v-card-title><v-card-text class="detail-grid">
            <DetailValue label="ID" :value="tubeDetails.id" /><DetailValue label="Стандарт" :value="tubeDetails.standard" /><DetailValue label="DN" :value="formatUnit(tubeDetails.nominal_diameter, 'мм')" />
            <DetailValue label="Наружный диаметр" :value="formatUnit(tubeDetails.external_diameter, 'мм')" /><DetailValue label="Внутренний диаметр" :value="formatUnit(tubeDetails.internal_diameter, 'мм')" /><DetailValue label="Толщина стенки" :value="formatUnit(tubeDetails.wall_thickness, 'мм')" />
            <DetailValue label="Материал" :value="tubeDetails.material" /><DetailValue label="Изготовитель" :value="tubeDetails.manufacturer" /><DetailValue label="Связано с байпасами" :value="tubeDetails.installed_count" />
          </v-card-text></v-card></v-col>
          <v-col cols="12" md="6"><v-card variant="outlined" class="h-100"><v-card-title class="text-subtitle-1">Расчётные свойства</v-card-title><v-card-text class="detail-grid">
            <DetailValue label="Площадь сечения" :value="formatNumber(tubeDetails.section_area, 8)" /><DetailValue label="Поверхность на метр" :value="formatNumber(tubeDetails.surface_per_meter, 8)" />
            <DetailValue label="Масса на метр" :value="formatNumber(tubeDetails.mass_per_meter, 5)" /><DetailValue label="Масса с изоляцией" :value="formatNumber(tubeDetails.insulated_mass_per_meter, 5)" />
          </v-card-text></v-card></v-col>
          <v-col cols="12"><v-card variant="outlined"><v-card-title class="text-subtitle-1">Исходные поля standardtubes</v-card-title><v-card-text class="attribute-grid"><DetailValue v-for="entry in tubeAttributeEntries" :key="entry[0]" :label="entry[0]" :value="formatAttribute(entry[1])" /></v-card-text></v-card></v-col>
        </v-row></v-card-text>
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
  type NetworkBypassDetails,
  type NetworkBypassFilters,
  type NetworkBypassLookups,
  type NetworkBypassQualityStatus,
  type NetworkBypassSummary,
  type StandardTubeDetails,
  type StandardTubeFilters,
  type StandardTubeSummary
} from '~/services/fastApiService'

const DetailValue = defineComponent({
  props: { label: { type: String, required: true }, value: { type: [String, Number] as PropType<string | number | null | undefined>, default: null } },
  setup: props => () => h('div', { class: 'detail-value' }, [h('span', { class: 'detail-label' }, props.label), h('strong', String(props.value ?? '—'))])
})
const JournalError = defineComponent({
  props: { message: { type: String, default: '' } },
  setup: props => () => props.message ? h('div', { class: 'journal-error' }, props.message) : null
})

const emit = defineEmits<{
  'locate-bypass': [payload: { longitude: number; latitude: number; id: number; lineId: number | null; label: string }]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const emptyLookups = (): NetworkBypassLookups => ({ states: [], pipeline_signs: [], standards: [], tube_standards: [], fragments: [], counts: {}, tube_counts: {}, calculation_count: 0, result_count: 0 })
const visible = ref(false)
const detailVisible = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const lookupsLoaded = ref(false)
const error = ref('')
const activeTab = ref<'inventory' | 'tubes'>('inventory')
const inventoryPage = ref(1)
const inventoryPages = ref(0)
const tubePage = ref(1)
const tubePages = ref(0)
const inventory = ref<NetworkBypassSummary[]>([])
const tubes = ref<StandardTubeSummary[]>([])
const itemDetails = ref<NetworkBypassDetails | null>(null)
const tubeDetails = ref<StandardTubeDetails | null>(null)
const lookups = ref<NetworkBypassLookups>(emptyLookups())
const filters = ref<NetworkBypassFilters>({})
const tubeFilters = ref<StandardTubeFilters>({})
const isEditing = ref(false)
const saving = ref(false)
const editFields = ref<Record<string, any>>({})

const buildFields = () => {
  return {
    assignment: [
      { label: 'Регулируемый расход', key: 'q', type: 'number', value: itemDetails.value?.target_flow },
      { label: 'Допуск расхода', key: 'deltaq', type: 'number', value: itemDetails.value?.flow_tolerance },
      { label: 'Заданный напор', key: 'h', type: 'number', value: itemDetails.value?.target_head },
      { label: 'Допуск напора', key: 'deltah', type: 'number', value: itemDetails.value?.head_tolerance },
      { label: 'Состояние', key: 'regulatorstateid', type: 'select', items: lookups.value.states, value: itemDetails.value?.state_id },
      { label: 'Трубопровод', key: 'pipelinesignid', type: 'select', items: lookups.value.pipeline_signs, value: itemDetails.value?.pipeline_sign_id },
      { label: 'Место установки', key: 'locinstall', type: 'text', value: itemDetails.value?.installation_place }
    ],
    pipeline: [
      { label: 'Длина', key: 'length', type: 'number', value: itemDetails.value?.length },
      { label: 'Внутренний диаметр', key: 'diameterinternal', type: 'number', value: itemDetails.value?.internal_diameter },
      { label: 'Экв. шероховатость', key: 'tuberoughness', type: 'number', value: itemDetails.value?.tube_roughness },
      { label: 'Σ местных сопротивлений', key: 'rescoeffssum', type: 'number', value: itemDetails.value?.local_resistance_coefficients },
      { label: 'Стандарт', key: 'standardid', type: 'select', items: lookups.value.standards, value: itemDetails.value?.standard_id },
      { label: 'Типовая труба (ID)', key: 'standardtubelink', type: 'number', value: itemDetails.value?.standard_tube_id }
    ]
  }
}

const startEdit = () => {
  isEditing.value = true
  editFields.value = {}
  const fields = buildFields()
  for (const field of [...fields.assignment, ...fields.pipeline]) {
    if (field.key) editFields.value[field.key] = field.value ?? null
  }
}

const cancelEdit = () => {
  isEditing.value = false
  editFields.value = {}
}

const saveChanges = async () => {
  if (!itemDetails.value) return
  saving.value = true
  try {
    const processedFields: Record<string, any> = {}
    for (const key in editFields.value) {
      if (editFields.value[key] === '') processedFields[key] = null
      else processedFields[key] = editFields.value[key]
    }
    
    await fastApiService.updateObjectAttributes('bypass', itemDetails.value.id, processedFields)
    
    await openItemDetails(itemDetails.value.id)
    isEditing.value = false
    await loadInventory()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Ошибка при сохранении'
  } finally {
    saving.value = false
  }
}

const qualityOptions = [
  { title: 'Готово', value: 'ready' }, { title: 'Нет линии', value: 'line_missing' },
  { title: 'Линия удалена', value: 'line_removed' }, { title: 'Нет узла присоединения', value: 'connection_node_missing' },
  { title: 'Не задан расход', value: 'setpoint_missing' }, { title: 'Некорректные параметры трубы', value: 'geometry_parameters_invalid' }
]
const tubeQualityOptions = [{ title: 'Полный паспорт', value: 'ready' }, { title: 'Неполный паспорт', value: 'incomplete' }]
const qualityMetrics: Array<{ value: NetworkBypassQualityStatus; label: string; color: string }> = [
  { value: 'ready', label: 'Готовы', color: 'green' }, { value: 'line_missing', label: 'Нет линии', color: 'red' },
  { value: 'line_removed', label: 'Удалённая линия', color: 'grey' }, { value: 'connection_node_missing', label: 'Нет узла', color: 'orange' },
  { value: 'setpoint_missing', label: 'Нет расхода', color: 'amber-darken-3' }, { value: 'geometry_parameters_invalid', label: 'Параметры трубы', color: 'brown' }
]
const detailTitle = computed(() => itemDetails.value?.display_name || tubeDetails.value?.display_name || 'Паспорт байпаса')
const tubeAttributeEntries = computed(() => Object.entries(tubeDetails.value?.attributes || {}).filter(([, value]) => value !== null && value !== ''))

const loadLookups = async () => {
  if (!lookupsLoaded.value) { lookups.value = await fastApiService.getNetworkBypassLookups(); lookupsLoaded.value = true }
}
const loadInventory = async () => {
  loading.value = true; error.value = ''
  try { const response = await fastApiService.getNetworkBypasses({ ...filters.value, page: inventoryPage.value, page_size: 50 }); inventory.value = response.items; inventoryPages.value = response.pages }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить байпасы' } finally { loading.value = false }
}
const loadTubes = async () => {
  loading.value = true; error.value = ''
  try { const response = await fastApiService.getStandardTubes({ ...tubeFilters.value, page: tubePage.value, page_size: 50 }); tubes.value = response.items; tubePages.value = response.pages }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить стандартные трубы' } finally { loading.value = false }
}
const reloadInventory = () => { inventoryPage.value = 1; void loadInventory() }
const reloadTubes = () => { tubePage.value = 1; void loadTubes() }
const onTabChange = (tab: unknown) => { if (tab === 'tubes' && !tubes.value.length) void loadTubes(); if (tab === 'inventory' && !inventory.value.length) void loadInventory() }
const setQualityStatus = (status: NetworkBypassQualityStatus) => { filters.value.quality_status = filters.value.quality_status === status ? undefined : status; reloadInventory() }
const openItemDetails = async (bypassId: number) => {
  detailVisible.value = true; detailLoading.value = true; itemDetails.value = null; tubeDetails.value = null; isEditing.value = false
  try { itemDetails.value = await fastApiService.getNetworkBypass(bypassId) } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось открыть карточку байпаса'; detailVisible.value = false } finally { detailLoading.value = false }
}
const openTubeDetails = async (tubeId: number) => {
  detailVisible.value = true; detailLoading.value = true; itemDetails.value = null; tubeDetails.value = null; isEditing.value = false
  try { tubeDetails.value = await fastApiService.getStandardTube(tubeId) } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось открыть паспорт трубы'; detailVisible.value = false } finally { detailLoading.value = false }
}
const openDialog = async (scope: { bypassId?: number; standardTubeId?: number; lineId?: number } = {}) => {
  visible.value = true; await loadLookups()
  if (scope.standardTubeId) { activeTab.value = 'tubes'; tubeFilters.value = {}; tubePage.value = 1; await loadTubes(); await openTubeDetails(scope.standardTubeId); return }
  activeTab.value = 'inventory'; filters.value = { line_id: scope.lineId }; inventoryPage.value = 1; await loadInventory()
  if (scope.bypassId) await openItemDetails(scope.bypassId)
}

const hasCoordinates = (item: NetworkBypassSummary) => item.longitude !== null && item.latitude !== null && Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))
const locate = (item: NetworkBypassSummary) => emit('locate-bypass', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, lineId: item.line_id, label: item.display_name || `Байпас №${item.id}` })
const qualityLabel = (status: NetworkBypassQualityStatus) => ({ ready: 'готово', line_missing: 'нет линии', line_removed: 'линия удалена', connection_node_missing: 'нет узла', setpoint_missing: 'нет задания', geometry_parameters_invalid: 'параметры трубы' })[status]
const qualityColor = (status: NetworkBypassQualityStatus) => ({ ready: 'green', line_missing: 'red', line_removed: 'grey', connection_node_missing: 'orange', setpoint_missing: 'amber-darken-3', geometry_parameters_invalid: 'brown' })[status]
const qualityDescription = (status: NetworkBypassQualityStatus) => ({ ready: '', line_missing: 'Связанная линия отсутствует: сетевой контекст и позиционирование недоступны.', line_removed: 'Связанная линия помечена удалённой и исключена из активной расчётной схемы.', connection_node_missing: 'Не выбран или потерян узел присоединения байпасного участка.', setpoint_missing: 'Регулируемый расход равен нулю или отсутствует.', geometry_parameters_invalid: 'Длина, внутренний диаметр, шероховатость или сумма местных сопротивлений имеют недопустимое значение.' })[status]
const stateColor = (state: string | null) => state?.toLowerCase() === 'открыт' ? 'green' : state?.toLowerCase() === 'закрыт' ? 'grey' : 'blue-grey'
const nodeLabel = (code: string | null, name: string | null, id: number | null) => [code, name].filter(Boolean).join(' ') || (id ? `№${id}` : '—')
const formatNumber = (value: unknown, digits = 3) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatUnit = (value: unknown, unit: string) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : `${formatNumber(value)} ${unit}`
const formatAttribute = (value: unknown) => typeof value === 'number' ? formatNumber(value, 8) : String(value ?? '—')
const outputValue = (key: string) => itemDetails.value?.latest_output?.[key] as string | number | null | undefined

defineExpose({ openDialog })
</script>

<style scoped>
.alerts{display:grid;gap:8px}.metric-row,.filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.filters>*{min-width:180px;flex:1}.filters .v-btn{flex:0 0 auto}.table-wrap{overflow:auto;min-height:330px}.catalog-table-wrap{min-height:260px}.journal-table{width:100%;border-collapse:collapse;font-size:13px}.journal-table th,.journal-table td{padding:9px 10px;border-bottom:1px solid #e0e0e0;text-align:left;white-space:nowrap}.journal-table th{position:sticky;top:0;background:#e0f7fa;z-index:1}.journal-table tbody tr{cursor:pointer}.journal-table tbody tr:hover{background:#f1fbfc}.muted{font-size:11px;color:#757575}.empty{text-align:center;color:#757575;padding:48px 32px}.journal-error{margin:0 12px 12px;padding:10px 12px;border-radius:4px;background:#ffebee;color:#b71c1c}.detail-grid,.attribute-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}:deep(.detail-value){display:flex;flex-direction:column;min-width:0}:deep(.detail-label){font-size:11px;color:#757575}:deep(.detail-value strong){overflow-wrap:anywhere}
@media(max-width:960px){.filters{display:grid;grid-template-columns:1fr}.filters>*{width:100%}.detail-grid,.attribute-grid{grid-template-columns:1fr}}
</style>
