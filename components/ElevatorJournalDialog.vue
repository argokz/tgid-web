<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1320"
      scrollable
    >
      <v-card
        class="elevator-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="blue-grey-lighten-5"
            size="40"
          >
            <v-icon color="blue-grey-darken-2">mdi-elevator</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Элеваторы</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }} · готовы {{ lookups.counts.ready || 0 }} из {{ lookups.counts.total || 0 }}
            </div>
          </div>
          <HintTip
            text="Закрыть журнал"
            hotkey="Esc"
            location="bottom"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                aria-label="Закрыть журнал"
                @click="visible = false"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </HintTip>
        </v-card-title>

        <v-divider />

        <!-- Плитки качества данных из справочника (на всю базу, как в прежних чипах); плитка — фильтр -->
        <div class="elevator-kpi px-3 px-md-4 pt-3">
          <KpiTile
            v-for="metric in qualityMetrics"
            :key="metric.value"
            :label="metric.label"
            :value="lookups.counts[metric.value] || 0"
            :compact="false"
            :status="metric.status"
            selectable
            :active="qualityStatus === metric.value"
            @select="toggleQuality(metric.value)"
          />
        </div>

        <div class="pa-3 pa-md-4 elevator-filters">
          <v-row dense>
            <v-col
              cols="12"
              md="4"
            >
              <SearchField
                :model-value="search"
                label="ID, линия, тип, номер или узел"
                :debounce="350"
                :loading="loading"
                @update:model-value="search = $event"
                @search="onSearch"
              />
            </v-col>
            <v-col
              cols="12"
              sm="4"
              md="3"
            >
              <AppSelect
                v-model="qualityStatus"
                :items="qualityOptions"
                item-title="title"
                item-value="value"
                label="Качество данных"
              />
            </v-col>
            <v-col
              cols="12"
              sm="4"
              md="2"
            >
              <AppSelect
                v-model="stateId"
                :items="lookups.states"
                item-title="name"
                item-value="id"
                label="Состояние"
              />
            </v-col>
            <v-col
              cols="12"
              sm="4"
              md="3"
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
            <v-chip
              v-if="scope.lineId"
              size="small"
              color="primary"
              closable
              @click:close="clearScope"
            >
              Линия {{ scope.lineId }}
            </v-chip>
            <v-chip
              v-if="scope.nodeId"
              size="small"
              color="primary"
              closable
              @click:close="clearScope"
            >
              Узел {{ scope.nodeId }}
            </v-chip>
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
              color="primary"
              prepend-icon="mdi-refresh"
              :loading="loading"
              @click="loadItems"
            >
              Обновить
            </v-btn>
          </div>
        </div>

        <v-divider />

        <v-card-text class="pa-0 elevator-table-wrap">
          <StateView
            variant="table"
            :rows="10"
            :loading="loading && !items.length"
            :error="error"
            :empty="!loading && !items.length"
            empty-title="Элеваторы не найдены"
            :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В базе нет элеваторов'"
            empty-icon="mdi-elevator"
            :action-label="filtersActive ? 'Сбросить фильтры' : undefined"
            :retrying="loading"
            @retry="loadItems"
            @action="resetFilters"
          >
            <v-progress-linear
              v-if="loading"
              indeterminate
              color="primary"
            />
            <DataTable
              :columns="tableColumns"
              :items="(items as Record<string, unknown>[])"
              item-key="id"
              selectable
              density="compact"
              class="elevator-table"
              @select="openDetails(Number($event.id))"
            >
              <template #[`item.elevator_type`]="{ item }">
                <div class="text-truncate">
                  {{ item.elevator_type ?? item.display_name ?? '—' }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  № {{ item.elevator_num_inst ?? '—' }}
                </div>
              </template>
              <template #[`item.line_id`]="{ item }">
                <span class="num">{{ item.line_id ?? '—' }}</span>
                <div class="text-caption text-medium-emphasis text-truncate">
                  {{ nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1) }} → {{ nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2) }}
                </div>
              </template>
              <template #[`item.diameter_nozzle`]="{ item }">
                {{ formatNumber(item.diameter_nozzle) }}
              </template>
              <template #[`item.diameter_chamber`]="{ item }">
                {{ formatNumber(item.diameter_chamber) }}
              </template>
              <template #[`item.material`]="{ item }">
                {{ item.material || '—' }}
              </template>
              <template #[`item.state_name`]="{ item }">
                {{ item.state_name || '—' }}
              </template>
              <template #[`item.quality_status`]="{ item }">
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="qualityColor(item.quality_status as ElevatorQualityStatus)"
                >
                  {{ qualityLabel(item.quality_status as ElevatorQualityStatus) }}
                </v-chip>
              </template>
              <template #[`item.actions`]="{ item }">
                <HintTip
                  v-if="hasCoordinates(item)"
                  text="Показать элеватор на карте"
                  hint="Журнал закроется, маркер останется"
                >
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-crosshairs-gps"
                      size="x-small"
                      variant="text"
                      color="primary"
                      aria-label="Показать элеватор на карте"
                      @click.stop="locate(item as ElevatorSummary)"
                    />
                  </template>
                </HintTip>
                <HintTip text="Открыть паспорт">
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-chevron-right"
                      size="x-small"
                      variant="text"
                      aria-label="Открыть паспорт элеватора"
                      @click.stop="openDetails(Number(item.id))"
                    />
                  </template>
                </HintTip>
              </template>
            </DataTable>
          </StateView>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-2">
          <span class="text-caption text-medium-emphasis">Страница {{ page }}{{ pages ? ` из ${pages}` : '' }}</span>
          <v-spacer />
          <v-pagination
            v-if="pages > 1"
            v-model="page"
            :length="pages"
            :total-visible="isMobile ? 3 : 7"
            density="compact"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="detailVisible"
      :fullscreen="isMobile"
      max-width="980"
      scrollable
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="blue-grey-darken-2">mdi-elevator</v-icon>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold text-truncate">
              {{ details ? `Элеватор №${details.id}` : 'Паспорт элеватора' }}
            </div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ details ? `линия ${details.line_id ?? '—'} · ${details.state_name || 'состояние не указано'}` : '' }}
            </div>
          </div>
          <v-btn
            icon
            variant="text"
            aria-label="Закрыть паспорт"
            @click="detailVisible = false"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />

        <v-card-text class="pa-4">
          <StateView
            variant="form"
            :rows="8"
            :loading="detailLoading"
            :error="detailError"
            :empty="!detailLoading && !detailError && !details"
            empty-title="Паспорт не выбран"
            :retry="false"
          >
            <template v-if="details">
              <v-alert
                v-if="details.quality_status !== 'ready'"
                class="mb-4"
                type="warning"
                variant="tonal"
                density="compact"
              >
                {{ qualityDescription(details.quality_status as ElevatorQualityStatus) }}
              </v-alert>
              <JournalDetailFields
                :groups="detailGroups"
                :model="EMPTY_MODEL"
                :editable="notEditable"
                :is-field-dirty="notEditable"
                :open-panels="[0, 1]"
              />
            </template>
          </StateView>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-spacer />
          <v-btn
            v-if="details && hasCoordinates(details)"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-crosshairs-gps"
            @click="locate(details)"
          >
            На карте
          </v-btn>
          <v-btn
            variant="text"
            @click="detailVisible = false"
          >
            Закрыть
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
import SearchField from '~/components/SearchField.vue'
import StateView from '~/components/StateView.vue'
import { computed, reactive, ref, watch } from 'vue'
import { useMobile } from '~/composables/useMobile'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiError } from '~/utils/apiError'
import { hasLonLat } from '~/utils/journalFields'
import {
  fastApiService,
  type ElevatorDetails,
  type ElevatorLookups,
  type ElevatorQualityStatus,
  type ElevatorSummary
} from '~/services/fastApiService'

/**
 * Журнал элеваторов — паспорта без правки (docs/ui-modernization-progress.md, этап 5): `DataTable` с серверной
 * пагинацией, плитки качества данных из справочника (плитка — фильтр), `SearchField` / `AppSelect`, `StateView`;
 * паспорт — группы `JournalDetailFields` только для чтения, включая последний `ANY_OUT` и исходные поля таблицы.
 */
export interface ElevatorJournalScope {
  elevatorId?: number
  lineId?: number
  nodeId?: number
}

const emit = defineEmits<{
  'locate-elevator': [payload: { longitude: number; latitude: number; id: number; lineId: number | null; label: string }]
}>()
const { isMobile } = useMobile()
const notifications = useNotificationStore()
const visible = ref(false)
const loading = ref(false)
const error = ref('')
const items = ref<ElevatorSummary[]>([])
const total = ref(0)
const pages = ref(0)
const page = ref(1)
const pageSize = 50
const search = ref('')
const qualityStatus = ref<ElevatorQualityStatus | undefined>()
const stateId = ref<number | undefined>()
const fragmentId = ref<number | undefined>()
const scope = reactive<ElevatorJournalScope>({})
const lookups = reactive<ElevatorLookups>({ states: [], fragments: [], elevator_types: [], materials: [], counts: {} })
let lookupsLoaded = false

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const details = ref<ElevatorDetails | null>(null)

/** Паспорт только для чтения: `JournalDetailFields` без правки */
const EMPTY_MODEL: Record<string, never> = {}
const notEditable = () => false

const qualityMetrics: Array<{ value: ElevatorQualityStatus; label: string; status: 'good' | 'warning' | 'serious' | 'critical' | undefined }> = [
  { value: 'ready', label: 'Готовы', status: 'good' },
  { value: 'line_missing', label: 'Нет линии', status: 'critical' },
  { value: 'line_removed', label: 'Линия удалена', status: undefined },
  { value: 'topology_missing', label: 'Нет топологии', status: 'serious' },
  { value: 'state_missing', label: 'Нет состояния', status: 'warning' },
  { value: 'nozzle_unresolved', label: 'Нет сопла', status: 'warning' },
  { value: 'pending_calculation', label: 'Ожидают расчёт', status: undefined }
]
const qualityOptions = qualityMetrics.map(metric => ({ title: metric.label, value: metric.value }))

const scopeTitle = computed(() => {
  if (scope.lineId) return `элеваторы линии ${scope.lineId}`
  if (scope.nodeId) return `элеваторы узла ${scope.nodeId}`
  return 'вся тепловая сеть'
})
const filtersActive = computed(() => Boolean(search.value.trim() || qualityStatus.value || stateId.value || fragmentId.value))

const tableColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 76, sortable: false },
  { key: 'elevator_type', title: 'Тип / номер', width: 150, sortable: false },
  { key: 'line_id', title: 'Линия / узлы', sortable: false },
  { key: 'diameter_nozzle', title: 'Сопло, мм', type: 'number', width: 110, sortable: false },
  { key: 'diameter_chamber', title: 'Камера, мм', type: 'number', width: 110, sortable: false },
  { key: 'material', title: 'Материал', width: 130, sortable: false },
  { key: 'state_name', title: 'Состояние', width: 130, sortable: false },
  { key: 'quality_status', title: 'Качество', width: 140, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false },
]

const QUALITY_LABEL: Record<ElevatorQualityStatus, string> = {
  ready: 'готово', line_missing: 'нет линии', line_removed: 'линия удалена', topology_missing: 'нет топологии',
  state_missing: 'нет состояния', nozzle_unresolved: 'нет сопла', pending_calculation: 'ожидает расчёт'
}
const QUALITY_COLOR: Record<ElevatorQualityStatus, string> = {
  ready: 'success', line_missing: 'error', line_removed: 'grey', topology_missing: 'warning',
  state_missing: 'purple', nozzle_unresolved: 'warning', pending_calculation: 'info'
}
const QUALITY_DESCRIPTION: Record<ElevatorQualityStatus, string> = {
  ready: '',
  line_missing: 'Связанная линия отсутствует.',
  line_removed: 'Связанная линия помечена удалённой.',
  topology_missing: 'У линии отсутствует начальный или конечный узел.',
  state_missing: 'Состояние не найдено в справочнике.',
  nozzle_unresolved: 'Диаметр сопла не задан и признак расчётного подбора отсутствует.',
  pending_calculation: 'Диаметр сопла должен быть подобран расчётом.'
}
const qualityLabel = (status: ElevatorQualityStatus) => QUALITY_LABEL[status] || String(status || '—')
const qualityColor = (status: ElevatorQualityStatus) => QUALITY_COLOR[status] || 'grey'
const qualityDescription = (status: ElevatorQualityStatus) => QUALITY_DESCRIPTION[status] || ''

const hasCoordinates = (item: Record<string, unknown>) => hasLonLat(item)
const nodeLabel = (code: unknown, name: unknown, id: unknown) =>
  [code, name].filter(Boolean).join(' ') || (id ? `№${id}` : '—')
const formatNumber = (value: unknown, digits = 3) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatUnit = (value: unknown, unit: string) => (formatNumber(value) === '—' ? '—' : `${formatNumber(value)} ${unit}`)
const formatDate = (value: unknown) => (value ? new Date(String(value)).toLocaleDateString('ru-RU') : '—')
const formatAttribute = (value: unknown) => (typeof value === 'number' ? formatNumber(value, 8) : String(value ?? '—'))

/** Поля паспорта: только заполненные, тип всегда text (правки нет) */
const buildFields = (entries: Array<[string, unknown]>): JournalDetailField[] => entries
  .filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== '—')
  .map(([label, value]) => ({ label, value: String(value), rawValue: value, type: 'text' }))

const detailGroups = computed((): JournalDetailGroup[] => {
  const item = details.value
  if (!item) return []
  const output = Object.entries(item.latest_output || {}).filter(([key, value]) => key !== 'calculation' && value !== null && value !== '')
  const attributes = Object.entries(item.attributes || {}).filter(([, value]) => value !== null && value !== '')
  return [
    { title: 'Сетевая привязка', fields: buildFields([
      ['Элеватор / ID', item.id], ['Линия', item.line_id],
      ['Начальный узел', nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1)],
      ['Конечный узел', nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2)],
      ['Фрагмент', item.fragment_name || item.fragment_id], ['Признак линии', item.external_sign_line_name]
    ]) },
    { title: 'Паспорт', fields: buildFields([
      ['Тип', item.elevator_type], ['Установленный номер', item.elevator_num_inst],
      ['Диаметр сопла', formatUnit(item.diameter_nozzle, 'мм')], ['Диаметр камеры', formatUnit(item.diameter_chamber, 'мм')],
      ['Длина корпуса', formatUnit(item.length, 'мм')], ['Входной фланец', formatUnit(item.diameter_inlet_flange, 'мм')],
      ['Выходной фланец', formatUnit(item.diameter_outlet_flange, 'мм')], ['Патрубок подсоса', formatUnit(item.diameter_suction_pipe, 'мм')],
      ['Материал', item.material], ['Состояние', item.state_name], ['Признак расчёта', item.entry_mark]
    ]) },
    { title: 'Архивные реквизиты линии', fields: buildFields([
      ['Регистрационный номер', item.registration_number], ['Ввод в эксплуатацию', formatDate(item.commissioned_at)],
      ['Последнее обслуживание', formatDate(item.last_maintenance_at)], ['Владелец', item.organization_name],
      ['Оператор', item.operator_name], ['Сопротивление линии', formatNumber(item.line_hydraulic_resistance, 8)]
    ]) },
    { title: 'Последний ANY_OUT', fields: buildFields(
      output.map(([key, value]) => [key, formatAttribute(value)] as [string, unknown])
    ) },
    { title: 'Исходные поля elevators', fields: buildFields(
      attributes.map(([key, value]) => [key, formatAttribute(value)] as [string, unknown])
    ) }
  ].filter(group => group.fields.length)
})

const loadLookups = async () => {
  if (lookupsLoaded) return
  Object.assign(lookups, await fastApiService.getElevatorLookups())
  lookupsLoaded = true
}

/** Номер последнего запроса списка: ответ более раннего запроса не перекрывает поздний */
let listRequest = 0
const loadItems = async () => {
  const request = ++listRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getElevators({
      page: page.value, page_size: pageSize, search: search.value.trim() || undefined,
      quality_status: qualityStatus.value, state_id: stateId.value, fragment_id: fragmentId.value,
      line_id: scope.lineId, node_id: scope.nodeId
    })
    if (request !== listRequest) return
    items.value = response.items
    total.value = response.total
    pages.value = response.pages
  } catch (loadError: any) {
    if (request !== listRequest) return
    error.value = formatApiError(loadError, 'Не удалось загрузить элеваторы')
  } finally {
    if (request === listRequest) loading.value = false
  }
}

/** Фильтры — перезагрузка с первой страницы; страница — просто загрузка */
watch([qualityStatus, stateId, fragmentId], () => {
  if (!visible.value) return
  page.value = 1
  void loadItems()
})
watch(page, () => { if (visible.value) void loadItems() })

const onSearch = () => {
  if (!visible.value) return
  page.value = 1
  void loadItems()
}
const toggleQuality = (status: ElevatorQualityStatus) => {
  qualityStatus.value = qualityStatus.value === status ? undefined : status
}
const resetFilters = () => {
  search.value = ''
  qualityStatus.value = undefined
  stateId.value = undefined
  fragmentId.value = undefined
  page.value = 1
  void loadItems()
}
const clearScope = () => {
  scope.lineId = undefined
  scope.nodeId = undefined
  page.value = 1
  void loadItems()
}

/** Номер последнего запроса паспорта: ответ более раннего запроса не перекрывает поздний */
let detailRequest = 0
const openDetails = async (elevatorId: number) => {
  const request = ++detailRequest
  detailVisible.value = true
  detailLoading.value = true
  detailError.value = ''
  details.value = null
  try {
    const record = await fastApiService.getElevator(elevatorId)
    if (request !== detailRequest) return
    details.value = record
  } catch (loadError: any) {
    if (request !== detailRequest) return
    detailError.value = formatApiError(loadError, 'Не удалось открыть паспорт элеватора')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

const openDialog = async (nextScope: ElevatorJournalScope = {}) => {
  Object.assign(scope, { lineId: undefined, nodeId: undefined, elevatorId: undefined }, nextScope)
  page.value = 1
  visible.value = true
  // список сам показывает свою ошибку; сбой справочника не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), loadItems()])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — плитки и фильтры могут быть неполными'))
  if (nextScope.elevatorId) await openDetails(nextScope.elevatorId)
}

const locate = (item: Record<string, unknown>) => {
  emit('locate-elevator', {
    longitude: Number(item.longitude), latitude: Number(item.latitude), id: Number(item.id),
    lineId: item.line_id == null ? null : Number(item.line_id),
    label: String(item.display_name || `Элеватор №${item.id}`)
  })
  detailVisible.value = false
  visible.value = false
}

defineExpose({ openDialog })
</script>

<style scoped>
.elevator-journal { height: min(88vh, 880px); display: flex; flex-direction: column; }
.elevator-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.elevator-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.elevator-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.elevator-table { min-width: 1080px; }
@media (max-width: 600px) { .elevator-journal { height: 100dvh; } }
</style>
