<template>
  <Teleport to="body">
    <JournalShell
      v-model="visible"
      v-model:page="page"
      title="Температурные графики источников"
      :subtitle="`найдено ${total} · готовы ${lookups.counts.ready || 0} из ${lookups.counts.total || 0}`"
      icon="mdi-chart-bell-curve-cumulative"
      avatar-color="purple-lighten-5"
      icon-color="purple-darken-3"
      :pages="pages"
      :loading="loading"
      :error="error"
      :empty="!sources.length"
      empty-title="Источники не найдены"
      :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям источников нет' : 'В базе нет источников тепла'"
      empty-icon="mdi-chart-bell-curve-cumulative"
      :empty-action-label="filtersActive ? 'Сбросить фильтры' : undefined"
      :skeleton-rows="10"
      @retry="loadSources"
      @empty-action="resetFilters"
    >
      <template #top>
        <v-alert
          v-if="lookupsLoaded && lookups.fact_point_count === 0"
          type="info"
          variant="tonal"
          density="compact"
          class="mx-3 mx-md-4 mt-3 flex-shrink-0"
        >
          Фактические температурные графики в БД отсутствуют. Показаны нормативные точки <code>deployedTempGraphs</code>
          и исходные параметры источника.
        </v-alert>

        <!-- Плитки состояния графиков на всю базу; плитка — фильтр -->
        <div class="tg-kpi px-3 px-md-4 pt-3">
          <KpiTile
            v-for="metric in statusMetrics"
            :key="metric.value"
            :label="metric.label"
            :value="lookups.counts[metric.value] || 0"
            :compact="false"
            :status="metric.status"
            selectable
            :active="graphStatus === metric.value"
            @select="toggleStatus(metric.value)"
          />
        </div>
      </template>
      <template #filters>
        <v-row dense>
          <v-col
            cols="12"
            md="4"
          >
            <SearchField
              :model-value="search"
              label="Источник, узел, фрагмент или ID"
              :debounce="350"
              :loading="loading"
              @update:model-value="search = $event"
              @search="onSearch"
            />
          </v-col>
          <v-col
            cols="12"
            sm="6"
            md="2"
          >
            <AppSelect
              v-model="graphStatus"
              :items="statusOptions"
              item-title="title"
              item-value="value"
              label="Состояние графика"
            />
          </v-col>
          <v-col
            cols="12"
            sm="6"
            md="2"
          >
            <AppSelect
              v-model="summerStatus"
              :items="summerOptions"
              item-title="title"
              item-value="value"
              label="Летний режим"
            />
          </v-col>
          <v-col
            cols="12"
            sm="6"
            md="2"
          >
            <AppSelect
              v-model="graphTypeId"
              :items="lookups.graph_types"
              item-title="name"
              item-value="id"
              label="Тип графика"
            />
          </v-col>
          <v-col
            cols="12"
            sm="6"
            md="2"
          >
            <AppSelect
              v-model="fragmentId"
              :items="lookups.fragments"
              item-title="name"
              item-value="id"
              label="Фрагмент"
            />
          </v-col>
        </v-row>
        <div class="d-flex align-center flex-wrap ga-2 mt-3">
          <v-spacer />
          <v-btn
            variant="text"
            prepend-icon="mdi-filter-remove-outline"
            :disabled="!filtersActive"
            @click="resetFilters"
          >
            Сбросить
          </v-btn>
          <v-btn
            variant="tonal"
            prepend-icon="mdi-refresh"
            :loading="loading"
            @click="loadSources"
          >
            Обновить
          </v-btn>
        </div>
      </template>
      <DataTable
        :columns="tableColumns"
        :items="(sources as Record<string, unknown>[])"
        item-key="id"
        selectable
        :flash-key="flashId"
        density="compact"
        class="tg-table"
        @select="openDetails(Number($event.id))"
      >
        <template #[`item.name`]="{ item }">
          <div class="text-truncate font-weight-medium">
            {{ item.name }}
          </div>
          <div class="text-caption text-medium-emphasis">
            узел {{ item.node_id }}
          </div>
        </template>
        <template #[`item.fragment_name`]="{ item }">
          <div class="text-truncate">
            {{ item.fragment_name || `№${item.fragment_id || '—'}` }}
          </div>
        </template>
        <template #[`item.graph_type_name`]="{ item }">
          {{ item.graph_type_name || '—' }}
        </template>
        <template #[`item.min_outdoor_temperature`]="{ item }">
          {{ formatRange(item.min_outdoor_temperature, item.max_outdoor_temperature) }}
        </template>
        <template #[`item.point_count`]="{ item }">
          {{ item.point_count }}<span v-if="item.expected_point_count !== null"> / {{ item.expected_point_count }}</span>
        </template>
        <template #[`item.design_flow_temperature`]="{ item }">
          {{ formatNumber(item.design_flow_temperature) }} / {{ formatNumber(item.design_return_temperature) }} °C
        </template>
        <template #[`item.has_summer_temperatures`]="{ item }">
          {{ item.has_summer_temperatures ? `${formatNumber(item.summer_flow_temperature)} / ${formatNumber(item.summer_return_temperature)} °C` : 'не задан' }}
        </template>
        <template #[`item.graph_status`]="{ item }">
          <v-chip
            size="x-small"
            variant="tonal"
            :color="statusColor(item.graph_status as TemperatureGraphStatus)"
          >
            {{ statusLabel(item.graph_status as TemperatureGraphStatus) }}
          </v-chip>
        </template>
        <template #[`item.actions`]="{ item }">
          <HintTip
            v-if="hasCoordinates(item)"
            text="Показать источник на карте"
            hint="Журнал закроется, маркер останется"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon="mdi-crosshairs-gps"
                size="x-small"
                variant="text"
                aria-label="Показать источник на карте"
                @click.stop="locate(item)"
              />
            </template>
          </HintTip>
          <HintTip text="Открыть график источника">
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon="mdi-chevron-right"
                size="x-small"
                variant="text"
                aria-label="Открыть график источника"
                @click.stop="openDetails(Number(item.id))"
              />
            </template>
          </HintTip>
        </template>
      </DataTable>
    </JournalShell>

    <v-dialog
      v-model="detailVisible"
      :persistent="saving"
      :fullscreen="isMobile"
      max-width="1450"
      scrollable
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="purple-darken-3">mdi-chart-bell-curve-cumulative</v-icon>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <span class="text-truncate">{{ details?.name || 'Температурный график' }}</span>
              <v-chip
                v-if="isEditing && isDirty"
                size="x-small"
                color="accent"
                variant="tonal"
              >
                Не сохранено
              </v-chip>
            </div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ details ? `${details.graph_type_name || 'тип не задан'} · узел ${details.node_id}` : '' }}
            </div>
          </div>
          <HintTip
            text="Закрыть карточку"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                aria-label="Закрыть карточку"
                @click="detailVisible = false"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </HintTip>
        </v-card-title>
        <v-divider />

        <v-card-text class="pa-3 pa-md-4">
          <StateView
            variant="form"
            :rows="8"
            :loading="detailLoading"
            :error="detailError"
            :empty="!detailLoading && !detailError && !details"
            empty-title="Источник не выбран"
            :retry="false"
          >
            <template v-if="details">
              <div class="tg-alerts mb-3">
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
                  Найдено {{ details.duplicate_point_count }} повторных строк температуры. На графике показана запись с
                  максимальным ID для каждого tн.
                </v-alert>
                <v-alert
                  v-if="details.graph_status === 'incomplete'"
                  type="warning"
                  variant="tonal"
                  density="compact"
                >
                  Количество или диапазон точек не соответствует исходным границам: {{ details.point_count }} вместо
                  {{ details.expected_point_count ?? 'не определено' }}.
                </v-alert>
              </div>

              <v-row dense>
                <v-col
                  cols="12"
                  md="5"
                >
                  <JournalDetailFields
                    :groups="detailGroups"
                    :model="editFields"
                    :editable="editable"
                    :is-field-dirty="isFieldDirty"
                    :open-panels="[0, 1]"
                    @update:field="setEditField"
                  />
                  <v-alert
                    v-if="isEditing && saveError"
                    type="error"
                    variant="tonal"
                    density="compact"
                    class="mt-3"
                    data-testid="equipment-save-error"
                  >
                    {{ saveError }}
                  </v-alert>
                  <!-- Пересчёт графика пишет точки в базу — те же права, что у правки -->
                  <div
                    v-if="mutationsEnabled && !isEditing"
                    class="tg-graph-actions mt-3"
                  >
                    <AppSelect
                      v-model="graphMode"
                      :items="graphModes"
                      item-title="title"
                      item-value="value"
                      label="Вид графика"
                      :clearable="false"
                      class="tg-graph-mode"
                    />
                    <v-btn
                      variant="tonal"
                      prepend-icon="mdi-calculator"
                      :loading="recalculating"
                      @click="recalculateGraph"
                    >
                      Рассчитать график
                    </v-btn>
                    <HintTip
                      text="Стационарный график"
                      hint="Постоянные t1 / t2 / t3 / tv на всех точках источника, как «Стационарный» в десктопе"
                    >
                      <template #default="{ props: tip }">
                        <v-btn
                          v-bind="tip"
                          variant="tonal"
                          prepend-icon="mdi-thermometer-lines"
                          @click="stationaryDialog = true"
                        >
                          Стационарный
                        </v-btn>
                      </template>
                    </HintTip>
                  </div>
                </v-col>

                <v-col
                  cols="12"
                  md="7"
                >
                  <div class="text-subtitle-2 font-weight-bold mb-2">
                    Развёрнутый температурный график
                  </div>
                  <ChartFrame
                    v-if="details.points.length"
                    :option="chartOptions"
                    :height="chartHeight"
                    label="Температурный график"
                    :export-name="`Температурный график — ${details.name}`"
                    :summary="chartSummary"
                  />
                  <StateView
                    v-else
                    empty
                    empty-title="Нет точек для построения графика"
                    empty-text="Рассчитайте график или задайте стационарный"
                    empty-icon="mdi-chart-line"
                  />
                </v-col>
              </v-row>

              <div class="text-subtitle-2 font-weight-bold mt-4 mb-2">
                Точки графика
              </div>
              <DataTable
                :columns="pointColumns"
                :items="(details.points as Record<string, unknown>[])"
                item-key="id"
                density="compact"
                :height="360"
                class="points-table"
                no-data-text="Точек нет"
              >
                <template #[`item.tn`]="{ item }">
                  {{ formatNumber(item.tn) }}
                </template>
                <template #[`item.q_otn`]="{ item }">
                  {{ formatNumber(item.q_otn, 3) }}
                </template>
                <template #[`item.t1`]="{ item }">
                  {{ formatNumber(item.t1) }}
                </template>
                <template #[`item.t2`]="{ item }">
                  {{ formatNumber(item.t2) }}
                </template>
                <template #[`item.t3`]="{ item }">
                  {{ formatNumber(item.t3) }}
                </template>
                <template #[`item.tv`]="{ item }">
                  {{ formatNumber(item.tv) }}
                </template>
                <template #[`item.t_bn`]="{ item }">
                  {{ formatNumber(item.t_bn) }}
                </template>
                <template #[`item.duplicate_count`]="{ item }">
                  {{ Number(item.duplicate_count) > 1 ? item.duplicate_count : '—' }}
                </template>
              </DataTable>
            </template>
          </StateView>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-spacer />
          <template v-if="isEditing">
            <v-btn
              variant="text"
              :disabled="saving"
              @click="cancelEdit"
            >
              Отмена
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              :loading="saving"
              :disabled="!isDirty"
              @click="saveInputs"
            >
              Сохранить
            </v-btn>
          </template>
          <template v-else>
            <v-btn
              v-if="details && hasCoordinates(details)"
              variant="tonal"
              prepend-icon="mdi-crosshairs-gps"
              @click="locate(details)"
            >
              На карте
            </v-btn>
            <v-btn
              v-if="mutationsEnabled && details"
              variant="tonal"
              @click="startEdit"
            >
              Редактировать
            </v-btn>
            <v-btn
              variant="text"
              @click="detailVisible = false"
            >
              Закрыть
            </v-btn>
          </template>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="stationaryDialog"
      :persistent="applyingStationary"
      max-width="420"
    >
      <v-card rounded="lg">
        <v-card-title class="px-4 pt-4">
          Стационарный график
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-3">
            Задаёт постоянные t1 / t2 / t3 / tv на всех точках источника (как «Стационарный» в десктопе).
          </p>
          <v-row dense>
            <v-col
              v-for="field in stationaryFields"
              :key="field.key"
              cols="6"
            >
              <v-text-field
                v-model.number="stationary[field.key]"
                :label="field.label"
                type="number"
                suffix="°C"
                density="compact"
                variant="outlined"
                hide-details
              />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="applyingStationary"
            @click="stationaryDialog = false"
          >
            Отмена
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="applyingStationary"
            @click="applyStationary"
          >
            Применить
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </Teleport>
</template>

<script setup lang="ts">
import AppSelect from '~/components/AppSelect.vue'
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue'
import HintTip from '~/components/HintTip.vue'
import JournalDetailFields, { type JournalDetailField, type JournalDetailGroup } from '~/components/JournalDetailFields.vue'
import KpiTile from '~/components/KpiTile.vue'
import JournalShell from '~/components/JournalShell.vue'
import SearchField from '~/components/SearchField.vue'
import StateView from '~/components/StateView.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import ChartFrame from '~/components/ChartFrame.vue'
import { axisTooltip, zoomControls } from '~/utils/chartOptions'
import { useEquipmentSaveError } from '~/composables/useEquipmentSaveError'
import { useJournalEdit, type JournalEditSource } from '~/composables/useJournalEdit'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiError } from '~/utils/apiError'
import { hasLonLat } from '~/utils/journalFields'
import {
  fastApiService,
  type TemperatureGraphLookups,
  type TemperatureGraphMode,
  type TemperatureGraphSourceDetails,
  type TemperatureGraphSourceSummary,
  type TemperatureGraphStatus
} from '~/services/fastApiService'

/**
 * Температурные графики источников — журнал (docs/ui-modernization-progress.md, этап 5): плитки состояния
 * графиков (плитка — фильтр), `DataTable` с серверной пагинацией, `SearchField` / `AppSelect`, `StateView`.
 * Карточка: исходные параметры desktop на `JournalDetailFields` + общий `useJournalEdit` (черновик, «изменено»,
 * отмена с подтверждением); ключи формы — колонки `heatsources` (API отдаёт их под псевдонимами, `toForm`),
 * в базу — только изменённые. Пересчёт и стационарный график, кривые t1 / t2 / t3 / tv и таблица точек.
 */
type LocatePayload = { longitude: number; latitude: number; id: number; nodeId: number; label: string }
type StationaryKey = 't1' | 't2' | 't3' | 'tv'

use([LineChart])

const emit = defineEmits<{ 'locate-source': [payload: LocatePayload] }>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const notifications = useNotificationStore()
const { saveError, clearSaveError, reportSaveError } = useEquipmentSaveError()

const visible = ref(false)
const loading = ref(false)
const error = ref('')
const page = ref(1)
const pages = ref(0)
const total = ref(0)
const pageSize = 50
const sources = ref<TemperatureGraphSourceSummary[]>([])
const lookups = ref<TemperatureGraphLookups>({ graph_types: [], source_types: [], fragments: [], counts: {}, fact_point_count: 0 })
const lookupsLoaded = ref(false)
const search = ref('')
const graphStatus = ref<TemperatureGraphStatus | undefined>()
const summerStatus = ref<'ready' | 'missing' | undefined>()
const graphTypeId = ref<number | undefined>()
const fragmentId = ref<number | undefined>()

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const details = ref<TemperatureGraphSourceDetails | null>(null)

const statusMetrics: Array<{ value: TemperatureGraphStatus; label: string; status: 'good' | 'warning' | 'serious' | 'critical' }> = [
  { value: 'ready', label: 'Готовы', status: 'good' },
  { value: 'missing', label: 'Нет графика', status: 'serious' },
  { value: 'duplicates', label: 'Дубли', status: 'critical' },
  { value: 'incomplete', label: 'Неполный диапазон', status: 'warning' }
]
const statusOptions = statusMetrics.map(metric => ({ title: metric.label, value: metric.value }))
const summerOptions = [{ title: 'Задан', value: 'ready' }, { title: 'Не задан', value: 'missing' }]
const STATUS_LABEL: Record<TemperatureGraphStatus, string> = { ready: 'готов', missing: 'нет графика', duplicates: 'дубли', incomplete: 'диапазон' }
const STATUS_COLOR: Record<TemperatureGraphStatus, string> = { ready: 'success', missing: 'warning', duplicates: 'error', incomplete: 'amber-darken-3' }
const statusLabel = (status: TemperatureGraphStatus) => STATUS_LABEL[status] || String(status || '—')
const statusColor = (status: TemperatureGraphStatus) => STATUS_COLOR[status] || 'grey'

const tableColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 70, sortable: false },
  { key: 'name', title: 'Источник', sortable: false },
  { key: 'fragment_name', title: 'Фрагмент', width: 220, sortable: false },
  { key: 'graph_type_name', title: 'Тип', width: 150, sortable: false },
  { key: 'min_outdoor_temperature', title: 'Диапазон tн', width: 140, sortable: false },
  { key: 'point_count', title: 'Точки', type: 'number', width: 90, sortable: false },
  { key: 'design_flow_temperature', title: 'Расчётный режим', width: 140, sortable: false },
  { key: 'has_summer_temperatures', title: 'Летний режим', width: 130, sortable: false },
  { key: 'graph_status', title: 'Статус', width: 110, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false }
]
const pointColumns: DataTableColumn[] = [
  { key: 'tn', title: 'tн, °C', type: 'number', sortable: false },
  { key: 'q_otn', title: 'Qотн', type: 'number', sortable: false },
  { key: 't1', title: 'Подающая t1', type: 'number', sortable: false },
  { key: 't2', title: 'Обратная t2', type: 'number', sortable: false },
  { key: 't3', title: 'Смешанная t3', type: 'number', sortable: false },
  { key: 'tv', title: 'Ветер tv', type: 'number', sortable: false },
  { key: 't_bn', title: 'tбн', type: 'number', sortable: false },
  { key: 'duplicate_count', title: 'Дубли', type: 'number', sortable: false }
]

const filtersActive = computed(() => Boolean(search.value.trim() || graphStatus.value || summerStatus.value || graphTypeId.value || fragmentId.value))

const formatNumber = (value: unknown, digits = 1) => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
  ? '—'
  : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits }))
const formatRange = (min: unknown, max: unknown) => (min === null || min === undefined || max === null || max === undefined
  ? '—'
  : `${formatNumber(min)} … ${formatNumber(max)} °C`)
const hasCoordinates = (item: object) => hasLonLat(item as Record<string, unknown>)

/**
 * Исходные параметры: колонка `heatsources` → псевдоним в `inputs` API (database/temperature_graphs.py).
 * Форма — по колонкам: прежняя форма слала псевдонимы, и сохранение не доходило до базы.
 */
const INPUT_COLUMNS: Array<{ column: string; alias: string; label: string; units: string }> = [
  { column: 'tn_5', alias: 'design_outdoor_temperature', label: 'Расчётная t наружного воздуха', units: '°C' },
  { column: 'tn_1', alias: 'heating_end_temperature', label: 't конца отопительного сезона', units: '°C' },
  { column: 'tvn_r', alias: 'design_indoor_temperature', label: 'Расчётная t помещения', units: '°C' },
  { column: 'tvb_tr', alias: 'required_indoor_temperature', label: 'Требуемая t помещения', units: '°C' },
  { column: 't1_r', alias: 'design_flow_temperature', label: 'Расчётная t подачи', units: '°C' },
  { column: 't2_r', alias: 'design_return_temperature', label: 'Расчётная t обратки', units: '°C' },
  { column: 't3_r', alias: 'design_mixed_temperature', label: 'Расчётная t смешения', units: '°C' },
  { column: 'q_r', alias: 'heating_load', label: 'Нагрузка отопления', units: 'Гкал/ч' },
  { column: 'q_gv', alias: 'hot_water_load', label: 'Нагрузка ГВС', units: 'Гкал/ч' },
  { column: 'hsourcepower', alias: 'source_power', label: 'Мощность источника', units: '' },
  { column: 't1_2r', alias: 'lower_flow_cut', label: 'Нижняя срезка подачи', units: '°C' },
  { column: 't1_4r', alias: 'upper_flow_cut', label: 'Верхняя срезка подачи', units: '°C' },
  { column: 't2_2r', alias: 'lower_return_cut', label: 'Нижняя срезка обратки', units: '°C' },
  { column: 'uf', alias: 'mixing_correction', label: 'Поправка смешения', units: '' },
  { column: 'v', alias: 'wind_speed', label: 'Скорость ветра', units: 'м/с' }
]
const INPUT_KEYS = INPUT_COLUMNS.map(field => field.column)
const editSource: JournalEditSource = {
  schema: computed(() => ({ fields: Object.fromEntries(INPUT_KEYS.map(key => [key, true])) })),
  isWritable: (key?: string | null) => Boolean(key && INPUT_KEYS.includes(key)),
  // колонки известны заранее — загрузки нет, но useJournalEdit ждёт признак «есть»
  loadSchema: async () => true
}
const {
  isEditing, saving, editFields, flashId, isDirty, isFieldDirty, editable, setEditField,
  beginEdit, resetEdit, cancel, closeKeepingDraft, markSaved
} = useJournalEdit('temperature-graph-sources', editSource, details, {
  toForm: record => Object.fromEntries(INPUT_COLUMNS.map(field => [field.column, record.inputs?.[field.alias] ?? null]))
})

const detailGroups = computed((): JournalDetailGroup[] => {
  const item = details.value
  if (!item) return []
  const sourceFields: Array<[string, unknown]> = [
    ['ID источника', item.id], ['Узел', item.node_id], ['Фрагмент', item.fragment_name], ['Состояние', item.state_name],
    ['Тип источника', item.source_type_name], ['Точек', `${item.point_count} / ${item.expected_point_count ?? '—'}`],
    ['Диапазон tн', formatRange(item.min_outdoor_temperature, item.max_outdoor_temperature)],
    ['Летний режим', item.has_summer_temperatures ? `${formatNumber(item.summer_flow_temperature)} / ${formatNumber(item.summer_return_temperature)} °C` : 'не задан']
  ]
  const inputs = (item.inputs || {}) as Record<string, unknown>
  const inputFields: JournalDetailField[] = INPUT_COLUMNS.map(field => ({
    label: field.label,
    value: formatNumber(inputs[field.alias], 3),
    rawValue: inputs[field.alias],
    key: field.column,
    type: 'number',
    units: field.units || undefined
  }))
  return [
    { title: 'Источник и режим', fields: sourceFields.map(([label, value]) => ({ label, value: String(value ?? '—'), rawValue: value, type: 'text' })) },
    { title: 'Исходные параметры desktop', fields: inputFields }
  ]
})

/** Вид графика как у desktop CTempGraph: graphTypeID 1 — О, 3 — П, 2 — СВ, 4 — СН */
const graphModes: { title: string; value: TemperatureGraphMode }[] = [
  { title: 'Отопительный (О)', value: 'otop' },
  { title: 'Повышенный (П)', value: 'pov' },
  { title: 'Скорр. повышенный (СВ)', value: 'skk_pov' },
  { title: 'Скорр. пониженный (СН)', value: 'skk_pon' }
]
const graphMode = ref<TemperatureGraphMode>('otop')
watch(() => details.value?.id, () => {
  const type = Number(details.value?.graph_type_id)
  graphMode.value = type === 3 ? 'pov' : type === 2 ? 'skk_pov' : type === 4 ? 'skk_pon' : 'otop'
})

const chartOptions = computed(() => {
  const points = details.value?.points || []
  const series = [
    { name: 'Подающая t1', key: 't1', color: '#e53935' },
    { name: 'Обратная t2', key: 't2', color: '#1e88e5' },
    { name: 'Смешанная t3', key: 't3', color: '#43a047' },
    { name: 'Ветер tv', key: 'tv', color: '#f9a825' }
  ].filter(item => points.some(point => point[item.key] !== null))
  return {
    tooltip: axisTooltip({ digits: 1, units: () => '°C', title: params => `tн ${String(params[0]?.axisValue ?? '')} °C` }),
    legend: { data: series.map(item => item.name), top: 0, left: 0, right: 120 },
    grid: { left: 55, right: 25, top: 60, bottom: 85 },
    xAxis: { type: 'category', inverse: true, name: 't наружного воздуха, °C', nameLocation: 'middle', nameGap: 32, data: points.map(point => point.tn) },
    yAxis: { type: 'value', name: 't воды, °C', min: (value: { min: number }) => Math.floor(Math.min(0, value.min) / 10) * 10 },
    dataZoom: zoomControls({ sliderBottom: 20 }),
    series: series.map(item => ({
      name: item.name, type: 'line', smooth: false, symbolSize: 5, itemStyle: { color: item.color }, lineStyle: { width: 2 },
      data: points.map(point => point[item.key])
    }))
  }
})

const chartHeight = computed(() => (isMobile.value ? 340 : 500))
/** Описание графика текстом: диапазон tн и расчётные температуры (для чтения с экрана и как итог под графиком) */
const chartSummary = computed(() => {
  const item = details.value
  if (!item) return ''
  return `${item.point_count} точек, tн ${formatRange(item.min_outdoor_temperature, item.max_outdoor_temperature)}; `
    + `расчётный режим ${formatNumber(item.design_flow_temperature)} / ${formatNumber(item.design_return_temperature)} °C`
})

const loadLookups = async () => {
  if (lookupsLoaded.value) return
  lookups.value = await fastApiService.getTemperatureGraphLookups()
  lookupsLoaded.value = true
}

/** Номер последнего запроса списка: ответ более раннего запроса не перекрывает поздний */
let listRequest = 0
const loadSources = async () => {
  const request = ++listRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getTemperatureGraphSources({
      search: search.value.trim() || undefined, graph_status: graphStatus.value, summer_status: summerStatus.value,
      graph_type_id: graphTypeId.value, fragment_id: fragmentId.value, page: page.value, page_size: pageSize
    })
    if (request !== listRequest) return
    sources.value = response.items
    total.value = response.total
    pages.value = response.pages
  } catch (cause) {
    if (request !== listRequest) return
    error.value = formatApiError(cause, 'Не удалось загрузить температурные графики')
  } finally {
    if (request === listRequest) loading.value = false
  }
}

/** openDialog ставит фильтры области сам и грузит список один раз — наблюдатели в это время молчат */
let applyingScope = false
watch([graphStatus, summerStatus, graphTypeId, fragmentId], () => {
  if (!visible.value || applyingScope) return
  page.value = 1
  void loadSources()
})
watch(page, () => { if (visible.value && !applyingScope) void loadSources() })

const onSearch = () => {
  if (!visible.value) return
  page.value = 1
  void loadSources()
}
const toggleStatus = (status: TemperatureGraphStatus) => {
  graphStatus.value = graphStatus.value === status ? undefined : status
}
const resetFilters = () => {
  search.value = ''
  graphStatus.value = undefined
  summerStatus.value = undefined
  graphTypeId.value = undefined
  fragmentId.value = undefined
  page.value = 1
  void loadSources()
}

/** После долгого действия карточку обновить, только если открыт тот же источник; сбой обновления — предупредить */
const refreshAfterWrite = async (id: number) => {
  const sameCard = detailVisible.value && details.value?.id === id
  await Promise.all([loadSources(), sameCard ? openDetails(id) : Promise.resolve()])
  if (error.value || (sameCard && detailError.value)) notifications.showWarning('Записано, но данные не обновились — нажмите «Обновить»')
}

/** Номер последнего запроса карточки: ответ более раннего запроса не перекрывает поздний */
let detailRequest = 0
const openDetails = async (sourceId: number) => {
  // открытие другого источника во время правки — черновик текущего остаётся, карточка на просмотр
  closeKeepingDraft()
  resetEdit()
  clearSaveError()
  const request = ++detailRequest
  detailVisible.value = true
  detailLoading.value = true
  detailError.value = ''
  details.value = null
  try {
    const record = await fastApiService.getTemperatureGraphSource(sourceId)
    if (request !== detailRequest) return
    details.value = record
  } catch (cause) {
    if (request !== detailRequest) return
    detailError.value = formatApiError(cause, 'Не удалось открыть источник')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

let openDialogSeq = 0
const openDialog = async (scope: { sourceId?: number; nodeId?: number; graphStatus?: TemperatureGraphStatus } = {}) => {
  const seq = ++openDialogSeq
  applyingScope = true
  search.value = scope.nodeId ? String(scope.nodeId) : ''
  graphStatus.value = scope.graphStatus
  summerStatus.value = undefined
  graphTypeId.value = undefined
  fragmentId.value = undefined
  page.value = 1
  visible.value = true
  await nextTick()
  applyingScope = false
  // список сам показывает свою ошибку; сбой справочника не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), loadSources()])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — плитки и фильтры могут быть неполными'))
  // журнал открыли снова, пока грузились списки — карточку открывает последний вызов
  if (seq !== openDialogSeq) return
  if (scope.sourceId) await openDetails(scope.sourceId)
}

const startEdit = async () => {
  clearSaveError()
  await beginEdit()
}
const cancelEdit = async () => {
  const { closed } = await cancel()
  if (closed) clearSaveError()
}
// Карточка закрыта крестиком или Esc во время правки — черновик остаётся до следующего открытия
watch(detailVisible, (open) => {
  if (!open) closeKeepingDraft()
})

const saveInputs = async () => {
  const id = details.value?.id
  if (!id) return
  // только изменённые колонки; пустая строка — NULL, как в десктопе
  const changed = Object.fromEntries(Object.entries(editFields.value)
    .filter(([key]) => isFieldDirty(key))
    .map(([key, value]) => [key, value === '' ? null : value]))
  if (!Object.keys(changed).length) return
  saving.value = true
  clearSaveError()
  try {
    await fastApiService.updateObjectAttributes('heatsources', id, changed)
    markSaved(id)
    notifications.showSuccess('Параметры источника сохранены')
    await refreshAfterWrite(id)
  } catch (cause) {
    reportSaveError(cause, () => openDetails(id))
  } finally {
    saving.value = false
  }
}

const recalculating = ref(false)
const recalculateGraph = async () => {
  const id = details.value?.id
  if (!id) return
  recalculating.value = true
  try {
    const result = await fastApiService.recalculateTemperatureGraph(id, graphMode.value)
    const title = graphModes.find(item => item.value === result.mode)?.title || result.mode
    notifications.showSuccess(`Температурный график ${title}: ${result.points} точек`)
    await refreshAfterWrite(id)
  } catch (cause) {
    notifications.showError(formatApiError(cause, 'Не удалось пересчитать температурный график'))
  } finally {
    recalculating.value = false
  }
}

const stationaryDialog = ref(false)
const applyingStationary = ref(false)
const stationary = ref<Record<StationaryKey, number>>({ t1: 95, t2: 70, t3: 70, tv: 0 })
const stationaryFields: Array<{ key: StationaryKey; label: string }> = [
  { key: 't1', label: 't1 подача' }, { key: 't2', label: 't2 обратка' },
  { key: 't3', label: 't3 смешение' }, { key: 'tv', label: 'tv ветер' }
]
const applyStationary = async () => {
  const id = details.value?.id
  if (!id) return
  const values = Object.fromEntries(stationaryFields.map(field => [field.key, Number(stationary.value[field.key])])) as Record<StationaryKey, number>
  if (Object.values(values).some(value => !Number.isFinite(value))) {
    notifications.showWarning('Заполните все четыре температуры числами')
    return
  }
  applyingStationary.value = true
  try {
    const result = await fastApiService.applyStationaryTemperatureGraph(id, values)
    notifications.showSuccess(`Стационарный: обновлено ${result.updated_points} точек`)
    stationaryDialog.value = false
    await refreshAfterWrite(id)
  } catch (cause) {
    notifications.showError(formatApiError(cause, 'Не удалось применить стационарный график'))
  } finally {
    applyingStationary.value = false
  }
}

const locate = (item: Record<string, unknown>) => {
  if (!hasCoordinates(item)) return
  emit('locate-source', {
    longitude: Number(item.longitude), latitude: Number(item.latitude), id: Number(item.id),
    nodeId: Number(item.node_id), label: String(item.name ?? `Источник ${item.id}`)
  })
  detailVisible.value = false
  visible.value = false
}

defineExpose({ openDialog })
</script>

<style scoped>
.tg-kpi { display: flex; flex-wrap: wrap; flex-shrink: 0; gap: var(--space-2); }
.tg-table { min-width: 1300px; }
.tg-alerts { display: grid; gap: var(--space-2); }
.tg-alerts:empty { display: none; }
.tg-graph-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.tg-graph-mode { flex: 1 1 220px; }
.points-table { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: var(--radius-2, 8px); }
@media (max-width: 600px) {
  .tg-journal { height: 100dvh; }
  .tg-kpi { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .tg-kpi > * { flex-shrink: 0; }
}
</style>
