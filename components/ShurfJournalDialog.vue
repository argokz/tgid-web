<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1240"
      scrollable
    >
      <v-card
        class="shurf-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="brown-lighten-5"
            size="40"
          >
            <v-icon color="brown-darken-2">mdi-shovel</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Журнал шурфовок</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }}
            </div>
          </div>
          <v-btn
            v-if="mutationsEnabled"
            color="teal"
            variant="tonal"
            prepend-icon="mdi-stamper"
            class="mr-2"
            @click="batchApprovalRef?.open()"
          >
            Утвердить план
          </v-btn>
          <v-btn
            v-if="mutationsEnabled"
            color="primary"
            variant="flat"
            prepend-icon="mdi-plus"
            class="mr-2"
            :loading="creating"
            @click="createShurf"
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

        <!-- Плитки из ответа списка: всего и по состояниям при тех же фильтрах; плитка состояния — фильтр -->
        <div
          v-if="stateTiles.length"
          class="shurf-kpi px-3 px-md-4 pt-3"
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

        <div class="pa-3 pa-md-4 shurf-filters">
          <v-row dense>
            <v-col
              cols="12"
              md="4"
            >
              <SearchField
                :model-value="search"
                label="Поиск по ID, адресу, акту или результату"
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
                v-model="purposeId"
                :items="lookups.purposes"
                item-title="name"
                item-value="id"
                label="Назначение"
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
              v-model="approvalFilter"
              :items="approvalOptions"
              item-title="title"
              item-value="value"
              label="Утверждение"
              class="approval-filter"
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
              @click="loadShurfs"
            >
              Обновить
            </v-btn>
          </div>
        </div>

        <v-divider />

        <v-card-text class="pa-0 shurf-table-wrap">
          <StateView
            variant="table"
            :rows="10"
            :loading="loading && !items.length"
            :error="error"
            :empty="!loading && !items.length"
            empty-title="Шурфовки не найдены"
            :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В журнале пока нет записей — проверьте загрузку исторических данных TGID'"
            empty-icon="mdi-shovel-off"
            :action-label="filtersActive ? 'Сбросить фильтры' : undefined"
            :retrying="loading"
            @retry="loadShurfs"
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
              class="shurf-table"
              @select="openDetails(Number($event.id))"
            >
              <template #[`item.term`]="{ item }">
                {{ dateRange(item.effective_start, item.effective_finish) }}
              </template>
              <template #[`item.purpose_name`]="{ item }">
                {{ item.purpose_name || '—' }}
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
                  {{ item.address || nodeRange(item as ShurfSummary) || '—' }}
                </div>
                <div
                  v-if="item.line_id"
                  class="text-caption text-medium-emphasis"
                >
                  Линия {{ item.line_id }}
                </div>
              </template>
              <template #[`item.result`]="{ item }">
                <span
                  class="result-cell"
                  :title="String(item.inspection_results || item.planned_measures || item.note || '')"
                >{{ item.inspection_results || item.planned_measures || item.note || '—' }}</span>
              </template>
              <template #[`item.approval_name`]="{ item }">
                <v-chip
                  size="x-small"
                  :color="item.approval_id ? 'success' : 'grey'"
                  variant="tonal"
                >
                  {{ item.approval_name }}
                </v-chip>
              </template>
              <template #[`item.actions`]="{ item }">
                <HintTip
                  v-if="hasCoordinates(item as ShurfSummary)"
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
                      aria-label="Показать шурф на карте"
                      @click.stop="locate(item as ShurfSummary)"
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
                      aria-label="Подробнее"
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
      v-model="detailsVisible"
      :fullscreen="isMobile"
      max-width="940"
      scrollable
      eager
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="brown-darken-2">mdi-shovel</v-icon>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <span>{{ isNew ? 'Новая шурфовка' : `Шурфовка ${selected?.id || ''}` }}</span>
              <v-chip
                v-if="isEditing && isDirty"
                size="x-small"
                color="accent"
                variant="tonal"
              >
                Не сохранено
              </v-chip>
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ selected?.purpose_name || 'Назначение не указано' }} · {{ selected?.state_name || 'Состояние не указано' }}
            </div>
          </div>
          <HintTip
            v-if="mutationsEnabled && selected && !isEditing"
            text="Удалить шурфовку"
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
                @click="deleteShurf(selected!.id)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </HintTip>
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
              <!-- Плановый / внеплановый шурф — разные режимы создания сервера (gid6 OnRemontPovrShurfAdd / AddNeplan) -->
              <SegmentedToggle
                v-if="isNew"
                v-model="createMode"
                :items="createModeItems"
                aria-label="Вид шурфа"
                class="mb-3"
              />
              <JournalDetailFields
                :groups="detailGroups"
                :model="editFields"
                :editable="editable"
                :is-field-dirty="isFieldDirty"
                :required-keys="createMode === 'plan' ? ['planned_start', 'planned_finish'] : []"
                @update:model="editFields = $event"
              >
                <v-expansion-panel
                  v-if="inspectedElements.length && !isEditing"
                  :value="detailGroups.length"
                >
                  <v-expansion-panel-title>Осмотренные элементы</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div class="d-flex flex-wrap ga-1">
                      <v-chip
                        v-for="element in inspectedElements"
                        :key="Number(element.id)"
                        size="small"
                        variant="tonal"
                      >
                        {{ element.name }}
                      </v-chip>
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel
                  v-if="relatedDefects.length && !isEditing"
                  :value="detailGroups.length + 1"
                >
                  <v-expansion-panel-title>Нарушения, выявленные в шурфе</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list
                      density="compact"
                      lines="two"
                    >
                      <v-list-item
                        v-for="defect in relatedDefects"
                        :key="Number(defect.id)"
                        prepend-icon="mdi-alert-circle-outline"
                        :title="`Нарушение ${defect.id} · ${defect.state_name || 'без состояния'}`"
                        :subtitle="String(defect.description || defect.source_name || 'Описание не заполнено')"
                        @click="openRelatedDefect(Number(defect.id))"
                      />
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel
                  v-if="documents.length && !isEditing"
                  :value="detailGroups.length + 2"
                >
                  <v-expansion-panel-title>Документы</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list density="compact">
                      <v-list-item
                        v-for="document in documents"
                        :key="Number(document.id)"
                        prepend-icon="mdi-file-document-outline"
                        :title="String(document.document_type_name || 'Документ')"
                        :subtitle="`${formatDate(document.date_doc)} · ${fileName(document.path)}`"
                      />
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel
                  v-if="nearbyCommunications.length && !isEditing"
                  :value="detailGroups.length + 3"
                >
                  <v-expansion-panel-title>Коммуникации вблизи шурфа</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div class="d-flex flex-wrap ga-1">
                      <v-chip
                        v-for="communication in nearbyCommunications"
                        :key="Number(communication.id)"
                        size="small"
                        variant="tonal"
                      >
                        {{ communication.name }}
                      </v-chip>
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel
                  v-if="riskFactors.length && !isEditing"
                  :value="detailGroups.length + 4"
                >
                  <v-expansion-panel-title>Факторы риска трубопровода</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list
                      density="compact"
                      lines="two"
                    >
                      <v-list-item
                        v-for="risk in riskFactors"
                        :key="Number(risk.id)"
                        prepend-icon="mdi-shield-alert-outline"
                        :title="`Фактор риска ${risk.id}${risk.pipe_section_id ? ` · участок ${risk.pipe_section_id}` : ''}`"
                        :subtitle="riskSummary(risk)"
                      />
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </JournalDetailFields>
              <JournalRecordPanels
                v-if="selected && !isEditing"
                class="mt-4"
                journal="shurfs"
                :record-id="selected.id"
                :record-label="selected.address || `Шурф ${selected.id}`"
                @changed="refreshSelected"
                @hide="hideForMap"
                @restore="restoreAfterMap"
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
              v-if="selected"
              variant="tonal"
              prepend-icon="mdi-file-word-outline"
              :loading="exportingWord"
              @click="exportWord"
            >
              Word
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
    <JournalBatchApprovalDialog
      ref="batchApprovalRef"
      journal="shurfs"
      @approved="loadShurfs"
    />
  </Teleport>
</template>

<script setup lang="ts">
import AppSelect from '~/components/AppSelect.vue'
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue'
import HintTip from '~/components/HintTip.vue'
import JournalDetailFields, { type JournalDetailField, type JournalDetailGroup } from '~/components/JournalDetailFields.vue'
import KpiTile, { type KpiStatus } from '~/components/KpiTile.vue'
import SearchField from '~/components/SearchField.vue'
import SegmentedToggle, { type SegmentedToggleItem } from '~/components/SegmentedToggle.vue'
import StateView from '~/components/StateView.vue'
import { hasLonLat } from '~/utils/journalFields'
import { useCloseOnMapPick } from '~/composables/useJournalMapBridge'
import { formatApiError } from '~/utils/apiError'
import { computed, reactive, ref, watch } from 'vue'
import { useJournalEdit } from '~/composables/useJournalEdit'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import { useJournalRecordForm } from '~/composables/useJournalRecordForm'
import {
  fastApiService,
  type ShurfDetails,
  type ShurfLookups,
  type ShurfSummary
} from '~/services/fastApiService'

/**
 * Журнал шурфовок — тип (б) «рабочее место» (docs/ui-modernization-progress.md, этап 5): таблица на `DataTable`
 * с серверной пагинацией, плитки состояний из `state_counts`, фильтры `SearchField` / `AppSelect`, массовое
 * утверждение плана (`JournalBatchApprovalDialog`) сохранено, карточка на общих `JournalDetailFields` +
 * `useJournalEdit` (черновик, признак «изменено», отмена с подтверждением), связи и документы — панелями.
 */
export interface ShurfJournalScope {
  lineId?: number
  nodeId?: number
  shurfId?: number
}

const emit = defineEmits<{
  'locate-shurf': [coordinates: { longitude: number; latitude: number; id: number }]
  'open-defect': [defectId: number]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const visible = ref(false)
const loading = ref(false)
const error = ref('')
const items = ref<ShurfSummary[]>([])
const total = ref(0)
const pages = ref(0)
const page = ref(1)
const pageSize = 50
const search = ref('')
const purposeId = ref<number | undefined>()
const stateId = ref<number | undefined>()
const approvalFilter = ref<boolean | undefined>()
const dateFrom = ref('')
const dateTo = ref('')
const scope = reactive<ShurfJournalScope>({})
const lookups = reactive<ShurfLookups>({ purposes: [], states: [], materials: [] })
const approvalOptions = [
  { title: 'Утверждённые', value: true },
  { title: 'Не утверждённые', value: false },
]
/** Счётчики по состояниям из ответа списка; null — API их не отдаёт (плитки скрыты) */
const stateCounts = ref<{ state_id: number | null; count: number }[] | null>(null)

const detailsVisible = ref(false)
// Другой журнал начал выбор участков на карте — закрыть это окно (QA F48)
useCloseOnMapPick(() => visible.value || detailsVisible.value, () => { detailsVisible.value = false; visible.value = false })
const detailsLoading = ref(false)
const detailsError = ref('')
const selected = ref<ShurfDetails | null>(null)
const creating = ref(false)
const deleting = ref(false)
const exportingWord = ref(false)

const scopeTitle = computed(() => {
  if (scope.lineId) return `шурфовки трубопровода ${scope.lineId}`
  if (scope.nodeId) return `шурфовки узла и прилегающих трубопроводов ${scope.nodeId}`
  return 'вся тепловая сеть'
})

const filtersActive = computed(() => Boolean(
  search.value.trim() || purposeId.value || stateId.value || approvalFilter.value !== undefined || dateFrom.value || dateTo.value,
))

const tableColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 80, sortable: false },
  { key: 'term', title: 'Срок', type: 'date', width: 170, sortable: false },
  { key: 'purpose_name', title: 'Назначение', width: 130, sortable: false },
  { key: 'state_name', title: 'Состояние', width: 120, sortable: false },
  { key: 'address', title: 'Адрес / участок', sortable: false },
  { key: 'result', title: 'Результат', sortable: false },
  { key: 'approval_name', title: 'Утверждение', width: 140, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false },
]

/** Состояние шурфа → тон плитки: план — нейтрально, в процессе — внимание, выполнено — в порядке */
const STATE_STATUS: Record<number, KpiStatus> = { 1: 'none', 2: 'warning', 3: 'good' }

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
const dateRange = (start: unknown, finish: unknown) => {
  if (!start && !finish) return '—'
  return `${formatDate(start)} — ${formatDate(finish)}`
}
const nodeRange = (item: ShurfSummary) => [item.line_start_node, item.line_end_node].filter(Boolean).join(' — ')
const stateColor = (id: number | null) => id === 3 ? 'success' : id === 2 ? 'warning' : 'info'
const hasCoordinates = (item: Pick<ShurfSummary, 'longitude' | 'latitude'>) => hasLonLat(item)
const fileName = (path: unknown) => String(path || 'Файл не указан').split(/[\\/]/).pop() || 'Файл'
const riskSummary = (risk: Record<string, unknown>) => [
  risk.ground_name && `грунт: ${risk.ground_name}`,
  risk.surface_name && `поверхность: ${risk.surface_name}`,
  risk.nearby_communications_name && `коммуникации: ${risk.nearby_communications_name}`,
  risk.glubina_kor && `глубина коррозии: ${risk.glubina_kor}`,
  risk.razmery_kor && `размер коррозии: ${risk.razmery_kor}`
].filter(Boolean).join(' · ') || 'Параметры не заполнены'

const loadLookups = async () => {
  if (lookups.purposes.length) return
  Object.assign(lookups, await fastApiService.getShurfLookups())
}
const loadShurfs = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getShurfs({
      page: page.value,
      page_size: pageSize,
      purpose_id: purposeId.value,
      state_id: stateId.value,
      approved: approvalFilter.value,
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
      line_id: scope.lineId,
      node_id: scope.nodeId,
      search: (search.value || '').trim() || undefined
    })
    items.value = response.items
    total.value = response.total
    pages.value = response.pages
    stateCounts.value = Array.isArray(response.state_counts) ? response.state_counts : null
  } catch (loadError: any) {
    error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить журнал шурфовок'
  } finally {
    loading.value = false
  }
}
/** Текст после паузы ввода (SearchField) */
const onSearch = () => {
  if (!visible.value) return
  page.value = 1
  void loadShurfs()
}
const openDetails = async (id: number) => {
  detailsVisible.value = true
  detailsLoading.value = true
  detailsError.value = ''
  selected.value = null
  try {
    selected.value = await fastApiService.getShurf(id)
  } catch (loadError: any) {
    detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку шурфа'
  } finally {
    detailsLoading.value = false
  }
}
const openDialog = async (nextScope: ShurfJournalScope = {}) => {
  Object.assign(scope, { lineId: undefined, nodeId: undefined, shurfId: undefined }, nextScope)
  page.value = 1
  visible.value = true
  try {
    await Promise.all([loadLookups(), loadShurfs(), recordForm.loadSchema()])
    if (nextScope.shurfId) await openDetails(nextScope.shurfId)
  } catch (loadError: any) {
    error.value = loadError?.message || 'Не удалось открыть журнал шурфовок'
  }
}
const clearScope = () => {
  scope.lineId = undefined
  scope.nodeId = undefined
  page.value = 1
  void loadShurfs()
}

const recordForm = useJournalRecordForm('shurfs')
const batchApprovalRef = ref<{ open: () => Promise<void> } | null>(null)
const {
  isEditing, isNew, saving, editFields, flashId, isDirty, isFieldDirty, editable,
  beginCreate, beginEdit, cancel, closeKeepingDraft, markSaved, forgetDraft,
} = useJournalEdit('shurfs', recordForm, selected)
const createMode = ref<'plan' | 'unplanned'>('plan')
const createModeItems: SegmentedToggleItem<'plan' | 'unplanned'>[] = [
  { value: 'plan', label: 'Плановый шурф', icon: 'mdi-calendar-check-outline', hint: 'С плановыми датами, попадает в план на утверждение' },
  { value: 'unplanned', label: 'Внеплановый', icon: 'mdi-alert-outline', hint: 'По нарушению: сразу «в процессе»' },
]

const createShurf = async () => {
  createMode.value = 'plan'
  selected.value = null
  detailsVisible.value = true
  detailsError.value = ''
  await beginCreate({ line_id: scope.lineId ?? null })
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
      edited: editFields.value, mode: createMode.value,
    })
    markSaved(id)
    await loadShurfs()
    if (id) await openDetails(id)
  } catch (e: any) {
    recordForm.showError(formatApiError(e, 'Ошибка при сохранении'))
  } finally {
    saving.value = false
  }
}

const deleteShurf = async (id: number) => {
  deleting.value = true
  try {
    if (await recordForm.remove(id, selected.value?.address || `Шурф ${id}`)) {
      forgetDraft(id)
      detailsVisible.value = false
      await loadShurfs()
    }
  } finally {
    deleting.value = false
  }
}

const refreshSelected = async () => {
  if (!selected.value) return
  try { selected.value = await fastApiService.getShurf(selected.value.id) } catch { /* остаётся прежняя */ }
  void loadShurfs()
}

let restoreState: { list: boolean; details: boolean } | null = null
const hideForMap = () => {
  restoreState = { list: visible.value, details: detailsVisible.value }
  detailsVisible.value = false
  visible.value = false
}
const restoreAfterMap = () => {
  if (!restoreState) return
  visible.value = restoreState.list
  detailsVisible.value = restoreState.details
  restoreState = null
}
const resetFilters = () => {
  search.value = ''
  purposeId.value = undefined
  stateId.value = undefined
  approvalFilter.value = undefined
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
  void loadShurfs()
}
const locate = (item: ShurfSummary) => {
  if (!hasCoordinates(item)) return
  emit('locate-shurf', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id })
  detailsVisible.value = false
  visible.value = false
}
const openRelatedDefect = (id: number) => {
  detailsVisible.value = false
  visible.value = false
  emit('open-defect', id)
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
    { title: 'План и местоположение', fields: buildFields([
      ['Назначение вскрытия', item?.purpose_name, 'purpose_id', 'select', lookups.purposes],
      ['Состояние', item?.state_name, 'state_id', 'select', lookups.states],
      ['Материалы', item?.material_name, 'material_id', 'select', lookups.materials],
      ['Плановое начало', item?.planned_start, 'planned_start', 'date'],
      ['Плановое окончание', item?.planned_finish, 'planned_finish', 'date'],
      ['Фактическое начало', item?.actual_start, 'actual_start', 'date'],
      ['Фактическое окончание', item?.actual_finish, 'actual_finish', 'date'],
      ['Адрес', item?.address], ['Номер дома', item?.house_number, 'house_number', 'text'],
      ['Трубопровод', item?.line_id, 'line_id', 'number'],
      ['Начальный узел', item?.line_start_node],
      ['Конечный узел', item?.line_end_node],
      ['Ближайшая камера', item?.nearest_chamber_name],
      ['Расстояние до камеры, м', item?.distance_to_nearest_chamber, 'distance_to_nearest_chamber', 'number'],
      ['Длина осмотра, м', item?.inspection_length, 'inspection_length', 'number'],
      ['Глубина заложения, м', item?.laying_depth, 'laying_depth', 'number']
    ]) },
    { title: 'Условия вскрытия и канал', fields: buildFields([
      ['Характер грунта', item?.ground_name], ['Поверхность над трассой', item?.surface_name],
      ['Подтопление до трубы', item?.podtoplenie_do_truby], ['Устройство водоотведения', item?.drainage_name],
      ['Коммуникации вблизи', item?.nearby_communication_name], ['Электрифицированный транспорт', item?.nearby_electric_transport],
      ['Расстояние до рельсов, м', item?.distance_to_rails], ['Электрозащитные установки', item?.nearby_electroprotection],
      ['Строительная конструкция канала', item?.channel_structure_name], ['Состояние конструкции канала', item?.channel_structure_state_name],
      ['Внутреннее состояние канала', item?.channel_inside_name], ['Дренажная конструкция', item?.drain_structure_name],
      ['Занос канала грунтом', item?.ground_fill_name]
    ]) },
    { title: 'Осмотр трубопроводов', fields: buildFields([
      ['Гидроизоляция подачи', item?.waterproof_flow_name], ['Гидроизоляция обратки', item?.waterproof_return_name],
      ['Теплоизоляция подачи', item?.insulation_flow_name], ['Теплоизоляция обратки', item?.insulation_return_name],
      ['Наружное покрытие подачи', item?.outer_cover_flow_name], ['Наружное покрытие обратки', item?.outer_cover_return_name],
      ['Противокоррозионное покрытие подачи', item?.anticorrosion_flow_name], ['Противокоррозионное покрытие обратки', item?.anticorrosion_return_name],
      ['Коррозия подачи', item?.corrosion_flow_name], ['Коррозия обратки', item?.corrosion_return_name],
      ['Место контрольной вырезки', item?.control_cut_location, 'control_cut_location', 'text'], ['Результаты вырезки', item?.cut_results, 'cut_results', 'textarea'],
      ['Результаты осмотра', item?.inspection_results, 'inspection_results', 'textarea'], ['Назначенные мероприятия', item?.planned_measures, 'planned_measures', 'textarea'],
      ['Восстановление прокладки', item?.restoration_measures, 'restoration_measures', 'textarea'], ['Примечание', item?.note, 'note', 'textarea']
    ]) },
    { title: 'Акт и утверждение', fields: buildFields([
      ['Номер акта', item?.act_number, 'act_number', 'text'], ['Дата утверждения акта', item?.act_approved_on, 'act_approved_on', 'date'],
      ['Состояние утверждения', item?.approval_name], ['Дата утверждения плана', item?.approved_on],
      ['Назначение', item?.approval_purpose], ['ФИО утверждающего', item?.approver_name],
      ['Должность утверждающего', item?.approver_position], ['Служба утверждающего', item?.approver_service],
      ['ФИО визирующего', item?.reviewer_name], ['Должность визирующего', item?.reviewer_position],
      ['Член комиссии 1', item?.commission_member_1, 'commission_member_1', 'text'], ['Член комиссии 2', item?.commission_member_2, 'commission_member_2', 'text']
    ]) }
  ].filter(group => group.fields.length)
})

const inspectedElements = computed(() => selected.value?.relations?.inspected_elements || [])
const relatedDefects = computed(() => selected.value?.relations?.defects || [])
const documents = computed(() => selected.value?.relations?.documents || [])
const nearbyCommunications = computed(() => selected.value?.relations?.nearby_communications || [])
const riskFactors = computed(() => selected.value?.relations?.risk_factors || [])

watch(page, () => { if (visible.value) void loadShurfs() })
watch([purposeId, stateId, approvalFilter, dateFrom, dateTo], () => {
  if (!visible.value) return
  page.value = 1
  void loadShurfs()
})

const exportWord = async () => {
  if (!selected.value) return
  exportingWord.value = true
  try {
    const { blob, filename } = await fastApiService.downloadOpsWordReport('shurf', selected.value.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    detailsError.value = formatApiError(e, 'Не удалось сформировать Word')
  } finally {
    exportingWord.value = false
  }
}
defineExpose({ openDialog })
</script>

<style scoped>
.shurf-journal { height: min(88vh, 880px); display: flex; flex-direction: column; }
.shurf-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.shurf-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.approval-filter { min-width: 220px; max-width: 300px; }
.shurf-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.shurf-table { min-width: 1080px; }
.result-cell { display: inline-block; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
@media (max-width: 600px) { .shurf-journal { height: 100dvh; } }
</style>
