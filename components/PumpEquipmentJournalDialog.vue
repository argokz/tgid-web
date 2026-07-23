<template>
  <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1580" scrollable>
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="blue-grey-darken-3" density="compact">
        <v-icon class="ml-3 mr-2">mdi-pump</v-icon>
        <v-toolbar-title>Насосное оборудование</v-toolbar-title>
        <v-chip class="mr-2" size="small" color="white" variant="outlined">
          {{ lookups.counts.configured || 0 }}/{{ lookups.counts.total || 0 }} настроено
        </v-chip>
        <v-btn icon="mdi-close" aria-label="Закрыть" @click="visible = false" />
      </v-toolbar>

      <v-alert
        v-if="lookups.result_count === 0"
        type="info"
        variant="tonal"
        density="compact"
        class="ma-3 mb-0"
      >
        Результаты гидравлического расчёта <code>NS_OUT</code> отсутствуют. Рабочая точка появится после выполнения и сохранения расчёта сети; паспортные характеристики доступны уже сейчас.
      </v-alert>

      <v-tabs v-model="activeTab" color="blue-grey-darken-3" class="px-3 mt-2" @update:model-value="onTabChange">
        <v-tab value="installed">Установленные агрегаты ({{ lookups.counts.total || 0 }})</v-tab>
        <v-tab value="catalog">Каталог моделей ({{ lookups.catalog_counts.total || 0 }})</v-tab>
      </v-tabs>

      <v-window v-model="activeTab">
        <v-window-item value="installed">
          <div class="metric-row pa-3 pb-0">
            <v-chip
              v-for="metric in configurationMetrics"
              :key="metric.value"
              :color="metric.color"
              :variant="installedFilters.configuration_status === metric.value ? 'flat' : 'tonal'"
              @click="setConfigurationStatus(metric.value)"
            >
              {{ metric.label }}: {{ lookups.counts[metric.value] || 0 }}
            </v-chip>
          </div>
          <div class="filters pa-3">
            <v-text-field
              v-model="installedFilters.search"
              label="Насос, модель, станция, линия или ID"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              variant="outlined"
              clearable
              hide-details
              @keyup.enter="reloadInstalled"
            />
            <v-select
              v-model="installedFilters.configuration_status"
              :items="configurationOptions"
              label="Готовность характеристики"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-select
              v-model="installedFilters.state_id"
              :items="lookups.states"
              item-title="name"
              item-value="id"
              label="Состояние"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-select
              v-model="installedFilters.fragment_id"
              :items="lookups.fragments"
              item-title="name"
              item-value="id"
              label="Фрагмент"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-btn color="blue-grey-darken-3" :loading="loading" @click="reloadInstalled">Найти</v-btn>
          </div>

          <JournalError :message="error" />
          <div class="table-wrap">
            <table class="journal-table">
              <thead>
                <tr><th>ID</th><th>Линия</th><th>№ / станция</th><th>Модель</th><th>Режим</th><th>Состояние</th><th>Фрагмент</th><th>Готовность</th><th /></tr>
              </thead>
              <tbody>
                <tr v-for="item in installed" :key="item.id" @click="openInstalledDetails(item.id)">
                  <td>{{ item.id }}</td>
                  <td>{{ item.line_id ?? '—' }}<div class="muted">узлы {{ item.node_id_1 ?? '—' }} → {{ item.node_id_2 ?? '—' }}</div></td>
                  <td><strong>{{ item.number || `Насос №${item.id}` }}</strong><div class="muted">{{ item.station_name || 'станция не указана' }}</div></td>
                  <td>{{ item.model_name || item.model_type || 'не выбрана' }}</td>
                  <td>{{ item.parallel_count || '—' }} шт.<div class="muted">{{ item.drive_type_name || 'привод не задан' }}</div></td>
                  <td><v-chip size="x-small" :color="stateColor(item.state_name)">{{ item.state_name || '—' }}</v-chip></td>
                  <td>{{ item.fragment_name || `№${item.fragment_id || '—'}` }}</td>
                  <td><v-chip size="x-small" :color="configurationColor(item.configuration_status)">{{ configurationLabel(item.configuration_status) }}</v-chip></td>
                  <td>
                    <v-btn
                      v-if="hasCoordinates(item)"
                      icon="mdi-map-marker"
                      size="x-small"
                      variant="text"
                      aria-label="Показать насос на карте"
                      @click.stop="locate(item)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="!loading && !installed.length" class="empty">Насосы не найдены</div>
            <v-progress-linear v-if="loading" indeterminate color="blue-grey-darken-3" />
          </div>
          <v-pagination v-if="installedPages > 1" v-model="installedPage" :length="installedPages" density="comfortable" @update:model-value="loadInstalled" />
        </v-window-item>

        <v-window-item value="catalog">
          <div class="metric-row pa-3 pb-0">
            <v-chip
              v-for="metric in catalogMetrics"
              :key="metric.value"
              :color="metric.color"
              :variant="catalogFilters.quality_status === metric.value ? 'flat' : 'tonal'"
              @click="setCatalogStatus(metric.value)"
            >
              {{ metric.label }}: {{ lookups.catalog_counts[metric.value] || 0 }}
            </v-chip>
          </div>
          <div class="filters pa-3">
            <v-text-field
              v-model="catalogFilters.search"
              label="Модель, тип, изготовитель или ID"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              variant="outlined"
              clearable
              hide-details
              @keyup.enter="reloadCatalog"
            />
            <v-select
              v-model="catalogFilters.quality_status"
              :items="catalogStatusOptions"
              label="Качество характеристики"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-select
              v-model="catalogFilters.pump_type"
              :items="lookups.pump_types"
              item-title="name"
              item-value="name"
              label="Тип насоса"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-btn color="blue-grey-darken-3" :loading="loading" @click="reloadCatalog">Найти</v-btn>
          </div>

          <JournalError :message="error" />
          <div class="table-wrap">
            <table class="journal-table">
              <thead>
                <tr><th>ID</th><th>Модель</th><th>Тип</th><th>Рабочая зона Q</th><th>Номинал Q / H</th><th>Колесо / частота</th><th>Точки</th><th>Используется</th><th>Качество</th></tr>
              </thead>
              <tbody>
                <tr v-for="item in catalog" :key="item.id" @click="openCatalogDetails(item.id)">
                  <td>{{ item.id }}</td>
                  <td><strong>{{ item.name || '—' }}</strong><div class="muted">{{ item.producer || 'изготовитель не указан' }}</div></td>
                  <td>{{ item.pump_type || '—' }}</td>
                  <td>{{ formatNumber(item.min_flow) }} … {{ formatNumber(item.max_flow) }} т/ч</td>
                  <td>{{ formatNumber(item.nominal_flow) }} т/ч / {{ formatNumber(item.nominal_head) }} м</td>
                  <td>{{ formatNumber(item.nominal_rotor_diameter) }} мм / {{ formatNumber(item.nominal_rotation_speed) }} об/мин</td>
                  <td>{{ item.point_count }}/10</td>
                  <td>{{ item.installed_count }}</td>
                  <td><v-chip size="x-small" :color="catalogStatusColor(item.quality_status)">{{ catalogStatusLabel(item.quality_status) }}</v-chip></td>
                </tr>
              </tbody>
            </table>
            <div v-if="!loading && !catalog.length" class="empty">Модели не найдены</div>
            <v-progress-linear v-if="loading" indeterminate color="blue-grey-darken-3" />
          </div>
          <v-pagination v-if="catalogPages > 1" v-model="catalogPage" :length="catalogPages" density="comfortable" @update:model-value="loadCatalog" />
        </v-window-item>
      </v-window>
    </v-card>
  </v-dialog>

  <v-dialog v-model="detailVisible" :fullscreen="isMobile" max-width="1480" scrollable>
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="blue-grey-darken-3" density="compact">
        <v-btn icon="mdi-arrow-left" aria-label="Вернуться к журналу" @click="detailVisible = false" />
        <v-toolbar-title>{{ detailTitle }}</v-toolbar-title>
        <v-chip v-if="modelDetails" class="mr-2" size="small" color="white" variant="outlined">{{ modelDetails.pump_type || 'тип не задан' }}</v-chip>
        <v-btn icon="mdi-close" aria-label="Закрыть карточку" @click="detailVisible = false" />
      </v-toolbar>
      <v-progress-linear v-if="detailLoading" indeterminate color="blue-grey-darken-3" />

      <template v-if="modelDetails && !detailLoading">
        <div class="detail-alerts pa-3 pb-0">
          <v-alert v-if="installedDetails?.configuration_status === 'missing_model'" type="warning" variant="tonal" density="compact">Для агрегата не выбрана паспортная модель. В desktop TGID это делается через «Тип насоса → Характеристики».</v-alert>
          <v-alert v-if="modelDetails.quality_status === 'non_monotonic'" type="warning" variant="tonal" density="compact">Расход в паспортных точках расположен не по возрастанию. Точки показаны в исходном порядке и требуют проверки справочника.</v-alert>
          <v-alert v-if="modelDetails.quality_status === 'incomplete'" type="error" variant="tonal" density="compact">Паспортная характеристика или рабочая зона заполнена не полностью.</v-alert>
        </div>

        <v-row class="ma-0 pa-3">
          <v-col cols="12" md="4">
            <v-card v-if="installedDetails" variant="outlined" class="mb-3">
              <v-card-title class="text-subtitle-1">Установленный агрегат</v-card-title>
              <v-card-text class="detail-grid" v-if="!isEditing">
                <DetailValue label="ID / линия" :value="`${installedDetails.id} / ${installedDetails.line_id ?? '—'}`" />
                <DetailValue label="Номер / станция" :value="[installedDetails.number, installedDetails.station_name].filter(Boolean).join(' / ')" />
                <DetailValue label="Состояние" :value="installedDetails.state_name" />
                <DetailValue label="Параллельно" :value="installedDetails.parallel_count ? `${installedDetails.parallel_count} шт.` : null" />
                <DetailValue label="Привод" :value="installedDetails.drive_type_name" />
                <DetailValue label="Рабочее колесо" :value="installedDetails.rotor_diameter_type_name" />
                <DetailValue label="Заданная частота" :value="formatUnit(installedDetails.configured_rotation_speed, 'об/мин')" />
                <DetailValue label="Заданный диаметр" :value="formatUnit(installedDetails.configured_rotor_diameter, 'мм')" />
                <DetailValue label="Электродвигатель" :value="installedDetails.motor_name" />
                <DetailValue label="Фрагмент" :value="installedDetails.fragment_name" />
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
              <v-divider v-if="isEditing" />
              <v-card-actions class="px-4 py-3 bg-grey-lighten-4" v-if="isEditing">
                <v-spacer />
                <v-btn v-if="mutationsEnabled" color="error" variant="text" @click="cancelEdit" :disabled="saving">Отмена</v-btn>
                <v-btn v-if="mutationsEnabled" color="primary" variant="flat" @click="saveChanges" :loading="saving">Сохранить</v-btn>
              </v-card-actions>
            </v-card>

            <v-card variant="outlined" class="mb-3">
              <v-card-title class="text-subtitle-1">Паспорт модели</v-card-title>
              <v-card-text class="detail-grid">
                <DetailValue label="ID / наименование" :value="`${modelDetails.id} / ${modelDetails.name || '—'}`" />
                <DetailValue label="Изготовитель" :value="modelDetails.producer" />
                <DetailValue label="Рабочая зона Q" :value="`${formatNumber(modelDetails.min_flow)} … ${formatNumber(modelDetails.max_flow)} т/ч`" />
                <DetailValue label="Номинальный Q / H" :value="`${formatNumber(modelDetails.nominal_flow)} т/ч / ${formatNumber(modelDetails.nominal_head)} м`" />
                <DetailValue label="Номинальный КПД" :value="formatUnit(modelDetails.nominal_efficiency, '%')" />
                <DetailValue label="Колесо" :value="formatUnit(modelDetails.nominal_rotor_diameter, 'мм')" />
                <DetailValue label="Частота" :value="formatUnit(modelDetails.nominal_rotation_speed, 'об/мин')" />
                <DetailValue label="Макс. температура" :value="formatUnit(modelDetails.max_temperature, '°C')" />
              </v-card-text>
            </v-card>

            <v-card v-if="installedDetails" variant="outlined" class="mb-3">
              <v-card-title class="text-subtitle-1">Коэффициенты y = a₀ + a₁Q + a₂Q²</v-card-title>
              <div class="coefficient-wrap">
                <table class="journal-table coefficient-table">
                  <thead><tr><th>Кривая</th><th>a₀</th><th>a₁</th><th>a₂</th></tr></thead>
                  <tbody>
                    <tr v-for="row in coefficientRows" :key="row.label"><td>{{ row.label }}</td><td>{{ formatNumber(row.a0, 6) }}</td><td>{{ formatNumber(row.a1, 6) }}</td><td>{{ formatNumber(row.a2, 6) }}</td></tr>
                  </tbody>
                </table>
              </div>
            </v-card>

            <v-alert v-if="installedDetails && !installedDetails.latest_output" type="info" variant="tonal" density="compact">Рабочая точка пока не рассчитана.</v-alert>
            <v-card v-else-if="installedDetails?.latest_output" variant="outlined">
              <v-card-title class="text-subtitle-1">Последняя рабочая точка</v-card-title>
              <v-card-text class="detail-grid">
                <DetailValue label="Расход" :value="formatUnit(outputValue('working_flow'), 'т/ч')" />
                <DetailValue label="Напор" :value="formatUnit(outputValue('working_head'), 'м')" />
                <DetailValue label="Пьезометрический напор вход" :value="formatUnit(outputValue('inlet_piezometric_head'), 'м')" />
                <DetailValue label="Пьезометрический напор выход" :value="formatUnit(outputValue('outlet_piezometric_head'), 'м')" />
                <DetailValue label="Работающих насосов" :value="outputValue('working_pump_count')" />
                <DetailValue label="Режим" :value="outputValue('operation_status')" />
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="8">
            <div v-if="installedDetails && !isEditing" class="mb-3 d-flex justify-end gap-2">
              <v-btn v-if="hasCoordinates(installedDetails)" color="blue-grey-darken-3" variant="text" prepend-icon="mdi-map-marker" @click="locate(installedDetails)">На карте</v-btn>
              <v-btn v-if="mutationsEnabled" color="primary" variant="flat" prepend-icon="mdi-pencil" @click="startEdit">Редактировать</v-btn>
            </div>
            <v-card variant="outlined" class="mb-3">
              <v-card-title class="text-subtitle-1">Характеристики H(Q), N(Q), КПД(Q)</v-card-title>
              <v-card-text class="chart-wrap"><VChart class="chart" :option="chartOptions" autoresize /></v-card-text>
            </v-card>
            <v-card variant="outlined">
              <v-card-title class="text-subtitle-1">Паспортные точки</v-card-title>
              <div class="points-wrap">
                <table class="journal-table points-table">
                  <thead><tr><th>№</th><th>Q, т/ч</th><th>H, м</th><th>N, кВт</th><th>КПД, %</th><th>Рабочая зона</th></tr></thead>
                  <tbody>
                    <tr v-for="point in modelDetails.points" :key="point.index">
                      <td>{{ point.index }}</td><td>{{ formatNumber(point.flow, 3) }}</td><td>{{ formatNumber(point.head, 3) }}</td><td>{{ formatNumber(point.power, 3) }}</td><td>{{ formatNumber(point.efficiency, 3) }}</td><td>{{ pointInWorkingZone(point) ? 'да' : 'нет' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </v-card>
            <v-card v-if="!installedDetails && modelDetails.installed_pumps?.length" variant="outlined" class="mt-3">
              <v-card-title class="text-subtitle-1">Установленные агрегаты ({{ modelDetails.installed_pumps.length }})</v-card-title>
              <v-card-text>
                <v-chip v-for="pump in modelDetails.installed_pumps" :key="pump.id" class="mr-2 mb-2" @click="openInstalledDetails(pump.id)">Насос {{ pump.id }} · линия {{ pump.line_id ?? '—' }}</v-chip>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </template>

      <div v-else-if="installedDetails && !modelDetails && !detailLoading" class="pa-3">
        <v-alert type="warning" variant="tonal" class="mb-3">График построить нельзя: паспортная модель не выбрана.</v-alert>
        <v-card variant="outlined">
          <v-card-title class="text-subtitle-1">Установленный агрегат</v-card-title>
          <v-card-text class="detail-grid">
            <DetailValue label="ID / линия" :value="`${installedDetails.id} / ${installedDetails.line_id ?? '—'}`" />
            <DetailValue label="Номер / станция" :value="installedDetails.number || installedDetails.station_name" />
            <DetailValue label="Состояние" :value="installedDetails.state_name" />
            <DetailValue label="Параллельно" :value="installedDetails.parallel_count ? `${installedDetails.parallel_count} шт.` : null" />
            <DetailValue label="Привод" :value="installedDetails.drive_type_name" />
            <DetailValue label="Рабочее колесо" :value="installedDetails.rotor_diameter_type_name" />
            <DetailValue label="Фрагмент" :value="installedDetails.fragment_name" />
            <DetailValue label="Готовность" :value="configurationLabel(installedDetails.configuration_status)" />
          </v-card-text>
        </v-card>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, type PropType } from 'vue'
import { use } from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import { DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import {
  fastApiService,
  type InstalledPumpDetails,
  type InstalledPumpFilters,
  type InstalledPumpSummary,
  type PumpCatalogFilters,
  type PumpCatalogStatus,
  type PumpConfigurationStatus,
  type PumpCurvePoint,
  type PumpEquipmentLookups,
  type StandardPumpDetails,
  type StandardPumpSummary
} from '~/services/fastApiService'

use([CanvasRenderer, LineChart, ScatterChart, DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, TooltipComponent])

const DetailValue = defineComponent({
  props: { label: { type: String, required: true }, value: { type: [String, Number] as PropType<string | number | null | undefined>, default: null } },
  setup: props => () => h('div', { class: 'detail-value' }, [h('span', { class: 'detail-label' }, props.label), h('strong', String(props.value ?? '—'))])
})
const JournalError = defineComponent({
  props: { message: { type: String, default: '' } },
  setup: props => () => props.message ? h('div', { class: 'journal-error' }, props.message) : null
})

const emit = defineEmits<{
  'locate-pump': [payload: { longitude: number; latitude: number; id: number; lineId: number | null; label: string }]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const emptyLookups = (): PumpEquipmentLookups => ({ states: [], drive_types: [], rotor_diameter_types: [], fragments: [], pump_types: [], counts: {}, catalog_counts: {}, calculation_count: 0, result_count: 0 })
const visible = ref(false)
const detailVisible = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const error = ref('')
const activeTab = ref<'installed' | 'catalog'>('installed')
const installedPage = ref(1)
const installedPages = ref(0)
const catalogPage = ref(1)
const catalogPages = ref(0)
const installed = ref<InstalledPumpSummary[]>([])
const catalog = ref<StandardPumpSummary[]>([])
const installedDetails = ref<InstalledPumpDetails | null>(null)
const catalogDetails = ref<StandardPumpDetails | null>(null)
const lookups = ref<PumpEquipmentLookups>(emptyLookups())
const installedFilters = ref<InstalledPumpFilters>({})
const catalogFilters = ref<PumpCatalogFilters>({})
const isEditing = ref(false)
const saving = ref(false)
const editFields = ref<Record<string, any>>({})

const buildFields = () => {
  return [
    { label: 'Номер', key: 'number', type: 'text', value: installedDetails.value?.number },
    { label: 'Станция', key: 'pumpstationid', type: 'text', value: installedDetails.value?.station_name },
    { label: 'Состояние', key: 'stateid', type: 'select', items: lookups.value.states, value: installedDetails.value?.state_id },
    { label: 'Параллельно (шт.)', key: 'parallagregcount', type: 'number', value: installedDetails.value?.parallel_count },
    { label: 'Привод', key: 'drivetypeid', type: 'select', items: lookups.value.drive_types, value: installedDetails.value?.drive_type_id },
    { label: 'Рабочее колесо', key: 'rotordiametertypeid', type: 'select', items: lookups.value.rotor_diameter_types, value: installedDetails.value?.rotor_diameter_type_id },
    { label: 'Заданная частота', key: 'rotorrotspeedset', type: 'number', value: installedDetails.value?.configured_rotation_speed },
    { label: 'Заданный диаметр', key: 'rotordiameterset', type: 'number', value: installedDetails.value?.configured_rotor_diameter }
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
  if (!installedDetails.value) return
  saving.value = true
  try {
    const processedFields: Record<string, any> = {}
    for (const key in editFields.value) {
      if (editFields.value[key] === '') processedFields[key] = null
      else processedFields[key] = editFields.value[key]
    }
    
    await fastApiService.updateObjectAttributes('pumps', installedDetails.value.id, processedFields)
    
    await openInstalledDetails(installedDetails.value.id)
    isEditing.value = false
    await loadInstalled()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Ошибка при сохранении'
  } finally {
    saving.value = false
  }
}

const configurationOptions = [
  { title: 'Настроен', value: 'configured' }, { title: 'Модель не выбрана', value: 'missing_model' },
  { title: 'Нет коэффициентов', value: 'coefficients_missing' }, { title: 'Нет линии', value: 'line_missing' }
]
const catalogStatusOptions = [
  { title: 'Готов', value: 'ready' }, { title: 'Немонотонный Q', value: 'non_monotonic' }, { title: 'Неполный', value: 'incomplete' }
]
const configurationMetrics: Array<{ value: PumpConfigurationStatus; label: string; color: string }> = [
  { value: 'configured', label: 'Настроены', color: 'green' },
  { value: 'missing_model', label: 'Без модели', color: 'orange' },
  { value: 'coefficients_missing', label: 'Без коэффициентов', color: 'amber-darken-3' },
  { value: 'line_missing', label: 'Нет линии', color: 'red' }
]
const catalogMetrics: Array<{ value: PumpCatalogStatus; label: string; color: string }> = [
  { value: 'ready', label: 'Готовы', color: 'green' },
  { value: 'non_monotonic', label: 'Порядок Q', color: 'orange' },
  { value: 'incomplete', label: 'Неполные', color: 'red' }
]

const modelDetails = computed(() => installedDetails.value?.standard_pump || catalogDetails.value)
const detailTitle = computed(() => installedDetails.value
  ? `${installedDetails.value.number || `Насос №${installedDetails.value.id}`} · ${modelDetails.value?.name || modelDetails.value?.pump_type || 'модель не выбрана'}`
  : modelDetails.value?.name || modelDetails.value?.pump_type || 'Паспорт насоса')

const coefficientRows = computed(() => {
  const attrs = installedDetails.value?.attributes || {}
  return [
    { label: 'H(Q), ном.', a0: attrs.r0, a1: attrs.r1, a2: attrs.r2 },
    { label: 'H(Q), привед.', a0: attrs.r0_z, a1: attrs.r1_z, a2: attrs.r2_z },
    { label: 'N(Q), ном.', a0: attrs.e0, a1: attrs.e1, a2: attrs.e2 },
    { label: 'N(Q), привед.', a0: attrs.e0_z, a1: attrs.e1_z, a2: attrs.e2_z },
    { label: 'КПД(Q), ном.', a0: attrs.k0, a1: attrs.k1, a2: attrs.k2 },
    { label: 'КПД(Q), привед.', a0: attrs.k0_z, a1: attrs.k1_z, a2: attrs.k2_z }
  ]
})

const adjustedCurve = (prefix: 'r' | 'e' | 'k') => {
  const attrs = installedDetails.value?.attributes || {}
  const a0 = Number(attrs[`${prefix}0_z`])
  const a1 = Number(attrs[`${prefix}1_z`])
  const a2 = Number(attrs[`${prefix}2_z`])
  if (![a0, a1, a2].some(value => Number.isFinite(value) && value !== 0)) return []
  const points = modelDetails.value?.points.filter(point => Number.isFinite(Number(point.flow))) || []
  const pointFlows = points.map(point => Number(point.flow))
  const min = Number(modelDetails.value?.min_flow ?? Math.min(...pointFlows))
  const max = Number(modelDetails.value?.max_flow ?? Math.max(...pointFlows))
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return []
  return Array.from({ length: 41 }, (_, index) => {
    const flow = min + (max - min) * index / 40
    return [flow, a0 + a1 * flow + a2 * flow * flow]
  })
}

const chartOptions = computed(() => {
  const model = modelDetails.value
  const points = model?.points.filter(point => point.flow !== null) || []
  const workingFlow = Number(installedDetails.value?.latest_output?.working_flow)
  const workingHead = Number(installedDetails.value?.latest_output?.working_head)
  const series: Array<Record<string, unknown>> = [
    { name: 'H паспорт', type: 'line', yAxisIndex: 0, data: points.map(point => [point.flow, point.head]), symbolSize: 6, lineStyle: { width: 2 }, itemStyle: { color: '#1565c0' }, markArea: model?.has_valid_working_zone ? { silent: true, itemStyle: { color: 'rgba(255, 152, 0, .12)' }, data: [[{ xAxis: model.min_flow, name: 'рабочая зона' }, { xAxis: model.max_flow }]] } : undefined },
    { name: 'N паспорт', type: 'line', yAxisIndex: 1, data: points.map(point => [point.flow, point.power]), symbolSize: 5, lineStyle: { width: 2 }, itemStyle: { color: '#ef6c00' } },
    { name: 'КПД паспорт', type: 'line', yAxisIndex: 2, data: points.map(point => [point.flow, point.efficiency]), symbolSize: 5, lineStyle: { width: 2 }, itemStyle: { color: '#2e7d32' } }
  ]
  const adjusted = [
    { name: 'H приведённая', axis: 0, data: adjustedCurve('r'), color: '#42a5f5' },
    { name: 'N приведённая', axis: 1, data: adjustedCurve('e'), color: '#ffb74d' },
    { name: 'КПД приведённый', axis: 2, data: adjustedCurve('k'), color: '#66bb6a' }
  ]
  adjusted.filter(item => item.data.length).forEach(item => series.push({ name: item.name, type: 'line', yAxisIndex: item.axis, data: item.data, showSymbol: false, lineStyle: { width: 2, type: 'dashed', color: item.color } }))
  if (Number.isFinite(workingFlow) && Number.isFinite(workingHead)) series.push({ name: 'Рабочая точка', type: 'scatter', yAxisIndex: 0, data: [[workingFlow, workingHead]], symbolSize: 13, itemStyle: { color: '#d32f2f' } })
  return {
    tooltip: { trigger: 'axis' }, legend: { type: 'scroll' },
    grid: { left: 65, right: 145, top: 55, bottom: 80 },
    xAxis: { type: 'value', name: 'Q, т/ч', nameLocation: 'middle', nameGap: 32, min: 0 },
    yAxis: [
      { type: 'value', name: 'H, м', position: 'left', axisLine: { show: true, lineStyle: { color: '#1565c0' } } },
      { type: 'value', name: 'N, кВт', position: 'right', axisLine: { show: true, lineStyle: { color: '#ef6c00' } } },
      { type: 'value', name: 'КПД, %', position: 'right', offset: 70, axisLine: { show: true, lineStyle: { color: '#2e7d32' } }, min: 0 }
    ],
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 18 }], series
  }
})

const loadLookups = async () => {
  if (!lookups.value.counts.total) lookups.value = await fastApiService.getPumpEquipmentLookups()
}
const loadInstalled = async () => {
  loading.value = true; error.value = ''
  try {
    const response = await fastApiService.getInstalledPumps({ ...installedFilters.value, page: installedPage.value, page_size: 50 })
    installed.value = response.items; installedPages.value = response.pages
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить насосы' } finally { loading.value = false }
}
const loadCatalog = async () => {
  loading.value = true; error.value = ''
  try {
    const response = await fastApiService.getPumpCatalog({ ...catalogFilters.value, page: catalogPage.value, page_size: 50 })
    catalog.value = response.items; catalogPages.value = response.pages
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить каталог насосов' } finally { loading.value = false }
}
const reloadInstalled = () => { installedPage.value = 1; void loadInstalled() }
const reloadCatalog = () => { catalogPage.value = 1; void loadCatalog() }
const onTabChange = (tab: unknown) => {
  if (tab === 'catalog' && !catalog.value.length) void loadCatalog()
  if (tab === 'installed' && !installed.value.length) void loadInstalled()
}
const setConfigurationStatus = (status: PumpConfigurationStatus) => { installedFilters.value.configuration_status = installedFilters.value.configuration_status === status ? undefined : status; reloadInstalled() }
const setCatalogStatus = (status: PumpCatalogStatus) => { catalogFilters.value.quality_status = catalogFilters.value.quality_status === status ? undefined : status; reloadCatalog() }

const openInstalledDetails = async (pumpId: number) => {
  detailVisible.value = true; detailLoading.value = true; installedDetails.value = null; catalogDetails.value = null; isEditing.value = false
  try { installedDetails.value = await fastApiService.getInstalledPump(pumpId) } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось открыть насос'; detailVisible.value = false } finally { detailLoading.value = false }
}
const openCatalogDetails = async (standardPumpId: number) => {
  detailVisible.value = true; detailLoading.value = true; installedDetails.value = null; catalogDetails.value = null; isEditing.value = false
  try { catalogDetails.value = await fastApiService.getStandardPump(standardPumpId) } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось открыть модель'; detailVisible.value = false } finally { detailLoading.value = false }
}
const openDialog = async (scope: { pumpId?: number; standardPumpId?: number; lineId?: number } = {}) => {
  visible.value = true
  await loadLookups()
  if (scope.standardPumpId) {
    activeTab.value = 'catalog'; catalogFilters.value = {}; catalogPage.value = 1; await loadCatalog(); await openCatalogDetails(scope.standardPumpId); return
  }
  activeTab.value = 'installed'; installedFilters.value = { line_id: scope.lineId }; installedPage.value = 1; await loadInstalled()
  if (scope.pumpId) await openInstalledDetails(scope.pumpId)
}

const hasCoordinates = (item: InstalledPumpSummary) => Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))
const locate = (item: InstalledPumpSummary) => emit('locate-pump', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, lineId: item.line_id, label: item.number || item.model_name || `Насос №${item.id}` })
const configurationLabel = (status: PumpConfigurationStatus) => ({ configured: 'настроен', missing_model: 'нет модели', coefficients_missing: 'нет коэффициентов', line_missing: 'нет линии' })[status]
const configurationColor = (status: PumpConfigurationStatus) => ({ configured: 'green', missing_model: 'orange', coefficients_missing: 'amber-darken-3', line_missing: 'red' })[status]
const catalogStatusLabel = (status: PumpCatalogStatus) => ({ ready: 'готов', non_monotonic: 'порядок Q', incomplete: 'неполный' })[status]
const catalogStatusColor = (status: PumpCatalogStatus) => ({ ready: 'green', non_monotonic: 'orange', incomplete: 'red' })[status]
const stateColor = (state: string | null) => state?.toLowerCase() === 'открыт' ? 'green' : state?.toLowerCase() === 'закрыт' ? 'grey' : 'blue-grey'
const formatNumber = (value: unknown, digits = 2) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatUnit = (value: unknown, unit: string) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : `${formatNumber(value, 3)} ${unit}`
const outputValue = (key: string) => installedDetails.value?.latest_output?.[key] as string | number | null | undefined
const pointInWorkingZone = (point: PumpCurvePoint) => point.flow !== null && modelDetails.value?.min_flow !== null && modelDetails.value?.max_flow !== null && Number(point.flow) >= Number(modelDetails.value?.min_flow) && Number(point.flow) <= Number(modelDetails.value?.max_flow)

defineExpose({ openDialog })
</script>

<style scoped>
.metric-row,.filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.filters>*{min-width:185px;flex:1}.filters .v-btn{flex:0 0 auto}.table-wrap,.points-wrap,.coefficient-wrap{overflow:auto}.table-wrap{min-height:330px}.journal-table{width:100%;border-collapse:collapse;font-size:13px}.journal-table th,.journal-table td{padding:9px 10px;border-bottom:1px solid #e0e0e0;text-align:left;white-space:nowrap}.journal-table th{position:sticky;top:0;background:#eceff1;z-index:1}.journal-table tbody tr{cursor:pointer}.journal-table tbody tr:hover{background:#f5f7f8}.muted{font-size:11px;color:#757575}.empty{text-align:center;color:#757575;padding:32px}.journal-error{margin:0 12px 12px;padding:10px 12px;border-radius:4px;background:#ffebee;color:#b71c1c}.detail-alerts{display:grid;gap:8px}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.chart-wrap{height:570px}.chart{height:100%;width:100%}.points-wrap{max-height:360px}.coefficient-wrap{max-height:280px}.coefficient-table td,.coefficient-table th{padding:7px 9px}.points-table tbody tr,.coefficient-table tbody tr{cursor:default}:deep(.detail-value){display:flex;flex-direction:column;min-width:0}:deep(.detail-label){font-size:11px;color:#757575}:deep(.detail-value strong){overflow-wrap:anywhere}
@media(max-width:960px){.filters{display:grid;grid-template-columns:1fr}.filters>*{width:100%}.detail-grid{grid-template-columns:1fr}.chart-wrap{height:450px}}
</style>
