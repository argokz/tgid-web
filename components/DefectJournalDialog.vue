<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1240"
      scrollable
    >
      <v-card
        class="defect-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="deep-orange-lighten-5"
            size="40"
          >
            <v-icon color="deep-orange-darken-2">mdi-alert-decagram-outline</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Журнал нарушений</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }}
            </div>
          </div>
          <v-btn
            color="secondary"
            variant="tonal"
            prepend-icon="mdi-printer"
            class="mr-2"
            @click="openForm11Report"
          >
            Печать (Форма 11)
          </v-btn>
          <v-btn
            v-if="mutationsEnabled"
            color="primary"
            variant="flat"
            prepend-icon="mdi-plus"
            class="mr-2"
            :loading="creating"
            @click="createDefect"
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

        <!-- Плитки из данных ответа: всего и по состояниям (счётчики — при тех же фильтрах); плитка состояния — фильтр -->
        <div
          v-if="stateTiles.length"
          class="defect-kpi px-3 px-md-4 pt-3"
        >
          <KpiTile
            label="Найдено"
            :value="total"
            :compact="false"
          />
          <KpiTile
            v-for="tile in stateTiles"
            :key="tile.id"
            :label="tile.name"
            :value="tile.count"
            :compact="false"
            :status="tile.status"
            selectable
            :active="stateId === tile.id"
            @select="toggleState(tile.id)"
          />
        </div>

        <div class="pa-3 pa-md-4 defect-filters">
          <v-row dense>
            <v-col
              cols="12"
              md="4"
            >
              <SearchField
                :model-value="search"
                label="Поиск по ID, адресу, описанию или акту"
                :debounce="350"
                :loading="loading"
                @update:model-value="search = $event"
                @search="onSearch"
              />
            </v-col>
            <v-col
              cols="12"
              sm="4"
              md="2"
            >
              <AppSelect
                v-model="sourceId"
                :items="lookups.sources"
                item-title="name"
                item-value="id"
                label="Источник"
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
              sm="4"
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
              Трубопровод {{ scope.lineId }}
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
            <AppSelect
              v-model="categoryId"
              :items="lookups.categories"
              item-title="name"
              item-value="id"
              label="Категория"
              class="category-filter"
            />
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
              @click="loadDefects"
            >
              Обновить
            </v-btn>
          </div>
        </div>

        <v-divider />

        <v-card-text class="pa-0 defect-table-wrap">
          <StateView
            variant="table"
            :rows="10"
            :loading="loading && !items.length"
            :error="error"
            :empty="!loading && !items.length"
            empty-title="Нарушения не найдены"
            :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В журнале пока нет записей — проверьте загрузку исторических данных TGID'"
            empty-icon="mdi-clipboard-alert-outline"
            :action-label="filtersActive ? 'Сбросить фильтры' : undefined"
            :retrying="loading"
            @retry="loadDefects"
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
              :selected-key="flashId"
              density="compact"
              class="defect-table"
              @select="openDetails(Number($event.id))"
            >
              <template #[`item.detected_at`]="{ item }">
                {{ formatDate(item.detected_at) }}
              </template>
              <template #[`item.source_name`]="{ item }">
                {{ item.source_name || '—' }}
              </template>
              <template #[`item.state_name`]="{ item }">
                <v-chip
                  size="x-small"
                  :color="stateColor(Number(item.state_id))"
                  variant="tonal"
                >
                  {{ item.state_name || 'Не задано' }}
                </v-chip>
              </template>
              <template #[`item.address`]="{ item }">
                <div class="text-truncate">
                  {{ item.address || nodeRange(item as DefectSummary) || '—' }}
                </div>
                <div
                  v-if="item.line_id"
                  class="text-caption text-medium-emphasis"
                >
                  Линия {{ item.line_id }}
                </div>
              </template>
              <template #[`item.description`]="{ item }">
                <span
                  class="description-cell"
                  :title="String(item.description || item.report_note || '')"
                >{{ item.description || item.report_note || '—' }}</span>
              </template>
              <template #[`item.actions`]="{ item }">
                <HintTip
                  v-if="hasCoordinates(item as DefectSummary)"
                  text="Показать на карте"
                  hint="Журнал закроется, маркер останется"
                >
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-crosshairs-gps"
                      size="x-small"
                      variant="text"
                      color="primary"
                      aria-label="Показать нарушение на карте"
                      @click.stop="locate(item as DefectSummary)"
                    />
                  </template>
                </HintTip>
                <HintTip text="Открыть карточку">
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-chevron-right"
                      size="x-small"
                      variant="text"
                      aria-label="Открыть карточку нарушения"
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
          <span class="text-caption text-medium-emphasis">
            Страница {{ page }}{{ pages ? ` из ${pages}` : '' }}
          </span>
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
      :fullscreen="isMobile"
      max-width="920"
      scrollable
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="deep-orange-darken-2">mdi-alert-circle-outline</v-icon>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <span>{{ isNew ? 'Новое нарушение' : `Нарушение ${selected?.id || ''}` }}</span>
              <v-chip
                v-if="isEditing && isDirty"
                size="x-small"
                color="accent"
                variant="tonal"
                class="num"
              >
                Не сохранено
              </v-chip>
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ selected?.source_name || 'Источник не указан' }} · {{ selected?.state_name || 'Состояние не указано' }}
            </div>
          </div>
          <HintTip
            v-if="mutationsEnabled && selected && !isEditing"
            text="Удалить нарушение"
            hint="С подтверждением; действие попадёт в журнал"
            location="bottom"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                aria-label="Удалить"
                color="error"
                class="mr-1"
                :loading="deleting"
                @click="deleteDefect(selected!.id)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </HintTip>
          <v-btn
            icon
            variant="text"
            aria-label="Закрыть карточку"
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
                :required-keys="['detected_at']"
                @update:model="editFields = $event"
              >
                <v-expansion-panel
                  v-if="relationGroups.length && !isEditing"
                  :value="detailGroups.length"
                >
                  <v-expansion-panel-title>Причины, элементы и ремонтные работы</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div
                      v-for="relation in relationGroups"
                      :key="relation.label"
                      class="mb-4"
                    >
                      <div class="detail-label mb-1">
                        {{ relation.label }}
                      </div>
                      <div class="d-flex flex-wrap ga-1">
                        <v-chip
                          v-for="(value, index) in relation.values"
                          :key="index"
                          size="small"
                          variant="tonal"
                        >
                          {{ value }}
                        </v-chip>
                      </div>
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </JournalDetailFields>
              <JournalRecordPanels
                v-if="selected && !isEditing"
                class="mt-4"
                journal="defects"
                :record-id="selected.id"
                :record-label="selected.name || `Нарушение ${selected.id}`"
                @changed="refreshSelected"
              />
            </template>
          </StateView>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-btn
            v-if="selected && hasCoordinates(selected) && !isEditing"
            prepend-icon="mdi-crosshairs-gps"
            variant="tonal"
            color="primary"
            @click="locate(selected)"
          >
            На карте
          </v-btn>
          <v-spacer />
          <v-btn
            v-if="selected && !isEditing"
            prepend-icon="mdi-file-word-box"
            variant="tonal"
            color="primary"
            :loading="reportLoading"
            @click="downloadReport"
          >
            Карта нарушения
          </v-btn>
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
              variant="elevated"
              :loading="saving"
              :disabled="!isNew && !isDirty"
              @click="saveChanges"
            >
              Сохранить
            </v-btn>
          </template>
          <template v-else>
            <v-btn
              v-if="mutationsEnabled"
              color="primary"
              variant="tonal"
              @click="startEdit"
            >
              Редактировать
            </v-btn>
            <v-btn
              variant="text"
              @click="detailsVisible = false"
            >
              Закрыть
            </v-btn>
          </template>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="notificationVisible"
      :color="notificationColor"
      timeout="3500"
    >
      {{ notificationMessage }}
    </v-snackbar>
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
import { hasLonLat, localToday } from '~/utils/journalFields'
import { useCloseOnMapPick } from '~/composables/useJournalMapBridge'
import { formatApiError } from '~/utils/apiError'
import { computed, reactive, ref, watch } from 'vue'
import { useJournalEdit } from '~/composables/useJournalEdit'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import { useJournalRecordForm } from '~/composables/useJournalRecordForm'
import {
  fastApiService,
  type DefectDetails,
  type DefectLookups,
  type DefectSummary
} from '~/services/fastApiService'

/**
 * Журнал нарушений — тип (а) «запись плюс форма» (docs/ui-modernization-progress.md, этап 5): таблица на
 * `DataTable` с серверной пагинацией, `SearchField` + `AppSelect`-фильтры, плитки состояний из `state_counts`
 * ответа API (если API их отдаёт), состояния `StateView`, карточка на `FieldGrid` / `FieldCell` с локальным
 * черновиком (`useJournalDraft`): правки сохраняются в базу только по «Сохранить».
 */
export interface DefectJournalScope {
  lineId?: number
  nodeId?: number
  defectId?: number
}

const emit = defineEmits<{
  'locate-defect': [coordinates: { longitude: number; latitude: number; id: number }]
}>()

const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()

const openForm11Report = () => {
  const url = fastApiService.getFormReportUrl('f11_defect', search.value)
  window.open(url, '_blank')
}

const visible = ref(false)
const loading = ref(false)
const error = ref('')
const items = ref<DefectSummary[]>([])
const total = ref(0)
const pages = ref(0)
const page = ref(1)
const pageSize = 50
const search = ref('')
const sourceId = ref<number | undefined>()
const stateId = ref<number | undefined>()
const categoryId = ref<number | undefined>()
const dateFrom = ref('')
const dateTo = ref('')
const scope = reactive<DefectJournalScope>({})
const lookups = reactive<DefectLookups>({ sources: [], states: [], categories: [] })
/** Счётчики по состояниям из ответа списка; null — API их не отдаёт (плитки скрыты) */
const stateCounts = ref<{ state_id: number | null; count: number }[] | null>(null)

const detailsVisible = ref(false)
// Другой журнал начал выбор участков на карте — закрыть это окно (QA F48)
useCloseOnMapPick(() => visible.value || detailsVisible.value, () => { detailsVisible.value = false; visible.value = false })
const detailsLoading = ref(false)
const detailsError = ref('')
const selected = ref<DefectDetails | null>(null)
const reportLoading = ref(false)
const notificationVisible = ref(false)
const notificationMessage = ref('')
const notificationColor = ref<'success' | 'error'>('success')
const creating = ref(false)
const deleting = ref(false)

const scopeTitle = computed(() => {
  if (scope.lineId) return `нарушения трубопровода ${scope.lineId}`
  if (scope.nodeId) return `нарушения узла и прилегающих трубопроводов ${scope.nodeId}`
  return 'вся тепловая сеть'
})

const filtersActive = computed(() => Boolean(
  search.value.trim() || sourceId.value || stateId.value || categoryId.value || dateFrom.value || dateTo.value,
))

const tableColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 80, sortable: false },
  { key: 'detected_at', title: 'Дата', type: 'date', width: 110, sortable: false },
  { key: 'source_name', title: 'Источник', width: 140, sortable: false },
  { key: 'state_name', title: 'Состояние', width: 130, sortable: false },
  { key: 'address', title: 'Адрес / участок', sortable: false },
  { key: 'description', title: 'Описание', sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false },
]

/** Состояние → тон плитки: нарушение — проблема, ремонт — внимание, после ремонта — в порядке */
const STATE_STATUS: Record<number, KpiStatus> = { 1: 'serious', 2: 'warning', 3: 'good' }

const stateTiles = computed(() => {
  if (!stateCounts.value) return []
  const counts = new Map(stateCounts.value.map((c) => [c.state_id, c.count]))
  return (lookups.states as { id: number; name: string }[]).map((state) => ({
    id: state.id,
    name: state.name,
    count: counts.get(state.id) ?? 0,
    status: STATE_STATUS[state.id] ?? 'none',
  }))
})

const toggleState = (id: number) => {
  stateId.value = stateId.value === id ? undefined : id
}

const formatDate = (value: unknown) => {
  if (!value) return '—'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value)
}

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value)
  return String(value)
}

const nodeRange = (item: DefectSummary) =>
  [item.line_start_node, item.line_end_node].filter(Boolean).join(' — ')

const stateColor = (value: number | null) => {
  if (value === 1) return 'error'
  if (value === 2) return 'warning'
  if (value === 3) return 'success'
  return 'grey'
}

const hasCoordinates = (item: Pick<DefectSummary, 'longitude' | 'latitude'>) => hasLonLat(item)

const loadLookups = async () => {
  if (lookups.sources.length) return
  const result = await fastApiService.getDefectLookups()
  Object.assign(lookups, result)
}

const loadDefects = async () => {
  loading.value = true
  error.value = ''
  try {
    const result = await fastApiService.getDefects({
      page: page.value,
      page_size: pageSize,
      source_id: sourceId.value,
      state_id: stateId.value,
      category_id: categoryId.value,
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
      line_id: scope.lineId,
      node_id: scope.nodeId,
      search: (search.value || '').trim() || undefined
    })
    items.value = result.items
    total.value = result.total
    pages.value = result.pages
    stateCounts.value = Array.isArray(result.state_counts) ? result.state_counts : null
  } catch (loadError: any) {
    error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить журнал нарушений'
  } finally {
    loading.value = false
  }
}

/** Текст после паузы ввода (SearchField) */
const onSearch = () => {
  if (!visible.value) return
  page.value = 1
  void loadDefects()
}

const openDetails = async (defectId: number) => {
  detailsVisible.value = true
  detailsLoading.value = true
  detailsError.value = ''
  selected.value = null
  try {
    selected.value = await fastApiService.getDefect(defectId)
  } catch (loadError: any) {
    detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку нарушения'
  } finally {
    detailsLoading.value = false
  }
}

const openDialog = async (nextScope: DefectJournalScope = {}) => {
  Object.assign(scope, { lineId: undefined, nodeId: undefined, defectId: undefined }, nextScope)
  page.value = 1
  visible.value = true
  try {
    await Promise.all([loadLookups(), loadDefects(), recordForm.loadSchema()])
    if (nextScope.defectId) await openDetails(nextScope.defectId)
  } catch (loadError: any) {
    error.value = loadError?.message || 'Не удалось открыть журнал нарушений'
  }
}

const clearScope = () => {
  scope.lineId = undefined
  scope.nodeId = undefined
  page.value = 1
  void loadDefects()
}

const recordForm = useJournalRecordForm('defects')
// data_osmotra — timestamp ('2024-05-01T00:00:00'), поле type="date" его не показывает (QA F80)
const {
  isEditing, isNew, saving, editFields, flashId, isDirty, isFieldDirty, editable,
  beginCreate, beginEdit, cancel, closeKeepingDraft, markSaved, forgetDraft,
} = useJournalEdit('defects', recordForm, selected, { dateKeys: ['detected_at', 'repair_started_on', 'repair_finished_on'] })

const createDefect = async () => {
  // точка нарушения ставится на середину выбранного трубопровода (сервер), дата — сегодня
  selected.value = null
  detailsVisible.value = true
  detailsError.value = ''
  await beginCreate({ detected_at: localToday(), line_id: scope.lineId ?? null })
}

const startEdit = () => beginEdit()

const cancelEdit = async () => {
  if (!(await cancel())) return
  if (isNew.value) detailsVisible.value = false
}

// Карточка закрыта крестиком или Esc во время правки — черновик остаётся до следующего открытия
watch(detailsVisible, (open) => {
  if (!open) closeKeepingDraft()
})

const saveChanges = async () => {
  saving.value = true
  detailsError.value = ''
  try {
    const id = await recordForm.save({
      isNew: isNew.value, id: selected.value?.id, original: selected.value as Record<string, unknown> | null,
      edited: editFields.value,
    })
    markSaved(id)
    await loadDefects()
    if (id) await openDetails(id)
  } catch (e: any) {
    recordForm.showError(formatApiError(e, 'Ошибка при сохранении'))
  } finally {
    saving.value = false
  }
}

const deleteDefect = async (id: number) => {
  deleting.value = true
  try {
    if (await recordForm.remove(id, selected.value?.name || `Нарушение ${id}`)) {
      forgetDraft(id)
      detailsVisible.value = false
      await loadDefects()
    }
  } finally {
    deleting.value = false
  }
}

const refreshSelected = async () => {
  if (!selected.value) return
  try { selected.value = await fastApiService.getDefect(selected.value.id) } catch { /* остаётся прежняя */ }
}

const resetFilters = () => {
  search.value = ''
  sourceId.value = undefined
  stateId.value = undefined
  categoryId.value = undefined
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
  void loadDefects()
}

const locate = (item: DefectSummary) => {
  if (!hasCoordinates(item)) return
  emit('locate-defect', {
    longitude: Number(item.longitude),
    latitude: Number(item.latitude),
    id: item.id
  })
  detailsVisible.value = false
  visible.value = false
}

const downloadReport = async () => {
  if (!selected.value) return
  reportLoading.value = true
  try {
    const { blob, filename } = await fastApiService.downloadWordReport(selected.value.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    notificationMessage.value = `Сформирован отчёт «${filename}»`
    notificationColor.value = 'success'
  } catch (reportError: any) {
    notificationMessage.value = reportError?.message || 'Не удалось сформировать Word-отчёт'
    notificationColor.value = 'error'
  } finally {
    notificationVisible.value = true
    reportLoading.value = false
  }
}

const buildFields = (entries: Array<[string, unknown, string?, string?, any?] | null>): JournalDetailField[] => {
  return entries
    .filter(e => e != null)
    .map(e => e!)
    .filter(([, value]) => isEditing.value || (value !== null && value !== undefined && value !== ''))
    .map(([label, value, key, type, items]) => ({
      label,
      value: formatValue(value),
      rawValue: value,
      key,
      type: type || 'text',
      items
    }))
}

const detailGroups = computed((): JournalDetailGroup[] => {
  const item = isEditing.value ? editFields.value : selected.value
  if (!item && !isNew.value) return []

  return [
    {
      title: 'Обнаружение и привязка',
      fields: buildFields([
        ['Название', item?.name, 'name', 'text'],
        ['Дата обнаружения', item?.detected_at, 'detected_at', 'date'],
        ['Время обнаружения', item?.detected_time, 'detected_time', 'time'],
        ['Источник', item?.source_name, 'source_id', 'select', lookups.sources],
        ['Состояние', item?.state_name, 'state_id', 'select', lookups.states],
        ['Категория', item?.category_name, 'category_id', 'select', lookups.categories],
        ['Адрес', item?.address], ['Номер дома', item?.house_number, 'house_number', 'text'],
        ['Трубопровод', item?.line_id, 'line_id', 'number'],
        ['Описание повреждения', item?.description, 'description', 'textarea']
      ])
    },
    {
      title: 'Повреждение и состояние конструкций',
      fields: buildFields([
        ['Характер повреждения', item?.damage_type_name],
        ['Поверхность в месте раскопки', item?.surface_name],
        ['Центр повреждения, часов', item?.damage_clock_position],
        ['Высота повреждения', item?.damage_height],
        ['Ширина повреждения', item?.damage_width],
        ['Площадь повреждения', item?.damage_area],
        ['Состояние теплоизоляции', item?.thermal_insulation_state],
        ['Состояние наружной поверхности', item?.outer_surface_state],
        ['Состояние внутренней поверхности', item?.inner_surface_state]
      ])
    },
    {
      title: 'Ликвидация и ремонт',
      fields: buildFields([
        ['Способ ликвидации', item?.liquidation_method],
        ['Вид работ', item?.work_type_name],
        ['Дата начала ремонта', item?.repair_started_on, 'repair_started_on', 'date'],
        ['Дата завершения ремонта', item?.repair_finished_on, 'repair_finished_on', 'date'],
        ['Длина заменённой трубы, м', item?.replaced_pipe_length],
        ['Длина заменённой изоляции, м', item?.replaced_insulation_length],
        ['Длина ремонта канала, м', item?.repaired_channel_length],
        ['Ширина заплатки', item?.patch_width],
        ['Высота заплатки', item?.patch_height],
        ['Трудозатраты', item?.repair_labor],
        ['Стоимость ремонта', item?.repair_cost],
        ['Подразделение', item?.subdivision_name],
        ['Ответственный', item?.responsible_name],
        ['Бригада', item?.brigade_name],
        ['Результат / примечание', item?.report_note || item?.note, 'report_note', 'textarea']
      ])
    },
    {
      title: 'Последствия и связанные процессы',
      fields: buildFields([
        ['Отключено потребителей', item?.disconnected_consumers],
        ['Недоотпущено тепла, Гкал', item?.undelivered_heat],
        ['Затраты на восстановление', item?.recovery_cost],
        ['Социальные последствия', item?.social_consequences],
        ['Контур опрессовки', item?.pressure_test_name || item?.pressure_test_id],
        ['Осмотр', item?.inspection_name || item?.inspection_id],
        ['Ремонт', item?.repair_name || item?.repair_id],
        ['Дата шурфовки', item?.excavation_date],
        ['Акт', item?.act_number],
        ['Дата акта', item?.act_date],
        ['Приказ', item?.order_number],
        ['Дата приказа ввода', item?.commissioning_order_date]
      ])
    }
  ].filter(group => group.fields.length)
})

const relationLabels: Record<string, string> = {
  damage_elements: 'Повреждённые элементы',
  technical_causes: 'Технические причины',
  organizational_causes: 'Организационные причины',
  contributing_causes: 'Сопутствующие причины',
  channel_states: 'Состояние конструкции канала',
  chamber_states: 'Состояние конструкции камеры',
  pipe_repairs: 'Ремонт трубопровода и элементов'
}

const relationGroups = computed(() => {
  const relations = selected.value?.relations || {}
  return Object.entries(relations).map(([key, rows]) => ({
    label: relationLabels[key] || key,
    values: rows.map(row => {
      if (key === 'pipe_repairs') {
        return [row.work_name, row.element_name].filter(Boolean).join(': ')
      }
      return String(row.name || row.id || '—')
    }).filter(Boolean)
  })).filter(group => group.values.length)
})

watch(page, () => {
  if (visible.value) void loadDefects()
})

watch([sourceId, stateId, categoryId, dateFrom, dateTo], () => {
  if (!visible.value) return
  page.value = 1
  void loadDefects()
})

defineExpose({ openDialog })
</script>

<style scoped>
.defect-journal {
  height: min(88vh, 880px);
  display: flex;
  flex-direction: column;
}

.defect-kpi {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.defect-filters {
  flex-shrink: 0;
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.category-filter {
  min-width: min(100%, 300px);
  max-width: 360px;
}

.defect-table-wrap {
  min-height: 280px;
  overflow: auto;
  flex: 1;
}

.defect-table {
  min-width: 980px;
}

.description-cell {
  display: inline-block;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.detail-label {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

@media (max-width: 600px) {
  .defect-journal {
    height: 100dvh;
  }
}
</style>
