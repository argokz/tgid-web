<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1320"
      scrollable
    >
      <v-card
        class="repair-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="deep-purple-lighten-5"
            size="40"
          >
            <v-icon color="deep-purple-darken-2">mdi-hammer-wrench</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Журнал ремонтов</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }}
            </div>
          </div>
          <v-btn
            color="secondary"
            variant="tonal"
            prepend-icon="mdi-printer"
            class="mr-2"
            @click="openForm10Report"
          >
            Печать (Форма 10)
          </v-btn>
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
            @click="createRepair"
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
          class="repair-kpi px-3 px-md-4 pt-3"
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

        <div class="pa-3 pa-md-4 repair-filters">
          <v-row dense>
            <v-col
              cols="12"
              md="4"
            >
              <SearchField
                :model-value="search"
                label="Поиск по ID, названию, работам или приказу"
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
                v-model="stateId"
                :items="lookups.states"
                item-title="name"
                item-value="id"
                label="Состояние"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <AppSelect
                v-model="repairTypeId"
                :items="lookups.repair_types"
                item-title="name"
                item-value="id"
                label="Вид ремонта"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <AppSelect
                v-model="categoryId"
                :items="lookups.categories"
                item-title="name"
                item-value="id"
                label="Категория"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <AppSelect
                v-model="approved"
                :items="approvalOptions"
                item-title="title"
                item-value="value"
                label="Утверждение"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="4"
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
              @click="loadRepairs"
            >
              Обновить
            </v-btn>
          </div>
        </div>

        <v-divider />

        <v-card-text class="pa-0 repair-table-wrap">
          <StateView
            variant="table"
            :rows="10"
            :loading="loading && !items.length"
            :error="error"
            :empty="!loading && !items.length"
            empty-title="Ремонты не найдены"
            :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В журнале пока нет записей — загрузите исторические данные ремонтов'"
            empty-icon="mdi-hammer-wrench"
            :action-label="filtersActive ? 'Сбросить фильтры' : undefined"
            :retrying="loading"
            @retry="loadRepairs"
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
              class="repair-table"
              @select="openDetails(Number($event.id))"
            >
              <template #[`item.period`]="{ item }">
                <span class="text-no-wrap">{{ formatRange(item.effective_start, item.effective_finish) }}</span>
              </template>
              <template #[`item.name`]="{ item }">
                <div class="text-truncate">
                  {{ item.name || `Ремонт ${item.id}` }}
                </div>
                <div class="text-caption text-medium-emphasis text-truncate">
                  {{ item.network_type_name || item.section_characteristics || '—' }}
                </div>
              </template>
              <template #[`item.kind`]="{ item }">
                {{ [item.repair_type_name, item.category_name].filter(Boolean).join(' · ') || '—' }}
              </template>
              <template #[`item.state_name`]="{ item }">
                <v-chip
                  size="x-small"
                  :color="stateColor(Number(item.state_id))"
                  variant="tonal"
                >
                  {{ item.state_name || 'Не указано' }}
                </v-chip>
              </template>
              <template #[`item.responsible_name`]="{ item }">
                {{ item.responsible_name || '—' }}
              </template>
              <template #[`item.budget`]="{ item }">
                <span class="text-no-wrap num">{{ formatMoney(item.planned_budget) }} / {{ formatMoney(item.actual_budget) }}</span>
              </template>
              <template #[`item.result`]="{ item }">
                <span
                  class="result-cell"
                  :title="String(item.results || item.work_description || item.note || '')"
                >{{ item.results || item.work_description || item.note || '—' }}</span>
              </template>
              <template #[`item.actions`]="{ item }">
                <HintTip
                  v-if="hasCoordinates(item)"
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
                      aria-label="Показать ремонт на карте"
                      @click.stop="locate(item as RepairSummary, String(item.name || `Ремонт ${item.id}`))"
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
      max-width="1040"
      scrollable
      eager
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="deep-purple-darken-2">mdi-hammer-wrench</v-icon>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <span class="text-truncate">{{ isNew ? 'Новый ремонт' : (selected?.name || `Ремонт ${selected?.id || ''}`) }}</span>
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
              {{ selected?.state_name || 'Состояние не указано' }} · линий {{ selected?.line_count || 0 }} · нарушений {{ selected?.defect_count || 0 }}
            </div>
          </div>
          <HintTip
            v-if="mutationsEnabled && selected && !isEditing"
            text="Удалить ремонт"
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
                @click="deleteRepair(selected!.id)"
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
              <!-- Плановый (капитальный / инвестиционный) и текущий ремонт — разные режимы создания сервера -->
              <SegmentedToggle
                v-if="isNew"
                v-model="createMode"
                :items="createModeItems"
                aria-label="Вид ремонта"
                class="mb-3"
              />
              <JournalDetailFields
                :groups="detailGroups"
                :model="editFields"
                :editable="editable"
                :is-field-dirty="isFieldDirty"
                :required-keys="['name']"
                @update:field="setEditField"
              >
                <v-expansion-panel
                  v-if="repairLines.length && !isEditing"
                  :value="detailGroups.length"
                >
                  <v-expansion-panel-title>Линии контура ({{ repairLines.length }})</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list
                      density="compact"
                      lines="two"
                    >
                      <v-list-item
                        v-for="line in repairLines"
                        :key="Number(line.id)"
                        prepend-icon="mdi-pipe"
                        :title="`Линия ${line.line_id} · ${nodeRange(line)}`"
                        :subtitle="lineSummary(line)"
                      >
                        <template
                          v-if="hasCoordinates(line)"
                          #append
                        >
                          <v-btn
                            icon="mdi-crosshairs-gps"
                            size="x-small"
                            variant="text"
                            aria-label="Показать на карте"
                            @click.stop="locateRelation(line, `Линия ${line.line_id}`)"
                          />
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel
                  v-if="workSections.length && !isEditing"
                  :value="detailGroups.length + 1"
                >
                  <v-expansion-panel-title>Участки работ ({{ workSections.length }})</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list
                      density="compact"
                      lines="two"
                    >
                      <v-list-item
                        v-for="section in workSections"
                        :key="Number(section.id)"
                        prepend-icon="mdi-ruler-square"
                        :title="`Участок ${section.legacy_pipe_section_id || section.id}`"
                        :subtitle="sectionSummary(section)"
                      />
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel
                  v-if="workItems.length && !isEditing"
                  :value="detailGroups.length + 2"
                >
                  <v-expansion-panel-title>Состав работ ({{ workItems.length }})</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-chip
                      v-for="(item, index) in workItems"
                      :key="`${item.category}-${item.name}-${index}`"
                      class="ma-1"
                      size="small"
                      variant="tonal"
                    >
                      {{ item.category }} · {{ item.name }}
                    </v-chip>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel
                  v-if="relatedDefects.length && !isEditing"
                  :value="detailGroups.length + 3"
                >
                  <v-expansion-panel-title>Связанные нарушения ({{ relatedDefects.length }})</v-expansion-panel-title>
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
                  :value="detailGroups.length + 4"
                >
                  <v-expansion-panel-title>Документы ({{ documents.length }})</v-expansion-panel-title>
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
                journal="repairs"
                :record-id="selected.id"
                :record-label="selected.name || `Ремонт ${selected.id}`"
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
            @click="locate(selected, selected.name || `Ремонт ${selected.id}`)"
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
      journal="repairs"
      @approved="loadRepairs"
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
import { useNotificationStore } from '~/stores/notificationStore'
import { computed, reactive, ref, watch } from 'vue'
import { useJournalEdit } from '~/composables/useJournalEdit'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import { useJournalRecordForm } from '~/composables/useJournalRecordForm'
import { fastApiService, type RepairDetails, type RepairLookups, type RepairSummary } from '~/services/fastApiService'

/**
 * Журнал ремонтов — тип (б) «рабочее место» (docs/ui-modernization-progress.md, этап 5): `DataTable` с серверной
 * пагинацией, плитки состояний из `state_counts`, фильтры `SearchField` / `AppSelect`, массовое утверждение плана
 * (`JournalBatchApprovalDialog`), печать формы 10 и Word сохранены; карточка на общих `JournalDetailFields` +
 * `useJournalEdit` (черновик, «изменено», отмена с подтверждением), линии контура с переходом на карту.
 */
export interface RepairJournalScope { lineId?: number; nodeId?: number; repairId?: number }
const emit = defineEmits<{
  'locate-repair': [coordinates: { longitude: number; latitude: number; id: number; label: string }]
  'open-defect': [defectId: number]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled('repairs')

const openForm10Report = () => {
  const url = fastApiService.getFormReportUrl('f10_remont', search.value)
  window.open(url, '_blank')
}

const visible = ref(false)
const loading = ref(false)
const error = ref('')
const items = ref<RepairSummary[]>([])
const total = ref(0)
const pages = ref(0)
const page = ref(1)
const pageSize = 50
const search = ref('')
const stateId = ref<number | undefined>()
const repairTypeId = ref<number | undefined>()
const categoryId = ref<number | undefined>()
const responsibleId = ref<number | undefined>()
const approved = ref<boolean | undefined>()
const dateFrom = ref('')
const dateTo = ref('')
const scope = reactive<RepairJournalScope>({})
const lookups = reactive<RepairLookups>({
  states: [], repair_types: [], categories: [], subdivisions: [], document_types: [], responsible_people: []
})
const approvalOptions = [{ title: 'Утверждено', value: true }, { title: 'Не утверждено', value: false }]
/** Счётчики по состояниям из ответа списка; null — API их не отдаёт (плитки скрыты) */
const stateCounts = ref<{ state_id: number | null; count: number }[] | null>(null)
const detailsVisible = ref(false)
// Другой журнал начал выбор участков на карте — закрыть это окно (QA F48)
useCloseOnMapPick(() => visible.value || detailsVisible.value, () => { detailsVisible.value = false; visible.value = false })
const detailsLoading = ref(false)
const detailsError = ref('')
const selected = ref<RepairDetails | null>(null)
const creating = ref(false)
const deleting = ref(false)
const exportingWord = ref(false)

const scopeTitle = computed(() => scope.lineId ? `ремонты трубопровода ${scope.lineId}`
  : scope.nodeId ? `ремонты прилегающих трубопроводов узла ${scope.nodeId}` : 'вся тепловая сеть')
const filtersActive = computed(() => Boolean(
  search.value.trim() || stateId.value || repairTypeId.value || categoryId.value || responsibleId.value
  || approved.value != null || dateFrom.value || dateTo.value,
))

const tableColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 76, sortable: false },
  { key: 'period', title: 'Период', type: 'date', width: 170, sortable: false },
  { key: 'name', title: 'Ремонт', sortable: false },
  { key: 'kind', title: 'Вид / категория', width: 170, sortable: false },
  { key: 'state_name', title: 'Состояние', width: 120, sortable: false },
  { key: 'responsible_name', title: 'Ответственный', width: 150, sortable: false },
  { key: 'line_count', title: 'Линии', type: 'number', width: 80, sortable: false },
  { key: 'budget', title: 'Бюджет, план / факт', type: 'number', width: 180, sortable: false },
  { key: 'result', title: 'Результат', sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false },
]

/** Состояние ремонта → тон плитки: план — нейтрально, в работе — внимание, выполнен — в порядке */
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
const formatRange = (start: unknown, finish: unknown) => [formatDate(start), formatDate(finish)].filter((v, i, a) => v !== '—' && a.indexOf(v) === i).join(' — ') || '—'
const moneyFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
const formatMoney = (value: unknown) => value === null || value === undefined || value === '' ? '—' : moneyFormat.format(Number(value))
const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value)
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  return String(value)
}
const stateColor = (state: number | null) => state === 3 ? 'success' : state === 2 ? 'warning' : state === 1 ? 'info' : 'grey'
const hasCoordinates = (item: { longitude?: unknown; latitude?: unknown }) => hasLonLat(item)
const fileName = (path: unknown) => String(path || 'Файл не указан').split(/[\\/]/).pop() || 'Файл'
const nodeRange = (line: Record<string, unknown>) => [line.start_node_name, line.end_node_name].filter(Boolean).join(' — ') || 'узлы не указаны'
const lineSummary = (line: Record<string, unknown>) => [line.diameter && `DN ${line.diameter}`, line.length && `длина ${line.length} м`, line.tubing_type_name].filter(Boolean).join(' · ') || 'Параметры участка не заполнены'
const sectionSummary = (section: Record<string, unknown>) => [section.tubing_type_name, section.diameter && `DN ${section.diameter}`, section.pipe_length && `труба ${section.pipe_length} м`, section.insulation_area && `изоляция ${section.insulation_area} м²`, section.channel_length && `канал ${section.channel_length} м`].filter(Boolean).join(' · ') || 'Параметры работ не заполнены'

const loadLookups = async () => {
  if (lookups.states.length) return
  Object.assign(lookups, await fastApiService.getRepairLookups())
}
/** Номер последнего запроса списка */
let listRequest = 0
const loadRepairs = async () => {
  const request = ++listRequest
  loading.value = true; error.value = ''
  try {
    const response = await fastApiService.getRepairs({ page: page.value, page_size: pageSize, state_id: stateId.value,
      repair_type_id: repairTypeId.value, category_id: categoryId.value, responsible_id: responsibleId.value,
      approved: approved.value, date_from: dateFrom.value || undefined, date_to: dateTo.value || undefined,
      line_id: scope.lineId, node_id: scope.nodeId, search: search.value.trim() || undefined })
    if (request !== listRequest) return
    items.value = response.items; total.value = response.total; pages.value = response.pages
    stateCounts.value = Array.isArray(response.state_counts) ? response.state_counts : null
  } catch (loadError: any) {
    if (request !== listRequest) return
    error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить журнал ремонтов'
  } finally { if (request === listRequest) loading.value = false }
}
/** Текст после паузы ввода (SearchField) */
const onSearch = () => {
  if (!visible.value) return
  page.value = 1
  void loadRepairs()
}
/** Номер последнего запроса карточки: ответ более раннего запроса не перекрывает поздний */
let detailsRequest = 0
const openDetails = async (id: number) => {
  // открытие другой записи во время правки — черновик текущей остаётся, карточка на просмотр
  closeKeepingDraft(); resetEdit()
  const request = ++detailsRequest
  detailsVisible.value = true; detailsLoading.value = true; detailsError.value = ''; selected.value = null
  try { const record = await fastApiService.getRepair(id); if (request !== detailsRequest) return; selected.value = record }
  catch (loadError: any) { if (request !== detailsRequest) return; detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку ремонта' }
  finally { if (request === detailsRequest) detailsLoading.value = false }
}
const notifications = useNotificationStore()
let openDialogSeq = 0
const openDialog = async (nextScope: RepairJournalScope = {}) => {
  const seq = ++openDialogSeq
  Object.assign(scope, { lineId: undefined, nodeId: undefined, repairId: undefined }, nextScope)
  page.value = 1; visible.value = true
  // список и схема сами показывают свои ошибки; сбой справочников не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), loadRepairs(), recordForm.loadSchema()])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — фильтры и выбор значений могут быть неполными'))
  // журнал открыли снова, пока грузились списки — запись открывает последний вызов
  if (seq !== openDialogSeq) return
  if (nextScope.repairId) await openDetails(nextScope.repairId)
}
const clearScope = () => { scope.lineId = undefined; scope.nodeId = undefined; page.value = 1; void loadRepairs() }

const recordForm = useJournalRecordForm('repairs')
const batchApprovalRef = ref<{ open: () => Promise<void> } | null>(null)
const {
  isEditing, isNew, saving, editFields, flashId, isDirty, isFieldDirty, editable, setEditField,
  beginCreate, beginEdit, resetEdit, cancel, closeKeepingDraft, markSaved, forgetDraft,
} = useJournalEdit('repairs', recordForm, selected)
const createMode = ref<'plan' | 'current'>('plan')
const createModeItems: SegmentedToggleItem<'plan' | 'current'>[] = [
  { value: 'plan', label: 'План (капитальный / инвестиционный)', icon: 'mdi-calendar-check-outline', hint: 'С плановыми датами и бюджетом, попадает в план на утверждение' },
  { value: 'current', label: 'Текущий ремонт', icon: 'mdi-wrench-outline', hint: 'Без плана: сразу в работу' },
]
const networkTypes = [{ id: 1, name: 'Магистральная сеть' }, { id: 2, name: 'Внутриквартальная сеть' }]

const createRepair = async () => {
  createMode.value = 'plan'
  selected.value = null
  detailsVisible.value = true
  detailsError.value = ''
  await beginCreate({ name: '' })
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
      edited: editFields.value, mode: createMode.value,
    })
    markSaved(id)
    await loadRepairs()
    if (id) await openDetails(id)
  } catch (e: any) {
    recordForm.showError(formatApiError(e, 'Ошибка при сохранении'))
  } finally {
    saving.value = false
  }
}

const deleteRepair = async (id: number) => {
  deleting.value = true
  try {
    if (await recordForm.remove(id, selected.value?.name || `Ремонт ${id}`)) {
      forgetDraft(id)
      detailsVisible.value = false
      await loadRepairs()
    }
  } finally {
    deleting.value = false
  }
}

/** Перечитать карточку после утверждения/контура, не закрывая её */
const refreshSelected = async () => {
  const id = selected.value?.id
  if (!id) return
  try {
    const record = await fastApiService.getRepair(id)
    if (selected.value?.id === id) selected.value = record
  } catch (e: any) {
    notifications.showWarning(formatApiError(e, 'Карточка не обновилась — показаны прежние данные'))
  }
  void loadRepairs()
}

/** Выбор участков контура на карте: журнал скрывается и возвращается после выбора */
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
  search.value = ''; stateId.value = undefined; repairTypeId.value = undefined; categoryId.value = undefined
  responsibleId.value = undefined; approved.value = undefined; dateFrom.value = ''; dateTo.value = ''; page.value = 1
  void loadRepairs()
}
const locate = (item: RepairSummary, label: string) => {
  if (!hasCoordinates(item)) return
  emit('locate-repair', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, label })
  detailsVisible.value = false; visible.value = false
}
const locateRelation = (relation: Record<string, unknown>, label: string) => {
  if (!selected.value || !hasCoordinates(relation)) return
  emit('locate-repair', { longitude: Number(relation.longitude), latitude: Number(relation.latitude), id: selected.value.id, label })
  detailsVisible.value = false; visible.value = false
}
const openRelatedDefect = (id: number) => { detailsVisible.value = false; visible.value = false; emit('open-defect', id) }
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
    { title: 'Общие сведения', fields: buildFields([
      ['Наименование', item?.name, 'name', 'text'], ['Состояние', item?.state_name, 'state_id', 'select', lookups.states], ['Вид ремонта', item?.repair_type_name, 'repair_type_id', 'select', lookups.repair_types], ['Категория', item?.category_name, 'category_id', 'select', lookups.categories],
      ['Тип тепловой сети', item?.network_type_name, 'network_type_id', 'select', networkTypes], ['Утверждение', item?.approval_name], ['Ответственный', item?.responsible_name, 'responsible_id', 'select', lookups.responsible_people],
      ['Подразделение', item?.subdivision_name, 'subdivision_id', 'select', lookups.subdivisions], ['Характеристика участков', item?.section_characteristics, 'section_characteristics', 'textarea'], ['Описание работ', item?.work_description, 'work_description', 'textarea']
    ]) },
    { title: 'План', fields: buildFields([
      ['Начало по плану', item?.planned_start, 'planned_start', 'date'], ['Окончание по плану', item?.planned_finish, 'planned_finish', 'date'], ['Дата утверждения плана', item?.plan_approved_on, 'plan_approved_on', 'date'],
      ['Длина трубы, м', item?.planned_pipe_length, 'planned_pipe_length', 'number'], ['Диаметр трубы', item?.planned_pipe_diameter, 'planned_pipe_diameter', 'text'], ['Площадь изоляции, м²', item?.planned_insulation_area, 'planned_insulation_area', 'number'],
      ['Длина канала, м', item?.planned_channel_length, 'planned_channel_length', 'number'], ['Асфальтирование, м²', item?.planned_asphalt_area, 'planned_asphalt_area', 'number'],
      ['Бюджет', item?.planned_budget, 'planned_budget', 'number'], ['Ремонтный персонал', item?.planned_personnel, 'planned_personnel', 'text']
    ]) },
    { title: 'Фактическое выполнение', fields: buildFields([
      ['Начало ремонта', item?.actual_start, 'actual_start', 'date'], ['Завершение ремонта', item?.actual_finish, 'actual_finish', 'date'], ['Длина трубы, м', item?.actual_pipe_length, 'actual_pipe_length', 'number'],
      ['Площадь изоляции, м²', item?.actual_insulation_area, 'actual_insulation_area', 'number'], ['Длина канала, м', item?.actual_channel_length, 'actual_channel_length', 'number'],
      ['Асфальтирование, м²', item?.actual_asphalt_area, 'actual_asphalt_area', 'number'], ['Фактический бюджет', item?.actual_budget, 'actual_budget', 'number'],
      ['Ремонтный персонал', item?.actual_personnel, 'actual_personnel', 'text'], ['Характеристика работ', item?.work_characteristics, 'work_characteristics', 'textarea'], ['Результаты ремонта', item?.results, 'results', 'textarea']
    ]) },
    { title: 'Последствия и ввод в эксплуатацию', fields: buildFields([
      ['Отключено потребителей', item?.disconnected_consumers, 'disconnected_consumers', 'number'], ['Недоотпуск тепловой энергии', item?.undelivered_heat, 'undelivered_heat', 'number'],
      ['Номер приказа', item?.commissioning_order_number, 'commissioning_order_number', 'text'], ['Дата приказа', item?.commissioning_order_date, 'commissioning_order_date', 'date'],
      ['Файл приказа', item?.commissioning_order_file, 'commissioning_order_file', 'text'], ['Примечание', item?.note, 'note', 'textarea']
    ]) }
  ].filter(group => group.fields.length)
})
const repairLines = computed(() => selected.value?.relations?.lines || [])
const workSections = computed(() => selected.value?.relations?.work_sections || [])
const workItems = computed(() => selected.value?.relations?.work_items || [])
const relatedDefects = computed(() => selected.value?.relations?.defects || [])
const documents = computed(() => selected.value?.relations?.documents || [])

watch(page, () => { if (visible.value) void loadRepairs() })
watch([stateId, repairTypeId, categoryId, responsibleId, approved, dateFrom, dateTo], () => {
  if (!visible.value) return; page.value = 1; void loadRepairs()
})
const exportWord = async () => {
  if (!selected.value) return
  exportingWord.value = true
  try {
    const { blob, filename } = await fastApiService.downloadOpsWordReport('remont', selected.value.id)
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
.repair-journal { height: min(90vh, 900px); display: flex; flex-direction: column; }
.repair-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.repair-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.repair-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.repair-table { min-width: 1260px; }
.result-cell { display: inline-block; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
@media (max-width: 600px) { .repair-journal { height: 100dvh; } }
</style>
