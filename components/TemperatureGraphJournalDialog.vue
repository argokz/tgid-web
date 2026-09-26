<template>
  <v-dialog
    v-model="visible"
    :fullscreen="isMobile"
    max-width="1550"
    scrollable
  >
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar
        color="purple-darken-3"
        density="compact"
      >
        <v-icon class="ml-3 mr-2">
          mdi-chart-bell-curve-cumulative
        </v-icon>
        <v-toolbar-title>Температурные графики источников</v-toolbar-title>
        <v-chip
          class="mr-2"
          size="small"
          color="white"
          variant="outlined"
        >
          {{ lookups.counts.ready || 0 }}/{{ lookups.counts.total || 0 }} готовы
        </v-chip>
        <v-btn
          icon="mdi-close"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-toolbar>

      <v-alert
        v-if="lookups.fact_point_count === 0"
        type="info"
        variant="tonal"
        density="compact"
        class="ma-3 mb-0"
      >
        Фактические температурные графики в БД отсутствуют. Показаны нормативные точки <code>deployedTempGraphs</code> и исходные параметры источника.
      </v-alert>

      <div class="metric-row pa-3 pb-0">
        <v-chip
          v-for="metric in statusMetrics"
          :key="metric.value"
          :color="metric.color"
          :variant="filters.graph_status === metric.value ? 'flat' : 'tonal'"
          @click="setStatus(metric.value)"
        >
          {{ metric.label }}: {{ lookups.counts[metric.value] || 0 }}
        </v-chip>
      </div>

      <div class="filters pa-3">
        <v-text-field
          v-model="filters.search"
          label="Источник, узел, фрагмент или ID"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          variant="outlined"
          clearable
          hide-details
          @keyup.enter="reload"
        />
        <v-select
          v-model="filters.graph_status"
          :items="statusOptions"
          label="Состояние графика"
          density="compact"
          variant="outlined"
          clearable
          hide-details
        />
        <v-select
          v-model="filters.summer_status"
          :items="summerOptions"
          label="Летний режим"
          density="compact"
          variant="outlined"
          clearable
          hide-details
        />
        <v-select
          v-model="filters.graph_type_id"
          :items="lookups.graph_types"
          item-title="name"
          item-value="id"
          label="Тип графика"
          density="compact"
          variant="outlined"
          clearable
          hide-details
        />
        <v-select
          v-model="filters.fragment_id"
          :items="lookups.fragments"
          item-title="name"
          item-value="id"
          label="Фрагмент"
          density="compact"
          variant="outlined"
          clearable
          hide-details
        />
        <v-btn
          color="purple-darken-3"
          :loading="loading"
          @click="reload"
        >
          Найти
        </v-btn>
      </div>

      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        density="compact"
        class="mx-3 mb-3"
      >
        {{ error }}
      </v-alert>

      <div class="table-wrap">
        <table class="journal-table">
          <thead>
            <tr>
              <th>ID</th><th>Источник</th><th>Фрагмент</th><th>Тип</th><th>Диапазон tн</th><th>Точки</th><th>Расчётный режим</th><th>Летний режим</th><th>Статус</th><th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in sources"
              :key="item.id"
              @click="openDetails(item.id)"
            >
              <td>{{ item.id }}</td>
              <td>
                <strong>{{ item.name }}</strong><div class="muted">
                  узел {{ item.node_id }}
                </div>
              </td>
              <td>{{ item.fragment_name || `№${item.fragment_id || '—'}` }}</td>
              <td>{{ item.graph_type_name || '—' }}</td>
              <td>{{ formatRange(item.min_outdoor_temperature, item.max_outdoor_temperature) }}</td>
              <td>{{ item.point_count }}<span v-if="item.expected_point_count !== null"> / {{ item.expected_point_count }}</span></td>
              <td>{{ formatNumber(item.design_flow_temperature) }} / {{ formatNumber(item.design_return_temperature) }} °C</td>
              <td>{{ item.has_summer_temperatures ? `${formatNumber(item.summer_flow_temperature)} / ${formatNumber(item.summer_return_temperature)} °C` : 'не задан' }}</td>
              <td>
                <v-chip
                  size="x-small"
                  :color="statusColor(item.graph_status)"
                >
                  {{ statusLabel(item.graph_status) }}
                </v-chip>
              </td>
              <td>
                <v-btn
                  v-if="hasCoordinates(item)"
                  icon="mdi-map-marker"
                  size="x-small"
                  variant="text"
                  aria-label="Показать источник на карте"
                  @click.stop="locate(item)"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="!loading && !sources.length"
          class="empty"
        >
          Источники не найдены
        </div>
        <v-progress-linear
          v-if="loading"
          indeterminate
          color="purple-darken-3"
        />
      </div>

      <v-pagination
        v-if="pages > 1"
        v-model="page"
        :length="pages"
        density="comfortable"
        @update:model-value="loadSources"
      />
    </v-card>
  </v-dialog>

  <v-dialog
    v-model="detailVisible"
    :fullscreen="isMobile"
    max-width="1450"
    scrollable
  >
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar
        color="purple-darken-3"
        density="compact"
      >
        <v-btn
          icon="mdi-arrow-left"
          aria-label="Вернуться к журналу"
          @click="detailVisible = false"
        />
        <v-toolbar-title>{{ details?.name || 'Температурный график' }}</v-toolbar-title>
        <v-chip
          v-if="details"
          class="mr-2"
          size="small"
          color="white"
          variant="outlined"
        >
          {{ details.graph_type_name || 'Тип не задан' }}
        </v-chip>
        <v-btn
          icon="mdi-close"
          aria-label="Закрыть карточку"
          @click="detailVisible = false"
        />
      </v-toolbar>

      <v-progress-linear
        v-if="detailLoading"
        indeterminate
        color="purple-darken-3"
      />

      <template v-if="details && !detailLoading">
        <div class="detail-alerts pa-3 pb-0">
          <v-alert
            v-if="details.graph_status === 'missing'"
            type="warning"
            variant="tonal"
            density="compact"
          >
            Для источника нет развёрнутого температурного графика.
          </v-alert>
          <v-alert
            v-if="details.duplicate_point_count > 0"
            type="error"
            variant="tonal"
            density="compact"
          >
            Найдено {{ details.duplicate_point_count }} повторных строк температуры. На графике показана запись с максимальным ID для каждого tн.
          </v-alert>
          <v-alert
            v-if="details.graph_status === 'incomplete'"
            type="warning"
            variant="tonal"
            density="compact"
          >
            Количество или диапазон точек не соответствует исходным границам: {{ details.point_count }} вместо {{ details.expected_point_count ?? 'не определено' }}.
          </v-alert>
        </div>

        <v-row class="ma-0 pa-3">
          <v-col
            cols="12"
            md="4"
          >
            <v-card
              variant="outlined"
              class="mb-3"
            >
              <v-card-title class="text-subtitle-1">
                Источник и режим
              </v-card-title>
              <v-card-text class="detail-grid">
                <DetailValue
                  label="ID источника"
                  :value="details.id"
                />
                <DetailValue
                  label="Узел"
                  :value="details.node_id"
                />
                <DetailValue
                  label="Фрагмент"
                  :value="details.fragment_name"
                />
                <DetailValue
                  label="Состояние"
                  :value="details.state_name"
                />
                <DetailValue
                  label="Тип источника"
                  :value="details.source_type_name"
                />
                <DetailValue
                  label="Точек"
                  :value="`${details.point_count} / ${details.expected_point_count ?? '—'}`"
                />
                <DetailValue
                  label="Диапазон tн"
                  :value="formatRange(details.min_outdoor_temperature, details.max_outdoor_temperature)"
                />
                <DetailValue
                  label="Летний режим"
                  :value="details.has_summer_temperatures ? `${formatNumber(details.summer_flow_temperature)} / ${formatNumber(details.summer_return_temperature)} °C` : 'не задан'"
                />
              </v-card-text>
              <v-card-actions>
                <v-btn
                  v-if="hasCoordinates(details)"
                  prepend-icon="mdi-map-marker"
                  color="purple-darken-3"
                  @click="locate(details)"
                >
                  На карте
                </v-btn>
              </v-card-actions>
            </v-card>

            <v-card variant="outlined">
              <v-card-title class="text-subtitle-1 d-flex justify-space-between align-center">
                <span>Исходные параметры desktop</span>
                <div>
                  <v-btn
                    v-if="mutationsEnabled && details"
                    color="deep-orange"
                    variant="text"
                    prepend-icon="mdi-calculator"
                    class="mr-1"
                    :loading="recalculating"
                    @click="recalculateGraph"
                  >
                    Расчёт OTOP
                  </v-btn>
                  <v-btn
                    v-if="mutationsEnabled && details"
                    color="indigo"
                    variant="text"
                    prepend-icon="mdi-thermometer-lines"
                    class="mr-1"
                    @click="stationaryDialog = true"
                  >
                    Стационарный
                  </v-btn>
                  <v-btn v-if="mutationsEnabled && (!isEditing)" color="primary" variant="text" prepend-icon="mdi-pencil" @click="startEdit">Редактировать</v-btn>
                  <div v-else class="d-flex ga-2">
                    <v-btn v-if="mutationsEnabled" color="error" variant="text" @click="cancelEdit" :disabled="saving">Отмена</v-btn>
                    <v-btn v-if="mutationsEnabled" color="primary" variant="flat" @click="saveInputs" :loading="saving">Сохранить</v-btn>
                  </div>
                </div>
              </v-card-title>
              <v-card-text v-if="!isEditing" class="detail-grid input-grid">
                <DetailValue
                  v-for="field in inputFields"
                  :key="field.key"
                  :label="field.label"
                  :value="formatInput(recordValue(details.inputs, field.key), field.unit)"
                />
              </v-card-text>
              <v-card-text v-else class="input-grid">
                <v-row dense>
                  <v-col v-for="field in inputFields" :key="field.key" cols="12" sm="6">
                    <div class="detail-label mb-1">{{ field.label }}<span v-if="field.unit">, {{ field.unit }}</span></div>
                    <v-text-field v-model="editFields[field.key]" type="number" density="compact" hide-details variant="outlined" clearable />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col
            cols="12"
            md="8"
          >
            <v-card variant="outlined">
              <v-card-title class="text-subtitle-1">
                Развёрнутый температурный график
              </v-card-title>
              <v-card-text>
                <div
                  v-if="details.points.length"
                  class="chart-wrap"
                >
                  <v-chart
                    class="chart"
                    :option="chartOptions"
                    autoresize
                  />
                </div>
                <div
                  v-else
                  class="empty py-10"
                >
                  Нет точек для построения графика
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <div class="points-wrap mx-3 mb-3">
          <table class="journal-table points-table">
            <thead><tr><th>tн, °C</th><th>Qотн</th><th>Подающая t1</th><th>Обратная t2</th><th>Смешанная t3</th><th>Ветер tv</th><th>tбн</th><th>Дубли</th></tr></thead>
            <tbody>
              <tr
                v-for="point in details.points"
                :key="point.id"
              >
                <td>{{ formatNumber(point.tn) }}</td><td>{{ formatNumber(point.q_otn, 3) }}</td><td>{{ formatNumber(point.t1) }}</td><td>{{ formatNumber(point.t2) }}</td><td>{{ formatNumber(point.t3) }}</td><td>{{ formatNumber(point.tv) }}</td><td>{{ formatNumber(point.t_bn) }}</td><td>{{ point.duplicate_count && point.duplicate_count > 1 ? point.duplicate_count : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </v-card>
  </v-dialog>

  <v-dialog v-model="stationaryDialog" max-width="420">
    <v-card rounded="lg">
      <v-card-title>Стационарный график</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-3">
          Задаёт постоянные t1/t2/t3/tv на всех точках источника (как desktop «Стационарный»).
        </p>
        <v-row dense>
          <v-col cols="6"><v-text-field v-model.number="stationary.t1" label="t1 подача" type="number" density="compact" variant="outlined" hide-details /></v-col>
          <v-col cols="6"><v-text-field v-model.number="stationary.t2" label="t2 обратка" type="number" density="compact" variant="outlined" hide-details /></v-col>
          <v-col cols="6"><v-text-field v-model.number="stationary.t3" label="t3 смешение" type="number" density="compact" variant="outlined" hide-details class="mt-2" /></v-col>
          <v-col cols="6"><v-text-field v-model.number="stationary.tv" label="tv ветер" type="number" density="compact" variant="outlined" hide-details class="mt-2" /></v-col>
        </v-row>
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="stationaryDialog = false">Отмена</v-btn>
        <v-btn color="primary" variant="flat" :loading="applyingStationary" @click="applyStationary">Применить</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, type PropType } from 'vue'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import {
  fastApiService,
  type TemperatureGraphFilters,
  type TemperatureGraphLookups,
  type TemperatureGraphSourceDetails,
  type TemperatureGraphSourceSummary,
  type TemperatureGraphStatus
} from '~/services/fastApiService'

use([CanvasRenderer, LineChart, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent])

const DetailValue = defineComponent({
  props: { label: { type: String, required: true }, value: { type: [String, Number] as PropType<string | number | null>, default: null } },
  setup: props => () => h('div', { class: 'detail-value' }, [h('span', { class: 'detail-label' }, props.label), h('strong', String(props.value ?? '—'))])
})

const emit = defineEmits<{
  'locate-source': [payload: { longitude: number; latitude: number; id: number; nodeId: number; label: string }]
}>()

const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const visible = ref(false)
const detailVisible = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const error = ref('')
const page = ref(1)
const pages = ref(0)
const sources = ref<TemperatureGraphSourceSummary[]>([])
const details = ref<TemperatureGraphSourceDetails | null>(null)
const lookups = ref<TemperatureGraphLookups>({ graph_types: [], source_types: [], fragments: [], counts: {}, fact_point_count: 0 })
const filters = ref<TemperatureGraphFilters>({})

const statusOptions = [
  { title: 'Готов', value: 'ready' }, { title: 'Нет графика', value: 'missing' },
  { title: 'Есть дубли', value: 'duplicates' }, { title: 'Неполный диапазон', value: 'incomplete' }
]
const summerOptions = [{ title: 'Задан', value: 'ready' }, { title: 'Не задан', value: 'missing' }]
const statusMetrics: Array<{ value: TemperatureGraphStatus; label: string; color: string }> = [
  { value: 'ready', label: 'Готовы', color: 'green' },
  { value: 'missing', label: 'Нет графика', color: 'orange' },
  { value: 'duplicates', label: 'Дубли', color: 'red' },
  { value: 'incomplete', label: 'Диапазон', color: 'amber-darken-3' }
]
const inputFields = [
  { key: 'design_outdoor_temperature', label: 'Расчётная t наружного воздуха', unit: '°C' },
  { key: 'heating_end_temperature', label: 't конца отопительного сезона', unit: '°C' },
  { key: 'design_indoor_temperature', label: 'Расчётная t помещения', unit: '°C' },
  { key: 'required_indoor_temperature', label: 'Требуемая t помещения', unit: '°C' },
  { key: 'design_flow_temperature', label: 'Расчётная t подачи', unit: '°C' },
  { key: 'design_return_temperature', label: 'Расчётная t обратки', unit: '°C' },
  { key: 'design_mixed_temperature', label: 'Расчётная t смешения', unit: '°C' },
  { key: 'heating_load', label: 'Нагрузка отопления', unit: 'Гкал/ч' },
  { key: 'hot_water_load', label: 'Нагрузка ГВС', unit: 'Гкал/ч' },
  { key: 'source_power', label: 'Мощность источника', unit: '' },
  { key: 'lower_flow_cut', label: 'Нижняя срезка подачи', unit: '°C' },
  { key: 'upper_flow_cut', label: 'Верхняя срезка подачи', unit: '°C' },
  { key: 'lower_return_cut', label: 'Нижняя срезка обратки', unit: '°C' },
  { key: 'mixing_correction', label: 'Поправка смешения', unit: '' },
  { key: 'wind_speed', label: 'Скорость ветра', unit: 'м/с' }
]

const isEditing = ref(false)
const saving = ref(false)
const editFields = ref<Record<string, any>>({})

const startEdit = () => {
  isEditing.value = true
  editFields.value = {}
  for (const field of inputFields) {
    editFields.value[field.key] = recordValue(details.value?.inputs || {}, field.key)
  }
}

const cancelEdit = () => {
  isEditing.value = false
  editFields.value = {}
}

const saveInputs = async () => {
  if (!details.value) return
  saving.value = true
  try {
    const processedFields: Record<string, any> = {}
    for (const key in editFields.value) {
      if (editFields.value[key] === '') processedFields[key] = null
      else processedFields[key] = editFields.value[key]
    }
    
    await fastApiService.updateObjectAttributes('heatsources', details.value.id, processedFields)
    
    await openDetails(details.value.id)
    isEditing.value = false
    await loadSources()
  } catch (cause) {
    // We could handle errors globally or locally
  } finally {
    saving.value = false
  }
}

const recalculating = ref(false)
const recalculateGraph = async () => {
  if (!details.value) return
  recalculating.value = true
  try {
    const result = await fastApiService.recalculateTemperatureGraph(details.value.id)
    useNotificationStore().showSuccess(
      `TG OTOP: ${result.points} точек${result.mode ? ` (${result.mode})` : ''}`,
    )
    await openDetails(details.value.id)
  } catch (err: any) {
    useNotificationStore().showError(err?.message || 'Не удалось пересчитать TG')
  } finally {
    recalculating.value = false
  }
}

const stationaryDialog = ref(false)
const applyingStationary = ref(false)
const stationary = ref({ t1: 95, t2: 70, t3: 70, tv: 0 })
const applyStationary = async () => {
  if (!details.value) return
  applyingStationary.value = true
  try {
    const result = await fastApiService.applyStationaryTemperatureGraph(details.value.id, {
      t1: Number(stationary.value.t1),
      t2: Number(stationary.value.t2),
      t3: Number(stationary.value.t3),
      tv: Number(stationary.value.tv),
    })
    useNotificationStore().showSuccess(`Стационарный: обновлено ${result.updated_points} точек`)
    stationaryDialog.value = false
    await openDetails(details.value.id)
  } catch (err: any) {
    useNotificationStore().showError(err?.message || 'Не удалось применить стационарный график')
  } finally {
    applyingStationary.value = false
  }
}

const chartOptions = computed(() => {
  const points = details.value?.points || []
  const series = [
    { name: 'Подающая t1', key: 't1', color: '#e53935' },
    { name: 'Обратная t2', key: 't2', color: '#1e88e5' },
    { name: 'Смешанная t3', key: 't3', color: '#43a047' },
    { name: 'Ветер tv', key: 'tv', color: '#f9a825' }
  ].filter(item => points.some(point => point[item.key as keyof typeof point] !== null))
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: series.map(item => item.name) },
    grid: { left: 55, right: 25, top: 45, bottom: 85 },
    xAxis: { type: 'category', inverse: true, name: 't наружного воздуха, °C', nameLocation: 'middle', nameGap: 32, data: points.map(point => point.tn) },
    yAxis: { type: 'value', name: 't воды, °C', min: (value: { min: number }) => Math.floor(Math.min(0, value.min) / 10) * 10 },
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 20 }],
    series: series.map(item => ({ name: item.name, type: 'line', smooth: false, symbolSize: 5, itemStyle: { color: item.color }, lineStyle: { width: 2 }, data: points.map(point => point[item.key as keyof typeof point]) }))
  }
})

const loadLookups = async () => {
  if (!lookups.value.graph_types.length) lookups.value = await fastApiService.getTemperatureGraphLookups()
}
const loadSources = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getTemperatureGraphSources({ ...filters.value, page: page.value, page_size: 50 })
    sources.value = response.items
    pages.value = response.pages
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить температурные графики'
  } finally {
    loading.value = false
  }
}
const reload = () => { page.value = 1; void loadSources() }
const setStatus = (status: TemperatureGraphStatus) => { filters.value.graph_status = filters.value.graph_status === status ? undefined : status; reload() }
const openDetails = async (sourceId: number) => {
  detailVisible.value = true
  detailLoading.value = true
  details.value = null
  isEditing.value = false
  try { details.value = await fastApiService.getTemperatureGraphSource(sourceId) } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось открыть источник'; detailVisible.value = false } finally { detailLoading.value = false }
}
const openDialog = async (scope: { sourceId?: number; nodeId?: number; graphStatus?: TemperatureGraphStatus } = {}) => {
  visible.value = true
  await loadLookups()
  filters.value = { graph_status: scope.graphStatus, search: scope.nodeId ? String(scope.nodeId) : undefined }
  page.value = 1
  await loadSources()
  if (scope.sourceId) await openDetails(scope.sourceId)
}
const hasCoordinates = (item: TemperatureGraphSourceSummary) => Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))
const locate = (item: TemperatureGraphSourceSummary) => emit('locate-source', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, nodeId: item.node_id, label: item.name })
const statusLabel = (status: TemperatureGraphStatus) => ({ ready: 'готов', missing: 'нет графика', duplicates: 'дубли', incomplete: 'диапазон' })[status]
const statusColor = (status: TemperatureGraphStatus) => ({ ready: 'green', missing: 'orange', duplicates: 'red', incomplete: 'amber-darken-3' })[status]
const formatNumber = (value: unknown, digits = 1) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatRange = (min: number | null, max: number | null) => min === null || max === null ? '—' : `${formatNumber(min)} … ${formatNumber(max)} °C`
const recordValue = (record: Record<string, unknown>, key: string) => record[key]
const formatInput = (value: unknown, unit: string) => `${formatNumber(value, 3)}${value === null || value === undefined || value === '' ? '' : unit ? ` ${unit}` : ''}`

defineExpose({ openDialog })
</script>

<style scoped>
.metric-row,.filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.filters>*{min-width:170px;flex:1}.filters .v-btn{flex:0 0 auto}.table-wrap,.points-wrap{overflow:auto}.table-wrap{min-height:300px}.journal-table{width:100%;border-collapse:collapse;font-size:13px}.journal-table th,.journal-table td{padding:9px 10px;border-bottom:1px solid #e0e0e0;text-align:left;white-space:nowrap}.journal-table th{position:sticky;top:0;background:#f4eef7;z-index:1}.journal-table tbody tr{cursor:pointer}.journal-table tbody tr:hover{background:#f7f2f9}.muted{font-size:11px;color:#757575}.empty{text-align:center;color:#757575;padding:32px}.detail-alerts{display:grid;gap:8px}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.input-grid{max-height:440px;overflow:auto}.chart-wrap{height:540px}.chart{height:100%;width:100%}.points-wrap{max-height:430px;border:1px solid #e0e0e0;border-radius:6px}.points-table tbody tr{cursor:default}
:deep(.detail-value){display:flex;flex-direction:column;min-width:0}:deep(.detail-label){font-size:11px;color:#757575}:deep(.detail-value strong){overflow-wrap:anywhere}
@media(max-width:960px){.filters{display:grid;grid-template-columns:1fr}.filters>*{width:100%}.detail-grid{grid-template-columns:1fr}.chart-wrap{height:430px}}
</style>
