<template>
  <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1580" scrollable>
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="indigo-darken-3" density="compact">
        <v-icon class="ml-3 mr-2">mdi-tune-vertical</v-icon>
        <v-toolbar-title>Сетевые регуляторы</v-toolbar-title>
        <v-chip class="mr-2" size="small" color="white" variant="outlined">
          {{ lookups.counts.ready || 0 }}/{{ lookups.counts.total || 0 }} готовы
        </v-chip>
        <v-btn icon="mdi-close" aria-label="Закрыть" @click="visible = false" />
      </v-toolbar>

      <div class="alerts pa-3 pb-0">
        <v-alert v-if="lookups.result_count === 0" type="info" variant="tonal" density="compact">
          Расчётная таблица <code>RS_OUT</code> пуста. Исходные задания доступны, а полученные расход,
          напоры, сопротивление и положение клапана появятся после сохранения расчёта сети.
        </v-alert>
        <v-alert type="warning" variant="tonal" density="compact">
          Геометрия доступна для {{ lookups.counts.locatable || 0 }} из {{ lookups.counts.total || 0 }} регуляторов.
          У {{ lookups.counts.control_node_missing || 0 }} записей давления/перепада отсутствует регулируемый узел.
        </v-alert>
      </div>

      <v-tabs v-model="activeTab" color="indigo-darken-3" class="px-3 mt-2" @update:model-value="onTabChange">
        <v-tab value="inventory">Установленные ({{ lookups.counts.total || 0 }})</v-tab>
        <v-tab value="catalog">Каталог ({{ lookups.catalog_counts.total || 0 }})</v-tab>
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
            <v-text-field
              v-model="filters.search"
              label="Узел, линия или ID"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              variant="outlined"
              clearable
              hide-details
              @keyup.enter="reloadInventory"
            />
            <v-select v-model="filters.regulator_type" :items="typeOptions" label="Тип регулятора" density="compact" variant="outlined" clearable hide-details />
            <v-select v-model="filters.quality_status" :items="qualityOptions" label="Качество данных" density="compact" variant="outlined" clearable hide-details />
            <v-select v-model="filters.state_id" :items="lookups.states" item-title="name" item-value="id" label="Состояние" density="compact" variant="outlined" clearable hide-details />
            <v-select v-model="filters.fragment_id" :items="lookups.fragments" item-title="name" item-value="id" label="Фрагмент" density="compact" variant="outlined" clearable hide-details />
            <v-select v-model="filters.work_attribute_id" :items="lookups.work_attributes" item-title="name" item-value="id" label="Режим работы" density="compact" variant="outlined" clearable hide-details />
            <v-btn color="indigo-darken-3" :loading="loading" @click="reloadInventory">Найти</v-btn>
          </div>

          <JournalError :message="error" />
          <div class="table-wrap">
            <table class="journal-table">
              <thead>
                <tr>
                  <th>ID</th><th>Тип</th><th>Линия / узлы</th><th>Задание</th><th>Регулируемый узел</th>
                  <th>Состояние</th><th>Режим</th><th>Фрагмент</th><th>Качество</th><th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in inventory" :key="`${item.regulator_type}-${item.id}`" @click="openItemDetails(item.regulator_type, item.id)">
                  <td>{{ item.id }}</td>
                  <td>{{ typeLabel(item.regulator_type) }}</td>
                  <td>
                    {{ item.line_id ?? '—' }}
                    <div class="muted">{{ nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1) }} → {{ nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2) }}</div>
                  </td>
                  <td>{{ formatTarget(item.regulator_type, item.set_value) }}</td>
                  <td>{{ requiresControlNode(item.regulator_type) ? nodeLabel(item.control_node_code, item.control_node_name, item.control_node_id) : 'не требуется' }}</td>
                  <td><v-chip size="x-small" :color="stateColor(item.state_name)">{{ item.state_name || '—' }}</v-chip></td>
                  <td>{{ item.work_attribute_name || '—' }}</td>
                  <td>{{ item.fragment_name || `№${item.fragment_id || '—'}` }}</td>
                  <td><v-chip size="x-small" :color="qualityColor(item.quality_status)">{{ qualityLabel(item.quality_status) }}</v-chip></td>
                  <td>
                    <v-btn
                      v-if="hasCoordinates(item)"
                      icon="mdi-map-marker"
                      size="x-small"
                      variant="text"
                      aria-label="Показать регулятор на карте"
                      @click.stop="locate(item)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="!loading && !inventory.length" class="empty">Регуляторы не найдены</div>
            <v-progress-linear v-if="loading" indeterminate color="indigo-darken-3" />
          </div>
          <v-pagination v-if="inventoryPages > 1" v-model="inventoryPage" :length="inventoryPages" density="comfortable" @update:model-value="loadInventory" />
        </v-window-item>

        <v-window-item value="catalog">
          <div class="filters pa-3">
            <v-text-field
              v-model="catalogFilters.search"
              label="Модель, серия, изготовитель или ID"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              variant="outlined"
              clearable
              hide-details
              @keyup.enter="reloadCatalog"
            />
            <v-select v-model="catalogFilters.catalog_type" :items="typeOptions" label="Тип каталога" density="compact" variant="outlined" clearable hide-details />
            <v-select v-model="catalogFilters.quality_status" :items="catalogQualityOptions" label="Полнота паспорта" density="compact" variant="outlined" clearable hide-details />
            <v-btn color="indigo-darken-3" :loading="loading" @click="reloadCatalog">Найти</v-btn>
          </div>
          <JournalError :message="error" />
          <div class="table-wrap catalog-table-wrap">
            <table class="journal-table">
              <thead><tr><th>ID</th><th>Тип</th><th>Наименование / модель</th><th>DN</th><th>Kv</th><th>Диапазон</th><th>Среда / привод</th><th>Изготовитель</th><th>Качество</th></tr></thead>
              <tbody>
                <tr v-for="item in catalog" :key="`${item.catalog_type}-${item.id}`" @click="openCatalogDetails(item.catalog_type, item.id)">
                  <td>{{ item.id }}</td><td>{{ typeLabel(item.catalog_type) }}</td>
                  <td><strong>{{ item.display_name || item.model || '—' }}</strong><div class="muted">{{ [item.series, item.model].filter(Boolean).join(' · ') || '—' }}</div></td>
                  <td>{{ formatUnit(item.nominal_diameter, 'мм') }}</td><td>{{ formatNumber(item.capacity) }}</td>
                  <td>{{ pressureRange(item) }}</td><td>{{ item.medium || item.drive_type || '—' }}</td><td>{{ item.producer || '—' }}</td>
                  <td><v-chip size="x-small" :color="item.quality_status === 'ready' ? 'green' : 'orange'">{{ item.quality_status === 'ready' ? 'готово' : 'неполный' }}</v-chip></td>
                </tr>
              </tbody>
            </table>
            <div v-if="!loading && !catalog.length" class="empty">Модели не найдены</div>
            <v-progress-linear v-if="loading" indeterminate color="indigo-darken-3" />
          </div>
          <v-pagination v-if="catalogPages > 1" v-model="catalogPage" :length="catalogPages" density="comfortable" @update:model-value="loadCatalog" />
        </v-window-item>
      </v-window>
    </v-card>
  </v-dialog>

  <v-dialog v-model="detailVisible" :fullscreen="isMobile" max-width="1180" scrollable>
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="indigo-darken-3" density="compact">
        <v-btn icon="mdi-arrow-left" aria-label="Вернуться к журналу" @click="detailVisible = false" />
        <v-toolbar-title>{{ detailTitle }}</v-toolbar-title>
        <v-btn icon="mdi-close" aria-label="Закрыть карточку" @click="detailVisible = false" />
      </v-toolbar>
      <v-progress-linear v-if="detailLoading" indeterminate color="indigo-darken-3" />

      <template v-if="itemDetails && !detailLoading">
        <div class="alerts pa-3 pb-0">
          <v-alert v-if="itemDetails.quality_status !== 'ready'" :type="itemDetails.quality_status === 'line_missing' ? 'error' : 'warning'" variant="tonal" density="compact">
            {{ qualityDescription(itemDetails.quality_status) }}
          </v-alert>
        </div>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-card variant="outlined" class="h-100">
                <v-card-title class="text-subtitle-1">Сетевая привязка</v-card-title>
                <v-card-text class="detail-grid">
                  <DetailValue label="Тип / ID" :value="`${typeLabel(itemDetails.regulator_type)} / ${itemDetails.id}`" />
                  <DetailValue label="Линия" :value="itemDetails.line_id" />
                  <DetailValue label="Начальный узел" :value="nodeLabel(itemDetails.node_code_1, itemDetails.node_name_1, itemDetails.node_id_1)" />
                  <DetailValue label="Конечный узел" :value="nodeLabel(itemDetails.node_code_2, itemDetails.node_name_2, itemDetails.node_id_2)" />
                  <DetailValue label="Регулируемый узел" :value="requiresControlNode(itemDetails.regulator_type) ? nodeLabel(itemDetails.control_node_code, itemDetails.control_node_name, itemDetails.control_node_id) : 'не требуется'" />
                  <DetailValue label="Фрагмент" :value="itemDetails.fragment_name || itemDetails.fragment_id" />
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card variant="outlined" class="h-100">
                <v-card-title class="text-subtitle-1">Задание регулятора</v-card-title>
                <v-card-text class="detail-grid" v-if="!isEditing">
                  <DetailValue label="Заданная величина" :value="formatTarget(itemDetails.regulator_type, itemDetails.set_value)" />
                  <DetailValue label="Допустимое отклонение" :value="formatTarget(itemDetails.regulator_type, itemDetails.tolerance)" />
                  <DetailValue label="Пропускная способность Kv" :value="formatNumber(itemDetails.capacity)" />
                  <DetailValue label="Состояние" :value="itemDetails.state_name" />
                  <DetailValue label="Режим работы" :value="itemDetails.work_attribute_name" />
                  <DetailValue label="Трубопровод" :value="itemDetails.pipeline_sign_name" />
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
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card variant="outlined" class="h-100">
                <v-card-title class="text-subtitle-1">Параметры клапана</v-card-title>
                <v-card-text class="detail-grid" v-if="!isEditing">
                  <DetailValue label="Сопротивление, открыт" :value="formatNumber(itemDetails.hydraulic_resistance_open, 6)" />
                  <DetailValue label="Сопротивление, закрыт" :value="formatNumber(itemDetails.hydraulic_resistance_closed, 6)" />
                  <DetailValue label="Относительная утечка" :value="formatNumber(itemDetails.relative_leakage)" />
                  <DetailValue label="Расход утечки" :value="formatNumber(itemDetails.leakage_flow)" />
                  <DetailValue label="Фактический расход (исходное поле)" :value="formatNumber(itemDetails.actual_flow)" />
                  <DetailValue label="Фактический перепад (исходное поле)" :value="formatNumber(itemDetails.actual_value)" />
                </v-card-text>
                <v-card-text v-else>
                  <v-row dense>
                    <v-col v-for="field in buildFields().valve" :key="field.key" cols="12" sm="6">
                      <div class="detail-label mb-1">{{ field.label }}</div>
                      <v-text-field v-model="editFields[field.key]" :type="field.type === 'number' ? 'number' : 'text'" density="compact" hide-details variant="outlined" clearable />
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card variant="outlined" class="h-100">
                <v-card-title class="text-subtitle-1">Расчётный режим RS_OUT</v-card-title>
                <v-card-text v-if="itemDetails.latest_output" class="detail-grid">
                  <DetailValue label="Расход через клапан" :value="formatNumber(outputValue('flow'))" />
                  <DetailValue label="Гидравлическое сопротивление" :value="formatNumber(outputValue('hydraulic_resistance'), 6)" />
                  <DetailValue label="Пьезометрический напор, вход" :value="formatNumber(outputValue('piezometric_head_in'))" />
                  <DetailValue label="Пьезометрический напор, выход" :value="formatNumber(outputValue('piezometric_head_out'))" />
                  <DetailValue label="Задано / получено" :value="`${formatNumber(outputValue('target_value'))} / ${formatNumber(outputValue('actual_value'))}`" />
                  <DetailValue label="Положение клапана" :value="outputValue('valve_position')" />
                </v-card-text>
                <v-card-text v-else>
                  <v-alert type="info" variant="tonal" density="compact">Гидравлический режим для этого регулятора пока не рассчитан.</v-alert>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="px-4 py-3 bg-grey-lighten-4">
          <v-spacer />
          <v-btn v-if="!isEditing && hasCoordinates(itemDetails)" color="indigo-darken-3" variant="text" prepend-icon="mdi-map-marker" @click="locate(itemDetails)">Показать на карте</v-btn>
          <template v-if="!isEditing">
            <v-btn v-if="mutationsEnabled" color="primary" variant="flat" prepend-icon="mdi-pencil" @click="startEdit">Редактировать</v-btn>
          </template>
          <template v-else>
            <v-btn v-if="mutationsEnabled" color="error" variant="text" @click="cancelEdit" :disabled="saving">Отмена</v-btn>
            <v-btn v-if="mutationsEnabled" color="primary" variant="flat" @click="saveChanges" :loading="saving">Сохранить</v-btn>
          </template>
        </v-card-actions>
      </template>

      <template v-if="catalogDetails && !detailLoading">
        <v-card-text>
          <v-alert type="info" variant="tonal" density="compact" class="mb-3">{{ catalogDetails.link_note }}</v-alert>
          <v-row>
            <v-col cols="12" md="6">
              <v-card variant="outlined" class="h-100">
                <v-card-title class="text-subtitle-1">Паспорт модели</v-card-title>
                <v-card-text class="detail-grid">
                  <DetailValue label="Тип / ID" :value="`${typeLabel(catalogDetails.catalog_type)} / ${catalogDetails.id}`" />
                  <DetailValue label="Наименование" :value="catalogDetails.display_name" />
                  <DetailValue label="Серия / модель" :value="[catalogDetails.series, catalogDetails.model].filter(Boolean).join(' / ')" />
                  <DetailValue label="DN" :value="formatUnit(catalogDetails.nominal_diameter, 'мм')" />
                  <DetailValue label="Kv" :value="formatNumber(catalogDetails.capacity)" />
                  <DetailValue label="Изготовитель" :value="catalogDetails.producer" />
                  <DetailValue label="Рабочая среда" :value="catalogDetails.medium" />
                  <DetailValue label="Макс. температура" :value="formatUnit(catalogDetails.max_temperature, '°C')" />
                  <DetailValue label="Диапазон задания" :value="pressureRange(catalogDetails)" />
                  <DetailValue label="Привод / установка" :value="catalogDetails.drive_type || catalogDetails.installation_place" />
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card variant="outlined" class="h-100">
                <v-card-title class="text-subtitle-1">Исходные поля каталога</v-card-title>
                <v-card-text class="attribute-grid">
                  <DetailValue v-for="entry in catalogAttributeEntries" :key="entry[0]" :label="entry[0]" :value="formatAttribute(entry[1])" />
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
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
  type NetworkRegulatorDetails,
  type NetworkRegulatorFilters,
  type NetworkRegulatorLookups,
  type NetworkRegulatorQualityStatus,
  type NetworkRegulatorSummary,
  type NetworkRegulatorType,
  type StandardRegulatorDetails,
  type StandardRegulatorFilters,
  type StandardRegulatorSummary
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
  'locate-regulator': [payload: { longitude: number; latitude: number; id: number; lineId: number | null; label: string }]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const emptyLookups = (): NetworkRegulatorLookups => ({ states: [], work_attributes: [], pipeline_signs: [], fragments: [], counts: {}, catalog_counts: {}, calculation_count: 0, result_count: 0 })
const visible = ref(false)
const detailVisible = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const error = ref('')
const activeTab = ref<'inventory' | 'catalog'>('inventory')
const inventoryPage = ref(1)
const inventoryPages = ref(0)
const catalogPage = ref(1)
const catalogPages = ref(0)
const inventory = ref<NetworkRegulatorSummary[]>([])
const catalog = ref<StandardRegulatorSummary[]>([])
const itemDetails = ref<NetworkRegulatorDetails | null>(null)
const catalogDetails = ref<StandardRegulatorDetails | null>(null)
const isEditing = ref(false)
const saving = ref(false)
const editFields = ref<Record<string, any>>({})

const getTableForType = (type: string) => {
  if (type === 'pressure') return 'pressregulators'
  if (type === 'flow') return 'consumptregulators'
  if (type === 'differential') return 'pressdropregulators'
  return ''
}

const buildFields = () => {
  const type = itemDetails.value?.regulator_type
  const fields = { assignment: [] as any[], valve: [] as any[] }
  
  if (type === 'pressure') {
    fields.assignment.push(
      { label: 'Заданная величина', key: 'h', type: 'number', value: itemDetails.value?.set_value },
      { label: 'Допустимое отклонение', key: 'deltah', type: 'number', value: itemDetails.value?.tolerance },
      { label: 'Пропускная способность Kv', key: 'regvalverelcap', type: 'number', value: itemDetails.value?.capacity },
      { label: 'Состояние', key: 'regulatorstateid', type: 'select', items: lookups.value.states, value: itemDetails.value?.state_id },
      { label: 'Режим работы', key: 'workattrid', type: 'select', items: lookups.value.work_attributes, value: itemDetails.value?.work_attribute_id },
      { label: 'Трубопровод', key: 'pipelinesignid', type: 'select', items: lookups.value.pipeline_signs, value: itemDetails.value?.pipeline_sign_id }
    )
    fields.valve.push(
      { label: 'Сопротивление, открыт', key: 'valvehydroresopen', type: 'number', value: itemDetails.value?.hydraulic_resistance_open },
      { label: 'Сопротивление, закрыт', key: 'valvehydroresclose', type: 'number', value: itemDetails.value?.hydraulic_resistance_closed },
      { label: 'Относительная утечка', key: 'relleakage', type: 'number', value: itemDetails.value?.relative_leakage },
      { label: 'Расход утечки', key: 'consdrip', type: 'number', value: itemDetails.value?.leakage_flow }
    )
  } else if (type === 'flow') {
    fields.assignment.push(
      { label: 'Заданная величина', key: 'regconsmean', type: 'number', value: itemDetails.value?.set_value },
      { label: 'Допустимое отклонение', key: 'deltah', type: 'number', value: itemDetails.value?.tolerance },
      { label: 'Пропускная способность Kv', key: 'regvalvecap', type: 'number', value: itemDetails.value?.capacity },
      { label: 'Состояние', key: 'regulatorstateid', type: 'select', items: lookups.value.states, value: itemDetails.value?.state_id },
      { label: 'Режим работы', key: 'workattrid', type: 'select', items: lookups.value.work_attributes, value: itemDetails.value?.work_attribute_id }
    )
    fields.valve.push(
      { label: 'Сопротивление, открыт', key: 'hydroresopen', type: 'number', value: itemDetails.value?.hydraulic_resistance_open },
      { label: 'Сопротивление, закрыт', key: 'hydroresclose', type: 'number', value: itemDetails.value?.hydraulic_resistance_closed },
      { label: 'Относительная утечка', key: 'relatleakage', type: 'number', value: itemDetails.value?.relative_leakage },
      { label: 'Расход утечки', key: 'plumsconsumption', type: 'number', value: itemDetails.value?.leakage_flow }
    )
  } else if (type === 'differential') {
    fields.assignment.push(
      { label: 'Заданная величина', key: 'pressdropmean', type: 'number', value: itemDetails.value?.set_value },
      { label: 'Допустимое отклонение', key: 'deltah', type: 'number', value: itemDetails.value?.tolerance },
      { label: 'Пропускная способность Kv', key: 'regvalverelcap', type: 'number', value: itemDetails.value?.capacity },
      { label: 'Состояние', key: 'regulatorstateid', type: 'select', items: lookups.value.states, value: itemDetails.value?.state_id },
      { label: 'Режим работы', key: 'workattrid', type: 'select', items: lookups.value.work_attributes, value: itemDetails.value?.work_attribute_id }
    )
    fields.valve.push(
      { label: 'Сопротивление, открыт', key: 'regvalvehydrores', type: 'number', value: itemDetails.value?.hydraulic_resistance_open },
      { label: 'Относительная утечка', key: 'maxleakageclosevalve', type: 'number', value: itemDetails.value?.relative_leakage },
      { label: 'Расход утечки', key: 'consdrip', type: 'number', value: itemDetails.value?.leakage_flow },
      { label: 'Фактический расход (исходное поле)', key: 'consthroughregvalve', type: 'number', value: itemDetails.value?.actual_flow },
      { label: 'Фактический перепад (исходное поле)', key: 'thrustdropmean', type: 'number', value: itemDetails.value?.actual_value }
    )
  }
  
  return fields
}

const startEdit = () => {
  isEditing.value = true
  editFields.value = {}
  const fields = buildFields()
  for (const field of [...fields.assignment, ...fields.valve]) {
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
    const table = getTableForType(itemDetails.value.regulator_type)
    if (!table) throw new Error('Неизвестный тип регулятора')
    
    const processedFields: Record<string, any> = {}
    for (const key in editFields.value) {
      if (editFields.value[key] === '') processedFields[key] = null
      else processedFields[key] = editFields.value[key]
    }
    
    await fastApiService.updateObjectAttributes(table, itemDetails.value.id, processedFields)
    
    await openItemDetails(itemDetails.value.regulator_type, itemDetails.value.id)
    isEditing.value = false
    await loadInventory()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Ошибка при сохранении'
  } finally {
    saving.value = false
  }
}
const lookups = ref<NetworkRegulatorLookups>(emptyLookups())
const filters = ref<NetworkRegulatorFilters>({})
const catalogFilters = ref<StandardRegulatorFilters>({})

const typeOptions = [
  { title: 'Регулятор давления', value: 'pressure' },
  { title: 'Регулятор расхода', value: 'flow' },
  { title: 'Регулятор перепада', value: 'differential' }
]
const qualityOptions = [
  { title: 'Готово', value: 'ready' },
  { title: 'Нет линии', value: 'line_missing' },
  { title: 'Линия удалена', value: 'line_removed' },
  { title: 'Нет регулируемого узла', value: 'control_node_missing' },
  { title: 'Не задана величина', value: 'setpoint_missing' },
  { title: 'Не задан Kv', value: 'capacity_missing' }
]
const catalogQualityOptions = [{ title: 'Полный паспорт', value: 'ready' }, { title: 'Неполный паспорт', value: 'incomplete' }]
const qualityMetrics: Array<{ value: NetworkRegulatorQualityStatus; label: string; color: string }> = [
  { value: 'ready', label: 'Готовы', color: 'green' },
  { value: 'line_missing', label: 'Нет линии', color: 'red' },
  { value: 'line_removed', label: 'Удалённая линия', color: 'grey' },
  { value: 'control_node_missing', label: 'Нет узла', color: 'orange' },
  { value: 'setpoint_missing', label: 'Нет задания', color: 'amber-darken-3' },
  { value: 'capacity_missing', label: 'Нет Kv', color: 'brown' }
]
const detailTitle = computed(() => itemDetails.value?.display_name || catalogDetails.value?.display_name || 'Паспорт регулятора')
const catalogAttributeEntries = computed(() => Object.entries(catalogDetails.value?.attributes || {}).filter(([, value]) => value !== null && value !== ''))

const loadLookups = async () => {
  if (!lookups.value.counts.total) lookups.value = await fastApiService.getNetworkRegulatorLookups()
}
const loadInventory = async () => {
  loading.value = true; error.value = ''
  try {
    const response = await fastApiService.getNetworkRegulators({ ...filters.value, page: inventoryPage.value, page_size: 50 })
    inventory.value = response.items; inventoryPages.value = response.pages
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить регуляторы' } finally { loading.value = false }
}
const loadCatalog = async () => {
  loading.value = true; error.value = ''
  try {
    const response = await fastApiService.getRegulatorCatalog({ ...catalogFilters.value, page: catalogPage.value, page_size: 50 })
    catalog.value = response.items; catalogPages.value = response.pages
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить каталог регуляторов' } finally { loading.value = false }
}
const reloadInventory = () => { inventoryPage.value = 1; void loadInventory() }
const reloadCatalog = () => { catalogPage.value = 1; void loadCatalog() }
const onTabChange = (tab: unknown) => {
  if (tab === 'catalog' && !catalog.value.length) void loadCatalog()
  if (tab === 'inventory' && !inventory.value.length) void loadInventory()
}
const setQualityStatus = (status: NetworkRegulatorQualityStatus) => {
  filters.value.quality_status = filters.value.quality_status === status ? undefined : status
  reloadInventory()
}
const openItemDetails = async (regulatorType: NetworkRegulatorType, regulatorId: number) => {
  detailVisible.value = true; detailLoading.value = true; itemDetails.value = null; catalogDetails.value = null; isEditing.value = false
  try { itemDetails.value = await fastApiService.getNetworkRegulator(regulatorType, regulatorId) } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось открыть карточку регулятора'; detailVisible.value = false } finally { detailLoading.value = false }
}
const openCatalogDetails = async (catalogType: NetworkRegulatorType, catalogId: number) => {
  detailVisible.value = true; detailLoading.value = true; itemDetails.value = null; catalogDetails.value = null; isEditing.value = false
  try { catalogDetails.value = await fastApiService.getRegulatorCatalogItem(catalogType, catalogId) } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось открыть паспорт регулятора'; detailVisible.value = false } finally { detailLoading.value = false }
}
const openDialog = async (scope: { regulatorType?: NetworkRegulatorType; regulatorId?: number; catalogType?: NetworkRegulatorType; catalogId?: number; lineId?: number } = {}) => {
  visible.value = true
  await loadLookups()
  if (scope.catalogType && scope.catalogId) {
    activeTab.value = 'catalog'; catalogFilters.value = { catalog_type: scope.catalogType }; catalogPage.value = 1; await loadCatalog(); await openCatalogDetails(scope.catalogType, scope.catalogId); return
  }
  activeTab.value = 'inventory'; filters.value = { regulator_type: scope.regulatorType, line_id: scope.lineId }; inventoryPage.value = 1; await loadInventory()
  if (scope.regulatorType && scope.regulatorId) await openItemDetails(scope.regulatorType, scope.regulatorId)
}

const hasCoordinates = (item: NetworkRegulatorSummary) => item.longitude !== null && item.latitude !== null && Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))
const locate = (item: NetworkRegulatorSummary) => emit('locate-regulator', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, lineId: item.line_id, label: item.display_name })
const typeLabel = (type: NetworkRegulatorType) => ({ pressure: 'Регулятор давления', flow: 'Регулятор расхода', differential: 'Регулятор перепада' })[type]
const requiresControlNode = (type: NetworkRegulatorType) => type !== 'flow'
const qualityLabel = (status: NetworkRegulatorQualityStatus) => ({ ready: 'готово', line_missing: 'нет линии', line_removed: 'линия удалена', control_node_missing: 'нет регулируемого узла', setpoint_missing: 'нет задания', capacity_missing: 'нет Kv' })[status]
const qualityColor = (status: NetworkRegulatorQualityStatus) => ({ ready: 'green', line_missing: 'red', line_removed: 'grey', control_node_missing: 'orange', setpoint_missing: 'amber-darken-3', capacity_missing: 'brown' })[status]
const qualityDescription = (status: NetworkRegulatorQualityStatus) => ({ ready: '', line_missing: 'Связанная линия отсутствует: сетевой контекст и позиционирование недоступны.', line_removed: 'Связанная линия помечена удалённой и исключена из активной расчётной схемы.', control_node_missing: 'Для регулятора давления или перепада не выбран узел, в котором поддерживается заданная величина.', setpoint_missing: 'Заданная величина равна нулю или отсутствует.', capacity_missing: 'Пропускная способность клапана Kv равна нулю или отсутствует.' })[status]
const stateColor = (state: string | null) => state?.toLowerCase() === 'открыт' ? 'green' : state?.toLowerCase() === 'закрыт' ? 'grey' : 'blue-grey'
const nodeLabel = (code: string | null, name: string | null, id: number | null) => [code, name].filter(Boolean).join(' ') || (id ? `№${id}` : '—')
const formatNumber = (value: unknown, digits = 2) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatUnit = (value: unknown, unit: string) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : `${formatNumber(value, 3)} ${unit}`
const formatTarget = (type: NetworkRegulatorType, value: unknown) => formatUnit(value, type === 'flow' ? 'т/ч' : 'м')
const pressureRange = (item: Pick<StandardRegulatorSummary, 'pressure_min' | 'pressure_max'>) => item.pressure_min === null && item.pressure_max === null ? '—' : `${formatNumber(item.pressure_min)} – ${formatNumber(item.pressure_max)}`
const formatAttribute = (value: unknown) => typeof value === 'number' ? formatNumber(value, 4) : String(value ?? '—')
const outputValue = (key: string) => itemDetails.value?.latest_output?.[key] as string | number | null | undefined

defineExpose({ openDialog })
</script>

<style scoped>
.alerts{display:grid;gap:8px}.metric-row,.filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.filters>*{min-width:180px;flex:1}.filters .v-btn{flex:0 0 auto}.table-wrap{overflow:auto;min-height:330px}.catalog-table-wrap{min-height:260px}.journal-table{width:100%;border-collapse:collapse;font-size:13px}.journal-table th,.journal-table td{padding:9px 10px;border-bottom:1px solid #e0e0e0;text-align:left;white-space:nowrap}.journal-table th{position:sticky;top:0;background:#e8eaf6;z-index:1}.journal-table tbody tr{cursor:pointer}.journal-table tbody tr:hover{background:#f5f6fb}.muted{font-size:11px;color:#757575}.empty{text-align:center;color:#757575;padding:32px}.journal-error{margin:0 12px 12px;padding:10px 12px;border-radius:4px;background:#ffebee;color:#b71c1c}.detail-grid,.attribute-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}:deep(.detail-value){display:flex;flex-direction:column;min-width:0}:deep(.detail-label){font-size:11px;color:#757575}:deep(.detail-value strong){overflow-wrap:anywhere}
@media(max-width:960px){.filters{display:grid;grid-template-columns:1fr}.filters>*{width:100%}.detail-grid,.attribute-grid{grid-template-columns:1fr}}
</style>
