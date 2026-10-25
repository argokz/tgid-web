<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1360"
      scrollable
    >
      <v-card
        class="corrosion-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="orange-lighten-5"
            size="40"
          >
            <v-icon color="orange-darken-3">mdi-test-tube</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Индикаторы коррозии</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }}
            </div>
          </div>
          <v-btn
            v-if="mutationsEnabled"
            color="primary"
            variant="flat"
            prepend-icon="mdi-plus"
            class="mr-2"
            :loading="creating"
            @click="createIndicator"
          >
            Создать
          </v-btn>
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

        <!-- Плитки из ответа списка: всего и по этапам при тех же фильтрах; плитка этапа — фильтр -->
        <div
          v-if="phaseTiles.length"
          class="corrosion-kpi px-3 px-md-4 pt-3"
        >
          <KpiTile
            label="Найдено"
            :value="total"
            :compact="false"
          />
          <KpiTile
            v-for="tile in phaseTiles"
            :key="tile.id"
            :label="tile.name"
            :value="tile.count"
            :compact="false"
            :status="tile.status"
            selectable
            :active="phaseId === tile.id"
            @select="togglePhase(tile.id)"
          />
        </div>

        <div class="pa-3 pa-md-4 corrosion-filters">
          <v-row dense>
            <v-col
              cols="12"
              md="4"
            >
              <SearchField
                :model-value="search"
                label="Номер, место, адрес, источник или ответственный"
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
                v-model="phaseId"
                :items="lookups.phases"
                item-title="name"
                item-value="id"
                label="Этап"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <AppSelect
                v-model="seasonYear"
                :items="lookups.years"
                item-title="value"
                item-value="value"
                label="Сезон с года"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <AppSelect
                v-model="rodStateId"
                :items="lookups.rod_states"
                item-title="name"
                item-value="id"
                label="Стержень"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <AppSelect
                v-model="processMarkId"
                :items="lookups.process_marks"
                item-title="name"
                item-value="id"
                label="Оценка"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="4"
            >
              <AppSelect
                v-model="waterAggressivenessId"
                :items="lookups.water_aggressiveness"
                item-title="name"
                item-value="id"
                label="Агрессивность сетевой воды"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <v-text-field
                v-model="dateFrom"
                type="date"
                label="С даты"
                density="compact"
                variant="outlined"
                hide-details
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <v-text-field
                v-model="dateTo"
                type="date"
                label="По дату"
                density="compact"
                variant="outlined"
                hide-details
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
              @click="loadIndicators"
            >
              Обновить
            </v-btn>
          </div>
        </div>
        <v-divider />

        <v-card-text class="pa-0 corrosion-table-wrap">
          <StateView
            variant="table"
            :rows="10"
            :loading="loading && !items.length"
            :error="error"
            :empty="!loading && !items.length"
            empty-title="Индикаторы коррозии не найдены"
            :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В текущей базе журнал пока не заполнен'"
            empty-icon="mdi-test-tube-empty"
            :action-label="filtersActive ? 'Сбросить фильтры' : undefined"
            :retrying="loading"
            @retry="loadIndicators"
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
              :flash-key="flashId"
              density="compact"
              class="corrosion-table"
              @select="openDetails(Number($event.id))"
            >
              <template #[`item.number`]="{ item }">
                <strong>{{ item.number || `Индикатор ${item.id}` }}</strong>
                <div class="cell-note">
                  {{ item.pipeline_sign_name || 'Трубопровод не указан' }}
                </div>
              </template>
              <template #[`item.phase_name`]="{ item }">
                <v-chip
                  size="x-small"
                  :color="phaseColor(Number(item.phase_id))"
                  variant="tonal"
                >
                  {{ item.phase_name || 'Не задан' }}
                </v-chip>
              </template>
              <template #[`item.dates`]="{ item }">
                {{ formatDate(item.planned_on) }}
                <div class="cell-note">
                  {{ formatDate(item.installed_on) }} · {{ formatDate(item.extracted_on) }}
                </div>
              </template>
              <template #[`item.place`]="{ item }">
                <span
                  class="wide-cell"
                  :title="String(item.installation_place || item.address || '')"
                >{{ item.installation_place || item.address || '—' }}</span>
              </template>
              <template #[`item.line`]="{ item }">
                Линия {{ item.line_id || '—' }}
                <div class="cell-note">
                  {{ nodeRange(item as CorrosionIndicatorSummary) }}
                </div>
              </template>
              <template #[`item.corrosion_rate`]="{ item }">
                <span class="num">{{ corrosionRate(item.corrosion_rate) }}</span>
              </template>
              <template #[`item.process_mark_name`]="{ item }">
                {{ item.process_mark_name || '—' }}
                <div class="cell-note">
                  вода: {{ item.water_aggressiveness_name || '—' }}
                </div>
              </template>
              <template #[`item.actions`]="{ item }">
                <HintTip text="Открыть карточку">
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-chevron-right"
                      size="x-small"
                      variant="text"
                      aria-label="Открыть карточку"
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
          <span class="text-caption text-medium-emphasis">Страница {{ page }} из {{ pages || 1 }}</span>
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
      v-model="detailsVisible"
      :persistent="saving"
      :fullscreen="isMobile"
      max-width="980"
      scrollable
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="orange-darken-3"
            size="40"
          >
            <v-icon color="white">mdi-test-tube</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <span class="text-truncate">{{ isNew ? 'Новый индикатор' : selectedTitle }}</span>
              <v-chip
                v-if="isEditing && isDirty"
                size="x-small"
                color="accent"
                variant="tonal"
              >
                Не сохранено
              </v-chip>
            </div>
            <div
              v-if="!isNew"
              class="text-caption text-medium-emphasis"
            >
              {{ selected?.phase_name || 'Этап не указан' }} · сезонов {{ selected?.history_count || 0 }}
            </div>
          </div>
          <v-btn
            icon
            variant="text"
            aria-label="Закрыть"
            @click="detailsVisible = false"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <StateView
            variant="form"
            :rows="8"
            :loading="detailsLoading"
            :error="detailsError"
            :empty="!detailsLoading && !detailsError && !selected && !isEditing"
            empty-title="Карточка не выбрана"
            :retry="false"
          >
            <template v-if="selected || isEditing">
              <JournalDetailFields
                :groups="detailGroups"
                :model="editFields"
                :editable="editable"
                :is-field-dirty="isFieldDirty"
                @update:field="setEditField"
              >
                <v-expansion-panel
                  v-if="history.length && !isEditing"
                  :value="detailGroups.length"
                >
                  <v-expansion-panel-title>История по отопительным сезонам ({{ history.length }})</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-card
                      v-for="entry in history"
                      :key="Number(entry.id)"
                      variant="outlined"
                      class="mb-3 pa-3"
                    >
                      <div class="d-flex align-center flex-wrap ga-2">
                        <strong>{{ seasonLabel(entry) }}</strong>
                        <v-chip
                          size="x-small"
                          :color="phaseColor(Number(entry.phase_id))"
                          variant="tonal"
                        >
                          {{ entry.phase_name || 'Этап не задан' }}
                        </v-chip>
                      </div>
                      <div class="text-body-2 mt-2">
                        План: {{ formatDate(entry.planned_on) }} · установка: {{ formatDate(entry.installed_on) }} · извлечение: {{ formatDate(entry.extracted_on) }}
                      </div>
                      <div class="text-body-2 mt-1">
                        Скорость: {{ corrosionRate(entry.corrosion_rate) }} · оценка: {{ entry.process_mark_name || '—' }} · вода: {{ entry.water_aggressiveness_name || '—' }}
                      </div>
                      <div
                        v-if="entry.note"
                        class="text-caption text-medium-emphasis mt-2"
                      >
                        {{ entry.note }}
                      </div>
                    </v-card>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </JournalDetailFields>
            </template>
          </StateView>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-btn
            v-if="!isEditing && selected && hasCoordinates(selected)"
            prepend-icon="mdi-crosshairs-gps"
            color="primary"
            variant="tonal"
            @click="locateSelected"
          >
            На карте
          </v-btn>
          <v-btn
            v-if="mutationsEnabled && !isEditing && selected"
            variant="text"
            prepend-icon="mdi-pencil"
            @click="startEdit"
          >
            Редактировать
          </v-btn>
          <v-btn
            v-if="mutationsEnabled && !isEditing && selected && !isNew"
            color="error"
            variant="text"
            prepend-icon="mdi-delete"
            :loading="deleting"
            @click="deleteIndicator(selected.id)"
          >
            Удалить
          </v-btn>
          <v-spacer />
          <template v-if="isEditing">
            <v-btn
              v-if="mutationsEnabled"
              variant="text"
              @click="cancelEdit"
            >
              Отмена
            </v-btn>
            <v-btn
              v-if="mutationsEnabled"
              color="primary"
              variant="flat"
              :loading="saving"
              :disabled="!isNew && !isDirty"
              @click="saveChanges"
            >
              Сохранить
            </v-btn>
          </template>
          <v-btn
            v-else
            variant="text"
            @click="detailsVisible = false"
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
import KpiTile, { type KpiStatus } from '~/components/KpiTile.vue'
import SearchField from '~/components/SearchField.vue'
import StateView from '~/components/StateView.vue'
import { hasLonLat } from '~/utils/journalFields'
import { useCloseOnMapPick } from '~/composables/useJournalMapBridge'
import { formatApiErrorWith } from '~/utils/apiError'
import { confirmAction } from '~/composables/useConfirm'
import { computed, reactive, ref, watch } from 'vue'
import { useJournalEdit } from '~/composables/useJournalEdit'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import { useNotificationStore } from '~/stores/notificationStore'
import { CORROSION_COLUMN_BY_KEY, changedColumns, corrosionEditableKey, filledColumns } from '~/utils/registryEdit'
import {
  fastApiService,
  type CorrosionIndicatorDetails,
  type CorrosionIndicatorLookups,
  type CorrosionIndicatorSummary
} from '~/services/fastApiService'

/**
 * Индикаторы коррозии — тип (а) (docs/ui-modernization-progress.md, этап 5): `DataTable`, плитки этапов
 * из `state_counts`, фильтры `SearchField` / `AppSelect`, `StateView`; карточка на `JournalDetailFields` +
 * `useJournalEdit` (черновик, «изменено»). Запись — универсальный CRUD колонок `indikator_korrozii`
 * (QA F42): записываемые ключи задаёт `CORROSION_COLUMN_BY_KEY`, поля сезона — только без истории.
 */
export interface CorrosionIndicatorJournalScope { lineId?: number; nodeId?: number; indicatorId?: number }
const emit = defineEmits<{
  'locate-corrosion-indicator': [coordinates: { longitude: number; latitude: number; id: number; label: string }]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled('corrosion')
const visible = ref(false), loading = ref(false), error = ref('')
const items = ref<CorrosionIndicatorSummary[]>([])
const total = ref(0), pages = ref(0), page = ref(1)
const pageSize = 50
const search = ref(''), dateFrom = ref(''), dateTo = ref('')
const phaseId = ref<number | undefined>(), rodStateId = ref<number | undefined>()
const processMarkId = ref<number | undefined>(), waterAggressivenessId = ref<number | undefined>()
const seasonYear = ref<number | undefined>()
const scope = reactive<CorrosionIndicatorJournalScope>({})
const lookups = reactive<CorrosionIndicatorLookups>({
  phases: [], rod_states: [], process_marks: [], water_aggressiveness: [], coolant_types: [],
  pipeline_signs: [], responsible_people: [], years: []
})
/** Счётчики по этапам из ответа списка; null — API их не отдаёт (плитки скрыты) */
const stateCounts = ref<{ state_id: number | null; count: number }[] | null>(null)
const detailsVisible = ref(false), detailsLoading = ref(false), detailsError = ref('')
// Другой журнал начал выбор участков на карте — закрыть это окно (QA F48)
useCloseOnMapPick(() => visible.value || detailsVisible.value, () => { detailsVisible.value = false; visible.value = false })
const selected = ref<CorrosionIndicatorDetails | null>(null)
const creating = ref(false)
const deleting = ref(false)

const scopeTitle = computed(() => scope.lineId ? `индикаторы линии ${scope.lineId}` : scope.nodeId ? `индикаторы у узла ${scope.nodeId}` : 'вся тепловая сеть')
const selectedTitle = computed(() => selected.value?.number ? `Индикатор № ${selected.value.number}` : `Индикатор ${selected.value?.id || ''}`)
const filtersActive = computed(() => Boolean(
  search.value.trim() || phaseId.value || rodStateId.value || processMarkId.value || waterAggressivenessId.value
  || seasonYear.value || dateFrom.value || dateTo.value,
))

const tableColumns: DataTableColumn[] = [
  { key: 'number', title: 'Индикатор', width: 170, sortable: false },
  { key: 'phase_name', title: 'Этап', width: 120, sortable: false },
  { key: 'dates', title: 'План / установка / извлечение', type: 'date', width: 200, sortable: false },
  { key: 'place', title: 'Место', sortable: false },
  { key: 'line', title: 'Участок сети', width: 190, sortable: false },
  { key: 'corrosion_rate', title: 'Скорость', type: 'number', width: 120, sortable: false },
  { key: 'process_mark_name', title: 'Оценка', width: 160, sortable: false },
  { key: 'history_count', title: 'История', type: 'number', width: 90, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 56, sortable: false },
]

/** Этап индикатора → тон плитки: план — нейтрально, анализ — внимание, после расчёта — в порядке, архив — нейтрально */
const PHASE_STATUS: Record<number, KpiStatus> = { 1: 'none', 2: 'warning', 3: 'good', 4: 'none' }
const phaseTiles = computed(() => {
  if (!stateCounts.value) return []
  const counts = new Map(stateCounts.value.map((c) => [c.state_id, c.count]))
  return (lookups.phases as { id: number; name: string }[]).map((phase) => ({
    id: phase.id,
    name: phase.name,
    count: counts.get(phase.id) ?? 0,
    status: PHASE_STATUS[phase.id] ?? 'none',
  }))
})
const togglePhase = (id: number) => {
  phaseId.value = phaseId.value === id ? undefined : id
}

const formatDate = (value: unknown) => {
  if (!value) return '—'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value)
}
const formatValue = (value: unknown) => value === null || value === undefined || value === '' ? '—' : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value) : String(value)
const corrosionRate = (value: unknown) => value === null || value === undefined || value === '' ? '—' : `${Number(value).toLocaleString('ru-RU')} мм/год`
const phaseColor = (phase: number | null) => phase === 1 ? 'info' : phase === 2 ? 'warning' : phase === 3 ? 'success' : 'grey'
const hasCoordinates = (item: { longitude?: unknown; latitude?: unknown }) => hasLonLat(item)
const nodeRange = (item: CorrosionIndicatorSummary) => [item.start_node_name, item.end_node_name].filter(Boolean).join(' — ') || item.linked_node_name || 'узлы не указаны'
const seasonLabel = (entry: Record<string, unknown>) => {
  const value = entry.installed_on || entry.planned_on
  const match = String(value || '').match(/^(\d{4})/)
  return match ? `Сезон ${match[1]}–${Number(match[1]) + 1}` : `Запись ${entry.id}`
}
const buildFields = (entries: Array<[string, unknown, string?, string?, any[]?]>): JournalDetailField[] => {
  return entries
    .filter(([, value]) => isEditing.value || (value !== null && value !== undefined && value !== ''))
    .map(([label, value, key, type, items]) => ({
      label, value: formatValue(value), rawValue: value, key, type: type || 'text', items
    }))
}

const loadLookups = async () => { if (!lookups.phases.length) Object.assign(lookups, await fastApiService.getCorrosionIndicatorLookups()) }
/** Номер последнего запроса списка */
let listRequest = 0
const loadIndicators = async () => {
  const request = ++listRequest
  loading.value = true; error.value = ''
  try {
    const response = await fastApiService.getCorrosionIndicators({
      page: page.value, page_size: pageSize, phase_id: phaseId.value, rod_state_id: rodStateId.value,
      process_mark_id: processMarkId.value, water_aggressiveness_id: waterAggressivenessId.value,
      season_year: seasonYear.value, date_from: dateFrom.value || undefined, date_to: dateTo.value || undefined,
      line_id: scope.lineId, node_id: scope.nodeId, search: search.value.trim() || undefined
    })
    if (request !== listRequest) return
    items.value = response.items; total.value = response.total; pages.value = response.pages
    stateCounts.value = Array.isArray(response.state_counts) ? response.state_counts : null
  } catch (loadError: any) {
    if (request !== listRequest) return
    error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить журнал индикаторов коррозии'
  } finally { if (request === listRequest) loading.value = false }
}
/** Текст после паузы ввода (SearchField) */
const onSearch = () => {
  if (!visible.value) return
  page.value = 1
  void loadIndicators()
}
/** Номер последнего запроса карточки: ответ более раннего запроса не перекрывает поздний */
let detailsRequest = 0
const openDetails = async (id: number) => {
  // карточка существующей записи всегда открывается на просмотр (QA F46: после неудачного
  // создания флаги isNew/isEditing оставались, и сохранение слало POST create — дубль)
  closeKeepingDraft(); resetEdit()
  const request = ++detailsRequest
  detailsVisible.value = true; detailsLoading.value = true; detailsError.value = ''; selected.value = null
  try { const record = await fastApiService.getCorrosionIndicator(id); if (request !== detailsRequest) return; selected.value = record }
  catch (loadError: any) { if (request !== detailsRequest) return; detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку индикатора' }
  finally { if (request === detailsRequest) detailsLoading.value = false }
}
let openDialogSeq = 0
const openDialog = async (nextScope: CorrosionIndicatorJournalScope = {}) => {
  const seq = ++openDialogSeq
  Object.assign(scope, { lineId: undefined, nodeId: undefined, indicatorId: undefined }, nextScope)
  page.value = 1; visible.value = true
  // список сам показывает свою ошибку; сбой справочников не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), loadIndicators()])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — фильтры и выбор значений могут быть неполными'))
  // журнал открыли снова, пока грузились списки — запись открывает последний вызов
  if (seq !== openDialogSeq) return
  if (nextScope.indicatorId) await openDetails(nextScope.indicatorId)
}
const clearScope = () => { scope.lineId = undefined; scope.nodeId = undefined; page.value = 1; void loadIndicators() }
const resetFilters = () => {
  search.value = ''; phaseId.value = undefined; rodStateId.value = undefined; processMarkId.value = undefined
  waterAggressivenessId.value = undefined; seasonYear.value = undefined; dateFrom.value = ''; dateTo.value = ''
  page.value = 1; void loadIndicators()
}
const locateSelected = () => {
  const item = selected.value
  if (!item || !hasCoordinates(item)) return
  emit('locate-corrosion-indicator', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, label: item.number ? `Индикатор № ${item.number}` : `Индикатор ${item.id}` })
  detailsVisible.value = false; visible.value = false
}

/** Ключ поля для правки: только колонки indikator_korrozii; поля сезона — если нет истории */
const editKey = (key: string) => isNew.value
  ? (key in CORROSION_COLUMN_BY_KEY ? key : undefined)
  : corrosionEditableKey(key, Number(selected.value?.history_count || 0))

/** Записываемые поля реестра — для признака «изменено» и черновика (вместо схемы журнала) */
const editSource = {
  schema: computed(() => ({ fields: CORROSION_COLUMN_BY_KEY as Record<string, unknown> })),
  isWritable: (key?: string | null) => Boolean(key && editKey(key)),
  // схема реестра известна заранее — загрузки нет, но useJournalEdit ждёт признак «есть»
  loadSchema: async () => true,
}
const {
  isEditing, isNew, saving, editFields, flashId, isDirty, isFieldDirty, editable, setEditField,
  beginCreate, beginEdit, resetEdit, cancel, closeKeepingDraft, markSaved, forgetDraft,
} = useJournalEdit('corrosion-indicators', editSource, selected)

const detailGroups = computed((): JournalDetailGroup[] => {
  const item = isEditing.value ? editFields.value : selected.value
  if (!item && !isNew.value) return []
  const k = editKey
  return [
    { title: 'Размещение и сеть', fields: buildFields([
      ['Номер индикатора', item?.number, k('number'), 'text'], ['Этап', item?.phase_name, k('phase_id'), 'select', lookups.phases], ['Место установки', item?.installation_place, k('installation_place'), 'textarea'], ['Адрес', item?.address],
      ['Линия', item?.line_id, k('line_id'), 'number'], ['Узел', item?.node_id, k('node_id'), 'number'], ['Узлы линии', !isEditing.value ? nodeRange(item as CorrosionIndicatorSummary) : undefined], ['Диаметр, мм', item?.diameter],
      ['Признак трубопровода', item?.pipeline_sign_name, k('pipeline_sign_id'), 'select', lookups.pipeline_signs], ['Теплоноситель', item?.coolant_type_name, k('coolant_type_id'), 'select', lookups.coolant_types], ['Источник тепла', item?.heat_source_name, k('heat_source_name'), 'text'],
      ['Участок эксплуатации', item?.operation_site_name, k('operation_site_name'), 'text'], ['Сеть', item?.network_name, k('network_name'), 'text'], ['Начальник участка', item?.site_manager_name, k('site_manager_name'), 'text']
    ]) },
    { title: 'План и экспозиция', fields: buildFields([
      ['Дата планирования', item?.planned_on, k('planned_on'), 'date'], ['Дата установки', item?.installed_on, k('installed_on'), 'date'], ['Дата извлечения', item?.extracted_on, k('extracted_on'), 'date'],
      ['Состояние стержня', item?.rod_state_name, k('rod_state_id'), 'select', lookups.rod_states], ['Ответственный', item?.responsible_name, k('responsible_id'), 'select', lookups.responsible_people], ['Должность', item?.position_name],
      ['Количество пластин', item?.plate_count, k('plate_count'), 'number'], ['Начальный средний вес, г', item?.initial_plate_weight, k('initial_plate_weight'), 'number'],
      ['Радиус пластины, мм', item?.plate_radius, k('plate_radius'), 'number'], ['Радиус втулки, мм', item?.bush_radius, k('bush_radius'), 'number'], ['Толщина пластины, мм', item?.plate_thickness, k('plate_thickness'), 'number']
    ]) },
    { title: 'Результаты обработки', fields: buildFields([
      ['Конечный средний вес, г', item?.final_plate_weight, k('final_plate_weight'), 'number'], ['Потеря массы при кислотной обработке, г', item?.acid_treatment_mass_loss, k('acid_treatment_mass_loss'), 'number'],
      ['Средняя скорость коррозии, мм/год', item?.corrosion_rate, k('corrosion_rate'), 'number'], ['Оценка коррозионного процесса', item?.process_mark_name, k('process_mark_id'), 'select', lookups.process_marks],
      ['Агрессивность сетевой воды', item?.water_aggressiveness_name, k('water_aggressiveness_id'), 'select', lookups.water_aggressiveness], ['Внешний вид пластин', item?.plate_external_view, k('plate_external_view'), 'textarea'], ['Примечание', item?.note, k('note'), 'textarea']
    ]) },
    { title: 'Камеры и характеристики участка', fields: buildFields([
      ['Начальная камера', item?.start_chamber_name, k('start_chamber_name'), 'text'], ['Код начальной камеры', item?.start_chamber_code, k('start_chamber_code'), 'text'],
      ['Конечная камера', item?.end_chamber_name, k('end_chamber_name'), 'text'], ['Код конечной камеры', item?.end_chamber_code, k('end_chamber_code'), 'text'],
      ['Ближайшая камера', item?.nearest_chamber_name, k('nearest_chamber_name'), 'text'], ['Код ближайшей камеры', item?.nearest_chamber_code, k('nearest_chamber_code'), 'text'],
      ['Расстояние до камеры, м', item?.chamber_distance, k('chamber_distance'), 'number'], ['Ввод в эксплуатацию', item?.commissioned_on, k('commissioned_on'), 'date'],
      ['Вид прокладки', item?.tubing_type_name], ['Диаметр подачи, мм', item?.flow_diameter, k('flow_diameter'), 'number'], ['Диаметр обратки, мм', item?.return_diameter, k('return_diameter'), 'number']
    ]) }
  ].filter(group => group.fields.length)
})
const history = computed(() => selected.value?.relations?.history || [])

const startEdit = () => beginEdit()

const cancelEdit = async () => {
  const { closed, wasNew } = await cancel()
  if (closed && wasNew) detailsVisible.value = false
}

// Карточка закрыта крестиком или Esc во время правки — черновик остаётся до следующего открытия
watch(detailsVisible, (open) => {
  if (!open) closeKeepingDraft()
})

const createIndicator = async () => {
  creating.value = true
  try { await loadLookups() } finally { creating.value = false }
  selected.value = null
  detailsError.value = ''
  detailsVisible.value = true
  await beginCreate({ line_id: scope.lineId, node_id: scope.nodeId })
}

const notifications = useNotificationStore()
/** Колонки, которые правятся в этой карточке (с учётом истории сезонов) */
const editableColumns = () => Object.fromEntries(
  Object.entries(CORROSION_COLUMN_BY_KEY).filter(([key]) => editKey(key))
)

const saveChanges = async () => {
  saving.value = true
  try {
    if (isNew.value) {
      // универсальный CRUD пишет колонки таблицы, а не ключи API карточки (QA F42)
      const fields = filledColumns(editFields.value, CORROSION_COLUMN_BY_KEY)
      if (!Object.keys(fields).length) {
        notifications.showError('Заполните хотя бы одно поле индикатора')
        return
      }
      const result = await fastApiService.createObject('indikator_korrozii', fields)
      if (!result?.id) throw new Error('Сервер не вернул идентификатор созданной записи')
      {
        notifications.showSuccess(`Индикатор ${result.id} создан`)
        markSaved(Number(result.id))
        await loadIndicators()
        await openDetails(result.id)
      }
    } else if (selected.value) {
      const id = selected.value.id
      const changes = changedColumns(selected.value, editFields.value, editableColumns())
      if (!Object.keys(changes).length) {
        notifications.showInfo('Изменений нет — сохранять нечего')
        return
      }
      await fastApiService.updateObjectAttributes('indikator_korrozii', String(id), changes)
      notifications.showSuccess('Изменения индикатора сохранены')
      markSaved(id)
      await loadIndicators()
      await openDetails(id)
    }
  } catch (e: any) {
    // форма остаётся открытой с введёнными значениями
    notifications.showError(formatApiErrorWith('Ошибка при сохранении', e))
  } finally {
    saving.value = false
  }
}

const deleteIndicator = async (id: number) => {
  if (!(await confirmAction({ text: `Удалить индикатор коррозии №${id}? Действие необратимо.`, action: 'Удалить' }))) return
  try {
    deleting.value = true
    await fastApiService.deleteObject('indikator_korrozii', id)
    forgetDraft(id)
    notifications.showSuccess(`Индикатор ${id} удалён`)
    detailsVisible.value = false
    await loadIndicators()
  } catch (e: any) {
    notifications.showError(formatApiErrorWith('Ошибка при удалении', e))
  } finally {
    deleting.value = false
  }
}

watch(page, () => { if (visible.value) void loadIndicators() })
watch([phaseId, rodStateId, processMarkId, waterAggressivenessId, seasonYear, dateFrom, dateTo], () => { if (visible.value) { page.value = 1; void loadIndicators() } })
defineExpose({ openDialog })
</script>

<style scoped>
.corrosion-journal { height: min(90vh, 920px); display: flex; flex-direction: column; }
.corrosion-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.corrosion-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.corrosion-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.corrosion-table { min-width: 1320px; }
.wide-cell { display: inline-block; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
.cell-note { color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); font-size: .75rem; margin-top: 2px; }
@media (max-width: 600px) { .corrosion-journal { height: 100dvh; } }
</style>
