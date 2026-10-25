<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1240"
      scrollable
    >
      <v-card
        class="inspection-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="teal-lighten-5"
            size="40"
          >
            <v-icon color="teal-darken-2">mdi-clipboard-search-outline</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Журнал осмотров</div>
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
            @click="createInspection"
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

        <!-- Плитки из ответа списка: всего, с нарушениями, с результатами по участкам (плитка — фильтр) -->
        <div
          v-if="facets"
          class="inspection-kpi px-3 px-md-4 pt-3"
        >
          <KpiTile
            label="Найдено"
            :value="total"
            :compact="false"
          />
          <KpiTile
            label="С нарушениями"
            :value="facets.with_defects ?? 0"
            :compact="false"
            :status="(facets.with_defects ?? 0) > 0 ? 'serious' : 'good'"
            selectable
            :active="defectFilter === true"
            @select="toggleFacet('defects')"
          />
          <KpiTile
            label="С результатами"
            :value="facets.with_results ?? 0"
            :compact="false"
            status="good"
            selectable
            :active="coverageFilter === true"
            @select="toggleFacet('coverage')"
          />
        </div>

        <div class="pa-3 pa-md-4 inspection-filters">
          <v-row dense>
            <v-col
              cols="12"
              md="4"
            >
              <SearchField
                :model-value="search"
                label="Поиск по ID, названию, акту или результату"
                :debounce="350"
                :loading="loading"
                @update:model-value="search = $event"
                @search="onSearch"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="3"
            >
              <AppSelect
                v-model="responsibleId"
                :items="lookups.responsible_people"
                item-title="name"
                item-value="id"
                label="Ответственный"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <AppSelect
                v-model="coverageFilter"
                :items="coverageOptions"
                item-title="title"
                item-value="value"
                label="Участки"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="3"
            >
              <AppSelect
                v-model="defectFilter"
                :items="defectOptions"
                item-title="title"
                item-value="value"
                label="Нарушения"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="3"
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
              md="3"
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
              @click="loadInspections"
            >
              Обновить
            </v-btn>
          </div>
        </div>

        <v-divider />

        <v-card-text class="pa-0 inspection-table-wrap">
          <StateView
            variant="table"
            :rows="10"
            :loading="loading && !items.length"
            :error="error"
            :empty="!loading && !items.length"
            empty-title="Осмотры не найдены"
            :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В журнале пока нет записей — проверьте загрузку исторических данных TGID'"
            empty-icon="mdi-clipboard-search-outline"
            :action-label="filtersActive ? 'Сбросить фильтры' : undefined"
            :retrying="loading"
            @retry="loadInspections"
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
              class="inspection-table"
              @select="openDetails(Number($event.id))"
            >
              <template #[`item.inspected_on`]="{ item }">
                {{ formatDate(item.inspected_on) }}
              </template>
              <template #[`item.name`]="{ item }">
                <div class="text-truncate">
                  {{ item.name || `Осмотр ${item.id}` }}
                </div>
                <div
                  v-if="item.act_number"
                  class="text-caption text-medium-emphasis"
                >
                  Акт {{ item.act_number }}
                </div>
              </template>
              <template #[`item.responsible_name`]="{ item }">
                {{ item.responsible_name || '—' }}
              </template>
              <template #[`item.inspected_section_count`]="{ item }">
                <v-chip
                  size="x-small"
                  :color="item.inspected_section_count ? 'success' : 'grey'"
                  variant="tonal"
                  class="num"
                >
                  {{ item.inspected_section_count }}
                </v-chip>
              </template>
              <template #[`item.defect_count`]="{ item }">
                <v-chip
                  size="x-small"
                  :color="item.defect_count ? 'error' : 'success'"
                  variant="tonal"
                  class="num"
                >
                  {{ item.defect_count }}
                </v-chip>
              </template>
              <template #[`item.result`]="{ item }">
                <span
                  class="result-cell"
                  :title="String(item.results || item.planned_measures || item.note || '')"
                >{{ item.results || item.planned_measures || item.note || '—' }}</span>
              </template>
              <template #[`item.actions`]="{ item }">
                <HintTip
                  v-if="hasCoordinates(item)"
                  text="Показать контур на карте"
                  hint="Журнал закроется, маркер останется"
                >
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-crosshairs-gps"
                      size="x-small"
                      variant="text"
                      color="primary"
                      aria-label="Показать контур осмотра на карте"
                      @click.stop="locate(item as InspectionSummary, String(item.name || `Осмотр ${item.id}`))"
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
      :persistent="saving"
      :fullscreen="isMobile"
      max-width="980"
      scrollable
      eager
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="teal-darken-2">mdi-clipboard-search-outline</v-icon>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <span class="text-truncate">{{ isNew ? 'Новый осмотр' : (selected?.name || `Осмотр ${selected?.id || ''}`) }}</span>
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
              {{ formatDate(selected?.inspected_on) }} · линий {{ selected?.line_count || 0 }} · нарушений {{ selected?.defect_count || 0 }}
            </div>
          </div>
          <HintTip
            v-if="mutationsEnabled && selected && !isEditing"
            text="Удалить осмотр"
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
                @click="deleteInspection(selected!.id)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </HintTip>
          <HintTip
            text="Закрыть"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                aria-label="Закрыть"
                @click="detailsVisible = false"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </HintTip>
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
                :required-keys="['name', 'inspected_on']"
                @update:field="setEditField"
              >
                <v-expansion-panel
                  v-if="inspectionLines.length && !isEditing"
                  :value="detailGroups.length"
                >
                  <v-expansion-panel-title>Линии контура ({{ inspectionLines.length }})</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list
                      density="compact"
                      lines="two"
                    >
                      <v-list-item
                        v-for="line in inspectionLines"
                        :key="Number(line.id)"
                        prepend-icon="mdi-pipe"
                        :title="`Линия ${line.line_id} · ${nodeRange(line)}`"
                        :subtitle="lineSummary(line)"
                      >
                        <template
                          v-if="hasCoordinates(line)"
                          #append
                        >
                          <HintTip
                            text="Показать на карте"
                          >
                            <template #default="{ props: tip }">
                              <v-btn
                                v-bind="tip"
                                icon="mdi-crosshairs-gps"
                                size="x-small"
                                variant="text"
                                aria-label="Показать на карте"
                                @click.stop="locateRelation(line, `Линия ${line.line_id}`)"
                              />
                            </template>
                          </HintTip>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel
                  v-if="riskFactors.length"
                  :value="detailGroups.length + 1"
                >
                  <v-expansion-panel-title>Результаты по участкам ({{ riskFactors.length }})</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list
                      density="compact"
                      lines="two"
                    >
                      <v-list-item
                        v-for="risk in riskFactors"
                        :key="Number(risk.id)"
                        prepend-icon="mdi-shield-search"
                        :title="`Участок ${risk.legacy_pipe_section_id || 'не указан'}`"
                        :subtitle="riskSummary(risk)"
                      />
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel
                  v-if="relatedDefects.length && !isEditing"
                  :value="detailGroups.length + 2"
                >
                  <v-expansion-panel-title>Выявленные нарушения ({{ relatedDefects.length }})</v-expansion-panel-title>
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
                  :value="detailGroups.length + 3"
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
              </JournalDetailFields>
              <JournalRecordPanels
                v-if="selected && !isEditing"
                class="mt-4"
                journal="inspections"
                :record-id="selected.id"
                :record-label="selected.name || `Осмотр ${selected.id}`"
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
            @click="locate(selected, selected.name || `Осмотр ${selected.id}`)"
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
import { hasLonLat, localToday } from '~/utils/journalFields'
import { useCloseOnMapPick } from '~/composables/useJournalMapBridge'
import { formatApiError } from '~/utils/apiError'
import { useNotificationStore } from '~/stores/notificationStore'
import { computed, reactive, ref, watch } from 'vue'
import { useJournalEdit } from '~/composables/useJournalEdit'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import { useJournalRecordForm } from '~/composables/useJournalRecordForm'
import {
  fastApiService,
  type InspectionDetails,
  type InspectionLookups,
  type InspectionSummary
} from '~/services/fastApiService'

/**
 * Журнал осмотров — тип (а) «запись плюс форма» (docs/ui-modernization-progress.md, этап 5): `DataTable`
 * с серверной пагинацией, плитки «с нарушениями» / «с результатами» из `facet_counts` ответа API
 * (плитка — фильтр), `SearchField` / `AppSelect`, `StateView`; карточка на общих `JournalDetailFields` +
 * `useJournalEdit` (черновик, «изменено», отмена с подтверждением), линии контура с переходом на карту.
 */
export interface InspectionJournalScope {
  lineId?: number
  nodeId?: number
  inspectionId?: number
}

const emit = defineEmits<{
  'locate-inspection': [coordinates: { longitude: number; latitude: number; id: number; label: string }]
  'open-defect': [defectId: number]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const visible = ref(false)
const loading = ref(false)
const error = ref('')
const items = ref<InspectionSummary[]>([])
const total = ref(0)
const pages = ref(0)
const page = ref(1)
const pageSize = 50
const search = ref('')
const responsibleId = ref<number | undefined>()
const coverageFilter = ref<boolean | undefined>()
const defectFilter = ref<boolean | undefined>()
const dateFrom = ref('')
const dateTo = ref('')
const scope = reactive<InspectionJournalScope>({})
const lookups = reactive<InspectionLookups>({
  responsible_people: [], subdivisions: [], legacy_states: [], document_types: []
})
const coverageOptions = [
  { title: 'Есть результаты', value: true },
  { title: 'Нет результатов', value: false }
]
const defectOptions = [
  { title: 'Есть нарушения', value: true },
  { title: 'Без нарушений', value: false }
]
/** Счётчики признаков из ответа списка; null — API их не отдаёт (плитки скрыты) */
const facets = ref<Record<string, number> | null>(null)

const detailsVisible = ref(false)
// Другой журнал начал выбор участков на карте — закрыть это окно (QA F48)
useCloseOnMapPick(() => visible.value || detailsVisible.value, () => { detailsVisible.value = false; visible.value = false })
const detailsLoading = ref(false)
const detailsError = ref('')
const selected = ref<InspectionDetails | null>(null)
const creating = ref(false)
const deleting = ref(false)
const exportingWord = ref(false)

const scopeTitle = computed(() => {
  if (scope.lineId) return `осмотры трубопровода ${scope.lineId}`
  if (scope.nodeId) return `осмотры прилегающих трубопроводов узла ${scope.nodeId}`
  return 'вся тепловая сеть'
})
const filtersActive = computed(() => Boolean(
  search.value.trim() || responsibleId.value || coverageFilter.value != null || defectFilter.value != null
  || dateFrom.value || dateTo.value,
))

const tableColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 76, sortable: false },
  { key: 'inspected_on', title: 'Дата', type: 'date', width: 110, sortable: false },
  { key: 'name', title: 'Контур осмотра', sortable: false },
  { key: 'responsible_name', title: 'Ответственный', width: 160, sortable: false },
  { key: 'line_count', title: 'Линии', type: 'number', width: 80, sortable: false },
  { key: 'inspected_section_count', title: 'Осмотрено', type: 'number', width: 100, sortable: false },
  { key: 'defect_count', title: 'Нарушения', type: 'number', width: 100, sortable: false },
  { key: 'result', title: 'Результат', sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false },
]

/** Плитка признака — тот же фильтр, что и выпадающий список: повторный щелчок снимает */
const toggleFacet = (kind: 'defects' | 'coverage') => {
  if (kind === 'defects') defectFilter.value = defectFilter.value === true ? undefined : true
  else coverageFilter.value = coverageFilter.value === true ? undefined : true
}

const formatDate = (value: unknown) => {
  if (!value) return '—'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value)
}
const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value)
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  return String(value)
}
const hasCoordinates = (item: { longitude?: unknown; latitude?: unknown }) => hasLonLat(item)
const fileName = (path: unknown) => String(path || 'Файл не указан').split(/[\\/]/).pop() || 'Файл'
const nodeRange = (line: Record<string, unknown>) =>
  [line.start_node_name, line.end_node_name].filter(Boolean).join(' — ') || 'узлы не указаны'
const lineSummary = (line: Record<string, unknown>) => [
  line.diameter && `DN ${line.diameter}`,
  line.length && `длина ${line.length} м`,
  line.tubing_type_name
].filter(Boolean).join(' · ') || 'Параметры участка не заполнены'
const riskSummary = (risk: Record<string, unknown>) => [
  risk.outer_view_name && `внешний вид: ${risk.outer_view_name}`,
  risk.equipment_state_name && `оборудование: ${risk.equipment_state_name}`,
  risk.pipe_metal_state_name && `металл: ${risk.pipe_metal_state_name}`,
  risk.corrosion_flow_name && `коррозия подачи: ${risk.corrosion_flow_name}`,
  risk.corrosion_return_name && `коррозия обратки: ${risk.corrosion_return_name}`,
  risk.ground_name && `грунт: ${risk.ground_name}`
].filter(Boolean).join(' · ') || 'Параметры осмотра не заполнены'

const loadLookups = async () => {
  if (lookups.responsible_people.length) return
  Object.assign(lookups, await fastApiService.getInspectionLookups())
}
/** Номер последнего запроса списка */
let listRequest = 0
const loadInspections = async () => {
  const request = ++listRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getInspections({
      page: page.value,
      page_size: pageSize,
      responsible_id: responsibleId.value,
      has_defects: defectFilter.value,
      has_inspected_sections: coverageFilter.value,
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
      line_id: scope.lineId,
      node_id: scope.nodeId,
      search: (search.value || '').trim() || undefined
    })
    if (request !== listRequest) return
    items.value = response.items
    total.value = response.total
    pages.value = response.pages
    facets.value = response.facet_counts && typeof response.facet_counts === 'object' ? response.facet_counts : null
  } catch (loadError: any) {
    if (request !== listRequest) return
    error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить журнал осмотров'
  } finally {
    if (request === listRequest) loading.value = false
  }
}
/** Текст после паузы ввода (SearchField) */
const onSearch = () => {
  if (!visible.value) return
  page.value = 1
  void loadInspections()
}
/** Номер последнего запроса карточки: ответ более раннего запроса не перекрывает поздний */
let detailsRequest = 0
const openDetails = async (id: number) => {
  // открытие другой записи во время правки — черновик текущей остаётся, карточка на просмотр
  closeKeepingDraft()
  resetEdit()
  const request = ++detailsRequest
  detailsVisible.value = true
  detailsLoading.value = true
  detailsError.value = ''
  selected.value = null
  try {
    const record = await fastApiService.getInspection(id)
    if (request !== detailsRequest) return
    selected.value = record
  } catch (loadError: any) {
    if (request !== detailsRequest) return
    detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку осмотра'
  } finally {
    if (request === detailsRequest) detailsLoading.value = false
  }
}
const notifications = useNotificationStore()
let openDialogSeq = 0
const openDialog = async (nextScope: InspectionJournalScope = {}) => {
  const seq = ++openDialogSeq
  Object.assign(scope, { lineId: undefined, nodeId: undefined, inspectionId: undefined }, nextScope)
  page.value = 1
  visible.value = true
  // список и схема сами показывают свои ошибки; сбой справочников не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), loadInspections(), recordForm.loadSchema()])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — фильтры и выбор значений могут быть неполными'))
  // журнал открыли снова, пока грузились списки — запись открывает последний вызов
  if (seq !== openDialogSeq) return
  if (nextScope.inspectionId) await openDetails(nextScope.inspectionId)
}
const clearScope = () => {
  scope.lineId = undefined
  scope.nodeId = undefined
  page.value = 1
  void loadInspections()
}

const recordForm = useJournalRecordForm('inspections')
const positions = computed(() => recordForm.schema.value?.positions || [])
const subdivisions = computed(() => recordForm.schema.value?.subdivisions || [])
const {
  isEditing, isNew, saving, editFields, flashId, isDirty, isFieldDirty, editable, setEditField,
  beginCreate, beginEdit, resetEdit, cancel, closeKeepingDraft, markSaved, forgetDraft,
} = useJournalEdit('inspections', recordForm, selected)

const createInspection = async () => {
  selected.value = null
  detailsVisible.value = true
  detailsError.value = ''
  // gid6 SaveOpresNew("osmotr", …): наименование «Осмотр», дата — сегодня
  await beginCreate({ name: 'Осмотр', inspected_on: localToday() })
}

const startEdit = () => beginEdit()

const cancelEdit = async () => {
  const { closed, wasNew } = await cancel()
  if (closed && wasNew) detailsVisible.value = false
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
    await loadInspections()
    if (id) await openDetails(id)
  } catch (e: any) {
    recordForm.showError(formatApiError(e, 'Ошибка при сохранении'))
  } finally {
    saving.value = false
  }
}

const deleteInspection = async (id: number) => {
  deleting.value = true
  try {
    if (await recordForm.remove(id, selected.value?.name || `Осмотр ${id}`)) {
      forgetDraft(id)
      detailsVisible.value = false
      await loadInspections()
    }
  } finally {
    deleting.value = false
  }
}

const refreshSelected = async () => {
  const id = selected.value?.id
  if (!id) return
  try {
    const record = await fastApiService.getInspection(id)
    if (selected.value?.id === id) selected.value = record
  } catch (e: any) {
    notifications.showWarning(formatApiError(e, 'Карточка не обновилась — показаны прежние данные'))
  }
  void loadInspections()
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
  responsibleId.value = undefined
  coverageFilter.value = undefined
  defectFilter.value = undefined
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
  void loadInspections()
}
const locate = (item: InspectionSummary, label: string) => {
  if (!hasCoordinates(item)) return
  emit('locate-inspection', {
    longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, label
  })
  detailsVisible.value = false
  visible.value = false
}
const locateRelation = (relation: Record<string, unknown>, label: string) => {
  if (!selected.value || !hasCoordinates(relation)) return
  emit('locate-inspection', {
    longitude: Number(relation.longitude), latitude: Number(relation.latitude), id: selected.value.id, label
  })
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
    { title: 'Осмотр', fields: buildFields([
      ['Наименование контура', item?.name, 'name', 'text'], ['Дата осмотра', item?.inspected_on, 'inspected_on', 'date'],
      ['Номер акта', item?.act_number, 'act_number', 'text'], ['Ответственный', item?.responsible_name, 'responsible_id', 'select', lookups.responsible_people],
      ['Подразделение', item?.subdivision_name], ['Количество линий', item?.line_count],
      ['Осмотрено участков', item?.inspected_section_count], ['Выявлено нарушений', item?.defect_count],
      ['Предполагаемые причины разрушения изоляции/коррозии', item?.suspected_causes, 'suspected_causes', 'textarea'],
      ['Результаты осмотра', item?.results, 'results', 'textarea'], ['Намеченные мероприятия', item?.planned_measures, 'planned_measures', 'textarea'],
      ['Восстановление прокладки', item?.restoration_measures, 'restoration_measures', 'textarea'], ['Примечание', item?.note, 'note', 'textarea']
    ]) },
    { title: 'Утверждение и комиссия', fields: buildFields([
      ['ФИО утверждающего', item?.approver_name, 'approver_name', 'text'], ['Должность утверждающего', item?.approver_position, 'approver_position_id', 'select', positions.value],
      ['Служба утверждающего', item?.approver_service, 'approver_service_id', 'select', subdivisions.value], ['Член комиссии 1', item?.commission_member_1, 'commission_member_1', 'text'],
      ['Должность члена комиссии 1', item?.commission_position_1, 'commission_position_1_id', 'select', positions.value], ['Член комиссии 2', item?.commission_member_2, 'commission_member_2', 'text'],
      ['Должность члена комиссии 2', item?.commission_position_2, 'commission_position_2_id', 'select', positions.value],
      ['Не участвовавшие трубопроводы', item?.excluded_pipes, 'excluded_pipes', 'textarea'],
      ['Не предупреждённые потребители', item?.unnotified_consumers, 'unnotified_consumers', 'textarea']
    ]) }
  ].filter(group => group.fields.length)
})
const inspectionLines = computed(() => selected.value?.relations?.lines || [])
const relatedDefects = computed(() => selected.value?.relations?.defects || [])
const documents = computed(() => selected.value?.relations?.documents || [])
const riskFactors = computed(() => selected.value?.relations?.risk_factors || [])

watch(page, () => { if (visible.value) void loadInspections() })
watch([responsibleId, coverageFilter, defectFilter, dateFrom, dateTo], () => {
  if (!visible.value) return
  page.value = 1
  void loadInspections()
})

const exportWord = async () => {
  if (!selected.value) return
  exportingWord.value = true
  try {
    const { blob, filename } = await fastApiService.downloadOpsWordReport('osmotr', selected.value.id)
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
.inspection-journal { height: min(88vh, 880px); display: flex; flex-direction: column; }
.inspection-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.inspection-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.inspection-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.inspection-table { min-width: 1120px; }
.result-cell { display: inline-block; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
@media (max-width: 600px) { .inspection-journal { height: 100dvh; } }
</style>
